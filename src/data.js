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
  // Дрожание у персонажей: 0 — без дрожания, 2 — вдвое слабее комнаты, 1 — как у комнаты.
  // У маленьких лиц от дрожания «рвутся» глаза и очки, поэтому по умолчанию выключено.
  characterSnap: 0,
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
// Клик по невыбранному персонажу выбирает его, по уже выбранному — открывает это меню.
// who: 'target' — действие выполняет тот, по кому кликнули (он повернётся к зрителю),
// и панель показывает его данные. Поля — те же, что у действий с мебелью (см. ниже).
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
// actions  — если есть, предмет становится кликабельным и по клику открывает
//            меню. У каждого действия (= кнопки в меню):
//     label        — надпись на кнопке
//     icon         — значок (показывается и в нижней панели, пока действие идёт)
//     goTo         — клетка, куда персонаж подойдёт (она должна быть свободной)
//     face         — куда повернётся, когда дойдёт
//     animation    — что сделает: 'sit' (сесть) или 'wave' (помахать)
//     sitOn        — на какой предмет сесть (его id), если animation: 'sit'.
//                    Когда действие закончится или его отменят, персонаж встанет сам.
//     panel        — какую панель открыть: 'works', 'links' или 'about'
//     panelDelay   — через сколько секунд после анимации открыть панель
//     occupies     — true: пока действие идёт, место занято — у второго
//                    персонажа кнопка будет серой с подписью «Занято»
// Действие заканчивается, когда закрывают панель. Отменить его можно
// крестиком в нижней панели или кликом по полу.
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
        goTo: [2, 2], // клетка позади стула
        face: 'north',
        animation: 'sit',
        sitOn: 'chair',
        panel: 'works',
        panelDelay: 1,
        occupies: true,
      },
      {
        id: 'show-links',
        label: 'Ссылки',
        icon: '🔗',
        goTo: [2, 2], // клетка позади стула
        face: 'north',
        animation: 'sit',
        sitOn: 'chair',
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
    // Персонаж подойдёт к клетке 1,4, сядет на диван и через секунду
    // откроет панель «О себе». Второй в это время увидит «Занято».
    // actions: [
    //   {
    //     id: 'rest',
    //     label: 'Отдохнуть',
    //     icon: '🛋️',
    //     goTo: [1, 4],
    //     face: 'west',
    //     animation: 'sit',
    //     sitOn: 'sofa',
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
  traitsTitle: 'Черты', // заголовок над чертами в нижней панели
  walking: 'Идёт', // что написано в нижней панели, пока персонаж идёт
  idle: 'Свободен', // …и когда он ничем не занят
  close: 'Закрыть',
  clock24h: true, // true — 14:05, false — 2:05 pm
};
