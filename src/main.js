// Точка входа: собирает сцену, камеру, PS1-эффект и запускает отрисовку.
// Шрифт интерфейса — Inter, лежит в самом сайте (без загрузки с чужих серверов): полужирный и жирный.
import '@fontsource/inter/cyrillic-600.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/cyrillic-700.css';
import '@fontsource/inter/latin-700.css';
import * as THREE from 'three';
import {
  room,
  furniture,
  ps1,
  ui,
  characters as characterData,
  animations,
  characterActions,
  social,
  panels as panelTexts,
  welcome,
  dossier,
  radio as radioData,
  lighting,
} from './data.js';
import { typoDeep } from './typo.js';
import { buildRoom } from './room.js';
import { createGrid, createDebugOverlay } from './grid.js';
import { applyPS1, ps1Uniforms, PS1Pass, setOutlined } from './ps1.js';
import { loadModel, Character, createSelectionRing } from './characters.js';
import { renderPortrait } from './portraits.js';
import { createUI } from './ui.js';
import { createRadialMenu } from './menu.js';
import { createPanels } from './panels.js';
import { performAction, performSocial, freeSpot } from './actions.js';
import { createBanners } from './banner.js';
import { showWelcome } from './welcome.js';
import { createRadio } from './radio.js';

// Короткие слова во всех текстах приклеиваем к следующему слову (см. typo.js).
typoDeep([ui, characterData, characterActions, social, panelTexts, furniture, welcome, dossier, radioData]);

// ---------- Настройки вида (не контент, поэтому здесь, а не в data.js) ----------
const CAMERA_ELEVATION = 30; // наклон камеры, градусы (0 — сбоку, 90 — сверху)
const CAMERA_AZIMUTH = 45; // поворот вокруг комнаты, градусы
const CAMERA_DISTANCE = 20;
// Доля экрана, которую оставляем свободной под интерфейс (портреты слева, панель снизу).
const SCREEN_MARGINS = { left: 0.11, right: 0.04, top: 0.05, bottom: 0.24 };
// Крупный план предмета на стене (плакат): интерфейс спрятан, снизу — только кнопки.
const CLOSEUP_MARGINS = { left: 0.06, right: 0.06, top: 0.07, bottom: 0.17 };
const CLOSEUP_TIME = 0.9; // сколько секунд камера едет к стене и обратно
// Телефон (узкий экран, та же граница, что в style.css): комната крупнее — целиком
// влезает по высоте, а по бокам немного обрезается. MOBILE_ZOOM — во сколько раз
// комната шире экрана (с комнатой 6×5 при 1.1 обрезаются только край шкафа и угол стола).
const MOBILE = window.matchMedia('(max-width: 640px)');
const MOBILE_ZOOM = 1.1;

// ---------- Рендерер ----------
// Сглаживание краёв делает сам проход PS1Pass (в режиме без PS1), поэтому здесь оно не нужно.
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app').appendChild(renderer.domElement);

// ---------- Сцена ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(ps1.fogColor);
scene.fog = new THREE.FogExp2(ps1.fogColor, ps1.fogStrength);

const built = buildRoom(room, furniture, lighting?.baked);
applyPS1(built.group);
scene.add(built.group);

// Свет: мягкий общий + направленный «из окна-за-кадром» + торшер (внутри комнаты).
// Если в data.js есть lighting (особняк, этап 14) — полумрак: слабый общий свет и холодный из окна.
if (lighting) {
  const { ambient, moon } = lighting;
  scene.add(new THREE.HemisphereLight(ambient.sky, ambient.ground, ambient.intensity));
  const moonLight = new THREE.DirectionalLight(moon.color, moon.intensity);
  moonLight.position.set(...moon.from);
  moonLight.target.position.set(room.columns / 2, 0, room.rows / 2);
  scene.add(moonLight, moonLight.target);
} else {
  scene.add(new THREE.HemisphereLight('#fff1dc', '#4a3b55', 2.2));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.0);
  sun.position.set(8, 10, 6);
  scene.add(sun);
}

// ---------- Камера ----------
// Ближняя и дальняя границы с запасом вокруг комнаты (камера в 20 клетках от центра).
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

