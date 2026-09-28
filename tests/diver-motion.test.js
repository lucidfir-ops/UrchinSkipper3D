import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, depthAt } from '../src/world.js';
import { step } from '../src/simulation.js';
import {
  diverMotion,
  diverDepth,
  diveTransit,
  portRecoveryPoint,
  atRecoveryLadder,
  DIVER_MOTION,
} from '../src/diver-motion.js';
import { diverVisual, playState } from '../src/presentation.js';
import { deploymentStatus, recoveryDuration, recoveryStatus } from '../src/diver-recovery.js';
import { careerWorld, encode, decode, snapshot } from '../src/career-save.js';
import { createCareer } from '../src/career-state.js';
import { chooseGround } from '../src/day.js';
import { validateSnapshot } from '../src/save-validation.js';
import { exposureClock, newDiveHealth, stepDiveExposure } from '../src/dive-exposure.js';
import { collectFeedback } from '../src/screen-feedback.js';

const frame = 1 / 60;
function fixture(depth = 21, world = createWorld({ practice: true })) {
  world.terrain.depths = world.terrain.depths.slice().fill(depth);
  world.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  world.logs = [];
  world.debris = [];
  if (world.career) world.career.trafficSettings = { rate: 0 };
  Object.assign(world.boat, { x: 232, y: 238, heading: 0, vx: 0, vy: 0, turn: 0 });
  return world;
}
function tick(w, seconds) {
  for (let i = 0; i < seconds * 60; i++) step(w, {}, frame);
}

test('deployment prepares on deck, steps off the rail, then descends before any bottom work', () => {
  const w = fixture(),
    d = w.diver;
  step(w, { recoverDiver: true }, frame);
  assert.equal(diverMotion(w, d).phase, 'preparing');
  assert.equal(diverVisual(d).bubbles, false);
  assert.equal(
    w.effects.some((effect) => effect.type === 'splash'),
    false,
  );
  assert.equal(d.bag, 0);
  tick(w, 1);
  assert.equal(diverMotion(w, d).phase, 'entering');
  assert.equal(diverDepth(w, d), 0);
  tick(w, 0.5);
  assert.equal(diverMotion(w, d).phase, 'descending');
  assert(diverDepth(w, d) > 0);
  assert.equal(diverVisual(d).bubbles, true);
  assert.equal(d.searchTime, 0);
  assert.equal(d.harvestTime, 0);
  const depth = diverDepth(w, d);
  tick(w, 0.5);
  assert(diverDepth(w, d) > depth);
  tick(w, d.timer + frame);
  assert(['searching', 'harvesting'].includes(d.state));
  assert.equal(w.effects.filter((effect) => effect.type === 'splash').length, 1);
});

test('descent time responds to the real water column and preparation follows the moving deck', () => {
  const shallow = fixture(10),
    deep = fixture(30);
  const a = diveTransit(shallow, shallow.diver),
    b = diveTransit(deep, deep.diver);
  assert(Math.abs(b.total - a.total - 2) < 0.001);
  step(shallow, { recoverDiver: true }, frame);
  const before = diverMotion(shallow, shallow.diver);
  shallow.boat.x += 2;
  step(shallow, {}, frame);
  const after = diverMotion(shallow, shallow.diver);
  assert(Math.abs(after.x - before.x - 2) < 0.01);
  assert.equal(after.phase, 'preparing');
  const oldDuration = shallow.diver.transit.total;
  shallow.terrain.depths.fill(30);
  step(shallow, {}, frame);
  assert(Math.abs(shallow.diver.transit.total - oldDuration - 2) < 0.001);
  assert.equal(diverMotion(shallow, shallow.diver).phase, 'preparing');
});

test('ascent retains the five-second bubble warning while crossing actual depths', () => {
  const w = fixture(12),
    d = w.diver;
  Object.assign(d, { state: 'searching', x: 228, y: 238, air: 20.001 });
  step(w, {}, frame);
  assert.equal(d.state, 'surfacing');
  const start = diverDepth(w, d);
  tick(w, 2.5);
  assert(Math.abs(diverDepth(w, d) - start / 2) < 0.01);
  tick(w, 2.3);
  assert.equal(d.state, 'surfacing');
  assert(diverDepth(w, d) < 0.5);
  tick(w, 0.3);
  assert.equal(d.state, 'surface');
  assert.equal(diverMotion(w, d).phase, 'waiting');
  assert.equal(diverDepth(w, d), 0);
});

