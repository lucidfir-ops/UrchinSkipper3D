import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, depthAt, currentAt, driftSurface, bedDepthAt } from '../src/world.js';
import { chooseGround } from '../src/day.js';
import { sampleCurve, updateEnvironment } from '../src/environment.js';
import { hullDepth } from '../src/boat.js';
import { step } from '../src/simulation.js';
import { C } from '../src/config.js';
import { authorFlow } from '../scripts/world/current-field.js';

const sector = (id) => {
  const w = createWorld();
  chooseGround(w, id);
  w.debris = [];
  return w;
};
const magnitude = (c) => Math.hypot(c.x, c.y);
test('all spatial currents are finite, bounded and dry cells have no surface flow', () => {
  for (const id of ['near', 'middle', 'far']) {
    const w = sector(id);
    let minimum = Infinity,
      maximum = 0;
    for (let y = 0; y <= 600; y += 12)
      for (let x = 0; x <= 600; x += 12) {
        const c = currentAt(w, x, y),
          speed = magnitude(c);
        assert(Number.isFinite(speed));
        assert(speed <= C.environment.maxCurrent + 1e-9);
        if (depthAt(w, x, y) <= 0) assert.equal(speed, 0);
        else if (depthAt(w, x, y) > 3) {
          minimum = Math.min(minimum, speed);
          maximum = Math.max(maximum, speed);
        }
      }
    assert(maximum > minimum + 0.03, `${id} must contain visibly different local currents`);
  }
});
test('island field splits incoming flow, accelerates a channel, and shelters its lee', () => {
  const terrain = { size: 500, spacing: 5, depths: Array(101 * 101).fill(20) };
  const recipe = {
    flow: { x: 0, y: -0.5 },
    islands: [{ x: 250, y: 250, rx: 50, ry: 50 }],
    shelters: [],
    eddies: [],
    channels: [],
  };
  const left = authorFlow(recipe, terrain, 210, 320),
    right = authorFlow(recipe, terrain, 290, 320);
  assert(left.x < -0.1 && right.x > 0.1);
  assert(left.y < 0 && right.y < 0);
  assert(magnitude(authorFlow(recipe, terrain, 250, 170)) < 0.15);
  const free = authorFlow({ ...recipe, islands: [] }, terrain, 100, 100);
  const channel = authorFlow(
    {
      ...recipe,
      islands: [],
      channels: [{ a: { x: 100, y: 200 }, b: { x: 100, y: 0 }, width: 20, gain: 0.7 }],
    },
    terrain,
    100,
    100,
  );
  assert(magnitude(channel) > magnitude(free) * 2);
});
test('ebb, slack and flood are separate from tide height; sheltered water lags the main flow', () => {
  const w = sector('middle'),
    at = (minute, x = 310, y = 270) => {
      w.day.minute = minute;
      updateEnvironment(w);
      return currentAt(w, x, y);
    };
  const flood = at(590),
    ebb = at(590 + 372.5),
    slack = at(590 + 186.25);
  assert(flood.x * ebb.x + flood.y * ebb.y < 0, 'flow reverses');
  assert(magnitude(slack) < magnitude(flood) * 0.2, 'near slack in main channel');
  at(675);
  assert(Math.abs(w.environment.flow) > 0.4, 'high water is not forced to be slack');
  const shelter = at(776.25, 245, 432);
  assert(magnitude(shelter) > 0.004, 'residual/lagged eddy survives main-channel slack');
});
test('separated surfaced divers drift differently and each samples its own current', () => {
  const w = sector('near');
  w.day.minute = 600;
  updateEnvironment(w);
  const positions = [
      { x: 300, y: 350 },
      { x: 208, y: 239 },
    ],
    starts = [];
  for (const [i, d] of w.divers.entries()) {
    Object.assign(d, { ...positions[i], state: 'surface' });
    starts.push({ x: d.x, y: d.y, c: currentAt(w, d.x, d.y) });
  }
  assert(magnitude({ x: starts[0].c.x - starts[1].c.x, y: starts[0].c.y - starts[1].c.y }) > 0.018);
  for (let i = 0; i < 600; i++) step(w, {}, 1 / 60);
  const movements = w.divers.map((d, i) => Math.hypot(d.x - starts[i].x, d.y - starts[i].y));
  assert(
    Math.abs(movements[0] - movements[1]) > 0.12,
    'ten seconds gives visibly different displacement',
  );
});
test('all depth readers use the same sea level and a rising tide can refloat a hull', () => {
  const w = createWorld({ practice: true });
  w.debris = [];
  w.terrain.depths = w.terrain.depths.slice().fill(1.5);
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0, seaLevel: 0 };
  Object.assign(w.boat, { vx: 0, vy: 0 });
  step(w, {}, 1 / 60);
  assert(w.boat.grounded);
  assert.equal(depthAt(w, 250, 250), 1.5);
  w.environment.seaLevel = 1;
  assert.equal(depthAt(w, 250, 250), 2.5);
  assert.equal(hullDepth(w), 2.5);
  assert.equal(bedDepthAt(w.terrain, 250, 250), 1.5, 'tide never rewrites source depths');
  step(w, {}, 1 / 60);
  assert(!w.boat.grounded);
  w.terrain.depths = w.terrain.depths.slice().fill(-0.4);
  assert(depthAt(w, 250, 250) > 0);
  w.environment.seaLevel = 0;
  assert(depthAt(w, 250, 250) < 0);
});
test('the authored South Reef saddle is navigable at high water and grounds a hull at low water', () => {
  const w = sector('middle');
  Object.assign(w.boat, { x: 321, y: 368, heading: 0, vx: 0, vy: 0, throttle: 0, rudder: 0 });
  w.day.minute = 600;
  updateEnvironment(w);
  assert(hullDepth(w) > C.boat.draft + C.boat.groundingRelease);
  step(w, {}, 1 / 60);
  assert(!w.boat.grounded);
  w.day.minute = 1050;
  updateEnvironment(w);
  assert(hullDepth(w) < C.boat.draft);
  step(w, {}, 1 / 60);
  assert(w.boat.grounded);
});
test('height and velocity support independent sampled station curves', () => {
  const curve = {
    samples: [
      { minute: 0, value: -0.5 },
      { minute: 60, value: 1.5 },
      { minute: 120, value: -0.5 },
    ],
    periodMinutes: 120,
  };
  assert.equal(sampleCurve(curve, 30), 0.5);
  assert.equal(sampleCurve(curve, 150), 0.5);
  assert.equal(sampleCurve(curve, -30), 0.5);
  assert.equal(
    sampleCurve(
      {
        samples: [
          { minute: 10, value: 2 },
          { minute: 20, value: 4 },
        ],
      },
      40,
    ),
    4,
  );
});
test('surface drift cannot tunnel through a narrow exposed strip', () => {
  const w = createWorld({ practice: true });
  w.terrain.depths = w.terrain.depths.slice().fill(5);
  w.environment.current = { x: 4, y: 0 };
  const n = w.terrain.size / w.terrain.spacing + 1;
  for (let y = 0; y < n; y++) w.terrain.depths[y * n + 100] = -4;
  const object = { x: 240, y: 250 };
  driftSurface(w, object, 8);
  assert(object.x < 250);
  assert(depthAt(w, object.x, object.y) > 0);
});
test('residual eddy field can converge drifting objects without a hidden teleport or magnet', () => {
  const terrain = { size: 500, spacing: 5, depths: Array(101 * 101).fill(20) },
    recipe = {
      flow: { x: 0, y: -0.5 },
      islands: [],
      shelters: [],
      channels: [],
      eddies: [{ x: 250, y: 250, radius: 60, spin: 0.3, convergence: 0.1 }],
    };
  for (const p of [
    { x: 230, y: 250 },
    { x: 270, y: 250 },
    { x: 250, y: 230 },
    { x: 250, y: 270 },
  ]) {
    const c = authorFlow(recipe, terrain, p.x, p.y, 1, true);
    assert(c.x * (p.x - 250) + c.y * (p.y - 250) < 0);
  }
});
