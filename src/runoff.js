import { bedDepthAt, depthGradient, depthAt } from './terrain.js';
import { roll } from './career-data.js';
const cache = new WeakMap();
// Decorative streams follow existing land downhill. They do not carve terrain.
export function coastalRivers(terrain) {
  if (cache.has(terrain)) return cache.get(terrain);
  const rivers = [];
  for (let y = 18; y < terrain.size - 18 && rivers.length < 3; y += 18)
    for (let x = 18; x < terrain.size - 18 && rivers.length < 3; x += 18) {
      const bed = bedDepthAt(terrain, x, y);
      if (bed > -3 || bed < -14) continue;
      const points = [{ x, y }];
      let p = { x, y };
      for (let i = 0; i < 50; i++) {
        const g = depthGradient(terrain, p.x, p.y),
          n = Math.hypot(g.x, g.y);
        if (n < 0.02) break;
        p = { x: p.x + (g.x / n) * 2, y: p.y + (g.y / n) * 2 };
        points.push(p);
        if (bedDepthAt(terrain, p.x, p.y) > 2) break;
      }
      if (
        points.length < 6 ||
        bedDepthAt(terrain, p.x, p.y) < 2 ||
        rivers.some((r) => Math.hypot(r.mouth.x - p.x, r.mouth.y - p.y) < 100)
      )
        continue;
      rivers.push({ points, mouth: p });
    }
  cache.set(terrain, rivers);
  return rivers;
}
export function runoffActive(c, minute) {
  const plans = [{ day: c.day, periods: c.weatherPlan || [] }, c.previousWeatherPlan].filter(
    Boolean,
  );
  return plans.some((plan) =>
    plan.periods.some((p, i) => {
      if (!['rain', 'squall', 'storm'].includes(p.kind)) return false;
      const start = (plan.day - c.day) * 1440 + p.minute + 120;
      const end = (plan.day - c.day) * 1440 + (plan.periods[i + 1]?.minute ?? 1440) + 1080;
      return minute >= start && minute <= end;
    }),
  );
}
export function releaseRunoff(w) {
  if (!w.career || w.day.phase !== 'working' || !runoffActive(w.career, w.day.minute)) return 0;
  const releases = (w.day.runoffReleases ??= {}),
    id = w.day.groundId;
  if (releases[id]) return 0;
  releases[id] = true;
  let count = 0;
  for (const [r, river] of coastalRivers(w.terrain).entries())
    for (let i = 0; i < 8; i++) {
      const a = roll(w.career.seed, w.career.day * 59 + i + r * 71) * Math.PI * 2;
      const x = river.mouth.x + Math.cos(a) * (8 + i * 2),
        y = river.mouth.y + Math.sin(a) * (8 + i * 2);
      if (depthAt(w, x, y) <= 1 || Math.hypot(x - w.boat.x, y - w.boat.y) < 35) continue;
      w.logs.push({
        id: `runoff-${w.career.day}-${r}-${i}`,
        x,
        y,
        kind: 'runoff log',
        length: 4 + (i % 4),
        radius: 0.3,
        severity: 1,
        heading: a,
        phase: a,
      });
      count++;
    }
  if (count) w.events.push('RIVER RUNOFF · EXTRA TIMBER AFTER RAIN — KEEP A LOOKOUT');
  return count;
}
export function drawRivers(g, w, scale) {
  for (const river of coastalRivers(w.terrain)) {
    for (let i = 1; i < river.points.length; i++) {
      const a = river.points[i - 1],
        b = river.points[i];
      if (bedDepthAt(w.terrain, a.x, a.y) > 0) continue;
      g.lineStyle(2.5, 0x548d9c, 0.8);
      g.lineBetween(a.x * scale, a.y * scale, b.x * scale, b.y * scale);
      g.lineStyle(0.8, 0xc8d9cb, 0.7);
      g.lineBetween(a.x * scale, a.y * scale, b.x * scale, b.y * scale);
    }
  }
}
