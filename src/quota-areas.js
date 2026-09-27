import { roll } from './career-data.js';
import { areaCalendarOpen, SEASON, seasonStatus } from './season.js';
import { PHYSICAL_AREAS, coastTier } from './coasts.js';

export const QUOTA_AREA_IDS = Object.freeze(PHYSICAL_AREAS.map((area) => area.id));
export const SUB_AREAS = Object.freeze([
  Object.freeze({ id: 'a', label: 'Bed A' }),
  Object.freeze({ id: 'b', label: 'Bed B' }),
  Object.freeze({ id: 'c', label: 'Bed C' }),
]);

// Compatibility accounting slots inside physical maps. The old bed selector is
// retired; saved trips retain their slot and its historical pressure/profile.
// Physical places and their coast hierarchy are defined in coasts.js.
export const AREA_SUB_AREAS = Object.freeze({
  ...Object.fromEntries(
    PHYSICAL_AREAS.filter((area) => area.tier > 0).map((area) => [
      area.id,
      SUB_AREAS.map((bed, index) => ({
        ...bed,
        label: area.name,
        difficulty: area.tier === 1 ? 'Hard' : 'Extremely hard',
        yield: 1 + area.tier * 0.18 + index * 0.02,
        price: 1 + area.tier * 0.32 + index * 0.02,
        qualityBonus: area.tier * 0.04,
        hazards:
          area.tier === 1
            ? 'Strong variable current · gusts · extra uncharted rocks'
            : 'Extreme variable current · open swell · dense uncharted rocks',
      })),
    ]),
  ),
  near: Object.freeze([
    Object.freeze({
      id: 'a',
      label: 'Harbour Flats',
      difficulty: 'Sheltered',
      yield: 0.94,
      price: 1,
      qualityBonus: 0,
      hazards: 'Light current · lee wind · charted shallows',
    }),
    Object.freeze({
      id: 'b',
      label: 'Kelp Bowl',
      difficulty: 'Working',
      yield: 1,
      price: 1.04,
      qualityBonus: 0.01,
      hazards: 'Variable current · kelp drift · scattered rocks',
    }),
    Object.freeze({
      id: 'c',
      label: 'North Shelf',
      difficulty: 'Demanding',
      yield: 1.08,
      price: 1.08,
      qualityBonus: 0.02,
      hazards: 'Cross-current · gust exposure · uncharted rock crowns',
    }),
  ]),
  middle: Object.freeze([
    Object.freeze({
      id: 'a',
      label: 'Lee Channel',
      difficulty: 'Demanding',
      yield: 1.05,
      price: 1.12,
      qualityBonus: 0.02,
      hazards: 'Channel current · island wind shadow · blind rocks',
    }),
    Object.freeze({
      id: 'b',
      label: 'Tidal Saddle',
      difficulty: 'Hard',
      yield: 1.15,
      price: 1.2,
      qualityBonus: 0.04,
      hazards: 'Strong tide · crosswind · uncharted saddle rocks',
    }),
    Object.freeze({
      id: 'c',
      label: 'Split Narrows',
      difficulty: 'Severe',
      yield: 1.25,
      price: 1.3,
      qualityBonus: 0.06,
      hazards: 'Accelerating current · gust funnel · blind reef turns',
    }),
  ]),
  far: Object.freeze([
    Object.freeze({
      id: 'a',
      label: 'Outer Bowl',
      difficulty: 'Hard',
      yield: 1.15,
      price: 1.28,
      qualityBonus: 0.04,
      hazards: 'Open current and swell · persistent wind · uncharted isolated rocks',
    }),
    Object.freeze({
      id: 'b',
      label: 'Long Shoulder',
      difficulty: 'Severe',
      yield: 1.3,
      price: 1.42,
      qualityBonus: 0.07,
      hazards: 'Oblique current · exposed wind · uncharted reef teeth',
    }),
    Object.freeze({
      id: 'c',
      label: 'Needle Edge',
      difficulty: 'Extreme',
      yield: 1.45,
      price: 1.58,
      qualityBonus: 0.1,
      hazards: 'Fast shelf flow · heavy wind · dense uncharted crowns',
    }),
  ]),
});

