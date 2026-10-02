import {
  canExitSector,
  canCrossReturnBoundary,
  crossedReturnBoundary,
  exitDistance,
} from './navigation.js';
import { returnToHarbour } from './day.js';

export const DEPARTURE_SECONDS = 2.2;
export const departing = (w) => w.day.returnFade !== undefined;
export const RETURN_REARM_DISTANCE = 12;

// A crossing requests a decision. It never authorizes travel by itself, and
// simulation callers (including accelerated time) must respect the same pause.
export function requestDeparture(w) {
  if (w.day.returnPending) return true;
  if (w.day.returnDismissed) {
    if (exitDistance(w) < RETURN_REARM_DISTANCE) return false;
    delete w.day.returnDismissed;
  }
  if (!canCrossReturnBoundary(w) || !crossedReturnBoundary(w) || departing(w)) return false;
  w.day.returnPending = true;
  return true;
}

export function cancelDeparture(w) {
  if (!w.day.returnPending) return false;
  delete w.day.returnPending;
  w.day.returnDismissed = true;
  Object.assign(w.boat, { throttle: 0, rudder: 0, vx: 0, vy: 0, turn: 0 });
  w.events.push('STAYING IN THE SECTOR — HELM NEUTRAL; TURN BACK INTO THE WORKING WATER');
  return true;
}

export function confirmDeparture(w) {
  if (!w.day.returnPending || !canCrossReturnBoundary(w) || !crossedReturnBoundary(w)) return false;
  if (w.career?.intro?.status === 'active' && w.career.intro.step === 9) {
    delete w.day.returnPending;
    w.day.returnConfirmed = true;
    return true;
  }
  return beginDeparture(w);
}

export function beginDeparture(w) {
  if (!canExitSector(w) || !crossedReturnBoundary(w)) return false;
  delete w.day.returnPending;
  delete w.day.returnDismissed;
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
