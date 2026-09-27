import { C } from './config.js';
import { ECONOMY } from './career-data.js';
import { crewProfile, crewEmployer } from './crew-roster.js';
import { crewSkills, SPECIALTY_NAMES } from './crew-skills.js';
export { SPECIALTY_NAMES } from './crew-skills.js';
export const CREW_LEVELS = [
  0,
  3000,
  9000,
  20000,
  40000,
  ...Array.from({ length: 15 }, (_, i) => 65000 + i * 30000 + i * i * 2500),
];
export function crewProgress(experience = 0, crewId, seed) {
  const level = Math.max(
    0,
    CREW_LEVELS.findLastIndex((xp) => experience >= xp),
  );
  const { major, minors } = crewSkills(crewId, seed);
  const skills = [major, ...minors];
  const bonus = (name, rate) =>
    level * rate * (name === major ? 1 : minors.includes(name) ? 0.3 : 0);
  return {
    major: SPECIALTY_NAMES[major],
    minors: minors.map((s) => SPECIALTY_NAMES[s]),
    skillIds: skills,
    specialties: skills.map((s) => SPECIALTY_NAMES[s]),
    level: level + 1,
    experience,
    next: CREW_LEVELS[level + 1] ?? null,
    rateBonus: bonus('picking', 0.08),
    airSaving: Math.min(0.65, bonus('air', 0.045)),
    awarenessBonus: bonus('awareness', 1.25),
    swimBonus: bonus('swimming', 0.06),
    currentBonus: bonus('current', 0.18),
    tankBonus: bonus('tank', 0.07),
    fatigueSaving: Math.min(0.65, bonus('fatigue', 0.065)),
  };
}
export function diverSpec(d) {
  const profile = crewProfile(d.crewSeed === undefined ? null : { seed: d.crewSeed }, d.crewId);
  if (!profile) return { ...C.diver, harvestRate: 1 };
  const tired = Math.max(0, (d.fatigue || 0) - 0.08),
    progress = crewProgress(d.experience || 0, d.crewId, d.crewSeed);
  return {
    ...C.diver,
    ...profile,
    searchSpeed: profile.searchSpeed * (1 - tired * 0.5) * (1 + progress.swimBonus),
    harvestRate:
      ((profile.harvestRate * 30) / ECONOMY.bagSeconds) *
      (1 - tired * 0.55) *
      (1 + progress.rateBonus),
    airUse: profile.airUse * 0.78 * (1 + tired * 0.4) * (1 - progress.airSaving),
    holdCurrentKnots: Math.max(1.3, profile.holdCurrentKnots + progress.currentBonus - tired * 1.1),
    awareness: profile.awareness + progress.awarenessBonus,
    tankAir: C.diver.air * (1 + progress.tankBonus),
    fatigueSaving: progress.fatigueSaving,
    undersizeChance: profile.undersizeChance ?? 0.01,
    autoChart: progress.skillIds.includes('awareness'),
  };
}
export function assignCrew(w) {
  if (!w.career) return;
  w.divers.forEach((d, i) => {
    const id = w.career.crew[i],
      person = crewProfile(w.career, id),
      record = w.career.people[id],
      orders =
        record?.orders ||
        (d.crewId === id && d.ordersSet
          ? {
              direction: d.direction,
              minQuality: d.minQuality,
              searchLimit: d.searchLimit,
              maxBagSeconds: d.maxBagSeconds || 0,
            }
          : null);
    if (d.crewId !== id) {
      delete d.speech;
      delete d.speechReports;
      delete d.nextBanterAt;
    }
    Object.assign(d, {
      direction: orders?.direction ?? 0,
      minQuality: orders?.minQuality ?? 0,
      searchLimit: orders?.searchLimit ?? (person?.rank > 0 ? 15 : 70),
      maxBagSeconds: orders?.maxBagSeconds ?? 0,
      ordersSet: !!orders,
      crewId: id,
      crewSeed: w.career.seed,
      diveStyle:
        person?.diveStyle ||
        (id === 'ada' || id === 'nell' ? 'conservative' : id === 'roy' ? 'reckless' : 'tables'),
      name: person?.name || 'Empty berth',
      condition:
        !person || crewEmployer(w.career, id)
          ? 'unavailable'
          : record?.condition && record.condition !== 'fit'
            ? record.condition
            : record?.availableDay > w.career.day
              ? 'unavailable'
              : 'fit',
      fatigue: record?.fatigue || 0,
      experience: record?.experience || 0,
      workedSeconds: 0,
    });
  });
}
export function rememberCrewOrders(w) {
  if (!w.career) return;
  for (const d of w.divers)
    if (d.ordersSet && w.career.people[d.crewId])
      w.career.people[d.crewId].orders = {
        direction: d.direction,
        minQuality: d.minQuality,
        searchLimit: d.searchLimit,
        maxBagSeconds: d.maxBagSeconds || 0,
      };
}
export function workCrew(w, d, dt) {
  if (!w.career || !d.crewId) return;
  d.workedSeconds = (d.workedSeconds || 0) + dt;
  d.fatigue = Math.min(
    1,
    (d.fatigue || 0) +
      dt *
        ECONOMY.workFatigue *
        (w.weather?.night ? 2 : 1) *
        (d.workedSeconds * C.day.minutesPerSecond < 240
          ? 0.85
          : d.workedSeconds * C.day.minutesPerSecond < 480
            ? 1
            : 1.5) *
        (1 - (diverSpec(d).fatigueSaving || 0)),
  );
}
