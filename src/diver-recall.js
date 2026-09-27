import { C } from './config.js';
import { seededRandom } from './math.js';
import { boatSpec } from './boats.js';
import { pickupTolerance } from './assists.js';

// Recall is audible around the hull, including every valid pickup position.
// Unlike recovery it does not require a port approach or matched boat speed.
export function recallDistance(w, d) {
  const b = w.boat,
    dx = d.x - b.x,
    dy = d.y - b.y,
    side = dx * Math.cos(b.heading) + dy * Math.sin(b.heading),
    fore = dx * Math.sin(b.heading) - dy * Math.cos(b.heading),
    spec = boatSpec(w);
  return Math.hypot(
    Math.max(0, Math.abs(side) - spec.width / 2),
    Math.max(0, Math.abs(fore) - spec.length / 2),
  );
}

export function recallStatus(w, id) {
  const candidates = w.divers.filter(
    (d) => ['searching', 'harvesting'].includes(d.state) && (id === undefined || d.id === id),
  );
  candidates.sort((a, b) => recallDistance(w, a) - recallDistance(w, b) || a.id - b.id);
  const diver = candidates[0],
    distance = diver ? recallDistance(w, diver) : Infinity;
  return {
    diver,
    distance,
    available:
      distance <= Math.max(5, pickupTolerance(w, w.career?.difficulty === 'realistic')) &&
      diver.recallAt == null,
  };
}
export function recallDiver(w, id) {
  const status = recallStatus(w, id);
  if (!status.available) return false;
  const d = status.diver,
    random = seededRandom((w.career?.seed || C.seed) ^ ((d.diveCount || 0) * 1973 + d.id * 9277));
  d.recallAt = w.time + 2 + random() * 3;
  w.events.push('CLANGING THE HULL — CALLING NEARBY DIVER UP');
  w.effects.push({ type: 'recall', diverId: d.id, x: d.x, y: d.y });
  return true;
}
