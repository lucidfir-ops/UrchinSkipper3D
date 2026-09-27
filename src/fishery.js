import { C } from './config.js';
import { trafficSettings } from './traffic-settings.js';
import { diverSpec } from './crew.js';
import { seededRandom } from './math.js';
import { inspectionSchedule } from './inspection-schedule.js';

export const FISHERY = { undersizeChance: 0.01, detectionChance: 0.25, finePerUrchin: 1000 };
export const crewAboard = (w) => w.divers.every((d) => d.state === 'ready');
export function prepareInspection(w) {
  if (w.day.inspection?.status === 'scheduled') delete w.day.inspection;
}
// Roll once at the first harvest into this bag, never per frame or on loading.
export function rollBagUndersize(w, d) {
  if (!w.career || d.undersizeCount != null) return d.undersizeCount || 0;
  const record = w.career.people[d.crewId];
  if (!record) return 0;
  record.bagsPicked = (record.bagsPicked || 0) + 1;
  let seed = w.career.seed ^ Math.imul(record.bagsPicked, 7919);
  for (const c of d.crewId) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  d.undersizeCount = Number(
    seededRandom(seed)() < (diverSpec(d).undersizeChance ?? FISHERY.undersizeChance),
  );
  return d.undersizeCount;
}
export function answerPatrol(w) {
  const i = w.day.inspection;
  if (!i || i.status !== 'calling') return { ok: false, reason: 'No patrol waiting.' };
  if (!crewAboard(w)) {
    i.acknowledged = true;
    return { ok: true, reason: 'DFO · We will stay 100 m clear while you recover your divers.' };
  }
  i.status = 'approaching';
  i.invitedAt = w.time;
  const actor = w.traffic?.actors.find((a) => a.id === i.actorId);
  if (actor) Object.assign(actor, { target: 'player', phase: 'approach', nextRoute: 0 });
  w.events.push('DFO · Invitation received. Hold position; coming alongside on starboard.');
  return { ok: true, reason: 'DFO coming alongside. Hold position.' };
}
export function beginInspection(w) {
  const i = w.day.inspection;
  if (!i || !crewAboard(w)) return false;
  i.status = 'boarding';
  i.seconds = (i.minutes || trafficSettings(w).inspectionMinutes) / C.day.minutesPerSecond;
  w.boat.throttle = 0;
  w.events.push('DFO PATROL · Officer aboard. Routine inspection underway.');
  return true;
}
export function finishInspection(w, { dock = false } = {}) {
  const i = w.day.inspection;
  if (!i || ['cleared', 'departing'].includes(i.status)) return 0;
  const random = seededRandom(w.career.seed ^ Math.imul(w.career.day, 63149) ^ 0x4df0);
  let found = 0;
  for (const bag of w.bags) {
    const count = Math.max(0, Math.floor(bag.undersizeCount || 0));
    let detected = 0;
    for (let n = 0; n < count; n++) if (random() < FISHERY.detectionChance) detected++;
    found += detected;
    bag.undersizeCount = count - detected;
  }
  const fine = found * FISHERY.finePerUrchin;
  Object.assign(i, { status: 'cleared', fine, found, dock });
  if (!dock && w.traffic?.actors.some((a) => a.id === i.actorId)) {
    i.status = 'departing';
    i.transitionSeconds = 1.4;
    w.boat.throttle = w.boat.rudder = 0;
  }
  inspectionSchedule(w.career).completed = true;
  w.day.inspectionFine = (w.day.inspectionFine || 0) + fine;
  w.events.push(
    `DFO · ${fine ? `${found} undersized urchin${found === 1 ? '' : 's'} found. $${fine.toLocaleString()} fine to the boat, payable at offload.` : 'Inspection complete. All in order.'}`,
  );
  w.effects.push({ type: 'radio' });
  if (!fine) w.career.records.cleanInspections = (w.career.records.cleanInspections || 0) + 1;
  return dock ? i.minutes || trafficSettings(w).inspectionMinutes : 0;
}
export function inspectAtHarbour(w) {
  if (!w.career || !w.day.inspection || ['cleared', 'departing'].includes(w.day.inspection.status))
    return 0;
  if (w.day.minute < w.day.inspection.minute && w.day.inspection.status === 'scheduled') return 0;
  return finishInspection(w, { dock: true });
}
export function stepFishery(w, dt) {
  if (!w.career || w.day.phase !== 'working') return;
  const i = w.day.inspection;
  if (!i) return;
  if (i.status === 'scheduled' && w.day.minute >= i.minute) i.status = 'calling';
  // An old save can contain a radio call without a physical actor.
  if (
    i.status === 'approaching' &&
    !w.traffic?.actors.some((a) => a.id === i.actorId) &&
    w.time - i.invitedAt >= 2
  )
    beginInspection(w);
  if (i.status === 'boarding') {
    i.seconds -= dt;
    if (i.seconds <= 0) finishInspection(w);
  }
}
export const patrolSkipper = (w) =>
  (w.career.seed + w.career.day) % 2 ? 'Officer Morgan' : 'Officer Singh';
export function patrolBriefing(w) {
  const i = w.day.inspection;
  if (!i) return 'No inspection pending.';
  const opening = `${patrolSkipper(w)}, DFO skipper. “Routine licence and catch inspection. May we come alongside?” `;
  if (i.status === 'calling')
    return (
      opening +
      (crewAboard(w)
        ? 'Your divers are aboard. Invite us over and hold position; we will handle coming alongside.'
        : 'We will stay 100 m clear while you recover your divers. Call us over once both are aboard.')
    );
  if (i.status === 'approaching' || i.status === 'docking')
    return 'DFO coming alongside on starboard. Hold position; we will handle the lines.';
  if (i.status === 'boarding')
    return `Checking documents and catch: ${Math.ceil(i.seconds * C.day.minutesPerSecond)} game minutes left. Divers stay aboard.`;
  if (i.status === 'departing')
    return 'Inspection complete. Casting off — stand by while the patrol clears your boat.';
  return `${patrolSkipper(w)}: ${i.fine ? `“${i.found || 0} undersized urchins found.” $${i.fine.toLocaleString()} fine to the boat, payable at offload.` : '“All in order. Good luck with the rest of the day.”'} ${i.dock ? 'Completed at harbour.' : 'Patrol has cleared the boat.'}`;
}
