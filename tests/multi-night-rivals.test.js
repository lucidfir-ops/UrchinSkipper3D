import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode, nextCareerDay, snapshot } from '../src/career-save.js';
import { createCareer } from '../src/career-state.js';
import { chooseGround, requestRescue } from '../src/day.js';
import { advanceFleet, fleetResults } from '../src/fleet-life.js';
import { materializeSector } from '../src/sectors.js';
import { prepareTraffic, spawnTraffic, stepTraffic } from '../src/traffic.js';
import { rivalDayPlan } from '../src/rival-plan.js';
import { takeCatch } from '../src/harvest-ground.js';
import { recordFishingPressure, subAreaRecord } from '../src/quota-areas.js';
import { validateSnapshot } from '../src/save-validation.js';

function voyage(day = 1) {
  const c = createCareer();
  c.day = day;
  const w = careerWorld(c);
  assert(chooseGround(w, 'near').ok);
  w.career.trafficSettings = { rate: 0 };
  w.day.minute = 700;
  return w;
}
const total = (rows) => rows.reduce((sum, r) => sum + r.gross, 0);
const stock = (w) =>
  Object.fromEntries(
    Object.entries(w.sectors).map(([id, t]) => [
      id,
      t.patches.map((p) => [p.remaining, ...p.clumps.map((clump) => clump.remaining)]),
    ]),
  );

test('a second-day rival physically arrives, harvests shared stock and keeps catch attribution through reload', () => {
  let w = voyage();
  w.day.minute += 1440;
  prepareTraffic(w);
  assert.equal(w.career.fleetDay, 2);
  const actor = spawnTraffic(w, 'rival');
  assert(actor, 'natural visitor exists during its second-day working window');
  const patch = w.patches.find((p) => p.id === actor.patchId),
    before = patch.remaining;
  for (let tick = 0; tick < 3500 && !actor.done; tick++) {
    w.time += 0.1;
    w.day.minute += 0.05;
    stepTraffic(w, 0.1);
    if (w.career.todayFleet.find((r) => r.id === actor.fleetId).gross > 350) break;
  }
  const fleet = w.career.todayFleet.find((r) => r.id === actor.fleetId);
  assert.equal(actor.fleetDay, 2);
  assert(fleet.gross > 350);
  assert(Math.abs(before - patch.remaining - fleet.gross) < 1e-6);
  const caught = fleet.gross;
  w = decode(encode(w));
  advanceFleet(w);
  assert.equal(w.career.todayFleet.find((r) => r.id === actor.fleetId).gross, caught);
  assert.equal(w.patches.find((p) => p.id === patch.id).remaining, before - caught);
  assert.equal(w.career.day, 1);
});

test('daily visitor limits renew once after midnight, survive reload, and remain shared across sectors', () => {
  let w = voyage();
  for (const day of [1, 2]) {
    w.day.minute = (day - 1) * 1440 + 700;
    prepareTraffic(w);
    for (const r of w.career.todayFleet) Object.assign(r, { area: 'near', begin: 0, end: 1120 });
    let visits = 0;
    for (let n = 0; n < 12; n++) {
      if (spawnTraffic(w, 'rival')) visits++;
      w.traffic.actors = [];
      w = decode(encode(w));
      w.traffic = null;
    }
    assert.equal(visits, rivalDayPlan(w.career, day).limit, `visitor allowance on day ${day}`);
  }
});

test('a prior-day physical rival sails out without working for tomorrow’s same team', () => {
  let w = voyage();
  const first = w.career.todayFleet.find((r) => r.id === 'team-0');
  assert.equal(first.area, 'near');
  const actor = spawnTraffic(w, 'rival', { fleetId: first.id });
  assert(actor);
  // A legacy saved vessel is tagged before the new plan replaces its team row.
  delete actor.fleetDay;
  w = decode(encode(w));
  const old = w.traffic.actors[0],
    initial = { x: old.x, y: old.y };
  w.day.minute = 1440 + 700;
  prepareTraffic(w);
  assert.equal(old.fleetDay, 1);
  const next = w.career.todayFleet.find((r) => r.id === first.id);
  assert(next, 'the same named team is present on the next day');
  const caught = next.gross,
    before = stock(w);
  stepTraffic(w, 0.1);
  assert.equal(old.phase, 'leaving');
  assert.equal(next.gross, caught);
  assert.deepEqual(stock(w), before);
  assert.notDeepEqual({ x: old.x, y: old.y }, initial, 'the visible vessel moves along its exit');
  for (let tick = 0; tick < 4000 && !old.done; tick++) {
    w.time += 0.1;
    stepTraffic(w, 0.1);
  }
  assert(old.done);
  assert.equal(next.gross, caught);
});

