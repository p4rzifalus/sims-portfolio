// Маленькие текстуры 32×32 (вид из окна и плакат — крупнее), нарисованные кодом попиксельно.
// Фильтрация nearest — пиксели остаются чёткими квадратами.
import * as THREE from 'three';

// Генератор случайных чисел с «зерном»: при каждом запуске рисунок одинаковый.
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const shade = (rgb, k) => rgb.map((v) => clamp(v * k));

function makeTexture(draw, seed = 1, W = 32, H = 32) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const rnd = random(seed);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = draw(x, y, rnd);
      const i = (y * W + x) * 4;
      img.data[i] = clamp(r);
      img.data[i + 1] = clamp(g);
      img.data[i + 2] = clamp(b);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(canvas);
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Копия текстуры с другим числом повторов (картинка общая).
export function repeated(tex, x, y) {
  const t = tex.clone();
  t.repeat.set(x, y);
  t.needsUpdate = true;
  return t;
}

// Доски пола: 4 доски на клетку, стыки вразбежку.
export function planks(hex) {
  const base = hexToRgb(hex);
  const rnd0 = random(7);
  const boards = [0, 1, 2, 3].map(() => ({
    split: Math.floor(rnd0() * 32),
    tones: [0.88 + rnd0() * 0.2, 0.88 + rnd0() * 0.2],
  }));
  return makeTexture((x, y, rnd) => {
    const b = boards[Math.floor(y / 8)];
    const half = (x - b.split + 32) % 32 < 16 ? 0 : 1;
    let k = b.tones[half] * (0.95 + rnd() * 0.08);
    if ((y % 8 === 2 || y % 8 === 5) && rnd() < 0.45) k *= 0.9; // волокна
    if (y % 8 === 7) k *= 0.66; // щель между досками
    if (x === b.split || x === (b.split + 16) % 32) k *= 0.72; // торцы
    return shade(base, k);
  }, 11);
}

// Обои: светлые вертикальные полосы и мелкий узор-ромбик.
export function wallpaper(hex) {
  const base = hexToRgb(hex);
  return makeTexture((x, y, rnd) => {
    let k = 0.97 + rnd() * 0.05;
    if (x % 16 < 2) k *= 1.07;
    // ромбики в шахматном порядке: соседние колонки сдвинуты на полклетки
    const shift = (Math.floor(x / 16) % 2) * 8;
    const d = Math.abs((x % 16) - 8) + Math.abs(((y + shift) % 16) - 8);
    if (d === 2) k *= 0.84;
    if (d === 0) k *= 0.9;
    return shade(base, k);
  }, 21);
}

// Дерево: волнистые волокна и редкие сучки.
export function wood(hex) {
  const base = hexToRgb(hex);
  return makeTexture((x, y, rnd) => {
    let k = 1 + 0.09 * Math.sin(y * 1.3 + Math.sin(x * 0.25) * 2.2);
    k *= 0.95 + rnd() * 0.08;
    const knot = Math.hypot(x - 22, y - 9);
    if (knot < 2.2) k *= 0.75;
    return shade(base, k);
  }, 31);
}

// Ткань: мелкое плетение.
export function fabric(hex) {
  const base = hexToRgb(hex);
  return makeTexture((x, y, rnd) => {
    let k = (x + y) % 2 ? 0.94 : 1.04;
    k *= 0.95 + rnd() * 0.08;
    if (y % 8 === 0) k *= 0.93;
    return shade(base, k);
  }, 41);
}

// Ковёр: тёмная кайма, светлая полоса, ромб в центре.
export function rug(hex) {
  const base = hexToRgb(hex);
  return makeTexture((x, y, rnd) => {
    const edge = Math.min(x, y, 31 - x, 31 - y);
    const d = Math.abs(x - 15.5) + Math.abs(y - 15.5);
    let k = 1;
    if (edge < 2) k = 0.6;
    else if (edge === 3) k = 1.45;
    else if (d < 6) k = 1.5;
    else if (d < 8) k = 0.75;
    else if (d < 10) k = 1.15;
    k *= 0.93 + rnd() * 0.1;
    return shade(base, k);
  }, 51);
}

