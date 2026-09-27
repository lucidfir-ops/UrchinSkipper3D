import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { C } from '../src/config.js';
import {
  chooseGround,
  latestDeparture,
  returnToHarbour,
  returnStatus,
  advanceDay,
  formatClock,
  groundTrip,
} from '../src/day.js';
import { step } from '../src/simulation.js';
test('near and far trips consume time and give 18:00 and 16:00 departures', () => {
  for (const [id, hours, depart] of [
    ['near', 1, '18:00'],
    ['far', 3, '16:00'],
  ]) {
    const w = createWorld();
    assert.equal(w.day.phase, 'planning');
    assert(chooseGround(w, id).ok);
    assert.equal(w.day.minute, C.day.startMinute + hours * 60);
    assert.equal(formatClock(latestDeparture(w)), depart);
  }
});
test('working time uses the shared compression and planning/end screens freeze simulation', () => {
  const w = createWorld();
  step(w, { fullAhead: true }, 1 / 60);
  assert.equal(w.time, 0);
  assert.equal(w.boat.throttle, 0);
  chooseGround(w, 'near');
  advanceDay(w, 30);
  assert.equal(w.day.minute, 555);
  w.boat.y = w.terrain.size;
  assert(returnToHarbour(w).ok);
  const before = JSON.stringify(w);
  step(w, { fullAhead: true, recoverDiver: true }, 1 / 60);
  assert(JSON.stringify(w) === before);
});
test('return cannot abandon either diver, and a rejected return does not change the clock or catch', () => {
  const w = createWorld();
  chooseGround(w, 'far');
  w.divers[1].state = 'surface';
  w.catch = 300;
  const minute = w.day.minute;
  assert(!returnStatus(w).available);
  assert(!returnToHarbour(w).ok);
  assert.equal(w.day.minute, minute);
  assert.equal(w.catch, 300);
});
test('exact 19:00 arrival ships on time; one minute late books delayed shipping and offloads once', () => {
  for (const delay of [0, 1]) {
    const w = createWorld();
    chooseGround(w, 'far');
    w.day.minute = latestDeparture(w) + delay;
    w.catch = 300;
    w.bags = [{ weight: 300, quality: 0.8 }];
    w.boat.y = w.terrain.size;
    const result = returnToHarbour(w);
    assert.equal(result.onTime, delay === 0);
    assert.equal(w.day.offloaded, 300);
    assert.equal(w.catch, 0);
    assert.equal(w.bags.length, 0);
    assert(!returnToHarbour(w).ok);
    assert.equal(w.day.offloaded, 300);
    assert.equal(w.day.result.catch, 300);
  }
});
test('changing ground preserves exhausted stock and requires everyone aboard', () => {
  const w = createWorld();
  chooseGround(w, 'near');
  w.patches[0].remaining = 0;
  w.divers[0].state = 'searching';
  assert(!chooseGround(w, 'far').ok);
  w.divers[0].state = 'ready';
  const trip = groundTrip(w, 'far');
  assert.equal(trip.minutes, 120);
  assert(chooseGround(w, 'far').ok);
  assert.equal(w.patches[0].remaining, 1000);
  assert.equal(w.sectors.near.patches[0].remaining, 0);
  assert.equal(w.day.minute, 660);
  assert(chooseGround(w, 'near').ok);
  assert.equal(w.patches[0].remaining, 0);
});
test('deadline warnings are emitted once per threshold and practice does not run a deadline', () => {
  const w = createWorld();
  chooseGround(w, 'near');
  w.day.minute = latestDeparture(w) - 31;
  advanceDay(w, 2);
  assert.deepEqual(w.day.warnings, ['soon']);
  advanceDay(w, 60);
  assert.deepEqual(w.day.warnings, ['soon', 'leave']);
  advanceDay(w, 3);
  assert.deepEqual(w.day.warnings, ['soon', 'leave', 'late']);
  const count = w.effects.length;
  advanceDay(w, 10);
  assert.equal(w.effects.length, count);
  const practice = createWorld({ practice: true });
  advanceDay(practice, 9999);
  assert.equal(practice.day.minute, C.day.startMinute);
});
