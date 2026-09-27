import { boatSpec } from './boats.js';
import { recoveryStatus } from './diver-recovery.js';
import { clearWater, waterRoute } from './water-route.js';
import { depthAt } from './terrain.js';

const searches = new WeakMap();
export function pickupWater(w, point, spec = boatSpec(w)) {
  return clearWater(w.terrain, w.environment.seaLevel || 0, point, {
    draft: spec.draft + 0.15,
    radius: Math.hypot(spec.length, spec.width) / 2 + 1,
  });
}
export function swimToPickupWater(w, d, dt) {
  if (
    d.condition !== 'fit' ||
    d.hooking ||
    recoveryStatus(w, undefined, d).available ||
    pickupWater(w, d)
  ) {
    searches.delete(d);
    d.escapeRoute = null;
    d.swimmingClear = false;
    return;
  }
  let search = searches.get(d);
  if (!d.escapeRoute?.length && !search && w.time >= (d.nextEscapeSearch || 0)) {
    searches.set(d, (search = { x: d.x, y: d.y, cursor: 0, terrain: w.terrain }));
  }
  if (search && search.terrain !== w.terrain) {
    searches.delete(d);
    search = null;
  }
  if (search && !d.escapeRoute?.length) {
    const spec = boatSpec(w);
    let routes = 0;
    // Preserve candidate order, spread an unsuccessful 192-point search over
    // successive simulation ticks. Physical drift/recovery still run at 60 Hz.
    for (let budget = 0; budget < 24 && search.cursor < 192 && routes < 2; budget++) {
      const index = search.cursor++,
        radius = (Math.floor(index / 16) + 1) * 6,
        angle = ((index % 16) * Math.PI) / 8,
        point = { x: search.x + Math.cos(angle) * radius, y: search.y + Math.sin(angle) * radius };
      if (!pickupWater(w, point, spec)) continue;
      routes++;
      const route = waterRoute(w, d, point, { draft: 0.15, radius: 0.2 });
      if (route.length) {
        d.escapeRoute = route;
        break;
      }
    }
    if (d.escapeRoute?.length || search.cursor >= 192) {
      searches.delete(d);
      d.nextEscapeSearch = w.time + 3;
    }
  }
  const next = d.escapeRoute?.[0];
  d.swimmingClear = !!next;
  if (!next) return;
  const dx = next.x - d.x,
    dy = next.y - d.y,
    distance = Math.hypot(dx, dy);
  const move = Math.min(distance, 0.28 * dt);
  if (distance < 0.3) {
    d.escapeRoute.shift();
    return;
  }
  const x = d.x + (dx / distance) * move,
    y = d.y + (dy / distance) * move;
  if (depthAt(w, x, y) < 0.15) {
    d.escapeRoute = null;
    return;
  }
  d.x = x;
  d.y = y;
}
