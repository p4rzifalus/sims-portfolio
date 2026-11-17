// ============================================================
//  ВЕСЬ КОНТЕНТ САЙТА ЖИВЁТ ЗДЕСЬ.
//  Этот файл можно править без знания кода. Правила:
//   - текст всегда в кавычках: 'вот так'
//   - все тексты на сайте — с маленькой буквы, аббревиатуры большими (PS1, ПИН, ИИ)
//   - про висячие предлоги думать не нужно: короткие слова («в», «на», «и»…)
//     сайт сам приклеит к следующему слову, чтобы они не оставались в конце строки
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
  columns: 8, // ширина в клетках (вдоль задней стены, где окно)
  rows: 7, // глубина в клетках (вдоль левой стены)
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
    name: 'соня сурм',
    model: 'character-female-a',
    color: '#e8833a',
    startCell: [3, 4], // где стоит при открытии сайта (номера клеток видны по клавише G)
    startFacing: 'south',
    traits: [
      { icon: '🎨', label: 'дизайнер' },
      { icon: '☕', label: 'кофеман' },
      { icon: '🌙', label: 'сова' },
      { icon: '🎮', label: 'геймер' },
    ],
    about:
      'здесь будет короткий рассказ о первом человеке: чем занимается, что любит, как с ним работать.',
    works: [
      { title: 'работа 1', description: 'короткое описание', image: '', url: '' },
      { title: 'работа 2', description: 'короткое описание', image: '', url: '' },
      { title: 'работа 3', description: 'короткое описание', image: '', url: '' },
      { title: 'работа 4', description: 'короткое описание', image: '', url: '' },
      { title: 'работа 5', description: 'короткое описание', image: '', url: '' },
      { title: 'работа 6', description: 'короткое описание', image: '', url: '' },
    ],
    links: [
      { label: 'telegram', url: 'https://example.com' },
      { label: 'behance', url: 'https://example.com' },
      { label: 'почта', url: 'mailto:hello@example.com' },
    ],
  },
  {
    id: 'p2',
    name: 'паша архангельский',
    model: 'character-male-a',
    color: '#4aa3c7',
    startCell: [5, 4],
    startFacing: 'south',
    traits: [
      { icon: '💻', label: 'разработчик' },
      { icon: '🎧', label: 'меломан' },
      { icon: '🌱', label: 'садовод' },
    ],
    about:
      'здесь будет короткий рассказ о втором человеке: чем занимается, что любит, как с ним работать.',
    works: [
      { title: 'работа 1', description: 'короткое описание', image: '', url: '' },
      { title: 'работа 2', description: 'короткое описание', image: '', url: '' },
      { title: 'работа 3', description: 'короткое описание', image: '', url: '' },
      { title: 'работа 4', description: 'короткое описание', image: '', url: '' },
    ],
    links: [
      { label: 'github', url: 'https://example.com' },
      { label: 'telegram', url: 'https://example.com' },
    ],
  },
];

// ---------- Действия при клике по персонажу ----------
// Клик по невыбранному персонажу выбирает его, по уже выбранному — открывает это меню.
// who: 'target' — действие выполняет тот, по кому кликнули (он повернётся к зрителю),
// и панель показывает его данные. Поля — те же, что у действий с мебелью (см. ниже).
export const characterActions = [
  { id: 'wave', label: 'помахать', icon: '👋', who: 'target', animation: 'wave' },
  { id: 'about', label: 'о себе', icon: '💬', who: 'target', panel: 'about' },
];

// ---------- Виды панелей ----------
// 'works' — сетка работ персонажа, 'links' — список его ссылок,
// 'about' — текст «о себе».
export const panels = {
  works: { title: 'работы' },
  links: { title: 'ссылки' },
  about: { title: 'о себе' },
};

