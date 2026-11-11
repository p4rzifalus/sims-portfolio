// Убирает предметы из рук модели Kenney (костыли у character-female-a).
// Предметы — отдельные куски геометрии на костях рук. Их треугольники
// «схлопываются» в точку: файл остаётся того же размера и устройства.
// Запуск: node tools/remove-hand-props.mjs public/models/people/character-female-a.glb
import fs from 'fs';

const file = process.argv[2];
const PROP_SIZES = new Set([32, 36, 40, 56]); // число вершин у кусков-предметов (измерено)

const buf = fs.readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;

function view(accIndex) {
  const acc = json.accessors[accIndex];
  const bv = json.bufferViews[acc.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
  const size = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType];
  const offset = binStart + (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride || comps * size;
  const read = { 5121: 'readUInt8', 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' }[acc.componentType];
  const write = { 5123: 'writeUInt16LE', 5125: 'writeUInt32LE' }[acc.componentType];
  return {
    count: acc.count,
    get: (i, c = 0) => buf[read](offset + i * stride + c * size),
    set: (i, v) => buf[write](v, offset + i * stride),
  };
}

const meshIndex = json.meshes.findIndex((m) => m.name === 'body-mesh');
const node = json.nodes.find((n) => n.mesh === meshIndex);
const jointNames = json.skins[node.skin].joints.map((j) => json.nodes[j].name);
let removedTris = 0, removedParts = 0;

for (const prim of json.meshes[meshIndex].primitives) {
  const pos = view(prim.attributes.POSITION);
  const joints = view(prim.attributes.JOINTS_0);
  const idx = view(prim.indices);

  // Склеиваем вершины с одинаковым положением и находим связные куски.
  const parent = Array.from({ length: pos.count }, (_, i) => i);
  const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const union = (a, b) => (parent[find(a)] = find(b));
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = [0, 1, 2].map((c) => pos.get(i, c).toFixed(4)).join();
    if (seen.has(k)) union(i, seen.get(k));
    else seen.set(k, i);
  }
  for (let t = 0; t < idx.count; t += 3) {
    union(idx.get(t), idx.get(t + 1));
    union(idx.get(t), idx.get(t + 2));
  }
  const parts = new Map();
  for (let i = 0; i < pos.count; i++) {
    const r = find(i);
    if (!parts.has(r)) parts.set(r, []);
    parts.get(r).push(i);
  }

  const propVerts = new Set();
  for (const verts of parts.values()) {
    const bone = jointNames[joints.get(verts[0], 0)];
    if (bone.startsWith('arm') && PROP_SIZES.has(verts.length)) {
      verts.forEach((v) => propVerts.add(v));
      removedParts++;
    }
  }
  if (removedParts !== 8) throw new Error(`Ожидалось 8 кусков-предметов (по 4 на руку), найдено ${removedParts}. Файл не изменён.`);

  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.get(t);
    if (propVerts.has(a)) {
      idx.set(t + 1, a);
      idx.set(t + 2, a);
      removedTris++;
    }
  }
}

fs.writeFileSync(file, buf);
console.log(`Готово: убрано кусков ${removedParts}, треугольников ${removedTris}.`);
