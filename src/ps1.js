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
uniform vec2 uLowRes;
uniform float uScale;
uniform float uLevels;
uniform float uDither;

// Матрица Байера 4×4: упорядоченный шум для дизеринга.
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  // Каждый «большой пиксель» — квадрат uScale × uScale настоящих пикселей.
  vec2 px = floor(gl_FragCoord.xy / uScale);
  vec3 c = texture2D(tDiffuse, (px + 0.5) / uLowRes).rgb;
  c = toSRGB(clamp(c, 0.0, 1.0));
  float steps = uLevels - 1.0;
  float d = (bayer4(px) - 0.5) * uDither;
  c = clamp(floor(c * steps + 0.5 + d) / steps, 0.0, 1.0);
  gl_FragColor = vec4(c, 1.0);
}
`;

export class PS1Pass {
  constructor() {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uLowRes: { value: new THREE.Vector2(1, 1) },
        uScale: { value: 1 },
        uLevels: { value: 32 },
        uDither: { value: 1 },
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
    this.material.uniforms.uLowRes.value.set(this.lowW, this.lowH);
    this.material.uniforms.uScale.value = this.scale;
  }

  setPalette(levels, dither) {
    this.material.uniforms.uLevels.value = levels;
    this.material.uniforms.uDither.value = dither;
  }

  render(renderer, scene, camera) {
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}
