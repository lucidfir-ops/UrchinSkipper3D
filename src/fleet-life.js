import { prepareRosters, crewProfile } from './crew-roster.js';
import { SEASON, seasonStatus, areaCalendarOpen } from './season.js';
import { roll } from './career-data.js';
import { materializeSector, sectorDefinition } from './sectors.js';
import { takeCatch } from './harvest-ground.js';
import { COASTS, coastTier } from './coasts.js';
import { rivalDayPlan } from './rival-plan.js';
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
};
export function prepareFleet(c) {
  prepareRosters(c);
  simulateDailyNpcActivity(c);
  if (c.fleetDay === c.day) {
    for (const [i, r] of (c.todayFleet || []).entries()) {
      r.subAreaId ??= SUB_AREAS[Math.floor(roll(c.seed + c.day, 1601 + i) * SUB_AREAS.length)].id;
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
  c.fleetDay = c.day;
  const rough = c.weatherPlan?.some((p) => p.kind === 'storm' || p.kind === 'squall');
  const teams = c.opponents.filter((r, i) =>
    r.hidden ? rivalDayPlan(c).mystery : roll(c.seed + c.day * 7951, 981 + i) < 0.78,
  );
  c.todayFleet = teams.map((r, i) => {
    let area = rough && r.home === 'far' ? 'middle' : r.home;
    // A few experienced teams venture out; rough weather keeps them on the
    // home coast. The rare hidden team remains governed by its existing rules.
    const venture = roll(c.seed + c.day * 7919, 1951 + i);
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
      const open = COASTS[tier].sectors.filter((id) => areaCalendarOpen(c, id));
      if (open.length) area = open[Math.floor(roll(c.seed + c.day, 1991 + i) * open.length)];
    }
    if (!areaCalendarOpen(c, area)) area = 'near';
    let passage = Math.ceil((sectorDefinition(area).travelMinutes * 10) / r.speed);
    // Reserve at least two working hours and a full return before offload.
    if (passage > 285) {
      area = areaCalendarOpen(c, r.home) ? r.home : 'near';
      passage = Math.ceil((sectorDefinition(area).travelMinutes * 10) / r.speed);
    }
    return {
      ...r,
      area,
      goal: Math.round(
        r.target *
          1.6 *
          (r.crew.reduce((n, id) => n + (crewProfile(c, id)?.harvestRate || 0), 0) / 2) *
          (0.7 + roll(c.seed + c.day, i + 347) * 0.65) *
          (FLEET_LIFE.catchByArea[area] || (coastTier(area) === 1 ? 0.82 : 1)) *
          (rough ? 0.65 : 1),
      ),
      gross: 0,
      qualitySum: 0,
      minute: 300,
      begin: 360 + passage + (i % 3) * 15,
      end: Math.max(600, 1140 - passage - 60),
      catchSpeed: 0.8 + roll(c.seed, 2871 + i) * 0.65,
      patchIndex: Math.floor(roll(c.seed, c.day + i + 417) * 12),
      subAreaId: SUB_AREAS[Math.floor(roll(c.seed + c.day, 1601 + i) * SUB_AREAS.length)].id,
    };
  });
}
export function advanceFleet(w, minute = w.day.minute) {
  if (!w.career) return;
  const c = w.career;
  prepareFleet(c);
  for (const r of c.todayFleet) {
    // In the player's working sector only the physical boats can remove stock.
    // Other sectors retain bounded aggregate work; consumed minutes never replay.
    if (w.day.phase === 'working' && w.day.groundId === r.area && minute === w.day.minute) {
      r.minute = Math.max(r.minute, minute);
      continue;
    }
    const progress = (m) => Math.max(0, Math.min(1, (m - r.begin) / (r.end - r.begin)));
    let requested =
      r.goal *
      Math.max(0, progress(minute) - progress(r.minute)) *
      subAreaYield(c, r.area, r.subAreaId);
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
        const amount = takeCatch(p, clump, requested);
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
export function fleetResults(w, minute) {
  advanceFleet(w, Math.max(1140, minute));
  const results = w.career.todayFleet
    .filter((r) => !r.hidden)
    .map((r) => ({
      id: r.id,
      name: r.name,
      boat: r.boat,
      area: r.area,
      subAreaId: r.subAreaId,
      gross: Math.round(r.gross),
      quality: r.gross ? r.qualitySum / r.gross : 0,
    }));
  w.career.lastFleet = results;
  return results;
}
export function recoverGrounds(c, days) {
  const crossings =
    Math.floor((c.day - 1) / SEASON.days) - Math.floor((c.day - days - 1) / SEASON.days);
  if (crossings <= 0) return;
  const quotaChanges = recoverQuotaAreas(c, days);
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
  c.news.unshift(
    `Season ${seasonStatus(c).season}: surviving grounds recruit; ${depleted} quota beds depleted and ${recovering} recovered.`,
  );
}
export function harbourFleetNews(c) {
  return (c.lastFleet || []).map(
    (r) =>
      `${r.boat}: ${r.gross.toLocaleString()} lb from ${r.area} · ${subAreaLabel(r.subAreaId, r.area)}.`,
  );
}
