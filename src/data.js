// ============================================================
//  ВЕСЬ КОНТЕНТ САЙТА ЖИВЁТ ЗДЕСЬ.
//  Этот файл можно править без знания кода. Правила:
//   - текст всегда в кавычках: 'вот так'
//   - после каждой строки-параметра стоит запятая
//   - цвета пишутся как в Figma: '#ff8800'
//   - клетка комнаты — это пара чисел [столбец, ряд].
//     [0, 0] — дальний угол комнаты (где сходятся две стены).
//     Столбцы растут вправо вдоль задней стены, ряды — к зрителю.
//   - направления: 'north' (к задней стене), 'south' (к зрителю),
//     'west' (к левой стене), 'east' (вправо от неё).
//  Сохранили файл — страница в браузере обновится сама.
// ============================================================

// ---------- Комната ----------
export const room = {
  columns: 6, // ширина в клетках
  rows: 6, // глубина в клетках
  wallHeight: 2.6, // высота стен (1 = одна клетка)
  colors: {
    floor: '#a9743f', // доски пола
    wallpaper: '#c9b99a', // обои
    wood: '#6e4526', // дерево мебели
    wallTop: '#efe6d2', // срез стен сверху
    chairSeat: '#7a3b3b', // сиденье стула
  },
};

// ---------- Эффект «как на PS1» ----------
export const ps1 = {
  enabledAtStart: true, // включён ли эффект при открытии сайта
  renderHeight: 320, // высота картинки в пикселях (меньше = крупнее пиксели)
  vertexSnap: 160, // дрожание вершин: сколько «ступенек» на высоту экрана (меньше = сильнее дрожит)
  colorLevels: 24, // сколько оттенков на канал (меньше = грубее палитра)
  dither: 1.0, // сила «зерна» на переходах цвета (0 = выключить)
  fogColor: '#2a2438', // цвет тумана и фона вокруг комнаты
  fogStrength: 0.02, // плотность тумана (0 = нет тумана)
  cameraSway: true, // едва заметное покачивание камеры, чтобы дрожание было видно
};

// ---------- Названия анимаций в файлах моделей ----------
// Модели — Kenney Mini Characters (лицензия CC0), лежат в public/models/people.
// В каждом файле 32 анимации, среди них: idle, walk, sprint, jump, sit, crouch,
// pick-up, emote-yes, emote-no, interact-right, interact-left.
// «Помахать» и «встать» в наборе нет — они сделаны в коде:
// 'wave' поднимает правую руку, 'stand' — плавный переход из sit в idle.
export const animations = {
  idle: 'idle',
  walk: 'walk',
  sit: 'sit',
};

// ---------- Персонажи ----------
// model — какая модель из public/models/people. Есть 12 вариантов:
//   character-female-a … character-female-f
//   character-male-a … character-male-f
// color — фирменный цвет персонажа (кольцо выбора, рамка портрета).
export const characters = [
  {
    id: 'p1',
    name: 'Персонаж 1',
    model: 'character-female-a',
    color: '#e8833a',
    startCell: [2, 3], // где стоит при открытии сайта (номера клеток видны по клавише G)
    startFacing: 'south',
    traits: [
      { icon: '🎨', label: 'Дизайнер' },
      { icon: '☕', label: 'Кофеман' },
      { icon: '🌙', label: 'Сова' },
      { icon: '🎮', label: 'Геймер' },
    ],
    about:
      'Здесь будет короткий рассказ о первом человеке: чем занимается, что любит, как с ним работать.',
    works: [
      { title: 'Работа 1', description: 'Короткое описание', image: '', url: '' },
      { title: 'Работа 2', description: 'Короткое описание', image: '', url: '' },
      { title: 'Работа 3', description: 'Короткое описание', image: '', url: '' },
      { title: 'Работа 4', description: 'Короткое описание', image: '', url: '' },
      { title: 'Работа 5', description: 'Короткое описание', image: '', url: '' },
      { title: 'Работа 6', description: 'Короткое описание', image: '', url: '' },
    ],
    links: [
      { label: 'Telegram', url: 'https://example.com' },
      { label: 'Behance', url: 'https://example.com' },
      { label: 'Почта', url: 'mailto:hello@example.com' },
    ],
  },
  {
    id: 'p2',
    name: 'Персонаж 2',
    model: 'character-male-a',
    color: '#4aa3c7',
    startCell: [4, 2],
    startFacing: 'south',
    traits: [
      { icon: '💻', label: 'Разработчик' },
      { icon: '🎧', label: 'Меломан' },
      { icon: '🌱', label: 'Садовод' },
    ],
    about:
      'Здесь будет короткий рассказ о втором человеке: чем занимается, что любит, как с ним работать.',
    works: [
      { title: 'Работа 1', description: 'Короткое описание', image: '', url: '' },
      { title: 'Работа 2', description: 'Короткое описание', image: '', url: '' },
      { title: 'Работа 3', description: 'Короткое описание', image: '', url: '' },
      { title: 'Работа 4', description: 'Короткое описание', image: '', url: '' },
    ],
    links: [
      { label: 'GitHub', url: 'https://example.com' },
      { label: 'Telegram', url: 'https://example.com' },
    ],
  },
];

