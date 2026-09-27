import { boatSpec } from './boats.js';
import { depthAt, depthGradient, clamp } from './terrain.js';

const pointCache = new Map();
function hullPoints(spec) {
  const key = `${spec.width}/${spec.length}`;
  if (!pointCache.has(key)) {
    const points = [];
    for (const side of [-spec.width / 2, 0, spec.width / 2])
      for (const fore of [-spec.length / 2, -spec.length / 4, 0, spec.length / 4, spec.length / 2])
        points.push({ side, fore });
    pointCache.set(key, points);
  }
  return pointCache.get(key);
}
function sample(w, pose, point) {
  const s = Math.sin(pose.heading),
    c = Math.cos(pose.heading),
    rx = point.side * c + point.fore * s,
    ry = point.side * s - point.fore * c;
  const x = pose.x + rx,
    y = pose.y + ry;
  return { x, y, rx, ry, depth: depthAt(w, x, y) };
}
export function minimumHullDepth(w, x = w.boat.x, y = w.boat.y, heading = w.boat.heading) {
  return Math.min(...hullPoints(boatSpec(w)).map((p) => sample(w, { x, y, heading }, p).depth));
}
// A lightweight unilateral contact solver around the same sampled depth field.
// Contact removes inward motion at the touching part of the hull, retaining
// tangent motion and rotation. It never moves a stranded boat up through land.
export function resolveHullContact(w, old, proposed, velocity, dt, inertiaPerMass) {
  const spec = boatSpec(w),
    points = hullPoints(spec),
    draft = spec.draft,
    oldSamples = points.map((p) => sample(w, old, p)),
    oldDepth = Math.min(...oldSamples.map((p) => p.depth));
  // A hull left well up the shoal by a falling tide is seated on the bottom.
  // Thrust/wind cannot slide it over dry land; rising water restores the normal
  // contact solver, or the skipper can use the existing paid rescue transition.
  if (oldDepth < draft * 0.5)
    return { ...old, vx: 0, vy: 0, turn: 0, impactSpeed: 0, contact: true };
  let pose = { ...proposed },
    contact = oldDepth < draft + spec.contactSkin;
  const floor = oldSamples.map((p) => Math.min(draft, p.depth));
  // Swept subposes retain the anti-tunnelling guarantee for high-speed impacts.
  const steps = Math.max(
    1,
    Math.ceil(
      (Math.hypot(proposed.x - old.x, proposed.y - old.y) +
        (Math.abs(proposed.heading - old.heading) * spec.length) / 2) /
        0.15,
    ),
  );
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    if (
      minimumHullDepth(
        w,
        old.x + (proposed.x - old.x) * f,
        old.y + (proposed.y - old.y) * f,
        old.heading + (proposed.heading - old.heading) * f,
      ) <
      Math.min(draft, oldDepth) - 0.00001
    ) {
      contact = true;
      break;
    }
  }
  if (!contact && minimumHullDepth(w, pose.x, pose.y, pose.heading) >= draft)
    return { ...pose, ...velocity, contact: false };
  for (let iteration = 0; iteration < 10; iteration++) {
    let corrected = false;
    for (let i = 0; i < points.length; i++) {
      const p = sample(w, pose, points[i]),
        penetration = floor[i] - p.depth;
      if (penetration <= 0.000001) continue;
      const g = depthGradient(w.terrain, p.x, p.y),
        length = Math.hypot(g.x, g.y);
      if (length < 0.0001) continue;
      const nx = g.x / length,
        ny = g.y / length,
        lever = p.rx * ny - p.ry * nx;
      const correction =
        Math.min(0.4, penetration / length) / (1 + (lever * lever) / inertiaPerMass);
      pose.x += nx * correction;
      pose.y += ny * correction;
      pose.heading += (lever * correction) / inertiaPerMass;
      corrected = true;
      contact = true;
    }
    if (!corrected) break;
  }
  // Nonlinear corners can defeat the local gradient. Keep the solved direction,
  // shortening that step until no part of the hull is farther into the shoal.
  const minimum = Math.min(draft, oldDepth);
  if (minimumHullDepth(w, pose.x, pose.y, pose.heading) < minimum - 0.00001) {
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 16; i++) {
      const f = (lo + hi) / 2;
      if (
        minimumHullDepth(
          w,
          old.x + (pose.x - old.x) * f,
          old.y + (pose.y - old.y) * f,
          old.heading + (pose.heading - old.heading) * f,
        ) >=
        minimum - 0.000001
      )
        lo = f;
      else hi = f;
    }
    pose = {
      x: old.x + (pose.x - old.x) * lo,
      y: old.y + (pose.y - old.y) * lo,
      heading: old.heading + (pose.heading - old.heading) * lo,
    };
  }
  let { vx, vy, turn } = velocity,
    impactSpeed = 0;
  const contacts = points
    .map((p) => sample(w, pose, p))
    .filter((p) => p.depth <= draft + spec.contactSkin);
  for (let iteration = 0; iteration < 5; iteration++)
    for (const p of contacts) {
      const g = depthGradient(w.terrain, p.x, p.y),
        length = Math.hypot(g.x, g.y);
      if (length < 0.0001) continue;
      const nx = g.x / length,
        ny = g.y / length,
        lever = p.rx * ny - p.ry * nx;
      const inward = vx * nx + vy * ny + turn * lever;
      if (inward < 0) {
        impactSpeed = Math.max(impactSpeed, -inward);
        const impulse = -inward / (1 + (lever * lever) / inertiaPerMass);
        vx += nx * impulse;
        vy += ny * impulse;
        turn += (lever * impulse) / inertiaPerMass;
      }
    }
  if (contacts.length || w.boat.grounded) {
    const friction = Math.exp(-spec.contactFriction * dt),
      speed = Math.hypot(vx, vy);
    const limit = w.boat.throttle < 0 ? spec.groundedReverseSpeed : spec.groundedSpeed;
    const scale = Math.min(friction, limit / Math.max(0.0001, speed));
    vx *= scale;
    vy *= scale;
    turn = clamp(turn * friction, -spec.groundedTurn, spec.groundedTurn);
  }
  return { ...pose, vx, vy, turn, impactSpeed, contact: contact || contacts.length > 0 };
}