// ---------- Мебель и предметы ----------
// type     — что это за предмет (как он выглядит, решает код). Есть:
//            designDesk (белый стол), macbook (ноутбук, ставится на стол),
//            designChair (стул-чаша), bookcase (книжный шкаф), wardrobe (шкаф для одежды),
//            sofa (диван), plant (растение), floorLamp (торшер), rug (ковёр),
//            panoramicWindow (окно во всю стену), poster (плакат);
//            из первой версии комнаты: desk, computer, chair, bookshelf, window
// cells    — какие клетки занимает
// blocks   — true: сквозь предмет нельзя пройти; false: можно (ковёр, стул)
// facing   — куда предмет «смотрит» лицом
// wall     — для предметов на стене: 'north' (задняя) или 'west' (левая);
//            cells — над какими клетками висит
// color    — цвет (у дивана — обивка, у стула — чаша, у шкафа — дерево, у ковра — ворс)
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
//                    персонажа кнопка будет серой с подписью «занято»
// Действие заканчивается, когда закрывают панель. Отменить его можно
// крестиком в нижней панели или кликом по полу.
export const furniture = [
  // --- окно во всю заднюю стену, за ним петербург ---
  {
    id: 'window',
    type: 'panoramicWindow',
    wall: 'north',
    cells: [[3, 0], [4, 0], [5, 0], [6, 0], [7, 0]],
    blocks: false,
  },

  // --- рабочее место: длинный стол, два макбука, два стула ---
  {
    id: 'desk',
    type: 'designDesk',
    cells: [[4, 0], [5, 0], [6, 0]],
    blocks: true,
    facing: 'south',
  },
  {
    id: 'macbook-1',
    type: 'macbook',
    name: 'макбук',
    cells: [[4, 0]], // стоит на столе
    onTopOf: 'desk',
    blocks: false,
    facing: 'south',
    screen: 'design', // что на экране: 'design' (макет) или 'code' (код)
    actions: [
      {
        id: 'show-works',
        label: 'показать работы',
        icon: '🖼️',
        goTo: [4, 2], // клетка позади стула
        face: 'north',
        animation: 'sit',
        sitOn: 'chair-1',
        panel: 'works',
        panelDelay: 1,
        occupies: true,
      },
      {
        id: 'show-links',
        label: 'ссылки',
        icon: '🔗',
        goTo: [4, 2],
        face: 'north',
        animation: 'sit',
        sitOn: 'chair-1',
        panel: 'links',
        panelDelay: 1,
        occupies: true,
      },
    ],
  },
  {
    id: 'macbook-2',
    type: 'macbook',
    name: 'макбук',
    cells: [[6, 0]],
    onTopOf: 'desk',
    blocks: false,
    facing: 'south',
    screen: 'code',
    actions: [
      {
        id: 'show-works',
        label: 'показать работы',
        icon: '🖼️',
        goTo: [6, 2],
        face: 'north',
        animation: 'sit',
        sitOn: 'chair-2',
        panel: 'works',
        panelDelay: 1,
        occupies: true,
      },
      {
        id: 'show-links',
        label: 'ссылки',
        icon: '🔗',
        goTo: [6, 2],
        face: 'north',
        animation: 'sit',
        sitOn: 'chair-2',
        panel: 'links',
        panelDelay: 1,
        occupies: true,
      },
    ],
  },
  {
    id: 'chair-1',
    type: 'designChair',
    cells: [[4, 1]],
    blocks: false, // на эту клетку персонаж встаёт, чтобы сесть
    facing: 'north',
    color: '#efece6',
  },
  {
    id: 'chair-2',
    type: 'designChair',
    cells: [[6, 1]],
    blocks: false,
    facing: 'north',
    color: '#e8833a',
  },
  {
    id: 'plant',
    type: 'plant',
    cells: [[7, 1]],
    blocks: true,
  },

  // --- у задней стены слева: торшер и книжный шкаф ---
  {
    id: 'lamp',
    type: 'floorLamp',
    cells: [[0, 0]],
    blocks: true,
  },
  {
    id: 'bookcase',
    type: 'bookcase',
    cells: [[1, 0], [2, 0]],
    blocks: true,
    facing: 'south',
  },

  // --- у левой стены: диван, над ним плакат, дальше шкаф для одежды ---
  {
    id: 'sofa',
    type: 'sofa',
    name: 'диван',
    cells: [[0, 2], [0, 3]],
    blocks: true,
    facing: 'east',
    color: '#5b6e9c', // цвет обивки
    // ПРИМЕР: чтобы диван стал кликабельным, уберите две косые черты
    // в начале каждой строки ниже (от "actions" до "],").
    // Персонаж подойдёт к клетке 1,3, сядет на диван и через секунду
    // откроет панель «о себе». Второй в это время увидит «занято».
    // actions: [
    //   {
    //     id: 'rest',
    //     label: 'отдохнуть',
    //     icon: '🛋️',
    //     goTo: [1, 3],
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
    id: 'poster',
    type: 'poster',
    wall: 'west',
    cells: [[0, 2], [0, 3]], // висит над диваном
    blocks: false,
    height: 1.75, // где центр плаката по высоте (высота стены — 2.6)
    title: 'ПИН',
    lines: ['курс щелочи', 'набор открыт'],
    color: '#e8833a', // фон
    textColor: '#1d1b26', // текст
  },
  {
    id: 'wardrobe',
    type: 'wardrobe',
    cells: [[0, 5], [0, 6]],
    blocks: true,
    facing: 'east',
    color: '#cdb28a',
  },
  {
    id: 'rug',
    type: 'rug',
    cells: [[1, 2], [2, 2], [3, 2], [1, 3], [2, 3], [3, 3]],
    blocks: false,
    color: '#8c3b3b',
  },
];

// ---------- Мелкие тексты интерфейса ----------
export const ui = {
  ps1On: 'PS1: вкл',
  ps1Off: 'PS1: выкл',
  busy: 'занято',
  cancel: 'отменить',
  traitsTitle: 'черты', // заголовок над чертами в нижней панели
  walking: 'идёт', // что написано в нижней панели, пока персонаж идёт
  idle: 'свободен', // …и когда он ничем не занят
  close: 'закрыть',
  gridHint: 'G — сетка', // кнопка отладочной сетки в правом верхнем углу
  pageTitle: 'домик щелочи', // название вкладки браузера
  clock24h: true, // true — 14:05, false — 2:05 pm
};

// ---------- Письмо-приветствие ----------
// Появляется в правом верхнем углу, когда сайт открылся. Закрывается крестиком.
export const welcome = {
  show: true, // false — не показывать письмо
  delay: 1.5, // через сколько секунд после открытия сайта оно появится
  icon: '✉️',
  title: 'письмо',
  text: 'это комната сони сурм и паши архангельского. кликни по компьютерам, чтобы посмотреть работы',
};
