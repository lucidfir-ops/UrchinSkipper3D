import { recordMedical } from './medical-history.js';
import { C } from './config.js';
import { depthAt } from './terrain.js';
import { seededRandom } from './math.js';
import { diverSpec } from './crew.js';
import { gear } from './assists.js';
import { godmode } from './godmode.js';

// Fictional game balance, NOT US Navy tables or real-world dive guidance.
// All durations below are accelerated game minutes. See docs/DIVE_EXPOSURE.md.
export const DIVE_EXPOSURE = {
  bands: [
    [6.5, 1200],
    [12, 300],
    [18, 165],
    [22, 110],
    [30, 80],
    [Infinity, 60],
  ],
  surfaceHalfLife: 18,
  strainHalfLife: 2880,
  injuryDays: 5,
};
export const exposureClock = (w) => Math.max(0, w.career.day - 1) * 1440 + w.day.minute;
export const depthBudget = (depth) => DIVE_EXPOSURE.bands.find(([limit]) => depth <= limit)[1];
const limitFor = (d) =>
  d.diveStyle === 'reckless' ? Infinity : d.diveStyle === 'conservative' ? 0.82 : 1.08;
const effective = (h) => h.load + h.strain * 0.3;
const decay = (value, minutes, halfLife) => value * 2 ** (-minutes / halfLife);
function recover(h, minutes) {
  h.load = decay(h.load, minutes, DIVE_EXPOSURE.surfaceHalfLife);
  h.strain = decay(h.strain, minutes, DIVE_EXPOSURE.strainHalfLife);
  h.hazard = decay(h.hazard, minutes, DIVE_EXPOSURE.strainHalfLife);
}
function threshold(c, id, count) {
  let seed = c.seed ^ Math.imul(count + 1, 19337);
  for (const char of id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return 0.7 + seededRandom(seed)() * 1.6;
}
export function newDiveHealth(c, id, clock) {
  return {
    version: 1,
    load: 0,
    strain: 0,
    hazard: 0,
    clock,
    threshold: threshold(c, id, 0),
    pending: false,
    dcsCount: 0,
    lastDiveDay: 0,
    consecutiveDays: 0,
    bottomMinutes: 0,
  };
}
// Pure forecast for menus/eligibility. Reading a hidden HUD cannot alter a diver.
export function diveHealthView(w, d) {
  const stored = w.career?.people[d.crewId]?.diveHealth;
  if (!stored) return null;
  const h = { ...stored };
  recover(h, Math.max(0, exposureClock(w) - h.clock));
  return h;
}
export const nitroxFactor = (w) => (gear(w, 'nitrox') ? 1.6 : 1);
export const diveAirUse = (w, d) => diverSpec(d).airUse / (gear(w, 'nitrox') ? 1.2 : 1);
export function diveForecast(w, d, depth = d.lastDiveDepth ?? depthAt(w, d.x, d.y)) {
  const h = diveHealthView(w, d) || { load: 0, strain: 0 };
  const limit = Number.isFinite(limitFor(d)) ? limitFor(d) : 1.08;
  const rate = d.patch?.rate || d.lastPatchRate || 10;
  const bagSeconds =
    Math.max(C.diver.bagSize / (rate * diverSpec(d).harvestRate) + 12, d.lastFullBagSeconds || 0) +
    C.diver.deploySeconds +
    C.diver.warningSeconds;
  const budget = depthBudget(depth) * nitroxFactor(w);
  const required = ((bagSeconds * C.day.minutesPerSecond) / budget) * 1.09;
  const remaining = Math.max(0, limit - effective(h));
  let restMinutes = 0;
  const rested = { ...h };
  while (effective(rested) + required > limit && restMinutes < 240) {
    recover(rested, 1);
    restMinutes++;
  }
  return {
    depth,
    load: effective(h),
    fraction: Math.min(1, effective(h) / limit),
    bottomMinutes: (remaining * budget) / 1.09,
    bagMinutes: bagSeconds * C.day.minutesPerSecond,
    fullBagReady: !h.pending && remaining >= required,
    restMinutes,
  };
}
export function diveReadiness(w, d, depth) {
  const h = diveHealthView(w, d);
  if (!h) return '';
  if (h.pending) return 'DIVER NEEDS MEDICAL ATTENTION — BRING ABOARD';
  const forecast = diveForecast(w, d, depth);
  return d.diveStyle !== 'reckless' && !forecast.fullBagReady
    ? `DIVE TABLE BREAK — REST ~${forecast.restMinutes} GAME MIN FOR A FULL BAG AT ${forecast.depth.toFixed(0)} m`
    : '';
}
export function recoverCrewExposure(c, clock) {
  for (const record of Object.values(c.people)) {
    const h = record.diveHealth;
    if (!h) continue;
    recover(h, Math.max(0, clock - h.clock));
    h.clock = Math.max(h.clock, clock);
  }
}
// One constant-size record per person; no per-frame history or random rerolls.
export function stepDiveExposure(w, d, dt) {
  const record = w.career?.people[d.crewId];
  if (!record || dt <= 0) return false;
  const clock = exposureClock(w),
    minutes = dt * C.day.minutesPerSecond,
    h = (record.diveHealth ??= newDiveHealth(w.career, d.crewId, clock));
  // Transit and other skipped clock intervals are surface time, not extra bottom work.
  recover(h, Math.max(0, clock - h.clock - minutes));
  h.clock = Math.max(h.clock, clock);
  const underwater = ['searching', 'harvesting', 'surfacing'].includes(d.state);
  if (!underwater || d.condition === 'deceased') {
    recover(h, minutes);
    applyDiveInjury(w, d);
    return false;
  }
  if (h.lastDiveDay !== w.career.day) {
    h.consecutiveDays = h.lastDiveDay === w.career.day - 1 ? h.consecutiveDays + 1 : 1;
    h.lastDiveDay = w.career.day;
    h.bottomMinutes = 0;
  }
  const amount = minutes / (depthBudget(Math.max(0, depthAt(w, d.x, d.y))) * nitroxFactor(w));
  h.bottomMinutes += minutes;
  h.load = Math.min(6, h.load + amount);
  h.strain = Math.min(6, h.strain + amount * (0.25 + Math.max(0, d.fatigue || 0) * 0.1));
  const excess = Math.max(0, effective(h) - 0.95);
  if (!godmode(w))
    h.hazard += minutes * (excess * excess * 0.012 + Math.max(0, h.strain - 0.5) * 0.00025);
  if (!godmode(w) && h.hazard >= h.threshold) h.pending = true;
  return effective(h) >= limitFor(d);
}
export function applyDiveInjury(w, d) {
  if (godmode(w)) return false;
  const record = w.career?.people[d.crewId],
    h = record?.diveHealth;
  if (!h?.pending || !['surface', 'ready'].includes(d.state) || d.condition === 'deceased')
    return false;
  h.pending = false;
  h.dcsCount++;
  h.hazard = 0;
  h.threshold = threshold(w.career, d.crewId, h.dcsCount);
  record.condition = d.condition = 'injured';
  record.injuryCause = 'DCS';
  recordMedical(
    w.career,
    d.crewId,
    'Unfit to dive',
    'Suspected decompression sickness after repeated depth exposure.',
    w.career.day + DIVE_EXPOSURE.injuryDays,
  );
  record.availableDay = Math.max(record.availableDay || 0, w.career.day + DIVE_EXPOSURE.injuryDays);
  d.reason = 'Suspected DCS — bring aboard';
  d.hooking = false;
  d.hook = 0;
  if (w.divers.includes(d)) {
    w.safety ??= { incidents: [], fatalities: 0, injuries: 0 };
    w.safety.injuries++;
    w.safety.incidents.push({
      diverId: d.id,
      minute: w.day.minute,
      outcome: 'injury',
      cause: 'DCS',
    });
    w.emergency ??= { reason: 'Suspected decompression sickness', mandatoryRescue: false };
    w.events.push(
      `${d.name.toUpperCase()} — SUSPECTED DECOMPRESSION SICKNESS. RECOVER CREW; RETURN FOR MEDICAL HELP OR RADIO FOR RESCUE.`,
    );
    w.effects.push({ type: 'warning', diverId: d.id, x: d.x, y: d.y });
  }
  return true;
}
