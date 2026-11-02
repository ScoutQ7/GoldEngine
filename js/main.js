import { GameMap } from './map.js';
import { WeaponSystem } from './weapons.js';
import { Player } from './player.js';
import { MapEditor } from './editor.js';
import { NetworkClient } from './network.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const weapons = new WeaponSystem();

// --- НОЖ ---
if (!weapons.get('knife')) {
  weapons.weapons.push({
    id: 'knife', name: 'Нож', type: 'melee', magazine: 999, reserveAmmo: 0,
    firingMode: 'single', pellets: 1, spread: 0, damage: 55, fireRate: 400,
    reloadTime: 0, hasScope: false, scopeZoom: 1, bulletSpeed: 50, color: '#C0C0C0', image: null
  });
}

const defaultTiles = {
  'void':   { id: 'void',   name: 'Пустота', solid: true,  color: '#0f0f0f', image: null },
  'floor1': { id: 'floor1', name: 'Пол 1',   solid: false, color: '#6B6B6B', image: null },
  'wall1':  { id: 'wall1',  name: 'Стена 1', solid: true,  color: '#4A4A4A', image: null }
};

const state = {
  mode: 'editor',
  map: new GameMap(),
  weapons: weapons,
  player: new Player(200, 200, weapons),
  tiles: { ...defaultTiles },
  input: { 
    up:false, down:false, left:false, right:false, 
    mouseX:0, mouseY:0, mouseDown:false, mouseRight:false,
    reload:false, interact: false,
    weapon1:false, weapon2:false, weapon3:false
  },
  camera: { x: 0, y: 0 },
  playerSettings: { speed: 3, shape: 'circle', color: '#00FF88', image: null },
  prefabs: { npcs: [
    { id:'npc_guard', name:'Guard', color:'#4CAF50', speed: 2, behavior:'idle', weapon:'pistol', interaction: 'Привет! Ты не должен быть здесь.' }
  ] },
  entities: [], scenes: [], activeSceneIndex: 0,
  selectedButtonId: null, selectedEntityIndex: null,
  isDraggingButton: false, dragOffset: { x: 0, y: 0 },
  activeInteraction: null, activeNpcData: null,
  network: new NetworkClient(), isMultiplayer: false
};

// Инициализация редактора ДО загрузки сцен
const editor = new MapEditor(state.map, canvas, () => state.camera, () => state.tiles);
editor.onPan = (dx, dy) => { state.camera.x -= dx; state.camera.y -= dy; };

function initScenes() {
  state.scenes = [
    { id: 'scene_menu', name: 'Main Menu', type: 'menu', bgImage: null, mapData: null, entities: [], buttons: [] },
    { id: 'scene_playground', name: 'Level 1', type: 'playground', bgImage: null, mapData: new GameMap().toJSON(), entities: [], buttons: [] }
  ];
  loadScene(0);
}

function loadScene(index) {
  if (state.scenes[state.activeSceneIndex]) {
    state.scenes[state.activeSceneIndex].mapData = state.map.toJSON();
    state.scenes[state.activeSceneIndex].entities = [...state.entities];
  }
  state.activeSceneIndex = index;
  state.selectedButtonId = null; state.selectedEntityIndex = null;
  const scene = state.scenes[index];

  if (scene.mapData) state.map = GameMap.fromJSON(scene.mapData);
  else state.map = new GameMap();

  state.map.setTilesData(state.tiles);
  editor.map = state.map;

  state.entities = [...scene.entities];
  state.camera.x = 0; state.camera.y = 0;

  renderScenePanel();
  if (state.mode === 'editor') {
    if (scene.type === 'playground') buildTileInspector();
    else buildSceneInspector();
  }
  editor.enabled = (state.mode === 'editor' && scene.type === 'playground');
  if (editor.enabled) editor.currentTile = 'wall1';
}

// --- СЕТЬ ---
state.network.on('hit', (data) => {
  if (data.victimId === state.network.selfId) state.player.health = Math.max(0, state.player.health - data.damage);
});
state.network.on('kill', (data) => {
  if (data.victimId === state.network.selfId) { state.player.dead = true; state.player.health = 0; }
});
state.network.on('respawn', (data) => {
  if (state.network.selfId === data.id) {
    state.player.dead = false; state.player.health = 100;
    state.player.x = data.x; state.player.y = data.y;
  }
});
state.network.on('state', (players) => {
  const me = players[state.network.selfId];
  if (me) {
    state.player.health = me.health; state.player.dead = !me.alive;
    if (Math.abs(state.player.x - me.x) > 50 || Math.abs(state.player.y - me.y) > 50) {
      state.player.x = me.x; state.player.y = me.y;
    }
  }
});

// --- ВВОД ---
const codeMap = { 
  KeyW:'up', KeyS:'down', KeyA:'left', KeyD:'right', KeyR:'reload', KeyE:'interact', 
  Digit1:'weapon1', Digit2:'weapon2', Digit3:'weapon3'
};

addEventListener('keydown', e => { 
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (codeMap[e.code]) { state.input[codeMap[e.code]] = true; e.preventDefault(); } 
});
addEventListener('keyup', e => { 
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (codeMap[e.code]) { state.input[codeMap[e.code]] = false; e.preventDefault(); } 
});

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
  state.input.mouseX = state.camera.x + mouseX; state.input.mouseY = state.camera.y + mouseY;
  
  if (state.mode === 'editor' && state.isDraggingButton && state.selectedButtonId) {
    const btn = state.scenes[state.activeSceneIndex].buttons.find(b => b.id === state.selectedButtonId);
    if (btn) { btn.x = mouseX - state.dragOffset.x; btn.y = mouseY - state.dragOffset.y; }
  }
});

