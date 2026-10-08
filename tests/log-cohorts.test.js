import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { stepLogs, LOG_COHORTS } from '../src/hazards.js';

test('distant timber drifts in staggered cohorts by the same total time; near timber every step', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.environment = { ...w.environment, model: 'uniform', current: { x: 0.5, y: -0.25 } };
  w.terrain.depths = w.terrain.depths.slice().fill(20);
  w.logField = { version: 2, base: 0, baseAdded: true };
  Object.assign(w.boat, { x: 300, y: 300, vx: 0, vy: 0 });
  w.logs = [
    { id: 'near', x: 310, y: 300, radius: 0.3, length: 5, heading: 0, phase: 0 },
    { id: 'far', x: 100, y: 100, radius: 0.3, length: 5, heading: 0, phase: 0 },
  ];
  const [near, far] = w.logs;
  stepLogs(w, 0.1);
  assert(Math.abs(near.x - 310.05) < 1e-9, 'near log moves on every step');
  for (let i = 1; i < LOG_COHORTS.count * 3; i++) stepLogs(w, 0.1);
  const steps = LOG_COHORTS.count * 3,
    driftX = far.x + (far.lag || 0) * 0.5 - 100;
  assert(Math.abs(driftX - steps * 0.1 * 0.5) < 1e-9, 'pending time is never lost');
  assert(Math.abs(near.x - (310 + steps * 0.05)) < 1e-9);
});
