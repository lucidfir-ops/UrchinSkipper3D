import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { setupPickup } from '../src/debug-scenarios.js';
import { step, recoveryStatus } from '../src/simulation.js';
test('near-capacity playtest fixture allows both actual recoveries and balances deck markers', () => {
  const w = createWorld();
  setupPickup(w, true);
  assert.equal(w.day.phase, 'practice');
  assert(w.day.assisted);
  assert.equal(
    w.bags.reduce((n, b) => n + b.weight, 0),
    4900,
  );
  for (const d of w.divers) {
    assert(recoveryStatus(w, 2, d).available);
    step(w, { recoverDiver: true, diverId: d.id }, 1 / 60);
    for (let frame = 0; frame < 301; frame++) step(w, {}, 1 / 60);
    assert.equal(d.state, 'ready');
  }
  assert.equal(w.catch, 5000);
  assert.equal(w.discarded, 500);
  assert.equal(
    w.bags.reduce((n, b) => n + b.weight, 0),
    w.catch,
  );
});
