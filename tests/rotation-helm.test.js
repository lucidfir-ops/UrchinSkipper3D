import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld } from '../src/career-save.js';
import { freshVessel, useVessel } from '../src/career-state.js';
import { stepBoat } from '../src/boat.js';
import { boatDefinition } from '../src/boats.js';
import { C } from '../src/config.js';
import { rotationPolicy } from '../src/rotation-policy.js';

function sea(id = 'thruster', current = 0.6, drift = 0.5) {
  const w = careerWorld();
  w.career.fleet[id] = freshVessel(id);
  useVessel(w, id);
  w.terrain.depths = w.terrain.depths.slice().fill(40);
  w.catch = 3300;
  Object.assign(w.environment, {
    current: { x: 0, y: current / C.knotsPerMps },
    wind: { x: 0, y: 0 },
    waves: 0,
  });
  Object.assign(w.boat, { x: 250, y: 250, heading: 0, vy: drift / C.knotsPerMps });
  return w;
}
function advance(w, seconds, input = {}) {
  for (let n = 0; n < seconds * 60; n++) {
    w.time += 1 / 60;
    stepBoat(w, input, 1 / 60);
  }
  return (w.boat.heading * 180) / Math.PI;
}
test('loaded shaft boats visibly answer both rudder directions in light flow near neutral', () => {
  for (const current of [0.6, 0.7])
    for (const rudder of [-1, 1])
      for (const throttle of [-0.01, 0, 0.01]) {
        const w = sea();
        w.environment.current.y = current / C.knotsPerMps;
        Object.assign(w.boat, { rudder, throttle });
        const heading = advance(w, 10) * rudder;
        assert(heading > 5 && heading < 30, JSON.stringify({ current, rudder, throttle, heading }));
      }
});
test('neutral rudder cannot create a turn without relative water flow or a stern appendage', () => {
  for (const id of ['basic', 'thruster', 'sterndrive', 'jet'])
    for (const speed of [0, 0.6]) {
      const w = sea(id, speed, speed);
      w.boat.rudder = 1;
      assert(Math.abs(advance(w, 25)) < 1e-7, id);
    }
  const jet = sea('jet');
  jet.boat.rudder = 1;
  assert.equal(advance(jet, 10), 0);
});
test('powered shaft handling is unchanged by the neutral lift tuning', () => {
  const previous = C.boat.neutralRudderLift;
  try {
    for (const throttle of [-0.3, 0.18, 1]) {
      const tuned = sea(),
        baseline = sea();
      for (const w of [tuned, baseline]) Object.assign(w.boat, { throttle, rudder: 1 });
      const now = advance(tuned, 10);
      C.boat.neutralRudderLift = 0;
      const old = advance(baseline, 10);
      C.boat.neutralRudderLift = previous;
      assert.equal(now, old);
    }
  } finally {
    C.boat.neutralRudderLift = previous;
  }
});
test('bow thrust is gentler than the recorded release and still useful on a loaded hull', () => {
  const spec = boatDefinition('thruster').spec,
    strength = spec.bowThrusterStrength;
  try {
    const w = sea('thruster', 0, 0),
      old = sea('thruster', 0, 0);
    const turn = advance(w, 5, { thruster: 1 });
    spec.bowThrusterStrength = 1.65;
    const oldTurn = advance(old, 5, { thruster: 1 });
    assert(turn > 10 && turn < oldTurn * 0.9, JSON.stringify({ turn, oldTurn }));
    assert(turn > oldTurn * 0.65);
    assert(w.boat.x > 250.5);
  } finally {
    spec.bowThrusterStrength = strength;
  }
});
test('rotation requests any orientation and keeps it through repeated viewport notifications', async () => {
  let mode = 'landscape',
    calls = 0;
  const policy = rotationPolicy({
    async lock(value) {
      calls++;
      mode = value;
    },
    unlock() {
      mode = 'landscape';
    },
  });
  await Promise.all([policy.apply(), policy.apply(), policy.apply()]);
  await policy.apply();
  assert.equal(mode, 'any');
  assert.equal(calls, 1);
});
test('a rejected orientation request falls back safely and retries after fullscreen permission', async () => {
  let fullscreen = false,
    mode = 'landscape',
    unlocked = 0;
  const policy = rotationPolicy({
    async lock(value) {
      if (!fullscreen)
        throw Object.assign(new Error('fullscreen required'), { name: 'SecurityError' });
      mode = value;
    },
    unlock() {
      unlocked++;
    },
  });
  assert.equal(await policy.apply(), false);
  assert.equal(unlocked, 1);
  fullscreen = true;
  policy.invalidate();
  assert.equal(await policy.apply(), true);
  assert.equal(mode, 'any');
  assert.equal(unlocked, 1);
});
test('a stale rejected orientation request cannot unlock a newer fullscreen context', async () => {
  let reject,
    unlocked = 0;
  const orientation = {
    lock: () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
    unlock: () => {
      unlocked++;
    },
  };
  const policy = rotationPolicy(orientation),
    request = policy.apply();
  policy.invalidate();
  reject(new Error('old frame'));
  await request;
  assert.equal(unlocked, 0);
  orientation.lock = async () => {};
  assert.equal(await policy.apply(), true);
});
test('browsers without orientation lock or unlock remain usable', async () => {
  assert.equal(await rotationPolicy(undefined).apply(), false);
  const reports = [];
  const policy = rotationPolicy(
    {
      unlock() {
        throw new Error('unsupported');
      },
    },
    (r) => reports.push(r),
  );
  assert.equal(await policy.apply(), false);
  assert.deepEqual(reports, [{ operation: 'unlock', result: 'Error' }]);
});
