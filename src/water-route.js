import { bedDepthAt } from './terrain.js';
import { fixedFeatures } from './shore-hazards.js';
import { rockCanHit } from './rock-depth.js';
import { SpatialBins } from './spatial-bins.js';

// A small, cached water graph for other boats only. Diver searching is unchanged.
const grids = new WeakMap();
const obstacles = new WeakMap();
const neighbours = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const clearancePoints = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7, 0.7],
  [-0.7, 0.7],
  [0.7, -0.7],
  [-0.7, -0.7],
];
function rockIndex(terrain) {
  if (obstacles.has(terrain)) return obstacles.get(terrain);
  const bins = new SpatialBins(20);
  let reach = 0;
  for (const rock of fixedFeatures(terrain)) {
    bins.add(rock);
    reach = Math.max(reach, rock.radius + rock.length / 2);
  }
  const index = { bins, reach };
  obstacles.set(terrain, index);
  return index;
}
export function clearWater(terrain, level, point, { draft = 2, radius = 5 } = {}) {
  if (
    point.x < radius ||
    point.y < radius ||
    point.x > terrain.size - radius ||
    point.y > terrain.size - radius
  )
    return false;
  const { bins, reach } = rockIndex(terrain);
  if (
    bins.some(
      point.x,
      point.y,
      radius + reach,
      (rock) =>
        rockCanHit(rock, level, draft) &&
        Math.hypot(point.x - rock.x, point.y - rock.y) < radius + rock.radius + rock.length / 2,
    )
  )
    return false;
  for (const [dx, dy] of clearancePoints)
    if (bedDepthAt(terrain, point.x + dx * radius, point.y + dy * radius) + level < draft)
      return false;
  return true;
}
export function waterSegment(terrain, level, a, b, spec) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let i = 0; i <= steps; i++)
    if (
      !clearWater(
        terrain,
        level,
        { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps },
        spec,
      )
    )
      return false;
  return true;
}
export function waterRoute(w, start, end, spec = {}) {
  const terrain = w.terrain,
    level = w.environment.seaLevel || 0;
  if (!clearWater(terrain, level, start, spec) || !clearWater(terrain, level, end, spec)) return [];
  if (waterSegment(terrain, level, start, end, spec)) return [{ ...end }];
  const safeLevel = Math.floor(level * 2) / 2,
    radius = spec.radius || 5,
    draft = spec.draft || 2,
    key = `${safeLevel}/${radius}/${draft}`,
    n = Math.ceil(terrain.size / 20),
    spacing = terrain.size / n;
  let cache = grids.get(terrain);
  if (!cache) grids.set(terrain, (cache = new Map()));
  let graph = cache.get(key);
  if (!graph) {
    graph = Array.from({ length: n * n }, (_, i) => {
      const p = { x: ((i % n) + 0.5) * spacing, y: (Math.floor(i / n) + 0.5) * spacing };
      return clearWater(terrain, safeLevel, p, spec) ? p : null;
    });
    if (cache.size >= 6) cache.delete(cache.keys().next().value);
    cache.set(key, graph);
  }
  const nearest = (point) => {
    const best = [];
    for (let i = 0; i < graph.length; i++) {
      const p = graph[i];
      if (!p) continue;
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      let at = best.length;
      while (at > 0 && best[at - 1].d > d) at--;
      if (at >= 12) continue;
      best.splice(at, 0, { p, i, d });
      if (best.length > 12) best.pop();
    }
    return best.find(({ p }) => waterSegment(terrain, level, point, p, spec))?.i;
  };
  const from = nearest(start),
    to = nearest(end);
  if (from === undefined || to === undefined) return [];
  const previous = (graph.previous ||= new Int32Array(graph.length)).fill(-1),
    queue = (graph.queue ||= new Int32Array(graph.length)),
    edges = (graph.edges ||= new Map());
  let tail = 1;
  queue[0] = from;
  previous[from] = from;
  for (let head = 0; head < tail && previous[to] === -1; head++) {
    const at = queue[head],
      x = at % n,
      y = Math.floor(at / n);
    for (const [dx, dy] of neighbours) {
      const xx = x + dx,
        yy = y + dy,
        next = yy * n + xx;
      if (xx < 0 || yy < 0 || xx >= n || yy >= n || !graph[next] || previous[next] !== -1) continue;
      // Water clearance is monotonic with rising tide. Store proven thresholds
      // per undirected edge; uncertain levels still use the exact live test.
      const edgeKey = Math.min(at, next) * graph.length + Math.max(at, next);
      let edge = edges.get(edgeKey);
      if (!edge) edges.set(edgeKey, (edge = { pass: Infinity, fail: -Infinity }));
      let safe = level >= edge.pass;
      if (!safe && level > edge.fail) {
        safe = waterSegment(terrain, level, graph[at], graph[next], spec);
        if (safe) edge.pass = Math.min(edge.pass, level);
        else edge.fail = Math.max(edge.fail, level);
      }
      if (!safe) continue;
      previous[next] = at;
      queue[tail++] = next;
    }
  }
  if (previous[to] === -1) return [];
  const reverse = [{ ...end }];
  for (let at = to; at !== from; at = previous[at]) reverse.push(graph[at]);
  reverse.push(graph[from]);
  const path = reverse.reverse(),
    result = [];
  let fromPoint = start;
  for (let i = 0; i < path.length;) {
    let far = i;
    while (far + 1 < path.length && waterSegment(terrain, level, fromPoint, path[far + 1], spec))
      far++;
    result.push(path[far]);
    fromPoint = path[far];
    i = far + 1;
  }
  return result;
}
export function waterEntries(w, spec = {}) {
  const size = w.terrain.size,
    inset = Math.max(8, spec.radius || 5),
    points = [];
  for (let t = 20; t < size; t += 40)
    points.push(
      { x: t, y: inset },
      { x: t, y: size - inset },
      { x: inset, y: t },
      { x: size - inset, y: t },
    );
  return points.filter((p) => clearWater(w.terrain, w.environment.seaLevel || 0, p, spec));
}
