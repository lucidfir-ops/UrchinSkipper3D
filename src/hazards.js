import { seededRandom } from './math.js';
import { C } from './config.js';
import { boatSpec } from './boats.js';
import { depthAt, bedDepthAt } from './terrain.js';
import { nearShore } from './shore-hazards.js';
import { currentAt } from './environment.js';
import { collisionDamage } from './propulsion.js';
import { sweptPoses, logContact } from './collision-geometry.js';
import { SpatialBins } from './spatial-bins.js';
export const TIMBER = [
  { kind: 'stick', length: 2.2, radius: 0.1, severity: 0.12 },
  { kind: 'log', length: 6, radius: 0.3, severity: 1 },
  { kind: 'large log', length: 10, radius: 0.65, severity: 2.4 },
];
// A clear-day field is already coastal and substantial; poor visibility adds
// separate bounded cohorts, never an exponential multiplier on existing debris.
export const LOG_FIELD = { base: 72, nightExtra: 5, fogExtra: 4 };
const shoreCache = new WeakMap();
function coastalLogSites(terrain) {
  if (shoreCache.has(terrain)) return shoreCache.get(terrain);
  const sites = [];
  for (let y = 15; y < terrain.size - 15; y += 6)
    for (let x = 15; x < terrain.size - 15; x += 6) {
      const bed = bedDepthAt(terrain, x, y);
      if (bed > 0.5 && bed < 8 && nearShore(terrain, x, y, 55)) sites.push({ x, y });
    }
  shoreCache.set(terrain, sites);
  return sites;
}
function populateLogs(w, logs, prefix, target, seed) {
  const random = seededRandom((w.terrain.provenance?.seed || C.seed) ^ seed),
    sites = coastalLogSites(w.terrain),
    existing = new Set(logs.map((l) => l.id));
  const occupied = new SpatialBins(6);
  for (const log of logs) occupied.add(log);
  let index = 0;
  for (let attempt = 0; index < target && attempt < target * 180; attempt++) {
    const id = `${prefix}-${index}`;
    if (existing.has(id)) {
      index++;
      continue;
    }
    const coastal = sites.length && index % 4 !== 3,
      site = coastal ? sites[Math.floor(random() * sites.length)] : null,
      x = site ? site.x + (random() - 0.5) * 5 : 15 + random() * (w.terrain.size - 30),
      y = site ? site.y + (random() - 0.5) * 5 : 15 + random() * (w.terrain.size - 30),
      type = TIMBER[index % 7 === 0 ? 2 : index % 11 === 0 ? 0 : 1];
    if (
      depthAt(w, x, y) < 0.4 ||
      Math.hypot(x - w.boat.x, y - w.boat.y) < 45 ||
      w.divers.some((d) => d.state !== 'ready' && Math.hypot(x - d.x, y - d.y) < 20) ||
      occupied.some(x, y, 3, (l) => Math.hypot(l.x - x, l.y - y) < 3)
    )
      continue;
    logs.push({
      id,
      x,
      y,
      ...type,
      coastal: !!coastal,
      length: type.length * (0.85 + random() * 0.3),
      heading: random() * Math.PI * 2,
      phase: random() * Math.PI * 2,
    });
    occupied.add(logs[logs.length - 1]);
    index++;
  }
}
export function createLogs(w) {
  const logs = [],
    base = Math.round(LOG_FIELD.base * (w.terrain.size / 600) ** 2);
  populateLogs(w, logs, 'coastal-log', base, 337);
  w.logField = { version: 2, base: logs.length, baseAdded: true };
  return logs;
}
export function addWeatherLogs(w) {
  if (String(w.terrain.version).startsWith('frank-cove-')) return;
  w.logs ??= [];
  if (w.logField?.version !== 2) {
    if (!w.day.groundId) return;
    // Preserve legacy timber in place. New coastal additions join safely on the
    // first resumed simulation step, or when the next sector is entered.
    w.logField = { version: 2, base: Math.round(LOG_FIELD.base * (w.terrain.size / 600) ** 2) };
  }
  const field = w.logField;
  if (!field.baseAdded) {
    populateLogs(w, w.logs, 'coastal-log', field.base, 337);
    field.baseAdded = true;
  }
  for (const [condition, active, multiple, seed] of [
    ['night', w.weather?.night, LOG_FIELD.nightExtra, 0x19d0],
    ['fog', w.weather?.kind === 'fog', LOG_FIELD.fogExtra, 0xf091],
  ]) {
    if (!active || field[condition]) continue;
    populateLogs(w, w.logs, `${condition}-coastal-log`, field.base * multiple, seed);
    field[condition] = true;
  }
}
export const addNightLogs = addWeatherLogs;
export function stepLogs(w, dt, previous = w.boat) {
  addWeatherLogs(w);
  const b = w.boat,
    spec = boatSpec(w),
    poses = sweptPoses(previous, b, spec);
  for (const log of w.logs || []) {
    const flow = currentAt(w, log.x, log.y),
      nx = log.x + (flow.x + (log.vx || 0)) * dt,
      ny = log.y + (flow.y + (log.vy || 0)) * dt;
    if (
      nx >= 0 &&
      ny >= 0 &&
      nx <= w.terrain.size &&
      ny <= w.terrain.size &&
      depthAt(w, nx, ny) > 0.1
    ) {
      log.x = nx;
      log.y = ny;
    }
    log.vx = (log.vx || 0) * Math.exp(-dt * 1.2);
    log.vy = (log.vy || 0) * Math.exp(-dt * 1.2);
    if (
      Math.hypot(log.x - b.x, log.y - b.y) >
      spec.length + log.length + Math.hypot(b.x - previous.x, b.y - previous.y)
    ) {
      log.hullTouch = log.driveTouch = false;
      continue;
    }
    const touch = poses.map((p) => logContact(p, log, false, spec)).find(Boolean),
      driveTouch = poses.some((p) => logContact(p, log, true, spec));
    const vx = b.vx - flow.x,
      vy = b.vy - flow.y,
      speed = Math.hypot(vx, vy),
      severity = log.severity ?? 1;
    if (touch && !log.hullTouch && w.time >= (log.nextHullHit || 0)) {
      const sideSpeed = Math.abs(vx * Math.cos(b.heading) + vy * Math.sin(b.heading)),
        forwardSpeed = Math.abs(vx * Math.sin(b.heading) - vy * Math.cos(b.heading));
      const normalSpeed =
        Math.abs(touch.fore) > spec.length / 2 - 0.8
          ? forwardSpeed
          : Math.abs(touch.side) > spec.width / 2 - 0.5
            ? sideSpeed
            : speed;
      collisionDamage(w, { speed: normalSpeed, severity, cause: log.kind || 'log', hull: true });
      log.nextHullHit = w.time + 2;
      const retain = Math.max(0.5, 1 - severity * 0.13);
      b.vx = flow.x + vx * retain;
      b.vy = flow.y + vy * retain;
      log.vx += (vx * 0.15) / Math.max(0.4, severity);
      log.vy += (vy * 0.15) / Math.max(0.4, severity);
      if (speed > 0.8) w.effects.push({ type: 'ground', x: b.x, y: b.y });
    }
    if (driveTouch && !log.driveTouch && w.time >= (log.nextDriveHit || 0)) {
      collisionDamage(w, {
        speed,
        severity,
        cause: `${log.kind || 'log'} through stern drive`,
        hull: false,
        propulsion: true,
      });
      log.nextDriveHit = w.time + 2;
    }
    log.hullTouch = !!touch;
    log.driveTouch = driveTouch;
    if (touch) {
      // A gentle nudge displaces floating timber without treating it as fixed land.
      const dx = log.x - b.x,
        dy = log.y - b.y,
        d = Math.max(0.1, Math.hypot(dx, dy)),
        push = 0.6 / Math.max(0.4, severity);
      const x = log.x + (dx / d) * dt * push,
        y = log.y + (dy / d) * dt * push;
      if (depthAt(w, x, y) > 0.1) {
        log.x = x;
        log.y = y;
      }
    }
  }
}