canvas.addEventListener('mousedown', e => {
  if (document.getElementById('buy-menu-overlay').classList.contains('active')) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
  const scene = state.scenes[state.activeSceneIndex];

  if (e.button === 0) {
    if (state.mode === 'editor') {
      if (scene.type === 'menu') {
        const clicked = scene.buttons.find(b => mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h);
        if (clicked) { state.selectedButtonId = clicked.id; state.isDraggingButton = true; state.dragOffset = { x: mouseX - clicked.x, y: mouseY - clicked.y }; buildSceneInspector(); }
        else { state.selectedButtonId = null; buildSceneInspector(); }
      } else if (scene.type === 'playground') {
        const clickedEnt = state.entities.find(ent => {
          const ex = state.camera.x + mouseX; const ey = state.camera.y + mouseY;
          if (ent.type === 'decision') return Math.abs(ent.x - ex) < ent.w/2 && Math.abs(ent.y - ey) < ent.h/2;
          return Math.hypot(ent.x - ex, ent.y - ey) < 20;
        });
        if (clickedEnt) { state.selectedEntityIndex = state.entities.indexOf(clickedEnt); buildEntityInspector(); }
        else { state.selectedEntityIndex = null; buildTileInspector(); }
      }
    } else if (state.mode === 'play' && scene.type === 'menu') {
      const clicked = scene.buttons.find(b => mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h);
      if (clicked && clicked.action === 'start_game') {
        const playIndex = state.scenes.findIndex(s => s.type === 'playground');
        if (playIndex !== -1) { loadScene(playIndex); setGameMode(true); }
      }
    }
    state.input.mouseDown = true;
  }
  if (e.button === 2) state.input.mouseRight = true;
});

canvas.addEventListener('mouseup', e => { 
  if (e.button === 0) { state.input.mouseDown = false; state.isDraggingButton = false; } 
  if (e.button === 2) state.input.mouseRight = false; 
});

// --- УТИЛИТЫ ---
function loadImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => { const img = new Image(); img.onload = () => callback(img, e.target.result); img.src = e.target.result; };
  reader.readAsDataURL(file);
}

