import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  careerWorld,
  decode,
  encode,
  nextCareerDay,
  restore,
  snapshot,
} from '../src/career-save.js';
import { buyAreaAccess, createCareer } from '../src/career-state.js';
import { chooseGround, groundTrip } from '../src/day.js';
import { advanceFleet } from '../src/fleet-life.js';
import { step } from '../src/simulation.js';
import { calculateOffload } from '../src/offload.js';
import {
  AREA_SUB_AREAS,
  QUOTA_AREA_IDS,
  QUOTA_BALANCE,
  SUB_AREAS,
  recordFishingPressure,
  recoverQuotaAreas,
  simulateDailyNpcActivity,
  subAreaRecord,
  subAreaYield,
} from '../src/quota-areas.js';

const allSubAreas = (career) =>
  QUOTA_AREA_IDS.flatMap((areaId) => career.quotaAreas.areas[areaId].subAreas);

test('careers initialize exactly three persistent sub-areas per quota area and migrate legacy saves', () => {
  const w = careerWorld();
  assert.deepEqual(Object.keys(w.career.quotaAreas.areas), [...QUOTA_AREA_IDS]);
  for (const areaId of QUOTA_AREA_IDS)
    assert.deepEqual(
      w.career.quotaAreas.areas[areaId].subAreas.map((record) => record.id),
      SUB_AREAS.map((record) => record.id),
    );

  recordFishingPressure(w.career, 'middle', 'c', 'player', 4321);
  const restored = decode(encode(w));
  assert.deepEqual(restored.career.quotaAreas, w.career.quotaAreas);

  const legacy = snapshot(w);
  delete legacy.career.quotaAreas;
  delete legacy.career.preferences?.subAreas;
  const migrated = restore(legacy);
  for (const areaId of QUOTA_AREA_IDS)
    assert.equal(migrated.career.quotaAreas.areas[areaId].subAreas.length, 3);
});

test('opening rules select a logical sub-area and player harvest is attributed only there', () => {
  const w = careerWorld();
  w.career.preferences.subAreas.near = 'c';
  assert(chooseGround(w, 'near').ok);
  assert.equal(w.day.subAreaId, 'c');

  const patch = w.patches.find((entry) => entry.remaining > 0 && entry.clumps?.length),
    clump = patch.clumps.find((entry) => entry.remaining > 0),
    diver = w.diver;
  Object.assign(diver, {
    state: 'harvesting',
    patch,
    clump,
    x: clump.x,
    y: clump.y,
    minQuality: 0,
    air: 100,
    bag: 0,
    qualitySum: 0,
    diveTime: 0,
    harvestTime: 0,
  });
  const before = subAreaRecord(w.career, 'near', 'c').current.playerCatch;
  step(w, {}, 0.1);
  assert(subAreaRecord(w.career, 'near', 'c').current.playerCatch > before);
  assert.equal(subAreaRecord(w.career, 'near', 'a').current.playerCatch, 0);
  assert.equal(subAreaRecord(w.career, 'near', 'b').current.playerCatch, 0);

  const closed = careerWorld(createCareer(99));
  closed.career.coastAccess = ['home'];
  assert(!groundTrip(closed, 'middle').ok);
  assert.match(groundTrip(closed, 'middle').reason, /Area not open.*day 3/);
  closed.career.day = 3;
  assert(groundTrip(closed, 'middle').ok);
  assert.match(groundTrip(closed, 'storm-channel').reason, /Area not open.*permit/);
  assert(buyAreaAccess(closed, 'storm').ok);
  assert(groundTrip(closed, 'storm-channel').ok);
});

test('coastal beds become harder, richer and more valuable farther from harbour', () => {
  for (const areaId of QUOTA_AREA_IDS) {
    const beds = AREA_SUB_AREAS[areaId];
    assert.equal(beds.length, 3);
    assert(beds[0].yield < beds[1].yield && beds[1].yield < beds[2].yield);
    assert(beds[0].price < beds[1].price && beds[1].price < beds[2].price);
    assert(beds.every((bed) => /current|flow|tide/i.test(bed.hazards)));
  }
  assert(AREA_SUB_AREAS.near[0].price < AREA_SUB_AREAS.middle[0].price);
  assert(AREA_SUB_AREAS.middle[0].price < AREA_SUB_AREAS.far[0].price);

  const quote = (areaId, subAreaId) => {
    const w = careerWorld();
    w.catch = 1000;
    w.bags = [{ weight: 1000, quality: 0.8, harvestMinute: 600, areaId, subAreaId }];
    return calculateOffload(w, 900).value;
  };
  assert(quote('middle', 'b') > quote('near', 'b'));
  assert(quote('far', 'c') > quote('middle', 'c'));
});