test('complete skipped-day catch-up matches daily advancement without aggregate fishing in the occupied sector', () => {
  const stepped = voyage(),
    skipped = decode(encode(stepped)),
    before = stock(stepped).near;
  for (let day = 1; day <= 8; day++) {
    stepped.day.minute = (day - 1) * 1440 + 1140;
    advanceFleet(stepped);
    assert(total(stepped.career.todayFleet) > 0, `off-map fishing on day ${day}`);
  }
  skipped.day.minute = 7 * 1440 + 1140;
  advanceFleet(skipped);
  assert.equal(skipped.career.fleetDay, 8);
  assert.equal(skipped.career.quotaAreas.lastNpcDay, 8);
  assert.deepEqual(stock(skipped), stock(stepped));
  assert.deepEqual(skipped.career.quotaAreas, stepped.career.quotaAreas);
  assert.deepEqual(stock(skipped).near, before);
  const saved = decode(encode(skipped)),
    ledger = snapshot(saved);
  advanceFleet(saved);
  assert.deepEqual(snapshot(saved).career.stock, ledger.career.stock);
  assert.deepEqual(saved.career.todayFleet, ledger.career.todayFleet);
  const rows = fleetResults(saved, saved.day.minute);
  assert(rows.every((r) => r.day === 8 && r.minute === 1140));
  assert.equal(
    total(rows),
    total(
      saved.career.todayFleet.filter((r) => !r.hidden).map((r) => ({ gross: Math.round(r.gross) })),
    ),
  );
});

test('season recovery at sea updates live and saved grounds once and is not repeated at harbour', () => {
  let w = voyage(9);
  const patch = w.patches[0],
    clump = patch.clumps[0];
  takeCatch(patch, clump, clump.remaining * 0.8);
  recordFishingPressure(w.career, 'near', 'a', 'player', 30000);
  const expected = Math.min(
    clump.initialStock,
    clump.remaining * 1.35 + clump.initialStock * 0.004,
  );
  w.day.minute = 1440;
  advanceFleet(w);
  assert.equal(w.career.groundRecoverySeason, 2);
  assert.equal(w.career.quotaAreas.season, 2);
  assert.equal(clump.remaining, expected);
  assert(subAreaRecord(w.career, 'near', 'a').health < 1);
  const pressure = structuredClone(w.career.quotaAreas);
  advanceFleet(w);
  assert.equal(clump.remaining, expected);
  assert.deepEqual(w.career.quotaAreas, pressure);
  w = decode(encode(w));
  // Keep the next morning's independent off-map picking out of this recovery check.
  for (const r of w.career.todayFleet) r.goal = 0;
  w.boat.grounded = true;
  assert(requestRescue(w).ok);
  const next = nextCareerDay(w);
  assert.equal(next.career.day, 10);
  const terrain = materializeSector(next, 'near');
  assert.equal(terrain.patches[0].clumps[0].remaining, expected);
  assert.deepEqual(next.career.quotaAreas, pressure);
  assert.equal(next.career.groundRecoverySeason, 2);
});

test('rivals finish an early-return day during the harbour interval without rewriting the arrival receipt', () => {
  const w = voyage();
  w.boat.grounded = true;
  assert(requestRescue(w).ok);
  const receipt = structuredClone(w.day.result.rivals),
    next = nextCareerDay(w);
  assert.equal(next.career.day, 2);
  assert.equal(next.career.fleetDay, 2);
  assert.equal(next.career.lastFleetDay, 1);
  assert(total(next.career.lastFleet) > total(receipt));
  assert.deepEqual(w.day.result.rivals, receipt);
  assert(next.career.lastFleet.every((r) => r.day === 1 && r.minute === 1440));
  assert.doesNotThrow(() => decode(encode(w)), 'the completed source world remains archivable');
  const restored = decode(encode(next)),
    before = snapshot(restored).career.stock;
  advanceFleet(restored);
  assert.deepEqual(snapshot(restored).career.stock, before);
});

test('malformed rival date and ledger state cannot enter the live save', () => {
  const original = snapshot(voyage());
  for (const mutate of [
    (data) => {
      data.career.fleetDay = 100;
    },
    (data) => {
      data.career.groundRecoverySeason = -1;
    },
    (data) => {
      data.career.todayFleet[0].gross = NaN;
    },
    (data) => {
      data.career.todayFleet[0].day = 2;
    },
  ]) {
    const data = structuredClone(original);
    mutate(data);
    assert.throws(() => validateSnapshot(data), /rival|recovery/);
  }
});

test('a yielded rival route search cannot commit yesterday’s crew after midnight', () => {
  const w = voyage();
  w.day.minute = 1439;
  w.career.trafficSettings.rate = 1;
  prepareTraffic(w);
  Object.assign(w.traffic.next, { taxi: Infinity, tourist: Infinity, dfo: Infinity, rival: 0 });
  for (const r of w.career.todayFleet) Object.assign(r, { area: 'near', begin: 0, end: 1440 });
  for (const p of w.patches) Object.assign(p, { x: 300, y: 300 });
  Object.assign(w.boat, { x: 100, y: 100 });
  const terrain = w.terrain,
    side = terrain.size / terrain.spacing + 1;
  terrain.depths = terrain.depths.slice().fill(40);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++)
      if (Math.hypot(x * terrain.spacing - 300, y * terrain.spacing - 300) < 90)
        terrain.depths[y * side + x] = -20;
  stepTraffic(w, 1 / 60);
  assert.equal(w.traffic.serial, 1);
  assert.equal(
    w.traffic.next.rival,
    0,
    'the route search is pending after its first failed attempt',
  );
  w.day.minute = 1440 + 700;
  terrain.depths = terrain.depths.slice().fill(40);
  for (let tick = 0; tick < 10 && w.traffic.next.rival === 0; tick++) stepTraffic(w, 1 / 60);
  assert.equal(w.career.fleetDay, 2);
  assert(w.traffic.next.rival > 0);
  assert.equal(
    w.traffic.actors.length,
    0,
    'the stale generator must discard its old-day candidate',
  );
  assert(!w.career.todayFleet.some((r) => r.shipSeen));
});
