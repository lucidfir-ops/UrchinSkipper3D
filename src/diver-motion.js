import { boatSpec } from './boats.js';
import { C } from './config.js';
import { depthAt } from './terrain.js';

// Compressed game time. These are animation/operation timings, not dive guidance.
export const DIVER_MOTION = Object.freeze({
  preparationSeconds: 0.95,
  entrySeconds: 0.35,
  descentMetersPerSecond: 10,
  climbSeconds: 0.85,
  stowSeconds: 0.4,
  recoverySwimSpeed: 2.6,
  ladderReach: 0.35,
  surfaceFeet: -1.22,
  deckFeet: 0.9,
});
const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const localPoint = (w, side, aft) => ({
  x: w.boat.x + side * Math.cos(w.boat.heading) - aft * Math.sin(w.boat.heading),
  y: w.boat.y + side * Math.sin(w.boat.heading) + aft * Math.cos(w.boat.heading),
});

// The ladder is on the working (port/left) rail, just aft of amidships.
export function portRecoveryPoint(w, offset = 0.6) {
  const spec = boatSpec(w);
  return localPoint(w, -spec.width / 2 - offset, spec.length * 0.08);
}
export function atRecoveryLadder(w, d) {
  const ladder = portRecoveryPoint(w);
  return Math.hypot(d.x - ladder.x, d.y - ladder.y) <= DIVER_MOTION.ladderReach;
}
function deckPosition(w, d) {
  const spec = boatSpec(w),
    progress =
      d.deckWalkStarted == null
        ? 1
        : clamp((w.time - d.deckWalkStarted) / DIVER_MOTION.stowSeconds),
    side = lerp(-spec.width / 2 + 0.08, (d.id ? 1 : -1) * spec.width * 0.4, smooth(progress)),
    aft = lerp(spec.length * 0.08, spec.length * 0.06, smooth(progress));
  return { ...localPoint(w, side, aft), side, aft, progress };
}
export function diveTransit(w, d, fromDeck = true, waterDepth = depthAt(w, d.x, d.y)) {
  const depth = Math.max(0, waterDepth + DIVER_MOTION.surfaceFeet),
    prepareSeconds = fromDeck ? DIVER_MOTION.preparationSeconds : 0,
    entrySeconds = DIVER_MOTION.entrySeconds,
    total = Math.max(
      C.diver.deploySeconds,
      prepareSeconds + entrySeconds + depth / DIVER_MOTION.descentMetersPerSecond,
    );
  return {
    kind: 'descent',
    fromDeck,
    depth,
    prepareSeconds,
    entrySeconds,
    total,
    heading: w.boat.heading - Math.PI / 2,
    entryPlayed: !fromDeck,
    ...(fromDeck && d.deckWalkStarted != null
      ? { deckStart: { side: deckPosition(w, d).side, aft: deckPosition(w, d).aft } }
      : {}),
  };
}
export function diverDepth(w, d) {
  const transit = d.transit,
    bottom = Math.max(0, depthAt(w, d.x, d.y) + DIVER_MOTION.surfaceFeet);
  if (d.state === 'deploying') {
    const total = transit?.total || C.diver.deploySeconds,
      lead = (transit?.prepareSeconds || 0) + (transit?.entrySeconds || 0),
      progress = clamp((total - Math.max(0, d.timer) - lead) / Math.max(0.01, total - lead));
    // Follow the local seabed throughout a current-driven descent. Locking the
    // original bottom here creates a vertical jump when bottom work starts.
    return bottom * progress;
  }
  if (d.state === 'surfacing')
    return (
      Math.min(bottom, transit?.kind === 'ascent' ? transit.depth : bottom) *
      clamp(Math.max(0, d.timer) / (transit?.total || C.diver.warningSeconds))
    );
  return ['searching', 'harvesting'].includes(d.state) ? bottom : 0;
}

