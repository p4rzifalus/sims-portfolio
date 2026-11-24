// Персонажи и ходьба по клеткам. Модель выбирается в data.js (поле model).
// Два вида моделей:
//  • Kenney Mini Characters (CC0) — названия движений из data.js (animations), часть движений
//    (взмах, руки с ноутбуком) сделана кодом поверх анимации;
//  • свои PS1-модели со скелетом и движениями из Mixamo (этап 16–17, tools/blender/character.py) —
//    рядом с glb лежит <имя>.json с замерами («рига»): скорость шага, высота посадки, список движений.
//    Движения называются как ключи на сайте (idle, walk, sit, sitDown, standUp, type, wave),
//    руки кодом не докручиваются. Чего нет в списке — то не играется (см. бэклог в PLAN.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { applyPS1 } from './ps1.js';
import { ps1 as ps1Settings } from './data.js';
import { FACING_ANGLE } from './room.js';
import { findPath, nearestFreeCell } from './pathfinding.js';
import { buildBook, buildLaptop } from './props.js';

const MODELS_DIR = `${import.meta.env.BASE_URL}models/people/`; // работает и в подпапке сайта
const MODEL_HEIGHT = 0.776; // рост модели в её собственных единицах (измерено)
const TARGET_HEIGHT = 1.5; // рост персонажа в клетках
export const SCALE = TARGET_HEIGHT / MODEL_HEIGHT;

// Скорость шага подобрана по самой анимации, чтобы ноги не скользили по полу:
// в walk стопа за полцикла (0,33 с) проезжает назад ~0,3 единицы модели.
const WALK_CYCLE_SPEED = 0.915;
const WALK_TIME_SCALE = 1.0; // можно ускорить анимацию — шаг ускорится пропорционально
const WALK_SPEED = WALK_CYCLE_SPEED * SCALE * WALK_TIME_SCALE; // клеток в секунду

const TURN_RATE = 12; // как быстро разворачивается (больше = резче)
const FADE = 0.25; // длительность плавного перехода между анимациями, секунды

// Взмах рукой: в наборе такой анимации нет, поэтому правую руку поднимаем кодом
// поверх текущей анимации.
// raise — насколько поднять руку (радианы), swing — размах покачивания.
// У чиби огромная голова прямо над плечом: дальше ~−1.2 кисть уходит в голову
// (проверено на всех 12 моделях), поэтому рука поднимается в сторону, до уровня уха.
const WAVE = { duration: 1.8, raise: -1.0, swing: 0.15, speed: 10, fade: 0.25 };
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Кисть — на конце руки: в 0.26 ед. модели от плеча вдоль оси X кости
// (правая рука вытянута в −X, левая в +X; проверено по вершинам).
const HAND = 0.26;

// Руки поверх анимации (радианы, в системе кости): forward — вперёд (минус — назад
// за спину), up — в сторону и вверх. Правая и левая зеркальны — знаки учтены в коде.
// Подобрано на глаз по скриншотам.
const ARMS = {
  rest: { forward: 0, up: 0 },
  behind: { forward: -0.9, up: 0.35 }, // тянется за спину за ноутбуком
  type: { forward: 1.5, up: -0.1 }, // руки над клавиатурой (подобрано перебором: кисти над клавишами)
  typeSwing: 0.07, // как сильно «стучат» руки
  typeSpeed: 11,
};

// Ноутбук в системе персонажа (клетки): за спиной и на коленях, сидя.
const LAPTOP = {
  behind: new THREE.Vector3(0, 0.42, -0.3),
  lap: new THREE.Vector3(0, 0.18, 0.4), // на коленях: руки у чиби короткие, ближе не дотянуться
  open: -1.9, // угол открытой крышки
};
// Книга: насколько выше середины между кистями и насколько дальше от груди.
const BOOK_HOLD = new THREE.Vector3(0, 0.08, 0.05);
const BOOK_TILT = -0.35; // наклон книги к себе, как при чтении
const BOOK_COLORS = ['#9c3a32', '#2f5d8a', '#d1a63a', '#3d7a4a', '#6b4a8a'];

