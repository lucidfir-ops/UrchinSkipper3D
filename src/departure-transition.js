import { canExitSector, canCrossReturnBoundary, crossedReturnBoundary } from './navigation.js';
import { returnToHarbour } from './day.js';

export const DEPARTURE_SECONDS = 2.2;
export const departing = (w) => w.day.returnFade !== undefined;
// October 5: crossing the harbour line never pauses or departs by itself. While
// the boat sits beyond it with both divers aboard, an explicit "Return to
// harbour" action (touch chip, H key, Pause menu) is offered; steering back
// inside simply withdraws it. Nothing covers the working water.
export const returnAvailable = (w) =>
  canCrossReturnBoundary(w) && crossedReturnBoundary(w) && !departing(w) && !w.day.returnConfirmed;

export function confirmDeparture(w) {
  if (!returnAvailable(w)) return false;
  if (w.career?.intro?.status === 'active' && w.career.intro.step === 9) {
    w.day.returnConfirmed = true;
    return true;
  }
  return beginDeparture(w);
}

// Saves from before October 5 may hold a paused crossing decision.
export function clearLegacyReturnPrompt(w) {
  delete w.day.returnPending;
  delete w.day.returnDismissed;
}

export function beginDeparture(w) {
  if (!canExitSector(w) || !crossedReturnBoundary(w)) return false;
  clearLegacyReturnPrompt(w);
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