// Небо в окне.
export function sky() {
  return makeTexture((x, y, rnd) => {
    const t = y / 31;
    let c = [120 + t * 90, 170 + t * 60, 235 - t * 10];
    const cloud = Math.sin(x * 0.45 + 1) + Math.sin(x * 0.2 + y * 0.6);
    if (y > 6 && y < 14 && cloud > 1.1) c = [235, 240, 248];
    if (rnd() < 0.04) c = shade(c, 1.05);
    return c;
  }, 61);
}

// Экран компьютера: строчки «кода».
// W, H — размер в пикселях (у широкого экрана ноутбука — 60×25).
export function screen(W = 32, H = 32) {
  const rnd0 = random(71);
  const k = W / 32;
  const lines = Array.from({ length: Math.ceil(H / 3) }, () => [Math.floor(rnd0() * 6 * k), Math.floor((6 + rnd0() * 20) * k)]);
  return makeTexture((x, y, rnd) => {
    const bg = [20, 36, 70];
    if (y % 3 === 1 && y > 2 && y < H - 2) {
      const [start, len] = lines[Math.floor(y / 3)];
      if (x > 2 + start && x < 2 + start + len) return rnd() < 0.15 ? [255, 200, 120] : [130, 230, 255];
    }
    return shade(bg, 0.9 + rnd() * 0.2);
  }, 72, W, H);
}

// Экран ноутбука с «макетом»: панели редактора и карточки на холсте.
// Размеры в долях экрана (u — по ширине, v — по высоте), поэтому рисунок подходит любому W×H.
export function designScreen(W = 32, H = 32) {
  return makeTexture((x, y, rnd) => {
    const u = x / W, v = y / H;
    if (y < 2) return [52, 52, 60]; // верхняя полоска
    if (u < 0.16) return y % 3 === 1 && x > 1 && u < 0.13 ? [120, 120, 135] : [44, 44, 52]; // слои
    if (u > 0.84) return y % 4 === 2 && u < 0.97 ? [110, 110, 125] : [44, 44, 52]; // свойства
    // холст с тремя карточками
    if (v > 0.18 && v < 0.52 && u > 0.24 && u < 0.48) return [240, 130, 80];
    if (v > 0.18 && v < 0.52 && u > 0.52 && u < 0.76) return [90, 160, 220];
    if (v > 0.6 && v < 0.86 && u > 0.24 && u < 0.76) return y === Math.round(H * 0.68) || y === Math.round(H * 0.78) ? [70, 70, 80] : [235, 232, 225];
    return shade([200, 200, 205], 0.97 + rnd() * 0.04);
  }, 81, W, H);
}

