export class GameMap {
  constructor(w = 30, h = 20) {
    this.w = w; this.h = h;
    this.tilesData = null;               // <-- новое
    this.tiles = {};
    for (let x = 0; x < w; x++) { this.set(x, 0, 'wall1'); this.set(x, h-1, 'wall1'); }
    for (let y = 0; y < h; y++) { this.set(0, y, 'wall1'); this.set(w-1, y, 'wall1'); }
    for (let x = 1; x < w-1; x++) { for (let y = 1; y < h-1; y++) this.set(x, y, 'floor1'); }
  }

  setTilesData(data) { this.tilesData = data; }   // <-- новое

  getKey(x, y) { return Math.floor(x) + ',' + Math.floor(y); }
  set(x, y, id) { this.tiles[this.getKey(x, y)] = id; }

  isSolidPx(px, py, tilesData) {
    const td = tilesData || this.tilesData;
    if (!td) return true;                          // safe fallback
    const x = Math.floor(px / 32), y = Math.floor(py / 32);
    const id = this.tiles[this.getKey(x, y)] || 'void';
    return td[id] ? td[id].solid : true;
  }

  render(ctx, camX = 0, camY = 0, viewW, viewH, tilesData) {
    viewW = viewW || ctx.canvas.width; viewH = viewH || ctx.canvas.height;
    const td = tilesData || this.tilesData;
    const sx = Math.floor(camX / 32), sy = Math.floor(camY / 32);
    const ex = Math.ceil((camX + viewW) / 32), ey = Math.ceil((camY + viewH) / 32);

    for (let y = sy; y <= ey; y++) {
      for (let x = sx; x <= ex; x++) {
        const id = this.tiles[this.getKey(x, y)] || 'void';
        const tile = (td && td[id]) || { color: '#000', solid: true };
        const px = x * 32 - camX; const py = y * 32 - camY;

        if (tile.image) ctx.drawImage(tile.image, px, py, 32, 32);
        else { ctx.fillStyle = tile.color || '#000'; ctx.fillRect(px, py, 32, 32); }
      }
    }
  }

  toJSON() { return { tiles: this.tiles }; }

  static fromJSON(data) {
    const m = new GameMap();
    m.tiles = data.tiles || {};
    return m;
  }
}