function drawEntity(ctx, x, y, radius, shape, color, angle, image) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  if (image) { const w = radius * 2.5; ctx.drawImage(image, -w/2, -w/2, w, w); }
  else {
    ctx.fillStyle = color; ctx.beginPath();
    if (shape === 'square') ctx.rect(-radius, -radius, radius*2, radius*2);
    else if (shape === 'triangle') { ctx.moveTo(radius, 0); ctx.lineTo(-radius*0.8, -radius*0.8); ctx.lineTo(-radius*0.8, radius*0.8); ctx.closePath(); }
    else ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

// --- ЗАКУП ---
function openBuyMenu() {
  document.getElementById('buy-menu-overlay').classList.add('active');
  state.activeInteraction = 'buy';
  const radial = document.getElementById('buy-radial');
  const stats = document.getElementById('buy-stats');
  radial.innerHTML = '<div class="buy-center">Ц</div>';
  
  const availableWeapons = weapons.weapons.filter(w => w.id !== 'knife');
  const radius = 180;
  
  availableWeapons.forEach((w, i) => {
    const angle = (i / availableWeapons.length) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius;
    
    const el = document.createElement('div');
    el.className = 'buy-item';
    el.style.left = 'calc(50% + ' + x + 'px - 60px)'; el.style.top = 'calc(50% + ' + y + 'px - 20px)';
    el.innerHTML = '<div>' + w.name + '</div><div class="price">$FREE</div>';
    
    el.onmouseenter = () => {
      stats.innerHTML = '<h2>' + w.name + '</h2>' +
      '<p>Урон: ' + w.damage + '</p><div class="stat-bar"><div class="stat-fill" style="width:' + Math.min(100, w.damage*2) + '%"></div></div>' +
      '<p>Скорость: ' + w.fireRate + 'ms</p><div class="stat-bar"><div class="stat-fill" style="width:' + Math.max(10, 100 - w.fireRate/10) + '%"></div></div>' +
      '<p>Магазин: ' + w.magazine + ' патр.</p>';
    };
    el.onclick = () => {
      state.player.addWeapon(w.id, weapons);
      state.player.ammo[w.id].reserve += w.magazine * 3;
      closeBuyMenu();
    };
    radial.appendChild(el);
  });
  stats.innerHTML = '<h2>Выберите оружие</h2><p>Наведите курсор.</p>';
}

function closeBuyMenu() {
  document.getElementById('buy-menu-overlay').classList.remove('active');
  state.activeInteraction = null;
}

// --- ИГРОВОЙ ЦИКЛ ---
function loop(now) {
  const scene = state.scenes[state.activeSceneIndex];

  if (state.mode === 'play' && scene.type === 'playground' && !state.player.dead) {
    if (state.activeInteraction !== 'buy') {
      state.player.baseSpeed = state.playerSettings.speed;
      state.player.update(state.input, state.map, weapons, now);

      if (state.isMultiplayer && state.network.connected) {
        state.network.sendInput(state.input, state.player);
        state.network.sendScope(state.player.isScoped);
        
        if (state.player._justFired) {
          state.network.sendShoot(state.player.currentWeapon);
          state.player._justFired = false;
        }
        if (state.player._lastSentWeapon !== state.player.currentWeapon) {
          state.network.sendSwitchWeapon(state.player.currentWeapon);
          state.player._lastSentWeapon = state.player.currentWeapon;
        }
      }

      weapons.updateBullets(state.map, () => [], () => {});

      if (state.input.interact) {
        state.input.interact = false;
        let acted = false;
        for (let i = state.entities.length - 1; i >= 0; i--) {
          const ent = state.entities[i];
          if (ent.type === 'weapon') {
            const dist = Math.hypot(ent.x - state.player.x, ent.y - state.player.y);
            if (dist < 50) {
              const w = weapons.get(ent.id);
              if (w) {
                state.player.addWeapon(ent.id, weapons);
                state.player.ammo[ent.id].reserve += w.magazine;
                state.entities.splice(i, 1);
              }
              acted = true; break;
            }
          }
        }
        if (!acted) {
          for (let ent of state.entities) {
            if (ent.type === 'npc') {
              if (Math.hypot(ent.x - state.player.x, ent.y - state.player.y) < 60) {
                const npc = state.prefabs.npcs.find(x => x.id === ent.id);
                if (npc && npc.interaction) { state.activeInteraction = 'npc'; state.activeNpcData = npc; break; }
              }
            } else if (ent.type === 'decision') {
              if (Math.abs(ent.x - state.player.x) < ent.w/2 && Math.abs(ent.y - state.player.y) < ent.h/2) {
                if (ent.zoneType === 'buy') openBuyMenu();
                else { state.activeInteraction = 'npc'; state.activeNpcData = { name: ent.title, interaction: ent.dialogue }; }
                break;
              }
            }
          }
        }
      }
    }
    state.camera.x = state.player.x - canvas.width / 2;
    state.camera.y = state.player.y - canvas.height / 2;
  }
  render();
  requestAnimationFrame(loop);
}

// --- РЕНДЕР ---
function render() {
  const scene = state.scenes[state.activeSceneIndex];
  if (!scene) return;

  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (scene.type === 'menu') {
    if (scene.bgImage) ctx.drawImage(scene.bgImage, 0, 0, canvas.width, canvas.height);
    else { ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (scene.buttons) {
      scene.buttons.forEach(btn => {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
        ctx.strokeStyle = (state.selectedButtonId === btn.id && state.mode === 'editor') ? '#00FF88' : '#444';
        ctx.lineWidth = (state.selectedButtonId === btn.id && state.mode === 'editor') ? 3 : 1; ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
        ctx.fillStyle = '#00FF88'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(btn.text, btn.x + btn.w/2, btn.y + btn.h/2);
      });
    }
  } else {
    state.map.render(ctx, state.camera.x, state.camera.y, canvas.width, canvas.height, state.tiles);
    
    state.entities.forEach((ent, idx) => {
      const sx = ent.x - state.camera.x; const sy = ent.y - state.camera.y;
      if (ent.type === 'weapon') {
        const w = weapons.get(ent.id); if (!w) return;
        if (w.image) ctx.drawImage(w.image, sx - 16, sy - 16, 32, 32);
        else { ctx.fillStyle = w.color || '#fff'; ctx.fillRect(sx - 12, sy - 12, 24, 24); }
      } else if (ent.type === 'npc') {
        const n = state.prefabs.npcs.find(x => x.id === ent.id); if (!n) return;
        drawEntity(ctx, sx, sy, 12, n.shape, n.color, 0, n.image);
        ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.fillText(n.name, sx, sy - 20);
      } else if (ent.type === 'decision') {
        ctx.fillStyle = ent.zoneType === 'buy' ? 'rgba(0, 150, 255, 0.2)' : 'rgba(0, 255, 136, 0.2)';
        ctx.strokeStyle = ent.zoneType === 'buy' ? '#0096FF' : '#00FF88';
        ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.fillRect(sx - ent.w/2, sy - ent.h/2, ent.w, ent.h);
        ctx.strokeRect(sx - ent.w/2, sy - ent.h/2, ent.w, ent.h);
        ctx.setLineDash([]);
        ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.fillText(ent.title, sx, sy - ent.h/2 - 10);
        if (state.selectedEntityIndex === idx && state.mode === 'editor') { ctx.strokeStyle = '#FFAA00'; ctx.lineWidth = 3; ctx.strokeRect(sx - ent.w/2, sy - ent.h/2, ent.w, ent.h); }
      }
    });

    if (state.mode === 'play') {
      if (state.isMultiplayer) {
        for (const id in state.network.players) {
          if (id === state.network.selfId) continue;
          const p = state.network.players[id]; if (!p.alive) continue;
          ctx.fillStyle = '#FF5555'; ctx.beginPath(); ctx.arc(p.x - state.camera.x, p.y - state.camera.y, 12, 0, Math.PI * 2); ctx.fill();
        }
      }
      weapons.renderEffects(ctx, state.camera.x, state.camera.y); weapons.renderBullets(ctx, state.camera.x, state.camera.y);
      
      if (!state.player.dead) {
        drawEntity(ctx, state.player.x - state.camera.x, state.player.y - state.camera.y, 12, state.playerSettings.shape, state.playerSettings.color, state.player.angle, state.playerSettings.image);
      }
      
      renderHUD();
      if (state.activeInteraction === 'npc') renderDialog();

      // --- ПРИЦЕЛ CS2D ---
      if (state.player.isScoped) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.arc(canvas.width / 2, canvas.height / 2, 220, 0, Math.PI * 2, true);
        ctx.fill();
        
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 300, canvas.height / 2);
        ctx.lineTo(canvas.width / 2 - 20, canvas.height / 2);
        ctx.moveTo(canvas.width / 2 + 20, canvas.height / 2);
        ctx.lineTo(canvas.width / 2 + 300, canvas.height / 2);
        ctx.moveTo(canvas.width / 2, canvas.height / 2 - 300);
        ctx.lineTo(canvas.width / 2, canvas.height / 2 - 20);
        ctx.moveTo(canvas.width / 2, canvas.height / 2 + 20);
        ctx.lineTo(canvas.width / 2, canvas.height / 2 + 300);
        ctx.stroke();
        
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (state.mode === 'editor') {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      for (let x = Math.floor(state.camera.x/32)*32; x < state.camera.x+canvas.width; x+=32) { ctx.beginPath(); ctx.moveTo(x-state.camera.x, 0); ctx.lineTo(x-state.camera.x, canvas.height); ctx.stroke(); }
      for (let y = Math.floor(state.camera.y/32)*32; y < state.camera.y+canvas.height; y+=32) { ctx.beginPath(); ctx.moveTo(0, y-state.camera.y); ctx.lineTo(canvas.width, y-state.camera.y); ctx.stroke(); }
    }
  }
}

function renderHUD() {
  const p = state.player;
  const w = weapons.get(p.currentWeapon);
  
  ctx.save(); 
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(10, 10, 250, 130);
  ctx.fillStyle = p.dead ? '#FF4444' : '#fff'; ctx.font = '14px monospace';
  ctx.fillText((p.dead ? 'DEAD' : 'HP') + ': ' + p.health, 20, 32); 
  
  const slotNames = ['1', '2', '3'];
  for (let i = 0; i < 3; i++) {
    const invW = p.inventory[i];
    const isActive = (p.activeSlot === i);
    const wData = weapons.get(invW);
    
    ctx.fillStyle = isActive ? '#00FF88' : '#666';
    ctx.fillText('[' + slotNames[i] + ']', 20, 60 + i * 20);
    
    ctx.fillStyle = isActive ? '#fff' : '#888';
    if (wData) ctx.fillText(wData.name, 55, 60 + i * 20);
    else ctx.fillText('Пусто', 55, 60 + i * 20);
  }

  if (w && w.id !== 'knife' && p.currentAmmo) {
    const ammo = p.currentAmmo;
    ctx.font = 'bold 22px monospace'; 
    ctx.fillStyle = ammo.mag === 0 ? '#FF4444' : '#fff'; 
    ctx.fillText(ammo.mag, 180, 32);
    ctx.font = '14px monospace'; 
    ctx.fillStyle = '#aaa'; 
    ctx.fillText('/ ' + ammo.reserve, 210, 32);
  }
  
  if (p.isReloading) {
    ctx.fillStyle = '#FFCC00'; ctx.font = '14px monospace';
    ctx.fillText('Перезарядка...', 20, 140);
  }
  ctx.restore();
}

function renderDialog() {
  const int = state.activeNpcData; if (!int) return;
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(canvas.width/2 - 200, canvas.height/2 - 150, 400, 300);
  ctx.strokeStyle = '#00FF88'; ctx.lineWidth = 2; ctx.strokeRect(canvas.width/2 - 200, canvas.height/2 - 150, 400, 300);
  ctx.fillStyle = '#00FF88'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.fillText(int.name, canvas.width/2, canvas.height/2 - 100);
  ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
  const words = int.interaction.split(' '); let line = ''; let y = canvas.height/2 - 50;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > 350 && n > 0) { ctx.fillText(line, canvas.width/2, y); line = words[n] + ' '; y += 24; }
    else { line = testLine; }
  }
  ctx.fillText(line, canvas.width/2, y);
  ctx.fillStyle = '#888'; ctx.font = '14px monospace'; ctx.fillText('[E] Закрыть', canvas.width/2, canvas.height/2 + 120);
  if (state.input.interact) { state.input.interact = false; state.activeInteraction = null; }
  ctx.textAlign = 'left'; ctx.restore();
}

