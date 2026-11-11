// Поиск пути по клеткам (алгоритм A*): ищет кратчайший маршрут в обход занятых клеток.
// Ходить можно в 8 направлениях, но по диагонали — только если не срезаешь угол мебели.

const SQ2 = Math.SQRT2;
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2],
];

// Оценка расстояния «напрямую» с учётом диагоналей.
function octile(c, r, gc, gr) {
  const dx = Math.abs(c - gc), dy = Math.abs(r - gr);
  return Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy);
}

// start, goal — [столбец, ряд]. Возвращает список клеток от start до goal или null.
export function findPath(grid, start, goal) {
  const W = grid.columns;
  const key = (c, r) => r * W + c;
  const [gc, gr] = goal;
  if (!grid.isFree(gc, gr)) return null;

  const open = [{ c: start[0], r: start[1], g: 0, f: octile(start[0], start[1], gc, gr) }];
  const best = new Map([[key(start[0], start[1]), 0]]);
  const came = new Map();
  const closed = new Set();

  while (open.length) {
    // берём самую многообещающую клетку (при равенстве — ту, что ближе к цели)
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i], b = open[bi];
      if (a.f < b.f - 1e-9 || (Math.abs(a.f - b.f) < 1e-9 && a.f - a.g < b.f - b.g)) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.c, cur.r);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (cur.c === gc && cur.r === gr) {
      const path = [[gc, gr]];
      let k = ck;
      while (came.has(k)) {
        k = came.get(k);
        path.unshift([k % W, Math.floor(k / W)]);
      }
      return path;
    }

    for (const [dc, dr, cost] of DIRS) {
      const nc = cur.c + dc, nr = cur.r + dr;
      if (!grid.isFree(nc, nr)) continue;
      if (dc && dr && (!grid.isFree(cur.c + dc, cur.r) || !grid.isFree(cur.c, cur.r + dr))) continue;
      const nk = key(nc, nr);
      const g = cur.g + cost;
      if (g >= (best.get(nk) ?? Infinity)) continue;
      best.set(nk, g);
      came.set(nk, ck);
      open.push({ c: nc, r: nr, g, f: g + octile(nc, nr, gc, gr) });
    }
  }
  return null;
}

// Ближайшая свободная клетка к [c, r]. При равенстве — та, что ближе к from.
export function nearestFreeCell(grid, c, r, from) {
  let best = null, bestD = Infinity, bestFrom = Infinity;
  for (let rr = 0; rr < grid.rows; rr++) {
    for (let cc = 0; cc < grid.columns; cc++) {
      if (!grid.isFree(cc, rr)) continue;
      const d = Math.hypot(cc - c, rr - r);
      const df = from ? Math.hypot(cc - from[0], rr - from[1]) : 0;
      if (d < bestD - 1e-6 || (Math.abs(d - bestD) < 1e-6 && df < bestFrom)) {
        best = [cc, rr];
        bestD = d;
        bestFrom = df;
      }
    }
  }
  return best;
}
