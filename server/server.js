const { Server } = require('socket.io');
const http = require('http');

const PORT = 3000;
const RESPAWN_DELAY = 3000;

// Копия оружия для валидации — синхронизируйте с config.js при изменении
const WEAPONS = {
  pistol:  { mag:12, reserve:36, firingMode:'single', pellets:1, spread:0,  damage:20, fireRate:300,  bulletSpeed:800,  reloadTime:1200 },
  shotgun: { mag:8,  reserve:24, firingMode:'spread', pellets:8, spread:15, damage:10, fireRate:800,  bulletSpeed:700,  reloadTime:2000 },
  rifle:   { mag:30, reserve:90, firingMode:'auto',   pellets:1, spread:3,  damage:18, fireRate:100,  bulletSpeed:1000, reloadTime:1800 },
  sniper:  { mag:5,  reserve:15, firingMode:'single', pellets:1, spread:0,  damage:80, fireRate:1200, bulletSpeed:1500, reloadTime:2500 },
};

function freshAmmo() {
  const a = {};
  for (const id in WEAPONS) a[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  return a;
}

const players = {}; // id -> { x, y, angle, health, alive, weapon, ammo, lastFire, isReloading, reloadEndsAt, respawnAt, isScoped }
const bullets = []; // { x, y, vx, vy, damage, ownerId, life }

const server = http.createServer();
const io = new Server(server, { cors: { origin: '*' } });

const MAP_W_PX = 30 * 32, MAP_H_PX = 20 * 32;

io.on('connection', (socket) => {
  players[socket.id] = {
    x: 96 + Math.random() * 200,
    y: 96 + Math.random() * 200,
    angle: 0, health: 100, alive: true,
    weapon: 'pistol', ammo: freshAmmo(),
    lastFire: 0, isReloading: false, reloadEndsAt: 0,
    respawnAt: 0, isScoped: false,
  };

  socket.on('input', (d) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;
    p.x = clamp(d.x ?? p.x, 0, MAP_W_PX);
    p.y = clamp(d.y ?? p.y, 0, MAP_H_PX);
    p.angle = d.angle ?? p.angle;
  });

  socket.on('switchWeapon', ({ weaponId }) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;
    if (!WEAPONS[weaponId]) return;
    if (p.isReloading) return;
    p.weapon = weaponId;
    p.isScoped = false;
  });

  socket.on('shoot', ({ weaponId }) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;
    const w = WEAPONS[weaponId];
    if (!w) return;
    if (p.isReloading) return;
    if (p.ammo[weaponId].mag <= 0) return;

    const now = Date.now();
    if (now - p.lastFire < w.fireRate) return; // анти-спам
    p.lastFire = now;
    p.ammo[weaponId].mag--;

    const pellets = w.firingMode === 'spread' ? w.pellets : 1;
    const spreadRad = (w.spread * Math.PI) / 180;
    for (let i = 0; i < pellets; i++) {
      const a = p.angle + (Math.random() - 0.5) * spreadRad;
      bullets.push({
        x: p.x, y: p.y,
        vx: Math.cos(a) * w.bulletSpeed / 60,
        vy: Math.sin(a) * w.bulletSpeed / 60,
        damage: w.damage,
        ownerId: socket.id,
        life: 90,
      });
    }
  });

  socket.on('reload', () => {
    const p = players[socket.id];
    if (!p || !p.alive || p.isReloading) return;
    const w = WEAPONS[p.weapon];
    const ammo = p.ammo[p.weapon];
    if (ammo.mag >= w.mag || ammo.reserve <= 0) return;
    p.isReloading = true;
    p.reloadEndsAt = Date.now() + w.reloadTime;
  });

  socket.on('scope', ({ on }) => {
    const p = players[socket.id];
    if (!p) return;
    p.isScoped = !!on;
  });

  socket.on('disconnect', () => { delete players[socket.id]; });
});

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// 30 Гц серверный тик
function tick() {
  const now = Date.now();

  // Перезарядка завершилась
  for (const id in players) {
    const p = players[id];
    if (p.isReloading && now >= p.reloadEndsAt) {
      const w = WEAPONS[p.weapon];
      const ammo = p.ammo[p.weapon];
      const give = Math.min(w.mag - ammo.mag, ammo.reserve);
      ammo.mag += give;
      ammo.reserve -= give;
      p.isReloading = false;
    }
    // Респавн
    if (!p.alive && now >= p.respawnAt) {
      p.alive = true; p.health = 100;
      p.x = 96 + Math.random() * 200;
p.y = 96 + Math.random() * 200;
      p.ammo = freshAmmo();
      p.weapon = 'pistol';
      p.isReloading = false;
      io.to(id).emit('respawn', { id, x: p.x, y: p.y });
    }
  }

  // Пули
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx; b.y += b.vy; b.life--;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > MAP_W_PX || b.y > MAP_H_PX;

    if (!dead) {
      for (const id in players) {
        if (id === b.ownerId) continue;
        const p = players[id];
        if (!p.alive) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < 15) {
          p.health -= b.damage;
          io.emit('hit', {
            victimId: id, shooterId: b.ownerId,
            damage: b.damage, x: p.x, y: p.y,
          });
          if (p.health <= 0) {
            p.health = 0;
            p.alive = false;
            p.respawnAt = now + RESPAWN_DELAY;
            p.isReloading = false;
            io.emit('kill', { victimId: id, shooterId: b.ownerId });
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }

  // Состояние
  const snapshot = {};
  for (const id in players) {
    const p = players[id];
    snapshot[id] = {
      x: p.x, y: p.y, angle: p.angle,
      health: p.health, alive: p.alive,
      weapon: p.weapon,
    };
  }
  io.emit('state', { players: snapshot });
}

setInterval(tick, 1000 / 30);
server.listen(PORT, () => console.log(`GoldEngine v0.2 server on :${PORT}`));