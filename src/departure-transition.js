import { canExitSector, crossedReturnBoundary } from './navigation.js';
import { returnToHarbour } from './day.js';

export const DEPARTURE_SECONDS = 2.2;
export const departing = (w) => w.day.returnFade !== undefined;

export function beginDeparture(w) {
  if (!canExitSector(w) || !crossedReturnBoundary(w)) return false;
  w.day.returnFade = 0;
  w.day.departureHeading = w.boat.heading;
  return true;
}

// The travel animation spends no additional fishing time or fuel. Settlement
// remains the existing once-only harbour transaction after the boat fades.
export function advanceDeparture(w, dt) {
  w.day.returnFade = Math.min(DEPARTURE_SECONDS, w.day.returnFade + dt);
  if (w.day.returnFade >= DEPARTURE_SECONDS - 1e-7) {
    delete w.day.returnFade;
    delete w.day.departureHeading;
    returnToHarbour(w);
  }
}

// Render-only continuation beyond the edge; saved simulation geometry stays put.
export function departureBoat(w) {
  if (!departing(w)) return { ...w.boat, alpha: w.day.phase === 'complete' ? 0 : 1 };
  const progress = Math.min(1, w.day.returnFade / DEPARTURE_SECONDS),
    bearing = w.day.departureHeading ?? w.boat.heading,
    distance = w.day.returnFade * Math.max(2, Math.hypot(w.boat.vx, w.boat.vy)),
    fade = Math.max(0, (progress - 0.12) / 0.88);
  return {
    ...w.boat,
    x: w.boat.x + Math.sin(bearing) * distance,
    y: w.boat.y - Math.cos(bearing) * distance,
    alpha: 1 - fade * fade * (3 - 2 * fade),
  };
}
