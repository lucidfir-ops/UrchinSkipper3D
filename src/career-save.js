import { encodeSnapshot, openEnvelope } from './save-codec.js';
import { troubleshootingSnapshot } from './troubleshooting-log.js';
import { prepareBuyer } from './buyer.js';
import { introActive, initializeIntroWorld, rememberIntroStock } from './career-intro.js';
import { prepareRosters } from './crew-roster.js';
import { normalizeAssists } from './assists.js';
import { validateSnapshot } from './save-validation.js';
import { createRocks } from './rock-collision.js';
import { prepareFleet, recoverGrounds, advanceFleet } from './fleet-life.js';
import { weatherPlan, updateWeather } from './weather.js';
import { createWorld } from './world.js';
import { enterSector } from './sectors.js';
import { createCareer, advanceCareer, syncVessel } from './career-state.js';
import { assignCrew, rememberCrewOrders } from './crew.js';
import { ECONOMY } from './career-data.js';
import { normalizeQuotaAreas } from './quota-areas.js';
import { normalizeCoastAccess } from './coasts.js';
import { captureStock, restoreStock } from './stock-ledger.js';
export { captureStock, restoreStock } from './stock-ledger.js';
export const SAVE_KEY = 'urchin3d-career-v1';
const clone = (v) => structuredClone(v);
export function careerWorld(c = createCareer()) {
  normalizeCoastAccess(c);
  prepareRosters(c);
  normalizeAssists(c);
  prepareBuyer(c);
  c.preferences ??= { arrivals: {}, subAreas: {} };
  c.preferences.arrivals ??= {};
  c.preferences.subAreas ??= {};
  normalizeQuotaAreas(c);
  if (c.groundVersion >= 2 && c.groundVersion < 7) c.groundVersion = 7;
  if (!c.balanceVersion) {
    for (const [id, v] of Object.entries(c.fleet))
      if (v.equipment.includes('tank'))
        v.auxTankLitres =
          ({ basic: 240, thruster: 360, sterndrive: 220, outboard: 180, jet: 320, twinjet: 620 }[
            id
          ] || 240) * 0.5;
    c.balanceVersion = 2;
  }
  const w = createWorld({ boatId: c.activeBoat });
  w.career = c;
  c.weatherPlan ??= weatherPlan(c);
  prepareFleet(c);
  updateWeather(w);
  const v = c.fleet[c.activeBoat];
  Object.assign(w.boat, {
    hullHealth: v.hullHealth,
    driveHealth: v.driveHealth,
    fuel: v.fuel,
    sinking: v.lost,
    vx: 0,
    vy: 0,
  });
  assignCrew(w);
  w.day.minute = 300;
  w.day.earliestDeparture = 300;
  if (introActive(w)) initializeIntroWorld(w);
  return w;
}
export function nextCareerDay(w, { dockWork = false } = {}) {
  if (!w.career || !['planning', 'complete'].includes(w.day.phase)) return null;
  rememberCrewOrders(w);
  const offload = w.day.result?.offloadMinute || w.day.minute;
  let days = Math.max(1, Math.floor(offload / 1440)),
    earliest = w.day.result && !w.day.result.onTime ? 540 : 300;
  if (earliest >= 1440) {
    days++;
    earliest -= 1440;
  }
  earliest = Math.max(300, earliest);
  if (w.day.phase === 'complete') advanceFleet(w, days * 1440 + earliest);
  captureStock(w);
  syncVessel(w);
  const c = clone(w.career);
  if (!w.day.result) c.cash = Math.round((c.cash - c.debt * ECONOMY.interest) * 100) / 100;
  advanceCareer(c, days);
  if (c.groundVersion === 3) c.groundVersion = 4;
  if (w.day.phase === 'planning' && !dockWork)
    for (const person of Object.values(c.people))
      person.fatigue = Math.max(0, person.fatigue - ECONOMY.restDayRecovery);
  recoverGrounds(c, days);
  if (dockWork) c.cash += ECONOMY.dockWage;
  const next = careerWorld(c);
  next.day.earliestDeparture = earliest;
  next.day.minute = earliest;
  if (w.day.result && !w.day.result.onTime) {
    next.day.morningOffload = true;
    next.career.news.unshift(
      'Missed evening offload: catch landed at 06:00. Crew and boat ready at 09:00; today is a shorter fishing day.',
    );
  }
  updateWeather(next);
  return next;
}
export function snapshot(w, copy = true) {
  const take = copy ? clone : (value) => value;
  if (!w.career) return null;
  rememberIntroStock(w);
  rememberCrewOrders(w);
  captureStock(w);
  syncVessel(w);
  const divers = w.divers.map((d) => {
    const { patch, clump, target, ...state } = d;
    return { ...take(state), patchId: patch?.id, clumpId: clump?.id, targetId: target?.id };
  });
  return {
    schema: 1,
    career: take(w.career),
    time: w.time,
    day: take(w.day),
    boat: take(w.boat),
    divers,
    selectedDiverId: w.selectedDiverId,
    catch: w.catch,
    bags: take(w.bags),
    discarded: w.discarded,
    costs: take(w.costs),
    logs: take(w.logs),
    logField: take(w.logField),
    rockContacts: (w.rocks || []).map(
      ({ id, grace, hullTouch, driveTouch, nextHullHit, nextDriveHit }) => ({
        id,
        grace,
        hullTouch,
        driveTouch,
        nextHullHit,
        nextDriveHit,
      }),
    ),
    traffic: take(w.traffic),
    wildlife: take(w.wildlife),
    safety: take(w.safety),
    emergency: take(w.emergency),
  };
}
export function restore(data) {
  validateSnapshot(data);
  const career = clone(data.career);
  // The boat actually present in the saved trip is authoritative. Older saves
  // could retain a different harbour selection and revert on the next day.
  if (career.fleet[data.boat.configuration]) career.activeBoat = data.boat.configuration;
  const w = careerWorld(career);
  w.day = clone(data.day);
  if (
    w.day.phase === 'planning' &&
    !w.career.planningVersion &&
    w.day.earliestDeparture > 480 &&
    w.career.history?.[0]?.onTime === false
  ) {
    w.day.minute = w.day.earliestDeparture = 540;
    w.day.morningOffload = true;
  }
  w.career.planningVersion = 2;
  w.time = data.time;
  if (w.day.groundId) {
    enterSector(w, w.day.groundId);
    restoreStock(w, w.day.groundId);
  }
  for (const key of [
    'boat',
    'selectedDiverId',
    'catch',
    'bags',
    'discarded',
    'costs',
    'logs',
    'logField',
    'traffic',
    'wildlife',
    'safety',
    'emergency',
  ])
    if (data[key] !== undefined) w[key] = clone(data[key]);
  if (data.logField === undefined) delete w.logField;
  if (w.day.groundId) {
    w.rocks = createRocks(w);
    for (const rock of w.rocks) {
      const saved = data.rockContacts?.find((r) => r.id === rock.id);
      if (saved)
        for (const key of ['grace', 'hullTouch', 'driveTouch', 'nextHullHit', 'nextDriveHit'])
          if (saved[key] !== undefined) rock[key] = saved[key];
    }
  }
  w.divers = data.divers.map((record) => {
    const { patchId, clumpId, targetId, ...d } = clone(record),
      patch = w.patches.find((p) => p.id === patchId);
    return {
      crewSeed: w.career.seed,
      diveStyle: w.divers.find((live) => live.id === d.id)?.diveStyle || 'tables',
      ...d,
      patch: patch || null,
      clump: patch?.clumps?.find((c) => c.id === clumpId) || null,
      target: w.patches.find((p) => p.id === targetId) || null,
    };
  });
  delete w.career.catchCare;
  delete w.day.sortingSeconds;
  // Pre-October 5 saves could hold a paused boundary decision; the return is now an explicit action.
  delete w.day.returnPending;
  delete w.day.returnDismissed;
  for (const d of w.divers) {
    delete d.careSeconds;
    delete d.undersize;
  }
  for (const b of w.bags) delete b.undersize;
  if (w.day.inspection?.status === 'approaching' && w.day.inspection.invitedAt === undefined)
    w.day.inspection.status = 'calling';
  w.events = [];
  w.effects = [];
  updateWeather(w);
  return w;
}
export function encode(w, diagnostics = false) {
  const data = snapshot(w);
  if (diagnostics) data.troubleshooting = troubleshootingSnapshot();
  return encodeSnapshot(data);
}
export function readSnapshot(text) {
  const data = JSON.parse(openEnvelope(text).payload);
  validateSnapshot(data);
  return data;
}
export function decode(text) {
  return restore(readSnapshot(text));
}
export function loadCareer(storage) {
  for (const key of [SAVE_KEY, SAVE_KEY + '-backup'])
    try {
      const raw = storage.getItem(key);
      if (raw) return { world: decode(raw), recovered: key !== SAVE_KEY };
    } catch {
      /* Try the protected backup after an invalid primary save. */
    }
  return null;
}
const verifiedSaves = new WeakMap();
export function saveCareer(w, storage) {
  if (!w.career || w.career.sandbox) return { ok: true };
  try {
    const data = snapshot(w);
    validateSnapshot(data);
    return commitCareer(w, storage, encodeSnapshot(data));
  } catch (error) {
    return { ok: false, reason: 'Save unavailable: ' + error.message };
  }
}
const QUOTA_HINT =
  'Browser storage is full. Delete old saves in Load Game (or export a backup) to keep saving.';
