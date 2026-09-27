import { C } from './config.js';
import { boatSpec } from './boats.js';
import { fromHull } from './collision-geometry.js';
import { angleDelta } from './math.js';
import { waterRoute, clearWater, waterEntries } from './water-route.js';
import { moveTraffic } from './traffic-motion.js';
import { TRAFFIC, trafficSettings } from './traffic-settings.js';
import { beginInspection } from './fishery.js';
import { clearVesselPose } from './vessel-contact.js';
import { currentAt } from './environment.js';
import { inspectionDue } from './inspection-schedule.js';

export function alongsidePoint(w, actor, target = w.boat) {
  const width = target === w.boat ? boatSpec(w).width : target.width;
  return fromHull(target, (width + actor.width) / 2 + 1.2, 0);
}
function routeTo(w, actor, point) {
  const route = waterRoute(w, actor, point, { draft: actor.draft, radius: actor.width / 2 + 0.3 });
  if (!route.length) return false;
  actor.route = route;
  actor.waypoint = 0;
  return true;
}
function castOff(w, actor) {
  const entries = waterEntries(w, { draft: actor.draft, radius: 3 }).sort(
    (a, b) =>
      Math.hypot(a.x - w.boat.x, a.y - w.boat.y) - Math.hypot(b.x - w.boat.x, b.y - w.boat.y),
  );
  const candidates = [];
  for (const radius of [35, 55, 85, 130])
    for (let n = 0; n < 16; n++) {
      const angle = w.boat.heading + (n * Math.PI) / 8;
      candidates.push({
        x: w.boat.x + Math.cos(angle) * radius,
        y: w.boat.y + Math.sin(angle) * radius,
      });
    }
  // The visible casting-off transition also handles the shallow-water docking exception.
  for (const point of [...candidates, ...entries]) {
    if (
      !clearWater(w.terrain, w.environment.seaLevel || 0, point, {
        draft: actor.draft,
        radius: actor.length / 2,
      })
    )
      continue;
    if (Math.hypot(point.x - w.boat.x, point.y - w.boat.y) < 30) continue;
    if (
      w.traffic.actors.some(
        (other) =>
          other !== actor &&
          Math.hypot(point.x - other.x, point.y - other.y) < actor.length + other.length,
      )
    )
      continue;
    for (const exit of entries) {
      if (Math.hypot(point.x - exit.x, point.y - exit.y) < 20) continue;
      const route = waterRoute(w, point, exit, {
        draft: actor.draft,
        radius: actor.width / 2 + 0.3,
      });
      if (!route.length) continue;
      Object.assign(actor, point, {
        route,
        waypoint: 0,
        docking: false,
        phase: 'leaving',
        knots: 25,
        heading: Math.atan2(route[0].x - point.x, point.y - route[0].y),
        vx: 0,
        vy: 0,
        speed: 0,
        stuckSeconds: 0,
      });
      actor.renderFrom = { x: actor.x, y: actor.y, heading: actor.heading };
      return;
    }
  }
  actor.done = true; // No navigable exit: the transition completes the departure.
}
export function stepPatrol(w, actor, dt) {
  const inspection = w.day.inspection;
  if (
    actor.target === 'player' &&
    inspection?.actorId === actor.id &&
    inspection.status === 'departing'
  ) {
    actor.phase = 'departing';
    inspection.transitionSeconds -= dt;
    if (inspection.transitionSeconds <= 0) {
      castOff(w, actor);
      inspection.status = 'cleared';
      if (!actor.checked.includes('player')) actor.checked.push('player');
      w.events.push('DFO · Lines clear. Good luck, skipper.');
    }
    return;
  }
  if (actor.phase === 'leaving') {
    if (moveTraffic(w, actor, dt)) actor.done = true;
    if (actor.stuckSeconds >= 8) castOff(w, actor);
    return;
  }
  const target =
    actor.target === 'player' ? w.boat : w.traffic.actors.find((a) => a.id === actor.target);
  if (actor.target && !target) {
    actor.target = null;
    actor.phase = 'patrol';
  }
  if (target && actor.phase === 'inspection') {
    const i = w.day.inspection;
    if (actor.target === 'player' && i?.status === 'boarding') {
      Object.assign(actor, alongsidePoint(w, actor), {
        heading: target.heading,
        vx: target.vx,
        vy: target.vy,
        speed: Math.hypot(target.vx, target.vy),
      });
      return;
    }
    if (actor.target !== 'player') {
      actor.inspectSeconds -= dt;
      if (actor.inspectSeconds > 0) return;
      target.inspectedBy = null;
    } else if (i?.status !== 'cleared') {
      actor.phase = 'approach';
      return;
    }
    actor.checked.push(actor.target);
    actor.phase = 'leaving';
    actor.docking = false;
    actor.knots = 5;
    const entries = waterEntries(w, { draft: actor.draft, radius: 3 }).sort(
      (a, b) => Math.hypot(a.x - actor.x, a.y - actor.y) - Math.hypot(b.x - actor.x, b.y - actor.y),
    );
    if (!entries.some((point) => routeTo(w, actor, point))) actor.done = true;
    return;
  }
  if (target && actor.phase === 'approach') {
    const player = actor.target === 'player',
      i = player ? w.day.inspection : null,
      crewUp = player
        ? w.divers.every((d) => d.state === 'ready')
        : !target.divers?.some((d) => d.underwater),
      invited = !player || ['approaching', 'docking'].includes(i?.status),
      distance = Math.hypot(actor.x - target.x, actor.y - target.y);
    actor.docking = crewUp && invited;
    if (!actor.docking) {
      // A patrol does not encroach on working divers, even if the player moves
      // toward it or an old test/save begins with overlapping boats.
      const dx = actor.x - target.x,
        dy = actor.y - target.y,
        length = Math.max(0.01, distance),
        point = {
          x: target.x + (distance < 0.01 ? 1 : dx / length) * 105,
          y: target.y + (dy / length) * 105,
        };
      if (distance < 100) {
        Object.assign(actor, point, { vx: 0, vy: 0, speed: 0 });
        actor.renderFrom = { x: actor.x, y: actor.y, heading: actor.heading };
      } else if (distance > 110) {
        if (w.time >= (actor.nextRoute || 0)) {
          routeTo(w, actor, point);
          actor.nextRoute = w.time + 2;
        }
        actor.knots = 25;
        moveTraffic(w, actor, dt);
      } else actor.vx = actor.vy = actor.speed = 0;
      if (i && i.status !== 'calling') {
        i.status = 'calling';
        i.promptedCrewUp = undefined;
      }
      return;
    }
    const point = alongsidePoint(w, actor, target);
    actor.approachAt ??= w.time;
    const elapsed = w.time - (player ? (i.invitedAt ?? actor.approachAt) : actor.approachAt);
    if (i?.status === 'docking') {
      i.transitionSeconds -= dt;
      if (i.transitionSeconds > 0) return;
      Object.assign(actor, point, {
        heading: target.heading,
        vx: target.vx,
        vy: target.vy,
        speed: 0,
      });
      actor.renderFrom = { x: actor.x, y: actor.y, heading: actor.heading };
      beginInspection(w);
      actor.phase = 'inspection';
      return;
    }
    // Shallow water and blocked lanes cannot turn docking into a long chase.
    if (player && elapsed >= 8) {
      i.status = 'docking';
      i.transitionSeconds = 1.4;
      const flow = currentAt(w, target.x, target.y);
      Object.assign(target, { throttle: 0, rudder: 0, turn: 0, vx: flow.x, vy: flow.y });
      w.events.push('DFO · Stand by, taking the lines.');
      return;
    }
    if (distance < 38) {
      // Low-speed bow-thruster docking: translation and heading are independent.
      const delta = angleDelta(target.heading, actor.heading),
        gap = Math.max(0.001, Math.hypot(point.x - actor.x, point.y - actor.y)),
        advance = Math.min(gap, 3 * dt),
        before = { x: actor.x, y: actor.y, heading: actor.heading },
        next = {
          x: actor.x + ((point.x - actor.x) / gap) * advance,
          y: actor.y + ((point.y - actor.y) / gap) * advance,
          heading: actor.heading + Math.max(-dt, Math.min(dt, delta)),
        },
        safe = clearVesselPose(w, actor, before, next);
      if (
        clearWater(w.terrain, w.environment.seaLevel || 0, safe, {
          draft: actor.draft,
          radius: actor.width / 2,
        })
      ) {
        Object.assign(actor, safe, {
          vx: (safe.x - before.x) / dt,
          vy: (safe.y - before.y) / dt,
          speed: advance / dt,
        });
      } else actor.vx = actor.vy = actor.speed = 0;
      if (
        Math.hypot(actor.x - point.x, actor.y - point.y) < 0.3 &&
        Math.abs(angleDelta(actor.heading, target.heading)) < 0.08
      ) {
        if (player) beginInspection(w);
        else {
          target.inspectedBy = actor.id;
          actor.inspectSeconds = trafficSettings(w).inspectionMinutes / C.day.minutesPerSecond;
        }
        actor.phase = 'inspection';
      }
    } else {
      actor.knots = 25;
      if (w.time >= (actor.nextRoute || 0)) {
        routeTo(w, actor, point);
        actor.nextRoute = w.time + 1.5;
      }
      moveTraffic(w, actor, dt);
    }
    return;
  }
  if (!actor.target) {
    const candidates = [
      ...((actor.forPlayer || inspectionDue(w)) && !actor.checked.includes('player')
        ? [{ ...w.boat, id: 'player' }]
        : []),
      ...w.traffic.actors.filter((a) => a.kind === 'rival' && a.phase === 'fishing'),
    ];
    const seen = candidates.find(
      (a) =>
        !actor.checked.includes(a.id) &&
        (actor.forPlayer || Math.hypot(actor.x - a.x, actor.y - a.y) <= TRAFFIC.sightMeters),
    );
    if (seen) {
      actor.target = seen.id;
      actor.phase = 'approach';
      actor.nextRoute = 0;
      if (seen.id === 'player') {
        w.day.inspection = {
          status: 'calling',
          minute: w.day.minute,
          fine: 0,
          actorId: actor.id,
          minutes: trafficSettings(w).inspectionMinutes,
        };
        w.events.push(
          'DFO PATROL · Calling your vessel. Answer the radio call; we will stay 100 m clear until your divers are aboard.',
        );
        w.effects.push({ type: 'radio' });
      }
    } else if (moveTraffic(w, actor, dt)) actor.done = true;
  }
}
