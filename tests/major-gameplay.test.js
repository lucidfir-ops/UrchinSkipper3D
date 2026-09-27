import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C } from '../src/config.js';
import { createWorld, selectDiver } from '../src/world.js';
import { chooseGround, returnToHarbour } from '../src/day.js';
import { step, nearestRecoveryTarget, pinActionTargets } from '../src/simulation.js';
import { playState } from '../src/presentation.js';
import { calculateOffload } from '../src/offload.js';
import { hullDepth } from '../src/boat.js';

function calm() {
  const w = createWorld({ practice: true });
  w.debris = [];
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  Object.assign(w.boat, { vx: 0, vy: 0 });
  return w;
}
function tick(w, seconds) {
  for (let i = 0; i < seconds * 60; i++) step(w, {}, 1 / 60);
}
function floats(w) {
  for (const d of w.divers)
    Object.assign(d, {
      state: 'surface',
      x: 245 - d.id,
      y: 250,
      bag: 300,
      qualitySum: 240,
      air: 35,
      reason: 'Patch exhausted',
    });
}
test('recovery targets physical proximity in both modes even when the other diver is selected', () => {
  for (const tolerance of [2, 5]) {
    const w = calm();
    floats(w);
    w.divers[0].x = 246;
    w.divers[1].x = 247;
    selectDiver(w, 0);
    assert.equal(nearestRecoveryTarget(w, 'recoverDiver', tolerance).id, 1);
    step(w, { recoverDiver: true }, 1 / 60, { tolerance });
    tick(w, 5.1);
    assert.equal(w.divers[1].state, 'ready');
    assert.equal(w.divers[0].state, 'surface');
    assert.equal(w.divers[1].air, 100);
  }
});
test('both bag offers and boarding use the nearer diver, including a handled bag', () => {
  const w = calm();
  floats(w);
  w.divers[0].x = 246;
  w.divers[0].bagHandled = true;
  w.divers[0].bag = 0;
  w.divers[1].x = 245;
  assert.equal(nearestRecoveryTarget(w, 'work').id, 0);
  assert.equal(nearestRecoveryTarget(w, 'recoverDiver').id, 0);
  const actions = playState(w).actions;
  assert.equal(actions.find((a) => a.action === 'work').diverId, 0);
  assert.equal(actions.find((a) => a.action === 'recoverDiver').diverId, 0);
});
test('eligibility beats raw distance; ties and already queued targets are stable', () => {
  const w = calm();
  floats(w);
  w.divers[0].x = 254;
  w.divers[1].x = 244;
  assert.equal(
    nearestRecoveryTarget(w, 'recoverDiver').id,
    1,
    'closer starboard diver is ineligible',
  );
  w.divers[0].x = 246;
  w.divers[1].x = 246.1;
  selectDiver(w, 1);
  assert.equal(nearestRecoveryTarget(w, 'work').id, 0);
  const pinned = pinActionTargets(w, { recoverDiver: true });
  w.divers[1].x = 247;
  step(w, pinned, 1 / 60);
  assert(w.divers[0].hook > 0);
  assert.equal(w.divers[1].hook, 0);
});
test('100 air supports three productive bags without boarding, and bag turnaround retains air', () => {
  const w = calm(),
    d = w.divers[0],
    patch = w.patches[0];
  patch.rate = 15;
  patch.remaining = 1000;
  Object.assign(w.boat, { x: 232, y: 238 });
  step(w, { recoverDiver: true, diverId: 0 }, 1 / 60);
  for (let bag = 0; bag < 3; bag++) {
    for (let i = 0; i < 100 * 60 && d.state !== 'surface'; i++) step(w, {}, 1 / 60);
    assert.equal(d.bag, 300);
    const air = d.air;
    Object.assign(w.boat, { x: d.x + 4, y: d.y, heading: 0, vx: 0, vy: 0 });
    step(w, { work: true }, 1 / 60);
    tick(w, 3);
    assert.equal(d.air, air);
    assert.equal(w.catch, (bag + 1) * 300);
    if (bag < 2) step(w, { work: true }, 1 / 60);
  }
  assert(d.air < C.diver.air && d.air > C.diver.reserve);
});
test('the empty control in each new sector remains a useful no-catch air-reserve test', () => {
  for (const id of ['near', 'middle', 'far']) {
    const w = createWorld();
    chooseGround(w, id, { patchId: 'empty' });
    w.debris = [];
    w.diver.searchLimit = 0; // This fixture isolates the separate air-reserve trigger.
    step(w, { recoverDiver: true }, 1 / 60);
    tick(w, 98);
    assert.equal(w.divers[0].state, 'surface');
    assert.equal(w.divers[0].bag, 0);
    assert.equal(w.divers[0].reason, 'Air reserve');
  }
});
test('bow contact permits forward leverage to swing the stern, then reverse into deeper water', () => {
  for (const rudder of [-1, 1]) {
    const w = calm(),
      { size, spacing, depths } = w.terrain,
      n = size / spacing + 1;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) depths[y * n + x] = (y * spacing - 200) * 0.2;
    Object.assign(w.boat, { x: 250, y: 225, heading: 0, throttle: 1, vy: -5 });
    tick(w, 6);
    assert(w.boat.grounded);
    const start = w.boat.heading;
    w.boat.rudder = rudder;
    tick(w, 9);
    assert((w.boat.heading - start) * rudder > 0.35, 'stern swings in the requested direction');
    assert(hullDepth(w) >= 2 - 0.0001);
    w.boat.throttle = -1;
    tick(w, 12);
    assert(!w.boat.grounded);
    assert(hullDepth(w) > 2.3);
  }
});
test('return requires the harbour edge, blocks with divers out, and commits by physical movement once', () => {
  for (const [id, edge] of [
    ['near', 'south'],
    ['middle', 'west'],
  ]) {
    const w = createWorld();
    chooseGround(w, id);
    assert.equal(w.day.returnExit.edge, edge);
    assert(!returnToHarbour(w).ok);
    w.terrain.depths = w.terrain.depths.slice().fill(30);
    w.debris = [];
    w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
    w.catch = 300;
    w.bags = [{ weight: 300, quality: 0.9, harvestMinute: 540 }];
    Object.assign(
      w.boat,
      edge === 'south'
        ? { x: 300, y: 594, heading: Math.PI, vx: 0, vy: 2, throttle: 1 }
        : { x: 6, y: 300, heading: -Math.PI / 2, vx: -2, vy: 0, throttle: 1 },
    );
    w.divers[1].state = 'surface';
    tick(w, 2);
    assert.equal(w.day.phase, 'working');
    assert(w.boat.y <= 595 && w.boat.x >= 5);
    w.divers[1].state = 'ready';
    tick(w, 7);
    assert.equal(w.day.phase, 'complete');
    assert.equal(w.day.offloaded, 300);
    assert.equal(w.catch, 0);
    const result = JSON.stringify(w.day.result);
    tick(w, 5);
    assert.equal(JSON.stringify(w.day.result), result);
    assert(w.day.result.value > 0);
  }
});
test('water loss and price respond to quality, product age and delayed shipping without failure', () => {
  const w = calm();
  w.catch = 1000;
  w.bags = [{ weight: 1000, quality: 0.8, harvestMinute: 840 }];
  w.day.minute = 1080;
  const fresh = calculateOffload(w, 1080),
    late = calculateOffload(w, 1141),
    later = calculateOffload(w, 1500);
  assert(fresh.waterLoss > 0.1 && fresh.waterLoss < 0.19);
  assert.equal(fresh.delayHours, 0);
  assert.equal(late.offloadMinute, 1440 + 360);
  assert.equal(late.delayHours, (1440 + 360 - 1141) / 60);
  assert(late.value > 0 && late.value < fresh.value);
  assert(late.landedQuality < fresh.landedQuality);
  assert(later.waterLoss > fresh.waterLoss);
  assert(Math.abs(late.landed + late.waterLost - late.gross) < 1e-8);
  assert.deepEqual(late, calculateOffload(w, 1141));
  w.bags[0].quality = 0.6;
  const poor = calculateOffload(w, 1080);
  assert(poor.waterLoss > fresh.waterLoss && poor.value < fresh.value);
  w.bags[0].quality = 0.9;
  w.bags[0].harvestMinute = 1050;
  const better = calculateOffload(w, 1080);
  assert(better.waterLoss < fresh.waterLoss && better.value > fresh.value);
});
test('late return still reaches a useful results state and time formatting supports next day shipping', () => {
  const w = createWorld();
  chooseGround(w, 'far');
  w.day.minute = 1100;
  w.boat.y = 600;
  w.catch = 300;
  w.bags = [{ weight: 300, quality: 0.8 }];
  const r = returnToHarbour(w);
  assert(r.ok);
  assert(!r.onTime);
  assert(r.value > 0);
  assert.equal(w.day.phase, 'complete');
  assert(!('failed' in w.day));
  assert(r.offloadMinute > 1440);
});
