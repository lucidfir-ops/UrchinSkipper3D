import { waterRoute, waterSegment } from './water-route.js';

// Commit to a straight run through a sampled working position. Approach and
// departure may bend around land; the crossing never follows a moving diver.
export function taxiRoute(w, entry, working, entries, spec) {
  const base = Math.atan2(working.y - entry.y, working.x - entry.x),
    level = w.environment.seaLevel || 0;
  for (const offset of [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2]) {
    const angle = base + offset,
      dx = Math.cos(angle),
      dy = Math.sin(angle),
      before = { x: working.x - dx * 40, y: working.y - dy * 40 },
      after = { x: working.x + dx * 60, y: working.y + dy * 60 };
    if (!waterSegment(w.terrain, level, before, after, spec)) continue;
    const approach = waterRoute(w, entry, before, spec);
    if (!approach.length) continue;
    const exits = entries
      .filter(
        (p) =>
          (p.x - after.x) * dx + (p.y - after.y) * dy > 0 &&
          Math.hypot(p.x - entry.x, p.y - entry.y) > w.terrain.size * 0.6,
      )
      .sort((a, b) => {
        const score = (p) =>
          Math.abs((p.x - after.x) * dy - (p.y - after.y) * dx) * 3 +
          Math.hypot(p.x - after.x, p.y - after.y);
        return score(a) - score(b);
      });
    for (const end of exits.slice(0, 3)) {
      const departure = waterRoute(w, after, end, spec);
      if (departure.length) return [...approach, { ...working }, after, ...departure];
    }
  }
  return [];
}

const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};
export const DRIVE_BY = { min: 14, max: 22, diverClearance: 14 };

// October 5: a committed straight run that passes the player's boat at a close
// lateral distance instead of through the divers' bubbles. The pass point is
// chosen at spawn (never retargeted) and perpendicular to whichever run angle
// is navigable, on the side that keeps the straight run clear of divers.
export function taxiDriveBy(w, entry, boat, entries, spec, { distance, side, avoid = [] }) {
  const base = Math.atan2(boat.y - entry.y, boat.x - entry.x),
    level = w.environment.seaLevel || 0;
  for (const offset of [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3])
    for (const s of [side, -side])
      for (const gap of [distance, distance + 10]) {
        const angle = base + offset,
          dx = Math.cos(angle),
          dy = Math.sin(angle),
          point = { x: boat.x - dy * gap * s, y: boat.y + dx * gap * s },
          before = { x: point.x - dx * 40, y: point.y - dy * 40 },
          after = { x: point.x + dx * 60, y: point.y + dy * 60 };
        if (avoid.some((p) => segmentDistance(p, before, after) < DRIVE_BY.diverClearance))
          continue;
        if (!waterSegment(w.terrain, level, before, after, spec)) continue;
        const approach = waterRoute(w, entry, before, spec);
        if (!approach.length) continue;
        const exits = entries
          .filter(
            (p) =>
              (p.x - after.x) * dx + (p.y - after.y) * dy > 0 &&
              Math.hypot(p.x - entry.x, p.y - entry.y) > w.terrain.size * 0.6,
          )
          .sort((a, b) => {
            const score = (p) =>
              Math.abs((p.x - after.x) * dy - (p.y - after.y) * dx) * 3 +
              Math.hypot(p.x - after.x, p.y - after.y);
            return score(a) - score(b);
          });
        for (const end of exits.slice(0, 3)) {
          const departure = waterRoute(w, after, end, spec);
          if (departure.length) return { route: [...approach, point, after, ...departure], point };
        }
      }
  return null;
}