// «Кадр» камеры: куда смотрит (center), с какой стороны (quat) и какая рамка вокруг
// центра (frame: left/right/top/bottom в мировых единицах). Между кадрами камера едет плавно.
// Рамка подбирается так, чтобы точки corners целиком влезли в свободную часть экрана.
// zoom > 1 — кадр крупнее: по высоте всё влезает, по ширине может обрезаться.
function makeShot(center, quat, corners, margins, aspect, zoom = 1) {
  const inv = quat.clone().invert();
  const v = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of corners) {
    v.copy(c).sub(center).applyQuaternion(inv);
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  const m = margins;
  const uw = 1 - m.left - m.right;
  const uh = 1 - m.top - m.bottom;
  const F = Math.max((maxY - minY) / uh, (maxX - minX) / (aspect * uw) / zoom); // высота кадра в мировых единицах
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const left = cx - (m.left + uw / 2) * aspect * F;
  const bottom = cy - (m.bottom + uh / 2) * F;
  return { center: center.clone(), quat: quat.clone(), frame: { left, right: left + aspect * F, bottom, top: bottom + F } };
}

function boxCorners(box) {
  const out = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

// Вся комната целиком (обычный вид).
const roomQuat = camera.quaternion.clone();
const roomBox = new THREE.Box3(new THREE.Vector3(-0.15, -0.3, -0.15), new THREE.Vector3(room.columns + 0.15, room.wallHeight, room.rows + 0.15));
function roomShot(aspect) {
  if (!MOBILE.matches) return makeShot(target, roomQuat, boxCorners(roomBox), SCREEN_MARGINS, aspect);
  // На телефоне свободная часть экрана — между портретами сверху и панелью снизу.
  const h = window.innerHeight;
  const top = document.querySelector('.portraits')?.getBoundingClientRect().bottom ?? 0;
  const hud = document.querySelector('.hud')?.getBoundingClientRect().height ?? h * 0.35;
  const margins = { left: 0, right: 0, top: (top + 8) / h, bottom: (hud + 18) / h };
  return makeShot(target, roomQuat, boxCorners(roomBox), margins, aspect, MOBILE_ZOOM);
}

// Предмет на стене прямо перед камерой: камера смотрит перпендикулярно стене.
function closeUpShot(item, aspect) {
  const obj = built.objects[item.id];
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const normal = item.wall === 'west' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const eye = center.clone().addScaledVector(normal, CAMERA_DISTANCE);
  const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, center, camera.up));
  return makeShot(center, quat, boxCorners(box), CLOSEUP_MARGINS, aspect);
}

// Куда едет камера: from → to, t — сколько секунд прошло.
const cam = { from: null, to: null, t: CLOSEUP_TIME, closeUp: null /* предмет крупным планом */ };
function currentAspect() {
  return pass.lowW / pass.lowH;
}
function refreshShots() {
  const aspect = currentAspect();
  const target = cam.closeUp ? closeUpShot(cam.closeUp, aspect) : roomShot(aspect);
  if (!cam.to || cam.t >= CLOSEUP_TIME) cam.from = target; // не в пути — просто встать в кадр
  cam.to = target;
}

const camPos = new THREE.Vector3();
function placeCamera(time) {
  const k = cam.from === cam.to ? 1 : smooth(Math.min(1, cam.t / CLOSEUP_TIME));
  const a = cam.from, b = cam.to;
  camera.quaternion.slerpQuaternions(a.quat, b.quat, k);
  camPos.lerpVectors(a.center, b.center, k);
  camera.position.copy(camPos).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion), CAMERA_DISTANCE);
  for (const side of ['left', 'right', 'top', 'bottom']) camera[side] = a.frame[side] + (b.frame[side] - a.frame[side]) * k;
  camera.updateProjectionMatrix();
  if (ps1.cameraSway) {
    // Едва заметное покачивание: из-за него видно, как «дрожат» вершины.
    camera.position.addScaledVector(camRight.set(1, 0, 0).applyQuaternion(camera.quaternion), Math.sin(time * 0.7) * 0.04);
    camera.position.addScaledVector(camUp.set(0, 1, 0).applyQuaternion(camera.quaternion), Math.sin(time * 0.53 + 1) * 0.03);
  }
  camera.updateMatrixWorld();
  return k;
}
const smooth = (x) => x * x * (3 - 2 * x);

// ---------- PS1 ----------
const pass = new PS1Pass();
pass.setPalette(ps1.colorLevels, ps1.dither, ps1.vignette ?? 0);
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
  refreshShots();
  placeCamera(performance.now() / 1000);
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
  ps1Uniforms.uSnapOn.value = on && ps1.vertexSnap > 0 ? 1 : 0; // vertexSnap: 0 — без дрожания
  pass.setMode(on);
  ps1Button.textContent = on ? ui.ps1On : ui.ps1Off;
  ps1Button.classList.toggle('off', !on);
  resize();
}
ps1Button.addEventListener('click', () => setPS1(!ps1On));

