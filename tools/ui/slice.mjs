// Нарезка листов интерфейса из gpt-image в готовые картинки для сайта.
//
//   node tools/ui/slice.mjs          — собрать src/ui/ (картинки + kit.css) по разметке tools/ui/kit.json
//   node tools/ui/slice.mjs --find   — найти детали на листах и сохранить их с номерами
//                                       в ui-src/kit/2-find/ (чтобы вписать номера в kit.json)
//
// Листы лежат в ui-src/kit/1-sheets/ (только локально). Что делает скрипт:
// 1) убирает зелёный фон (мягкий край + «отмывка» зелёного отсвета с деталей);
// 2) находит детали как отдельные пятна на прозрачном фоне;
// 3) вырезает нужные по номеру, уменьшает (scale), урезает цвет до 15 бит, как на PS1;
// 4) тайлы (дерево, бархат) делает бесшовными: края плавно перетекают в противоположные.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHEETS = path.join(ROOT, 'ui-src/kit/1-sheets');
const FIND = path.join(ROOT, 'ui-src/kit/2-find');
const OUT = path.join(ROOT, 'src/ui');
const kit = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/ui/kit.json'), 'utf8'));

// ---------- зелёный фон → прозрачность ----------
// «Зелёность» пикселя — насколько зелёный канал выше двух других: у фона ~ +140, у деталей ≤ ~10.
// Прозрачность — доля фона в пикселе: зелёность / зелёность фона. Полупрозрачные края (свечение,
// тени, мягкие кромки) «размешиваем»: вычитаем из пикселя долю фона — остаётся чистый цвет детали,
// поэтому оранжевое свечение не зеленеет.
async function loadKeyed(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { lo } = kit.key;
  // цвет фона — средний по углам листа
  const bg = [0, 0, 0];
  const w = info.width, h = info.height;
  for (const [x, y] of [[4, 4], [w - 5, 4], [4, h - 5], [w - 5, h - 5]])
    for (let c = 0; c < 3; c++) bg[c] += data[(y * w + x) * 4 + c] / 4;
  const bgGreen = bg[1] - Math.max(bg[0], bg[2]);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const green = g - Math.max(r, b);
    let a = green <= lo ? 1 : 1 - (green - lo) / (bgGreen - lo);
    // фон на листе неровный (шум, пятна) — его слабые остатки отрезаем, остальное растягиваем
    a = Math.min(1, Math.max(0, (a - kit.key.floor) / (1 - kit.key.floor)));
    if (a > 0 && a < 1)
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * bg[c]) / a)));
    // остаток зелёного отсвета: у сплошных деталей зелёный не выше max(r, b),
    // у полупрозрачных краёв и свечения — не выше среднего (r, b), иначе оранжевое желтит
    const m = a < 1 ? (data[i] + data[i + 2]) / 2 : Math.max(data[i], data[i + 2]);
    if (data[i + 1] > m) data[i + 1] = Math.round(m);
    data[i + 3] = Math.round(a * 255);
  }
  return { data, w, h };
}

// ---------- поиск деталей ----------
// Пятна непрозрачных пикселей; близкие (ближе gap) склеиваются — шипы, свечение, тени.
function findParts(img, gap = kit.gap) {
  const { data, w, h } = img;
  const solid = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) solid[p] = data[p * 4 + 3] > 96 ? 1 : 0;
  const seen = new Uint8Array(w * h);
  let boxes = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!solid[s] || seen[s]) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || seen[q] || !solid[q]) continue;
        if (Math.abs((q % w) - x) > 1) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (n >= kit.minArea) boxes.push({ x0, y0, x1, y1 });
  }
  // склейка близких рамок
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < boxes.length && !merged; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) {
          boxes[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
          boxes.splice(j, 1);
          merged = true;
          break;
        }
      }
  }
  // порядок чтения: сверху вниз рядами, в ряду слева направо
  boxes.sort((a, b) => a.y0 - b.y0);
  const rows = [];
  for (const b of boxes) {
    const row = rows.find((r) => b.y0 < r.bottom && b.y1 > r.top);
    if (row) { row.items.push(b); row.top = Math.min(row.top, b.y0); row.bottom = Math.max(row.bottom, b.y1); }
    else rows.push({ top: b.y0, bottom: b.y1, items: [b] });
  }
  return rows.flatMap((r) => r.items.sort((a, b) => a.x0 - b.x0));
}