// Вид из окна: петербург белой ночью. Ширина — 32 пикселя на клетку окна.
// Сверху вниз: небо, дальний берег с домами, шпиль и купол, разведённый мост,
// нева с отражениями, гранитная набережная.
// night — поздняя ночь: тёмно-синее небо, дома в тени, больше светящихся окон (этап 14).
export function cityView(cells = 4, night = false) {
  const W = 32 * cells, H = 72;
  const HORIZON = 44, EMBANK = 61;
  const rnd0 = random(91);
  const facades = [[222, 196, 120], [170, 205, 185], [226, 170, 160], [170, 190, 220], [235, 225, 200], [205, 150, 120]];
  // дома дальнего берега: ширина, высота, цвет (одна линия карнизов, как на набережных)
  const houses = [];
  for (let x = 0; x < W; ) {
    const w = 6 + Math.floor(rnd0() * 10);
    houses.push({ x0: x, x1: x + w, h: 6 + Math.floor(rnd0() * 3), c: facades[Math.floor(rnd0() * facades.length)] });
    x += w;
  }
  const spireX = Math.round(W * 0.22); // шпиль петропавловки
  const domeX = Math.round(W * 0.7); // купол исаакия
  const bridgeX = Math.round(W * 0.46); // разведённый мост
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const skyAt = (y) => {
    const t = y / HORIZON;
    if (night) return t < 0.6 ? mix([14, 16, 40], [40, 44, 88], t / 0.6) : mix([40, 44, 88], [96, 84, 120], (t - 0.6) / 0.4);
    return t < 0.55 ? mix([118, 112, 178], [214, 156, 176], t / 0.55) : mix([214, 156, 176], [255, 214, 170], (t - 0.55) / 0.45);
  };
  const gold = [236, 190, 90];
  const LIT = [255, 230, 150];

  function land(x, y) {
    // шпиль: башня и тонкая игла
    if (Math.abs(x - spireX) <= 2 && y >= HORIZON - 16 && y < HORIZON - 8) return [200, 170, 120];
    if (Math.abs(x - spireX) <= 1 && y >= HORIZON - 22 && y < HORIZON - 16) return gold;
    if (x === spireX && y >= 6 && y < HORIZON - 22) return gold;
    // исаакий: широкое основание с фронтоном, барабан с колоннами, большой купол, фонарик
    const dx = x - domeX;
    const dy = HORIZON - 17 - y;
    if (y < HORIZON - 17 && dx * dx + dy * dy * 1.6 <= 64) return dx < -3 ? [196, 146, 58] : dx > 3 ? [250, 214, 120] : gold;
    if (Math.abs(dx) <= 6 && y >= HORIZON - 17 && y < HORIZON - 11) return x % 2 ? [204, 194, 172] : [140, 130, 116];
    if (Math.abs(dx) <= 1 && y >= HORIZON - 27 && y < HORIZON - 23) return gold;
    if (y >= HORIZON - 11 && y < HORIZON - 8 && Math.abs(dx) <= 7 - (HORIZON - 9 - y) * 2) return [186, 176, 156]; // фронтон
    if (Math.abs(dx) <= 11 && y >= HORIZON - 8 && y < HORIZON) return (x % 3 === 0 && y > HORIZON - 7) ? [150, 140, 124] : [186, 176, 156];
    // разведённый мост: опоры и два пролёта, поднятые вверх
    for (const s of [-1, 1]) {
      const bx = bridgeX + s * 3, t = (x - bx) * s;
      if (t >= 0 && t < 7 && y < HORIZON && y >= HORIZON - 1 - (7 - t) * 1.4 - 2 && y <= HORIZON - 1 - (7 - t) * 1.4 + 1) return [72, 74, 96];
      if (t >= 7 && t < 22 && y >= HORIZON - 2 && y < HORIZON) return y === HORIZON - 2 ? [96, 98, 120] : [72, 74, 96];
    }
    // дома с окнами
    const h = houses.find((hh) => x >= hh.x0 && x < hh.x1);
    if (h && y >= HORIZON - h.h) {
      if (y === HORIZON - h.h) return shade(h.c, 1.1); // карниз
      if (x === h.x0) return shade(h.c, 0.8);
      if ((x - h.x0) % 3 === 1 && (HORIZON - y) % 3 === 2) return ((x * 7919) ^ (y * 104729)) % (night ? 3 : 5) === 0 ? LIT : shade(h.c, 0.6); // в некоторых окнах свет
      return h.c;
    }
    return null;
  }

  return makeTexture((x, y, rnd) => {
    if (y < HORIZON) {
      const l = land(x, y);
      if (l && night) return l === LIT ? l : l === gold ? shade(gold, 0.75) : mix(shade(l, 0.3), skyAt(y), 0.2);
      if (l) return mix(l, skyAt(y), 0.18); // дымка на дальнем берегу
      let c = skyAt(y);
      if ((rnd() < 0.5 ? 0 : 1) && y % 7 === 3) c = shade(c, 1.02); // дизеринг полос
      const cloud = Math.sin(x * 0.11 + 2) + Math.sin(x * 0.05 + y * 0.4);
      if (y > 10 && y < 16 && cloud > 1.4) c = mix(c, night ? [70, 70, 110] : [255, 225, 225], 0.6);
      if (night && y < 30 && rnd() < 0.012) c = [200, 205, 230]; // звёзды
      return c;
    }
    if (y < EMBANK) {
      // нева: отражение неба, дрожащее рябью, золотые дорожки под шпилем и куполом
      const ry = HORIZON - 1 - (y - HORIZON) * 1.6;
      const wob = Math.round(Math.sin(y * 1.7 + x * 0.3) * 1.5);
      const refl = ry > 0 ? land(x + wob, Math.floor(ry)) : null;
      let c = mix([60, 62, 110], skyAt(Math.max(0, ry)), 0.45);
      if (refl) c = mix(c, night && refl !== LIT ? shade(refl, 0.3) : refl, 0.35);
      if (night) c = shade(c, 0.55);
      if (y % 3 === 0 && rnd() < 0.3) c = shade(c, 1.15); // блики ряби
      return c;
    }
    // гранит набережной
    if (y === EMBANK) return night ? [80, 74, 84] : [190, 170, 165];
    return shade(night ? [58, 52, 62] : [150, 128, 125], 0.85 + rnd() * 0.25);
  }, 92, W, H);
}