// --- UI ИНСПЕКТОР ---
function renderScenePanel() {
  const list = document.getElementById('scene-list'); if (!list) return; list.innerHTML = '';
  state.scenes.forEach((scene, index) => {
    const el = document.createElement('div'); el.className = 'scene-item ' + (index === state.activeSceneIndex ? 'active' : '');
    el.innerHTML = '<span>' + scene.name + '</span><span class="scene-type-badge">' + (scene.type === 'menu' ? 'MENU' : 'PLAY') + '</span>';
    el.onclick = () => loadScene(index); list.appendChild(el);
  });
}

function buildSceneInspector() {
  const inspector = document.getElementById('inspector-content'); const scene = state.scenes[state.activeSceneIndex];
  if (state.selectedButtonId) {
    const btn = scene.buttons.find(b => b.id === state.selectedButtonId);
    if (btn) {
      inspector.innerHTML = '<h3 style="padding: 10px; background: #333;">Кнопка</h3><div style="padding: 10px; display: flex; flex-direction: column; gap: 10px;">' +
        '<label>Текст: <input type="text" id="btn-text" value="' + btn.text + '" style="background:#111;color:#fff;width:100%;padding:6px;"></label>' +
        '<label>Действие: <select id="btn-action" style="background:#111;color:#fff;width:100%;padding:6px;"><option value="none" ' + (btn.action==='none'?'selected':'') + '>Ничего</option><option value="start_game" ' + (btn.action==='start_game'?'selected':'') + '>Начать игру</option></select></label>' +
        '<button id="btn-del" style="background:#900;color:#fff;padding:8px;border:none;">Удалить</button></div>';
      document.getElementById('btn-text').oninput = (e) => btn.text = e.target.value;
      document.getElementById('btn-action').onchange = (e) => btn.action = e.target.value;
      document.getElementById('btn-del').onclick = () => { scene.buttons = scene.buttons.filter(b => b.id !== state.selectedButtonId); state.selectedButtonId = null; buildSceneInspector(); };
      return;
    }
  }
  let html = '<h3 style="padding: 10px; background: #333;">Сцена</h3><div style="padding: 10px; display: flex; flex-direction: column; gap: 10px;">';
  html += '<label>Имя: <input type="text" id="scene-name" value="' + scene.name + '" style="background:#111;color:#fff;width:100%;padding:6px;"></label>';
  html += '<label>Тип: <select id="scene-type" style="background:#111;color:#fff;width:100%;padding:6px;">';
  html += '<option value="menu" ' + (scene.type==='menu'?'selected':'') + '>Menu</option>';
  html += '<option value="playground" ' + (scene.type==='playground'?'selected':'') + '>Playground</option></select></label>';
  if (scene.type === 'menu') {
    html += '<label>Фон: <input type="file" id="scene-bg" accept="image/*"></label>';
    html += '<button id="add-btn" style="background:#00FF88;color:#000;padding:8px;border:none;">+ Кнопка</button>';
  }
  html += '</div>';
  inspector.innerHTML = html;

  document.getElementById('scene-name').oninput = (e) => { scene.name = e.target.value; renderScenePanel(); };
  document.getElementById('scene-type').onchange = (e) => { scene.type = e.target.value; renderScenePanel(); buildSceneInspector(); editor.enabled = (state.mode === 'editor' && scene.type === 'playground'); };
  if (scene.type === 'menu') {
    document.getElementById('scene-bg').onchange = (e) => { if (e.target.files[0]) loadImage(e.target.files[0], (img) => { scene.bgImage = img; buildSceneInspector(); }); };
    document.getElementById('add-btn').onclick = () => { scene.buttons.push({ id: 'btn_'+Date.now(), text: 'Start', x: canvas.width/2-100, y: canvas.height/2-25, w: 200, h: 50, action: 'start_game' }); };
  }
}

