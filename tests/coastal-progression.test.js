import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { COASTS, PHYSICAL_AREAS } from '../src/coasts.js';
import { createCareer, buyAreaAccess } from '../src/career-state.js';
import { careerWorld, snapshot, restore, encode, decode } from '../src/career-save.js';
import { chooseFirstBoat } from '../src/starter-career.js';
import { SECTORS, enterSector } from '../src/sectors.js';
import { areaStatus, areaOpen } from '../src/season.js';
import { chooseGround } from '../src/day.js';
import { currentAt, updateEnvironment } from '../src/environment.js';
import { conditionsAt } from '../src/weather.js';
import { fixedFeatures } from '../src/shore-hazards.js';
import { waterRoute, clearWater } from '../src/water-route.js';
import { careerTerrain } from '../src/career-terrain.js';
import { prepareFleet } from '../src/fleet-life.js';
import { assessProgression } from '../scripts/progression-balance.js';

test('five coasts contain fifteen distinct physical maps with navigable entrances and working ground', () => {
  const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  assert.deepEqual(
    COASTS.flatMap((coast) => coast.sectors),
    SECTORS.map((s) => s.id),
  );
  for (const field of ['depths', 'currentField'])
    assert.equal(new Set(SECTORS.map((s) => hash(s.terrain[field]))).size, 15);
  for (const definition of SECTORS) {
    const w = careerWorld();
    w.career.day = 5;
    w.day.groundId = definition.id;
    enterSector(w, definition.id);
    w.environment.seaLevel = -0.4;
    const spec = { draft: 2, radius: 5 };
    assert(
      clearWater(w.terrain, -0.4, definition.entry, spec),
      `${definition.id}: low-tide Workhorse entrance`,
    );
    const patches = w.patches.filter((p) => p.remaining > 0);
    assert(
      patches.some((p) => waterRoute(w, definition.entry, p.drop, spec).length),
      `${definition.id}: reachable working shelf`,
    );
    assert.equal(w.terrain.id, definition.id);
  }
});

test('new careers include Home Coast; coast permits buy three maps once and respect each seasonal opening', () => {
  const w = careerWorld(createCareer(17, { chooseStarter: true }));
  chooseFirstBoat(w, 'basic');
  assert.deepEqual(w.career.coastAccess, ['home']);
  for (const day of [1, 3, 5]) {
    w.career.day = day;
    for (const area of PHYSICAL_AREAS)
      assert.equal(areaOpen(w.career, area.id), area.tier === 0 && day >= area.openDay);
  }
  assert.match(areaStatus(w.career, 'storm-channel').reason, /Area not open.*12,000/);
  w.career.cash = 250000;
  for (const coast of COASTS.slice(1)) {
    const before = w.career.cash;
    assert(buyAreaAccess(w, coast.id).ok);
    assert.equal(w.career.cash, before - coast.accessCost);
    assert(!buyAreaAccess(w, coast.sectors[1]).ok);
    assert.equal(w.career.cash, before - coast.accessCost);
    for (const id of coast.sectors) assert(areaOpen(w.career, id));
  }
  const saved = decode(encode(w));
  assert.deepEqual(saved.career.coastAccess, ['home', 'storm', 'frontier', 'maelstrom', 'outer']);
  saved.career.day = 10;
  assert(areaOpen(saved.career, 'frontier-reach'));
  assert(!areaOpen(saved.career, 'frontier-bank'));
});