// All biological and fleet-pressure tuning for logical quota sub-areas lives here.
// Pressure is an index derived from landed pounds; it is deliberately separate from
// the physical patch ledger so old terrain saves remain compatible.
export const QUOTA_BALANCE = Object.freeze({
  pressure: Object.freeze({
    sustainablePerSubArea: 5500,
    sustainableByArea: Object.freeze({ near: 5500, middle: 8000, far: 11000 }),
    playerCatchWeight: 1,
    playerWeightByArea: Object.freeze({ near: 1, middle: 0.8, far: 0.6 }),
    npcCatchWeight: 0.3,
    npcWeightByArea: Object.freeze({ near: 0.3, middle: 0.24, far: 0.18 }),
  }),
  recovery: Object.freeze({
    perSeason: 0.16,
    pressureSensitivity: 0.75,
  }),
  depletion: Object.freeze({
    perExcessRatio: 0.45,
    maximumPerSeason: 0.45,
    minimumHealth: 0.35,
  }),
  yield: Object.freeze({
    minimumMultiplier: 0.45,
    healthExponent: 1.5,
  }),
  npcActivity: Object.freeze({
    presenceChance: 0.55,
    minimumPressure: 20,
    maximumPressure: 140,
    byArea: Object.freeze({
      near: Object.freeze({ presenceChance: 0.88, minimumPressure: 65, maximumPressure: 240 }),
      middle: Object.freeze({ presenceChance: 0.78, minimumPressure: 50, maximumPressure: 205 }),
      far: Object.freeze({ presenceChance: 0.65, minimumPressure: 40, maximumPressure: 170 }),
    }),
  }),
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const freshCurrent = () => ({
  playerCatch: 0,
  npcCatch: 0,
  playerPressure: 0,
  npcPressure: 0,
  npcVisits: 0,
});
const freshSubArea = ({ id }) => ({
  id,
  health: 1,
  current: freshCurrent(),
  previous: null,
});
export function createQuotaAreaState(career) {
  return {
    version: 3,
    season: seasonStatus(career).season,
    lastNpcDay: 0,
    areas: Object.fromEntries(
      QUOTA_AREA_IDS.map((id) => [
        id,
        { subAreas: SUB_AREAS.map((definition) => freshSubArea(definition)) },
      ]),
    ),
  };
}
const normalizedStates = new WeakSet();
export function normalizeQuotaAreas(career) {
  if (!career.quotaAreas) career.quotaAreas = createQuotaAreaState(career);
  const state = career.quotaAreas;
  state.version = 3;
  state.season ??= seasonStatus(career).season;
  state.lastNpcDay ??= 0;
  state.areas ??= {};
  for (const areaId of Object.keys(state.areas))
    if (!QUOTA_AREA_IDS.includes(areaId)) delete state.areas[areaId];
  for (const areaId of QUOTA_AREA_IDS) {
    const area = (state.areas[areaId] ??= { subAreas: [] }),
      existing = area.subAreas || [];
    area.subAreas = SUB_AREAS.map((definition) => {
      const saved = existing.find((entry) => entry.id === definition.id);
      if (!saved) return freshSubArea(definition);
      saved.id = definition.id;
      saved.health = clamp(saved.health ?? 1, QUOTA_BALANCE.depletion.minimumHealth, 1);
      saved.current ??= freshCurrent();
      for (const [key, value] of Object.entries(freshCurrent())) saved.current[key] ??= value;
      saved.previous ??= null;
      return saved;
    });
  }
  normalizedStates.add(state);
  return state;
}
function quotaState(career) {
  return normalizedStates.has(career.quotaAreas) ? career.quotaAreas : normalizeQuotaAreas(career);
}
export const validSubAreaId = (id) => SUB_AREAS.some((subArea) => subArea.id === id);
export function subAreaIdForIndex(index = 0) {
  return SUB_AREAS[
    (((Number(index) || 0) % SUB_AREAS.length) + SUB_AREAS.length) % SUB_AREAS.length
  ].id;
}
export function subAreaDefinition(areaId, id) {
  return (
    AREA_SUB_AREAS[areaId]?.find((subArea) => subArea.id === id) ||
    SUB_AREAS.find((subArea) => subArea.id === id) ||
    SUB_AREAS[0]
  );
}
export function subAreaLabel(id, areaId = null) {
  return subAreaDefinition(areaId, id).label;
}
export function catchProfile(areaId, subAreaId) {
  const definition = subAreaDefinition(areaId, subAreaId);
  return {
    price: definition.price || 1,
    qualityBonus: definition.qualityBonus || 0,
  };
}
export function selectedSubArea(career, areaId) {
  quotaState(career);
  const preferred = career.preferences?.subAreas?.[areaId];
  return validSubAreaId(preferred) ? preferred : SUB_AREAS[0].id;
}
export function subAreaRecord(career, areaId, subAreaId) {
  const state = quotaState(career);
  const area = state.areas[areaId];
  if (!area) return null;
  return area.subAreas.find((entry) => entry.id === subAreaId) || area.subAreas[0];
}
export function subAreaYield(career, areaId, subAreaId) {
  const health = subAreaRecord(career, areaId, subAreaId)?.health ?? 1;
  const tuning = QUOTA_BALANCE.yield,
    base = subAreaDefinition(areaId, subAreaId).yield || 1;
  return (
    base *
    (tuning.minimumMultiplier +
      (1 - tuning.minimumMultiplier) * Math.pow(clamp(health, 0, 1), tuning.healthExponent))
  );
}
export function recordFishingPressure(career, areaId, subAreaId, source, pounds) {
  if (!career || !['player', 'npc'].includes(source) || !Number.isFinite(pounds) || pounds <= 0)
    return 0;
  const record = subAreaRecord(career, areaId, subAreaId);
  if (!record) return 0;
  const weight =
    source === 'player'
      ? (QUOTA_BALANCE.pressure.playerWeightByArea[areaId] ??
        [1, 0.8, 0.6, 0.6, 0.6][coastTier(areaId)])
      : (QUOTA_BALANCE.pressure.npcWeightByArea[areaId] ??
        [0.3, 0.24, 0.18, 0.18, 0.18][coastTier(areaId)]);
  record.current[`${source}Catch`] += pounds;
  record.current[`${source}Pressure`] += pounds * weight;
  return pounds * weight;
}
export function simulateDailyNpcActivity(career) {
  const state = normalizeQuotaAreas(career);
  if (career.day <= state.lastNpcDay) return 0;
  let pressure = 0;
  for (const [areaIndex, areaId] of QUOTA_AREA_IDS.entries()) {
    if (!areaCalendarOpen(career, areaId)) continue;
    for (const [subIndex, subArea] of SUB_AREAS.entries()) {
      const salt = 12001 + areaIndex * 101 + subIndex * 17,
        activityTuning =
          QUOTA_BALANCE.npcActivity.byArea[
            ['near', 'middle', 'far', 'far', 'far'][coastTier(areaId)]
          ];
      if (roll(career.seed + career.day * 7919, salt) >= activityTuning.presenceChance) continue;
      const activity =
        activityTuning.minimumPressure +
        roll(career.seed + career.day * 104729, salt + 43) *
          (activityTuning.maximumPressure - activityTuning.minimumPressure);
      const record = subAreaRecord(career, areaId, subArea.id);
      record.current.npcPressure += activity;
      record.current.npcVisits++;
      pressure += activity;
    }
  }
  state.lastNpcDay = career.day;
  return pressure;
}
export function recoverQuotaAreas(career, days) {
  const crossings =
    Math.floor((career.day - 1) / SEASON.days) - Math.floor((career.day - days - 1) / SEASON.days);
  if (crossings <= 0) return [];
  const state = normalizeQuotaAreas(career);
  const changed = [];
  for (let crossing = 0; crossing < crossings; crossing++) {
    for (const areaId of QUOTA_AREA_IDS)
      for (const record of state.areas[areaId].subAreas) {
        const before = record.health;
        const current = record.current;
        const total = current.playerPressure + current.npcPressure;
        const ratio =
          total /
          (QUOTA_BALANCE.pressure.sustainableByArea[areaId] ||
            [5500, 8000, 11000, 13000, 15000][coastTier(areaId)]);
        if (ratio > 1)
          record.health = Math.max(
            QUOTA_BALANCE.depletion.minimumHealth,
            record.health -
              Math.min(
                QUOTA_BALANCE.depletion.maximumPerSeason,
                (ratio - 1) * QUOTA_BALANCE.depletion.perExcessRatio,
              ),
          );
        else
          record.health = Math.min(
            1,
            record.health +
              QUOTA_BALANCE.recovery.perSeason *
                (1 - ratio * QUOTA_BALANCE.recovery.pressureSensitivity),
          );
        record.previous = {
          season: state.season + crossing,
          ...current,
          totalPressure: total,
          healthBefore: before,
          healthAfter: record.health,
        };
        record.current = freshCurrent();
        if (Math.abs(record.health - before) > 1e-9)
          changed.push({ areaId, subAreaId: record.id, before, health: record.health });
      }
  }
  state.season = seasonStatus(career).season;
  return changed;
}
