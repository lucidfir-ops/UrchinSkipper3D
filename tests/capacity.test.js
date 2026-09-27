import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { C } from '../src/config.js';
import { step, deploymentStatus, recoveryStatus } from '../src/simulation.js';

function fixture(load, weight = 300) {
  const w = createWorld({ practice: true });
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  w.debris = [];
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  Object.assign(w.boat, { x: 232, y: 238, vx: 0, vy: 0 });
  w.catch = load;
  Object.assign(w.diver, {
    state: 'surface',
    x: 228,
    y: 238,
    bag: weight,
    qualitySum: weight * 0.8,
    air: 40,
    reason: 'Bag full',
  });
  return w;
}
function recover(w, action) {
  step(w, action, 1 / 60);
  for (let n = 0; n < (action.recoverDiver ? 310 : 190); n++) step(w, {}, 1 / 60);
}
test('near-capacity combined recovery lands only fitting catch, reports overflow, and boards once', () => {
  const w = fixture(4900);
  assert(recoveryStatus(w).available);
  recover(w, { recoverDiver: true });
  assert.equal(w.diver.state, 'ready');
  assert.equal(w.catch, 5000);
  assert.equal(w.discarded, 200);
  assert.deepEqual(
    w.bags.map(({ weight, quality, harvestMinute }) => ({ weight, quality, harvestMinute })),
    [{ weight: 100, quality: 0.8, harvestMinute: 480 }],
  );
  assert.equal(w.bags[0].haulSeconds, 3);
  assert(w.events.some((e) => /200 lb EXCESS CATCH RELEASED/.test(e)));
  recover(w, { recoverDiver: true });
  assert.equal(w.catch, 5000);
  assert.equal(w.bags.length, 1);
  assert.equal(w.discarded, 200);
});
test('full-deck bag recovery never redescends and subsequent boarding stays possible', () => {
  const w = fixture(5000);
  recover(w, { work: true });
  assert.equal(w.catch, 5000);
  assert.equal(w.bags.length, 0);
  assert.equal(w.diver.state, 'surface');
  assert(w.diver.bagHandled);
  recover(w, { recoverDiver: true });
  assert.equal(w.diver.state, 'ready');
});
test('new deployment reserves room for a normal bag', () => {
  const w = fixture(4900);
  w.diver.state = 'ready';
  assert(!deploymentStatus(w).available);
  w.catch = C.boat.capacity - C.diver.bagSize;
  assert(deploymentStatus(w).available);
});
