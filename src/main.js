// Этап 0: 3D-сцены ещё нет. Страница только проверяет, что данные
// из data.js читаются, а файл модели лежит на месте.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { room, characters, furniture, animations } from './data.js';

const out = document.getElementById('status');
const line = (text) => {
  const p = document.createElement('p');
  p.textContent = text;
  out.appendChild(p);
};

line(`Three.js, версия ${THREE.REVISION} — подключён`);
line(`Комната: ${room.columns}×${room.rows} клеток`);
line(`Персонажи: ${characters.map((c) => c.name).join(', ')}`);
line(`Предметов в комнате: ${furniture.length}, из них кликабельных: ${furniture.filter((f) => f.actions).length}`);

new GLTFLoader().load(
  '/models/RobotExpressive.glb',
  (gltf) => {
    const names = gltf.animations.map((a) => a.name);
    line(`Модель загружена. Анимации: ${names.join(', ')}`);
    const missing = Object.values(animations).filter((n) => !names.includes(n));
    line(missing.length ? `ОШИБКА: в модели нет анимаций: ${missing.join(', ')}` : 'Все анимации из data.js найдены в модели ✓');
  },
  undefined,
  (err) => line(`ОШИБКА: модель не загрузилась (${err.message})`),
);