function buildEntityInspector() {
  const inspector = document.getElementById('inspector-content'); const ent = state.entities[state.selectedEntityIndex]; if (!ent) return;
  let html = '<h3 style="padding: 10px; background: #333;">Объект</h3><div style="padding: 10px; display: flex; flex-direction: column; gap: 10px;">';
  if (ent.type === 'decision') {
    html += '<label>Название: <input type="text" id="ent-title" value="' + (ent.title || '') + '" style="width:100%;background:#111;color:#fff;padding:4px;"></label>';
    html += '<label>Тип: <select id="ent-ztype" style="width:100%;background:#111;color:#fff;padding:4px;">';
    html += '<option value="buy" ' + (ent.zoneType === 'buy' ? 'selected' : '') + '>Закуп</option>';
    html += '<option value="dialogue" ' + (ent.zoneType === 'dialogue' ? 'selected' : '') + '>Диалог</option>';
    html += '</select></label>';
    html += '<label>Ширина: <input type="number" id="ent-w" value="' + (ent.w || 200) + '" style="width:100%;background:#111;color:#fff;padding:4px;"></label>';
    html += '<label>Высота: <input type="number" id="ent-h" value="' + (ent.h || 200) + '" style="width:100%;background:#111;color:#fff;padding:4px;"></label>';
    html += '<label>Текст: <textarea id="ent-dial" style="width:100%;height:60px;background:#111;color:#fff;padding:4px;">' + (ent.dialogue || '') + '</textarea></label>';
  } else { html += '<p>Тип: ' + ent.type + '</p>'; }
  html += '<button id="del-ent" style="background:#900;color:#fff;padding:8px;border:none;width:100%;margin-top:10px;">Удалить</button></div>';
  inspector.innerHTML = html;

  if (ent.type === 'decision') {
    document.getElementById('ent-title').oninput = (e) => ent.title = e.target.value;
    document.getElementById('ent-ztype').onchange = (e) => ent.zoneType = e.target.value;
    document.getElementById('ent-w').oninput = (e) => ent.w = +e.target.value;
    document.getElementById('ent-h').oninput = (e) => ent.h = +e.target.value;
    document.getElementById('ent-dial').oninput = (e) => ent.dialogue = e.target.value;
  }
  document.getElementById('del-ent').onclick = () => { state.entities.splice(state.selectedEntityIndex, 1); state.selectedEntityIndex = null; buildTileInspector(); };
}

function buildTileInspector() {
  const inspector = document.getElementById('inspector-content');
  inspector.innerHTML = '<h3 style="padding: 10px; background: #333;">Кисти (Тайлы)</h3><div style="padding:10px; display:grid; grid-template-columns: 1fr 1fr; gap:5px;" id="tile-grid"></div>';
  const grid = document.getElementById('tile-grid');
  for (const id in state.tiles) {
    const tile = state.tiles[id];
    const btn = document.createElement('button'); 
    btn.style.background = tile.color; btn.style.color = '#fff'; btn.style.padding = '10px'; btn.style.border = (editor.currentTile === id) ? '2px solid #00FF88' : '1px solid #111';
    btn.textContent = tile.name; 
    btn.onclick = () => { editor.currentTile = id; buildTileInspector(); }; 
    grid.appendChild(btn);
  }
}

// --- ПРЕФАБЫ ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderPrefabs(btn.dataset.tab); };
});

