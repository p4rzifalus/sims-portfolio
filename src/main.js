// Точка входа: собирает сцену, камеру, PS1-эффект и запускает отрисовку.
import * as THREE from 'three';
import { room, furniture, ps1, ui, characters as characterData, animations } from './data.js';
import { buildRoom } from './room.js';
import { createGrid, createDebugOverlay } from './grid.js';
import { applyPS1, ps1Uniforms, PS1Pass } from './ps1.js';
import { loadModel, Character } from './characters.js';

// ---------- Настройки вида (не контент, поэтому здесь, а не в data.js) ----------
const CAMERA_ELEVATION = 30; // наклон камеры, градусы (0 — сбоку, 90 — сверху)
const CAMERA_AZIMUTH = 45; // поворот вокруг комнаты, градусы
const CAMERA_DISTANCE = 20;
// Доля экрана, которую оставляем свободной под интерфейс (портреты слева, панель снизу).
const SCREEN_MARGINS = { left: 0.1, right: 0.04, top: 0.05, bottom: 0.2 };

// ---------- Рендерер ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app').appendChild(renderer.domElement);

// ---------- Сцена ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(ps1.fogColor);
scene.fog = new THREE.FogExp2(ps1.fogColor, ps1.fogStrength);

const built = buildRoom(room, furniture);
applyPS1(built.group);
scene.add(built.group);

// Свет: мягкий общий + направленный «из окна-за-кадром» + торшер (внутри комнаты).
scene.add(new THREE.HemisphereLight('#fff1dc', '#4a3b55', 2.2));
const sun = new THREE.DirectionalLight('#fff4e0', 2.0);
sun.position.set(8, 10, 6);
scene.add(sun);

// ---------- Камера ----------
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const target = new THREE.Vector3(room.columns / 2, 0.8, room.rows / 2);
const el = THREE.MathUtils.degToRad(CAMERA_ELEVATION);
const az = THREE.MathUtils.degToRad(CAMERA_AZIMUTH);
const camDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
const basePos = target.clone().addScaledVector(camDir, CAMERA_DISTANCE);
camera.position.copy(basePos);
camera.lookAt(target);
camera.updateMatrixWorld();
const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);

// Подобрать рамку камеры так, чтобы комната целиком влезла в свободную часть экрана.
function fitCamera(aspect) {
  const inv = camera.matrixWorldInverse;
  const v = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const x of [-0.15, room.columns + 0.15]) {
    for (const y of [-0.3, room.wallHeight]) {
      for (const z of [-0.15, room.rows + 0.15]) {
        v.set(x, y, z).applyMatrix4(inv);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }
    }
  }
  const m = SCREEN_MARGINS;
  const uw = 1 - m.left - m.right;
  const uh = 1 - m.top - m.bottom;
  const F = Math.max((maxY - minY) / uh, (maxX - minX) / (aspect * uw)); // высота кадра в мировых единицах
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  camera.left = cx - (m.left + uw / 2) * aspect * F;
  camera.right = camera.left + aspect * F;
  camera.bottom = cy - (m.bottom + uh / 2) * F;
  camera.top = camera.bottom + F;
  camera.updateProjectionMatrix();
}

// ---------- PS1 ----------
const pass = new PS1Pass();
pass.setPalette(ps1.colorLevels, ps1.dither);
let ps1On = ps1.enabledAtStart;

// Размер области, на которую растянута картинка (в CSS-пикселях).
// В режиме PS1 она может быть на пару пикселей больше окна — это учитываем
// при переводе координат мыши и подписей.
const view = { width: 1, height: 1 };

function resize() {
  // Пока вкладка скрыта, у окна может не быть размера — ждём настоящего.
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  renderer.setSize(w, h);
  const W = renderer.domElement.width, H = renderer.domElement.height;
  const dpr = renderer.getPixelRatio();
  let aspect = w / h;
  if (ps1On) {
    pass.setSize(W, H, ps1.renderHeight);
    aspect = pass.lowW / pass.lowH;
    view.width = (pass.lowW * pass.scale) / dpr;
    view.height = (pass.lowH * pass.scale) / dpr;
  } else {
    view.width = w;
    view.height = h;
  }
  ps1Uniforms.uSnapRes.value.set((ps1.vertexSnap * aspect) / 2, ps1.vertexSnap / 2);
  fitCamera(aspect);
}

