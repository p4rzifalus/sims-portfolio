// Персонажи: лоу-поли люди Kenney Mini Characters (CC0) со своими анимациями
// и ходьбой по клеткам. Модель выбирается в data.js (поле model).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { applyPS1 } from './ps1.js';
import { ps1 as ps1Settings } from './data.js';
import { FACING_ANGLE } from './room.js';
import { findPath, nearestFreeCell } from './pathfinding.js';

const MODELS_DIR = '/models/people/';
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
const WAVE = { duration: 1.8, raise: -2.8, swing: 0.45, speed: 10, fade: 0.25 };
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Посадка: в позе sit модель опускается, поэтому на сиденье её надо приподнять.
const SIT_LIFT = 0.02; // насколько выше сиденья точка персонажа (подобрано на глаз)
const SIT_BACK = -0.06; // сдвиг назад к спинке (минус — вперёд, чтобы спинка стула не тонула в спине)
const SHADOW_Y = 0.035; // тень всегда на полу, чуть выше ковра
const SIT_TIME = 0.4; // сколько длится «сесть» и «встать», секунды

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
    cache.set(
      name,
      new GLTFLoader().loadAsync(`${MODELS_DIR}${name}.glb`).then((gltf) => {
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
    const model = SkeletonUtils.clone(gltf.scene);
    model.scale.setScalar(SCALE);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = new THREE.MeshLambertMaterial({ map: o.material.map, color: o.material.color.clone() });
      o.userData.characterId = data.id;
    });
    applyPS1(model, ps1Settings.characterSnap);
    model.userData.characterId = data.id;
    this.model = model;
    this.armRight = model.getObjectByName('arm-right');
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
      if (clip.name === animNames.walk) action.timeScale = WALK_TIME_SCALE;
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
    if (key === 'wave') return this.wave();
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
      await this.tweenTo(seat.approach, dist / WALK_SPEED, false);
    }
    // Повернуться и опуститься на сиденье
    this.targetYaw = seat.yaw;
    this.play('sit', 0.3);
    const to = seat.position.clone();
    to.y += SIT_LIFT;
    to.x -= Math.sin(seat.yaw) * SIT_BACK;
    to.z -= Math.cos(seat.yaw) * SIT_BACK;
    await this.tweenTo(to, SIT_TIME);
  }

  // Встать (своей анимации «встать» в наборе нет — плавный переход sit → idle).
  async standUp() {
    if (!this.standSpot) return;
    this.play('idle', 0.35);
    await this.tweenTo(this.standSpot, SIT_TIME);
    this.standSpot = null;
  }

  stopWave() {
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
    this.mixer.update(dt);

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
      let step = WALK_SPEED * dt;
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
    if (this.waving) {
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
