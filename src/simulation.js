import { wildlifeWorkRate } from './wildlife.js';
import { stepDeckWork } from './deck-work.js';
import { surfaceMoment, refusalMoment } from './crew-moments.js';
import { observeGround } from './diver-observations.js';
import { releaseRunoff } from './runoff.js';
import { scoutHeading } from './diver-search.js';
import { swimToPickupWater } from './diver-escape.js';
import { stepDiveExposure, applyDiveInjury, diveAirUse } from './dive-exposure.js';
import { recallDiver } from './diver-recall.js';
import { stepTraffic } from './traffic.js';
import { stepWildlife } from './wildlife.js';
import {
  deploymentStatus,
  recoveryStatus,
  recoveryDuration,
  pinActionTargets,
  rediveStatus,
} from './diver-recovery.js';
export {
  deploymentStatus,
  recoveryStatus,
  recoveryDuration,
  pinActionTargets,
  rediveStatus,
  nearestRecoveryTarget,
  actionTarget,
} from './diver-recovery.js';
const activeDay = (w) => ['working', 'practice'].includes(w.day.phase);
import { updateFuelWarnings } from './preparation.js';
import { advanceFleet } from './fleet-life.js';
import { rollBagUndersize, stepFishery } from './fishery.js';
import { stepSeaEvents } from './sea-events.js';
import { updateWeather } from './weather.js';
import { recordKnowledge, recordDiverReport } from './knowledge.js';
import { gear } from './assists.js';
import { boatSpec } from './boats.js';
import { diverSpec, workCrew, rememberCrewOrders } from './crew.js';
import { checkDiverSafety } from './diver-safety.js';
import { chooseHarvestClump, clumpDistance, takeCatch } from './harvest-ground.js';
import { stepLogs } from './hazards.js';
import { stepRocks } from './rock-collision.js';
import { C, QUALITIES, BAG_LIMITS } from './config.js';
import {
  depthAt,
  visiblePatch,
  worthwhile,
  patchDistance,
  driftSurface,
  driftDebris,
} from './world.js';
import { stepBoat } from './boat.js';
import { advanceDay } from './day.js';
import { departing, beginDeparture, advanceDeparture } from './departure-transition.js';
import { updateEnvironment } from './environment.js';
import { recordFishingPressure, subAreaYield } from './quota-areas.js';
import { driftUnderwater, moveOnBottom } from './diver-current.js';