test('a requested recovery swims to the physical port ladder then climbs without extra delay or double catch', () => {
  const w = fixture(),
    d = w.diver;
  Object.assign(d, { state: 'surface', x: 226, y: 236, bag: 100, qualitySum: 80 });
  assert(recoveryStatus(w, 5, d).available);
  const ladder = portRecoveryPoint(w),
    start = Math.hypot(d.x - ladder.x, d.y - ladder.y);
  step(w, { recoverDiver: true }, frame);
  tick(w, 0.8);
  assert(Math.hypot(d.x - ladder.x, d.y - ladder.y) < start - 1.8);
  assert.equal(w.catch, 0);
  tick(w, recoveryDuration(d) - d.hook - 0.4);
  const pose = diverMotion(w, d);
  assert.equal(pose.phase, 'boarding');
  assert(pose.height > -0.8 && pose.height < 0.9);
  assert.equal(d.state, 'surface');
  assert.equal(w.catch, 0);
  tick(w, 0.45);
  assert.equal(d.state, 'ready');
  assert.equal(diverMotion(w, d).phase, 'stowing');
  assert(diverMotion(w, d).aboard);
  assert.equal(w.catch, 100);
  assert.equal(w.bags.length, 1);
  tick(w, 3);
  assert.equal(diverMotion(w, d).phase, 'aboard');
  assert.equal(w.catch, 100);
  assert.equal(w.divers[1].state, 'ready');
});

test('invalid approach never tows the diver and neutral retains underwater information entitlement', () => {
  const w = fixture(),
    d = w.diver;
  Object.assign(d, { state: 'surface', x: 227, y: 238, bag: 100, qualitySum: 80 });
  step(w, { recoverDiver: true }, frame);
  tick(w, 0.3);
  const before = { x: d.x, y: d.y, hook: d.hook };
  w.boat.x += 12;
  step(w, {}, frame);
  assert.equal(d.hook, before.hook);
  assert(Math.hypot(d.x - before.x, d.y - before.y) < 0.01);
  assert.equal(diverMotion(w, d).phase, 'approaching');
  Object.assign(d, { state: 'harvesting', hooking: false, hook: 0 });
  w.boat.throttle = 0;
  assert(playState(w, '', 5, d, false).status.includes('WORKING UNDERWATER'));
  assert.equal(playState(w, '', 2, d, true).observable, false);
});

test('transit records survive genuine career serialization and malformed poses are rejected', () => {
  const w = careerWorld(createCareer(8124));
  chooseGround(w, 'near');
  fixture(21, w);
  step(w, { recoverDiver: true }, frame);
  tick(w, 1.5);
  const next = decode(encode(w));
  assert.deepEqual(next.diver.transit, w.diver.transit);
  assert.equal(next.diver.timer, w.diver.timer);
  assert.equal(diverMotion(next, next.diver).phase, 'descending');
  assert.equal(next.diver.bag, 0);
  const invalid = snapshot(w);
  invalid.divers[0].transit.total = -1;
  assert.throws(() => validateSnapshot(invalid), /transit/);
  Object.assign(w.diver, { state: 'ready', transit: null, deckWalkStarted: w.time });
  const aboard = decode(encode(w));
  assert.equal(diverMotion(aboard, aboard.diver).phase, 'stowing');
  assert(deploymentStatus(w, w.diver).available, 'stowing never locks the deploy command');
  const atRail = diverMotion(w, w.diver);
  step(w, { recoverDiver: true }, frame);
  const preparing = diverMotion(w, w.diver);
  assert.equal(preparing.phase, 'preparing');
  assert(Math.hypot(preparing.x - atRail.x, preparing.y - atRail.y) < 0.1);
});

test('deck preparation recovers exposure, actual descent adds it, and old unspecific deployment keeps surface recovery', () => {
  const w = careerWorld(createCareer(8124));
  chooseGround(w, 'near');
  fixture(21, w);
  const d = w.diver,
    health = newDiveHealth(w.career, d.crewId, exposureClock(w));
  health.load = 0.4;
  w.career.people[d.crewId].diveHealth = health;
  d.state = 'deploying';
  d.transit = diveTransit(w, d);
  d.timer = d.transit.total;
  w.day.minute += 0.5;
  stepDiveExposure(w, d, 1);
  assert(health.load < 0.4);
  const prepared = health.load;
  d.timer = 0.5;
  w.day.minute += 0.5;
  stepDiveExposure(w, d, 1);
  assert(health.load > prepared);
  const submerged = health.load;
  delete d.transit;
  w.day.minute += 0.5;
  stepDiveExposure(w, d, 1);
  assert(health.load < submerged);
});