// ---------- цвет 15 бит (5 бит на канал), как на PS1 ----------
function crush(data) {
  if (!kit.crush) return;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(Math.round((data[i + c] * 31) / 255) * 255 / 31);
    if (data[i + 3] < 8) data[i + 3] = 0;
  }
}

async function save(raw, w, h, file, size) {
  let img = sharp(raw, { raw: { width: w, height: h, channels: 4 } });
  if (size) img = img.resize(size.w, size.h, { kernel: 'lanczos3' });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  crush(data);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: kit.quality, alphaQuality: 90, effort: 6 })
    .toFile(file);
  return { w: info.width, h: info.height, kb: Math.round(fs.statSync(file).size / 1024) };
}

function crop(img, b, pad = kit.pad) {
  const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad);
  const x1 = Math.min(img.w - 1, b.x1 + pad), y1 = Math.min(img.h - 1, b.y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.data.copy(out, y * w * 4, ((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x1 + 1) * 4);
  return { data: out, w, h };
}

// Бесшовный тайл: берём кусок size+blend и последние blend пикселей плавно накладываем на первые.
function seamless(img, { x, y, size, blend }) {
  const S = size + blend;
  const src = (sx, sy) => ((y + sy) * img.w + (x + sx)) * 4;
  const tmp = Buffer.alloc(size * S * 4); // сначала по горизонтали
  for (let sy = 0; sy < S; sy++)
    for (let sx = 0; sx < size; sx++) {
      const o = (sy * size + sx) * 4;
      const t = sx < blend ? sx / blend : 1;
      for (let c = 0; c < 4; c++) {
        const a = img.data[src(sx, sy) + c];
        const b = sx < blend ? img.data[src(sx + size, sy) + c] : a;
        tmp[o + c] = Math.round(b + (a - b) * t);
      }
    }
  const out = Buffer.alloc(size * size * 4); // потом по вертикали
  for (let sy = 0; sy < size; sy++)
    for (let sx = 0; sx < size; sx++) {
      const o = (sy * size + sx) * 4;
      const t = sy < blend ? sy / blend : 1;
      for (let c = 0; c < 4; c++) {
        const a = tmp[(sy * size + sx) * 4 + c];
        const b = sy < blend ? tmp[((sy + size) * size + sx) * 4 + c] : a;
        out[o + c] = Math.round(b + (a - b) * t);
      }
    }
  return { data: out, w: size, h: size };
}

// Середина рамки: на листе она залита деревом или бархатом, а на сайте под рамкой лежит свой тайл.
// Внутри прямоугольника hole ([сверху, справа, снизу, слева] от краёв детали) убираем:
//  - mode "warm" (по умолчанию) — дерево и бархат: тёплые пиксели (доля r − b от r) и почти чёрные,
//    а серое железо шипов, заходящих внутрь, оставляем;
//  - mode "green" — остатки зелёного фона, которые свечение подкрасило в тёмно-оливковый
//    (рамка портрета «выбран»), а яркое оранжевое свечение и кость оставляем.
function cutHole(c, { rect: [t, r, b, l], mode = 'warm' }, dx, dy) {
  const pad = kit.pad;
  const x0 = l + dx + pad, x1 = c.w - (r + dx + pad), y0 = t + dy + pad, y1 = c.h - (b + dy + pad);
  const [lo, hi] = kit.hole;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * c.w + x) * 4;
      const R = c.data[i], G = c.data[i + 1], B = c.data[i + 2];
      let keep;
      if (mode === 'green') keep = R < 140 && G >= R * 0.8 ? 0 : 1;
      else {
        const warm = (R - B) / Math.max(R, 1);
        keep = R + G + B < 36 ? 0 : warm <= lo ? 1 : warm >= hi ? 0 : 1 - (warm - lo) / (hi - lo);
      }
      c.data[i + 3] = Math.round(c.data[i + 3] * keep);
    }
}

