import { clamp } from './math.js';

// October 8: a taxi skipper keeps a lookout. A surfaced diver beside an orange
// float is spotted only within what the weather lets a helmsman see, and the
// swerve starts after a human reaction time. Clear days therefore become near
// misses; fog, night, rain, a big sea or a diver popping up close ahead remain
// genuinely dangerous. Underwater divers are never spotted (only bubbles show).
export const TAXI_LOOKOUT = {
  range: 70,
  nightRange: 30,
  reaction: 1,
  clearance: 6,
};

export function taxiLookoutRange(w) {
  const weather = w.weather || {};
  let range = Math.min(TAXI_LOOKOUT.range, weather.visibility ?? TAXI_LOOKOUT.range);
  if (weather.night) range = Math.min(range, TAXI_LOOKOUT.nightRange);
  range *= clamp(1 - (weather.wave ?? 0) / 3, 0.35, 1);
  range *= 1 - 0.3 * clamp(weather.rain ?? 0, 0, 1);
  return range;
}

// Surfaced divers this taxi has seen for at least its reaction time, as
// steering-only obstacles: the taxi bends around them at speed, it never stops.
export function spottedDivers(w, actor) {
  const range = taxiLookoutRange(w),
    seen = (actor.lookout ??= {}),
    spotted = [];
  for (const d of w.divers) {
    const key = d.id ?? w.divers.indexOf(d);
    if (d.state !== 'surface' || Math.hypot(d.x - actor.x, d.y - actor.y) > range) {
      if (d.state !== 'surface') delete seen[key];
      continue;
    }
    seen[key] ??= w.time;
    if (w.time - seen[key] >= TAXI_LOOKOUT.reaction)
      spotted.push({ x: d.x, y: d.y, id: `diver-${key}`, radius: TAXI_LOOKOUT.clearance });
  }
  return spotted;
}
