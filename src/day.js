import { areaStatus } from './season.js';
import { gear } from './assists.js';
import { advanceFleet, fleetResults } from './fleet-life.js';
import { prepareInspection, inspectAtHarbour } from './fishery.js';
import { conditionsAt } from './weather.js';
import { C } from './config.js';
import { boatSpec } from './boats.js';
import { FLEET } from './career-data.js';
import { departureReady, startCareerTrip, chargeTransit, settleCareer } from './career-state.js';
import { SECTORS, enterSector } from './sectors.js';
import { EDGE_NAMES, EDGE_BEARINGS, crossedReturnBoundary } from './navigation.js';
import { calculateOffload } from './offload.js';
import { updateEnvironment } from './environment.js';
import { selectedSubArea, subAreaLabel, validSubAreaId } from './quota-areas.js';

export const GROUNDS = SECTORS.map(({ terrain, environment, ...ground }) => ({
  ...ground,
  patch: 'good',
}));
export function createDay(practice = false) {
  return {
    phase: practice ? 'practice' : 'planning',
    minute: C.day.startMinute,
    groundId: null,
    returnExit: null,
    offloaded: 0,
    result: null,
    warnings: [],
    assisted: false,
  };
}
export const formatClock = (minute) => {
  const day = Math.floor((minute + 1e-7) / 1440),
    clock = Math.floor((minute + 1e-7) % 1440);
  return `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}${day ? ` +${day}d` : ''}`;
};
export const selectedGround = (w) => GROUNDS.find((g) => g.id === w.day.groundId) || null;
export function passageMinutes(w, ground) {
  if (!ground) return 0;
  if (!w.career) return ground.travelMinutes;
  const spec = boatSpec(w),
    weather = conditionsAt(w, w.day.minute, ground.id),
    seaPenalty = 1 + Math.max(0, weather.wave / spec.waveTolerance - 0.5) * 0.24;
  return Math.ceil(((ground.travelMinutes * C.boat.maxSpeed) / spec.maxSpeed) * seaPenalty);
}
export const latestDeparture = (w) => C.day.deadlineMinute - passageMinutes(w, selectedGround(w));
export const allAboard = (w) => w.divers.every((d) => d.state === 'ready');
export function groundTrip(w, id) {
  const ground = GROUNDS.find((g) => g.id === id),
    previous = selectedGround(w),
    blocked = departureReady(w);
  if (!ground) return { ok: false, reason: 'UNKNOWN GROUND' };
  const access = w.career ? areaStatus(w.career, id) : null,
    closed = access && !access.open && !(w.day.phase === 'working' && w.day.groundId === id);
  const minutes = previous
    ? ground.id === previous.id
      ? 0
      : Math.max(
          C.day.minimumTransit,
          Math.abs(passageMinutes(w, ground) - passageMinutes(w, previous)),
        )
    : passageMinutes(w, ground);
  const fuelNeed = w.career ? (minutes / 60) * FLEET[w.boat.configuration].travelBurn : 0;
  const noWorkWindow =
    w.career &&
    w.day.phase === 'planning' &&
    (w.day.minute + minutes) % 1440 >= 1170 &&
    !gear(w, 'torch');
  const disabled =
    (w.boat.driveHealth ?? 1) <= 0 ||
    w.boat.fuel < fuelNeed ||
    w.boat.fuel <= 0 ||
    !!w.emergency ||
    !!blocked;
  return {
    ok: allAboard(w) && w.day.phase !== 'complete' && !disabled && !closed && !noWorkWindow,
    noWorkWindow,
    closed: !!closed,
    reason: noWorkWindow
      ? 'NO DAYLIGHT LEFT — FIT DIVER FLASHLIGHTS OR SLEEP UNTIL TOMORROW'
      : closed
        ? `${access.reason} — CHECK THE HARBOUR CALENDAR / ACCOUNTS`
        : !allAboard(w)
          ? 'BRING BOTH DIVERS ABOARD FIRST'
          : w.day.phase === 'complete'
            ? 'START A NEW DAY'
            : disabled
              ? blocked ||
                (w.boat.fuel < fuelNeed
                  ? 'NOT ENOUGH FUEL FOR THIS TRANSIT'
                  : 'PROPULSION UNAVAILABLE — RADIO FOR RESCUE')
              : '',
    ground,
    minutes,
    arrival: w.day.minute + minutes,
    depart: C.day.deadlineMinute - passageMinutes(w, ground),
  };
}
export function chooseGround(w, id, { patchId = 'good', arrivalLane = 0, subAreaId = null } = {}) {
  const trip = groundTrip(w, id);
  if (!trip.ok) return trip;
  const edge = trip.ground.harbourEdge,
    chosenSubArea = w.career
      ? validSubAreaId(subAreaId)
        ? subAreaId
        : selectedSubArea(w.career, id)
      : null;
  startCareerTrip(w);
  chargeTransit(w, trip.minutes);
  Object.assign(w.day, {
    minute: trip.arrival,
    groundId: id,
    subAreaId: chosenSubArea,
    phase: 'working',
    warnings: [],
    returnExit: { edge, bearing: EDGE_BEARINGS[edge], label: EDGE_NAMES[edge] },
  });
  advanceFleet(w, w.day.minute);
  enterSector(w, id, patchId, arrivalLane);
  prepareInspection(w);
  w.events.push(
    `ARRIVED AT ${trip.ground.name.toUpperCase()}${chosenSubArea ? ` · ${subAreaLabel(chosenSubArea, id).toUpperCase()}` : ''} — HARBOUR EXIT ${EDGE_NAMES[edge]} · LEAVE BY ${formatClock(trip.depart)}`,
  );
  w.effects.push({ type: 'voyage', destination: trip.ground.name, minutes: trip.minutes });
  return trip;
}
export function returnStatus(w) {
  const ground = selectedGround(w);
  const reason = w.day.dump
    ? 'FINISH DUMPING THE BAG BEFORE RETURNING'
    : w.day.phase !== 'working'
      ? 'CHOOSE A FISHING GROUND FIRST'
      : !allAboard(w)
        ? 'BRING BOTH DIVERS ABOARD FIRST'
        : '';
  return {
    available: !reason,
    reason,
    arrival: w.day.minute + passageMinutes(w, ground),
    exit: w.day.returnExit,
  };
}
export function returnToHarbour(w) {
  const status = returnStatus(w);
  if (!status.available) return { ok: false, ...status };
  if (!crossedReturnBoundary(w))
    return { ok: false, reason: `CROSS THE ${w.day.returnExit.label} BOUNDARY TOWARD HARBOUR` };
  if ((w.boat.driveHealth ?? 1) <= 0 || w.boat.fuel <= 0) return requestRescue(w);
  if (
    w.career &&
    w.boat.fuel <
      (passageMinutes(w, selectedGround(w)) / 60) * FLEET[w.boat.configuration].travelBurn
  ) {
    chargeTransit(w, passageMinutes(w, selectedGround(w)));
    return requestRescue(w);
  }
  chargeTransit(w, passageMinutes(w, selectedGround(w)));
  const delay = inspectAtHarbour(w);
  status.arrival += delay;
  const result = calculateOffload(w, status.arrival);
  if (w.career) result.rivals = fleetResults(w, status.arrival);
  settleCareer(w, result);
  w.day.minute = status.arrival;
  w.day.phase = 'complete';
  w.day.offloaded = result.gross;
  w.day.result = result;
  w.catch = 0;
  w.bags = [];
  w.boat.throttle = 0;
  w.boat.rudder = 0;
  updateEnvironment(w);
  w.events.push(
    result.onTime
      ? 'BACK AT HARBOUR — CATCH OFFLOADED'
      : 'BACK AT HARBOUR — NEXT SHIPPING WINDOW BOOKED',
  );
  w.effects.push({ type: 'day-end', onTime: result.onTime });
  return { ok: true, ...result };
}
export function advanceDay(w, dt) {
  if (w.day.phase !== 'working') return;
  w.day.minute += dt * C.day.minutesPerSecond;
  const depart = latestDeparture(w),
    exit = w.day.returnExit?.label || 'HARBOUR';
  for (const [key, threshold, text] of [
    [
      'soon',
      depart - C.day.warningMinutes,
      `RETURN WINDOW APPROACHING — RECOVER DIVERS, THEN HEAD ${exit}`,
    ],
    [
      'leave',
      depart,
      `LEAVE NOW TO OFFLOAD BY ${formatClock(C.day.deadlineMinute)} — EXIT ${exit}`,
    ],
    [
      'late',
      depart + 1,
      `RETURN WILL BE LATE — NEXT SHIPPING WINDOW COSTS QUALITY / WEIGHT · EXIT ${exit}`,
    ],
  ])
    if (w.day.minute + 1e-7 >= threshold && !w.day.warnings.includes(key)) {
      w.day.warnings.push(key);
      w.events.push(text);
      w.effects.push({ type: 'deadline', key });
    }
}

