import { answerPatrol } from '../src/fishery.js';
import { step, deploymentStatus, recoveryStatus } from '../src/simulation.js';
import { boatSpec } from '../src/boats.js';
import { depthAt } from '../src/terrain.js';
import { currentAt } from '../src/environment.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angle = (v) => Math.atan2(Math.sin(v), Math.cos(v));
// Test pilot: movement only through the real helm and physics. No teleporting,
// manufactured bags, restored air, changed weather, or bypassed harbour exit.
function route(w, goal) {
  const spacing = 10,
    n = Math.floor(w.terrain.size / spacing),
    spec = boatSpec(w),
    safe = new Map();
  const key = (x, y) => y * n + x,
    point = (k) => ({ x: (k % n) * spacing, y: Math.floor(k / n) * spacing });
  const wet = (k) => {
    if (safe.has(k)) return safe.get(k);
    const p = point(k);
    let ok = p.x > 6 && p.y > 6 && p.x < w.terrain.size - 6 && p.y < w.terrain.size - 6;
    for (let a = 0; ok && a < Math.PI * 2; a += Math.PI / 4)
      ok = depthAt(w, p.x + Math.cos(a) * 8, p.y + Math.sin(a) * 8) > spec.draft + 0.25;
    safe.set(k, ok);
    return ok;
  };
  const start = key(Math.round(w.boat.x / spacing), Math.round(w.boat.y / spacing)),
    end = key(Math.round(goal.x / spacing), Math.round(goal.y / spacing));
  const open = new Set([start]),
    from = new Map(),
    cost = new Map([[start, 0]]),
    score = (k) => {
      const p = point(k);
      return (cost.get(k) || 0) + Math.hypot(p.x - goal.x, p.y - goal.y);
    };
  let found;
  while (open.size) {
    const current = [...open].reduce((a, b) => (score(a) < score(b) ? a : b));
    open.delete(current);
    if (current === end || Math.hypot(point(current).x - goal.x, point(current).y - goal.y) < 11) {
      found = current;
      break;
    }
    const p = point(current);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const x = p.x / spacing + dx,
        y = p.y / spacing + dy;
      if (x < 1 || y < 1 || x >= n || y >= n) continue;
      const next = key(x, y);
      if (!wet(next)) continue;
      const value = cost.get(current) + Math.hypot(dx, dy) * spacing;
      if (value < (cost.get(next) ?? Infinity)) {
        cost.set(next, value);
        from.set(next, current);
        open.add(next);
      }
    }
  }
  if (found === undefined) throw new Error('Pilot cannot find a wet route');
  const points = [goal];
  for (let k = found; k !== start; k = from.get(k)) points.unshift(point(k));
  return points;
}
function helm(w, goal, speed = 2) {
  const b = w.boat,
    dx = goal.x - b.x,
    dy = goal.y - b.y,
    distance = Math.hypot(dx, dy),
    flow = currentAt(w, b.x, b.y);
  let wanted = clamp(distance * 0.18, 0.35, speed);
  if (Math.abs(angle(Math.atan2(dx, -dy) - b.heading)) > 0.25) wanted = Math.max(wanted, 1.9);
  // The pilot must slow before visible floating timber instead of relying on
  // the old exaggerated neutral turn to miss it by chance. Keep real contacts,
  // weather, damage thresholds and the voyage's hull-health assertion intact.
  const timber = Math.min(
    ...w.logs.map((log) => Math.hypot(log.x - b.x, log.y - b.y) - log.length / 2),
  );
  if (timber < 24) wanted = Math.min(wanted, 0.45 + Math.max(0, timber - 12) * 0.12);
  const heading = Math.atan2(
      (dx / Math.max(0.1, distance)) * wanted - flow.x,
      (-dy / Math.max(0.1, distance)) * wanted + flow.y,
    ),
    error = angle(heading - b.heading),
    rudder = clamp(error * 1.9 - b.turn * 3, -1, 1),
    throttle = clamp(wanted / boatSpec(w).maxSpeed, 0.1, 0.65);
  return {
    steer: clamp((rudder - b.rudder) * 4, -1, 1),
    throttle: clamp((throttle - b.throttle) * 4, -1, 1),
  };
}
function tick(w, controls, seconds = 0.3) {
  for (let i = 0; i < Math.round(seconds * 60); i++)
    step(
      w,
      i ? { throttle: controls.throttle || 0, steer: controls.steer || 0 } : controls,
      1 / 60,
    );
}
export async function careerVoyage(w, observe = async () => {}) {
  let lastHull = w.boat.hullHealth;
  const start = w.time,
    notes = [],
    check = () => {
      if (w.boat.hullHealth < lastHull) {
        notes.push(
          `Hull contact at ${w.time.toFixed(1)}s (${w.boat.x.toFixed(1)}, ${w.boat.y.toFixed(1)}), ${
            w.logs
              .filter((l) => l.nextHullHit >= w.time - 1)
              .map((l) => l.kind)
              .join('/') || 'shore'
          }, hull ${w.boat.hullHealth}`,
        );
        lastHull = w.boat.hullHealth;
      }
      if (w.boat.sinking || w.emergency || w.time - start > 1800)
        throw new Error(
          'Pilot voyage failed: ' +
            JSON.stringify({ minute: w.day.minute, boat: w.boat, emergency: w.emergency }),
        );
    };
  async function sail(goal, speed = 2) {
    const path = route(w, goal);
    let i = 0;
    for (let attempt = 0; i < 2000 && i < path.length; attempt++) {
      check();
      const p = path[i];
      if (Math.hypot(p.x - w.boat.x, p.y - w.boat.y) < (i === path.length - 1 ? 4 : 7)) {
        i++;
        continue;
      }
      tick(w, helm(w, p, speed));
      if (attempt % 100 === 0) await observe('underway');
    }
    if (i < path.length) throw new Error('Pilot did not reach waypoint');
    tick(w, { neutral: true, centerRudder: true }, 4);
  }
  // This repeatable voyage follows a charted drop. New hidden grounds have their
  // own discovery/scouting regressions and must not silently change its route.
  const p = w.patches
    .filter(
      // Home Coast's former 80% class maps to 77% in the approved 60–85% band.
      (p) => p.charted !== false && p.rate >= 10 && p.quality >= 0.75 && p.y < w.terrain.size - 110,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - w.boat.x, a.y - w.boat.y) - Math.hypot(b.x - w.boat.x, b.y - w.boat.y),
    )[0];
  await sail({ x: p.x, y: p.y });
  notes.push(`Reached ${p.name}`);
  await observe('drop');
  if (
    ['calling', 'approaching', 'docking', 'boarding', 'departing'].includes(
      w.day.inspection?.status,
    )
  ) {
    if (w.day.inspection.status === 'calling') answerPatrol(w);
    for (let i = 0; i < 1200 && w.day.inspection.status !== 'cleared'; i++) {
      check();
      tick(w, { neutral: true, centerRudder: true });
      if (i % 100 === 0) await observe('DFO boarding');
    }
    if (w.day.inspection.status !== 'cleared')
      throw new Error(
        'Patrol failed to come alongside: ' +
          JSON.stringify(w.traffic?.actors.filter((a) => a.kind === 'dfo')),
      );
  }
  if (!deploymentStatus(w, w.diver).available) throw new Error(deploymentStatus(w, w.diver).reason);
  tick(w, { recoverDiver: true });
  for (let i = 0; i < 400 && w.diver.state !== 'surface'; i++) {
    check();
    tick(w, { neutral: true, centerRudder: true });
    if (i % 100 === 0) await observe('diver working');
  }
  if (w.diver.state !== 'surface' || w.diver.bag <= 0)
    throw new Error('No natural catch from this drop');
  notes.push(`Diver surfaced with ${Math.round(w.diver.bag)} lb`);
  await observe('surface');
  const diver = w.diver;
  // A nearby float needs a direct slow pickup. Sailing a full staging circuit
  // leaves the surfaced diver exposed to the newly committed taxi passes.
  if (Math.hypot(diver.x - w.boat.x, diver.y - w.boat.y) > 25)
    await sail({ x: diver.x + 6, y: diver.y + 24 }, 1.4);
  let recovered = false;
  for (let i = 0; i < 800; i++) {
    check();
    if (diver.state === 'ready') {
      recovered = true;
      break;
    }
    const available = recoveryStatus(w, 5, diver).available;
    if (available && !diver.hooking)
      tick(w, { neutral: true, centerRudder: true, recoverDiver: true });
    else if (diver.hooking) tick(w, { neutral: true, centerRudder: true });
    else tick(w, helm(w, { x: diver.x + 5, y: diver.y }, 0.6));
    if (i % 100 === 0) await observe('recovery approach');
  }
  if (!recovered)
    throw new Error(
      'Pilot could not recover diver: ' +
        JSON.stringify({
          boat: w.boat,
          diver: { x: diver.x, y: diver.y, bag: diver.bag },
          status: recoveryStatus(w, 5, diver),
        }),
    );
  notes.push('Diver and catch aboard');
  await observe('recovered');
  await sail({ x: 300, y: w.terrain.size - 15 }, 2.2);
  for (let i = 0; i < 400 && w.day.phase === 'working'; i++) {
    check();
    tick(w, helm(w, { x: 300, y: w.terrain.size + 25 }, 1.8));
  }
  if (w.day.phase !== 'complete') throw new Error('Pilot did not cross the harbour boundary');
  if (!w.day.result.gross) throw new Error('No catch reached offload');
  notes.push(
    `Home with ${Math.round(w.day.result.gross)} lb; ${w.day.result.onTime ? 'on time' : 'late'}; net $${w.day.result.netValue.toFixed(2)}`,
  );
  await observe('offload');
  return {
    notes,
    seconds: w.time - start,
    hull: w.boat.hullHealth,
    crew: w.divers.map((d) => d.condition),
  };
}
