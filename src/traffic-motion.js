import { clearVesselPose } from './vessel-contact.js';
import { C } from './config.js';
import { clamp, angleDelta } from './math.js';
import { boatSpec } from './boats.js';
import { clearWater, waterSegment, waterRoute } from './water-route.js';
import { rivalWater, trafficHull } from './rival-plan.js';
import { checkDiverSafety } from './diver-safety.js';
import { hullDistance, fromHull } from './collision-geometry.js';
import { surfacedWildlifePoints } from './wildlife.js';
import { taxiSteering } from './taxi-steering.js';

export function moveTraffic(w, actor, dt) {
  actor.speed ??= actor.knots / C.knotsPerMps;
  let target = actor.route[actor.waypoint];
  const navigation = actor.kind === 'rival' && !actor.shallowEscape ? rivalWater(w) : w,
    level = navigation.environment.seaLevel || 0;
  const spec = actor.docking ? { draft: actor.draft, radius: 3 } : trafficHull(actor);
  if (!actor.docking && target) {
    const next = actor.route[actor.waypoint + 1],
      previous = actor.route[actor.waypoint - 1] || actor.routeStart,
      distance = Math.hypot(target.x - actor.x, target.y - actor.y),
      passed =
        previous &&
        (actor.x - target.x) * (target.x - previous.x) +
          (actor.y - target.y) * (target.y - previous.y) >=
          0;
    // A fast boat looks through nearby intermediate waypoints and never circles
    // back to touch one it has passed while avoiding another hull.
    if (next && (distance < 24 || passed) && waterSegment(w.terrain, level, actor, next, spec)) {
      actor.waypoint++;
      target = next;
    }
  }
  // Transiting boats leave at the final edge waypoint, before water bounds can
  // strand an overshooting turn. They fade over the final approach in the view.
  if (
    target &&
    actor.waypoint === actor.route.length - 1 &&
    (['taxi', 'tourist'].includes(actor.kind) || actor.phase === 'leaving')
  ) {
    const edge = Math.min(target.x, target.y, w.terrain.size - target.x, w.terrain.size - target.y);
    if (edge <= 10 && Math.hypot(actor.x - target.x, actor.y - target.y) <= 12) return true;
  }
  if (!target) {
    actor.vx = actor.vy = actor.speed = 0;
    return true;
  }
  let dx = target.x - actor.x,
    dy = target.y - actor.y;
  if (
    Math.hypot(dx, dy) <
    (actor.docking ? 0.7 : Math.max(3, (actor.knots / C.knotsPerMps) * dt * 1.5))
  ) {
    actor.waypoint++;
    return false;
  }
  const length = Math.max(0.001, Math.hypot(dx, dy));
  dx /= length;
  dy /= length;
  const player = boatSpec(w),
    avoid = [
      ...(!actor.docking || actor.target !== 'player'
        ? [{ ...w.boat, radius: player.length / 2 + actor.length / 2 + 4 }]
        : []),
      ...(w.traffic?.actors || [])
        .filter((a) => a !== actor)
        .map((a) => ({ ...a, radius: (a.length + actor.length) / 2 + 3 })),
      ...(actor.kind === 'taxi' ? surfacedWildlifePoints(w) : []),
    ];
  if (actor.kind !== 'taxi')
    for (const d of [
      ...w.divers,
      ...(w.traffic?.actors || []).filter((a) => a !== actor).flatMap((a) => a.divers || []),
    ])
      if (
        typeof d.underwater === 'boolean' ||
        ['deploying', 'searching', 'harvesting', 'surfacing', 'surface'].includes(d.state)
      )
        avoid.push({ ...d, radius: 17 });
  if (actor.kind === 'taxi') ({ dx, dy } = taxiSteering(actor, avoid, dx, dy));
  for (const obstacle of actor.kind === 'taxi' ? [] : avoid) {
    const x = actor.x - obstacle.x,
      y = actor.y - obstacle.y,
      d = Math.hypot(x, y),
      range = obstacle.radius + (actor.knots / C.knotsPerMps) * 2;
    if (d >= range || d < 0.001) continue;
    const force = ((range - d) / Math.max(1, range - obstacle.radius)) * 2.5;
    const side = actor.id.charCodeAt(actor.id.length - 1) % 2 ? 1 : -1;
    dx += (x / d) * force - (y / d) * force * 0.8 * side;
    dy += (y / d) * force + (x / d) * force * 0.8 * side;
  }
  const desired = actor.detourUntil > w.time ? actor.detourHeading : Math.atan2(dx, -dy),
    delta = angleDelta(desired, actor.heading),
    heading = actor.heading + clamp(delta, -actor.turnRate * dt, actor.turnRate * dt),
    desiredSpeed =
      actor.kind === 'taxi'
        ? (actor.knots / C.knotsPerMps) * Math.max(0.45, Math.cos(delta))
        : Math.min(actor.knots / C.knotsPerMps, length / (actor.docking ? 0.5 : 2)) *
          (!actor.docking && Math.abs(delta) > 0.35 ? 0 : Math.max(0, Math.cos(delta))),
    speed =
      actor.kind === 'taxi'
        ? actor.speed + clamp(desiredSpeed - actor.speed, -5 * dt, 3 * dt)
        : desiredSpeed,
    next = {
      x: actor.x + Math.sin(heading) * speed * dt,
      y: actor.y - Math.cos(heading) * speed * dt,
    };
  const previous = { x: actor.x, y: actor.y, heading: actor.heading };
  const safe = clearVesselPose(w, actor, previous, { ...next, heading });
  actor.heading = safe.heading;
  if (
    safe.blocked ||
    !clearWater(w.terrain, level, next, spec) ||
    !waterSegment(w.terrain, level, actor, next, spec) ||
    (actor.docking &&
      actor.target === 'player' &&
      [-1, 1].some((side) =>
        [-1, 1].some((fore) => {
          const corner = fromHull(
            { ...next, heading },
            (side * actor.width) / 2,
            (fore * actor.length) / 2,
          );
          return hullDistance(w.boat, corner.x, corner.y, player) < 0.25;
        }),
      )) ||
    avoid.some(
      (o) =>
        Math.hypot(next.x - o.x, next.y - o.y) < o.radius &&
        Math.hypot(next.x - o.x, next.y - o.y) < Math.hypot(actor.x - o.x, actor.y - o.y),
    )
  ) {
    if (safe.blocked) {
      actor.x = safe.x;
      actor.y = safe.y;
    }
    actor.vx = actor.vy = actor.speed = 0;
    actor.stuckSeconds = (actor.stuckSeconds || 0) + dt;
    if (!actor.docking && actor.stuckSeconds >= 1 && !(actor.detourUntil > w.time)) {
      // Try a short, fully wet escape leg before returning to the committed
      // destination. Do not keep pushing the same shoreline or orbit a hull.
      const bearing = Math.atan2(target.x - actor.x, actor.y - target.y);
      for (const offset of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, Math.PI]) {
        const angle = bearing + offset,
          p = { x: actor.x + Math.sin(angle) * 12, y: actor.y - Math.cos(angle) * 12 };
        if (
          waterSegment(w.terrain, level, actor, p, spec) &&
          !avoid.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < o.radius + 1)
        ) {
          actor.detourHeading = angle;
          actor.detourUntil = w.time + 3;
          break;
        }
      }
      if (actor.stuckSeconds >= 4) {
        const route = waterRoute(navigation, actor, actor.route.at(-1), spec);
        if (route.length) {
          actor.route = route;
          actor.routeStart = { x: actor.x, y: actor.y };
          actor.waypoint = 0;
        }
        actor.stuckSeconds = 1;
      }
    }
    const edge = Math.min(actor.x, actor.y, w.terrain.size - actor.x, w.terrain.size - actor.y);
    if (['taxi', 'tourist'].includes(actor.kind) && edge < 22 && actor.stuckSeconds >= 3)
      return true;
    return false;
  }
  actor.stuckSeconds = 0;
  actor.vx = (next.x - actor.x) / dt;
  actor.vy = (next.y - actor.y) / dt;
  actor.speed = speed;
  actor.x = next.x;
  actor.y = next.y;
  checkDiverSafety(w, previous, {
    boat: actor,
    spec: { length: actor.length, width: actor.width },
    exposed: true,
  });
  return false;
}