document.title = ui.pageTitle;
const debugHint = document.getElementById('debug-hint');
debugHint.textContent = ui.gridHint;
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

// Радио — первым в правом верхнем углу, над кнопками PS1 и сетки.
const corner = document.getElementById('corner');
const radio = createRadio(corner, radioData);
// Письмо и баннер встают под угол с кнопками — его высота меняется, когда радио раскрывается.
function updateCornerBottom() {
  document.documentElement.style.setProperty('--corner-bottom', `${Math.round(corner.getBoundingClientRect().bottom)}px`);
}
updateCornerBottom();
window.addEventListener('resize', updateCornerBottom);
new ResizeObserver(updateCornerBottom).observe(corner);

// ---------- Персонажи и выбор ----------
const characters = [];
let selected = null; // кем сейчас управляем
const ring = createSelectionRing();

const portraits = {}; // id персонажа → картинка портрета
const occupancy = new Map(); // занятые места: 'chair' → персонаж

const hud = createUI({
  characters: characterData,
  texts: ui,
  dossier,
  onSelect: (id) => select(id),
  onCancel: () => {
    if (!selected) return;
    if (selected.task) selected.cancelTask();
    else if (selected.isWalking) selected.stop();
  },
});
resize(); // на телефоне кадр зависит от высоты нижней панели — она только что появилась
const uiRoot = document.getElementById('ui');
const menu = createRadialMenu(uiRoot, ui);
const panels = createPanels(uiRoot, { panels: panelTexts, ui, getPortrait: (id) => portraits[id] });
const banners = createBanners(uiRoot, ui);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') menu.close();
});

// Куда «смотрит зритель»: к нему персонаж поворачивается, чтобы помахать.
const cameraYaw = Math.atan2(camDir.x, camDir.z);

function startAction(actor, action, extra) {
  performAction({ actor, action, furniture, occupancy, panels, cameraYaw, ...extra });
}

function startSocial(actor, target, action, choice) {
  performSocial({
    actor, target, action, choice, grid, banners, getPortrait: (id) => portraits[id], duration: social.duration,
  });
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
    // Письмо появляется, когда комната с персонажами уже на экране.
    showWelcome(uiRoot, welcome, ui);
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
  mouse.inside = e.pointerType === 'mouse'; // от пальца обводка не остаётся висеть
});
canvas.addEventListener('pointerleave', () => (mouse.inside = false));
canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // правый клик не открывает меню браузера