// Плакат: цветной фон, крупный заголовок и строчки текста.
// Текст рисуется шрифтом, а потом «огрубляется» до чётких пикселей, как в старых играх.
export function poster({ title = '', lines = [], color = '#e8833a', textColor = '#1d1b26' }) {
  const W = 72, H = 96;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  // графика: круг и полоса
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(W * 0.72, H * 0.3, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.fillRect(6, H - 14, W - 12, 3);

  const txt = document.createElement('canvas');
  txt.width = W;
  txt.height = H;
  const t = txt.getContext('2d');
  t.fillStyle = '#fff';
  t.textBaseline = 'top';
  let size = 30;
  t.font = `900 ${size}px sans-serif`;
  while (size > 10 && t.measureText(title).width > W - 10) t.font = `900 ${--size}px sans-serif`;
  t.fillText(title, 6, 8);
  t.font = '700 9px sans-serif';
  lines.forEach((line, i) => t.fillText(line, 6, 12 + size + i * 11, W - 12));
  // порог: пиксель либо цвета текста, либо фона — никаких полутонов
  const src = t.getImageData(0, 0, W, H).data;
  const out = ctx.getImageData(0, 0, W, H);
  const [r, g, b] = hexToRgb(textColor);
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] > 110) {
      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvasTexture(canvas);
}

// Плакат-картинка из файла (поле image в data.js). Картинка уменьшается до W×H пикселей —
// так она выглядит «пиксельной», как остальная комната, но крупный текст на ней читается,
// когда камера подъезжает к стене. Пока файл грузится, плакат тёмный.
// Уменьшенные копии (mipmaps) нужны, чтобы издалека плакат не рябил.
export function imagePoster(url, W = 240, H = 300) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1d1b26';
  ctx.fillRect(0, 0, W, H);
  const tex = canvasTexture(canvas);
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const img = new Image();
  img.onload = () => {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, W, H);
    tex.needsUpdate = true;
  };
  img.onerror = () => console.warn(`Картинка плаката не нашлась: ${url} (проверьте поле image в data.js)`);
  img.src = url;
  return tex;
}

// ---------- Особняк (этап 14): тёмные обои, панели, паркет, ковёр, бархат ----------

// Обои с дамасским узором: зеркальный «цветок» на тёмном фоне, ряды сдвинуты на полшага.
// Плитка 32×32 — это 0.5 × 0.5 клетки на стене.
export function damask(hex, patternHex) {
  const base = hexToRgb(hex);
  const pat = hexToRgb(patternHex);
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return makeTexture((x, y, rnd) => {
    // два мотива на плитку: в центре и в углах (сдвиг на полшага)
    const motif = (cx, cy) => {
      let dx = Math.abs(((x - cx + 48) % 32) - 16) / 16; // 0…1, зеркально
      let dy = (((y - cy + 48) % 32) - 16) / 16; // −1…1
      dx *= 1.25;
      // силуэт: капля-лист сверху, листья по бокам, ножка снизу
      const body = dx * dx + (dy + 0.1) * (dy + 0.1) * 0.55 < 0.16 + 0.05 * Math.cos(dy * 9);
      const tip = dy < -0.4 && dx < 0.12 * (1 + dy + 0.4) * 3 && dy > -0.85;
      const leaves = Math.abs(dy - 0.35 + dx * 0.6) < 0.08 && dx > 0.25 && dx < 0.62;
      const stem = dx < 0.06 && dy > 0.3 && dy < 0.75;
      const hole = dx * dx + (dy + 0.12) * (dy + 0.12) < 0.025; // тёмная серединка
      return (body || tip || leaves || stem) && !hole;
    };
    const on = motif(16, 16) || motif(0, 0);
    let c = on ? mix(base, pat, 0.85 + rnd() * 0.15) : shade(base, 0.92 + rnd() * 0.12);
    if (x % 16 === 0 && rnd() < 0.5) c = shade(c, 0.94); // старая бумага: лёгкие стыки и пятна
    return c;
  }, 61);
}

