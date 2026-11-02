export const translations = {
  ru: {
    play:'Играть', editor:'Редактор карт', weapons:'Оружие', network:'Сеть',
    export:'Экспорт', close:'Закрыть', tiles:'Тайлы',
    floorWood:'Пол: дерево', floorStone:'Пол: камень', floorConcrete:'Пол: бетон',
    wallStone:'Стена: камень', wallWood:'Стена: дерево',
    wallConcrete:'Стена: бетон', wallBrick:'Стена: кирпич',
    pistol:'Пистолет', shotgun:'Дробовик', rifle:'Автомат', sniper:'Снайперка',
    single:'Патрон', spread:'Дробь',
    magazine:'Магазин', damage:'Урон', fireRate:'Скорость',
    firingMode:'Режим стрельбы', scope:'Прицел',
    join:'Подключиться', serverUrl:'Адрес сервера',
    connected:'Подключено', disconnected:'Отключено',
  },
  en: {
    play:'Play', editor:'Map Editor', weapons:'Weapons', network:'Network',
    export:'Export', close:'Close', tiles:'Tiles',
    floorWood:'Floor: wood', floorStone:'Floor: stone', floorConcrete:'Floor: concrete',
    wallStone:'Wall: stone', wallWood:'Wall: wood',
    wallConcrete:'Wall: concrete', wallBrick:'Wall: brick',
    pistol:'Pistol', shotgun:'Shotgun', rifle:'Rifle', sniper:'Sniper',
    single:'Single', spread:'Spread',
    magazine:'Magazine', damage:'Damage', fireRate:'Fire rate',
    firingMode:'Firing mode', scope:'Scope',
    join:'Join', serverUrl:'Server URL',
    connected:'Connected', disconnected:'Disconnected',
  }
};

let current = 'ru';
export const setLang = (l) => { current = l; };
export const t = (k) => translations[current][k] || k;