// Посадка: в позе sit модель опускается, поэтому на сиденье её надо приподнять.
const SIT_LIFT = 0.02; // насколько выше сиденья точка персонажа (подобрано на глаз)
const SIT_BACK = -0.06; // сдвиг назад к спинке (минус — вперёд, чтобы спинка стула не тонула в спине)
const SHADOW_Y = 0.035; // тень всегда на полу, чуть выше ковра
const SIT_TIME = 0.4; // сколько длится «сесть» и «встать», секунды
// Свои модели: движение «садится» сначала стоит, потом опускается — к сиденью едем
// с этой доли движения. SIT_BACK_RIG — сдвиг к спинке (плюс — назад).
const SIT_START = 0.25;
const SIT_BACK_RIG = 0.0;
// Ноутбук у своих моделей: под кистями в позе «печатает» (ниже кистей и чуть дальше от себя).
const LAPTOP_RIG = { below: -0.06, forward: 0.06 };

// Масштаб модели: Kenney — по росту, свои модели уже в клетках.
export const modelScale = (gltf) => (gltf.userData.rig ? 1 : SCALE);

// Сигнал «действие отменили».
export class Cancelled extends Error {}

class Task {
  constructor() {
    this.cancelled = false;
    this.cleanups = [];
    this.signal = new Promise((_, reject) => (this.reject = reject));
    this.signal.catch(() => {});
  }
  // Дождаться шага. Если задачу отменят раньше — сразу выйти с Cancelled.
  step(promise) {
    return Promise.race([promise, this.signal]);
  }
  // Что сделать при завершении или отмене (выполняется в обратном порядке).
  onCleanup(fn) {
    this.cleanups.push(fn);
  }
  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.reject(new Cancelled());
  }
}

