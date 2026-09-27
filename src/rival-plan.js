import { seededRandom } from './math.js';
import { clearWater, waterRoute } from './water-route.js';
import { workingPatches } from './rival-habits.js';
import { TRAFFIC } from './traffic-settings.js';

export const trafficHull = (actor) => ({
  draft: actor.draft,
  radius: actor.shallowEscape
    ? actor.width / 2 + 0.25
    : Math.hypot(actor.length, actor.width) / 2 + 0.5,
});

export function rivalWater(w) {
  const curve = w.environment.tideCurve,
    low = curve?.samples?.length
      ? Math.min(...curve.samples.map((p) => p.value))
      : curve
        ? (curve.mean || 0) -
          (curve.components || []).reduce((n, c) => n + Math.abs(c.amplitude), 0)
        : w.environment.seaLevel || 0;
  return {
    ...w,
    environment: { ...w.environment, seaLevel: Math.min(w.environment.seaLevel || 0, low) },
  };
}

// Day decisions survive sector changes/reloads through the fleet's shipSeen
// records. The same day cannot keep rolling for another close encounter.
export function rivalDayPlan(c) {
  const random = seededRandom(c.seed ^ Math.imul(c.day, 7393));
  return {
    limit: random() < 0.5 ? 1 : 2,
    nearby: random() < TRAFFIC.nearbyRivalChance,
    mystery: random() < TRAFFIC.mysteryChance,
  };
}

export function rivalPatches(w, nearby = false) {
  const occupied = new Set((w.traffic?.actors || []).map((a) => a.patchId)),
    worked = workingPatches(w),
    positions = [w.boat, ...worked, ...w.divers.filter((d) => d.state !== 'ready')],
    available = w.patches.filter(
      (p) =>
        p.remaining > 1 &&
        p.quality >= 0.6 &&
        !occupied.has(p.id) &&
        (nearby || positions.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= 140)),
    ),
    marked = available.filter((p) => p.charted !== false);
  // Exhaust safe, productive marked destinations before trying hidden ground.
  return [...marked, ...available.filter((p) => p.charted === false)];
}

export function fishingBerths(w, patch, actor) {
  const spec = trafficHull(actor),
    points = [];
  for (const radius of [22, 32, 42])
    for (let n = 0; n < 12; n++) {
      const angle = (n * Math.PI) / 6,
        p = { x: patch.x + Math.cos(angle) * radius, y: patch.y + Math.sin(angle) * radius };
      if (
        clearWater(w.terrain, w.environment.seaLevel || 0, p, spec) &&
        Math.hypot(p.x - w.boat.x, p.y - w.boat.y) > 24 &&
        !(w.traffic?.actors || []).some((a) => a !== actor && Math.hypot(p.x - a.x, p.y - a.y) < 24)
      )
        points.push(p);
    }
  return points;
}

export function fishingRoute(w, entry, patch, actor) {
  const berths = fishingBerths(actor.shallowEscape ? rivalWater(w) : w, patch, {
    ...actor,
    shallowEscape: false,
  }).sort(
    (a, b) => Math.hypot(a.x - entry.x, a.y - entry.y) - Math.hypot(b.x - entry.x, b.y - entry.y),
  );
  for (const berth of berths.slice(0, 12)) {
    const route = waterRoute(w, entry, berth, trafficHull(actor));
    if (route.length) return route;
  }
  return [];
}
