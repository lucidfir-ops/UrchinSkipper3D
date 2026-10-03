import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { pickupTolerance, setPreset } from '../src/assists.js';
import { swimToPickupWater, pickupWater } from '../src/diver-escape.js';
import { recoveryStatus } from '../src/diver-recovery.js';
import { depthAt } from '../src/terrain.js';
import { step } from '../src/simulation.js';

function shoal(w) {
  // A wet 1 m shelf beside 12 m water; the boat can wait east of its edge.
  // Reapply the same isolated terrain after reload, as terrain is authored data.
  w.terrain = {
    size: 120,
    spacing: 1,
    depths: Array.from({ length: 121 * 121 }, (_, i) => (i % 121 < 60 ? 1 : 12)),
    patches: [],
  };
  w.patches = [];
  w.logs = [];
  w.rocks = [];
  w.debris = [];
  w.environment = {
    model: 'uniform',
    seaLevel: 0,
    current: { x: 0, y: 0 },
    wind: { x: 0, y: 0 },
    waves: 0,
  };
  return w;
}
function fixture(difficulty = 'realistic', night = false, lights = false) {
  const w = careerWorld();
  w.career.difficulty = difficulty;
  setPreset(w, difficulty);
  w.career.trafficSettings = { rate: 0 };
  assert(chooseGround(w, 'near').ok);
  shoal(w);
  w.day.minute = night ? 1200 : 600;
  w.weather = { ...w.weather, night };
  if (lights) w.career.fleet[w.boat.configuration].equipment.push('lights');
  Object.assign(w.boat, {
    x: 62,
    y: 60,
    heading: 0,
    vx: 0,
    vy: 0,
    turn: 0,
    throttle: 0,
    rudder: 0,
  });
  Object.assign(w.divers[0], {
    x: 56,
    y: 60,
    state: 'surface',
    condition: 'fit',
    bag: 30,
    qualitySum: 24,
    bagHandled: false,
  });
  return w;
}
function tick(w, seconds, actions = {}, tolerance = pickupTolerance(w, true)) {
  for (let n = 0; n < Math.round(seconds * 60); n++)
    step(w, n === 0 ? actions : {}, 1 / 60, { tolerance });
}

test('actual Realistic pickup rejection lets the stranded diver swim into recoverable range', () => {
  const w = fixture(),
    d = w.divers[0],
    tolerance = pickupTolerance(w, true);
  assert.equal(tolerance, 2);
  assert.equal(recoveryStatus(w, tolerance, d).reason, 'OUT OF RANGE');
  assert(recoveryStatus(w, undefined, d).available, 'the old 5 m gate incorrectly stopped escape');
  assert(!pickupWater(w, d));
  tick(w, 1, { recoverDiver: true, recoverDiverId: d.id });
  assert(w.events.some((event) => event.includes('RECOVERY REJECTED — OUT OF RANGE')));
  assert(d.x > 56.2 && d.x < 56.4, 'escape is a slow physical swim, not a teleport');
  for (let n = 0; n < 20 && !recoveryStatus(w, tolerance, d).available; n++) tick(w, 1);
  assert(recoveryStatus(w, tolerance, d).available);
  assert.equal(d.state, 'surface');
  assert.equal(d.bag, 30);
  assert(depthAt(w, d.x, d.y) > 0);
});

test('escape follows the authoritative simulation tolerance even when an assist setting differs', () => {
  const w = fixture('easy'),
    d = w.divers[0];
  assert.equal(pickupTolerance(w, false), 5);
  tick(w, 1, {}, 2);
  assert(d.x > 56.2, 'stepDiver must forward its actual recovery gate to escape swimming');
});

test('standalone escape uses difficulty and unlit-night ranges while Easy and work lights retain pickup', () => {
  for (const [difficulty, night, lights, expected, swims] of [
    ['realistic', false, false, 2, true],
    ['easy', false, false, 5, false],
    ['realistic', true, false, 1.24, true],
    ['easy', true, false, 3.1, true],
    ['easy', true, true, 5, false],
  ]) {
    const w = fixture(difficulty, night, lights),
      d = w.divers[0];
    assert.equal(pickupTolerance(w, difficulty === 'realistic'), expected);
    swimToPickupWater(w, d, 0.1);
    assert.equal(d.x > 56, swims, `${difficulty}, night=${night}, lights=${lights}`);
    assert.equal(d.swimmingClear, swims);
  }
});

test('valid pickup, ongoing deck work and injury still stop autonomous shoal swimming', () => {
  for (const mode of ['valid', 'ongoing', 'injured']) {
    const w = fixture(),
      d = w.divers[0];
    d.escapeRoute = [{ x: 68, y: 60 }];
    d.swimmingClear = true;
    if (mode === 'valid') d.x = 58.1;
    if (mode === 'ongoing') {
      d.hooking = true;
      d.recoveryAction = 'recoverDiver';
      d.hook = 1;
    }
    if (mode === 'injured') d.condition = 'injured';
    const x = d.x;
    assert(!pickupWater(w, d));
    assert.equal(recoveryStatus(w, 2, d).available, mode === 'valid');
    swimToPickupWater(w, d, 1, 2);
    assert.equal(d.x, x, mode);
    assert.equal(d.escapeRoute, null);
    assert.equal(d.swimmingClear, false);
    assert.equal(d.bag, 30);
    if (mode === 'ongoing') assert.equal(d.hook, 1);
  }
});

test('reload preserves the escape route and real boarding lands the stranded partial bag once', () => {
  let w = fixture();
  tick(w, 3);
  const before = structuredClone(w.divers[0]);
  assert(before.x > 56 && before.x < 58);
  assert(before.escapeRoute.length);
  w = shoal(decode(encode(w)));
  let d = w.divers[0];
  assert.equal(d.x, before.x);
  assert.deepEqual(d.escapeRoute, before.escapeRoute);
  assert.equal(pickupTolerance(w, true), 2);
  for (let n = 0; n < 20 && !recoveryStatus(w, 2, d).available; n++) tick(w, 1);
  assert(recoveryStatus(w, 2, d).available);
  tick(w, 1, { recoverDiver: true });
  assert(d.hooking);
  assert.equal(w.catch, 0);
  w = shoal(decode(encode(w)));
  d = w.divers[0];
  tick(w, 8);
  assert.equal(d.state, 'ready');
  assert.equal(d.bag, 0);
  assert.equal(w.catch, 30);
  assert.equal(w.bags.length, 1);
  assert.equal(w.bags[0].quality, 0.8);
  tick(w, 5);
  assert.equal(w.catch, 30);
  assert.equal(w.bags.length, 1);
});