const cache = new Map();
export function loadModel(name) {
  if (!cache.has(name)) {
    // Замеры своей модели (если их нет — это модель Kenney).
    const rig = fetch(`${MODELS_DIR}${name}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    cache.set(
      name,
      Promise.all([new GLTFLoader().loadAsync(`${MODELS_DIR}${name}.glb`), rig]).then(([gltf, rigInfo]) => {
        gltf.userData.rig = rigInfo;
        // Текстура-палитра: чёткие пиксели, без размытия.
        gltf.scene.traverse((o) => {
          if (o.isMesh && o.material.map) {
            o.material.map.magFilter = THREE.NearestFilter;
            o.material.map.minFilter = THREE.NearestFilter;
            o.material.map.generateMipmaps = false;
          }
        });
        return gltf;
      }),
    );
  }
  return cache.get(name);
}

// Светящееся кольцо под ногами выбранного персонажа.
export function createSelectionRing() {
  const group = new THREE.Group();
  const make = (inner, outer, opacity, y) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity, depthWrite: false, fog: false }),
    );
    m.position.y = y;
    m.userData.noOutline = true;
    m.raycast = () => {};
    group.add(m);
    return m;
  };
  const halo = make(0.3, 0.6, 0.35, 0); // мягкое свечение вокруг
  const core = make(0.4, 0.5, 1, 0.008); // яркое кольцо
  const edge = make(0.37, 0.4, 1, 0.012); // тонкий белый ободок внутри
  const RING_Y = 0.05; // выше ковра и тени
  group.position.y = RING_Y;
  return {
    group,
    // Держать кольцо на полу, даже когда персонаж сидит (поднят над полом).
    followFloor(characterY) {
      group.position.y = RING_Y - characterY;
    },
    setColor(hex) {
      const c = new THREE.Color(hex);
      core.material.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.25);
      halo.material.color.copy(c);
      edge.material.color.set('#ffffff');
    },
    update(t) {
      const s = 1 + Math.sin(t * 4) * 0.05;
      group.scale.set(s, 1, s);
      halo.material.opacity = 0.3 + Math.sin(t * 4) * 0.12;
    },
  };
}

// Привести угол к диапазону от −π до π (чтобы поворачиваться короткой стороной).
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (x) => x * x * (3 - 2 * x);

export class Character {
  constructor(data, gltf, grid, animNames) {
    this.data = data;
    this.id = data.id;
    this.grid = grid;
    this.anim = animNames;

    this.root = new THREE.Group();
    this.root.name = data.id;

    // Независимая копия модели (свой скелет) и свои материалы с простым освещением.
    const rig = gltf.userData.rig;
    this.rig = rig;
    if (rig) this.anim = Object.fromEntries(Object.keys(rig.animations).map((k) => [k, k]));
    this.walkSpeed = rig?.walkSpeed ?? WALK_SPEED;

    const model = SkeletonUtils.clone(gltf.scene);
    model.scale.setScalar(modelScale(gltf));
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = new THREE.MeshLambertMaterial({ map: o.material.map, color: o.material.color.clone() });
      o.userData.characterId = data.id;
    });
    applyPS1(model, ps1Settings.characterSnap);
    model.userData.characterId = data.id;
    this.model = model;
    // Руки: у Kenney — кости, которые докручиваются кодом; у своих моделей — кисти для предметов.
    this.armRight = rig ? null : model.getObjectByName('arm-right');
    this.armLeft = rig ? null : model.getObjectByName('arm-left');
    this.hands = rig ? { right: model.getObjectByName('RightHandIndex1'), left: model.getObjectByName('LeftHandIndex1') } : null;
    this.animStep = 0; // накопленное время для анимации «на двойках»
    this.arms = { ...ARMS.rest, typing: 0 }; // текущая поза рук поверх анимации
    this.armTween = null;
    this.prop = null; // что в руках: { kind, mesh, follow }
    this.animators = []; // покадровые плавные изменения (см. animate)
    this.propGen = 0; // номер «доставания»: если его убрали на полпути, доставание прекращается
    this.root.add(model);

    // Круглая тень под ногами
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 10).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
    );
    shadow.position.y = SHADOW_Y; // выше ковра (0.02)
    shadow.userData.noOutline = true;
    shadow.raycast = () => {}; // тень не ловит клики
    this.shadow = shadow;
    this.root.add(shadow);

    // Анимации
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const action = this.mixer.clipAction(clip);
      if (!rig && clip.name === animNames.walk) action.timeScale = WALK_TIME_SCALE;
      if (rig && rig.animations[clip.name] === false) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions[clip.name] = action;
    }
    this.current = null;
    this.waving = null;
    this.waiters = []; // кто ждёт каких условий (см. until)
    this.clock = 0; // собственные часы персонажа, секунды
    this.tween = null; // плавное перемещение (сесть/встать)
    this.standSpot = null; // где стоял до того, как сел
    this.task = null; // текущее действие
    this.taskGen = 0;
    this.activity = null; // { icon, label } для нижней панели

    // Положение и поворот на старте
    const [c, r] = data.startCell;
    this.root.position.copy(grid.cellCenter(c, r));
    this.root.rotation.y = this.targetYaw = FACING_ANGLE[data.startFacing || 'south'];
    this.path = []; // оставшиеся точки маршрута (центры клеток)
    this.play('idle', 0);
  }

  get position() {
    return this.root.position;
  }

  // Включить анимацию по ключу из data.js (idle, walk, sit…) с плавным переходом.
  play(key, fade = FADE) {
    if (key === 'wave' && !this.rig) return this.wave(); // у Kenney взмах — кодом
    const action = this.actions[this.anim[key]];
    if (!action || action === this.current) return action;
    action.reset();
    action.play();
    if (this.current && fade > 0) action.crossFadeFrom(this.current, fade, false);
    else if (this.current) this.current.stop();
    this.current = action;
    return action;
  }

  // Помахать правой рукой. Возвращает обещание, которое выполнится, когда рука опустится.
  wave() {
    if (this.rig) {
      if (!this.actions.wave) return Promise.resolve();
      const len = this.playOnce('wave');
      const gen = (this.waveGen = (this.waveGen || 0) + 1);
      return this.wait(len).then(() => {
        if (gen === this.waveGen && this.current === this.actions.wave) this.play('idle', 0.3);
      });
    }
    return new Promise((resolve) => {
      this.waving?.resolve();
      this.waving = { t: 0, resolve };
    });
  }

  // Идти в клетку [c, r]. Если она занята — в ближайшую свободную.
  // Можно вызывать на ходу: маршрут перестраивается от текущего места без рывка.
  walkTo(c, r) {
    const pos = this.root.position;
    const start = this.grid.worldToCell(pos.x, pos.z);
    let goal = [c, r];
    if (!this.grid.isFree(c, r)) goal = nearestFreeCell(this.grid, c, r, start);
    if (!goal) return false;
    const cells = findPath(this.grid, start, goal);
    if (!cells) return false;
    // Первая клетка маршрута — та, где персонаж уже стоит. Её центр пропускаем,
    // чтобы не возвращаться назад, а идти от текущей точки прямо к следующей клетке.
    if (cells.length > 1) cells.shift();
    this.path = cells.map(([cc, rr]) => this.grid.cellCenter(cc, rr));
    return true;
  }

  get isWalking() {
    return this.path.length > 0;
  }

  stop() {
    this.path = [];
    this.play('idle');
  }

  // ---------- Шаги, которых можно дождаться ----------

  // Обещание, которое выполнится, когда условие станет истинным (проверяется каждый кадр).
  until(predicate) {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push({ predicate, resolve }));
  }

  // Подождать столько-то секунд «игрового» времени.
  wait(seconds) {
    const end = this.clock + seconds;
    return this.until(() => this.clock >= end);
  }

  // Дойти до клетки; обещание выполнится по прибытии.
  walkToAsync(c, r) {
    if (!this.walkTo(c, r)) return Promise.reject(new Error(`не удалось построить путь в клетку ${c},${r}`));
    return this.until(() => !this.isWalking);
  }

  // Повернуться на угол (в радианах) и дождаться конца поворота.
  faceTo(yaw) {
    this.targetYaw = yaw;
    return this.until(() => Math.abs(wrap(this.targetYaw - this.root.rotation.y)) < 0.03);
  }

  // Переместиться в точку за duration секунд. eased = true — плавно разогнаться
  // и затормозить (сесть/встать); false — равномерно (короткий шаг пешком).
  tweenTo(to, duration, eased = true) {
    return new Promise((resolve) => {
      this.tween?.resolve();
      this.tween = { from: this.root.position.clone(), to: to.clone(), t: 0, duration, eased, resolve };
    });
  }

  // Сесть: seat = { position, approach, yaw } — точка на сиденье, откуда подходить
  // (сзади стула / перед диваном) и куда смотреть сидя.
  async sitDown(seat) {
    this.standSpot = seat.approach.clone(); // сюда вернёмся, когда встанем
    // Подойти вплотную к месту посадки
    const pos = this.root.position;
    const dx = seat.approach.x - pos.x, dz = seat.approach.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.02) {
      this.targetYaw = Math.atan2(dx, dz);
      this.play('walk');
      await this.tweenTo(seat.approach, dist / this.walkSpeed, false);
    }
    // Повернуться и опуститься на сиденье
    this.targetYaw = seat.yaw;
    const to = seat.position.clone();
    if (this.rig) {
      // своя модель: попа в позе sit на высоте rig.sitSeat над точкой персонажа
      to.y += -this.rig.sitSeat;
      const back = SIT_BACK_RIG + (this.rig.sitHipsY || 0) - (seat.rigForward || 0);
      to.x -= Math.sin(seat.yaw) * back;
      to.z -= Math.cos(seat.yaw) * back;
      if (this.actions.sitDown) {
        const len = this.playOnce('sitDown');
        await this.wait(len * SIT_START);
        await this.tweenTo(to, len * (1 - SIT_START) * 0.9);
        this.play('sit', 0.2);
      } else {
        this.play('sit', 0.3);
        await this.tweenTo(to, SIT_TIME);
      }
      return;
    }
    this.play('sit', 0.3);
    to.y += SIT_LIFT;
    to.x -= Math.sin(seat.yaw) * SIT_BACK;
    to.z -= Math.cos(seat.yaw) * SIT_BACK;
    await this.tweenTo(to, SIT_TIME);
  }

  // Встать (своей анимации «встать» в наборе нет — плавный переход sit → idle).
  async standUp() {
    if (!this.standSpot) return;
    if (this.rig && this.actions.standUp) {
      const len = this.playOnce('standUp');
      await this.tweenTo(this.standSpot, len * 0.6);
      await this.wait(len * 0.35);
      this.standSpot = null;
      this.play('idle', 0.3);
      return;
    }
    this.play('idle', 0.35);
    await this.tweenTo(this.standSpot, SIT_TIME);
    this.standSpot = null;
  }

  // ---------- Предметы в руках ----------

  // Покадровая анимация: fn(k) вызывается каждый кадр, k растёт от 0 до 1 за duration секунд.
  animate(duration, fn) {
    return new Promise((resolve) => this.animators.push({ t: 0, duration, fn, resolve }));
  }

  // Плавно перевести руки в позу из ARMS.
  poseArms(pose, duration = 0.4) {
    if (this.rig) return Promise.resolve(); // у своих моделей руки двигает только анимация
    const from = { forward: this.arms.forward, up: this.arms.up };
    const to = ARMS[pose];
    return this.animate(duration, (k) => {
      const e = smooth(k);
      this.arms.forward = from.forward + (to.forward - from.forward) * e;
      this.arms.up = from.up + (to.up - from.up) * e;
    });
  }

  // Точка кисти (side: 'left' | 'right') в системе персонажа.
  handPoint(side, target = new THREE.Vector3()) {
    if (this.hands) {
      this.hands[side].getWorldPosition(target);
      return this.root.worldToLocal(target);
    }
    const bone = side === 'right' ? this.armRight : this.armLeft;
    target.set(side === 'right' ? -HAND : HAND, 0, 0).applyMatrix4(bone.matrixWorld);
    return this.root.worldToLocal(target);
  }

  // Предмет — часть персонажа: клик по нему выбирает персонажа.
  attachProp(kind, mesh) {
    mesh.traverse((o) => {
      if (o.isMesh) o.userData.characterId = this.id;
    });
    applyPS1(mesh, ps1Settings.characterSnap);
    this.root.add(mesh);
    this.prop = { kind, mesh, follow: null };
    return this.prop;
  }

  // Анимацию проиграть один раз и остановиться на последнем кадре.
  playOnce(key) {
    const action = this.actions[this.anim[key]];
    if (!action) return 0;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    if (action === this.current) this.current = null; // чтобы play() запустил заново
    this.play(key, 0.15);
    return action.getClip().duration / action.timeScale;
  }

  // Достать предмет: 'book' — стоя снять книгу с полки; 'laptop' — сидя достать
  // ноутбук из-за спины, открыть и начать печатать. Обещание — когда предмет в руках.
  async takeProp(kind) {
    await this.putAway();
    const gen = this.propGen;
    const alive = () => gen === this.propGen; // false — пока доставали, предмет велели убрать
    if (kind === 'book') {
      const len = this.playOnce('reach');
      await this.wait(len * 0.45); // рука у полки
      if (!alive()) return;
      const book = this.attachProp('book', buildBook(BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)]));
      book.follow = 'right';
      book.mesh.rotation.x = BOOK_TILT;
      await this.wait(len * 0.55);
      if (!alive()) return;
      if (this.actions[this.anim.hold]) {
        this.play('hold', 0.25);
        book.follow = 'both';
      }
      return;
    }
    if (kind === 'laptop') {
      const laptop = this.attachProp('laptop', buildLaptop());
      const mesh = laptop.mesh;
      const lid = mesh.userData.lid;
      mesh.rotation.y = Math.PI; // экраном от себя
      mesh.position.copy(LAPTOP.behind);
      mesh.visible = false;
      await this.poseArms('behind', 0.35);
      if (!alive()) return;
      mesh.visible = true;
      // из-за спины — дугой через бок на колени, руки идут вперёд
      const side = new THREE.Vector3(-0.32, 0.5, 0);
      const arms = this.poseArms('type', 0.6);
      await this.animate(0.6, (k) => {
        const e = smooth(k);
        const a = new THREE.Vector3().lerpVectors(LAPTOP.behind, side, Math.min(1, e * 2));
        const b = new THREE.Vector3().lerpVectors(side, LAPTOP.lap, Math.max(0, e * 2 - 1));
        mesh.position.copy(e < 0.5 ? a : b);
        mesh.rotation.z = Math.sin(e * Math.PI) * 0.6;
      });
      await arms;
      if (!alive()) return;
      await this.animate(0.35, (k) => (lid.rotation.x = LAPTOP.open * smooth(k)));
      if (!alive()) return;
      await this.animate(0.3, (k) => (this.arms.typing = k));
      if (this.rig && this.actions.type) {
        this.play('type', 0.4);
        // ноутбук — под кистями: в позе «печатает» руки вытянуты вперёд
        await this.wait(0.45);
        if (!alive()) return;
        this.root.updateMatrixWorld(true);
        const mid = this.handPoint('right').add(this.handPoint('left')).multiplyScalar(0.5);
        const from = mesh.position.clone();
        const toLap = new THREE.Vector3(0, mid.y + LAPTOP_RIG.below, mid.z + LAPTOP_RIG.forward);
        await this.animate(0.3, (k) => mesh.position.lerpVectors(from, toLap, smooth(k)));
      }
    }
  }

  // Убрать предмет из рук (книгу — обратно на полку, ноутбук — за спину).
  async putAway() {
    // Прервать доставание, если оно ещё идёт: его анимации завершаются сразу.
    this.propGen++;
    for (const a of this.animators) a.resolve();
    this.animators = [];
    this.arms.typing = 0;
    const prop = this.prop;
    if (!prop) {
      // предмет так и не достали: опустить руки / выйти из позы «тянется к полке»
      const pose = this.current?.getClip().name;
      if (pose === this.anim.reach || pose === this.anim.hold) this.play('idle', 0.3);
      if (this.arms.forward || this.arms.up) await this.poseArms('rest', 0.3);
      return;
    }
    if (prop.kind === 'book') {
      const len = this.playOnce('reach');
      prop.follow = 'right';
      await this.wait(len * 0.45);
      this.root.remove(prop.mesh);
      this.prop = null;
      this.play('idle', 0.3);
    } else if (prop.kind === 'laptop') {
      const mesh = prop.mesh;
      const lid = mesh.userData.lid;
      const from = mesh.position.clone();
      this.arms.typing = 0;
      if (this.rig && this.current === this.actions.type) this.play('sit', 0.3);
      await this.animate(0.25, (k) => (lid.rotation.x = LAPTOP.open * (1 - smooth(k))));
      const arms = this.poseArms('behind', 0.4);
      await this.animate(0.4, (k) => mesh.position.lerpVectors(from, LAPTOP.behind, smooth(k)));
      await arms;
      this.root.remove(mesh);
      this.prop = null;
      await this.poseArms('rest', 0.3);
    }
  }

  stopWave() {
    if (this.rig) {
      this.waveGen = (this.waveGen || 0) + 1;
      if (this.current === this.actions.wave) this.play('idle', 0.25);
      return;
    }
    if (!this.waving) return;
    this.waving.resolve();
    this.waving = null;
  }

  // ---------- Действия (задачи) ----------
  // Задача — цепочка шагов (дойти → повернуться → сесть → панель…).
  // Её можно отменить на любом шаге; тогда выполняются «уборки» в обратном порядке:
  // закрыть панель, встать, остановиться, освободить место.
  async runTask(activity, steps) {
    const gen = ++this.taskGen;
    await this.cancelTask();
    if (gen !== this.taskGen) return; // пока ждали, запустили другую задачу
    const task = new Task();
    this.task = task;
    this.activity = activity;
    task.done = (async () => {
      try {
        await steps(task);
      } catch (e) {
        if (!(e instanceof Cancelled)) console.warn('Действие прервано:', e.message);
      } finally {
        for (const cleanup of task.cleanups.reverse()) {
          try {
            await cleanup();
          } catch (e) {
            console.error(e);
          }
        }
        if (this.task === task) {
          this.task = null;
          this.activity = null;
        }
      }
    })();
    return task.done;
  }

  // Отменить текущую задачу и дождаться, пока персонаж «приберётся» (встанет и т. п.).
  cancelTask() {
    const t = this.task;
    if (!t) return Promise.resolve();
    t.cancel();
    return t.done;
  }

  update(dt) {
    this.clock += dt;
    // Взмах и позы рук докручивают кости поверх анимации. Но анимация переписывает кость,
    // только когда её поза меняется: в неподвижной позе (sit, holding-both) докрутка
    // копилась бы кадр за кадром. Поэтому сначала возвращаем руки к позе из анимации.
    if (this.armBase) {
      this.armRight.quaternion.copy(this.armBase.right);
      this.armLeft.quaternion.copy(this.armBase.left);
    }
    // Анимация «на двойках», как в играх PS1: поза меняется ступеньками (ps1.animationFps в data.js).
    const fps = ps1Settings.animationFps;
    if (fps && this.rig) {
      this.animStep += dt;
      if (this.animStep >= 1 / fps) {
        this.mixer.update(this.animStep);
        this.animStep = 0;
      }
    } else {
      this.mixer.update(dt);
    }
    if (this.armRight) {
      this.armBase ||= { right: new THREE.Quaternion(), left: new THREE.Quaternion() };
      this.armBase.right.copy(this.armRight.quaternion);
      this.armBase.left.copy(this.armLeft.quaternion);
    }

    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const linear = Math.min(1, tw.t / tw.duration);
      const k = tw.eased ? smooth(linear) : linear;
      this.root.position.lerpVectors(tw.from, tw.to, k);
      if (k >= 1) {
        this.tween = null;
        tw.resolve();
      }
    }
    this.shadow.position.y = SHADOW_Y - this.root.position.y; // сидя тень остаётся на полу

    if (this.path.length) {
      const pos = this.root.position;
      let step = this.walkSpeed * dt;
      while (step > 0 && this.path.length) {
        const target = this.path[0];
        const dx = target.x - pos.x, dz = target.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1e-3) this.targetYaw = Math.atan2(dx, dz);
        if (step >= dist) {
          pos.x = target.x;
          pos.z = target.z;
          step -= dist;
          this.path.shift();
        } else {
          pos.x += (dx / dist) * step;
          pos.z += (dz / dist) * step;
          step = 0;
        }
      }
      this.play(this.path.length ? 'walk' : 'idle');
    }

    // Взмах рукой поверх анимации: плавно поднять, покачать, плавно опустить.
    if (this.waving && this.armRight) {
      const w = this.waving;
      w.t += dt;
      const k = smooth(Math.max(0, Math.min(1, w.t / WAVE.fade, (WAVE.duration - w.t) / WAVE.fade)));
      const angle = (WAVE.raise + Math.sin(w.t * WAVE.speed) * WAVE.swing) * k;
      this.armRight.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, angle));
      if (w.t >= WAVE.duration) {
        this.waving = null;
        w.resolve();
      }
    }

    // Покадровые анимации предметов и рук
    if (this.animators.length) {
      this.animators = this.animators.filter((a) => {
        a.t += dt;
        const k = Math.min(1, a.t / a.duration);
        a.fn(k);
        if (k < 1) return true;
        a.resolve();
        return false;
      });
    }

    // Руки поверх анимации: вперёд/назад (ось Y кости) и в сторону (ось Z).
    // У правой руки «вперёд» — плюс, у левой — минус (руки зеркальны).
    const typing = this.arms.typing ? Math.sin(this.clock * ARMS.typeSpeed) * ARMS.typeSwing * this.arms.typing : 0;
    if (this.armRight && (this.arms.forward || this.arms.up || typing)) {
      const q = new THREE.Quaternion();
      this.armRight.quaternion
        .multiply(q.setFromAxisAngle(Y_AXIS, this.arms.forward + typing))
        .multiply(q.setFromAxisAngle(Z_AXIS, -this.arms.up));
      this.armLeft.quaternion
        .multiply(q.setFromAxisAngle(Y_AXIS, -this.arms.forward + typing))
        .multiply(q.setFromAxisAngle(Z_AXIS, this.arms.up));
    }

    // Книга держится в кисти (или между кистями)
    if (this.prop?.follow) {
      this.root.updateMatrixWorld(true);
      const p = this.prop.mesh.position;
      if (this.prop.follow === 'right') this.handPoint('right', p);
      else p.addVectors(this.handPoint('right'), this.handPoint('left')).multiplyScalar(0.5).add(BOOK_HOLD);
    }

    // Плавный поворот лицом по направлению движения
    const diff = wrap(this.targetYaw - this.root.rotation.y);
    this.root.rotation.y += diff * Math.min(1, TURN_RATE * dt);

    // Проверить, не дождался ли кто-нибудь своего условия
    if (this.waiters.length) {
      this.waiters = this.waiters.filter((w) => {
        if (!w.predicate()) return true;
        w.resolve();
        return false;
      });
    }
  }
}