export function announce(w, text, d = null) {
  w.message = text;
  w.events.push(d ? `${d.name.toUpperCase()} · ${text}` : text);
}
function effect(w, type, d, extra = {}) {
  w.effects.push({ type, diverId: d?.id, x: d?.x ?? w.boat.x, y: d?.y ?? w.boat.y, ...extra });
}
export function setInstructions(w, id, { direction, minQuality, searchLimit, maxBagSeconds }) {
  const d = w.divers.find((item) => item.id === id);
  searchLimit ??= d?.searchLimit ?? 70;
  maxBagSeconds ??= d?.maxBagSeconds ?? 0;
  if (
    !d ||
    !Number.isInteger(direction) ||
    direction < 0 ||
    direction > 8 ||
    !QUALITIES.includes(minQuality) ||
    ![0, 10, 15, 20, 30, 60, 70].includes(searchLimit) ||
    !BAG_LIMITS.includes(maxBagSeconds)
  )
    return false;
  d.direction = direction;
  d.minQuality = minQuality;
  d.searchLimit = searchLimit;
  d.maxBagSeconds = maxBagSeconds;
  d.ordersSet = true;
  rememberCrewOrders(w);
  return true;
}
function surface(w, d, reason) {
  d.lastDiveDepth = Math.max(0, depthAt(w, d.x, d.y));
  if (d.patch) d.lastPatchRate = d.patch.rate;
  if (d.bag >= C.diver.bagSize - 0.01) d.lastFullBagSeconds = d.diveTime;
  d.lastBagSeconds = d.bag > 0 ? ((d.bagWorkSeconds || 0) * C.diver.bagSize) / d.bag : 0;
  d.recallAt = null;
  d.state = 'surfacing';
  d.timer = C.diver.warningSeconds;
  d.reason = reason;
  announce(w, 'DIVER SURFACING — WATCH THE BUBBLES', d);
  effect(w, 'warning', d);
}
function search(w, d, dt) {
  observeGround(w, d);
  let p = d.localSearch ? d.patch : visiblePatch(w, d);
  if (d.localSearch) {
    if (!worthwhile(p, d)) {
      surface(w, d, p?.remaining <= 0.001 ? 'Patch exhausted' : 'Ground below quality instruction');
      return;
    }
    d.localSearch.elapsed += dt;
    if (
      d.localSearch.elapsed >= C.diver.localSearchSeconds ||
      Math.hypot(d.x - d.localSearch.x, d.y - d.localSearch.y) > C.diver.localSearchRadius
    ) {
      surface(w, d, 'Patch exhausted');
      return;
    }
    if (
      p &&
      Math.hypot(p.x - d.localSearch.x, p.y - d.localSearch.y) >
        p.radius + C.diver.localSearchRadius
    )
      p = null;
  }
  d.target = p;
  d.searchTime += dt;
  if (d.searchLimit && d.searchTime >= d.searchLimit) {
    surface(w, d, 'Search time limit reached');
    return;
  }
  if (p?.clumps && (!d.clump || d.clump.remaining <= 0.001 || d.patch !== p)) {
    d.patch = p;
    d.clump = chooseHarvestClump(w, p, d);
  }
  const clump = p?.clumps ? d.clump : null,
    place = clump || p;
  const distanceToGround = clump
    ? Math.max(clumpDistance(clump, d.x, d.y), patchDistance(p, d.x, d.y))
    : p
      ? patchDistance(p, d.x, d.y)
      : Infinity;
  if (p && distanceToGround < 0.04) {
    d.patch = p;
    d.clump = clump;
    d.target = null;
    d.state = 'harvesting';
    d.localSearch = null;
    return;
  }
  const angle = place ? Math.atan2(place.x - d.x, d.y - place.y) : scoutHeading(w, d);
  const distance =
    diverSpec(d).searchSpeed * (1 - (C.diver.loadedMovementPenalty * d.bag) / C.diver.bagSize) * dt;
  for (const offset of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const x = d.x + Math.sin(angle + offset) * distance,
      y = d.y - Math.cos(angle + offset) * distance;
    if (
      x > 1 &&
      y > 1 &&
      x < w.terrain.size - 1 &&
      y < w.terrain.size - 1 &&
      depthAt(w, x, y) >= C.diver.minDepth
    ) {
      moveOnBottom(w, d, x, y);
      break;
    }
  }
}
function searchLocally(w, d) {
  if (d.patch?.remaining <= 0.001) {
    surface(w, d, 'Patch exhausted');
    return;
  }
  d.state = 'searching';
  d.target = null;
  d.clump = null;
  d.localSearch ??= { x: d.x, y: d.y, elapsed: 0 };
  announce(w, 'MOVING WITHIN THIS GROUND', d);
}
function sendDown(w, d) {
  d.recallAt = null;
  Object.assign(d, {
    state: 'deploying',
    bag: 0,
    qualitySum: 0,
    undersizeCount: null,
    diveTime: 0,
    diveCount: (d.diveCount || 0) + 1,
    timer: C.diver.deploySeconds,
    patch: null,
    clump: null,
    target: null,
    reason: '',
    searchTime: 0,
    scoutDepthSign: 0,
    scoutTurnUntil: 0,
    harvestTime: 0,
    bagWorkSeconds: 0,
    groundSample: null,
    harvestMinute: null,
    localSearch: null,
    bagHandled: false,
  });
  announce(w, 'FRESH BAG PROVIDED — DIVER RETURNING TO WORK', d);
  effect(w, 'splash', d);
}
function finishRecovery(w, d) {
  const action = d.recoveryAction,
    weight = d.bag;
  if (!d.bagHandled) {
    recordDiverReport(w, d, { recovered: true });
    const landed = Math.min(weight, Math.max(0, boatSpec(w).capacity - w.catch)),
      excess = weight - landed;
    w.catch += landed;
    d.lastBag = {
      weight: landed,
      collected: weight,
      quality: weight ? d.qualitySum / weight : null,
    };
    if (landed > 0)
      w.bags.push({
        id: `bag-${w.career?.day || 0}-${w.time}-${d.id}`,
        weight: landed,
        haulSeconds: d.hookSeconds || C.recovery.hookSeconds,
        diverName: d.name,
        groundName: d.patch?.name || null,
        recoveredMinute: w.day.minute,
        quality: d.qualitySum / weight,
        harvestMinute: d.harvestMinute ?? w.day.minute,
        ...(w.day.groundId ? { areaId: w.day.groundId, subAreaId: w.day.subAreaId } : {}),
        ...(d.crewId ? { crewId: d.crewId, undersizeCount: d.undersizeCount || 0 } : {}),
      });
    if (excess > 1e-7) {
      w.discarded += excess;
      announce(w, `DECK FULL — ${excess.toFixed(0)} lb EXCESS CATCH RELEASED`, d);
      effect(w, 'overflow', d, { weight: excess });
    }
    d.bag = 0;
    d.qualitySum = 0;
    d.bagHandled = true;
    if (w.career) d.undersizeCount = null;
    announce(
      w,
      `BAG RECOVERED — ${landed.toFixed(0)} lb · ${Math.round((d.lastBag.quality || 0) * 100)}% QUALITY`,
      d,
    );
    effect(w, 'bag', d, { weight: landed });
  }
  d.hook = 0;
  d.hooking = false;
  d.recoveryPause = '';
  d.recoveryAction = null;
  if (action === 'recoverDiver') {
    d.state = 'ready';
    d.patch = null;
    d.clump = null;
    d.target = null;
    d.localSearch = null;
    d.air = diverSpec(d).tankAir || C.diver.air;
    d.x = w.boat.x;
    d.y = w.boat.y;
    announce(
      w,
      d.condition === 'injured'
        ? 'INJURED DIVER ABOARD — RETURN FOR MEDICAL HELP'
        : 'DIVER ABOARD — FRESH TANK / READY TO REDEPLOY',
      d,
    );
    return;
  }
  d.state = 'surface';
  const next = rediveStatus(w, d);
  if (next.available) sendDown(w, d);
  else {
    d.reason = next.reason;
    refusalMoment(w, d, next.reason);
    announce(w, `BAG ABOARD — ${next.reason}`, d);
  }
}
function stepDiver(w, d, a, dt, tolerance) {
  if (
    w.weather?.night &&
    !gear(w, 'torch') &&
    ['deploying', 'searching', 'harvesting'].includes(d.state)
  )
    surface(w, d, 'Darkness — flashlight required');
  const tableBreak = stepDiveExposure(w, d, dt);
  const b = w.boat,
    deploy = a.recoverDiver && d.state === 'ready';
  if (deploy) {
    const r = deploymentStatus(w, d);
    if (!r.available) {
      announce(w, `DEPLOY REJECTED — ${r.reason}`, d);
      refusalMoment(w, d, r.reason);
    } else {
      if (w.career)
        Object.assign(d, {
          undersizeCount: null,
        });
      Object.assign(d, {
        state: 'deploying',
        recallAt: null,
        timer: C.diver.deploySeconds + (gear(w, 'nitrox') ? 1 : 0),
        x: r.x,
        y: r.y,
        dropX: r.x,
        dropY: r.y,
        bag: 0,
        qualitySum: 0,
        air: diverSpec(d).tankAir || C.diver.air,
        diveCount: (d.diveCount || 0) + 1,
        patch: null,
        clump: null,
        target: null,
        diveTime: 0,
        searchTime: 0,
        scoutDepthSign: 0,
        scoutTurnUntil: 0,
        harvestTime: 0,
        bagWorkSeconds: 0,
        lastBagSeconds: 0,
        groundSample: null,
        harvestMinute: null,
        hook: 0,
        hooking: false,
        recoveryAction: null,
        recoveryPause: '',
        reason: '',
        localSearch: null,
        bagHandled: false,
      });
      announce(w, 'DEPLOY DIVER — DEPLOYING', d);
      effect(w, 'splash', d);
    }
  }
  if (d.state === 'ready') {
    d.x = b.x;
    d.y = b.y;
  } else if (d.state === 'deploying') {
    d.timer -= dt;
    if (d.timer <= 0) {
      d.state = 'searching';
      announce(w, 'DIVER UNDERWATER — BUBBLES ONLY', d);
    }
  } else if (d.state === 'searching' || d.state === 'harvesting') {
    d.holdCurrentKnots = diverSpec(d).holdCurrentKnots;
    if (d.state === 'searching') driftUnderwater(w, d, dt);
    else d.currentDrift = 0;
    workCrew(w, d, dt);
    d.air = Math.max(C.diver.reserve, d.air - diveAirUse(w, d) * dt);
    d.diveTime += dt;
    if (d.air <= C.diver.reserve) surface(w, d, 'Air reserve');
    else if (tableBreak) surface(w, d, 'Dive table break — surface interval needed');
    else if (d.recallAt != null && w.time >= d.recallAt) surface(w, d, 'Skipper recalled diver');
    else if (d.state === 'searching') search(w, d, dt);
    else if (d.patch && patchDistance(d.patch, d.x, d.y) > 0.04)
      surface(w, d, 'Swept off productive ground');
    else if (!worthwhile(d.patch, d)) {
      if (d.patch?.remaining <= 0.001) surface(w, d, 'Patch exhausted');
      else surface(w, d, 'Ground below quality instruction');
    } else {
      const p = d.patch;
      observeGround(w, d);
      if (
        p.clumps &&
        (!d.clump || d.clump.remaining <= 0.001 || (d.clump.quality ?? p.quality) < d.minQuality)
      ) {
        d.clump = chooseHarvestClump(w, p, d);
        if (!d.clump || clumpDistance(d.clump, d.x, d.y) > 0.04) {
          searchLocally(w, d);
          return;
        }
      }
      // Harvesting is active bottom work: traverse this clump toward the next
      // local productive region instead of standing at its entry boundary.
      if (d.clump) {
        const next = chooseHarvestClump(w, p, d, d.clump),
          c = d.clump;
        let tx = c.x,
          ty = c.y;
        if (next) {
          const nx = next.x - c.x,
            ny = next.y - c.y,
            n = Math.max(0.1, Math.hypot(nx, ny));
          tx += (nx / n) * c.radius * 0.78;
          ty += (ny / n) * c.radius * 0.78;
        }
        const dx = tx - d.x,
          dy = ty - d.y,
          distance = Math.hypot(dx, dy),
          advance = Math.min(
            distance,
            diverSpec(d).searchSpeed *
              (1 - (C.diver.loadedMovementPenalty * d.bag) / C.diver.bagSize) *
              dt,
          );
        if (distance > 0.05) {
          const x = d.x + (dx / distance) * advance,
            y = d.y + (dy / distance) * advance;
          if (patchDistance(p, x, y) === 0 && depthAt(w, x, y) >= C.diver.minDepth)
            moveOnBottom(w, d, x, y);
        }
      }

      const yieldMultiplier = w.career
          ? subAreaYield(w.career, w.day.groundId, w.day.subAreaId)
          : 1,
        amount = takeCatch(
          p,
          d.clump,
          Math.min(
            p.rate * diverSpec(d).harvestRate * yieldMultiplier * wildlifeWorkRate(w, d) * dt,
            C.diver.bagSize - d.bag,
          ),
        );
      if (w.career && amount > 0)
        recordFishingPressure(w.career, w.day.groundId, w.day.subAreaId, 'player', amount);
      if (amount > 0 && d.harvestMinute == null) d.harvestMinute = w.day.minute;
      d.harvestTime += amount / p.rate;
      d.bagWorkSeconds = (d.bagWorkSeconds || 0) + dt;
      if (w.career && amount > 0) rollBagUndersize(w, d);
      d.bag += amount;
      d.qualitySum += amount * (d.clump?.quality ?? p.quality);
      if (d.bag >= C.diver.bagSize - 1e-8) {
        d.bag = C.diver.bagSize;
        surface(w, d, 'Bag full');
      } else if (d.maxBagSeconds && d.bagWorkSeconds >= d.maxBagSeconds)
        surface(w, d, 'Picking slower than bag time order');
      else if (p.remaining <= 0.001 || d.clump?.remaining <= 0.001) searchLocally(w, d);
    }
  } else if (d.state === 'surfacing') {
    driftSurface(w, d, dt);
    d.timer -= dt;
    if (d.timer <= 0) {
      d.state = 'surface';
      surfaceMoment(w, d);
      announce(w, 'DIVER SURFACED — GET ALONGSIDE ON PORT', d);
      effect(w, 'surface', d);
    }
  }
  if (d.state === 'surface') {
    if (d.speech?.pending && Math.hypot(d.x - b.x, d.y - b.y) < 28) {
      d.speech.pending = false;
      d.speech.until = w.time + 12;
    }
    applyDiveInjury(w, d);
    driftSurface(w, d, dt);
    swimToPickupWater(w, d, dt);
    const r = recoveryStatus(w, tolerance, d);
    if (a.work && d.bagHandled) {
      const next = rediveStatus(w, d);
      if (r.available && next.available) {
        sendDown(w, d);
        return;
      }
      announce(w, `DIVE REJECTED — ${r.reason || next.reason}`, d);
      refusalMoment(w, d, r.reason || next.reason);
      return;
    }
    const requested = a.recoverDiver ? 'recoverDiver' : a.work && !deploy ? 'recoverBag' : null;
    if (requested) {
      if (d.hooking && d.recoveryAction === requested && w.career) {
        /* Repeated work keeps the current recovery running. */
      } else if (d.hooking && d.recoveryAction === requested) {
        d.hooking = false;
        d.recoveryPause = 'PLAYER PAUSED';
        announce(w, 'RECOVERY PAUSED — PLAYER PAUSED', d);
      } else if (!r.available || (requested === 'recoverBag' && d.bagHandled)) {
        announce(w, `RECOVERY REJECTED — ${r.reason || 'BAG ALREADY ABOARD'}`, d);
        refusalMoment(w, d, r.reason || 'BAG ALREADY ABOARD');
      } else {
        d.recoveryAction = requested;
        d.hooking = true;
        d.recoveryPause = '';
        announce(w, d.hook ? 'RECOVERY RESUMED' : 'RECOVERY STARTED', d);
        effect(w, 'hook', d);
      }
    }
    if (d.hooking) {
      if (r.reason !== d.recoveryPause) {
        d.recoveryPause = r.reason;
        announce(
          w,
          r.reason ? `RECOVERY PAUSED — ${r.reason}` : 'RECOVERY RESUMED — POSITION VALID',
          d,
        );
      }
      if (r.available) {
        d.hook += dt;
        if (d.hook + 1e-9 >= recoveryDuration(d)) finishRecovery(w, d);
      }
    }
  } else if (a.recoverDiver && !deploy)
    announce(w, `RECOVERY REJECTED — ${recoveryStatus(w, tolerance, d).reason}`, d);
}
export function step(w, a, dt, { tolerance = C.recovery.tolerance } = {}) {
  if (!activeDay(w) || w.emergency?.mandatoryRescue) return;
  w.time += dt;
  if (departing(w)) {
    advanceDeparture(w, dt);
    return;
  }
  if (!w.career?.sandbox || !w.career.testConditions?.freezeClock) advanceDay(w, dt);
  updateEnvironment(w);
  updateWeather(w);
  stepFishery(w, dt);
  stepSeaEvents(w, dt);
  stepDeckWork(w, dt);
  for (const d of w.divers) d.hookSeconds = gear(w, 'hoist') ? 2.2 : C.recovery.hookSeconds;
  const commands = pinActionTargets(w, a, tolerance);
  if (a.recall && commands.recallDiverId !== undefined) recallDiver(w, commands.recallDiverId);
  const previous = { x: w.boat.x, y: w.boat.y, heading: w.boat.heading },
    wasGrounded = w.boat.grounded;
  stepBoat(
    w,
    ['docking', 'departing'].includes(w.day.inspection?.status)
      ? { neutral: true, centerRudder: true }
      : a,
    dt,
  );
  updateFuelWarnings(w);
  if (w.boat.grounded && !wasGrounded) {
    effect(w, 'ground');
    announce(
      w,
      'GROUNDED — REVERSE TOWARD DEEPER WATER; IF STRANDED, WAIT AT SEA FOR THE TIDE OR RADIO FOR A PAID TOW',
    );
  }
  stepRocks(w, previous);
  if (beginDeparture(w)) return;
  releaseRunoff(w);
  stepLogs(w, dt, previous);
  checkDiverSafety(w, previous);
  stepWildlife(w, dt);
  stepTraffic(w, dt);
  if (w.emergency?.mandatoryRescue) return;
  driftDebris(w, dt);
  if (a.fullAhead) announce(w, 'THROTTLE FULL AHEAD');
  if (a.fullReverse) announce(w, 'THROTTLE FULL REVERSE');
  if (a.neutral) announce(w, 'THROTTLE NEUTRAL');
  for (const d of w.divers)
    stepDiver(
      w,
      d,
      {
        work: !!a.work && commands.workDiverId === d.id,
        recoverDiver: !!a.recoverDiver && commands.recoverDiverId === d.id,
      },
      dt,
      tolerance,
    );
  recordKnowledge(w);
  if (w.career && w.career.day > 0 && w.time >= (w.nextFleetStep || 0)) {
    advanceFleet(w);
    w.nextFleetStep = w.time + 2;
  }
}