// ---------- режимы ----------
async function find() {
  fs.mkdirSync(FIND, { recursive: true });
  for (const [sheet, conf] of Object.entries(kit.sheets)) {
    if (conf.tile) continue;
    const file = path.join(SHEETS, conf.file);
    const img = await loadKeyed(file);
    const parts = findParts(img, conf.gap ?? kit.gap);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${img.w}" height="${img.h}">${parts
      .map((b, i) => `<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="none" stroke="#ff00ff" stroke-width="3"/>
        <text x="${b.x0 + 4}" y="${b.y0 + 34}" font-size="36" font-family="sans-serif" font-weight="bold" fill="#ff00ff" stroke="#000" stroke-width="1">${i}</text>`)
      .join('')}</svg>`;
    await sharp({ create: { width: img.w, height: img.h, channels: 4, background: '#1a1a1a' } })
      .composite([{ input: img.data, raw: { width: img.w, height: img.h, channels: 4 } }, { input: Buffer.from(svg) }])
      .jpeg({ quality: 80 })
      .toFile(path.join(FIND, `${sheet}.jpg`));
    console.log(sheet, parts.map((b, i) => `${i}: ${b.x0},${b.y0} ${b.x1 - b.x0 + 1}×${b.y1 - b.y0 + 1}`).join(' | '));
  }
}

async function build() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.webp')) fs.rmSync(path.join(OUT, f));
  const report = [];
  const css = [];
  let total = 0;
  for (const [sheet, conf] of Object.entries(kit.sheets)) {
    const file = path.join(SHEETS, conf.file);
    if (conf.tile) {
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const tile = seamless({ data, w: info.width, h: info.height }, conf.tile);
      const r = await save(tile.data, tile.w, tile.h, path.join(OUT, `${conf.tile.name}.webp`), { w: conf.tile.out, h: conf.tile.out });
      report.push(`${conf.tile.name}: ${r.w}×${r.h}, ${r.kb} КБ`);
      css.push(`  --ui-${conf.tile.name}: url('./${conf.tile.name}.webp');`, `  --ui-${conf.tile.name}-size: ${r.w / kit.density}px;`);
      total += r.kb;
      continue;
    }
    const img = await loadKeyed(file);
    const parts = findParts(img, conf.gap ?? kit.gap);
    // Состояния одной кнопки — холсты одного размера (по самому большому), деталь по центру:
    // тогда при смене картинки кнопка не прыгает, а свечение помещается.
    const groups = {};
    for (const p of Object.values(conf.parts))
      if (p.group) {
        const b = parts[p.n];
        const g = (groups[p.group] ??= { w: 0, h: 0 });
        g.w = Math.max(g.w, b.x1 - b.x0 + 1);
        g.h = Math.max(g.h, b.y1 - b.y0 + 1);
      }
    for (const [name, p] of Object.entries(conf.parts)) {
      let b = parts[p.n];
      if (!b) throw new Error(`${sheet}: нет детали №${p.n} для «${name}»`);
      let dx = 0, dy = 0; // сдвиг детали внутри общего холста
      if (p.group) {
        const g = groups[p.group];
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        const nb = { x0: Math.round(cx - g.w / 2), y0: Math.round(cy - g.h / 2) };
        nb.x1 = nb.x0 + g.w - 1;
        nb.y1 = nb.y0 + g.h - 1;
        dx = b.x0 - nb.x0;
        dy = b.y0 - nb.y0;
        b = nb;
      }
      const c = crop(img, b);
      if (p.hole) cutHole(c, p.hole, dx, dy);
      const scale = p.scale ?? conf.scale;
      const r = await save(c.data, c.w, c.h, path.join(OUT, `${name}.webp`), { w: Math.round(c.w * scale), h: Math.round(c.h * scale) });
      report.push(`${name}: ${r.w}×${r.h}, ${r.kb} КБ`);
      total += r.kb;
      const D = kit.density;
      css.push(`  --ui-${name}: url('./${name}.webp');`, `  --ui-${name}-size: ${+(r.w / D).toFixed(1)}px ${+(r.h / D).toFixed(1)}px;`);
      if (p.slice) {
        // нарезка рамки: сколько пикселей картинки от каждого края — неизменяемый угол/торец
        // (в исходнике, от края детали), в CSS — в пикселях готовой картинки и экрана
        const [t, rr, bb, l] = p.slice;
        const pad = kit.pad;
        const k = r.w / c.w;
        const out = [t + dy + pad, rr + dx + pad, bb + dy + pad, l + dx + pad].map((v) => Math.round(v * k));
        css.push(`  --ui-${name}-slice: ${out.join(' ')};`, `  --ui-${name}-w: ${out.map((v) => +(v / D).toFixed(1) + 'px').join(' ')};`);
      }
    }
  }
  fs.writeFileSync(
    path.join(OUT, 'kit.css'),
    `/* Собрано tools/ui/slice.mjs из листов ui-src/kit/1-sheets — не править руками.\n   --ui-<имя> — картинка, -size — её размер на экране, -slice / -w — нарезка рамки (border-image). */\n:root {\n${css.join('\n')}\n}\n`,
  );
  console.log(report.join('\n'));
  console.log(`всего: ${total} КБ`);
}

if (process.argv.includes('--find')) await find();
else await build();
