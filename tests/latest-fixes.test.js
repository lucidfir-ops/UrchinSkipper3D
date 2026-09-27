import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C } from '../src/config.js';
import { createWorld, currentAt, depthAt } from '../src/world.js';
import { step } from '../src/simulation.js';
import { diverSlip, driftUnderwater } from '../src/diver-current.js';
import { chooseGround } from '../src/day.js';
import { updateEnvironment } from '../src/environment.js';
import { forecast } from '../src/almanac.js';
import { RECIPES } from '../world-source/sectors.js';
function calm(id = 'twinjet') {
  const w = createWorld({ practice: true, boatId: id });
  w.terrain.depths = w.terrain.depths.slice().fill(20);
  w.debris = [];
  w.logs = [];
  Object.assign(w.environment, { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 });
  Object.assign(w.boat, { vx: 0, vy: 0 });
  return w;
}
const tick = (w, seconds, actions = {}) => {
  for (let i = 0; i < seconds * 60; i++) step(w, actions, 1 / 60);
};
test('dedicated twin-jet pivot overrides latched throttle without changing its setting', () => {
  const w = calm();
  tick(w, 4, { pivot: 1 });
  assert.equal(w.boat.throttle, 0);
  assert(w.boat.heading > 1);
  assert(Math.hypot(w.boat.vx, w.boat.vy) < 1e-8);
  tick(w, 1, { throttle: 1 });
  assert(w.boat.throttle > 0.3);
  for (const throttle of [0.01, 0.4, 1, -0.01, -0.6, -1]) {
    const a = calm(),
      b = calm();
    a.boat.throttle = b.boat.throttle = throttle;
    tick(a, 3, { pivot: 1 });
    tick(b, 3);
    assert.equal(a.boat.pivot, 1);
    assert.equal(a.boat.throttle, throttle);
    assert(a.boat.heading > b.boat.heading + 0.5);
    assert(Math.hypot(a.boat.vx, a.boat.vy) < 0.01);
  }
});
test('explicit ahead/reverse cancels a pivot without erasing translational or angular momentum', () => {
  const w = calm();
  tick(w, 3, { pivot: 1 });
  w.boat.vy = -2;
  const turn = w.boat.turn;
  step(w, { pivot: 1, fullReverse: true }, 1 / 60);
  assert.equal(w.boat.throttle, -1);
  assert.equal(w.boat.pivot, 0);
  assert(w.boat.vy < -1.8);
  assert(w.boat.turn > turn * 0.8);
  step(w, { neutral: true }, 1 / 60);
  assert(w.boat.vy < -1.7);
});
test('both jets run at 1.1 m at any speed, ground at .9 m and refloat at 1.1 m', () => {
  for (const id of ['jet', 'twinjet'])
    for (const speed of [0, 2, 7.7]) {
      const w = calm(id);
      w.terrain.depths = w.terrain.depths.slice().fill(1.1);
      Object.assign(w.boat, { vy: -speed, throttle: 1 });
      tick(w, 3);
      assert(!w.boat.grounded);
      assert.equal(w.boat.hullHealth, 1);
      assert.equal(w.boat.driveHealth, 1);
      w.terrain.depths = w.terrain.depths.slice().fill(0.9);
      step(w, {}, 1 / 60);
      assert(w.boat.grounded);
      assert.equal(w.boat.hullHealth, 1, 'falling flat bed is no collision');
      w.terrain.depths = w.terrain.depths.slice().fill(1.1);
      step(w, {}, 1 / 60);
      assert(!w.boat.grounded);
    }
  const deep = calm('basic');
  deep.terrain.depths = deep.terrain.depths.slice().fill(1.1);
  step(deep, {}, 1 / 60);
  assert(deep.boat.grounded);
});
test('diver station keeping holds through two knots and slips one knot at three', () => {
  for (const knots of [0, 1, 2, 3, 4, 5]) {
    const c = { x: knots / C.knotsPerMps, y: 0 },
      slip = diverSlip(c);
    assert(Math.abs(slip.x * C.knotsPerMps - Math.max(0, knots - 2)) < 1e-8);
    const w = calm();
    w.environment.current = c;
    const d = w.diver;
    d.x = 200;
    d.y = 200;
    driftUnderwater(w, d, 10);
    assert(Math.abs(d.x - 200 - slip.x * 10) < 1e-6);
  }
});
test('strong current leaves a braced working diver picking with conserved stock', () => {
  const w = calm();
  w.environment.current = { x: 3 / C.knotsPerMps, y: 0 };
  const patch = { x: 200, y: 200, radius: 4, remaining: 1000, quality: 0.8, rate: 10 };
  w.patches = [patch];
  Object.assign(w.diver, { state: 'harvesting', x: 200, y: 200, patch, air: 100 });
  tick(w, 15);
  assert.equal(w.diver.state, 'harvesting');
  assert.equal(w.diver.x, 200);
  assert(w.diver.bag > 149 && w.diver.bag < 151);
  assert(Math.abs(w.diver.bag + patch.remaining - 1000) < 1e-7);
});
test('starter peaks stay workable, later channels reach 3–5 knots, and forecasts match live vectors', () => {
  for (const id of ['middle', 'far', 'storm-channel', 'storm-sound']) {
    const w = createWorld();
    chooseGround(w, id);
    w.day.minute = 590;
    updateEnvironment(w);
    let max = 0;
    for (let y = 12; y < 600; y += 12)
      for (let x = 12; x < 600; x += 12)
        if (depthAt(w, x, y) > 2)
          max = Math.max(max, Math.hypot(...Object.values(currentAt(w, x, y))) * C.knotsPerMps);
    assert(
      max >= (id.startsWith('storm') ? 3.5 : 0.42) &&
        max <= (id.startsWith('storm') ? 5.00001 : 0.60001),
      `${id}: ${max}`,
    );
    const f = forecast(w, id);
    assert.deepEqual(f.vector, currentAt(w, f.station.x, f.station.y));
  }
});
test('each sector mixes gentle shores and cliff edges with five-metre water within one grid cell of land', () => {
  for (const recipe of RECIPES) {
    const w = createWorld();
    chooseGround(w, recipe.id);
    const { depths, spacing, size } = w.terrain,
      n = size / spacing + 1;
    let cliffs = 0,
      gentle = 0;
    for (let y = 0; y < n - 1; y++)
      for (let x = 0; x < n - 1; x++)
        for (const delta of [1, n]) {
          const a = depths[y * n + x],
            b = depths[y * n + x + delta],
            lo = Math.min(a, b),
            hi = Math.max(a, b);
          if (lo <= 0 && hi > 0) {
            if (hi >= 4.5) cliffs++;
            if (hi - lo < 2) gentle++;
          }
        }
    assert(cliffs > 2, `${recipe.id}: ${cliffs} cliff cells`);
    assert(gentle > 10);
  }
});
