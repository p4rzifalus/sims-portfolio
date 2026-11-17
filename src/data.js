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
// reach — тянется рукой (достать книгу с полки), hold — держит предмет двумя руками.
export const animations = {
  idle: 'idle',
  walk: 'walk',
  sit: 'sit',
  reach: 'interact-right',
  hold: 'holding-both',
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
    // Досье в нижней панели (подписи и порядок — ниже, в блоке dossier).
    // потребности: насколько заполнена каждая шкала, от 0 до 10
    needs: { hunger: 6, comfort: 8, energy: 4, fun: 9, social: 8, environment: 10 },
    // интересы: значки под портретом; подпись видна при наведении (на телефоне — по нажатию).
    // Можно добавить description: '…' — появится под подписью.
    interests: [
      { icon: '🖌️', label: 'рисование' },
      { icon: '💃', label: 'танцы' },
      { icon: '📚', label: 'книжный дизайн' },
    ],
    // работа: место и роль, по строке на каждое место
    jobs: [
      { place: 'щелочь', role: 'препод курса ПИН' },
      { place: 'британка', role: 'препод дисциплины «нейросети»' },
      { place: 'центральный университет', role: 'препод дисциплины «дизайн и разработка с ИИ»' },
    ],
    // отношения: who — id другого персонажа, friendship — цифра дружбы от −100 до 100
    relationships: [{ who: 'p2', friendship: 100 }],
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
    needs: { hunger: 5, comfort: 7, energy: 6, fun: 8, social: 6, environment: 10 },
    interests: [
      { icon: '🧠', label: 'психология' },
      { icon: '🎲', label: 'гейм-дизайн' },
      { icon: '🎬', label: 'фильмы' },
    ],
    jobs: [
      { place: '«далее» (команда сбера)', role: 'senior UX/UI-дизайнер' },
      { place: 'aic', role: 'ex-ведущий дизайнер' },
      { place: 'duo sapiens', role: 'ментор' },
    ],
    relationships: [{ who: 'p1', friendship: 100 }],
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

// ---------- Досье: нижняя панель ----------
// Панель из трёх блоков: портрет (под ним интересы и часы), работа, справа — вкладки.
// Данные лежат у каждого персонажа: needs, interests, jobs, relationships.
export const dossier = {
  jobsTitle: 'работа', // заголовок среднего блока
  // Вкладки правого блока (переключаются значками слева от него). Первая открыта при загрузке.
  tabs: [
    { id: 'needs', icon: '🍎', label: 'потребности' },
    { id: 'relationships', icon: '💛', label: 'отношения' },
  ],
  // Шкалы потребностей: id совпадает с ключом в needs персонажа.
  // Первая половина — левый столбец, вторая — правый.
  needs: [
    { id: 'hunger', label: 'голод' },
    { id: 'comfort', label: 'комфорт' },
    { id: 'energy', label: 'бодрость' },
    { id: 'fun', label: 'веселье' },
    { id: 'social', label: 'общение' },
    { id: 'environment', label: 'обстановка' },
  ],
  needsMax: 10, // значение полной шкалы
  moodLabel: 'настроение', // подсказка у столбика рядом с потребностями (среднее всех шкал)
  friendshipLabel: 'дружба', // подпись у цифры дружбы
};

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
// 'shelf' — общая панель книжного шкафа: она не про выбранного персонажа,
// поэтому её ссылки лежат прямо здесь. note — серая подпись справа.
export const panels = {
  works: { title: 'работы' },
  links: { title: 'ссылки' },
  about: { title: 'о себе' },
  shelf: {
    title: 'книжный шкаф',
    shared: true, // в заголовке нет имени персонажа
    links: [
      { label: 'тг-канал сони', note: '@dnevniksonisurm', url: 'https://t.me/dnevniksonisurm' },
      { label: 'тг-канал паши', note: '@soulpixels', url: 'https://t.me/soulpixels' },
      { label: 'тг-канал щелочи', note: '@sholotch', url: 'https://t.me/sholotch' },
      {
        label: 'курс ПИН',
        note: 'alkali.shop',
        url: 'https://alkali.shop/product/povsednevnoe-ispolzovanie-neyrosetey-2',
      },
    ],
  },
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
//     spots        — вместо goTo: несколько клеток (например, два места на диване).
//                    Персонаж выберет первую свободную; когда заняты все — «занято»
//     animation    — что сделает: 'sit' (сесть) или 'wave' (помахать)
//     sitOn        — на какой предмет сесть (его id), если animation: 'sit'.
//                    Когда действие закончится или его отменят, персонаж встанет сам.
//     prop         — что достать: 'book' (книга с полки, стоя) или 'laptop'
//                    (ноутбук из-за спины, сидя — и начать печатать)
//     thenFace     — куда повернуться, когда предмет в руках ('viewer' — к зрителю)
//     panel        — какую панель открыть: 'works', 'links', 'about' или 'shelf'
//     panelDelay   — через сколько секунд после анимации открыть панель
//     occupies     — true: пока действие идёт, место занято — у второго
//                    персонажа кнопка будет серой с подписью «занято»
// Действие с панелью заканчивается, когда её закрывают. Без панели персонаж,
// который сел или достал предмет, так и остаётся, пока действие не отменят. Отменить можно крестиком в нижней панели или кликом по полу.
//
// closeUp — вместо меню: клик по предмету на стене подводит камеру к нему
//     button — надпись на кнопке внизу, url — куда она ведёт.
//     Вернуться — кнопкой «назад», клавишей Esc или кликом мимо предмета.
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
    name: 'книжный шкаф',
    cells: [[1, 0], [2, 0]],
    blocks: true,
    facing: 'south',
    actions: [
      {
        id: 'read',
        label: 'взять книгу',
        icon: '📚',
        goTo: [1, 1], // перед левой секцией шкафа
        face: 'north',
        prop: 'book',
        thenFace: 'viewer', // с книгой — к зрителю, чтобы её было видно
        panel: 'shelf',
        panelDelay: 0.6,
      },
    ],
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
    // Двое могут сесть рядом: персонаж займёт первое свободное место из spots.
    actions: [
      {
        id: 'work',
        label: 'поработать',
        icon: '💻',
        spots: [[1, 3], [1, 2]], // клетки перед диваном
        face: 'west',
        animation: 'sit',
        sitOn: 'sofa',
        prop: 'laptop',
        occupies: true,
      },
    ],
  },
  {
    id: 'plant',
    type: 'plant',
    cells: [[0, 1]], // у дивана, со стороны торшера
    blocks: true,
  },
  {
    id: 'poster',
    type: 'poster',
    wall: 'west',
    cells: [[0, 2], [0, 3]], // висит над диваном
    blocks: false,
    height: 1.75, // где центр плаката по высоте (высота стены — 2.6)
    image: 'images/pin-poster.jpg', // картинка 4:5, лежит в public/images
    closeUp: {
      button: 'читать подробнее о курсе',
      url: 'https://alkali.shop/product/povsednevnoe-ispolzovanie-neyrosetey-2',
    },
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
  walking: 'идёт', // что написано в нижней панели, пока персонаж идёт
  idle: 'свободен', // …и когда он ничем не занят
  close: 'закрыть',
  back: 'назад', // кнопка, которая возвращает камеру от плаката в комнату
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
