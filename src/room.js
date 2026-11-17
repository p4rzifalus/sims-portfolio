// Комната и мебель. Всё собирается из простых коробок и цилиндров
// по описанию из data.js: где стоит предмет, сколько клеток занимает, куда смотрит.
import * as THREE from 'three';
import * as tex from './textures.js';

// Направление «лицом к» → поворот вокруг вертикальной оси.
// В своей системе координат каждый предмет смотрит на +Z («на юг»).
export const FACING_ANGLE = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };

// Высота поверхности, на которую можно поставить предмет (onTopOf в data.js).
const SURFACE_HEIGHT = { desk: 0.79, designDesk: 0.76 };

const WALL_T = 0.12; // толщина стен
const SLAB = 0.3; // толщина пола (виден на срезе)

const lambert = (opts) => new THREE.MeshLambertMaterial({ flatShading: true, ...opts });

// Коробка, у которой y — это низ, а не центр (так удобнее ставить на пол).
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

function cylinder(rTop, rBottom, h, mat, x = 0, y = 0, z = 0, segments = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

// На что можно сесть: высота сиденья, насколько оно сдвинуто вперёд от центра клетки
// и откуда к нему подходить (approach: минус — сзади, как к стулу у стола;
// плюс — спереди, как к дивану у стены). Должно совпадать с размерами в builders ниже.
const SEATS = {
  chair: { height: 0.49, forward: 0.12, approach: -0.45 },
  designChair: { height: 0.49, forward: 0.12, approach: -0.45 },
  sofa: { height: 0.46, forward: 0.055, approach: 0.55 },
};

// Точка посадки на предмет: { position, approach, yaw }. Для длинных предметов (диван)
// берётся клетка, ближайшая к nearCell — туда, откуда персонаж подошёл.
export function seatPoint(item, nearCell) {
  const seat = SEATS[item.type];
  if (!seat) return null;
  let cell = item.cells[0];
  if (nearCell && item.cells.length > 1) {
    const d = (c) => Math.hypot(c[0] - nearCell[0], c[1] - nearCell[1]);
    cell = item.cells.reduce((a, b) => (d(b) < d(a) ? b : a));
  }
  const yaw = FACING_ANGLE[item.facing || 'south'];
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const x = cell[0] + 0.5 + fx * seat.forward;
  const z = cell[1] + 0.5 + fz * seat.forward;
  return {
    position: new THREE.Vector3(x, seat.height, z),
    approach: new THREE.Vector3(x + fx * seat.approach, 0, z + fz * seat.approach),
    yaw,
  };
}

// Прямоугольник клеток, которые занимает предмет.
export function footprint(cells) {
  const cs = cells.map((c) => c[0]);
  const rs = cells.map((c) => c[1]);
  const minC = Math.min(...cs), maxC = Math.max(...cs);
  const minR = Math.min(...rs), maxR = Math.max(...rs);
  return {
    x: (minC + maxC + 1) / 2,
    z: (minR + maxR + 1) / 2,
    sizeX: maxC - minC + 1,
    sizeZ: maxR - minR + 1,
  };
}

// ---------- Мебель ----------
// Каждая функция строит предмет в своей системе координат:
// центр занятых клеток в нуле, «лицо» смотрит на +Z, спина — к −Z (к стене).
// w — ширина в клетках (поперёк взгляда), d — глубина.
const builders = {
  desk({ w, d }, m) {
    const g = new THREE.Group();
    const depth = 0.7, top = 0.74, W = w - 0.1;
    const zc = -d / 2 + depth / 2 + 0.04;
    g.add(box(W, 0.05, depth, m.wood, 0, top, zc));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        g.add(box(0.06, top, 0.06, m.woodDark, sx * (W / 2 - 0.05), 0, zc + sz * (depth / 2 - 0.05)));
      }
    }
    // тумба с ящиками слева
    g.add(box(0.42, 0.6, depth - 0.08, m.wood, -W / 2 + 0.26, top - 0.6, zc));
    g.add(box(0.3, 0.03, 0.02, m.woodDark, -W / 2 + 0.26, top - 0.2, zc + depth / 2 - 0.03));
    g.add(box(0.3, 0.03, 0.02, m.woodDark, -W / 2 + 0.26, top - 0.45, zc + depth / 2 - 0.03));
    return g;
  },

  computer(_, m) {
    // ЭЛТ-монитор, клавиатура, мышь. Ставится на стол (onTopOf).
    const g = new THREE.Group();
    g.add(box(0.3, 0.03, 0.26, m.plastic, 0, 0, -0.14));
    g.add(box(0.48, 0.42, 0.32, m.plastic, 0, 0.03, -0.14));
    g.add(box(0.34, 0.3, 0.16, m.plastic, 0, 0.08, -0.37));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.3), m.screen);
    scr.position.set(0, 0.25, 0.021);
    g.add(scr);
    g.add(box(0.44, 0.025, 0.14, m.plastic, 0, 0, 0.13));
    g.add(box(0.06, 0.025, 0.09, m.plastic, 0.32, 0, 0.13));
    return g;
  },

  chair(_, m) {
    // Чуть придвинут к столу (вперёд по взгляду).
    const g = new THREE.Group();
    const z = 0.12;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) g.add(box(0.04, 0.43, 0.04, m.woodDark, sx * 0.19, 0, z + sz * 0.18));
    }
    g.add(box(0.46, 0.06, 0.44, m.seat, 0, 0.43, z));
    g.add(box(0.46, 0.46, 0.05, m.wood, 0, 0.49, z - 0.2));
    return g;
  },

  bookshelf({ d }, m) {
    const g = new THREE.Group();
    const W = 0.9, D = 0.32, H = 1.9;
    const zc = -d / 2 + D / 2 + 0.02;
    g.add(box(0.04, H, D, m.wood, -W / 2 + 0.02, 0, zc));
    g.add(box(0.04, H, D, m.wood, W / 2 - 0.02, 0, zc));
    g.add(box(W - 0.06, H, 0.02, m.woodDark, 0, 0, zc - D / 2 + 0.01)); // задняя стенка
    const shelves = [0.04, 0.5, 0.96, 1.42, H - 0.04];
    const rnd = tex.random(5);
    shelves.forEach((y, i) => {
      g.add(box(W - 0.04, 0.04, D - 0.02, m.wood, 0, y - 0.02, zc));
      if (i === shelves.length - 1) return;
      let x = -W / 2 + 0.06;
      while (x < W / 2 - 0.12) {
        const bw = 0.04 + rnd() * 0.05;
        const bh = 0.22 + rnd() * 0.16;
        if (rnd() < 0.12) { x += 0.05; continue; } // промежуток
        g.add(box(bw - 0.005, bh, D * 0.7, m.books[Math.floor(rnd() * m.books.length)], x + bw / 2, y + 0.02, zc + 0.03));
        x += bw;
      }
    });
    return g;
  },

  sofa({ w, d }, m) {
    const g = new THREE.Group();
    const W = w - 0.1, D = 0.85;
    const zc = -d / 2 + D / 2 + 0.03;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) g.add(box(0.06, 0.08, 0.06, m.woodDark, sx * (W / 2 - 0.08), 0, zc + sz * (D / 2 - 0.08)));
    }
    g.add(box(W, 0.26, D, m.sofa, 0, 0.08, zc));
    const cw = (W - 0.4) / 2;
    for (const sx of [-1, 1]) g.add(box(cw - 0.02, 0.12, D - 0.24, m.sofaLight, sx * (cw / 2), 0.34, zc + 0.1));
    g.add(box(W, 0.5, 0.22, m.sofa, 0, 0.34, zc - D / 2 + 0.11));
    for (const sx of [-1, 1]) g.add(box(0.2, 0.28, D, m.sofa, sx * (W / 2 - 0.1), 0.34, zc));
    return g;
  },

  floorLamp(_, m, item, lights) {
    const g = new THREE.Group();
    const o = -0.15; // сдвиг в угол клетки
    g.add(cylinder(0.17, 0.19, 0.04, m.metal, o, 0, o));
    g.add(cylinder(0.02, 0.02, 1.38, m.metal, o, 0.04, o, 6));
    g.add(cylinder(0.12, 0.22, 0.3, m.shade, o, 1.36, o));
    const light = new THREE.PointLight(item.lightColor || '#ffc477', 2.2, 4.5, 1);
    light.position.set(o, 1.4, o);
    g.add(light);
    lights.push(light);
    return g;
  },

  rug({ w, d }, m) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, d * 0.88), m.rug);
    plane.rotation.x = -Math.PI / 2;
    // Чуть выше пола, иначе пол и ковёр «спорят», кто ближе к камере, и ковёр мигает.
    plane.position.y = 0.02;
    plane.userData.noSnap = true;
    const g = new THREE.Group();
    g.add(plane);
    return g;
  },

  window(_, m) {
    // Окно в своей системе: стена — плоскость z = 0, комната — в сторону +Z.
    const g = new THREE.Group();
    const y0 = 1.0, H = 1.0, W = 0.9;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, H - 0.08), m.sky);
    glass.position.set(0, y0 + H / 2, 0.01);
    g.add(glass);
    g.add(box(W, 0.06, 0.08, m.frame, 0, y0, 0.03));
    g.add(box(W, 0.06, 0.08, m.frame, 0, y0 + H - 0.06, 0.03));
    g.add(box(0.06, H, 0.08, m.frame, -W / 2 + 0.03, y0, 0.03));
    g.add(box(0.06, H, 0.08, m.frame, W / 2 - 0.03, y0, 0.03));
    g.add(box(0.04, H, 0.05, m.frame, 0, y0, 0.03));
    g.add(box(W, 0.04, 0.05, m.frame, 0, y0 + H / 2, 0.03));
    g.add(box(W + 0.12, 0.04, 0.16, m.frame, 0, y0 - 0.04, 0.07));
    return g;
  },

  // ---------- «домик щелочи» ----------

  designDesk({ w, d }, m) {
    // Длинный белый стол на чёрных металлических рамах, посередине — растение и лампа.
    const g = new THREE.Group();
    const depth = 0.7, top = 0.725, W = w - 0.1;
    const zc = -d / 2 + depth / 2 + 0.04;
    g.add(box(W, 0.035, depth, m.deskTop, 0, top, zc));
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.12);
      for (const sz of [-1, 1]) g.add(box(0.035, top, 0.035, m.metalBlack, x, 0, zc + sz * (depth / 2 - 0.08)));
      g.add(box(0.035, 0.035, depth - 0.12, m.metalBlack, x, 0.06, zc)); // перекладина внизу
      g.add(box(0.035, 0.035, depth - 0.12, m.metalBlack, x, top - 0.04, zc)); // и под столешницей
    }
    g.add(box(W - 0.24, 0.03, 0.03, m.metalBlack, 0, top - 0.04, zc - depth / 2 + 0.08)); // царга сзади
    // растение в горшке
    const y = top + 0.035;
    g.add(cylinder(0.08, 0.065, 0.14, m.pot, -0.12, y, zc - 0.12));
    for (let i = 0; i < 5; i++) {
      const leaf = box(0.16, 0.012, 0.07, m.leaf, 0, 0, 0);
      leaf.position.set(-0.12 + Math.cos(i * 1.3) * 0.07, y + 0.18 + (i % 3) * 0.04, zc - 0.12 + Math.sin(i * 1.3) * 0.07);
      leaf.rotation.set(0.5 * Math.sin(i * 2.1), i * 1.3, 0.5);
      g.add(leaf);
    }
    // настольная лампа
    g.add(cylinder(0.06, 0.07, 0.02, m.metalBlack, 0.16, y, zc - 0.14));
    const arm = box(0.015, 0.36, 0.015, m.metalBlack, 0.16, y + 0.02, zc - 0.14);
    arm.rotation.z = -0.25;
    g.add(arm);
    const head = cylinder(0.035, 0.07, 0.08, m.metalBlack, 0.24, y + 0.32, zc - 0.14);
    g.add(head);
    // кружка
    g.add(cylinder(0.035, 0.035, 0.08, m.mug, 0.05, y, zc + 0.12));
    return g;
  },

  macbook(_, m, item) {
    // Серебристый ноутбук с открытой крышкой. Ставится на стол (onTopOf).
    // Что на экране — поле screen в data.js: 'design' (макет) или 'code' (код).
    const g = new THREE.Group();
    const W = 0.34, D = 0.24, z0 = 0.04;
    g.add(box(W, 0.014, D, m.silver, 0, 0, z0));
    const keys = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, 0.1), m.keys);
    keys.rotation.x = -Math.PI / 2;
    keys.position.set(0, 0.0145, z0 - 0.03);
    g.add(keys);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), m.silverDark);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.0145, z0 + 0.075);
    g.add(pad);
    // крышка поворачивается вокруг петли у задней кромки
    const lid = new THREE.Group();
    lid.position.set(0, 0.014, z0 - D / 2);
    lid.rotation.x = -0.28; // отклонена назад
    lid.add(box(W, 0.23, 0.008, m.silver, 0, 0, -0.004));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, 0.2), item.screen === 'code' ? m.screen : m.designScreen);
    scr.position.set(0, 0.118, 0.0005);
    lid.add(scr);
    g.add(lid);
    return g;
  },

  designChair(_, m, item) {
    // Стул с пластиковой «чашей» на деревянных ножках. Сиденье — на той же высоте,
    // что у обычного стула (см. SEATS), чтобы персонаж садился ровно.
    const g = new THREE.Group();
    const z = 0.12;
    const shell = item.color ? lambert({ color: item.color }) : m.shell;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = box(0.035, 0.45, 0.035, m.woodLight, sx * 0.17, 0, z + sz * 0.16);
        leg.rotation.set(sz * -0.08, 0, sx * 0.08); // ножки чуть разведены
        g.add(leg);
      }
    }
    g.add(box(0.46, 0.06, 0.44, shell, 0, 0.43, z));
    g.add(box(0.46, 0.06, 0.06, shell, 0, 0.47, z + 0.2)); // загнутый передний край
    const back = box(0.46, 0.34, 0.04, shell, 0, 0, 0);
    back.position.set(0, 0.66, z - 0.22);
    back.rotation.x = -0.12;
    g.add(back);
    return g;
  },

  bookcase({ w, d }, m) {
    // Высокий шкаф с книгами: две секции, на некоторых полках — коробки и горшки.
    const g = new THREE.Group();
    const W = w - 0.15, D = 0.36, H = 2.05;
    const zc = -d / 2 + D / 2 + 0.02;
    for (const x of [-W / 2 + 0.02, 0, W / 2 - 0.02]) g.add(box(0.04, H, D, m.case, x, 0, zc));
    g.add(box(W - 0.06, H, 0.02, m.caseBack, 0, 0, zc - D / 2 + 0.01));
    const shelves = [0.04, 0.45, 0.86, 1.27, 1.68, H - 0.02];
    const rnd = tex.random(9);
    shelves.forEach((y, i) => {
      g.add(box(W - 0.04, 0.04, D - 0.02, m.case, 0, y - 0.02, zc));
      if (i === shelves.length - 1) return;
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -W / 2 + 0.05 : 0.03;
        const x1 = side < 0 ? -0.03 : W / 2 - 0.05;
        const deco = rnd();
        let x = x0;
        if (deco < 0.2) {
          // коробка
          g.add(box(0.26, 0.2, D * 0.75, m.boxes, x + 0.14, y + 0.02, zc + 0.02));
          x += 0.32;
        } else if (deco < 0.35) {
          // горшок с растением
          g.add(cylinder(0.06, 0.05, 0.11, m.pot, x1 - 0.08, y + 0.02, zc));
          g.add(cylinder(0.0, 0.08, 0.16, m.leaf, x1 - 0.08, y + 0.13, zc, 5));
        }
        const end = deco >= 0.2 && deco < 0.35 ? x1 - 0.17 : x1;
        while (x < end - 0.04) {
          const bw = 0.035 + rnd() * 0.05;
          const bh = 0.2 + rnd() * 0.15;
          if (rnd() < 0.1) { x += 0.05; continue; }
          g.add(box(bw - 0.005, bh, D * 0.7, m.books[Math.floor(rnd() * m.books.length)], x + bw / 2, y + 0.02, zc + 0.03));
          x += bw;
        }
      }
    });
    return g;
  },

  wardrobe({ w, d }, m, item) {
    // Шкаф для одежды: две двери, на правой — зеркало.
    const g = new THREE.Group();
    const W = w - 0.12, D = 0.6, H = 2.15;
    const zc = -d / 2 + D / 2 + 0.03;
    const grain = tex.repeated(tex.wood(item.color || '#cdb28a'), 2, 3); // мельче рисунок на высоком шкафу
    const body = lambert({ map: grain });
    const door = lambert({ map: grain, color: '#f2ece4' });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) g.add(box(0.05, 0.08, 0.05, m.metalBlack, sx * (W / 2 - 0.06), 0, zc + sz * (D / 2 - 0.06)));
    }
    g.add(box(W, H - 0.08, D, body, 0, 0.08, zc));
    g.add(box(W + 0.04, 0.05, D + 0.04, body, 0, H - 0.01, zc)); // карниз
    const dw = W / 2 - 0.03;
    for (const sx of [-1, 1]) {
      const x = sx * (dw / 2 + 0.01);
      g.add(box(dw, H - 0.22, 0.02, door, x, 0.15, zc + D / 2));
      g.add(box(0.02, 0.32, 0.03, m.metalBlack, sx * 0.06, 1.0, zc + D / 2 + 0.02)); // ручка
    }
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.2, H - 0.6), m.mirror);
    mirror.position.set(dw / 2 + 0.01, 0.15 + (H - 0.22) / 2, zc + D / 2 + 0.011);
    g.add(mirror);
    return g;
  },

  plant(_, m) {
    // Большое растение в горшке.
    const g = new THREE.Group();
    g.add(cylinder(0.2, 0.16, 0.38, m.pot, 0, 0, 0, 8));
    g.add(cylinder(0.18, 0.18, 0.02, m.soil, 0, 0.36, 0, 8));
    const rnd = tex.random(13);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const h = 0.6 + rnd() * 0.7;
      const r = 0.12 + rnd() * 0.2;
      const stem = box(0.02, h - 0.3, 0.02, m.leafDark, 0, 0, 0);
      stem.position.set(Math.cos(a) * r * 0.5, 0.38, Math.sin(a) * r * 0.5);
      stem.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
      g.add(stem);
      const leaf = box(0.34, 0.015, 0.24, i % 2 ? m.leaf : m.leafDark, 0, 0, 0);
      leaf.position.set(Math.cos(a) * r, 0.38 + h - 0.3, Math.sin(a) * r);
      leaf.rotation.set(0, -a, 0.45);
      g.add(leaf);
    }
    return g;
  },

  panoramicWindow({ w }, m) {
    // Окно во всю стену: стекло с видом на город и чёрная рама с переплётами.
    // Стена — плоскость z = 0, комната — в сторону +Z.
    const g = new THREE.Group();
    const y0 = 0.12, H = 2.3, W = w - 0.1;
    const view = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex.cityView(w) }));
    view.position.set(0, y0 + H / 2, 0.015);
    view.userData.noSnap = true; // плоско лежит на стене — без дрожания, иначе стена его перекрывает
    g.add(view);
    const bar = 0.06, deep = 0.06;
    g.add(box(W + bar, bar, deep, m.metalBlack, 0, y0 - bar / 2, deep / 2));
    g.add(box(W + bar, bar, deep, m.metalBlack, 0, y0 + H - bar / 2, deep / 2));
    g.add(box(W + bar, 0.035, deep, m.metalBlack, 0, y0 + H * 0.78, deep / 2)); // фрамуга
    for (let i = 0; i <= w; i++) {
      const x = -W / 2 + (W * i) / w;
      g.add(box(i === 0 || i === w ? bar : 0.035, H, deep, m.metalBlack, x, y0, deep / 2));
    }
    g.add(box(W + 0.14, 0.04, 0.16, m.deskTop, 0, y0 - 0.06, 0.08)); // подоконник
    return g;
  },

  poster(_, m, item) {
    // Плакат в тонкой рамке. Текст и цвета — в data.js (title, lines, color, textColor).
    const g = new THREE.Group();
    const W = 0.66, H = 0.88, y = item.height || 1.75;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(W, H), lambert({ map: tex.poster(item) }));
    paper.position.set(0, y, 0.025);
    paper.userData.noSnap = true;
    g.add(paper);
    const f = 0.03;
    g.add(box(W + f * 2, f, 0.03, m.metalBlack, 0, y + H / 2, 0.015));
    g.add(box(W + f * 2, f, 0.03, m.metalBlack, 0, y - H / 2 - f, 0.015));
    g.add(box(f, H, 0.03, m.metalBlack, -W / 2 - f / 2, y - H / 2, 0.015));
    g.add(box(f, H, 0.03, m.metalBlack, W / 2 + f / 2, y - H / 2, 0.015));
    return g;
  },
};

