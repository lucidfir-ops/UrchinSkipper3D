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
      const quiet = quietMoment(w, roll(c.seed, c.day + 5303));
      if (quiet) {
        w.events.push(quiet);
        if (quiet.startsWith('RADIO')) w.effects.push({ type: 'radio' });
        return;
      }
      const point = { x: w.boat.x + 23, y: w.boat.y - 18 };
      if (
        depthAt(w, point.x, point.y) > 0 &&
        spawnWildlife(w, 'seal', { point, count: 1, lifetime: 14, announce: false })
      )
        w.events.push('A seal surfaces, looks at the boat, and is gone.');
    }
  }
}

// October 8 (Bible §17: rare unexplained returns, lights, radio and objects
// that need not be explained). These share the existing quiet-day slot, so the
// overall event frequency is unchanged; half of those days still bring the seal.
// Text only: nothing here changes the simulation or reveals hidden ground.
export const QUIET_MOMENTS = [
  () => 'SOUNDER · 212 m for one ping, then back to the bottom. The transducer is fine.',
  (w) =>
    w.weather?.night || (w.weather?.sunlight ?? 1) < 0.35
      ? 'A light low on the water to seaward. Then nothing.'
      : null,
  () =>
    'An old trawl float drifts past, crusted with barnacles. Stencilled: RETURN TO — and the rest is gone.',
  () => 'RADIO · …static… “—anyone on sixteen, we have your—” …static. Nothing more.',
  () => 'Every gull on the water lifts at once and heads inshore. The sea looks the same.',
];
export function quietMoment(w, value) {
  if (value >= 0.5) return null;
  const pick = QUIET_MOMENTS[Math.floor((value / 0.5) * QUIET_MOMENTS.length)];
  return pick(w);
}