// ---------- Действия при клике по персонажу ----------
// who: 'target' — действие выполняет тот, по кому кликнули.
export const characterActions = [
  { id: 'wave', label: 'Помахать', icon: '👋', who: 'target', animation: 'wave' },
  { id: 'about', label: 'О себе', icon: '💬', who: 'target', panel: 'about' },
];

// ---------- Виды панелей ----------
// 'works' — сетка работ персонажа, 'links' — список его ссылок,
// 'about' — текст «о себе».
export const panels = {
  works: { title: 'Работы' },
  links: { title: 'Ссылки' },
  about: { title: 'О себе' },
};

// ---------- Мебель и предметы ----------
// type     — что это за предмет (как он выглядит, решает код)
// cells    — какие клетки занимает
// blocks   — true: сквозь предмет нельзя пройти; false: можно (ковёр, стул)
// facing   — куда предмет «смотрит» лицом
// actions  — если есть, предмет становится кликабельным. У каждого действия:
//     label        — надпись на кнопке меню
//     goTo         — клетка, куда персонаж подойдёт
//     face         — куда повернётся, когда дойдёт
//     animation    — какую анимацию сыграет (ключ из списка animations выше)
//     endAnimation — какую сыграет, когда действие закончится
//     panel        — какую панель открыть ('works', 'links', 'about')
//     panelDelay   — через сколько секунд после начала анимации её открыть
//     occupies     — true: место занято, пока действие идёт (второй не сядет)
export const furniture = [
  {
    id: 'desk',
    type: 'desk',
    cells: [[1, 0], [2, 0]],
    blocks: true,
    facing: 'south',
  },
  {
    id: 'computer',
    type: 'computer',
    name: 'Компьютер',
    cells: [[2, 0]], // стоит на столе
    onTopOf: 'desk',
    blocks: false,
    facing: 'south',
    actions: [
      {
        id: 'show-works',
        label: 'Показать работы',
        icon: '🖼️',
        goTo: [2, 1],
        face: 'north',
        animation: 'sit',
        endAnimation: 'stand',
        panel: 'works',
        panelDelay: 1,
        occupies: true,
      },
      {
        id: 'show-links',
        label: 'Ссылки',
        icon: '🔗',
        goTo: [2, 1],
        face: 'north',
        animation: 'sit',
        endAnimation: 'stand',
        panel: 'links',
        panelDelay: 1,
        occupies: true,
      },
    ],
  },
  {
    id: 'chair',
    type: 'chair',
    cells: [[2, 1]],
    blocks: false, // на эту клетку персонаж встаёт, чтобы сесть
    facing: 'north',
  },
  {
    id: 'bookshelf',
    type: 'bookshelf',
    cells: [[0, 2]],
    blocks: true,
    facing: 'east',
  },
  {
    id: 'sofa',
    type: 'sofa',
    name: 'Диван',
    cells: [[0, 4], [0, 5]],
    blocks: true,
    facing: 'east',
    color: '#5b6e9c', // цвет обивки
    // ПРИМЕР: чтобы диван стал кликабельным, уберите две косые черты
    // в начале каждой строки ниже (от "actions" до "],").
    // actions: [
    //   {
    //     id: 'rest',
    //     label: 'Отдохнуть',
    //     icon: '🛋️',
    //     goTo: [1, 4],
    //     face: 'east',
    //     animation: 'sit',
    //     endAnimation: 'stand',
    //     panel: 'about',
    //     panelDelay: 1,
    //     occupies: true,
    //   },
    // ],
  },
  {
    id: 'lamp',
    type: 'floorLamp',
    cells: [[0, 0]],
    blocks: true,
  },
  {
    id: 'window',
    type: 'window',
    wall: 'north', // на какой стене висит: 'north' (задняя) или 'west' (левая)
    cells: [[4, 0]], // над какой клеткой
    blocks: false,
  },
  {
    id: 'rug',
    type: 'rug',
    cells: [[2, 3], [3, 3], [4, 3], [2, 4], [3, 4], [4, 4]],
    blocks: false,
    color: '#8c3b3b',
  },
];

// ---------- Мелкие тексты интерфейса ----------
export const ui = {
  ps1On: 'PS1: вкл',
  ps1Off: 'PS1: выкл',
  busy: 'Занято',
  cancel: 'Отменить',
  close: 'Закрыть',
  clock24h: true, // true — 14:05, false — 2:05 pm
};