// One pure pose contract for renderer, cues and tests. x/y are world plan coordinates;
// height is the figure's feet relative to sea level. The renderer supplies wave motion.
export function diverMotion(w, d) {
  const spec = boatSpec(w),
    transit = d.transit,
    depth = diverDepth(w, d),
    rail = portRecoveryPoint(w, -0.08),
    point = portRecoveryPoint(w),
    assigned = localPoint(w, (d.id ? 1 : -1) * spec.width * 0.4, spec.length * 0.06),
    aboard = transit?.deckStart
      ? localPoint(w, transit.deckStart.side, transit.deckStart.aft)
      : assigned,
    pose = {
      phase: d.state,
      progress: 0,
      x: d.x,
      y: d.y,
      depth,
      height: DIVER_MOTION.surfaceFeet - depth,
      pitch: 0,
      heading: d.motionHeading ?? transit?.heading ?? w.boat.heading,
      aboard: false,
      underwater: depth > 0.05,
    };
  if (d.state === 'ready') {
    const deck = deckPosition(w, d),
      walking = deck.progress < 1,
      toward = Math.atan2(assigned.x - rail.x, rail.y - assigned.y),
      start = w.boat.heading + Math.PI / 2,
      turn = Math.atan2(Math.sin(toward - start), Math.cos(toward - start));
    return {
      ...pose,
      x: deck.x,
      y: deck.y,
      phase: walking ? 'stowing' : 'aboard',
      progress: deck.progress,
      height: DIVER_MOTION.deckFeet,
      aboard: true,
      heading: start + turn * smooth(deck.progress * 3),
    };
  }
  if (d.state === 'deploying') {
    const total = transit?.total || C.diver.deploySeconds,
      elapsed = Math.max(0, total - d.timer),
      prep = transit?.prepareSeconds || 0,
      entry = transit?.entrySeconds || 0;
    if (elapsed < prep) {
      const progress = clamp(elapsed / prep),
        move = smooth((progress - 0.25) / 0.75);
      return {
        ...pose,
        phase: 'preparing',
        progress,
        x: lerp(aboard.x, rail.x, move),
        y: lerp(aboard.y, rail.y, move),
        height: DIVER_MOTION.deckFeet,
        aboard: true,
      };
    }
    if (elapsed < prep + entry) {
      const progress = clamp((elapsed - prep) / entry),
        fall = smooth(progress);
      return {
        ...pose,
        phase: 'entering',
        progress,
        x: transit?.fromDeck ? lerp(rail.x, d.x, fall) : d.x,
        y: transit?.fromDeck ? lerp(rail.y, d.y, fall) : d.y,
        height: transit?.fromDeck
          ? lerp(DIVER_MOTION.deckFeet, DIVER_MOTION.surfaceFeet, fall)
          : DIVER_MOTION.surfaceFeet,
        pitch: Math.sin(progress * Math.PI) * 0.22,
      };
    }
    return {
      ...pose,
      phase: 'descending',
      progress: clamp((elapsed - prep - entry) / Math.max(0.01, total - prep - entry)),
      pitch: 0.18,
    };
  }
  if (d.state === 'surfacing')
    return {
      ...pose,
      phase: 'ascending',
      progress: 1 - clamp(d.timer / (transit?.total || C.diver.warningSeconds)),
      pitch: -0.12,
    };
  if (['searching', 'harvesting'].includes(d.state))
    return { ...pose, phase: d.state === 'harvesting' ? 'working' : 'searching', pitch: -0.75 };
  if (d.state === 'surface') {
    const duration =
        (d.bagHandled ? C.recovery.boardSeconds : d.hookSeconds || C.recovery.hookSeconds) +
        (d.recoveryAction === 'recoverDiver' ? 2 : 0),
      climbAt = duration - DIVER_MOTION.climbSeconds;
    if (
      (d.hooking || d.hook > 0) &&
      d.recoveryAction === 'recoverDiver' &&
      d.hook >= climbAt &&
      atRecoveryLadder(w, d)
    ) {
      const progress = clamp((d.hook - climbAt) / DIVER_MOTION.climbSeconds),
        move = smooth(Math.max(0, (progress - 0.65) / 0.35));
      return {
        ...pose,
        phase: 'boarding',
        progress,
        x: lerp(d.x, rail.x, move),
        y: lerp(d.y, rail.y, move),
        height: lerp(DIVER_MOTION.surfaceFeet, DIVER_MOTION.deckFeet, smooth(progress)),
        heading: w.boat.heading + Math.PI / 2,
        pitch: 0.18 * (1 - progress),
      };
    }
    return {
      ...pose,
      phase: d.hooking ? (!atRecoveryLadder(w, d) ? 'approaching' : 'hauling') : 'waiting',
      progress: clamp(d.hook / duration),
      heading: d.hooking ? Math.atan2(point.x - d.x, d.y - point.y) : pose.heading,
    };
  }
  return pose;
}

// Only requested, valid recovery draws a surfaced diver to the actual ladder.
// Interrupted recovery leaves them in the sea, under normal drift and collision rules.
export function approachRecovery(w, d, dt) {
  const target = portRecoveryPoint(w),
    dx = target.x - d.x,
    dy = target.y - d.y,
    distance = Math.hypot(dx, dy),
    move = Math.min(distance, DIVER_MOTION.recoverySwimSpeed * dt);
  if (distance < 0.001) return;
  const x = d.x + (dx / distance) * move,
    y = d.y + (dy / distance) * move;
  if (depthAt(w, x, y) < 0.2) return;
  d.motionHeading = Math.atan2(dx, -dy);
  d.x = x;
  d.y = y;
}
