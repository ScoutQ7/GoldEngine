export const TILE_SIZE = 32;
export const DEFAULT_MAP_W = 30;
export const DEFAULT_MAP_H = 20;

export const TILES = {
  0: { id: 0, name: 'void',          solid: true,  color: '#0f0f0f' },
  1: { id: 1, name: 'floorWood',     solid: false, color: '#8B5A2B' },
  2: { id: 2, name: 'floorStone',    solid: false, color: '#6B6B6B' },
  3: { id: 3, name: 'floorConcrete', solid: false, color: '#A8A8A8' },
  4: { id: 4, name: 'wallStone',     solid: true,  color: '#4A4A4A' },
  5: { id: 5, name: 'wallWood',      solid: true,  color: '#5C3A1A' },
  6: { id: 6, name: 'wallConcrete',  solid: true,  color: '#808080' },
  7: { id: 7, name: 'wallBrick',     solid: true,  color: '#9B4D2A' },
};

export const DEFAULT_WEAPONS = [
  { id:'pistol',  name:'Pistol',  type:'pistol',  magazine:12, reserveAmmo:36, firingMode:'single', pellets:1, spread:0,  damage:20, fireRate:300,  reloadTime:1200, hasScope:false, scopeZoom:1,   bulletSpeed:800,  color:'#FFD700' },
  { id:'shotgun', name:'Shotgun', type:'shotgun', magazine:8,  reserveAmmo:24, firingMode:'spread', pellets:8, spread:15, damage:10, fireRate:800,  reloadTime:2000, hasScope:false, scopeZoom:1,   bulletSpeed:700,  color:'#FF8C00' },
  { id:'rifle',   name:'Rifle',   type:'rifle',   magazine:30, reserveAmmo:90, firingMode:'auto',   pellets:1, spread:3,  damage:18, fireRate:100,  reloadTime:1800, hasScope:false, scopeZoom:1,   bulletSpeed:1000, color:'#1E90FF' },
  { id:'sniper',  name:'Sniper',  type:'sniper',  magazine:5,  reserveAmmo:15, firingMode:'single', pellets:1, spread:0,  damage:80, fireRate:1200, reloadTime:2500, hasScope:true,  scopeZoom:2.5, bulletSpeed:1500, color:'#DC143C' },
];

export const DEFAULT_NPCS = [
  { id:'npc_guard', name:'Guard', color:'#4CAF50', speed: 2, behavior:'idle', weapon:'pistol', interaction: 'Привет! Ты не должен быть здесь.' },
  { id:'npc_merchant', name:'Merchant', color:'#2196F3', speed: 0, behavior:'idle', weapon:'none', interaction: 'Покупай оружие!' }
];