function renderPrefabs(tab) {
  const container = document.getElementById('prefab-content'); if (!container) return; container.innerHTML = '';
  if (tab === 'weapons') {
    const newBtn = document.createElement('div'); newBtn.className = 'prefab-item'; newBtn.innerHTML = '<div class="icon-box new-btn">+</div><div class="name">Новое</div>'; newBtn.onclick = openWeaponEditor; container.appendChild(newBtn);
    weapons.weapons.forEach(w => {
      if (w.id === 'knife') return;
      const el = document.createElement('div'); el.className = 'prefab-item'; el.draggable = true;
      el.innerHTML = '<div class="icon-box" style="background:' + (w.color||'#555') + '">' + w.name[0] + '</div><div class="name">' + w.name + '</div>';
      el.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({type:'weapon', id:w.id}));
      container.appendChild(el);
    });
  } else if (tab === 'npcs') {
    const newBtn = document.createElement('div'); newBtn.className = 'prefab-item'; newBtn.innerHTML = '<div class="icon-box new-btn">+</div><div class="name">Новый</div>'; newBtn.oncontextmenu = (e) => { e.preventDefault(); openNpcEditor(); }; newBtn.onclick = () => alert('ПКМ по кнопке!'); container.appendChild(newBtn);
    state.prefabs.npcs.forEach(n => {
      const el = document.createElement('div'); el.className = 'prefab-item'; el.draggable = true;
      el.innerHTML = '<div class="icon-box npc-box">' + n.name[0] + '</div><div class="name">' + n.name + '</div>';
      el.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({type:'npc', id:n.id}));
      container.appendChild(el);
    });
  } else if (tab === 'decisions') {
    const el = document.createElement('div'); el.className = 'prefab-item'; el.draggable = true;
    el.innerHTML = '<div class="decision-circle"></div><div class="name">Зона</div>';
    el.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({type:'decision', id:'default'}));
    container.appendChild(el);
  } else if (tab === 'tiles') {
    const newBtn = document.createElement('div'); newBtn.className = 'prefab-item'; newBtn.innerHTML = '<div class="icon-box new-btn">+</div><div class="name">Тайл</div>'; newBtn.onclick = openTileEditor; container.appendChild(newBtn);
    for (let id in state.tiles) {
      const tile = state.tiles[id];
      if (id === 'void') continue;
      const el = document.createElement('div'); el.className = 'prefab-item';
      if (tile.image) { el.innerHTML = '<img src="' + tile.image.src + '" style="width:44px;height:44px;object-fit:contain;image-rendering:pixelated;">'; }
      else { el.innerHTML = '<div class="icon-box" style="background:' + tile.color + '"></div>'; }
      el.innerHTML += '<div class="name">' + tile.name + '</div>';
      el.onclick = () => { editor.currentTile = id; buildTileInspector(); };
      container.appendChild(el);
    }
  }
}

canvas.addEventListener('dragover', e => e.preventDefault());
canvas.addEventListener('drop', e => {
  e.preventDefault(); const dataStr = e.dataTransfer.getData('text/plain'); if (!dataStr) return;
  const data = JSON.parse(dataStr); const rect = canvas.getBoundingClientRect();
  const newEnt = { type: data.type, id: data.id, x: state.camera.x + (e.clientX - rect.left), y: state.camera.y + (e.clientY - rect.top) };
  if (data.type === 'decision') { newEnt.w = 200; newEnt.h = 200; newEnt.title = 'Зона'; newEnt.zoneType = 'buy'; newEnt.dialogue = 'Привет!'; }
  state.entities.push(newEnt);
});

// --- ТУЛБАР ---
const toolbar = document.getElementById('toolbar');
if (toolbar) {
  if (!document.getElementById('net-btn')) {
    const netBtn = document.createElement('button'); netBtn.id = 'net-btn'; netBtn.textContent = 'Network'; netBtn.style.background = '#1E90FF'; netBtn.onclick = () => {
      if (typeof io === 'undefined') return alert('Нет Socket.IO!');
      const modal = document.getElementById('modal-root');
      modal.innerHTML = '<div class="weapon-editor-modal" style="width:350px;height:auto;"><div class="weapon-header"><span>Сеть</span><button id="c-net" style="background:#900;color:#fff;border:none;padding:4px;">X</button></div>' +
        '<div style="padding:20px;"><input id="ip" type="text" value="http://127.0.0.1:3000" style="width:100%;padding:8px;background:#111;color:#fff;border:1px solid #444;margin-bottom:10px;">' +
        '<button id="conn" style="width:100%;padding:10px;background:#00FF88;color:#000;border:none;font-weight:bold;">Подключиться</button></div></div>';
      document.getElementById('c-net').onclick = () => modal.innerHTML = '';
      document.getElementById('conn').onclick = () => {
        state.network.connect(document.getElementById('ip').value); state.isMultiplayer = true; modal.innerHTML = '';
        const playIndex = state.scenes.findIndex(s => s.type === 'playground');
        if (playIndex !== -1) { loadScene(playIndex); setGameMode(true); }
      };
    }; toolbar.appendChild(netBtn);
  }
  if (!document.getElementById('export-btn')) {
    const expBtn = document.createElement('button'); expBtn.id = 'export-btn'; expBtn.textContent = 'Export HTML'; expBtn.style.background = '#FF8C00'; expBtn.onclick = exportProjectToHTML; toolbar.appendChild(expBtn);
  }
}

function setGameMode(isPlay) {
  if (isPlay) {
    state.mode = 'play'; editor.enabled = false; state.selectedButtonId = null; state.selectedEntityIndex = null;
    document.getElementById('left-panel').style.display = 'none'; document.getElementById('inspector').style.display = 'none'; document.getElementById('prefabs-bar').style.display = 'none';
  } else {
    state.mode = 'editor';
    document.getElementById('left-panel').style.display = 'flex'; document.getElementById('inspector').style.display = 'block'; document.getElementById('prefabs-bar').style.display = 'flex';
    const scene = state.scenes[state.activeSceneIndex]; editor.enabled = (scene.type === 'playground');
    if (scene.type === 'playground') buildTileInspector(); else buildSceneInspector();
  }
}

document.querySelector('[data-action="play"]').onclick = () => setGameMode(true);
document.querySelector('[data-action="editor"]').onclick = () => setGameMode(false);

// --- РЕДАКТОРЫ ---
function openWeaponEditor() {
  const modal = document.getElementById('modal-root');
  modal.innerHTML = '<div class="weapon-editor-modal"><div class="weapon-header"><span>Редактор Оружия</span><button id="close-w" style="background:#900;color:#fff;border:none;padding:4px;">X</button></div>' +
  '<div class="weapon-body"><div class="weapon-list" id="w-list"></div><div class="wpn-center" id="w-center"></div><div class="wpn-props" id="w-props"></div></div></div>';
  document.getElementById('close-w').onclick = () => { modal.innerHTML = ''; renderPrefabs('weapons'); };
  window.refreshWList();
}

