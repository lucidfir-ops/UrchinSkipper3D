import { C } from './config.js';
import { gear } from './assists.js';
import { diveReadiness } from './dive-exposure.js';
import { recallStatus } from './diver-recall.js';
import { boatSpec } from './boats.js';
import { currentAt, depthAt, selectedDiver, visiblePatch } from './world.js';

// Pure eligibility and target selection shared by simulation, HUD and tests.
const activeDay = (w) => ['working', 'practice'].includes(w.day.phase);
function roomForNextBag(w, d) {
  const reserved =
    w.divers.filter((other) => other !== d && other.state !== 'ready' && !other.bagHandled).length *
    C.diver.bagSize;
  return boatSpec(w).capacity - w.catch - reserved >= C.diver.bagSize - 1e-7;
}
export function deploymentStatus(w, d = selectedDiver(w)) {
  const b = w.boat,
    x = b.x - Math.cos(b.heading) * (boatSpec(w).width / 2 + 2),
    y = b.y - Math.sin(b.heading) * (boatSpec(w).width / 2 + 2);
  const reason = ['approaching', 'calling', 'docking', 'boarding', 'departing'].includes(
    w.day.inspection?.status,
  )
    ? 'DFO VISIT — RECOVER CREW / WAIT FOR CLEARANCE'
    : w.weather?.night && !gear(w, 'torch')
      ? 'DARKNESS — DIVER FLASHLIGHTS REQUIRED'
      : w.day.crewRest > 0
        ? 'CREW BUSY ON DECK'
        : !activeDay(w)
          ? 'CHOOSE A FISHING GROUND FIRST'
          : w.emergency
            ? 'FISHING ENDED — RECOVER CREW / RETURN OR RADIO FOR RESCUE'
            : d.condition && d.condition !== 'fit'
              ? 'DIVER UNFIT TO DIVE'
              : (b.driveHealth ?? 1) <= 0
                ? 'PROPULSION FAILED — RADIO FOR RESCUE'
                : d.state !== 'ready'
                  ? 'DIVER NOT ABOARD'
                  : b.grounded
                    ? 'BOAT GROUNDED'
                    : depthAt(w, x, y) < C.diver.minDepth
                      ? 'TOO SHALLOW TO DEPLOY'
                      : !roomForNextBag(w, d)
                        ? 'NO ROOM FOR ANOTHER BAG'
                        : diveReadiness(w, d, depthAt(w, x, y));
  return { available: !reason, reason, x, y };
}
export function recoveryStatus(w, tolerance = C.recovery.tolerance, d = selectedDiver(w)) {
  const b = w.boat,
    c = currentAt(w, d.x, d.y),
    dx = d.x - b.x,
    dy = d.y - b.y;
  const side = dx * Math.cos(b.heading) + dy * Math.sin(b.heading),
    fore = dx * Math.sin(b.heading) - dy * Math.cos(b.heading);
  const distance = Math.hypot(
    Math.max(0, Math.abs(side) - boatSpec(w).width / 2),
    Math.max(0, Math.abs(fore) - boatSpec(w).length / 2),
  );
  const port =
    -side > 0 &&
    -side / Math.max(0.0001, Math.hypot(side, fore)) >=
      Math.cos((C.recovery.portSectorDegrees * Math.PI) / 360);
  const waterSpeed = Math.hypot(b.vx - c.x - b.turn * dy, b.vy - c.y + b.turn * dx),
    close = distance <= tolerance,
    clear = Math.abs(side) >= boatSpec(w).width / 2 || Math.abs(fore) >= boatSpec(w).length / 2,
    slow = waterSpeed <= C.recovery.maxRelativeSpeed;
  const reason = w.day.dump
    ? 'DECK BUSY — DUMPING BAG'
    : d.state !== 'surface'
      ? d.state === 'ready'
        ? 'DIVER ABOARD'
        : 'DIVER NOT SURFACED'
      : !close
        ? 'OUT OF RANGE'
        : !clear
          ? 'KEEP FLOAT CLEAR OF THE HULL'
          : !port
            ? 'BRING FLOAT TO PORT SIDE'
            : !slow
              ? 'SLOW DOWN'
              : '';
  return {
    close,
    port,
    slow,
    distance,
    waterSpeed,
    available: !reason,
    bagAvailable: !reason && !d.bagHandled,
    reason,
    overflow: Math.max(0, w.catch + d.bag - boatSpec(w).capacity),
  };
}
export const recoveryDuration = (d) =>
  (d.bagHandled ? C.recovery.boardSeconds : d.hookSeconds || C.recovery.hookSeconds) +
  (d.recoveryAction === 'recoverDiver' ? 2 : 0);
