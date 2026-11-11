// Точка входа: собирает сцену, камеру, PS1-эффект и запускает отрисовку.
import * as THREE from 'three';
import {
  room,
  furniture,
  ps1,
  ui,
  characters as characterData,
  animations,
  characterActions,
  panels as panelTexts,
} from './data.js';
import { buildRoom } from './room.js';
import { createGrid, createDebugOverlay } from './grid.js';
import { applyPS1, ps1Uniforms, PS1Pass, setOutlined } from './ps1.js';
import { loadModel, Character, createSelectionRing } from './characters.js';
import { renderPortrait } from './portraits.js';
import { createUI } from './ui.js';
import { createRadialMenu } from './menu.js';
import { createPanels } from './panels.js';
import { performAction } from './actions.js';

// ---------- Настройки вида (не контент, поэтому здесь, а не в data.js) ----------
const CAMERA_ELEVATION = 30; // наклон камеры, градусы (0 — сбоку, 90 — сверху)
const CAMERA_AZIMUTH = 45; // поворот вокруг комнаты, градусы
const CAMERA_DISTANCE = 20;
// Доля экрана, которую оставляем свободной под интерфейс (портреты слева, панель снизу).
const SCREEN_MARGINS = { left: 0.11, right: 0.04, top: 0.05, bottom: 0.24 };

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
// Ближняя и дальняя границы — поуже: так точнее понятно, что ближе к камере (ковёр не мигает).
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 4, 40);
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
  // Без PS1 картинка рисуется в полном разрешении (масштаб 1).
  pass.setSize(W, H, ps1On ? ps1.renderHeight : H);
  const aspect = pass.lowW / pass.lowH;
  view.width = (pass.lowW * pass.scale) / dpr;
  view.height = (pass.lowH * pass.scale) / dpr;
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
  pass.setMode(on);
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

// ---------- Персонажи и выбор ----------
const characters = [];
let selected = null; // кем сейчас управляем
const ring = createSelectionRing();

const portraits = {}; // id персонажа → картинка портрета
const occupancy = new Map(); // занятые места: 'chair' → персонаж

const hud = createUI({
  characters: characterData,
  texts: ui,
  onSelect: (id) => select(id),
  onCancel: () => {
    if (!selected) return;
    if (selected.task) selected.cancelTask();
    else if (selected.isWalking) selected.stop();
  },
});
const uiRoot = document.getElementById('ui');
const menu = createRadialMenu(uiRoot, ui);
const panels = createPanels(uiRoot, { panels: panelTexts, ui, getPortrait: (id) => portraits[id] });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') menu.close();
});

// Куда «смотрит зритель»: к нему персонаж поворачивается, чтобы помахать.
const cameraYaw = Math.atan2(camDir.x, camDir.z);

function startAction(actor, action, extra) {
  performAction({ actor, action, furniture, occupancy, panels, cameraYaw, ...extra });
}

function select(id) {
  const ch = characters.find((c) => c.id === id);
  if (!ch || ch === selected) return;
  selected = ch;
  ch.root.add(ring.group);
  ring.setColor(ch.data.color);
  hud.setSelected(ch.data);
}

Promise.all(characterData.map((data) => loadModel(data.model)))
  .then((models) => {
    characterData.forEach((data, i) => {
      const ch = new Character(data, models[i], grid, animations);
      characters.push(ch);
      scene.add(ch.root);
      portraits[data.id] = renderPortrait(renderer, models[i]);
      hud.setPortrait(data.id, portraits[data.id]);
    });
    select(characters[0].id);
  })
  .catch((err) => console.error('Модель персонажа не загрузилась (проверьте поле model в data.js):', err));

// ---------- Мышь: наведение и клики ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

