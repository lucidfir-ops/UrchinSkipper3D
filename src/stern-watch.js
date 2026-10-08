import { boatSpec } from './boats.js';
import { toHull } from './collision-geometry.js';
import { engineState } from './operating-state.js';

// October 8: a diver still aboard keeps watch over the stern. Going astern with
// a surfaced diver in the water close behind earns a shouted warning, as a deck
// hand would give. The diver is physically visible on the surface, so this adds
// no hidden information; with nobody aboard there is nobody to shout.
export const STERN_WATCH = { behind: 9, beside: 3, throttle: -0.08, cooldown: 8 };

export function sternWatch(w) {
  if (!['working', 'practice'].includes(w.day?.phase)) return null;
  const b = w.boat;
  if (!(b.throttle < STERN_WATCH.throttle) || !engineState(w).powered) return null;
  const lookout = w.divers.find((d) => d.state === 'ready' && d.condition === 'fit');
  if (!lookout || w.time < (w.sternWatchUntil ?? 0)) return null;
  const spec = boatSpec(w);
  const diver = w.divers.find((d) => {
    if (d.state !== 'surface') return false;
    const q = toHull(b, d.x, d.y);
    return (
      q.fore < -spec.length / 2 + 0.5 &&
      q.fore > -spec.length / 2 - STERN_WATCH.behind &&
      Math.abs(q.side) < spec.width / 2 + STERN_WATCH.beside
    );
  });
  if (!diver) return null;
  w.sternWatchUntil = w.time + STERN_WATCH.cooldown;
  // Shown like any crew call on the HUD; aboard divers have no sea bubble.
  w.events.push(`${lookout.name.toUpperCase()} · ${diver.name.split(' ')[0]}'s astern — neutral!`);
  w.effects.push({ type: 'warning', diverId: lookout.id, x: b.x, y: b.y });
  return diver;
}
