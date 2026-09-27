import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, selectDiver } from '../src/world.js';
import { step, setInstructions, recoveryStatus, deploymentStatus } from '../src/simulation.js';
import { interactionDiver, playState, feedbackText } from '../src/presentation.js';
const frame = 1 / 60;
function fixture() {
  const w = createWorld({ practice: true });
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  w.debris = [];
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  Object.assign(w.boat, { x: 232, y: 238, vx: 0, vy: 0 });
  return w;
}
function tick(w, seconds) {
  for (let i = 0; i < seconds * 60; i++) step(w, {}, frame);
}
function surfaced(w) {
  for (const d of w.divers)
    Object.assign(d, {
      state: 'surface',
      x: 228,
      y: 238 + d.id,
      bag: 300,
      qualitySum: 240,
      air: 45,
      reason: 'Bag full',
      patch: w.patches[0],
    });
}
test('two deployments have independent instructions, air, searching and harvesting', () => {
  const w = fixture();
  setInstructions(w, 0, { direction: 1, minQuality: 0.6 });
  setInstructions(w, 1, { direction: 5, minQuality: 0.9 });
  step(w, { recoverDiver: true, diverId: 0 }, frame);
  tick(w, 5);
  const firstAir = w.divers[0].air;
  step(w, { recoverDiver: true, diverId: 1 }, frame);
  tick(w, 3);
  const [a, b] = w.divers;
  assert.equal(a.state, 'harvesting');
  assert.equal(b.state, 'searching');
  assert(a.bag > 0);
  assert.equal(b.bag, 0);
  assert(a.air < firstAir);
  assert(b.air > a.air);
  assert.equal(a.direction, 1);
  assert.equal(b.direction, 5);
  assert.equal(b.harvestTime, 0);
});
test('separate grounds have separate harvest rate and exhaustion; only one diver surfaces', () => {
  const w = fixture(),
    [a, b] = w.divers;
  Object.assign(a, { state: 'harvesting', patch: w.patches[0], x: 228, y: 238 });
  Object.assign(b, { state: 'harvesting', patch: w.patches[1], x: 259, y: 356 });
  tick(w, 15);
  assert(Math.abs(a.bag - 150) < 1e-6);
  assert(Math.abs(b.bag - 75) < 1e-6);
  a.air = 10.01;
  tick(w, 1);
  assert.equal(a.state, 'surfacing');
  assert.equal(b.state, 'harvesting');
  assert.equal(b.reason, '');
});
test('both divers can surface together without sharing timers or float positions', () => {
  const w = fixture();
  w.environment.current = { x: 0.4, y: 0.2 };
  for (const d of w.divers)
    Object.assign(d, { state: 'searching', x: 200 + d.id * 50, y: 280, air: 10.01 });
  tick(w, 0.1);
  assert(w.divers.every((d) => d.state === 'surfacing'));
  tick(w, 5.1);
  assert(w.divers.every((d) => d.state === 'surface'));
  assert(Math.abs(w.divers[1].x - w.divers[0].x - 50) < 1e-7);
  assert(w.divers[0].x > 200);
});
test('one recovery leaves the adjacent diver and their bag untouched; no duplicate catch', () => {
  const w = fixture();
  surfaced(w);
  step(w, { recoverDiver: true, diverId: 1 }, frame);
  tick(w, 5.1);
  assert.equal(w.divers[1].state, 'ready');
  assert.equal(w.divers[0].state, 'surface');
  assert.equal(w.divers[0].bag, 300);
  assert.equal(w.catch, 300);
  assert.equal(w.bags.length, 1);
  assert.equal(w.divers[0].hook, 0);
  step(w, { recoverDiver: true, diverId: 1 }, frame);
  tick(w, 1);
  assert.equal(w.catch, 300);
});
test('selection changes do not retarget a queued command or an active recovery', () => {
  const w = fixture();
  surfaced(w);
  selectDiver(w, 1);
  step(w, { recoverDiver: true, diverId: 0 }, frame);
  tick(w, 1);
  assert(w.divers[0].hook > 0.9);
  assert.equal(w.divers[1].hook, 0);
  assert.equal(playState(w).diverId, 1);
  tick(w, 4.1);
  assert.equal(w.divers[0].state, 'ready');
  assert.equal(w.divers[1].state, 'surface');
});
test('two overlapping recovery completions cap catch, account for all overflow and board both', () => {
  const w = fixture();
  surfaced(w);
  w.catch = 4900;
  step(w, { recoverDiver: true, diverId: 0 }, frame);
  step(w, { recoverDiver: true, diverId: 1 }, frame);
  tick(w, 5.1);
  assert(w.divers.every((d) => d.state === 'ready'));
  assert.equal(w.catch, 5000);
  assert.equal(w.discarded, 500);
  assert.equal(w.bags.length, 1);
});
test('shared patch exhaustion conserves stock and both partial bags', () => {
  const w = fixture(),
    p = w.patches[0];
  p.remaining = 101;
  for (const d of w.divers) Object.assign(d, { state: 'harvesting', patch: p, x: 228, y: 238 });
  tick(w, 6);
  assert.equal(p.remaining, 0);
  assert(Math.abs(w.divers.reduce((sum, d) => sum + d.bag, 0) - 101) < 1e-6);
  assert(w.divers.every((d) => d.state === 'surfacing'));
  tick(w, 10);
  assert(w.divers.every((d) => d.reason === 'Patch exhausted'));
  assert(w.divers.every((d) => d.harvestTime < 6));
});
test('bag turnaround preserves only that diver air and does not restart their partner', () => {
  const w = fixture();
  surfaced(w);
  w.divers[1].air = 19;
  step(w, { work: true, diverId: 0 }, frame);
  tick(w, 3);
  assert.equal(w.divers[0].state, 'deploying');
  assert(!w.divers[0].bagHandled);
  assert.equal(w.divers[0].air, 45);
  assert.equal(w.divers[1].state, 'surface');
  assert.equal(w.divers[1].air, 19);
  assert.equal(w.divers[1].bag, 300);
});
test('outstanding diver bags reserve capacity before another deployment', () => {
  const w = fixture();
  w.catch = 4700;
  step(w, { recoverDiver: true, diverId: 0 }, frame);
  assert(!deploymentStatus(w, w.divers[1]).available);
  step(w, { recoverDiver: true, diverId: 1 }, frame);
  assert.equal(w.divers[1].state, 'ready');
});
test('Realistic picks the nearest alongside float and retains an active operation', () => {
  const w = fixture();
  surfaced(w);
  selectDiver(w, 1);
  assert.equal(interactionDiver(w, true).id, 0);
  w.divers[1].hooking = true;
  assert.equal(interactionDiver(w, true).id, 1);
  assert.equal(interactionDiver(w, false).id, 1);
  w.divers[1].hooking = false;
  w.divers[0].x = 100;
  assert.equal(interactionDiver(w, true).id, 1);
});
test('mode presentation and pickup queries do not mutate world state', () => {
  const w = fixture();
  surfaced(w);
  const before = JSON.stringify(w);
  for (const realistic of [false, true, false]) {
    const d = interactionDiver(w, realistic);
    playState(w, '', realistic ? 2 : 5, d, realistic);
    recoveryStatus(w, realistic ? 2 : 5, d);
  }
  assert.equal(JSON.stringify(w), before);
});
test('reset creates two clean divers, independent world stock, and an empty deck', () => {
  const first = fixture();
  surfaced(first);
  first.divers[0].direction = 5;
  first.patches[0].remaining = 0;
  const next = fixture();
  assert(next.divers.every((d) => d.state === 'ready' && d.bag === 0 && d.direction === 0));
  assert(next.patches[0].remaining > 0);
  assert.equal(next.catch, 0);
  assert.equal(next.bags.length, 0);
  assert.notEqual(next.divers[0], next.divers[1]);
});
test('Realistic never announces an unseen surfaced diver or exposes their recovery progress', () => {
  const w = fixture();
  surfaced(w);
  w.divers[0].x = 100;
  w.divers[0].hook = 1;
  const state = playState(w, '', 2, w.divers[0], true);
  assert.equal(state.observable, false);
  assert.equal(state.progress, null);
  assert(
    state.actions.every((a) => a.diverId === 1),
    'only the visible nearby diver supplies actions',
  );
  assert(!state.status.includes('SURFACE'));
});
test('Realistic feedback cannot announce remote automatic transitions or exact catch', () => {
  for (const text of [
    'DIVER 1: DIVER SURFACING — WATCH THE BUBBLES',
    'DIVER 2: DIVER SURFACED — GET ALONGSIDE ON PORT',
    'DIVER 1: FRESH BAG PROVIDED — DIVER RETURNING TO WORK',
  ]) {
    assert.equal(feedbackText(text, true), null);
    assert.equal(feedbackText(text, false), text);
  }
  assert.equal(feedbackText('DIVER 1: BAG RECOVERED — 300 lb', true), 'DIVER 1: BAG RECOVERED');
  assert.equal(
    feedbackText('DECK FULL — 200 lb EXCESS CATCH RELEASED', true),
    'DECK FULL — EXCESS CATCH RELEASED',
  );
  assert.equal(
    feedbackText('LEAVE NOW TO OFFLOAD BY 19:00', true),
    'LEAVE NOW TO OFFLOAD BY 19:00',
  );
});