window.refreshWList = function() {
  const list = document.getElementById('w-list'); list.innerHTML = '<div class="wpn-list-item" style="color:#0f0" onclick="window.addW()">+ Новое</div>';
  weapons.weapons.forEach((w, i) => {
    if (w.id === 'knife') return;
    const el = document.createElement('div'); el.className = 'wpn-list-item'; el.textContent = w.name;
    el.onclick = () => window.selW(i); list.appendChild(el);
  });
};

window.addW = function() {
  const id = 'wpn_'+Date.now(); weapons.weapons.push({ id: id, name: 'Custom', type: 'pistol', magazine: 10, reserveAmmo: 30, firingMode: 'single', pellets: 1, spread: 0, damage: 10, fireRate: 500, reloadTime: 1500, hasScope: false, scopeZoom: 1, bulletSpeed: 800, color: '#888', image: null });
  window.refreshWList(); window.selW(weapons.weapons.length - 1);
};

window.selW = function(index) {
  document.querySelectorAll('.wpn-list-item').forEach(el => el.classList.remove('active'));
  const w = weapons.weapons[index]; const c = document.getElementById('w-center'); const p = document.getElementById('w-props');
  c.innerHTML = '<div class="icon-box" style="width:100px;height:100px;background:' + w.color + ';font-size:40px;">' + w.name[0] + '</div>' +
  '<input type="text" value="' + w.name + '" style="background:#111;color:#fff;text-align:center;margin-top:10px;padding:5px;width:200px;" onchange="weapons.updateWeapon(\'' + w.id + '\', {name:this.value}); window.refreshWList();">';
  p.innerHTML = '<div class="wpn-prop-row"><label>Магазин:</label><input type="number" value="' + w.magazine + '" onchange="weapons.updateWeapon(\'' + w.id + '\', {magazine:+this.value})"></div>' +
  '<div class="wpn-prop-row"><label>Урон:</label><input type="number" value="' + w.damage + '" onchange="weapons.updateWeapon(\'' + w.id + '\', {damage:+this.value})"></div>' +
  '<div class="wpn-prop-row"><label>Режим:</label><select onchange="weapons.updateWeapon(\'' + w.id + '\', {firingMode:this.value})"><option value="single" ' + (w.firingMode==='single'?'selected':'') + '>Одиночный</option><option value="auto" ' + (w.firingMode==='auto'?'selected':'') + '>Авто</option></select></div>';
};

function openNpcEditor() {
  const modal = document.getElementById('modal-root');
  modal.innerHTML = '<div class="weapon-editor-modal" style="width:400px;height:auto;"><div class="weapon-header"><span>Новый NPC</span><button id="c-n" style="background:#900;color:#fff;border:none;padding:4px;">X</button></div>' +
  '<div style="padding:20px;display:flex;flex-direction:column;gap:10px;">' +
    '<label>Имя: <input id="n-name" type="text" style="background:#111;color:#fff;width:100%;padding:4px;"></label>' +
    '<label>Поведение: <select id="n-beh" style="background:#111;color:#fff;width:100%;padding:4px;"><option value="idle">Стоять</option><option value="follow">Следовать</option><option value="attack">Атаковать</option></select></label>' +
    '<label>Текст (E): <textarea id="n-text" style="background:#111;color:#fff;width:100%;height:60px;padding:4px;"></textarea></label>' +
    '<button id="s-n" style="background:#00FF88;color:#000;padding:10px;border:none;font-weight:bold;">Создать</button>' +
  '</div></div>';
  document.getElementById('c-n').onclick = () => modal.innerHTML = '';
  document.getElementById('s-n').onclick = () => {
    state.prefabs.npcs.push({ id: 'npc_'+Date.now(), name: document.getElementById('n-name').value||'NPC', shape:'circle', color:'#4CAF50', behavior: document.getElementById('n-beh').value, interaction: document.getElementById('n-text').value });
    modal.innerHTML = ''; renderPrefabs('npcs');
  };
}

function openTileEditor() {
  const modal = document.getElementById('modal-root');
  modal.innerHTML = '<div class="weapon-editor-modal" style="width:400px;height:auto;"><div class="weapon-header"><span>Новый Тайл</span><button id="c-t" style="background:#900;color:#fff;border:none;padding:4px;">X</button></div>' +
  '<div style="padding:20px;display:flex;flex-direction:column;gap:10px;">' +
    '<label>Имя: <input id="t-name" type="text" value="Custom Tile" style="background:#111;color:#fff;width:100%;padding:4px;"></label>' +
    '<label>Тип: <select id="t-solid" style="background:#111;color:#fff;width:100%;padding:4px;"><option value="false">Floor (Проходимый)</option><option value="true">Wall (Стена)</option></select></label>' +
    '<label>Цвет (если нет PNG): <input id="t-color" type="color" value="#888888" style="width:100%;height:30px;"></label>' +
    '<label>PNG Текстура: <input id="t-file" type="file" accept="image/png" style="background:#111;color:#fff;width:100%;padding:4px;"></label>' +
    '<button id="s-t" style="background:#00FF88;color:#000;padding:10px;border:none;font-weight:bold;">Создать</button>' +
  '</div></div>';
  
  let tempImg = null;
  document.getElementById('t-file').onchange = (e) => { if (e.target.files[0]) loadImage(e.target.files[0], (img) => tempImg = img); };
  document.getElementById('c-t').onclick = () => modal.innerHTML = '';
  
  document.getElementById('s-t').onclick = () => {
    const newId = 'tile_' + Date.now();
    state.tiles[newId] = {
      id: newId,
      name: document.getElementById('t-name').value || 'Tile',
      solid: document.getElementById('t-solid').value === 'true',
      color: document.getElementById('t-color').value,
      image: tempImg
    };
    modal.innerHTML = '';
    renderPrefabs('tiles');
    buildTileInspector();
  };
}

