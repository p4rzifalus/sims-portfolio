// Портреты для интерфейса: снимок головы персонажа с его же 3D-модели.
// Рисуем маленькую картинку (96×96) — в интерфейсе она растягивается
// без сглаживания, как и сама сцена.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { SCALE } from './characters.js';

const toSRGB = (v) => {
  const c = v / 255;
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
};

export function renderPortrait(renderer, gltf, size = 96) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff6e8', '#5a4a70', 2.4));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);

  const model = SkeletonUtils.clone(gltf.scene);
  model.scale.setScalar(SCALE);
  model.traverse((o) => {
    if (o.isMesh) o.material = new THREE.MeshLambertMaterial({ map: o.material.map, color: o.material.color.clone() });
  });
  scene.add(model);
  const idle = gltf.animations.find((a) => a.name === 'idle');
  if (idle) {
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(idle).play();
    mixer.update(0);
  }
  model.updateMatrixWorld(true);

  // Голова — примерно от 0.66 до 1.5 по высоте. Камера чуть справа и сверху (вид 3/4).
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 20);
  camera.position.set(0.7, 1.3, 2.8);
  camera.lookAt(0, 1.0, 0);

  const target = new THREE.WebGLRenderTarget(size, size);
  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  const pixels = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  target.dispose();

  // Пиксели приходят снизу вверх и в «линейных» цветах — переворачиваем и переводим.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = ((size - 1 - y) * size + x) * 4;
      const dst = (y * size + x) * 4;
      img.data[dst] = toSRGB(pixels[src]);
      img.data[dst + 1] = toSRGB(pixels[src + 1]);
      img.data[dst + 2] = toSRGB(pixels[src + 2]);
      img.data[dst + 3] = pixels[src + 3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