// Точка в мире → координаты на экране (CSS-пиксели от левого верхнего угла).
const tmp = new THREE.Vector3();
function toScreen(pos) {
  tmp.copy(pos).project(camera);
  return {
    x: ((tmp.x + 1) / 2) * view.width,
    y: window.innerHeight - ((tmp.y + 1) / 2) * view.height,
  };
}

// ---------- Отладка ----------
const grid = createGrid(room, furniture);
const debug = createDebugOverlay(grid, document.getElementById('debug-labels'));
scene.add(debug.group);
debug.setVisible(false);

// ---------- Интерфейс ----------
const ps1Button = document.getElementById('ps1-toggle');
function setPS1(on) {
  ps1On = on;
  ps1Uniforms.uSnapOn.value = on ? 1 : 0;
  ps1Button.textContent = on ? ui.ps1On : ui.ps1Off;
  ps1Button.classList.toggle('off', !on);
  resize();
}
ps1Button.addEventListener('click', () => setPS1(!ps1On));

const debugHint = document.getElementById('debug-hint');
function toggleDebug() {
  debug.toggle();
  debugHint.classList.toggle('active', debug.visible);
}
debugHint.addEventListener('click', toggleDebug);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyG' && !e.repeat) toggleDebug();
});

window.addEventListener('resize', resize);
setPS1(ps1On);

// ---------- Персонажи ----------
const characters = [];
let selected = null; // кем сейчас управляем (выбор появится на этапе 3)

Promise.all(characterData.map((data) => loadModel(data.model)))
  .then((models) => {
    characterData.forEach((data, i) => {
      const ch = new Character(data, models[i], grid, animations);
      characters.push(ch);
      scene.add(ch.root);
    });
    selected = characters[0];
  })
  .catch((err) => console.error('Модель персонажа не загрузилась (проверьте поле model в data.js):', err));

// ---------- Клик по полу ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

// Координаты мыши → точка в 3D, куда указывает курсор.
function pick(clientX, clientY, objects) {
  ndc.set((clientX / view.width) * 2 - 1, ((window.innerHeight - clientY) / view.height) * 2 - 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(objects, true)[0] || null;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !selected) return;
  const hit = pick(e.clientX, e.clientY, [built.group]);
  if (!hit) return;
  // Куда бы ни попал клик (пол, мебель, стена) — берём клетку под этой точкой.
  const c = THREE.MathUtils.clamp(Math.floor(hit.point.x), 0, room.columns - 1);
  const r = THREE.MathUtils.clamp(Math.floor(hit.point.z), 0, room.rows - 1);
  selected.walkTo(c, r);
});

// ---------- Цикл отрисовки ----------
let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000); // не больше 0.1 с, если вкладка «спала»
  last = now;
  const t = now / 1000; // секунды с открытия страницы

  for (const ch of characters) ch.update(dt);
  if (debug.visible && selected) debug.setPath([selected.position, ...selected.path]);
  camera.position.copy(basePos);
  if (ps1.cameraSway) {
    // Едва заметное покачивание: из-за него видно, как «дрожат» вершины.
    camera.position.addScaledVector(camRight, Math.sin(t * 0.7) * 0.04);
    camera.position.addScaledVector(camUp, Math.sin(t * 0.53 + 1) * 0.03);
  }
  camera.updateMatrixWorld();

  if (ps1On) pass.render(renderer, scene, camera);
  else renderer.render(scene, camera);

  debug.updateLabels(toScreen);
  requestAnimationFrame(frame);
}
frame();

// Для проверки из консоли браузера.
window.__app = { scene, camera, grid, debug, setPS1, toScreen, ps1Uniforms, characters };