// --- ЭКСПОРТ В ИГРУ (ZIP) ---
async function exportProjectToHTML() {
  if (typeof JSZip === 'undefined') return alert('Ошибка: JSZip не подключен!');

  try {
    const filesToFetch = [
      'style.css',
      'js/config.js', 'js/map.js', 'js/player.js', 'js/weapons.js', 
      'js/network.js', 'js/i18n.js', 'js/main.js'
    ];
    
    const fileContents = {};
    for (const f of filesToFetch) {
      const res = await fetch(f);
      if (!res.ok) throw new Error(`Не удалось загрузить ${f}`);
      fileContents[f] = await res.text();
    }

    const gameIndexHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>GoldEngine Game</title>
  <link rel="stylesheet" href="style.css">
</head>
<body style="overflow: hidden;">
<header id="toolbar">
  <div class="logo">GoldEngine Game</div>
  <button id="btn-network" style="background:#1E90FF; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Network</button>
</header>
<div id="canvas-area" style="width:100vw; height:calc(100vh - 40px); position:relative; display:flex; justify-content:center; align-items:center; background:#111;">
  <div id="buy-menu-overlay">
    <div class="buy-header">
      <span>SELECT WEAPON MENU</span>
      <span>Buy Time Left: <span id="buy-timer">45</span></span>
    </div>
    <div class="buy-radial-menu" id="buy-radial"></div>
    <div class="buy-stats-panel" id="buy-stats">
      <h2>Select weapon</h2>
    </div>
  </div>
  <canvas id="canvas" width="960" height="600"></canvas>
</div>
<div id="modal-root"></div>

<script src="https://cdn.jsdelivr.net/npm/socket.io-client@4/dist/socket.io.min.js"></script>
<script>
  window.IS_EXPORTED = true;
  window.SAVED_MAP = ${JSON.stringify(state.map.toJSON())};
</script>
<script type="module" src="js/main.js"></script>
</body>
</html>`;

    let gameMainJs = fileContents['js/main.js'];
    
    gameMainJs = gameMainJs.replace(
      `document.querySelector('[data-action="play"]').onclick = () => setGameMode(true);
       document.querySelector('[data-action="editor"]').onclick = () => setGameMode(false);`,
      `const btnPlay = document.querySelector('[data-action="play"]');
       if (btnPlay) btnPlay.onclick = () => setGameMode(true);
       const btnEditor = document.querySelector('[data-action="editor"]');
       if (btnEditor) btnEditor.onclick = () => setGameMode(false);`
    );

    gameMainJs = gameMainJs.replace(/initScenes\(\);[\s\S]*?requestAnimationFrame\(loop\);/, `
// --- ЭКСПОРТИРОВАННЫЙ ЗАПУСК ---
if (window.IS_EXPORTED) {
  state.mode = 'play';
  state.scenes = [
    { id: 'scene_play', name: 'Game', type: 'playground', bgImage: null, mapData: window.SAVED_MAP, entities: [], buttons: [] }
  ];
  state.activeSceneIndex = 0;
  if (state.scenes[0].mapData) state.map = GameMap.fromJSON(state.scenes[0].mapData);
  state.map.setTilesData(state.tiles);
  editor.map = state.map;
  
  const netBtn = document.getElementById('btn-network');
  if (netBtn) {
    netBtn.onclick = () => {
      const modal = document.getElementById('modal-root');
      modal.innerHTML = '<div class="weapon-editor-modal" style="width:350px;height:auto;"><div class="weapon-header"><span>Сеть</span><button id="c-net" style="background:#900;color:#fff;border:none;padding:4px;">X</button></div>' +
        '<div style="padding:20px;"><input id="ip" type="text" value="http://127.0.0.1:3000" style="width:100%;padding:8px;background:#111;color:#fff;border:1px solid #444;margin-bottom:10px;">' +
        '<button id="conn" style="width:100%;padding:10px;background:#00FF88;color:#000;border:none;font-weight:bold;">Подключиться</button></div></div>';
      document.getElementById('c-net').onclick = () => modal.innerHTML = '';
      document.getElementById('conn').onclick = () => {
        state.network.connect(document.getElementById('ip').value); 
        state.isMultiplayer = true; 
        modal.innerHTML = '';
      };
    };
  }

  requestAnimationFrame(loop);
} else {
  initScenes();
  renderPrefabs('weapons');
  requestAnimationFrame(loop);
}
`);

    const zip = new JSZip();
    zip.file('index.html', gameIndexHtml);
    zip.file('style.css', fileContents['style.css']);
    
    const jsFolder = zip.folder('js');
    jsFolder.file('main.js', gameMainJs);
    jsFolder.file('config.js', fileContents['js/config.js']);
    jsFolder.file('map.js', fileContents['js/map.js']);
    jsFolder.file('player.js', fileContents['js/player.js']);
    jsFolder.file('weapons.js', fileContents['js/weapons.js']);
    jsFolder.file('network.js', fileContents['js/network.js']);
    jsFolder.file('i18n.js', fileContents['js/i18n.js']);

    zip.file('README.txt', 'GoldEngine Export\\n\\nИНСТРУКЦИЯ:\\n1. Распакуйте этот архив в любую папку.\\n2. Так как игра использует JS-модули, ее нельзя открыть двойным кликом.\\n3. Запустите игру через локальный сервер (например, Live Server в VS Code или команду "python -m http.server 8000").\\n4. Для мультиплеера запустите ваш server.js (node server.js) и нажмите кнопку Network в игре.');

    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'GoldEngine_Game.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);

  } catch (err) {
    console.error(err);
    alert('Ошибка экспорта: ' + err.message + '\\nУбедитесь, что запускаете редактор через локальный сервер (http://), а не через file://');
  }
}

// --- ЗАПУСК ---
window.weapons = weapons;
initScenes();
renderPrefabs('weapons');
requestAnimationFrame(loop);