const isQuota = (error) =>
  error?.name === 'QuotaExceededError' ||
  error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
  error?.code === 22 ||
  error?.code === 1014;
function storageUsed(storage) {
  let used = 0;
  for (let i = 0; i < (storage.length || 0); i++) {
    const key = storage.key(i);
    used += (key.length + (storage.getItem(key)?.length || 0)) * 2;
  }
  return used;
}
export function commitCareer(w, storage, next) {
  if (!w.career || w.career.sandbox) return { ok: true };
  try {
    const previous = storage.getItem(SAVE_KEY);
    if (previous && previous !== next) {
      try {
        if (verifiedSaves.get(storage) !== previous) readSnapshot(previous);
        storage.setItem(SAVE_KEY + '-backup', previous);
      } catch {
        /* Keep the previous valid backup (also when the backup cannot fit). */
      }
    }
    try {
      storage.setItem(SAVE_KEY, next);
    } catch (error) {
      if (!isQuota(error)) throw error;
      // The live save outranks its own rolling backup: drop the backup and
      // retry once rather than silently keeping an older live save.
      storage.removeItem(SAVE_KEY + '-backup');
      storage.setItem(SAVE_KEY, next);
    }
    verifiedSaves.set(storage, next);
    if (w.day.phase === 'planning' && !w.career.starterPending && w.career.day > 0) {
      const dayKey = `${SAVE_KEY}-day-${w.career.seed}-${w.career.day}`;
      if (!storage.getItem(dayKey)) {
        // Reserve room for both live saves to grow. Never prune a player's
        // unique restore points to make room for a new automatic one.
        if (storageUsed(storage) + next.length * 4 > 4 * 1024 * 1024)
          return {
            ok: true,
            reason:
              'Current game saved. Storage is nearly full, so no new day restore point was kept. Delete old saves in Load Game.',
          };
        try {
          storage.setItem(dayKey, next);
        } catch {
          return {
            ok: true,
            reason:
              'Current game saved. Storage is full, so no new day restore point was kept. Delete old saves in Load Game.',
          };
        }
      }
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      storageFull: isQuota(error),
      reason: isQuota(error) ? 'Save failed. ' + QUOTA_HINT : 'Save unavailable: ' + error.message,
    };
  }
}
const isRestorePoint = (key) =>
  key?.startsWith(SAVE_KEY + '-archive-') || key?.startsWith(SAVE_KEY + '-day-');
