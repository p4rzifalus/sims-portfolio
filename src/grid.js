// Сетка клеток: какие свободны, какие заняты мебелью.
// Плюс отладочный слой (клавиша G): линии клеток, занятые клетки красным,
// подписи [столбец, ряд] и текущий маршрут персонажа.
import * as THREE from 'three';

export function createGrid(room, furniture) {
  const { columns, rows } = room;
  const blocked = Array.from({ length: rows }, () => Array(columns).fill(false));
  for (const f of furniture) {
    if (!f.blocks) continue;
    for (const [c, r] of f.cells) if (c >= 0 && c < columns && r >= 0 && r < rows) blocked[r][c] = true;
  }
  return {
    columns,
    rows,
    blocked,
    inside: (c, r) => c >= 0 && c < columns && r >= 0 && r < rows,
    isFree(c, r) {
      return this.inside(c, r) && !blocked[r][c];
    },
    cellCenter: (c, r) => new THREE.Vector3(c + 0.5, 0, r + 0.5),
    worldToCell: (x, z) => [Math.floor(x), Math.floor(z)],
  };
}

export function createDebugOverlay(grid, labelsRoot) {
  const group = new THREE.Group();
  group.visible = false;
  group.renderOrder = 10;
  const onTop = { transparent: true, depthTest: false, depthWrite: false };

  // Линии сетки
  const pts = [];
  const y = 0.02;
  for (let c = 0; c <= grid.columns; c++) pts.push(c, y, 0, c, y, grid.rows);
  for (let r = 0; r <= grid.rows; r++) pts.push(0, y, r, grid.columns, y, r);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#ffffff', opacity: 0.6, ...onTop }));
  lines.renderOrder = 10;
  group.add(lines);

  // Занятые клетки
  const red = new THREE.MeshBasicMaterial({ color: '#ff3040', opacity: 0.45, ...onTop });
  const cellGeo = new THREE.PlaneGeometry(0.9, 0.9);
  cellGeo.rotateX(-Math.PI / 2);
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.columns; c++) {
      if (!grid.blocked[r][c]) continue;
      const m = new THREE.Mesh(cellGeo, red);
      m.position.set(c + 0.5, y, r + 0.5);
      m.renderOrder = 9;
      group.add(m);
    }
  }

  // Маршрут (заполнится на этапе 2)
  const pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#40ff90', ...onTop }));
  pathLine.renderOrder = 11;
  group.add(pathLine);

  // Подписи клеток — обычный HTML поверх картинки, чтобы читались при любом разрешении.
  const labels = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.columns; c++) {
      const el = document.createElement('div');
      el.className = 'cell-label' + (grid.blocked[r][c] ? ' blocked' : '');
      el.textContent = `${c},${r}`;
      labelsRoot.appendChild(el);
      labels.push({ el, pos: grid.cellCenter(c, r) });
    }
  }

  return {
    group,
    get visible() {
      return group.visible;
    },
    setVisible(v) {
      group.visible = v;
      labelsRoot.style.display = v ? 'block' : 'none';
    },
    toggle() {
      this.setVisible(!group.visible);
    },
    // points — массив Vector3 (центры клеток маршрута)
    setPath(points) {
      pathLine.geometry.setFromPoints(points.map((p) => new THREE.Vector3(p.x, y + 0.01, p.z)));
    },
    // Поставить HTML-подписи над центрами клеток. toScreen(vec3) → {x, y} в CSS-пикселях.
    updateLabels(toScreen) {
      if (!group.visible) return;
      for (const { el, pos } of labels) {
        const s = toScreen(pos);
        el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
      }
    },
  };
}