// Emergency-only recovery is a costly time transition, distinct from the normal
// physical harbour exit. Every diver and recoverable bag is accounted for first.
export function rescueStatus(w) {
  const active = ['working', 'practice'].includes(w.day.phase),
    stranded =
      (w.boat.driveHealth ?? 1) <= 0 || w.boat.fuel <= 0 || w.boat.grounded || !!w.emergency;
  return {
    available: active && stranded,
    reason: !active
      ? 'NO ACTIVE TRIP'
      : !stranded
        ? 'RESCUE IS FOR FAILED PROPULSION, NO FUEL OR GROUNDING'
        : '',
  };
}
export function requestRescue(w) {
  const status = rescueStatus(w);
  if (!status.available) return { ok: false, reason: status.reason };
  if (w.boat.sinking) {
    w.discarded += w.catch;
    w.catch = 0;
    w.bags = [];
  }
  for (const d of w.divers) {
    if (d.condition === 'deceased') continue;
    if (!d.bagHandled && d.bag > 0) {
      const weight = Math.min(d.bag, Math.max(0, boatSpec(w).capacity - w.catch));
      if (weight > 0)
        w.bags.push({
          weight,
          quality: d.qualitySum / d.bag,
          harvestMinute: d.harvestMinute ?? w.day.minute,
          ...(w.day.groundId ? { areaId: w.day.groundId, subAreaId: w.day.subAreaId } : {}),
          ...(d.crewId ? { crewId: d.crewId, undersizeCount: d.undersizeCount || 0 } : {}),
        });
      w.catch += weight;
      w.discarded += d.bag - weight;
    }
    Object.assign(d, {
      state: 'ready',
      air: C.diver.air,
      bag: 0,
      qualitySum: 0,
      bagHandled: true,
      hooking: false,
      hook: 0,
      recoveryAction: null,
      patch: null,
      target: null,
      x: w.boat.x,
      y: w.boat.y,
    });
  }
  const delay = C.prototypeCosts.rescueDelayMinutes,
    arrival = w.day.minute + delay + (passageMinutes(w, selectedGround(w)) || 60);
  w.day.rescue = {
    delayMinutes: delay,
    reason:
      w.emergency?.reason ||
      ((w.boat.driveHealth ?? 1) <= 0
        ? 'Drive failure'
        : w.boat.fuel <= 0
          ? 'Out of fuel'
          : 'Grounding'),
    service: 'Coast Guard assistance / harbour tow',
  };
  // The rescue itself is not priced as a real Coast Guard charge. Session costs
  // cover illustrative commercial tow/yard handling; all coefficients are tuning.
  if (w.costs) w.costs.rescue += C.prototypeCosts.towHandling;
  const result = calculateOffload(w, arrival);
  if (w.career) result.rivals = fleetResults(w, arrival);
  settleCareer(w, result);
  Object.assign(w.day, { minute: arrival, phase: 'complete', offloaded: result.gross, result });
  delete w.day.dump;
  w.catch = 0;
  w.bags = [];
  Object.assign(w.boat, { throttle: 0, rudder: 0, thruster: 0, vx: 0, vy: 0, turn: 0 });
  updateEnvironment(w);
  w.events.push(
    w.safety?.fatalities
      ? 'EMERGENCY RESPONSE COMPLETE — DIVER FATALITY RECORDED'
      : 'RESCUE COMPLETE — SURVIVING CREW AT HARBOUR',
  );
  w.effects.push({ type: 'day-end', onTime: result.onTime });
  return { ok: true, ...result };
}