function envelopeChecksum(text) {
  try {
    return JSON.parse(text).checksum;
  } catch {
    return null;
  }
}
// Archive the live career before it is replaced. An identical restore point
// already in storage is reused instead of storing another full copy.
export function archiveCareer(storage) {
  const previous = storage.getItem(SAVE_KEY);
  if (!previous) return null;
  readSnapshot(previous);
  const sum = envelopeChecksum(previous);
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (isRestorePoint(key) && envelopeChecksum(storage.getItem(key)) === sum) return key;
  }
  let key = SAVE_KEY + '-archive-' + Date.now();
  while (storage.getItem(key)) key += '-copy';
  try {
    storage.setItem(key, previous);
  } catch (error) {
    if (isQuota(error)) throw new Error(QUOTA_HINT, { cause: error });
    throw error;
  }
  return key;
}
// Rewrite older uncompressed (v1) saves in the compact v2 format. Each entry is
// verified first and only replaced by a re-encoding of the identical payload.
export function compactSaves(storage) {
  let freed = 0;
  const keys = [];
  for (let i = 0; i < (storage.length || 0); i++) {
    const key = storage.key(i);
    if (key?.startsWith(SAVE_KEY)) keys.push(key);
  }
  for (const key of keys)
    try {
      const raw = storage.getItem(key);
      if (!raw || JSON.parse(raw).version !== 1) continue;
      const data = readSnapshot(raw),
        compact = encodeSnapshot(data);
      if (compact.length >= raw.length) continue;
      storage.setItem(key, compact);
      if (key === SAVE_KEY) verifiedSaves.set(storage, compact);
      freed += (raw.length - compact.length) * 2;
    } catch {
      /* Leave unreadable or damaged entries untouched for manual recovery. */
    }
  return freed;
}
export function deleteRestorePoint(storage, key) {
  if (!isRestorePoint(key)) return false;
  storage.removeItem(key);
  return true;
}
export function storageReport(storage) {
  let game = 0,
    total = 0;
  for (let i = 0; i < (storage.length || 0); i++) {
    const key = storage.key(i),
      size = (key.length + (storage.getItem(key)?.length || 0)) * 2;
    total += size;
    if (key.startsWith('urchin3d')) game += size;
  }
  return { game, total };
}
export function careerArchives(storage, includeDays = false) {
  const list = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (
      !key.startsWith(SAVE_KEY + '-archive-') &&
      !(includeDays && key.startsWith(SAVE_KEY + '-day-'))
    )
      continue;
    try {
      const raw = storage.getItem(key),
        data = readSnapshot(raw),
        stamp = Number(key.match(/-archive-(\d+)/)?.[1]);
      list.push({
        key,
        day: data.career.day,
        cash: data.career.cash,
        boat: data.boat.configuration,
        kind: key.startsWith(SAVE_KEY + '-day-') ? 'Start of day' : 'Saved career',
        seed: data.career.seed,
        phase: data.day.phase,
        savedAt: Number.isFinite(stamp) ? stamp : null,
        size: (key.length + raw.length) * 2,
      });
    } catch {
      /* Retain unreadable archives for manual recovery. */
    }
  }
  return list.sort((a, b) => b.seed - a.seed || b.day - a.day || b.key.localeCompare(a.key));
}
