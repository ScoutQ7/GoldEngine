import { TILE_SIZE } from './config.js';

export class MapEditor {
  constructor(map, canvas, getCam, getTiles) {
    this.map = map;
    this.canvas = canvas;
    this.getCam = getCam;
    this.getTiles = getTiles;
    this.currentTile = 'wall1';
    this.enabled = false;
    this.isPanning = false;
    this.lastMouse = { x: 0, y: 0 };

    canvas.addEventListener('mousedown', e => {
      if (!this.enabled) return;
      if (e.button === 2) { 
        this.isPanning = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
      } else if (e.button === 0) { 
        this.paint(e);
      }
    });

    window.addEventListener('mousemove', e => {
      if (!this.enabled) return;
      if (this.isPanning) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        if (this.onPan) this.onPan(dx, dy);
        this.lastMouse = { x: e.clientX, y: e.clientY };
      } else if (e.buttons === 1) { 
        this.paint(e);
      }
    });

    window.addEventListener('mouseup', e => {
      if (e.button === 2) {
        this.isPanning = false;
        if (this.enabled) canvas.style.cursor = 'crosshair';
      }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  paint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const cam = this.getCam();
    const x = Math.floor((e.clientX - rect.left + cam.x) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top + cam.y) / TILE_SIZE);
    if (this.currentTile) this.map.set(x, y, this.currentTile);
  }
}