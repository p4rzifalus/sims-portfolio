// Маленькие текстуры 32×32, нарисованные кодом попиксельно.
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

function makeTexture(draw, seed = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(32, 32);
  const rnd = random(seed);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const [r, g, b] = draw(x, y, rnd);
      const i = (y * 32 + x) * 4;
      img.data[i] = clamp(r);
      img.data[i + 1] = clamp(g);
      img.data[i + 2] = clamp(b);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
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
export function screen() {
  const rnd0 = random(71);
  const lines = Array.from({ length: 10 }, () => [Math.floor(rnd0() * 6), 6 + Math.floor(rnd0() * 20)]);
  return makeTexture((x, y, rnd) => {
    const bg = [20, 36, 70];
    if (y % 3 === 1 && y > 2 && y < 30) {
      const [start, len] = lines[Math.floor(y / 3)];
      if (x > 2 + start && x < 2 + start + len) return rnd() < 0.15 ? [255, 200, 120] : [130, 230, 255];
    }
    return shade(bg, 0.9 + rnd() * 0.2);
  }, 72);
}
