import { C } from './config.js';
import { currentAt } from './environment.js';
import { depthAt, clamp } from './terrain.js';

export function diverSlip(current, holdKnots = C.diver.holdCurrentKnots) {
  const speed = Math.hypot(current.x, current.y);
  const slip = Math.max(0, speed - holdKnots / C.knotsPerMps) * C.diver.currentSlip;
  return speed ? { x: (current.x * slip) / speed, y: (current.y * slip) / speed } : { x: 0, y: 0 };
}
function wetMove(w, d, dx, dy) {
  const x = d.x,
    y = d.y,
    steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.3));
  for (let n = 1; n <= steps; n++) {
    const nx = clamp(x + (dx * n) / steps, 1, w.terrain.size - 1),
      ny = clamp(y + (dy * n) / steps, 1, w.terrain.size - 1);
    if (depthAt(w, nx, ny) < C.diver.minDepth) break;
    d.x = nx;
    d.y = ny;
  }
}
export function driftUnderwater(w, d, dt) {
  const slip = diverSlip(currentAt(w, d.x, d.y), d.holdCurrentKnots);
  wetMove(w, d, slip.x * dt, slip.y * dt);
  d.currentDrift = Math.hypot(slip.x, slip.y);
}
export function moveOnBottom(w, d, x, y) {
  let dx = x - d.x,
    dy = y - d.y;
  const slip = diverSlip(currentAt(w, d.x, d.y), d.holdCurrentKnots),
    speed = Math.hypot(slip.x, slip.y);
  // Station keeping already spends the diver's upstream effort. Do not give
  // search/harvest locomotion a second upstream swim allowance in strong flow.
  if (speed && d.state !== 'harvesting') {
    const ux = slip.x / speed,
      uy = slip.y / speed,
      upstream = Math.min(0, dx * ux + dy * uy);
    dx -= upstream * ux;
    dy -= upstream * uy;
  }
  wetMove(w, d, dx, dy);
}
