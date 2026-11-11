// Персонажи: копия модели робота со своим цветом, анимациями и ходьбой по клеткам.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { applyPS1 } from './ps1.js';
import { FACING_ANGLE } from './room.js';
import { findPath, nearestFreeCell } from './pathfinding.js';

const MODEL_URL = '/models/RobotExpressive.glb';
const MODEL_HEIGHT = 4.77; // рост модели в её собственных единицах (измерено)
const TARGET_HEIGHT = 1.35; // рост персонажа в клетках
const SCALE = TARGET_HEIGHT / MODEL_HEIGHT;

// Скорость шага подобрана по самой анимации, чтобы ноги не скользили по полу:
// в Walking стопа, стоящая на полу, едет назад ~2.9 единицы модели в секунду.
const WALK_CYCLE_SPEED = 2.9;
const WALK_TIME_SCALE = 1.4; // ускоряем анимацию — и шаг пропорционально
const WALK_SPEED = WALK_CYCLE_SPEED * SCALE * WALK_TIME_SCALE; // клеток в секунду

const TURN_RATE = 12; // как быстро разворачивается (больше = резче)
const FADE = 0.25; // длительность плавного перехода между анимациями, секунды

export function loadModel() {
  return new GLTFLoader().loadAsync(MODEL_URL);
}

// Привести угол к диапазону от −π до π (чтобы поворачиваться короткой стороной).
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Character {
  constructor(data, gltf, grid, animNames) {
    this.data = data;
    this.id = data.id;
    this.grid = grid;
    this.anim = animNames;

    this.root = new THREE.Group();
    this.root.name = data.id;

    // Независимая копия модели (свой скелет) и свои материалы.
    const model = SkeletonUtils.clone(gltf.scene);
    model.scale.setScalar(SCALE);
    const mats = new Map();
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = [o.material].flat().map((m) => {
        if (!mats.has(m)) {
          const color = m.name === 'Main' ? new THREE.Color(data.color) : m.color.clone();
          mats.set(m, new THREE.MeshLambertMaterial({ color, name: m.name }));
        }
        return mats.get(m);
      });
      if (o.material.length === 1) o.material = o.material[0];
      o.userData.characterId = data.id;
    });
    applyPS1(model);
    this.model = model;
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
    const onceClips = new Set([animNames.sit, animNames.stand, animNames.wave]);
    for (const clip of gltf.animations) {
      const action = this.mixer.clipAction(clip);
      if (onceClips.has(clip.name)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true; // замирает на последнем кадре
      }
      if (clip.name === animNames.walk) action.timeScale = WALK_TIME_SCALE;
      this.actions[clip.name] = action;
    }
    this.current = null;

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
    const action = this.actions[this.anim[key]];
    if (!action || action === this.current) return action;
    action.reset();
    action.play();
    if (this.current && fade > 0) action.crossFadeFrom(this.current, fade, false);
    else if (this.current) this.current.stop();
    this.current = action;
    return action;
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

    // Плавный поворот лицом по направлению движения
    const diff = wrap(this.targetYaw - this.root.rotation.y);
    this.root.rotation.y += diff * Math.min(1, TURN_RATE * dt);
  }
}