test('concentrated pressure depletes next-year yield while equal distributed catch is sustainable', () => {
  const concentrated = createCareer(11),
    distributed = createCareer(11),
    catchTotal =
      (QUOTA_BALANCE.pressure.sustainableByArea.near * 3) /
      QUOTA_BALANCE.pressure.playerWeightByArea.near;
  recordFishingPressure(concentrated, 'near', 'a', 'player', catchTotal);
  for (const subArea of SUB_AREAS)
    recordFishingPressure(distributed, 'near', subArea.id, 'player', catchTotal / 3);

  concentrated.day = 10;
  distributed.day = 10;
  recoverQuotaAreas(concentrated, 9);
  recoverQuotaAreas(distributed, 9);

  assert(subAreaRecord(concentrated, 'near', 'a').health < 0.7);
  assert.equal(subAreaRecord(distributed, 'near', 'a').health, 1);
  assert.equal(subAreaRecord(distributed, 'near', 'b').health, 1);
  assert.equal(subAreaRecord(distributed, 'near', 'c').health, 1);
  assert(subAreaYield(concentrated, 'near', 'a') < subAreaYield(distributed, 'near', 'a'));
});

test('low-pressure seasons recover depleted sub-areas and retain rollover summaries', () => {
  const career = createCareer(12),
    record = subAreaRecord(career, 'far', 'b');
  const catchTotal =
    (QUOTA_BALANCE.pressure.sustainableByArea.far * 3) /
    QUOTA_BALANCE.pressure.playerWeightByArea.far;
  recordFishingPressure(career, 'far', 'b', 'player', catchTotal);
  career.day = 10;
  recoverQuotaAreas(career, 9);
  const depleted = record.health;
  assert(depleted < 1);
  assert.equal(record.previous.playerCatch, catchTotal);
  assert.equal(record.current.playerPressure, 0);

  career.day = 19;
  recoverQuotaAreas(career, 9);
  assert(record.health > depleted);
  assert.equal(record.previous.totalPressure, 0);
});

test('deterministic ambient crews and real rival catch add NPC pressure without replaying', () => {
  const a = createCareer(171709),
    b = createCareer(171709);
  const pressureA = simulateDailyNpcActivity(a),
    pressureB = simulateDailyNpcActivity(b);
  assert(pressureA > 0);
  assert.equal(pressureA, pressureB);
  assert.deepEqual(a.quotaAreas, b.quotaAreas);
  assert(allSubAreas(a).some((record) => record.current.npcVisits > 0));
  assert.equal(simulateDailyNpcActivity(a), 0);

  const w = careerWorld(createCareer(2026)),
    beforeCatch = allSubAreas(w.career).reduce((sum, record) => sum + record.current.npcCatch, 0);
  advanceFleet(w, 1000);
  const afterCatch = allSubAreas(w.career).reduce(
    (sum, record) => sum + record.current.npcCatch,
    0,
  );
  assert(afterCatch > beforeCatch);
  const pressure = allSubAreas(w.career).reduce(
    (sum, record) => sum + record.current.npcPressure,
    0,
  );
  const stock = Object.values(w.sectors).reduce(
    (sum, terrain) => sum + terrain.patches.reduce((total, patch) => total + patch.remaining, 0),
    0,
  );
  advanceFleet(w, 1000);
  assert.equal(
    allSubAreas(w.career).reduce((sum, record) => sum + record.current.npcPressure, 0),
    pressure,
  );
  assert.equal(
    Object.values(w.sectors).reduce(
      (sum, terrain) => sum + terrain.patches.reduce((total, patch) => total + patch.remaining, 0),
      0,
    ),
    stock,
  );
});

test('next-day lifecycle persists pressure through save/load and applies it at year rollover', () => {
  const w = careerWorld(createCareer(33));
  w.career.day = 9;
  w.career.quotaAreas.lastNpcDay = 9;
  recordFishingPressure(
    w.career,
    'middle',
    'b',
    'player',
    (QUOTA_BALANCE.pressure.sustainableByArea.middle * 2) /
      QUOTA_BALANCE.pressure.playerWeightByArea.middle,
  );
  const saved = decode(encode(w));
  const next = nextCareerDay(saved);
  assert.equal(next.career.day, 10);
  const record = subAreaRecord(next.career, 'middle', 'b');
  assert(record.health < 1);
  assert.equal(
    record.previous.playerCatch,
    (QUOTA_BALANCE.pressure.sustainableByArea.middle * 2) /
      QUOTA_BALANCE.pressure.playerWeightByArea.middle,
  );
  assert.equal(next.career.quotaAreas.season, 2);
});