test('legacy permits, current physical map, depleted clumps, knowledge and accounting records migrate without reset', () => {
  const w = careerWorld();
  w.career.day = 5;
  chooseGround(w, 'middle', { subAreaId: 'c' });
  const p = w.patches[0],
    removed = p.clumps[0].remaining;
  p.clumps[0].remaining = 0;
  p.remaining -= removed;
  w.career.knowledge.middle = { grounds: {}, tracks: [], depths: [] };
  const old = snapshot(w);
  delete old.career.coastAccess;
  old.career.areaAccess = ['near', 'middle'];
  old.career.quotaAreas.version = 1;
  for (const area of PHYSICAL_AREAS.filter((a) => a.tier))
    delete old.career.quotaAreas.areas[area.id];
  const records = structuredClone(old.career.quotaAreas.areas);
  const next = restore(old);
  assert.deepEqual(next.career.coastAccess, ['home', 'storm']);
  assert.equal(next.day.groundId, 'middle');
  assert.equal(next.day.subAreaId, 'c');
  assert.equal(next.patches[0].remaining, p.remaining);
  assert.equal(next.patches[0].clumps[0].remaining, 0);
  for (const id of ['near', 'middle', 'far'])
    assert.deepEqual(next.career.quotaAreas.areas[id], records[id]);
  assert.equal(Object.keys(next.career.quotaAreas.areas).length, 15);
  assert.deepEqual(decode(encode(next)).career.stock, next.career.stock);
});

test('offshore coasts raise current exposure, gust variability, unknown rocks and stock with fewer rival visits', () => {
  const samples = [];
  for (const coast of COASTS) {
    const definition = SECTORS.find((s) => s.id === coast.sectors[0]),
      w = careerWorld();
    w.day.groundId = definition.id;
    enterSector(w, definition.id);
    let sum = 0,
      count = 0;
    for (const minute of [540, 660, 780, 900]) {
      w.day.minute = minute;
      updateEnvironment(w);
      for (let y = 60; y < 560; y += 50)
        for (let x = 60; x < 560; x += 50) {
          const c = currentAt(w, x, y);
          sum += Math.hypot(c.x, c.y);
          count++;
        }
    }
    w.career.weatherPlan = [{ minute: 0, kind: 'storm', bearing: 210 }];
    const weather = conditionsAt(w, 720),
      rocks = fixedFeatures(w.terrain),
      terrain = careerTerrain(definition, 6);
    samples.push({
      current: sum / count,
      wind: weather.wind,
      wave: weather.wave,
      uncharted: rocks.filter((r) => !r.charted).length,
      stock: terrain.patches.reduce((n, p) => n + p.initialStock, 0),
    });
  }
  for (const key of ['current', 'wind', 'wave', 'uncharted', 'stock'])
    assert(
      samples[0][key] < samples[1][key] && samples[1][key] < samples[2][key],
      `${key}: ${JSON.stringify(samples)}`,
    );
  const visits = { home: 0, storm: 0, frontier: 0 },
    c = createCareer();
  c.day = 0;
  prepareFleet(c);
  assert(c.todayFleet.every((r) => PHYSICAL_AREAS.some((area) => area.id === r.area)));
  c.weatherPlan = [{ minute: 0, kind: 'calm', bearing: 210 }];
  for (let day = 1; day <= 90; day++) {
    c.day = day;
    prepareFleet(c);
    for (const r of c.todayFleet.filter((r) => !r.hidden))
      visits[COASTS.find((coast) => coast.sectors.includes(r.area)).id]++;
  }
  assert(
    visits.home > visits.storm && visits.storm > visits.frontier && visits.frontier > 0,
    JSON.stringify(visits),
  );
});

test('multi-season economic sensitivity preserves solvency, supports earned coast two and exposes setbacks/depletion', () => {
  const competent = assessProgression({ strategy: 'competent' });
  const cautious = assessProgression({ strategy: 'cautious' });
  const expert = assessProgression({ strategy: 'aggressive', setbacks: false });
  assert(competent.permits.storm <= 18, JSON.stringify(competent.permits));
  assert(cautious.finalCash >= 0);
  assert(expert.permits.frontier <= 18, JSON.stringify(expert.permits));
  assert(competent.rows.some((r) => r.injured));
  assert(competent.rows.some((r) => r.repairDue > 0));
  assert(competent.rows.some((r) => r.rest));
  assert(competent.rows.filter((r) => !r.rest).every((r) => r.fuel > 0 && r.crew >= 0));
});
