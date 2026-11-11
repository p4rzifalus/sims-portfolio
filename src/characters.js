// Персонажи: лоу-поли люди Kenney Mini Characters (CC0) со своими анимациями
// и ходьбой по клеткам. Модель выбирается в data.js (поле model).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { applyPS1 } from './ps1.js';
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
    applyPS1(model);
    this.model = model;
    this.armRight = model.getObjectByName('arm-right');
    this.root.add(model);

    // Круглая тень под ногами
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 10).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
    );
    shadow.position.y = 0.012;
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

  stop() {
    this.path = [];
  }

  update(dt) {
    this.mixer.update(dt);

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
  }
}
