export class Player {
  constructor(x, y, weapons) {
    this.id = 'local';
    this.x = x; this.y = y;
    this.radius = 12;
    this.baseSpeed = 3;
    this.angle = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.dead = false;
    
    // Инвентарь: 0 и 1 - оружие, 2 - всегда нож
    this.inventory = [null, null, 'knife']; 
    this.activeSlot = 2; // Начинаем с ножа

    this.lastFireTime = 0;
    this.isScoped = false;
    this.isReloading = false;
    this.reloadEndTime = 0;

    // Инициализируем патроны для ВСЕХ существующих пушек
    this.ammo = {};
    for (const w of weapons.weapons) {
      this.ammo[w.id] = { mag: w.magazine, reserve: w.reserveAmmo };
    }

    this.lastMouseDown = false;
    this.lastReloadInput = false;
    this.lastWeaponInput = { weapon1: false, weapon2: false, weapon3: false };
  }

  get currentWeapon() { return this.inventory[this.activeSlot] || 'knife'; }
  get currentAmmo() { return this.ammo[this.currentWeapon]; }

  getSpeed() {
    let s = this.baseSpeed;
    if (this.isScoped) s *= 0.4; // Замедление в прицеле
    if (this.isReloading) s *= 0.7; // Замедление при перезарядке
    return s;
  }

  startReload(weapons, now) {
    const w = weapons.get(this.currentWeapon);
    const ammo = this.currentAmmo;
    if (this.isReloading || this.dead || w.id === 'knife') return false;
    if (ammo.mag >= w.magazine || ammo.reserve <= 0) return false;
    this.isReloading = true;
    this.reloadEndTime = now + w.reloadTime;
    return true;
  }

  updateReload(weapons, now) {
    if (this.isReloading && now >= this.reloadEndTime) {
      const w = weapons.get(this.currentWeapon);
      const ammo = this.currentAmmo;
      const need = w.magazine - ammo.mag;
      const give = Math.min(need, ammo.reserve);
      ammo.mag += give;
      ammo.reserve -= give;
      this.isReloading = false;
    }
  }

  // Логика подбора оружия
  addWeapon(weaponId, weapons) {
    if (this.inventory.includes(weaponId)) {
      // Если оружие уже есть, просто переключаемся на него
      this.activeSlot = this.inventory.indexOf(weaponId);
      return;
    }
    
    // Ищем пустой слот (0 или 1)
    let slot = this.inventory.indexOf(null);
    if (slot === -1) {
      // Если оба слота заняты, заменяем текущий (если это не нож)
      if (this.activeSlot !== 2) slot = this.activeSlot;
      else slot = 0; // Если в руках нож, принудительно заменяем 1-й слот
    }
    
    // Сбрасываем патроны для нового оружия, если их не было
    const w = weapons.get(weaponId);
    if (w && !this.ammo[weaponId]) {
      this.ammo[weaponId] = { mag: w.magazine, reserve: w.reserveAmmo };
    }

    this.inventory[slot] = weaponId;
    this.activeSlot = slot;
    this.isReloading = false;
  }

  switchSlot(slot) {
    if (this.isReloading || slot === this.activeSlot) return;
    if (this.inventory[slot]) {
      this.activeSlot = slot;
      this.isScoped = false;
    }
  }

  update(input, map, weapons, now) {
    this.updateReload(weapons, now);
    if (this.dead) return;

    // Движение
    let dx = 0, dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      const s = this.getSpeed();
      dx = dx / len * s;
      dy = dy / len * s;
    }
    if (!this.collides(this.x + dx, this.y, map)) this.x += dx;
    if (!this.collides(this.x, this.y + dy, map)) this.y += dy;

    // Угол
    this.angle = Math.atan2(input.mouseY - this.y, input.mouseX - this.x);

    // Смена оружия (Клавиши 1, 2, 3)
    if (input.weapon1 && !this.lastWeaponInput.weapon1) this.switchSlot(0);
    if (input.weapon2 && !this.lastWeaponInput.weapon2) this.switchSlot(1);
    if (input.weapon3 && !this.lastWeaponInput.weapon3) this.switchSlot(2);
    this.lastWeaponInput.weapon1 = !!input.weapon1;
    this.lastWeaponInput.weapon2 = !!input.weapon2;
    this.lastWeaponInput.weapon3 = !!input.weapon3;

    // Перезарядка (R)
    if (input.reload && !this.lastReloadInput) this.startReload(weapons, now);
    this.lastReloadInput = !!input.reload;

    // Прицел (ПКМ)
    const w = weapons.get(this.currentWeapon);
    this.isScoped = !!(w.hasScope && input.mouseRight && !this.isReloading);

    // Стрельба (ЛКМ)
    const canFire = !this.isReloading && w.id !== 'knife' && this.currentAmmo.mag > 0;
    const wantsFire = w.firingMode === 'auto'
      ? input.mouseDown
      : (input.mouseDown && !this.lastMouseDown);

    if (wantsFire && canFire && now - this.lastFireTime >= w.fireRate) {
      if (weapons.fire(this.currentWeapon, this.x, this.y, this.angle, this.id)) {
        this.currentAmmo.mag--;
        this.lastFireTime = now;
        this._justFired = true;
      }
    }
    this.lastMouseDown = !!input.mouseDown;
  }

  collides(x, y, map) {
    const r = this.radius;
    return [
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
    ].some(([px, py]) => map.isSolidPx(px, py));
  }
}