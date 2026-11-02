import { TILE_SIZE } from './config.js';

export async function exportToHTML(map, weapons) {
  const mapJson = JSON.stringify(map.toJSON());
  const weaponsJson = JSON.stringify(weapons.weapons);

  // Встраиваем мини-игру в экспорт
  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>GoldEngine Game</title>
<style>body{margin:0;background:#111;overflow:hidden;color:#fff;font:14px monospace}
canvas{display:block;margin:0 auto;background:#000}</style></head>
<body>
<canvas id="c" width="960" height="600"></canvas>
<script>
const MAP=${mapJson};
const WEAPONS=${weaponsJson};
const TILE=${TILE_SIZE};
const SOLID={0:1,4:1,5:1,6:1,7:1};
const COLORS={0:'#0f0f0f',1:'#8B5A2B',2:'#6B6B6B',3:'#A8A8A8',
              4:'#4A4A4A',5:'#5C3A1A',6:'#808080',7:'#9B4D2A'};
const c=document.getElementById('c'), ctx=c.getContext('2d');
const player={x:96,y:96,r:12,angle:0,hp:100,weapon:'pistol'};
const input={up:0,down:0,left:0,right:0,mx:0,my:0,md:0};
let bullets=[], lastFire=0;

addEventListener('keydown',e=>{if(['w','ArrowUp'].includes(e.key))input.up=1;
  if(['s','ArrowDown'].includes(e.key))input.down=1;
  if(['a','ArrowLeft'].includes(e.key))input.left=1;
  if(['d','ArrowRight'].includes(e.key))input.right=1;});
addEventListener('keyup',e=>{if(['w','ArrowUp'].includes(e.key))input.up=0;
  if(['s','ArrowDown'].includes(e.key))input.down=0;
  if(['a','ArrowLeft'].includes(e.key))input.left=0;
  if(['d','ArrowRight'].includes(e.key))input.right=0;});
c.addEventListener('mousemove',e=>{const r=c.getBoundingClientRect();
  input.mx=e.clientX-r.left;input.my=e.clientY-r.top;});
c.addEventListener('mousedown',()=>input.md=1);
c.addEventListener('mouseup',()=>input.md=0);

function solid(px,py){const x=Math.floor(px/TILE),y=Math.floor(py/TILE);
  if(x<0||y<0||x>=MAP.w||y>=MAP.h)return true;
  return !!SOLID[MAP.tiles[y*MAP.w+x]];}

function tick(now){
  let dx=0,dy=0;
  if(input.up)dy--;if(input.down)dy++;if(input.left)dx--;if(input.right)dx++;
  if(dx||dy){const l=Math.hypot(dx,dy);dx=dx/l*3;dy=dy/l*3;}
  if(!solid(player.x+dx+12,player.y)&&!solid(player.x+dx-12,player.y))player.x+=dx;
  if(!solid(player.x,player.y+dy+12)&&!solid(player.x,player.y+dy-12))player.y+=dy;
  player.angle=Math.atan2(input.my-player.y,input.mx-player.x);

  const w=WEAPONS.find(w=>w.id===player.weapon);
  if(input.md && now-lastFire>w.fireRate){
    for(let i=0;i<(w.firingMode==='spread'?w.pellets:1);i++){
      const a=player.angle+(Math.random()-0.5)*w.spread*Math.PI/180;
      bullets.push({x:player.x,y:player.y,vx:Math.cos(a)*w.bulletSpeed/60,
                    vy:Math.sin(a)*w.bulletSpeed/60,life:90,c:w.color});
    }
    lastFire=now;
  }
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.x+=b.vx;b.y+=b.vy;b.life--;
    if(b.life<=0||solid(b.x,b.y))bullets.splice(i,1);
  }

  ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height);
  for(let y=0;y<MAP.h;y++)for(let x=0;x<MAP.w;x++){
    ctx.fillStyle=COLORS[MAP.tiles[y*MAP.w+x]];
    ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
  }
  for(const b of bullets){ctx.fillStyle=b.c;ctx.beginPath();
    ctx.arc(b.x,b.y,3,0,7);ctx.fill();}
  ctx.fillStyle='#00FF88';ctx.beginPath();
  ctx.arc(player.x,player.y,player.r,0,7);ctx.fill();
  ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();
  ctx.moveTo(player.x,player.y);
  ctx.lineTo(player.x+Math.cos(player.angle)*22,player.y+Math.sin(player.angle)*22);
  ctx.stroke();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
</script></body></html>`;

  const zip = new JSZip();
  zip.file('index.html', html);
  zip.file('map.json', mapJson);
  zip.file('weapons.json', weaponsJson);
  zip.file('README.txt', 'GoldEngine export v0.1 — откройте index.html в браузере.');

  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'goldengine-game.zip';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}