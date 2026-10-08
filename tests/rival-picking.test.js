import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, nextCareerDay } from '../src/career-save.js';
import { createCareer } from '../src/career-state.js';
import { advanceFleet } from '../src/fleet-life.js';
import { materializeSector } from '../src/sectors.js';
import { RIVAL_PICKING, rivalPatchStock, takeRivalCatch } from '../src/harvest-ground.js';

test('rival crews leave a picked-thin clump instead of stripping it', () => {
  const p = { remaining: 1000, clumps: [{ remaining: 1000, initialStock: 1000 }] };
  assert.equal(takeRivalCatch(p, p.clumps[0], 5000), 700);
  assert.equal(p.clumps[0].remaining, 300);
  assert.equal(rivalPatchStock(p), 0);
  assert.equal(takeRivalCatch(p, p.clumps[0], 50), 0);
});

test('a fortnight of rival fishing leaves every marked bed on the starter map with stock', () => {
  let w = careerWorld(createCareer(1234));
  for (let day = 1; day <= 14; day++) {
    advanceFleet(w, 1439);
    w = nextCareerDay(w);
  }
  const marked = materializeSector(w, 'near').patches.filter((p) => p.charted !== false);
  assert(marked.length >= 10);
  for (const p of marked)
    for (const c of p.clumps)
      assert(c.remaining >= c.initialStock * RIVAL_PICKING.leaveFraction - 0.01, p.id);
});