// Деревянные панели по низу стены: на клетку одна филёнка с фаской
// (светлая грань сверху и слева, тень снизу и справа). 64×64 = клетка × высота панелей.
export function wainscot(hex) {
  const base = hexToRgb(hex);
  return makeTexture((x, y, rnd) => {
    let k = 1 + 0.07 * Math.sin(y * 0.9 + Math.sin(x * 0.2) * 2) + (rnd() - 0.5) * 0.08;
    const m = 7; // ширина рамки
    const inX = x >= m && x < 64 - m, inY = y >= m + 2 && y < 64 - m;
    if (inX && inY) {
      const e = Math.min(x - m, 63 - m - x, y - m - 2, 63 - m - y);
      if (e < 3) {
        // фаска: свет падает сверху-слева
        const top = y - m - 2 === e || x - m === e;
        k *= top ? 1.3 : 0.6;
      } else k *= 0.9; // поле филёнки чуть темнее рамы
    }
    if (x === 0 || x === 63) k *= 0.55; // стык панелей
    if (y < 2) k *= 1.35; // верхняя кромка
    return shade(base, k);
  }, 62, 64, 64);
}

// Паркет «ёлочкой»: дощечки 4×16 px, тайл 64×64 на клетку.
// Клетка (i, j) в единицах ширины дощечки: t = (i − j) mod 8; t < 4 — лежит вдоль, иначе поперёк.
export function herringbone(hex) {
  const base = hexToRgb(hex);
  const N = 4, Wd = 4;
  const tone = (a, b) => 0.82 + (((a * 73856093) ^ (b * 19349663)) >>> 0) % 1000 / 1000 * 0.32;
  return makeTexture((x, y, rnd) => {
    const i = Math.floor(x / Wd), j = Math.floor(y / Wd);
    const px = x % Wd, py = y % Wd;
    const t = (((i - j) % (2 * N)) + 2 * N) % (2 * N);
    let k;
    if (t < N) {
      // вдоль: доска в ряду j
      const id = Math.floor((i - j) / (2 * N));
      k = tone(j % 16, ((id % 2) + 2) % 2);
      k *= 1 + 0.08 * Math.sin(x * 0.7 + j);
      if (py === 0) k *= 0.62; // щель сверху
      if (t === 0 && px === 0) k *= 0.62; // торец
    } else {
      const id = Math.floor((i - j - N) / (2 * N));
      k = tone(100 + (i % 16), ((id % 2) + 2) % 2);
      k *= 1 + 0.08 * Math.sin(y * 0.7 + i);
      if (px === 0) k *= 0.62;
      if (t === 2 * N - 1 && py === 0) k *= 0.62;
    }
    k *= 0.94 + rnd() * 0.1;
    return shade(base, k);
  }, 63, 64, 64);
}

