// Предметы, которые персонаж держит в руках: книга с полки и ноутбук.
// Как и мебель, собраны из коробок; размеры — в клетках (1 = клетка).
import * as THREE from 'three';
import * as tex from './textures.js';

const lambert = (opts) => new THREE.MeshLambertMaterial({ flatShading: true, ...opts });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// Книга: обложка и светлый срез страниц. Центр книги — в нуле, корешок слева.
export function buildBook(color = '#2f5d8a') {
  const g = new THREE.Group();
  const W = 0.2, H = 0.27, T = 0.05;
  const cover = lambert({ color });
  g.add(box(W, H, 0.008, cover, 0, 0, T / 2 - 0.004));
  g.add(box(W, H, 0.008, cover, 0, 0, -T / 2 + 0.004));
  g.add(box(0.01, H, T, cover, -W / 2 + 0.005, 0, 0));
  g.add(box(W - 0.012, H - 0.012, T - 0.012, lambert({ color: '#f1ead8' }), 0.004, 0, 0));
  return g;
}

// Ноутбук. Центр низа — в нуле, экран — у задней кромки (−Z), клавиатура — к +Z.
// Крышка (userData.lid) открывается поворотом: 0 — закрыта, ~−1.9 — открыта.
let screenTexture = null;
export function buildLaptop() {
  const g = new THREE.Group();
  const W = 0.34, D = 0.23, T = 0.014;
  const silver = lambert({ color: '#c6cad1' });
  g.add(box(W, T, D, silver, 0, T / 2, 0));
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, 0.09), lambert({ color: '#2e2f35' }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, T + 0.0005, -0.025);
  g.add(keys);
  const lid = new THREE.Group();
  lid.position.set(0, T, -D / 2);
  lid.add(box(W, 0.008, D, silver, 0, 0.004, D / 2)); // в закрытом виде лежит на клавиатуре
  screenTexture ||= tex.screen(40, 27);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, D - 0.03), new THREE.MeshBasicMaterial({ map: screenTexture }));
  scr.rotation.x = Math.PI / 2; // смотрит вниз, на клавиатуру; при открытии повернётся к персонажу
  scr.position.set(0, -0.0005, D / 2);
  lid.add(scr);
  g.add(lid);
  g.userData.lid = lid;
  return g;
}
