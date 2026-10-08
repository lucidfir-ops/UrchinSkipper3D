import { prepareRosters, crewProfile } from './crew-roster.js';
import { SEASON, areaCalendarOpen } from './season.js';
import { roll } from './career-data.js';
import { materializeSector, sectorDefinition } from './sectors.js';
import { takeRivalCatch } from './harvest-ground.js';
import { COASTS, coastTier } from './coasts.js';
import { rivalDayPlan } from './rival-plan.js';
import { careerDayAt } from './career-calendar.js';
import { weatherPlanForDay } from './weather.js';
import { captureStock, restoreStock } from './stock-ledger.js';
import {
  recoverQuotaAreas,
  recordFishingPressure,
  simulateDailyNpcActivity,
  SUB_AREAS,
  subAreaLabel,
  subAreaYield,
} from './quota-areas.js';

export const FLEET_LIFE = {
  rareRadioChance: 1 / 750,
  // Aggregate landings increase Home Coast pressure independently of encounters.
  catchByArea: Object.freeze({ near: 0.85, middle: 1.05, far: 1.2 }),
  // Scales each rival team's daily catch goal (was a fixed 1.6). October 6 balance
  // pass: at 1.6 a rival boat landed 2,000–7,000 lb a day, two to three times a
  // competent player, and the fleet stripped every marked bed within days.
  goalScale: 0.6,
};
export function prepareFleet(c, day = Math.max(c.day, c.fleetDay ?? c.day)) {
  const calendar = day === c.day ? c : { ...c, day };
  prepareRosters(c);
  simulateDailyNpcActivity(c, day);
  c.groundRecoverySeason ??= c.quotaAreas.season;
  if (c.fleetDay === day) {
    for (const [i, r] of (c.todayFleet || []).entries()) {
      r.day ??= day;
      r.subAreaId ??= SUB_AREAS[Math.floor(roll(c.seed + day, 1601 + i) * SUB_AREAS.length)].id;
      if (!r.art) {
        const team = c.opponents.find((t) => !t.hidden && t.home === (r.home || r.area));
        if (team)
          Object.assign(r, {
            teamId: team.id,
            art: team.art,
            speed: team.speed,
            turnRate: team.turnRate,
            crew: [...team.crew],
            hidden: false,
          });
      }
    }
    return;
  }
  c.fleetDay = day;
  const rough = weatherPlanForDay(c, day)?.some((p) => p.kind === 'storm' || p.kind === 'squall');
  const teams = c.opponents.filter((r, i) =>
    r.hidden ? rivalDayPlan(c, day).mystery : roll(c.seed + day * 7951, 981 + i) < 0.78,
  );
  c.todayFleet = teams.map((r, i) => {
    let area = rough && r.home === 'far' ? 'middle' : r.home;
    // A few experienced teams venture out; rough weather keeps them on the
    // home coast. The rare hidden team remains governed by its existing rules.
    const venture = roll(c.seed + day * 7919, 1951 + i);
    const tier =
      !rough && !r.hidden && i > 0
        ? venture < 0.12
          ? 4
          : venture < 0.25
            ? 3
            : venture < 0.45
              ? 2
              : venture < 0.7
                ? 1
                : 0
        : 0;
    if (tier) {
      const open = COASTS[tier].sectors.filter((id) => areaCalendarOpen(calendar, id));
      if (open.length) area = open[Math.floor(roll(c.seed + day, 1991 + i) * open.length)];
    }
    if (!areaCalendarOpen(calendar, area)) area = 'near';
    let passage = Math.ceil((sectorDefinition(area).travelMinutes * 10) / r.speed);
    // Reserve at least two working hours and a full return before offload.
    if (passage > 285) {
      area = areaCalendarOpen(calendar, r.home) ? r.home : 'near';
      passage = Math.ceil((sectorDefinition(area).travelMinutes * 10) / r.speed);
    }
    return {
      ...r,
      day,
      area,
      goal: Math.round(
        r.target *
          FLEET_LIFE.goalScale *
          (r.crew.reduce((n, id) => n + (crewProfile(c, id)?.harvestRate || 0), 0) / 2) *
          (0.7 + roll(c.seed + day, i + 347) * 0.65) *
          (FLEET_LIFE.catchByArea[area] || (coastTier(area) === 1 ? 0.82 : 1)) *
          (rough ? 0.65 : 1),
      ),
      gross: 0,
      qualitySum: 0,
      minute: 300,
      begin: 360 + passage + (i % 3) * 15,
      end: Math.max(600, 1140 - passage - 60),
      catchSpeed: 0.8 + roll(c.seed, 2871 + i) * 0.65,
      patchIndex: Math.floor(roll(c.seed, day + i + 417) * 12),
      subAreaId: SUB_AREAS[Math.floor(roll(c.seed + day, 1601 + i) * SUB_AREAS.length)].id,
    };
  });
}
export function advanceFleet(w, minute = w.day.minute) {
  if (!w.career) return;
  const c = w.career;
  // Legacy actors have no day tag. Attach it before replacing yesterday's plan.
  for (const actor of w.traffic?.actors || [])
    if (actor.kind === 'rival') actor.fleetDay ??= c.fleetDay ?? c.day;
  prepareFleet(c);
  const targetDay = careerDayAt(w, minute);
  while (c.fleetDay < targetDay) {
    advanceFleetDay(w, 1440);
    rememberFleetResults(c, 1440);
    const day = c.fleetDay + 1,
      season = Math.floor((day - 1) / SEASON.days) + 1;
    if (season > c.groundRecoverySeason) {
      captureStock(w);
      recoverGrounds(c, 1, day);
      for (const [id, terrain] of Object.entries(w.sectors || [])) restoreStock(w, id, terrain);
    }
    prepareFleet(c, day);
  }
  if (c.fleetDay === targetDay) advanceFleetDay(w, minute % 1440);
}
function advanceFleetDay(w, minute) {
  const c = w.career,
    physicalThrough = (c.day - c.fleetDay) * 1440 + w.day.minute;
  for (const r of c.todayFleet) {
    // In the player's working sector only the physical boats can remove stock.
    // During an abstract passage every sector is off-map. Consume occupied time
    // before accounting the later passage interval, so it cannot replay.
    if (w.day.phase === 'working' && w.day.groundId === r.area)
      r.minute = Math.max(r.minute, Math.max(0, Math.min(minute, physicalThrough)));
    const progress = (m) => Math.max(0, Math.min(1, (m - r.begin) / (r.end - r.begin)));
    const yieldFactor = subAreaYield(c, r.area, r.subAreaId);
    let requested = Math.min(
      Math.max(0, r.goal * yieldFactor - r.gross),
      r.goal * Math.max(0, progress(minute) - progress(r.minute)) * yieldFactor,
    );
    r.minute = Math.max(r.minute, minute);
    if (requested <= 0) continue;
    const terrain = materializeSector(w, r.area),
      patches = terrain.patches;
    const ordered = Array.from(
      { length: patches.length },
      (_, n) => patches[(r.patchIndex + n) % patches.length],
    ).sort((a, b) => Number(a.charted === false) - Number(b.charted === false));
    for (const p of ordered) {
      if (requested <= 0.001) break;
      if (p.quality < 0.6) continue;
      for (const clump of p.clumps || []) {
        const amount = takeRivalCatch(p, clump, requested);
        requested -= amount;
        r.gross += amount;
        r.qualitySum += amount * p.quality;
        recordFishingPressure(c, r.area, r.subAreaId, 'npc', amount);
        if (requested < 0.001) break;
      }
    }
    if (
      !r.hidden &&
      !r.called &&
      r.gross >= 650 &&
      w.day.phase === 'working' &&
      w.day.groundId === r.area
    ) {
      r.called = true;
      w.events.push(
        `RADIO · ${r.boat}: ${r.id === 'tom' ? 'A bit of sign between the islands. Watch that turn of tide.' : r.id === 'lena' ? 'A steady pick along the sheltered shore. We will be home early.' : 'Some good product out here. Keeping an eye on the weather.'}`,
      );
      w.effects.push({ type: 'radio' });
    }
  }
}
function rememberFleetResults(c, minute) {
  const results = c.todayFleet
    .filter((r) => !r.hidden)
    .map((r) => ({
      id: r.id,
      name: r.name,
      boat: r.boat,
      area: r.area,
      subAreaId: r.subAreaId,
      day: c.fleetDay,
      minute,
      gross: Math.round(r.gross),
      quality: r.gross ? r.qualitySum / r.gross : 0,
    }));
  c.lastFleet = results;
  c.lastFleetDay = c.fleetDay;
  c.lastFleetMinute = minute;
  return results;
}
export function fleetResults(w, minute) {
  // These are the latest actual day's catches through arrival, never a
  // projection of unworked hours or a disguised sum of several working days.
  advanceFleet(w, minute);
  return rememberFleetResults(w.career, minute % 1440);
}
export function recoverGrounds(c, days, day = c.day) {
  const season = Math.floor((day - 1) / SEASON.days) + 1,
    previous = c.groundRecoverySeason ?? Math.floor((day - days - 1) / SEASON.days) + 1,
    crossings = season - previous;
  if (crossings <= 0) return;
  const quotaChanges = recoverQuotaAreas(c, days, day);
  for (const ledger of Object.values(c.stock))
    for (const p of ledger) {
      const clumps = p.clumps || [];
      const carrying = clumps.reduce((sum, clump) => sum + (clump.initialStock || 0), 0);
      p.kelpCover = carrying ? Math.max(0, 1 - p.remaining / carrying) : 0;
      for (const clump of clumps) {
        if (!Number.isFinite(clump.initialStock)) continue;
        for (let season = 0; season < crossings; season++)
          clump.remaining = Math.min(
            clump.initialStock,
            clump.remaining * SEASON.survivorGrowth + clump.initialStock * SEASON.recolonization,
          );
      }
      if (clumps.length && clumps.every((clump) => Number.isFinite(clump.initialStock)))
        p.remaining = clumps.reduce((sum, clump) => sum + clump.remaining, 0);
    }
  const depleted = quotaChanges.filter((change) => change.health < change.before).length,
    recovering = quotaChanges.filter((change) => change.health > change.before).length;
  c.groundRecoverySeason = season;
  c.news.unshift(
    `Season ${season}: surviving grounds recruit; ${depleted} quota beds depleted and ${recovering} recovered.`,
  );
}
export function harbourFleetNews(c) {
  return (c.lastFleet || []).map(
    (r) =>
      `${r.boat}${Number.isInteger(r.day) ? ` · day ${r.day}` : ''}: ${r.gross.toLocaleString()} lb caught from ${r.area} · ${subAreaLabel(r.subAreaId, r.area)}.`,
  );
}
