// Эффект «как на PS1». Две части:
// 1) Дрожание вершин — вставка в стандартные материалы three.js:
//    положение каждой вершины на экране округляется до грубой сетки.
//    Материалы не заменяются, поэтому скелетная анимация роботов не ломается.
// 2) Финальный проход: сцена рисуется в маленькую картинку (~320 px по высоте),
//    затем растягивается на экран без сглаживания, с урезанной палитрой и дизерингом.
import * as THREE from 'three';

// Общие настройки для всех материалов: меняем значение — меняется везде сразу.
export const ps1Uniforms = {
  uSnapRes: { value: new THREE.Vector2(160, 120) },
  uSnapOn: { value: 1 },
};

const SNAP_CODE = /* glsl */ `
#include <project_vertex>
if (uSnapOn > 0.5) {
  vec4 snapped = gl_Position;
  snapped.xyz /= snapped.w;
  snapped.xy = floor(snapped.xy * uSnapRes + 0.5) / uSnapRes;
  snapped.xyz *= snapped.w;
  gl_Position = snapped;
}
`;

export function patchMaterial(material) {
  if (material.userData.ps1) return;
  material.userData.ps1 = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnapRes = ps1Uniforms.uSnapRes;
    shader.uniforms.uSnapOn = ps1Uniforms.uSnapOn;
    shader.vertexShader =
      'uniform vec2 uSnapRes;\nuniform float uSnapOn;\n' +
      shader.vertexShader.replace('#include <project_vertex>', SNAP_CODE);
  };
  material.needsUpdate = true;
}

// Пройтись по объекту и всем его частям и включить дрожание во всех материалах.
export function applyPS1(root) {
  root.traverse((o) => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(patchMaterial);
  });
}

const FINAL_FRAGMENT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tMask;
uniform vec2 uLowRes;
uniform float uScale;
uniform float uLevels;
uniform float uDither;
uniform float uQuantize;
uniform float uOutline;
uniform float uRadius;
uniform vec3 uOutlineColor;

// Матрица Байера 4×4: упорядоченный шум для дизеринга.
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  // Каждый «большой пиксель» — квадрат uScale × uScale настоящих пикселей.
  vec2 px = floor(gl_FragCoord.xy / uScale);
  vec2 uv = (px + 0.5) / uLowRes;
  vec3 c = texture2D(tDiffuse, uv).rgb;
  c = toSRGB(clamp(c, 0.0, 1.0));
  if (uQuantize > 0.5) {
    float steps = uLevels - 1.0;
    float d = (bayer4(px) - 0.5) * uDither;
    c = clamp(floor(c * steps + 0.5 + d) / steps, 0.0, 1.0);
  }
  // Обводка: пиксель вне силуэта, рядом с которым есть пиксель силуэта.
  if (uOutline > 0.5 && texture2D(tMask, uv).r < 0.5) {
    float edge = 0.0;
    for (int dy = -3; dy <= 3; dy++) {
      for (int dx = -3; dx <= 3; dx++) {
        vec2 o = vec2(float(dx), float(dy));
        if (max(abs(o.x), abs(o.y)) > uRadius) continue;
        edge = max(edge, texture2D(tMask, (px + o + 0.5) / uLowRes).r);
      }
    }
    if (edge > 0.5) c = uOutlineColor;
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

// Слой, в который на время наведения переносим объект, чтобы нарисовать его силуэт.
export const OUTLINE_LAYER = 1;

// Включить/выключить обводку объекта (персонажа или предмета).
export function setOutlined(object, on) {
  object.traverse((o) => {
    if (!o.isMesh || o.userData.noOutline) return;
    if (on) o.layers.enable(OUTLINE_LAYER);
    else o.layers.disable(OUTLINE_LAYER);
  });
}

// Весь кадр всегда идёт через этот проход. В режиме PS1 — маленькая картинка,
// урезанная палитра и дизеринг; без PS1 — полное разрешение со сглаживанием.
// Обводка работает в обоих режимах.
export class PS1Pass {
  constructor() {
    const opts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.target = new THREE.WebGLRenderTarget(1, 1, { ...opts, type: THREE.HalfFloatType });
    this.mask = new THREE.WebGLRenderTarget(1, 1, opts);
    this.maskMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
    patchMaterial(this.maskMaterial); // силуэт дрожит вместе с объектом
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        tMask: { value: this.mask.texture },
        uLowRes: { value: new THREE.Vector2(1, 1) },
        uScale: { value: 1 },
        uLevels: { value: 32 },
        uDither: { value: 1 },
        uQuantize: { value: 1 },
        uOutline: { value: 0 },
        uRadius: { value: 1 },
        uOutlineColor: { value: new THREE.Color(1, 0.97, 0.85) },
      },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FINAL_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scale = 1;
    this.lowW = 1;
    this.lowH = 1;
  }

  // W, H — размер холста в настоящих пикселях. Масштаб — целый,
  // чтобы все большие пиксели были одинакового размера.
  setSize(W, H, renderHeight) {
    this.scale = Math.max(1, Math.round(H / renderHeight));
    this.lowW = Math.max(1, Math.ceil(W / this.scale));
    this.lowH = Math.max(1, Math.ceil(H / this.scale));
    this.target.setSize(this.lowW, this.lowH);
    this.mask.setSize(this.lowW, this.lowH);
    this.material.uniforms.uLowRes.value.set(this.lowW, this.lowH);
    this.material.uniforms.uScale.value = this.scale;
  }

  setPalette(levels, dither) {
    this.material.uniforms.uLevels.value = levels;
    this.material.uniforms.uDither.value = dither;
  }

  // Режим PS1 или обычный: палитра, толщина обводки, сглаживание краёв.
  setMode(ps1On) {
    const u = this.material.uniforms;
    u.uQuantize.value = ps1On ? 1 : 0;
    u.uRadius.value = ps1On ? 1 : 3;
    const samples = ps1On ? 0 : 4;
    if (this.target.samples !== samples) {
      this.target.dispose();
      this.target.samples = samples;
    }
  }

  render(renderer, scene, camera, outline = false) {
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);

    if (outline) {
      // Второй кадр: только объект под курсором, белым по чёрному.
      const { background, fog } = scene;
      const layers = camera.layers.mask;
      const clearColor = renderer.getClearColor(new THREE.Color());
      const clearAlpha = renderer.getClearAlpha();
      scene.background = null;
      scene.fog = null;
      scene.overrideMaterial = this.maskMaterial;
      camera.layers.set(OUTLINE_LAYER);
      renderer.setClearColor(0x000000, 1);
      renderer.setRenderTarget(this.mask);
      renderer.render(scene, camera);
      scene.background = background;
      scene.fog = fog;
      scene.overrideMaterial = null;
      camera.layers.mask = layers;
      renderer.setClearColor(clearColor, clearAlpha);
    }
    this.material.uniforms.uOutline.value = outline ? 1 : 0;

    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}
