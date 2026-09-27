import { clearVesselPose } from './vessel-contact.js';
import { godmode } from './godmode.js';
import { clamp } from './math.js';
import { engineState } from './operating-state.js';
import { C } from './config.js';
import { currentAt } from './world.js';
import { minimumHullDepth, resolveHullContact } from './hull-contact.js';
import { boatSpec, boatDefinition } from './boats.js';
import { canCrossReturnBoundary, canExitSector } from './navigation.js';
import { ECONOMY } from './career-data.js';
import { windLoads } from './wind-motion.js';
import { waterLoads } from './water-loads.js';
let Matter;
const bodies = new WeakMap();
export function configureBoatPhysics(matter) {
  Matter = matter;
}
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export function rudderAuthority(speed) {
  const ratio = Math.abs(speed) / C.boat.maxSpeed;
  if (speed < 0)
    return C.boat.reverseRudder * smooth(0.08, 0.45, Math.abs(speed) / C.boat.reverseSpeed);
  return smooth(0.08, 0.45, ratio) * (1 - 0.7 * smooth(0.55, 1, ratio));
}
export const hullDepth = minimumHullDepth;
function physics(w) {
  if (!Matter) throw new Error('Configure Phaser Matter before stepping the boat');
  const spec = boatSpec(w),
    key = `${spec.length}/${spec.width}/${spec.mass}`;
  if (bodies.get(w)?.key !== key) {
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
    const body = Matter.Bodies.rectangle(w.boat.x, w.boat.y, spec.width, spec.length, {
      frictionAir: 0,
      friction: 0,
      restitution: 0,
      slop: 0.01,
    });
    Matter.Body.setMass(body, spec.mass);
    Matter.Composite.add(engine.world, body);
    bodies.set(w, { engine, body, key, last: {} });
  }
  return bodies.get(w);
}
export function stepBoat(w, a, dt) {
  const b = w.boat,
    spec = boatSpec(w),
    definition = boatDefinition(b.configuration),
    { engine, body, last } = physics(w),
    { Body, Engine } = Matter;
  if (b.grounded && hullDepth(w) >= spec.draft + spec.groundingRelease) b.grounded = false;
  // Debug repositioning is explicit. Ordinary motion never replaces velocity each tick.
  if (b.x !== last.x || b.y !== last.y) Body.setPosition(body, { x: b.x, y: b.y });
  if (b.heading !== last.heading) Body.setAngle(body, b.heading);
  if (b.vx !== last.vx || b.vy !== last.vy) Body.setVelocity(body, { x: b.vx / 60, y: b.vy / 60 });
  if (b.turn !== last.turn) Body.setAngularVelocity(body, b.turn / 60);
  b.throttle = clamp(b.throttle + (a.throttle || 0) * spec.throttleRate * dt, -1, 1);
  b.pivotGesture = false;
  if (a.fullAhead) b.throttle = 1;
  if (a.fullReverse) b.throttle = -1;
  if (a.neutral) b.throttle = 0;
  if (a.centerRudder) b.rudder = 0;
  b.rudder = clamp(
    b.rudder + (a.steer || 0) * spec.rudderRate * spec.rudderSensitivity * dt,
    -spec.rudderLimit,
    spec.rudderLimit,
  );
  const c = currentAt(w, b.x, b.y),
    s = Math.sin(b.heading),
    co = Math.cos(b.heading);
  const vx = body.velocity.x * 60 - c.x,
    vy = body.velocity.y * 60 - c.y;
  const forward = vx * s - vy * co,
    lateral = vx * co + vy * s;
  const drive = (b.driveHealth ?? 1) > 0 ? Math.max(0.25, b.driveHealth ?? 1) : 0;
  b.thruster = clamp(a.thruster || 0, -1, 1);
  b.pivot = spec.pivotRate && !a.fullAhead && !a.fullReverse ? clamp(a.pivot || 0, -1, 1) : 0;
  b.pivotGesture = Math.abs(b.pivot) > 0.05;
  const powered = engineState(w).powered;
  const rough =
    drive > 0 && drive < 0.65 ? 0.86 + 0.14 * Math.sin(w.time * 5.7) * Math.sin(w.time * 2.3) : 1;
  const target = powered
    ? (b.pivotGesture ? 0 : b.throttle) *
      (b.throttle < 0 ? spec.reverseSpeed : spec.maxSpeed) *
      drive *
      rough
    : 0;
  const along = clamp((target - forward) * spec.drag, -spec.acceleration, spec.acceleration);
  const across = -lateral * spec.lateralDrag;
  Body.applyForce(body, body.position, {
    x: (body.mass * (along * s + across * co)) / 1e6,
    y: (body.mass * (-along * co + across * s)) / 1e6,
  });
  const passive = 1 - Math.min(1, Math.abs(b.throttle) * 4);
  for (const load of waterLoads(
    spec,
    forward,
    lateral,
    body.angularVelocity * 60,
    b.rudder,
    1 - smooth(0.02, 0.08, Math.abs(b.throttle)),
  ))
    Body.applyForce(
      body,
      { x: body.position.x + s * load.fore, y: body.position.y - co * load.fore },
      {
        x: (body.mass * load.side * co * passive) / 1e6,
        y: (body.mass * load.side * s * passive) / 1e6,
      },
    );
  // Cabin wind load acts forward of the centre of mass, matching the visible wheelhouse.
  for (const load of windLoads(w.environment.wind, spec, !!w.career))
    Body.applyForce(
      body,
      { x: body.position.x + s * load.fore, y: body.position.y - co * load.fore },
      {
        x: (body.mass * load.x) / 1e6,
        y: (body.mass * load.y) / 1e6,
      },
    );
  // Thruster force acts at the bow, so it supplies both lateral motion and torque.
  const thruster = powered
    ? b.thruster *
      spec.bowThrusterStrength *
      (1 -
        smooth(spec.bowThrusterFadeStart ?? 0.8, spec.bowThrusterFadeEnd ?? 2.4, Math.abs(forward)))
    : 0;
  if (thruster)
    Body.applyForce(
      body,
      { x: body.position.x + s * spec.length * 0.4, y: body.position.y - co * spec.length * 0.4 },
      { x: (body.mass * thruster * co) / 1e6, y: (body.mass * thruster * s) / 1e6 },
    );
  const authority = spec.vectorDrive
    ? Math.min(1, powered ? Math.abs(b.throttle) * 1.9 : 0) *
      (1 - 0.38 * smooth(0.55, 1, Math.abs(forward) / spec.maxSpeed))
    : Math.max(
        rudderAuthority(forward) * Math.min(1, Math.abs(b.throttle) * 4),
        w.career && powered ? Math.max(0, b.throttle) * 0.24 : 0,
      );
  const turnSign = spec.vectorDrive
    ? Math.sign((powered ? b.throttle : 0) || forward)
    : Math.sign(forward);
  // A single stern nozzle sweeps a wider circle; twin opposed jets cancel translation.
  if (powered && b.pivotGesture && definition.id.startsWith('jet'))
    Body.applyForce(body, body.position, {
      x: (-b.pivot * co * body.mass * 0.7) / 1e6,
      y: (-b.pivot * s * body.mass * 0.7) / 1e6,
    });
  const targetTurn =
    (b.pivotGesture ? 0 : b.rudder) *
      spec.rudderEffectiveness *
      authority *
      turnSign *
      (spec.vectorDrive ? drive * rough : 1) +
    (b.grounded && powered ? b.rudder * Math.max(0, b.throttle) * spec.groundedPropwash : 0) +
    (powered ? b.pivot * (spec.pivotRate || 0) * (1 - smooth(0.5, 2.5, Math.abs(forward))) : 0) +
    (powered && b.throttle < 0 ? spec.reversePropWalk * -b.throttle : 0) +
    (Math.sin(w.time * 1.3) * w.environment.waves) / spec.waveTolerance;
  body.torque +=
    (body.inertia *
      (targetTurn - body.angularVelocity * 60) *
      spec.turnResponse *
      (Math.abs(b.throttle) > 0.05 || b.pivotGesture || !w.career ? 1 : 0.35)) /
    1e6;
  if (w.career?.difficulty === 'easy' && b.grounded && b.throttle < -0.05 && powered) {
    const reverse = spec.groundedReverseSpeed;
    const testDepth = hullDepth(w, b.x - s * reverse * dt, b.y + co * reverse * dt, b.heading);
    if (testDepth > hullDepth(w) + 1e-7)
      Body.setVelocity(body, { x: (-s * reverse) / 60, y: (co * reverse) / 60 });
  }
  const old = { x: b.x, y: b.y, heading: b.heading };
  Engine.update(engine, dt * 1000);
  const solved = resolveHullContact(
    w,
    old,
    { x: body.position.x, y: body.position.y, heading: body.angle },
    { vx: body.velocity.x * 60, vy: body.velocity.y * 60, turn: body.angularVelocity * 60 },
    dt,
    body.inertia / body.mass,
  );
  const trafficPose = clearVesselPose(w, b, old, solved, spec);
  if (trafficPose.blocked) Object.assign(solved, trafficPose, { vx: 0, vy: 0, turn: 0 });
  let { x, y, heading } = solved;
  // Shoal contact constrains the hull but does not damage it (Bible §4).
  // Timber/other impact hazards retain their separate damage calculations.
  if (solved.contact || trafficPose.blocked) {
    Body.setPosition(body, { x, y });
    Body.setAngle(body, heading);
    Body.setVelocity(body, { x: solved.vx / 60, y: solved.vy / 60 });
    Body.setAngularVelocity(body, solved.turn / 60);
  }
  b.grounded =
    (solved.contact || b.grounded) &&
    hullDepth(w, x, y, heading) < spec.draft + spec.groundingRelease;
  const margin = spec.length / 2,
    size = w.terrain.size,
    edge = canCrossReturnBoundary(w) ? w.day.returnExit?.edge : null;
  const bx = clamp(
      x,
      edge === 'west' ? -0.1 : margin,
      edge === 'east' ? size + 0.1 : size - margin,
    ),
    by = clamp(y, edge === 'north' ? -0.1 : margin, edge === 'south' ? size + 0.1 : size - margin);
  if (bx !== x || by !== y) {
    Body.setPosition(body, { x: bx, y: by });
    Body.setVelocity(body, {
      x: bx !== x ? 0 : body.velocity.x,
      y: by !== y ? 0 : body.velocity.y,
    });
    if (w.day.phase === 'working' && !w.boundaryNotice) {
      w.events.push(
        canExitSector(w)
          ? `SECTOR EDGE — HARBOUR EXIT ${w.day.returnExit.label}`
          : 'BRING BOTH DIVERS ABOARD BEFORE LEAVING THE SECTOR',
      );
      w.boundaryNotice = true;
    }
  } else if (x > margin + 2 && x < size - margin - 2 && y > margin + 2 && y < size - margin - 2)
    w.boundaryNotice = false;
  Object.assign(b, {
    x: bx,
    y: by,
    heading: body.angle,
    vx: body.velocity.x * 60,
    vy: body.velocity.y * 60,
    turn: body.angularVelocity * 60,
  });
  b.speed = (b.vx - c.x) * Math.sin(b.heading) - (b.vy - c.y) * Math.cos(b.heading);
  const fuelRate = w.career
    ? (boatSpec(w).travelBurn * C.day.minutesPerSecond) / 60
    : spec.fuelBurn * definition.cost;
  const fuel =
    powered && !godmode(w)
      ? Math.min(
          b.fuel,
          ((w.career ? 0.07 : 0) +
            Math.abs(b.throttle) * (w.career ? 0.93 : 1) * drive +
            Math.abs(b.pivot) * (spec.pivotRate ? 0.3 : 0) +
            Math.abs(b.thruster) * (spec.bowThrusterStrength ? 0.08 : 0)) *
            fuelRate *
            dt,
        )
      : 0;
  b.fuel = Math.max(0, b.fuel - fuel);
  b.fuelUsed = (b.fuelUsed || 0) + fuel;
  if (w.costs)
    w.costs.fuel += fuel * (w.career ? ECONOMY.fuelPrice : C.prototypeCosts.fuelUnitPrice);
  Object.assign(last, { x: b.x, y: b.y, heading: b.heading, vx: b.vx, vy: b.vy, turn: b.turn });
}
