import { DEFAULT_WEAPONS } from './config.js';

export class WeaponSystem {
  constructor() {
    this.weapons = JSON.parse(JSON.stringify(DEFAULT_WEAPONS));
    this.bullets = [];
    this.effects = []; // { x, y, type, life, color }
  }
  get(id) { return this.weapons.find(w => w.id === id); }

  updateWeapon(id, patch) {
    const i = this.weapons.findIndex(w => w.id === id);
    if (i >= 0) this.weapons[i] = { ...this.weapons[i], ...patch };
  }

  addWeapon(w) { this.weapons.push(w); }

  fire(weaponId, fromX, fromY, angle, ownerId) {
    const w = this.get(weaponId);
    if (!w) return false;
    const pellets = w.firingMode === 'spread' ? w.pellets : 1;
    const spreadRad = (w.spread * Math.PI) / 180;
    for (let i = 0; i < pellets; i++) {
      const a = angle + (Math.random() - 0.5) * spreadRad;
      this.bullets.push({
        x: fromX, y: fromY,
        vx: Math.cos(a) * w.bulletSpeed / 60,
        vy: Math.sin(a) * w.bulletSpeed / 60,
        damage: w.damage,
        color: w.color,
        life: 90,
        ownerId,
      });
    }
    this.effects.push({ x: fromX, y: fromY, type: 'muzzle', life: 6, color: w.color });
    return true;
  }

  /**
   * @param {GameMap} map
   * @param {() => Array<{id,x,y,radius,dead}>} getTargets
   * @param {(target, bullet) => void} onHit  — вызывается на клиенте/сервере при попадании
   */
  updateBullets(map, getTargets, onHit) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;

      let removed = false;

      if (getTargets) {
        for (const t of getTargets()) {
          if (t.id === b.ownerId || t.dead) continue;
          const dist = Math.hypot(t.x - b.x, t.y - b.y);
          if (dist < (t.radius || 12) + 3) {
            this.effects.push({ x: b.x, y: b.y, type: 'hit', life: 15, color: '#FF2222' });
            onHit && onHit(t, b);
            this.bullets.splice(i, 1);
            removed = true;
            break;
          }
        }
      }
      if (removed) continue;

      if (b.life <= 0 || map.isSolidPx(b.x, b.y)) {
        if (map.isSolidPx(b.x, b.y)) {
          this.effects.push({ x: b.x, y: b.y, type: 'wall', life: 8, color: '#FFCC00' });
        }
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].life--;
      if (this.effects[i].life <= 0) this.effects.splice(i, 1);
    }
  }

  renderBullets(ctx, camX, camY) {
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x - camX, b.y - camY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderEffects(ctx, camX, camY) {
    for (const e of this.effects) {
      const alpha = Math.min(1, e.life / 12);
      ctx.globalAlpha = alpha;
      if (e.type === 'muzzle') {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x - camX, e.y - camY, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'hit') {
        ctx.fillStyle = '#FF2222';
        ctx.beginPath();
        ctx.arc(e.x - camX, e.y - camY, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'wall') {
        ctx.fillStyle = '#FFCC00';
        ctx.fillRect(e.x - camX - 2, e.y - camY - 2, 4, 4);
      }
    }
    ctx.globalAlpha = 1;
  }
}