let hovered = null; // объект, который сейчас обведён
function updateHover() {
  if (menu.isOpen) return; // пока открыто меню, обведён предмет, для которого оно открыто
  const busyCamera = cam.closeUp || cam.t < CLOSEUP_TIME; // крупным планом ничего не обводим
  const target = mouse.inside && !busyCamera ? pick(mouse.x, mouse.y) : null;
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
  if (e.button !== 0) return;
  // Крупный план: клик мимо предмета возвращает в комнату.
  if (cam.closeUp) {
    const hit = pick(e.clientX, e.clientY);
    if (hit?.id !== cam.closeUp.id) closeCloseUp();
    return;
  }
  if (cam.t < CLOSEUP_TIME || !selected) return; // камера ещё едет
  const target = pick(e.clientX, e.clientY);
  if (!target) return;

  // Персонаж: уже выбранный — меню «помахать / о себе»;
  // второй — меню взаимодействий (поговорить, пощекотать… и «выбрать»).
  if (target.type === 'character') {
    const ch = target.character;
    const actor = selected;
    if (ch !== actor) {
      openMenu(e, social.actions, (action) => {
        if (action.select) select(ch.id);
        else if (action.who === 'target') startAction(ch, action, { target: ch });
        else if (action.choices) openMenu(e, action.choices, (choice) => startSocial(actor, ch, action, choice));
        else startSocial(actor, ch, action);
      });
      return;
    }
    openMenu(e, characterActions, (action) => {
      startAction(action.who === 'target' ? ch : actor, action, { target: ch });
    });
    return;
  }

  // Интерактивный предмет: меню его действий. Занятое место — «Занято».
  if (target.type === 'object') {
    const item = furniture.find((f) => f.id === target.id);
    const actor = selected;
    if (item.closeUp) {
      openCloseUp(item);
      return;
    }
    const items = item.actions.map((a) => ({ ...a, disabled: !freeSpot(a, item, occupancy, actor) }));
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

// ---------- Крупный план предмета на стене (плакат) ----------
// Камера подъезжает и смотрит на стену прямо, интерфейс прячется,
// снизу — кнопка-ссылка из data.js (closeUp.button, closeUp.url) и «назад».
const closeUpBar = document.createElement('div');
closeUpBar.className = 'closeup-bar';
const closeUpLink = document.createElement('a');
closeUpLink.className = 'pill closeup-link';
closeUpLink.target = '_blank';
closeUpLink.rel = 'noopener noreferrer';
const closeUpBack = document.createElement('button');
closeUpBack.type = 'button';
closeUpBack.className = 'pill closeup-back';
closeUpBack.textContent = ui.back;
closeUpBack.addEventListener('click', () => closeCloseUp());
closeUpBar.append(closeUpBack, closeUpLink);
uiRoot.appendChild(closeUpBar);

function moveCamera(closeUp) {
  menu.close();
  cam.closeUp = closeUp;
  // Ехать от того места, где камера сейчас (даже если она ещё в пути).
  cam.from = {
    center: camPos.clone(),
    quat: camera.quaternion.clone(),
    frame: { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom },
  };
  cam.to = closeUp ? closeUpShot(closeUp, currentAspect()) : roomShot(currentAspect());
  cam.t = 0;
  document.body.classList.toggle('closeup', Boolean(closeUp));
}
function openCloseUp(item) {
  closeUpLink.href = item.closeUp.url;
  closeUpLink.textContent = item.closeUp.button;
  closeUpLink.hidden = !item.closeUp.url;
  moveCamera(item);
}
function closeCloseUp() {
  if (cam.closeUp) moveCamera(null);
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCloseUp();
});

// ---------- Цикл отрисовки ----------
let last = performance.now();
// Мерцание ламп (этап 14): живой свет и ореолы чуть дрожат, изредка лампа «моргает».
// Запечённый на стенах свет не мерцает — как в играх того времени.
function flickerLamps(t) {
  const amp = lighting?.flicker ?? 0;
  built.lights.forEach((light, i) => {
    const base = light.userData.base;
    if (base === undefined) return;
    const p = i * 17.3;
    let k = 1 + amp * (Math.sin(t * 7.1 + p) * 0.5 + Math.sin(t * 13.7 + p * 2) * 0.3 + Math.sin(t * 29.3 + p) * 0.2);
    if (amp && Math.sin(t * 0.37 + p) > 0.995) k *= 0.55; // редкое «моргание»
    light.intensity = base * k;
    const h = light.userData.halo;
    if (h) h.material.opacity = Math.min(1, 0.85 * k);
  });
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000); // не больше 0.1 с, если вкладка «спала»
  last = now;
  const t = now / 1000; // секунды с открытия страницы

  for (const ch of characters) ch.update(dt);
  flickerLamps(t);
  if (debug.visible && selected) debug.setPath([selected.position, ...selected.path]);
  cam.t += dt;
  const k = placeCamera(t);
  // Крупным планом персонажи не загораживают плакат: пока камера у стены, их не видно.
  const atWall = cam.closeUp ? k > 0.5 : k < 0.5;
  for (const ch of characters) ch.root.visible = !atWall;

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

// Только при разработке (npm run dev): доступ ко всему из консоли браузера для проверок.
if (import.meta.env.DEV) {
  window.__app = {
    scene, camera, grid, debug, setPS1, toScreen, ps1Uniforms, characters, select, pick, occupancy, menu,
    renderer, pass, basePos, built, loadModel, renderPortrait, cam, openCloseUp, closeCloseUp, furniture, radio,
    get selected() {
      return selected;
    },
    // Выгрузить комнату (без персонажей) и лампы для запекания света:
    // models-src/bake/scene.glb и lights.json, дальше — tools/blender/bake.py.
    async exportForBake() {
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      built.group.updateMatrixWorld(true);
      const glb = await new GLTFExporter().parseAsync(built.group, { binary: true, onlyVisible: false });
      const lamps = built.lights.map((l) => ({
        position: l.getWorldPosition(new THREE.Vector3()).toArray(),
        color: `#${l.color.getHexString()}`,
        intensity: l.userData.base ?? l.intensity, // без мерцания
        distance: l.distance,
      }));
      const info = { room, lighting, lamps, furniture };
      const post = (name, body) => fetch(`/__bake/${name}`, { method: 'POST', body });
      await post('scene.glb', glb);
      await post('lights.json', JSON.stringify(info, null, 2));
      return { lamps: lamps.length, bytes: glb.byteLength };
    },
  };
}