test('a completed boarding notice cannot contradict the same diver returning to the water', () => {
  const w = fixture(),
    notice = {
      text: `${w.diver.name.toUpperCase()} · DIVER ABOARD — FRESH TANK / READY TO REDEPLOY`,
      urgent: false,
      until: performance.now() + 12000,
    },
    ui = {
      importantNotice: notice,
      messages: [],
      notify() {},
      lastBuckets: { throttle: 0, rudder: 0 },
      actionDisplay: { hidden: true },
      feedback: false,
    };
  collectFeedback.call(ui, w, {});
  assert.equal(ui.importantNotice, notice);
  w.diver.state = 'deploying';
  collectFeedback.call(ui, w, {});
  assert.equal(ui.importantNotice, null);
  ui.importantNotice = {
    ...notice,
    urgent: true,
    text: `${w.diver.name.toUpperCase()} · INJURED DIVER ABOARD — RETURN FOR MEDICAL HELP`,
  };
  collectFeedback.call(ui, w, {});
  assert(
    ui.importantNotice.urgent,
    'medical warnings must not be suppressed by ordinary phase changes',
  );
});

test('a far empty-bag pickup must reach the physical ladder before its climbing clock runs', () => {
  const w = fixture(30),
    d = w.diver;
  Object.assign(w.boat, { x: 250, y: 250 });
  Object.assign(d, { state: 'surface', x: 245, y: 242, bagHandled: true, bag: 0, air: 60 });
  assert(recoveryStatus(w, 5, d).available);
  step(w, { recoverDiver: true }, frame);
  tick(w, 2.35);
  assert.equal(d.state, 'surface');
  assert.equal(diverMotion(w, d).phase, 'approaching');
  assert.equal(diverMotion(w, d).height, DIVER_MOTION.surfaceFeet);
  assert(Math.abs(d.hook - (recoveryDuration(d) - DIVER_MOTION.climbSeconds)) < 1e-8);
  let reached = false;
  for (let i = 0; i < 300 && d.state !== 'ready'; i++) {
    const pose = diverMotion(w, d);
    if (pose.phase === 'boarding') {
      reached = true;
      assert(atRecoveryLadder(w, d));
    }
    step(w, {}, frame);
  }
  assert(reached);
  assert.equal(d.state, 'ready');
  assert.equal(w.catch, 0);
  assert.equal(w.bags.length, 0);
});

test('nightfall keeps a preparing diver aboard but lets committed entry finish before ascent', () => {
  const preparing = fixture(30);
  step(preparing, { recoverDiver: true }, frame);
  assert(diverMotion(preparing, preparing.diver).aboard);
  preparing.weather = { night: true };
  step(preparing, {}, frame);
  assert.equal(preparing.diver.state, 'ready');
  assert.equal(diverMotion(preparing, preparing.diver).height, DIVER_MOTION.deckFeet);
  assert.equal(
    preparing.effects.filter((effect) => ['splash', 'warning'].includes(effect.type)).length,
    0,
  );
  assert.match(preparing.message, /DIVER REMAINS ABOARD/);
  const entering = fixture(30);
  step(entering, { recoverDiver: true }, frame);
  tick(entering, 1);
  assert.equal(diverMotion(entering, entering.diver).phase, 'entering');
  const before = diverMotion(entering, entering.diver).height;
  entering.weather = { night: true };
  step(entering, {}, frame);
  assert.equal(diverMotion(entering, entering.diver).phase, 'entering');
  assert(Math.abs(diverMotion(entering, entering.diver).height - before) < 0.3);
  tick(entering, 0.35);
  assert.equal(entering.diver.state, 'surfacing');
  assert.match(entering.diver.reason, /Darkness/);
  assert.equal(entering.diver.bag, 0);
});

test('descent carried over a steep wet slope reaches the local bottom without a state-boundary jump', () => {
  const w = fixture(30),
    d = w.diver,
    n = Math.round(w.terrain.size / w.terrain.spacing) + 1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      w.terrain.depths[y * n + x] =
        5 + Math.max(0, Math.min(1, (x * w.terrain.spacing - 247) / 3)) * 30;
  Object.assign(w.boat, { x: 250, y: 250 });
  w.environment.current = { x: 2, y: 0 };
  step(w, { recoverDiver: true }, frame);
  let previous = diverDepth(w, d),
    lastDeploying = null;
  for (let i = 0; i < 600 && d.state === 'deploying'; i++) {
    lastDeploying = { depth: diverDepth(w, d), x: d.x, timer: d.timer };
    step(w, {}, frame);
    const depth = diverDepth(w, d);
    assert(Math.abs(depth - previous) < 1, `unphysical frame jump: ${previous} → ${depth}`);
    previous = depth;
  }
  assert.equal(d.state, 'searching');
  assert(
    lastDeploying.depth > 15,
    'the diver must actually follow the deeper slope during descent',
  );
  assert(
    Math.abs(diverDepth(w, d) - Math.max(0, depthAt(w, d.x, d.y) + DIVER_MOTION.surfaceFeet)) <
      0.001,
  );
});
