import { seededRandom } from './math.js';
import { clamp } from './math.js';
import { availableGroundDistance } from './harvest-ground.js';
import { C } from './config.js';
import { diverSpec } from './crew.js';
import dataset from './world-data.json' with { type: 'json' };
import { createDay } from './day.js';
import { depthAt } from './terrain.js';
import { currentAt } from './environment.js';
export { depthAt, bedDepthAt, seaLevel } from './terrain.js';
export { currentAt } from './environment.js';
export function createDiver(id) {
  return {
    condition: 'fit',
    id,
    name: `Diver ${id + 1}`,
    state: 'ready',
    x: 250,
    y: 250,
    bag: 0,
    qualitySum: 0,
    timer: 0,
    air: C.diver.air,
    direction: 0,
    minQuality: 0,
    searchLimit: 70,
    maxBagSeconds: 0,
    bagWorkSeconds: 0,
    diveCount: 0,
    patch: null,
    target: null,
    hook: 0,
    hooking: false,
    recoveryAction: null,
    recoveryPause: '',
    diveTime: 0,
    searchTime: 0,
    harvestTime: 0,
    reason: '',
    bagHandled: false,
  };
}
export const selectedDiver = (w) => w.divers[w.selectedDiverId] || w.divers[0];
export function selectDiver(w, id) {
  if (!w.divers.some((d) => d.id === id)) return false;
  w.selectedDiverId = id;
  return true;
}
export function createWorld({ practice = false, boatId = 'basic' } = {}) {
  const terrain = structuredClone(dataset);
  const random = seededRandom(C.seed);
  const w = {
    time: 0,
    terrain,
    patches: terrain.patches,
    environment: structuredClone(C.environment),
    boat: {
      configuration: boatId,
      hullHealth: 1,
      driveHealth: 1,
      thruster: 0,
      fuelUsed: 0,
      impactCount: 0,
      x: 250,
      y: 250,
      heading: 0,
      vx: C.environment.current.x,
      vy: C.environment.current.y,
      speed: 0,
      throttle: 0,
      rudder: 0,
      turn: 0,
      grounded: false,
      fuel: C.boat.fuelCapacity,
    },
    divers: [createDiver(0), createDiver(1)],
    selectedDiverId: 0,
    day: createDay(practice),
    costs: { fuel: 0, repair: 0, hullRepair: 0, rescue: 0 },
    logs: [],
    rocks: [],
    catch: 0,
    discarded: 0,
    bags: [],
    events: [],
    effects: [],
    message: 'Choose a fishing ground.',
    debris: [],
  };
  Object.defineProperty(w, 'diver', {
    get() {
      return selectedDiver(this);
    },
  });
  for (let i = 0; i < 650; i++) {
    const x = random() * terrain.size,
      y = random() * terrain.size;
    if (depthAt(w, x, y) > 0) w.debris.push({ x, y, phase: random() * 6.28 });
  }
  return w;
}
export function patchDistance(p, x, y) {
  if (!p.outline) return Math.max(0, Math.hypot(x - p.x, y - p.y) - p.radius);
  let inside = false,
    distance = Infinity;
  for (let i = 0, j = p.outline.length - 1; i < p.outline.length; j = i++) {
    const a = p.outline[j],
      b = p.outline[i];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
    distance = Math.min(distance, Math.hypot(x - a.x - dx * t, y - a.y - dy * t));
  }
  return inside ? 0 : distance;
}
export const worthwhile = (p, d) =>
  p &&
  p.rate > 0 &&
  p.remaining > 0.001 &&
  (p.clumps?.some((c) => c.remaining > 0.001 && (c.quality ?? p.quality) >= d.minQuality) ||
    (!p.clumps && p.quality >= d.minQuality));
export function visiblePatch(w, d) {
  let best = null,
    nearest = diverSpec(d).awareness;
  for (const p of w.patches) {
    const distance = p.clumps
      ? Math.max(availableGroundDistance(p, d.x, d.y, d.minQuality), patchDistance(p, d.x, d.y))
      : patchDistance(p, d.x, d.y);
    if (worthwhile(p, d) && distance <= nearest) {
      best = p;
      nearest = distance;
    }
  }
  return best;
}
export function driftSurface(w, object, dt, flow = null) {
  const c = flow || currentAt(w, object.x, object.y),
    x = clamp(object.x + c.x * dt, 0, w.terrain.size),
    y = clamp(object.y + c.y * dt, 0, w.terrain.size);
  // Swept wet path prevents large debug steps or a thin drying reef being skipped.
  const steps = Math.max(1, Math.ceil(Math.hypot(x - object.x, y - object.y) / 0.5)),
    ox = object.x,
    oy = object.y;
  for (let i = 1; i <= steps; i++) {
    const nx = ox + ((x - ox) * i) / steps,
      ny = oy + ((y - oy) * i) / steps;
    if (depthAt(w, nx, ny) <= 0) break;
    object.x = nx;
    object.y = ny;
  }
}
// Decorative foam integrates elapsed time in staggered 10 Hz cohorts. Keep
// swept wet-path checks without doing them for every speck on every physics
// step. Physical logs, divers and floats retain their full simulation cadence.
const debrisFlows = new WeakMap();
export function driftDebris(w, dt) {
  for (let i = 0; i < w.debris.length; i++) {
    const item = w.debris[i];
    let flow = debrisFlows.get(item);
    if (!flow || flow.terrain !== w.terrain || w.time < flow.time) {
      flow = { elapsed: 0, next: w.time, terrain: w.terrain };
      debrisFlows.set(item, flow);
    }
    flow.elapsed += dt;
    flow.time = w.time;
    if (w.time < flow.next) continue;
    const c = currentAt(w, item.x, item.y);
    flow.x = c.x;
    flow.y = c.y;
    driftSurface(w, item, flow.elapsed, flow);
    flow.elapsed = 0;
    flow.next = w.time + 0.08 + (i % 5) * 0.01;
  }
}
export const debrisCurrent = (w, item) => debrisFlows.get(item) || currentAt(w, item.x, item.y);
