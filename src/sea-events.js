import { roll } from './career-data.js';
import { depthAt } from './terrain.js';
import { FLEET_LIFE } from './fleet-life.js';
import { spawnWildlife } from './wildlife.js';
export const SEA_EVENTS = { unusualChance: 0.07, crewRestSeconds: 12, engineDelaySeconds: 10 };
export function stepSeaEvents(w, dt) {
  if (!w.career || w.day.phase !== 'working') return;
  const c = w.career;
  w.day.eventCheck ??= w.day.minute + 120;
  if (w.day.engineDelay > 0) {
    w.day.engineDelay = Math.max(0, w.day.engineDelay - dt);
    if (!w.day.engineDelay) w.events.push('ENGINE · Filter clear. Power available.');
  }
  if (w.day.crewRest > 0) w.day.crewRest = Math.max(0, w.day.crewRest - dt);
  if (w.day.minute < w.day.eventCheck || w.day.seaEventDone) return;
  w.day.seaEventDone = true;
  const rare = roll(c.seed, c.day + 9121);
  if (rare < FLEET_LIFE.rareRadioChance) {
    w.events.push('RADIO · Shy Hull Wood: “Urchin sign the likes of which God has never seen.”');
    w.effects.push({ type: 'radio' });
    return;
  }
  const event = roll(c.seed, c.day + 7161);
  if (event >= SEA_EVENTS.unusualChance) return;
  if (w.weather?.wave > 1.1) {
    const angle = ((w.weather.bearing || 210) * Math.PI) / 180;
    w.boat.vx += Math.sin(angle) * 0.35;
    w.boat.vy -= Math.cos(angle) * 0.35;
    const x = w.boat.x + Math.sin(angle) * 40,
      y = w.boat.y - Math.cos(angle) * 40;
    if (depthAt(w, x, y) > 1)
      w.logs.push({
        id: `storm-${c.day}`,
        kind: 'waterlogged branch',
        x,
        y,
        length: 4,
        radius: 0.2,
        severity: 0.5,
        heading: angle,
      });
    w.events.push('SEA · A larger set rolling through. Timber in the wash.');
    w.effects.push({ type: 'warning' });
  } else if (w.boat.driveHealth < 0.7) {
    w.day.engineDelay = SEA_EVENTS.engineDelaySeconds;
    w.events.push('ENGINE · Fuel filter coughing. Keep clear while it is checked.');
  } else {
    const d = w.divers.find((d) => d.state === 'ready' && d.condition === 'fit' && d.fatigue > 0.5);
    if (d) {
      w.day.crewRest = SEA_EVENTS.crewRestSeconds;
      d.fatigue = Math.max(0, d.fatigue - 0.08);
      w.events.push(`CREW · ${d.name}: Give me a minute to warm my hands.`);
    } else {
      const point = { x: w.boat.x + 23, y: w.boat.y - 18 };
      if (
        depthAt(w, point.x, point.y) > 0 &&
        spawnWildlife(w, 'seal', { point, count: 1, lifetime: 14, announce: false })
      )
        w.events.push('A seal surfaces, looks at the boat, and is gone.');
    }
  }
}
