import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C } from '../src/config.js';
import { createWorld } from '../src/world.js';
import { step } from '../src/simulation.js';
import { fitBoat, boatSpec } from '../src/boats.js';
function calm(id = 'basic') {
  const w = createWorld({ boatId: id });
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  w.debris = [];
  Object.assign(w.environment, { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 });
  Object.assign(w.boat, { vx: 0, vy: 0 });
  assert(fitBoat(w, id).ok);
  w.day.phase = 'practice';
  return w;
}
function tick(w, t, a = {}) {
  for (let i = 0; i < Math.round(t * 60); i++) step(w, a, 1 / 60);
}
test('basic package preserves every confirmed baseline helm parameter', () => {
  assert.deepEqual(boatSpec(calm()), C.boat);
});
test('bow thruster pushes the bow and turns from rest; released control does not latch', () => {
  const w = calm('thruster');
  tick(w, 5, { thruster: 1 });
  assert(w.boat.heading > 0.22 && w.boat.heading < 0.28, 'September 25 gentler bow thrust');
  assert(w.boat.x > 251);
  assert(w.boat.y < 251);
  const turn = w.boat.turn;
  tick(w, 3);
  assert.equal(w.boat.thruster, 0);
  assert(Math.abs(w.boat.turn) < Math.abs(turn) * 0.1);
  const base = calm();
  tick(base, 5, { thruster: 1 });
  assert.equal(base.boat.heading, 0);
  assert.equal(base.boat.x, 250);
});
test('steerable drives turn obviously tighter at low thrust and retain useful reverse steering', () => {
  const base = calm();
  Object.assign(base.boat, { throttle: 0.18, rudder: 1 });
  tick(base, 10);
  for (const id of ['sterndrive', 'outboard', 'jet']) {
    const w = calm(id);
    Object.assign(w.boat, { throttle: 0.18, rudder: 1 });
    tick(w, 10);
    assert(w.boat.heading > base.boat.heading * 8, id);
    assert(w.boat.heading > 1, id);
    const reverse = calm(id);
    Object.assign(reverse.boat, { throttle: -0.3, rudder: 1 });
    tick(reverse, 6);
    assert(reverse.boat.heading < -0.9, id + ' reverse');
  }
});
test('bow thrust still adds useful turning authority at modest ahead speed', () => {
  const withThrust = calm('thruster'),
    without = calm('thruster');
  for (const w of [withThrust, without]) Object.assign(w.boat, { throttle: 0.3, vy: -1.7 });
  tick(withThrust, 3, { thruster: 1 });
  tick(without, 3);
  assert(withThrust.boat.heading > without.boat.heading + 0.11);
  assert(Math.abs(withThrust.boat.heading) < 0.7);
});
test('single stern jet sweeps a wider circle; twin jets pivot with opposed thrust', () => {
  const single = calm('jet'),
    twin = calm('twinjet');
  tick(single, 6, { pivot: 1 });
  tick(twin, 6, { pivot: 1 });
  assert(single.boat.heading > 0.7 && single.boat.heading < twin.boat.heading);
  assert(Math.hypot(single.boat.x - 250, single.boat.y - 250) > 0.5);
  assert(twin.boat.heading > 2);
  assert(Math.hypot(twin.boat.x - 250, twin.boat.y - 250) < 0.01);
  assert(twin.costs.fuel > 0);
});
test('jets can cross a 1.2 m shallow passage that grounds conventional boats', () => {
  for (const id of ['basic', 'sterndrive', 'outboard', 'jet', 'twinjet']) {
    const w = calm(id);
    w.terrain.depths = w.terrain.depths.slice().fill(1.2);
    w.boat.throttle = 0.3;
    tick(w, 8);
    assert.equal(w.boat.grounded, !id.includes('jet'), id);
    if (id.includes('jet')) assert(w.boat.speed > 1, id);
  }
});
test('boatyard fits before departure and rejects every mid-day refit without changing the boat', () => {
  const w = createWorld();
  Object.assign(w.boat, { vx: 0, vy: 0 });
  assert(fitBoat(w, 'jet').ok);
  assert.equal(w.boat.configuration, 'jet');
  assert(!w.day.assisted);
  w.day.phase = 'practice';
  const before = JSON.stringify(w);
  assert(!fitBoat(w, 'twinjet').ok);
  assert.equal(JSON.stringify(w), before);
});
test('twin jet reaches 15 knots in open water and keeps its existing stationary pivot', () => {
  const w = calm('twinjet');
  w.terrain.size = 500;
  w.boat.throttle = 1;
  tick(w, 23);
  assert(Math.abs(w.boat.speed * C.knotsPerMps - 15) < 0.2);
});
test('outboard operation costs substantially more while using the same session accounting', () => {
  const base = calm(),
    out = calm('outboard');
  for (const w of [base, out]) {
    w.boat.throttle = 0.5;
    tick(w, 10);
  }
  assert(out.costs.fuel > base.costs.fuel * 2);
  assert(out.boat.fuelUsed > base.boat.fuelUsed * 2);
});