export function nearestRecoveryTarget(w, action, tolerance = C.recovery.tolerance) {
  const candidates = w.divers
    .map((d) => ({ d, status: recoveryStatus(w, tolerance, d) }))
    .filter(({ status }) => status.available);
  if (!candidates.length) return null;
  const nearest = Math.min(...candidates.map((c) => c.status.distance));
  // Within 20 cm the lower stable entity ID wins. HUD selection is irrelevant.
  return candidates
    .filter((c) => c.status.distance <= nearest + C.recovery.targetTieMeters)
    .sort((a, b) => a.d.id - b.d.id)[0].d;
}
export function actionTarget(w, action, tolerance = C.recovery.tolerance) {
  // Finish deck work and nearby recovery first. Selection only chooses between
  // available people aboard; an underwater portrait must not block deployment.
  const active = w.divers.find((d) => d.state === 'surface' && d.hooking);
  if (active) return active;
  const eligible = nearestRecoveryTarget(w, action, tolerance);
  if (eligible) return eligible;
  const selected = selectedDiver(w);
  if (action === 'recoverDiver') {
    if (deploymentStatus(w, selected).available) return selected;
    return (
      w.divers.find((d) => deploymentStatus(w, d).available) ||
      (selected.state === 'ready' ? selected : w.divers.find((d) => d.state === 'ready')) ||
      selected
    );
  }
  return selected;
}
export function pinActionTargets(w, a, tolerance = C.recovery.tolerance) {
  const result = { ...a };
  if (a.recall) result.recallDiverId = a.recallDiverId ?? recallStatus(w).diver?.id;
  if (a.work)
    result.workDiverId = a.workDiverId ?? a.diverId ?? actionTarget(w, 'work', tolerance).id;
  if (a.recoverDiver)
    result.recoverDiverId =
      a.recoverDiverId ?? a.diverId ?? actionTarget(w, 'recoverDiver', tolerance).id;
  return result;
}
export function rediveStatus(w, d) {
  const useful = visiblePatch(w, d),
    reason =
      d.state !== 'surface' || !d.bagHandled
        ? 'RECOVER THE BAG FIRST'
        : w.weather?.night && !gear(w, 'torch')
          ? 'DARKNESS — DIVER FLASHLIGHTS REQUIRED'
          : ['approaching', 'calling', 'docking', 'boarding', 'departing'].includes(
                w.day.inspection?.status,
              )
            ? 'DFO VISIT — BRING DIVER ABOARD'
            : w.emergency || (d.condition && d.condition !== 'fit')
              ? 'DIVER NEEDS TO COME ABOARD'
              : d.air <= C.diver.reserve + C.recovery.redeployAirMargin
                ? 'AIR RESERVE — BOARD FOR A FRESH TANK'
                : !roomForNextBag(w, d)
                  ? 'NO ROOM FOR ANOTHER BAG'
                  : !useful
                    ? d.groundSample?.quality < d.minQuality
                      ? 'GROUND BELOW QUALITY INSTRUCTION'
                      : 'NO PRODUCTIVE GROUND NEARBY'
                    : d.maxBagSeconds && d.lastBagSeconds > d.maxBagSeconds + 0.05
                      ? 'PICKING SLOWER THAN BAG TIME ORDER — MOVE OR CHANGE ORDERS'
                      : diveReadiness(w, d);
  return { available: !reason, reason };
}
