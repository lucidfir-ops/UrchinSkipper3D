import { C } from './config.js';
export function toHull(pose, x, y) {
  const dx = x - pose.x,
    dy = y - pose.y,
    s = Math.sin(pose.heading),
    c = Math.cos(pose.heading);
  return { side: dx * c + dy * s, fore: dx * s - dy * c };
}
export function fromHull(pose, side, fore) {
  const s = Math.sin(pose.heading),
    c = Math.cos(pose.heading);
  return { x: pose.x + side * c + fore * s, y: pose.y + side * s - fore * c };
}
export function hullDistance(pose, x, y, spec = C.boat) {
  const q = toHull(pose, x, y);
  return Math.hypot(
    Math.max(0, Math.abs(q.side) - spec.width / 2),
    Math.max(0, Math.abs(q.fore) - spec.length / 2),
  );
}
export function sweptPoses(before, after, spec = C.boat) {
  const n = Math.max(
    1,
    Math.ceil(
      (Math.hypot(after.x - before.x, after.y - before.y) +
        (Math.abs(after.heading - before.heading) * spec.length) / 2) /
        0.2,
    ),
  );
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return {
      x: before.x + (after.x - before.x) * t,
      y: before.y + (after.y - before.y) * t,
      heading: before.heading + (after.heading - before.heading) * t,
    };
  });
}
// Exact segment/expanded-rectangle clipping, including logs parallel to an edge.
function clip(a, b, minSide, maxSide, minFore, maxFore) {
  let lo = 0,
    hi = 1;
  for (const [start, delta, min, max] of [
    [a.side, b.side - a.side, minSide, maxSide],
    [a.fore, b.fore - a.fore, minFore, maxFore],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (start < min || start > max) return null;
      continue;
    }
    let u = (min - start) / delta,
      v = (max - start) / delta;
    if (u > v) [u, v] = [v, u];
    lo = Math.max(lo, u);
    hi = Math.min(hi, v);
    if (lo > hi) return null;
  }
  const t = (lo + hi) / 2;
  return { side: a.side + (b.side - a.side) * t, fore: a.fore + (b.fore - a.fore) * t };
}
export function logContact(pose, log, driveOnly = false, spec = C.boat) {
  const dx = (Math.sin(log.heading) * log.length) / 2,
    dy = (-Math.cos(log.heading) * log.length) / 2,
    r = log.radius ?? 0.3;
  const a = toHull(pose, log.x - dx, log.y - dy),
    b = toHull(pose, log.x + dx, log.y + dy);
  return driveOnly
    ? clip(a, b, -1.3 - r, 1.3 + r, -spec.length / 2 - 0.6 - r, -spec.length / 2 + 0.8 + r)
    : clip(
        a,
        b,
        -spec.width / 2 - r,
        spec.width / 2 + r,
        -spec.length / 2 - r,
        spec.length / 2 + r,
      );
}
