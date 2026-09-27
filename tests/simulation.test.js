import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, depthAt, currentAt, visiblePatch } from '../src/world.js';
import { step, recoveryStatus, deploymentStatus } from '../src/simulation.js';
import { hullDepth, rudderAuthority } from '../src/boat.js';
import { playState, diverVisual, deckMarkers, terrainColor } from '../src/presentation.js';
import { C } from '../src/config.js';
const frame = 1 / 60;
function tick(w, seconds, a = {}) {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(w, a, frame);
}
function calm(w = createWorld({ practice: true })) {
  Object.assign(w.environment, { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 });
  Object.assign(w.boat, { vx: 0, vy: 0 });
  w.debris = [];
  return w;
}
function deep() {
  const w = calm();
  w.terrain.depths = w.terrain.depths.slice().fill(50);
  return w;
}
function surfaceWorld() {
  const w = calm();
  Object.assign(w.diver, {
    state: 'surface',
    bag: 123,
    qualitySum: 98.4,
    x: w.boat.x - 4,
    y: w.boat.y,
    reason: 'Patch exhausted',
    bagHandled: false,
  });
  return w;
}
function align(w) {
  Object.assign(w.boat, {
    x: w.diver.x + 4,
    y: w.diver.y,
    heading: 0,
    vx: 0,
    vy: 0,
    turn: 0,
    throttle: 0,
    rudder: 0,
  });
}
function until(w, predicate, limit = 120) {
  for (let i = 0; i < limit * 60 && !predicate(); i++) step(w, {}, frame);
  assert(predicate(), 'state reached before timeout');
}
test('saved deterministic 500 m field includes land, hazardous shallows, deep water and varied grounds', () => {
  const w = createWorld({ practice: true });
  assert.deepEqual(w.terrain, createWorld({ practice: true }).terrain);
  assert.equal(w.terrain.size, 500);
  assert(w.terrain.depths.some((d) => d < 0));
  assert(w.terrain.depths.some((d) => d > 0 && d < 2));
  assert(w.terrain.depths.some((d) => d >= 40));
  assert.equal(w.patches, w.terrain.patches);
  assert(w.patches.some((p) => p.rate === 10));
  assert(w.patches.some((p) => p.rate === 5));
  assert(w.patches.some((p) => p.rate === 0));
  for (const p of w.patches) assert(depthAt(w, p.x, p.y) > C.diver.minDepth);
});
test('sounder is a pure point query; surface shading only distinguishes the 0–10 m band', () => {
  const w = createWorld({ practice: true }),
    before = JSON.stringify(w.terrain);
  const { spacing, depths, size } = w.terrain,
    n = size / spacing + 1;
  assert.equal(depthAt(w, 250, 250), depths[100 * n + 100]);
  for (let x = 0; x < 500; x += 0.5) depthAt(w, x, 248);
  assert.equal(JSON.stringify(w.terrain), before);
  assert.deepEqual(terrainColor(10), terrainColor(50));
  assert.notDeepEqual(terrainColor(1), terrainColor(8));
});
test('persistent analog throttle and rudder preserve the controller commands, including crossing neutral', () => {
  const w = deep();
  tick(w, 1, { throttle: 0.5, steer: 0.5 });
  assert(Math.abs(w.boat.throttle - C.boat.throttleRate / 2) < 1e-8);
  assert(Math.abs(w.boat.rudder - C.boat.rudderRate / 2) < 1e-8);
  const { throttle, rudder } = w.boat;
  tick(w, 2);
  assert.equal(w.boat.throttle, throttle);
  assert.equal(w.boat.rudder, rudder);
  tick(w, 3, { throttle: -1, steer: -1 });
  assert(w.boat.throttle < 0);
  assert.equal(w.boat.rudder, -1);
  step(w, { fullAhead: true }, frame);
  assert.equal(w.boat.throttle, 1);
  step(w, { fullReverse: true }, frame);
  assert.equal(w.boat.throttle, -1);
  step(w, { neutral: true }, frame);
  assert.equal(w.boat.throttle, 0);
});
test('Matter thrust reaches about 10 knots ahead and the tuned reverse speed', () => {
  for (const throttle of [1, -1]) {
    const w = deep();
    w.boat.throttle = throttle;
    tick(w, 35);
    assert(
      Math.abs(
        Math.hypot(w.boat.vx, w.boat.vy) - (throttle > 0 ? C.boat.maxSpeed : C.boat.reverseSpeed),
      ) < 0.02,
    );
  }
  assert(Math.abs(C.boat.maxSpeed * C.knotsPerMps - 10) < 0.001);
});
test('lateral water-relative drag is stronger than longitudinal drag and retains some slew', () => {
  const w = deep();
  Object.assign(w.boat, { vx: 1, vy: -1 });
  tick(w, 0.5);
  assert(w.boat.vx > 0.3);
  assert(w.boat.vx < 0.6);
  assert(-w.boat.vy > 0.8);
});
test('rudder has weak low-speed authority, middle sweet spot, wider full-speed turns and weak reverse', () => {
  assert(rudderAuthority(C.boat.maxSpeed * 0.1) < 0.05);
  assert(rudderAuthority(C.boat.maxSpeed * 0.5) > 0.99);
  assert(rudderAuthority(C.boat.maxSpeed) < 0.31);
  assert(rudderAuthority(-C.boat.reverseSpeed) <= 0.15);
  const measurements = [];
  for (const throttle of [0.5, 1, -1]) {
    const w = deep();
    Object.assign(w.boat, {
      throttle,
      vy: -(throttle < 0 ? -C.boat.reverseSpeed : throttle * C.boat.maxSpeed),
      rudder: 1,
    });
    tick(w, 7);
    measurements.push({
      radius: Math.abs(w.boat.speed / w.boat.turn),
      turn: Math.abs(w.boat.turn),
    });
  }
  assert(measurements[1].radius > measurements[0].radius * 2);
  assert(measurements[2].turn < measurements[0].turn * 0.2);
});
test('boat and surfaced diver drift with the same authoritative current; underwater harvester stays on bottom', () => {
  const w = deep();
  w.environment.current = { x: 0.4, y: 0.2 };
  Object.assign(w.boat, { vx: 0.4, vy: 0.2 });
  Object.assign(w.diver, { state: 'surface', x: 240, y: 250 });
  const dx = w.diver.x - w.boat.x,
    dy = w.diver.y - w.boat.y;
  tick(w, 10);
  assert(Math.abs(w.diver.x - w.boat.x - dx) < 1e-7);
  assert(Math.abs(w.diver.y - w.boat.y - dy) < 1e-7);
  assert.equal(currentAt(w, 1, 2), currentAt(w, 300, 400));
  const d = w.diver;
  Object.assign(d, { state: 'harvesting', patch: w.patches[0], x: 228, y: 238 });
  tick(w, 1);
  assert.equal(d.x, 228);
  assert.equal(d.y, 238);
});
test('swept hull constrains shoal penetration and allows a slow powered reverse off', () => {
  const w = calm(),
    { spacing, size, depths } = w.terrain,
    n = size / spacing + 1;
  // Controlled shoreline fixture in the same authoritative field: deeper to the south.
  for (let iy = 0; iy < n; iy++)
    for (let ix = 0; ix < n; ix++) depths[iy * n + ix] = (iy * spacing - 200) * 0.2;
  Object.assign(w.boat, { x: 250, y: 225, heading: 0, throttle: 1, vy: -5 });
  until(w, () => w.boat.grounded, 15);
  assert.equal(w.boat.hullHealth, 1);
  assert.equal(w.boat.driveHealth, 1);
  assert(hullDepth(w) >= 2 - 0.0001);
  tick(w, 2);
  assert(hullDepth(w) >= 2 - 0.0001);
  const y = w.boat.y;
  step(w, { fullReverse: true }, frame);
  tick(w, 0.5);
  assert(w.boat.y > y);
  assert(w.boat.vy <= 0.500001);
  assert(w.boat.vy > 0);
  until(w, () => !w.boat.grounded, 10);
  assert(hullDepth(w) >= 2.15);
});
test('already stranded hull cannot be powered farther into the shoal', () => {
  const w = calm(),
    { spacing, size, depths } = w.terrain,
    n = size / spacing + 1;
  for (let iy = 0; iy < n; iy++)
    for (let ix = 0; ix < n; ix++) depths[iy * n + ix] = (iy * spacing - 200) * 0.2;
  Object.assign(w.boat, { x: 250, y: 210, heading: Math.PI, throttle: -1, rudder: 1 });
  const before = hullDepth(w);
  tick(w, 3);
  assert(hullDepth(w) >= before - 0.0001);
  assert(w.boat.grounded);
});
test('25 feet behind a SOUTH instruction is noticed; 50 feet behind is missed', () => {
  for (const feet of [25, 50]) {
    const w = calm(),
      p = w.patches[0],
      d = w.diver;
    Object.assign(d, {
      state: 'searching',
      x: p.x,
      y: p.y + p.radius + feet * 0.3048,
      direction: 5,
    });
    const y = d.y;
    assert.equal(!!visiblePatch(w, d), feet === 25);
    tick(w, 1);
    assert.equal(d.bag, 0);
    assert.equal(d.harvestTime, 0);
    if (feet === 25) {
      assert(d.y < y);
      until(w, () => d.state === 'harvesting');
      assert.equal(d.patch, p);
    } else {
      assert(d.y > y);
      tick(w, 10);
      assert.equal(d.state, 'searching');
      assert.equal(d.bag, 0);
    }
  }
});
test('actual first drop searches before bag clock starts, then surfaces with 300 lb on good ground', () => {
  const w = calm(),
    d = w.diver;
  step(w, { recoverDiver: true }, frame);
  assert.equal(d.state, 'deploying');
  until(w, () => d.state === 'searching');
  tick(w, 2);
  assert.equal(d.state, 'searching');
  assert.equal(d.bag, 0);
  assert.equal(d.harvestTime, 0);
  until(w, () => d.state === 'harvesting');
  assert(d.searchTime > 3);
  assert.equal(d.bag, 0);
  const x = d.x,
    y = d.y;
  until(w, () => d.state === 'surfacing');
  assert.equal(d.x, x);
  assert.equal(d.y, y);
  assert(Math.abs(d.harvestTime - 30) < 0.02);
  assert.equal(Math.round(d.bag), 300);
  assert.equal(d.reason, 'Bag full');
  tick(w, 4.8);
  assert.equal(d.state, 'surfacing');
  tick(w, 0.3);
  assert.equal(d.state, 'surface');
});
test('poor ground exhausts with 150 lb and empty ground reaches the scouting limit with no catch', () => {
  for (const id of ['poor', 'empty']) {
    const w = calm(),
      p = w.patches.find((p) => p.id === id);
    Object.assign(w.boat, p.drop);
    w.diver.direction = 5;
    step(w, { recoverDiver: true }, frame);
    until(w, () => w.diver.state === 'surface');
    assert.equal(Math.round(w.diver.bag), id === 'poor' ? 150 : 0);
    assert.equal(w.diver.reason, id === 'poor' ? 'Patch exhausted' : 'Search time limit reached');
    if (id === 'empty') assert.equal(w.diver.harvestTime, 0);
  }
});
test('quality preference rejects a visible unsuitable patch and air stops harvesting early', () => {
  const w = calm(),
    d = w.diver;
  Object.assign(d, { state: 'searching', minQuality: 0.9, x: 228, y: 238, direction: 5 });
  tick(w, 3);
  assert.equal(d.bag, 0);
  assert.equal(d.state, 'searching');
  Object.assign(d, { state: 'harvesting', minQuality: 0, patch: w.patches[0], air: 11 });
  tick(w, 1.1);
  assert.equal(d.reason, 'Air reserve');
  assert(d.bag < 11);
});
test('recovery requires port sector, range and low water speed; capacity never blocks boarding', () => {
  const w = surfaceWorld();
  assert(recoveryStatus(w).available);
  w.diver.x = w.boat.x + 4;
  assert.equal(recoveryStatus(w).reason, 'BRING FLOAT TO PORT SIDE');
  w.diver.x = w.boat.x - 20;
  assert.equal(recoveryStatus(w).reason, 'OUT OF RANGE');
  w.diver.x = w.boat.x - 4;
  w.boat.vx = 2;
  assert.equal(recoveryStatus(w).reason, 'SLOW DOWN');
  w.boat.vx = 0;
  w.boat.heading = Math.PI / 2;
  w.diver.x = w.boat.x;
  w.diver.y = w.boat.y - 4;
  assert(recoveryStatus(w).available);
  w.catch = C.boat.capacity - 10;
  assert(recoveryStatus(w).available, 'capacity must not prevent diver recovery');
});
test('X bag work is a three-second bag turnaround: catch transfers once, automatic redive retains air', () => {
  const w = surfaceWorld(),
    d = w.diver;
  Object.assign(d, {
    x: 228,
    y: 238,
    bag: 300,
    qualitySum: 255,
    air: 40,
    patch: w.patches[0],
    reason: 'Bag full',
  });
  align(w);
  step(w, { work: true }, frame);
  tick(w, 2.9);
  assert.equal(w.catch, 0);
  tick(w, 0.1);
  assert.equal(w.catch, 300);
  assert.equal(w.bags.length, 1);
  assert.equal(d.state, 'deploying');
  assert.equal(d.air, 40);
  assert.equal(d.bag, 0);
  assert.equal(d.state, 'deploying');
  assert(diverVisual(d).bubbles);
  until(w, () => d.state === 'harvesting');
  tick(w, 1);
  assert(w.diver.bag > 0);
  assert.equal(w.bags.length, 1);
});
test('Y boards diver and bag together, then Y deploys with new air; X cannot deploy from deck', () => {
  const w = surfaceWorld(),
    d = w.diver;
  step(w, { recoverDiver: true }, frame);
  tick(w, 4.9);
  assert.equal(d.state, 'surface');
  tick(w, 0.1);
  assert.equal(d.state, 'ready');
  assert.equal(w.catch, 123);
  assert.equal(w.bags.length, 1);
  step(w, { work: true }, frame);
  assert.equal(d.state, 'ready');
  step(w, { recoverDiver: true }, frame);
  assert.equal(w.catch, 123);
  assert.equal(d.state, 'deploying');
  assert.equal(d.air, C.diver.air);
});
test('exhausted/air-limited bag turnaround leaves diver waiting; Y boards without duplicate bags', () => {
  for (const reason of ['exhausted', 'air']) {
    const w = surfaceWorld(),
      d = w.diver;
    d.x = 228;
    d.y = 238;
    align(w);
    if (reason === 'exhausted') w.patches[0].remaining = 0;
    else d.air = 20;
    step(w, { work: true }, frame);
    tick(w, 3.1);
    assert.equal(d.state, 'surface');
    assert(d.bagHandled);
    assert.equal(w.catch, 123);
    assert.equal(w.bags.length, 1);
    tick(w, 5);
    assert.equal(d.state, 'surface');
    step(w, { recoverDiver: true }, frame);
    tick(w, 3);
    assert.equal(d.state, 'ready');
    assert.equal(w.bags.length, 1);
  }
});
test('empty recovered bag does not add a phantom catch marker', () => {
  const w = surfaceWorld();
  w.diver.bag = 0;
  step(w, { recoverDiver: true }, frame);
  tick(w, 5.1);
  assert.equal(w.diver.state, 'ready');
  assert.equal(w.catch, 0);
  assert.equal(w.bags.length, 0);
});
test('a float that drifted away from worthwhile ground does not blindly redescend', () => {
  const w = surfaceWorld();
  Object.assign(w.diver, {
    x: 240,
    y: 300,
    bag: 300,
    air: 40,
    patch: w.patches[0],
    reason: 'Bag full',
  });
  align(w);
  step(w, { work: true }, frame);
  tick(w, 3.1);
  assert.equal(w.diver.state, 'surface');
  assert(w.diver.bagHandled);
});
test('range and player pauses retain progress; switching bag work to boarding boards exactly once', () => {
  const w = surfaceWorld(),
    d = w.diver;
  step(w, { work: true }, frame);
  tick(w, 1);
  const hook = d.hook;
  w.boat.x += 30;
  tick(w, 1);
  assert.equal(d.hook, hook);
  assert.match(playState(w).status, /PAUSED.*OUT OF RANGE/);
  align(w);
  tick(w, 0.1);
  assert(d.hook > hook);
  step(w, { work: true }, frame);
  const paused = d.hook;
  tick(w, 1);
  assert.equal(d.hook, paused);
  step(w, { recoverDiver: true }, frame);
  tick(w, 5);
  assert.equal(d.state, 'ready');
  assert.equal(w.bags.length, 1);
});
test('action prompts only advertise valid context-dependent actions and obey external locks', () => {
  const w = surfaceWorld();
  assert.deepEqual(
    playState(w).actions.map((a) => a.text),
    ['Take + give bag · return to work', 'Recover Diver + Bag'],
  );
  w.diver.x = w.boat.x + 4;
  assert.deepEqual(playState(w).actions, [
    { action: 'recoverDiver', text: 'Deploy Diver', diverId: 1 },
  ]);
  w.diver.state = 'searching';
  assert.deepEqual(playState(w).actions, [
    { action: 'recoverDiver', text: 'Deploy Diver', diverId: 1 },
    { action: 'recall', text: 'Clang hull · summon diver', diverId: 0 },
  ]);
  w.diver.state = 'ready';
  assert.deepEqual(playState(w).actions, [
    { action: 'recoverDiver', text: 'Deploy Diver', diverId: 0 },
  ]);
  w.boat.grounded = true;
  assert(!deploymentStatus(w).available);
  assert.deepEqual(playState(w).actions, []);
  for (const reason of [
    'PAUSED',
    'REMAPPING',
    'CONTROLLER DISCONNECTED',
    'GAME NOT FOCUSED',
    'SESSION ENDED',
  ]) {
    const state = playState(w, reason);
    assert.equal(state.actions.length, 0);
    assert.match(state.controls, new RegExp(reason));
  }
});
test('boat controls stay active during deployment, bag recovery and paused recovery', () => {
  for (const state of ['deploying', 'surface']) {
    const w = surfaceWorld();
    w.diver.state = state;
    w.diver.timer = 2;
    w.diver.hooking = true;
    w.diver.recoveryAction = 'recoverBag';
    step(w, { throttle: 1, steer: 1 }, frame);
    assert(w.boat.throttle > 0);
    assert(w.boat.rudder > 0);
    assert(!playState(w).locked);
  }
});
test('bubbles only underwater, float only at surface, and deck markers remain independent of catch', () => {
  const d = createWorld({ practice: true }).diver;
  for (const state of ['searching', 'harvesting', 'surfacing', 'deploying']) {
    d.state = state;
    assert.deepEqual(diverVisual(d), { bubbles: true, surface: false, aboard: false });
  }
  d.state = 'surface';
  assert.deepEqual(diverVisual(d), { bubbles: false, surface: true, aboard: false });
  d.state = 'ready';
  assert(diverVisual(d).aboard);
  const markers = deckMarkers(Array.from({ length: 35 }, () => ({ weight: 100 })));
  assert.equal(markers.length, 35);
  assert(markers.some((m) => m.layer > 0));
  assert(markers.every((m) => m.radius === markers[0].radius));
  assert.deepEqual(markers.slice(0, 10), deckMarkers(Array.from({ length: 10 })));
});
