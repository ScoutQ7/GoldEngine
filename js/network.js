export class NetworkClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.players = {}; 
    this.selfId = null;
    this.handlers = { hit: [], kill: [], respawn: [], state: [] };
  }
  connect(url) {
    if (this.socket) this.socket.disconnect();
    this.socket = io(url, { transports: ['websocket'] });

    this.socket.on('connect', () => {
      this.connected = true;
      this.selfId = this.socket.id;
    });
    this.socket.on('disconnect', () => { this.connected = false; });

    this.socket.on('state', (s) => {
      this.players = s.players || {};
      this.handlers.state.forEach(fn => fn(this.players));
    });
    this.socket.on('hit', (data) => this.handlers.hit.forEach(fn => fn(data)));
    this.socket.on('kill', (data) => this.handlers.kill.forEach(fn => fn(data)));
    this.socket.on('respawn', (data) => this.handlers.respawn.forEach(fn => fn(data)));
  }

  on(event, cb) { this.handlers[event]?.push(cb); }

  sendInput(input, player) {
    if (!this.connected) return;
    this.socket.emit('input', {
      x: player.x, // <-- ДОБАВЛЕНО
      y: player.y, // <-- ДОБАВЛЕНО
      angle: player.angle
    });
  }
  sendShoot(weaponId)       { this.connected && this.socket.emit('shoot', { weaponId }); }
  sendReload()              { this.connected && this.socket.emit('reload'); }
  sendScope(on)             { this.connected && this.socket.emit('scope', { on }); }
  sendSwitchWeapon(weaponId){ this.connected && this.socket.emit('switchWeapon', { weaponId }); }
}