// Что под курсором: персонаж, интерактивный предмет или просто пол/мебель/стена.
function pick(clientX, clientY) {
  ndc.set((clientX / view.width) * 2 - 1, ((window.innerHeight - clientY) / view.height) * 2 - 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects([built.group, ...characters.map((c) => c.root)], true)[0];
  if (!hit) return null;
  for (let o = hit.object; o; o = o.parent) {
    if (o.userData.characterId) {
      const ch = characters.find((c) => c.id === o.userData.characterId);
      return { type: 'character', character: ch, object: ch.model, point: hit.point };
    }
    if (o.userData.furnitureId && o.userData.interactive) {
      return { type: 'object', id: o.userData.furnitureId, object: o, point: hit.point };
    }
  }
  return { type: 'floor', point: hit.point };
}

const canvas = renderer.domElement;
const mouse = { x: 0, y: 0, inside: false };
canvas.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.inside = true;
});
canvas.addEventListener('pointerleave', () => (mouse.inside = false));

let hovered = null; // объект, который сейчас обведён
function updateHover() {
  if (menu.isOpen) return; // пока открыто меню, обведён предмет, для которого оно открыто
  const target = mouse.inside ? pick(mouse.x, mouse.y) : null;
  const obj = target && target.type !== 'floor' ? target.object : null;
  if (obj === hovered) return;
  if (hovered) setOutlined(hovered, false);
  if (obj) setOutlined(obj, true);
  hovered = obj;
  canvas.style.cursor = obj ? 'pointer' : 'default';
}

// Открыть радиальное меню у курсора.
function openMenu(e, items, onPick) {
  menu.open({
    x: e.clientX,
    y: e.clientY,
    portrait: portraits[selected.id],
    accent: selected.data.color,
    items,
    onPick,
    onClose: () => updateHover(),
  });
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !selected) return;
  const target = pick(e.clientX, e.clientY);
  if (!target) return;

  // Персонаж: чужой — выбрать; уже выбранный — меню «Помахать / О себе».
  if (target.type === 'character') {
    const ch = target.character;
    if (ch !== selected) {
      select(ch.id);
      return;
    }
    openMenu(e, characterActions, (action) => {
      const actor = action.who === 'target' ? ch : selected;
      startAction(actor, action, { target: ch });
    });
    return;
  }

  // Интерактивный предмет: меню его действий. Занятое место — «Занято».
  if (target.type === 'object') {
    const item = furniture.find((f) => f.id === target.id);
    const actor = selected;
    const items = item.actions.map((a) => {
      const key = a.occupies ? a.sitOn || item.id : null;
      const holder = key && occupancy.get(key);
      return { ...a, disabled: Boolean(holder && holder !== actor) };
    });
    openMenu(e, items, (action) => startAction(actor, action, { item }));
    return;
  }

  // Пол, мебель, стена: идём в клетку под точкой клика.
  // Если персонаж чем-то занят — сначала прерываем (он встанет), потом идёт.
  const c = THREE.MathUtils.clamp(Math.floor(target.point.x), 0, room.columns - 1);
  const r = THREE.MathUtils.clamp(Math.floor(target.point.z), 0, room.rows - 1);
  const actor = selected;
  if (actor.task) actor.cancelTask().then(() => actor.walkTo(c, r));
  else actor.walkTo(c, r);
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

  ring.update(t);
  if (selected) ring.followFloor(selected.position.y);
  updateHover();
  if (selected) hud.setActivity(selected.activity || (selected.isWalking ? { icon: '🚶', label: ui.walking } : null));

  const hoveredIsCharacter = Boolean(hovered?.userData.characterId);
  pass.render(renderer, scene, camera, Boolean(hovered), hoveredIsCharacter ? ps1.characterSnap : 1);

  debug.updateLabels(toScreen);
  requestAnimationFrame(frame);
}
frame();

// Для проверки из консоли браузера.
window.__app = {
  scene, camera, grid, debug, setPS1, toScreen, ps1Uniforms, characters, select, pick, occupancy, menu,
  renderer, pass, basePos, camRight, camUp, built, loadModel, renderPortrait,
};
