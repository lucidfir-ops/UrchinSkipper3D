import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { chooseGround, returnToHarbour } from '../src/day.js';
import { step } from '../src/simulation.js';
import { beginDeparture, departureBoat, DEPARTURE_SECONDS } from '../src/departure-transition.js';

const tick = (w, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i++)
    step(w, { fullReverse: true, recoverDiver: true, work: true }, 1 / 60);
};
test('physical exit visibly fades before offload; reload during travel settles exactly once', () => {
  let w = careerWorld();
  chooseGround(w, 'near');
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  w.logs = [];
  Object.assign(w.boat, {
    x: 250,
    y: w.terrain.size - 0.01,
    heading: Math.PI,
    vx: 0,
    vy: 3,
    throttle: 0.4,
    rudder: 0,
  });
  w.catch = 100;
  w.bags = [{ weight: 100, quality: 0.8, harvestMinute: w.day.minute }];
  step(w, {}, 1 / 60);
  assert.equal(w.day.returnFade, 0);
  assert.equal(w.day.phase, 'working');
  assert.equal(departureBoat(w).alpha, 1);
  const before = {
    minute: w.day.minute,
    fuel: w.boat.fuel,
    cash: w.career.cash,
    x: w.boat.x,
    y: w.boat.y,
  };
  const immediate = decode(encode(w));
  delete immediate.day.returnFade;
  assert(returnToHarbour(immediate).ok);
  tick(w, DEPARTURE_SECONDS / 2);
  assert(departureBoat(w).alpha > 0.3 && departureBoat(w).alpha < 0.7);
  assert(departureBoat(w).y > before.y, 'rendered boat continues beyond the boundary');
  assert.equal(w.day.minute, before.minute);
  assert.equal(w.boat.fuel, before.fuel);
  assert.equal(w.career.cash, before.cash);
  assert.equal(w.boat.y, before.y, 'presentation does not move simulation geometry');
  assert(w.divers.every((d) => d.state === 'ready'));
  w = decode(encode(w));
  tick(w, DEPARTURE_SECONDS);
  assert.equal(w.day.phase, 'complete');
  assert.equal(w.day.returnFade, undefined);
  assert.equal(departureBoat(w).alpha, 0, 'boat stays faded behind the offload receipt');
  assert.equal(w.day.offloaded, 100);
  assert.equal(w.career.cash, immediate.career.cash);
  assert.equal(w.boat.fuel, immediate.boat.fuel);
  assert.equal(w.day.minute, immediate.day.minute);
  const settled = encode(w);
  tick(w, 5);
  assert.equal(encode(w), settled);
});
test('departure accepts only the designated boundary with both divers aboard; day zero stays enclosed', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  for (const [edge, x, y] of [
    ['north', 250, 0],
    ['south', 250, w.terrain.size],
    ['east', w.terrain.size, 250],
    ['west', 0, 250],
  ]) {
    w.day.returnExit.edge = edge;
    Object.assign(w.boat, { x: 250, y: 250 });
    assert(!beginDeparture(w));
    Object.assign(w.boat, { x, y });
    w.divers[0].state = 'surface';
    assert(!beginDeparture(w));
    w.divers[0].state = 'ready';
    assert(beginDeparture(w));
    delete w.day.returnFade;
  }
  w.day.phase = 'practice';
  assert(!beginDeparture(w));
});
