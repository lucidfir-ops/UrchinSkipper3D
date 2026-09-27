import { boatSpec } from './boats.js';
import { angleDelta } from './math.js';

// Separating-axis test on the actual simulation rectangles, including edge
// crossings where no corner is inside the other hull. Returns A's escape vector.
export function vesselOverlap(a, as, b, bs, gap = 0.35) {
  const axes = (h) => [
      { x: Math.cos(h), y: Math.sin(h) },
      { x: Math.sin(h), y: -Math.cos(h) },
    ],
    aa = axes(a.heading),
    ba = axes(b.heading),
    radius = (s, basis, n) =>
      (Math.abs(basis[0].x * n.x + basis[0].y * n.y) * s.width) / 2 +
      (Math.abs(basis[1].x * n.x + basis[1].y * n.y) * s.length) / 2;
  let depth = Infinity,
    normal;
  for (const n of [...aa, ...ba]) {
    const delta = (a.x - b.x) * n.x + (a.y - b.y) * n.y,
      overlap = radius(as, aa, n) + radius(bs, ba, n) + gap - Math.abs(delta);
    if (overlap <= 0) return null;
    if (overlap < depth) {
      depth = overlap;
      normal = { x: n.x * (delta < 0 ? -1 : 1), y: n.y * (delta < 0 ? -1 : 1) };
    }
  }
  return { x: normal.x * (depth + 0.001), y: normal.y * (depth + 0.001) };
}
export function vesselObstacles(w, actor) {
  return [
    ...(actor === w.boat ? [] : [{ pose: w.boat, spec: boatSpec(w) }]),
    ...(w.traffic?.actors || [])
      .filter(
        (other) =>
          other !== actor &&
          !other.done &&
          !(actor === w.boat && other.target === 'player' && other.phase === 'inspection'),
      )
      .map((other) => ({ pose: other, spec: other })),
  ];
}
export function clearVesselPose(w, actor, before, after, spec = actor) {
  const obstacles = vesselObstacles(w, actor),
    turn = angleDelta(after.heading, before.heading),
    steps = Math.max(
      1,
      Math.ceil(
        (Math.hypot(after.x - before.x, after.y - before.y) + (Math.abs(turn) * spec.length) / 2) /
          0.3,
      ),
    );
  if (!obstacles.length) return { ...after, blocked: false };
  let pose = { x: before.x, y: before.y, heading: before.heading };
  // Restore old overlapping fixtures/saves without allowing sustained clipping.
  for (let n = 0; n < 4; n++)
    for (const o of obstacles) {
      const escape = vesselOverlap(pose, spec, o.pose, o.spec);
      if (escape) {
        pose.x += escape.x;
        pose.y += escape.y;
      }
    }
  for (let n = 1; n <= steps; n++) {
    const next = {
      x: before.x + ((after.x - before.x) * n) / steps,
      y: before.y + ((after.y - before.y) * n) / steps,
      heading: before.heading + (turn * n) / steps,
    };
    if (obstacles.some((o) => vesselOverlap(next, spec, o.pose, o.spec)))
      return { ...pose, blocked: true };
    pose = next;
  }
  return { ...pose, blocked: false };
}