// Персидский ковёр целиком (не плиткой): бахрома по коротким краям, кайма в три полосы,
// поле с мелкими розетками, медальон в центре и уголки. W × H — пропорции ковра.
export function persianRug({ color = '#7a1f1f', gold = '#c9a050', navy = '#1f2a48', cream = '#d8c9a8' } = {}, W = 96, H = 64) {
  const red = hexToRgb(color), gd = hexToRgb(gold), nv = hexToRgb(navy), cr = hexToRgb(cream);
  const FR = 3; // бахрома
  return makeTexture((x, y, rnd) => {
    const n = 0.9 + rnd() * 0.16;
    if (x < FR || x >= W - FR) return (y % 2 === 0 ? shade(cr, 0.95) : shade(cr, 0.7)).map((v) => v * n);
    const u = x - FR, w = W - 2 * FR;
    const ax = Math.min(u, w - 1 - u), ay = Math.min(y, H - 1 - y); // расстояние до края
    const edge = Math.min(ax, ay);
    let c;
    if (edge < 1) c = shade(nv, 0.6);
    else if (edge < 3) c = nv;
    else if (edge < 4) c = gd;
    else if (edge < 8) {
      // кайма: волна-«бегущая собака»
      const s = ax < ay ? y : u;
      const wave = Math.sin(s * 0.8) * 1.5 + 6;
      c = Math.abs(edge - wave) < 0.8 ? gd : shade(red, 0.7);
    } else if (edge < 9) c = gd;
    else {
      // поле
      const cx = (w - 1) / 2, cy = (H - 1) / 2;
      const dx = Math.abs(u - cx), dy = Math.abs(y - cy);
      const dm = dx / 1.4 + dy; // ромб медальона
      c = red;
      if (dm < 5) c = gd;
      else if (dm < 7) c = nv;
      else if (dm < 13) c = (Math.round(dx) + Math.round(dy)) % 4 === 0 ? gd : shade(nv, 1.4);
      else if (dm < 14) c = gd;
      // уголки поля
      else if (ax + ay < 24 && ax > 8 && ay > 8) c = (ax + ay) % 3 === 0 ? gd : nv;
      // розетки по полю
      else if ((Math.round(u / 2) + Math.round(y / 2)) % 5 === 0 && (u + y) % 2 === 0) c = shade(gd, 0.8);
    }
    return c.map((v) => v * n);
  }, 64, W, H);
}

// Бархат штор: вертикальные складки (свет — тень), мелкий ворс.
export function velvet(hex) {
  const base = hexToRgb(hex);
  return makeTexture((x, y, rnd) => {
    let k = 0.75 + 0.35 * Math.max(0, Math.sin((x / 32) * Math.PI * 4));
    k *= 0.93 + rnd() * 0.12;
    return shade(base, k);
  }, 65);
}

// Ряд книг на полке (этап 14): корешки разной ширины и высоты в старых переплётах,
// золотые полоски, над книгами — тёмная щель. Одна текстура на полку вместо сотни брусков.
export function bookSpines(seed = 1) {
  const covers = [[96, 34, 30], [40, 62, 44], [34, 42, 74], [92, 64, 36], [36, 30, 30], [120, 92, 60], [70, 40, 56]];
  const rnd0 = random(seed * 97 + 3);
  const books = [];
  for (let x = 0; x < 64; ) {
    const w = 2 + Math.floor(rnd0() * 4);
    books.push({ x0: x, x1: x + w, top: Math.floor(rnd0() * 14), c: covers[Math.floor(rnd0() * covers.length)], gap: rnd0() < 0.08, band: 4 + Math.floor(rnd0() * 6) });
    x += w;
  }
  return makeTexture((x, y, rnd) => {
    const b = books.find((bb) => x >= bb.x0 && x < bb.x1) || books[books.length - 1];
    if (b.gap || y < b.top) return [16, 11, 9]; // щель над книгами
    let k = 0.9 + rnd() * 0.15;
    if (x === b.x0) k *= 0.55; // стык корешков
    if (x === b.x1 - 1) k *= 0.8;
    const fromTop = y - b.top;
    if (fromTop === b.band || fromTop === b.band + 2 || y === 58) return [176, 140, 70].map((v) => v * k); // золотое тиснение
    if (y > 61) k *= 0.6; // тень у полки
    return b.c.map((v) => v * k * 1.6);
  }, seed, 64, 64);
}

// Кожаная вставка столешницы: зелёная кожа с золотой рамкой тиснения.
export function leather(hex = '#2f4a32') {
  const base = hexToRgb(hex);
  return makeTexture((x, y, rnd) => {
    const e = Math.min(x, y, 63 - x, 31 - y);
    if (e === 2) return [168, 132, 66];
    let k = 0.88 + rnd() * 0.2;
    if (e < 2) k *= 0.6;
    return shade(base, k);
  }, 66, 64, 32);
}
