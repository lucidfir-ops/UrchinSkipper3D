import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, nextCareerDay, encode, decode } from '../src/career-save.js';
import { chooseGround, returnToHarbour } from '../src/day.js';
import { advanceFleet, fleetResults } from '../src/fleet-life.js';
import { materializeSector } from '../src/sectors.js';
import { stepFishery, answerPatrol, finishInspection, beginInspection } from '../src/fishery.js';
import { deploymentStatus } from '../src/simulation.js';
import { currentAt } from '../src/environment.js';
import { SEA_EVENTS, stepSeaEvents } from '../src/sea-events.js';
import { roll } from '../src/career-data.js';
const sumStock = (w) =>
  Object.values(w.sectors).reduce(
    (sum, t) => sum + t.patches.reduce((n, p) => n + p.remaining, 0),
    0,
  );
test('rival results are actual shared stock depletion, remain finite and cannot rerun after reload', () => {
  const w = careerWorld();
  for (const id of new Set(['near', 'middle', 'far', ...w.career.todayFleet.map((r) => r.area)]))
    materializeSector(w, id);
  const before = sumStock(w);
  advanceFleet(w, 1000);
  const harvested = w.career.todayFleet.reduce((sum, r) => sum + r.gross, 0);
  assert(harvested > 0);
  assert(Math.abs(before - sumStock(w) - harvested) < 1e-6);
  const stock = sumStock(w);
  advanceFleet(w, 1000);
  assert.equal(sumStock(w), stock);
  const restored = decode(encode(w));
  advanceFleet(restored, 1000);
  assert.equal(
    restored.career.todayFleet.reduce((sum, r) => sum + r.gross, 0),
    harvested,
  );
  const results = fleetResults(w, 1200);
  assert.equal(results.length, w.career.todayFleet.filter((r) => !r.hidden).length);
  assert(results.length > 3);
  assert(results.every((r) => r.gross > 0 && r.quality > 0));
});
test('patrol acknowledges working divers, requires invitation and clears clean catch without a fine', () => {
  const w = careerWorld();
  w.career.licenceThrough = 0;
  chooseGround(w, 'near');
  w.day.inspection = { status: 'calling', minute: w.day.minute - 1 };
  w.bags = [{ weight: 300, undersizeCount: 0, quality: 0.8, harvestMinute: 600 }];
  w.catch = 300;
  w.diver.state = 'surface';
  assert(answerPatrol(w).ok);
  assert.equal(w.day.inspection.status, 'calling');
  w.diver.state = 'ready';
  const c = currentAt(w, w.boat.x, w.boat.y);
  Object.assign(w.boat, { vx: c.x, vy: c.y });
  assert(answerPatrol(w).ok);
  assert.match(deploymentStatus(w).reason, /DFO VISIT/);
  beginInspection(w);
  stepFishery(w, 40);
  assert.equal(w.day.inspection.status, 'cleared');
  assert.equal(w.day.inspectionFine, 0);
  assert.equal(w.catch, 300);
  const fine = w.day.inspectionFine;
  finishInspection(w);
  assert.equal(w.day.inspectionFine, fine);
  assert.equal(w.catch, 300);
  const restored = decode(encode(w));
  finishInspection(restored);
  assert.equal(restored.day.inspectionFine, fine);
});
test('outstanding dock inspection can miss the offload deadline without a fine or confiscation', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.day.minute = 1075;
  w.day.inspection = { status: 'calling', minute: 900 };
  w.catch = 300;
  w.bags = [{ weight: 300, undersizeCount: 0, quality: 0.9, harvestMinute: 1000 }];
  Object.assign(w.boat, { x: 300, y: w.terrain.size + 0.01 });
  const result = returnToHarbour(w);
  assert(result.ok);
  assert(!result.onTime);
  assert.equal(result.gross, 300);
  assert.equal(result.career.fine, 0);
  assert.equal(w.career.history[0].net, result.netValue);
  assert.equal(result.rivals.length, w.career.todayFleet.filter((r) => !r.hidden).length);
});
test('rare rough-water event gives one physical shove and debris, without automatic damage', () => {
  const w = careerWorld();
  w.career.day = 3;
  chooseGround(w, 'middle');
  for (let day = 3; day < 2000; day++)
    if (
      roll(w.career.seed, day + 7161) < SEA_EVENTS.unusualChance &&
      roll(w.career.seed, day + 9121) > 0.01
    ) {
      w.career.day = day;
      break;
    }
  w.weather = { wave: 1.5, bearing: 210 };
  w.day.eventCheck = 0;
  const hull = w.boat.hullHealth,
    drive = w.boat.driveHealth,
    before = { vx: w.boat.vx, vy: w.boat.vy };
  stepSeaEvents(w, 1);
  assert.notDeepEqual({ vx: w.boat.vx, vy: w.boat.vy }, before);
  assert.equal(w.boat.hullHealth, hull);
  assert.equal(w.boat.driveHealth, drive);
  const eventCount = w.events.length;
  stepSeaEvents(w, 1);
  assert.equal(w.events.length, eventCount);
});
test('several working days retain accounts, crew condition, stock and fleet reports through reloads', () => {
  let w = careerWorld();
  const startingDay = 5;
  w.career.day = startingDay;
  let previousCash = w.career.cash;
  for (let day = 1; day <= 3; day++) {
    assert(chooseGround(w, day % 2 ? 'near' : 'middle').ok);
    w.day.inspection = null;
    w.catch = 1200;
    w.bags = [{ weight: 1200, quality: 0.9, harvestMinute: w.day.minute }];
    w.day.minute = 900;
    w.boat.x = w.day.returnExit.edge === 'west' ? -0.01 : 300;
    w.boat.y = w.day.returnExit.edge === 'south' ? w.terrain.size + 0.01 : 300;
    const result = returnToHarbour(w);
    assert(result.ok);
    assert(w.career.cash > previousCash);
    previousCash = w.career.cash;
    assert.equal(w.career.records.days, day);
    const reported = w.career.todayFleet.filter((r) => !r.hidden).length;
    w = decode(encode(nextCareerDay(w)));
    assert.equal(w.career.day, startingDay + day);
    assert.equal(w.career.lastFleet.length, reported);
    assert(w.career.lastFleet.some((r) => w.career.news.some((n) => n.includes(r.boat))));
    assert(Object.keys(w.career.stock).length >= 3);
    assert(w.career.lastFleet.every((r) => w.career.stock[r.area]));
  }
});
