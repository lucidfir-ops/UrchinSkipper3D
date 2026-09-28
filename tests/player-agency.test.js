import { presetAssists } from '../src/assists.js';
import { careerWorld } from '../src/career-save.js';
import { playState } from '../src/presentation.js';
import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { chooseGround, returnToHarbour, formatClock } from '../src/day.js';
import { step } from '../src/simulation.js';

test('remaining at sea for multiple nights keeps helm control until an actual harbour crossing', () => {
  const w = createWorld();
  chooseGround(w, 'near');
  Object.assign(w.boat, { x: 300, y: 330, throttle: 0, vx: 0, vy: 0 });
  w.logs = [];
  w.rocks = [];
  for (const minute of [1141, 1320, 1439, 1441, 1801, 2881, 4321]) {
    w.day.minute = minute;
    step(w, { neutral: true }, 1 / 60);
    assert.equal(w.day.phase, 'working', `control at ${formatClock(minute)}`);
    assert.equal(w.day.returnFade, undefined);
    assert.equal(w.day.result, null);
    assert.equal(w.day.rescue, undefined);
    assert.equal(w.boat.throttle, 0);
  }
  assert.equal(w.day.warnings.filter((key) => key === 'late').length, 1);
  w.divers[0].state = 'surface';
  w.boat.y = w.terrain.size;
  assert.equal(returnToHarbour(w).ok, false, 'late return cannot abandon a diver');
  w.divers[0].state = 'ready';
  assert.equal(returnToHarbour(w).ok, true, 'deliberate harbour return remains available');
  assert.equal(w.day.result.onTime, false);
  assert(w.day.result.offloadMinute >= w.day.result.arrival);
});

test('underwater context obeys information entitlements independently of permitted exact readouts', () => {
  const w = careerWorld();
  w.day.phase = 'working';
  w.boat.throttle = 0;
  const d = w.divers[0];
  Object.assign(d, { state: 'harvesting', x: w.boat.x + 2, y: w.boat.y });
  w.career.assists = presetAssists('realistic');
  assert(w.career.assists.exactLoad, 'Realistic still permits exact air / bag readings');
  const hidden = playState(w, '', 3, d, false);
  assert.equal(hidden.observable, false);
  assert.equal(hidden.progress, null);
  assert.doesNotMatch(hidden.status, /WORKING|SEARCHING|SURFACING/);
  w.career.assists = presetAssists('easy');
  assert.match(playState(w, '', 5, d, false).status, /WORKING UNDERWATER/);
  Object.assign(d, { state: 'ready', x: w.boat.x, y: w.boat.y });
  w.career.assists = presetAssists('realistic');
  assert.equal(playState(w, '', 3, d, false).observable, true);
});