// ---------- Сборка комнаты ----------
export function buildRoom(room, furniture) {
  const group = new THREE.Group();
  const lights = [];
  const objects = {}; // id предмета → его 3D-группа
  const { columns: C, rows: R, wallHeight: H, colors } = room;

  const t = {
    planks: tex.planks(colors.floor),
    wallpaper: tex.wallpaper(colors.wallpaper),
    wood: tex.wood(colors.wood),
  };

  const m = {
    floor: lambert({ map: tex.repeated(t.planks, C, R) }),
    slab: lambert({ color: '#3a2a26' }),
    cut: lambert({ color: colors.wallTop || '#efe6d2' }),
    wood: lambert({ map: t.wood }),
    woodDark: lambert({ map: t.wood, color: '#8a7a70' }),
    seat: lambert({ map: tex.fabric(colors.chairSeat || '#7a3b3b') }),
    plastic: lambert({ color: '#d9d0b8' }),
    screen: new THREE.MeshBasicMaterial({ map: tex.screen() }),
    metal: lambert({ color: '#3d3a40' }),
    shade: lambert({ color: '#f3dfb0', emissive: '#ffb850', emissiveIntensity: 0.55 }),
    frame: lambert({ color: '#f1ece2' }),
    sky: new THREE.MeshBasicMaterial({ map: tex.sky() }),
    deskTop: lambert({ color: '#eeebe4' }),
    metalBlack: lambert({ color: '#26252b' }),
    silver: lambert({ color: '#c6cad1' }),
    silverDark: lambert({ color: '#a9adb5' }),
    keys: lambert({ color: '#2e2f35' }),
    designScreen: new THREE.MeshBasicMaterial({ map: tex.designScreen() }),
    shell: lambert({ color: '#efece6' }),
    woodLight: lambert({ map: tex.wood('#c79a62') }),
    case: lambert({ color: '#f1eee8' }),
    caseBack: lambert({ color: '#d9d4ca' }),
    boxes: lambert({ color: '#b9a88a' }),
    pot: lambert({ color: '#c97a55' }),
    soil: lambert({ color: '#3b2a22' }),
    leaf: lambert({ color: '#4f8a4a' }),
    leafDark: lambert({ color: '#2f6338' }),
    mug: lambert({ color: '#e8833a' }),
    mirror: new THREE.MeshBasicMaterial({ map: tex.mirror() }),
    books: ['#9c3a32', '#2f5d8a', '#d1a63a', '#3d7a4a', '#6b4a8a', '#c9c2b0', '#2b2b30'].map((c) => lambert({ color: c })),
  };

  // Пол: плита толщиной SLAB, сверху доски (одна текстура на клетку).
  const floor = new THREE.Mesh(new THREE.BoxGeometry(C, SLAB, R), [m.slab, m.slab, m.floor, m.slab, m.slab, m.slab]);
  floor.position.set(C / 2, -SLAB / 2, R / 2);
  floor.userData.isFloor = true;
  floor.userData.noSnap = true; // без дрожания, иначе перекрывает ковёр (см. ps1.js)
  group.add(floor);

  // Стены. Порядок граней коробки: +X, −X, +Y (верх), −Y, +Z, −Z.
  // Внутренняя грань — в обоях, остальные — цвет «среза».
  function wall(x0, x1, z0, z1, h, innerFace, repeatW) {
    const inner = lambert({ map: tex.repeated(t.wallpaper, repeatW, h + SLAB) });
    const mats = [m.cut, m.cut, m.cut, m.cut, m.cut, m.cut];
    mats[innerFace] = inner;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h + SLAB, z1 - z0), mats);
    mesh.position.set((x0 + x1) / 2, (h - SLAB) / 2, (z0 + z1) / 2);
    // Стены — огромные плоскости, как пол: без дрожания, иначе при прыжке вершин
    // их плоскость «наклоняется» и перекрывает то, что висит на них (окно, плакат).
    mesh.userData.noSnap = true;
    group.add(mesh);
  }
  wall(-WALL_T, C, -WALL_T, 0, H, 4, C); // задняя (north), внутрь смотрит грань +Z
  wall(-WALL_T, 0, 0, R, H, 0, R); // левая (west), внутрь смотрит +X
  // Низкие «срезанные» передние стены, как в режиме «стены опущены».
  wall(-WALL_T, C + WALL_T, R, R + WALL_T, 0.22, 5, C);
  wall(C, C + WALL_T, -WALL_T, R, 0.22, 1, R);

  // Плинтусы
  group.add(box(C, 0.1, 0.03, m.woodDark, C / 2, 0, 0.015));
  group.add(box(0.03, 0.1, R, m.woodDark, 0.015, 0, R / 2));

  // Мебель
  for (const item of furniture) {
    const build = builders[item.type];
    if (!build) {
      console.warn(`В data.js есть предмет типа «${item.type}», но код не умеет его строить.`);
      continue;
    }
    const itemMats = {
      ...m,
      sofa: lambert({ map: tex.fabric(item.color || '#5b6e9c') }),
      sofaLight: lambert({ map: tex.fabric(item.color || '#5b6e9c'), color: '#e6e6e6' }),
      rug: lambert({ map: tex.rug(item.color || '#8c3b3b') }),
    };
    const fp = footprint(item.cells);
    let obj;
    if (item.wall) {
      // Предмет на стене: ставим на поверхность стены над указанной клеткой.
      // Ширина — сколько клеток вдоль стены занимает предмет (у панорамного окна — несколько).
      const w = item.wall === 'west' ? fp.sizeZ : fp.sizeX;
      obj = build({ w, d: 1 }, itemMats, item, lights);
      if (item.wall === 'west') {
        obj.position.set(0, 0, fp.z);
        obj.rotation.y = FACING_ANGLE.east;
      } else {
        obj.position.set(fp.x, 0, 0);
      }
    } else {
      const angle = FACING_ANGLE[item.facing || 'south'];
      const sideways = item.facing === 'east' || item.facing === 'west';
      const w = sideways ? fp.sizeZ : fp.sizeX;
      const d = sideways ? fp.sizeX : fp.sizeZ;
      obj = build({ w, d }, itemMats, item, lights);
      obj.position.set(fp.x, SURFACE_HEIGHT[item.onTopOf] || 0, fp.z);
      obj.rotation.y = angle;
    }
    obj.name = item.id;
    obj.userData = { furnitureId: item.id, interactive: Boolean(item.actions) };
    objects[item.id] = obj;
    group.add(obj);
  }

  return { group, lights, objects };
}
