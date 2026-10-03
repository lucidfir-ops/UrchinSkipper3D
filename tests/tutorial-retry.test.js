import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer } from '../src/career-state.js';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { advanceIntro, introLesson, introMarkedDrop } from '../src/career-intro.js';
import { step } from '../src/simulation.js';
import { boatSpec } from '../src/boats.js';
import { visiblePatch } from '../src/world.js';

function tutorial() {
  const c = createCareer(100, { chooseStarter: true });
  c.day = 0;
  c.intro = { status: 'active', step: 4 };
  return careerWorld(c);
}
function tick(w, seconds, actions = {}) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    step(w, i === 0 ? actions : {}, 1 / 60);
    advanceIntro(w);
  }
}
function placeDrop(w, x, y, heading = 0) {
  const offset = boatSpec(w).width / 2 + 2;
  Object.assign(w.boat, {
    x: x + Math.cos(heading) * offset,
    y: y + Math.sin(heading) * offset,
    heading,
    vx: 0,
    vy: 0,
    throttle: 0,
    rudder: 0,
    turn: 0,
  });
}

test('Frank rejects the real empty-water approach and accepts actual port entries at every heading', () => {
  const w = tutorial();
  Object.assign(w.boat, { x: 89.35097, y: 111.50986, heading: -0.52311, throttle: 0 });
  assert(Math.hypot(w.boat.x - 82, w.boat.y - 88) < 28, 'old arrival check accepted this approach');
  assert.equal(introMarkedDrop(w).marked, false);
  assert.equal(advanceIntro(w), false);
  assert.equal(w.career.intro.step, 4);
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    placeDrop(w, 82, 88, heading);
    w.career.intro.step = 4;
    const drop = introMarkedDrop(w);
    assert.equal(drop.available, true);
    assert.equal(drop.marked, true);
    assert.equal(visiblePatch(w, { ...drop.diver, x: drop.x, y: drop.y }).id, 'lesson-marked');
    assert.equal(advanceIntro(w), true);
    assert.equal(w.career.intro.step, 5);
  }
});

test('accepted drop really yields catch and progresses without any catch or diver-state injection', () => {
  const w = tutorial();
  placeDrop(w, 82, 88);
  assert(advanceIntro(w));
  const before = structuredClone(w.terrain);
  tick(w, 0.1, { recoverDiver: true });
  for (let i = 0; i < 30 && w.career.intro.step === 5; i++) tick(w, 1);
  assert.equal(w.career.intro.step, 6);
  assert(w.divers[0].bag > 0);
  assert.equal(w.divers[0].patch.id, 'lesson-marked');
  assert.deepEqual(w.terrain.depths, before.depths);
  assert.deepEqual(
    w.terrain.patches.map((p) => p.outline),
    before.patches.map((p) => p.outline),
  );
  assert.equal(w.catch, 0, 'catch is still with the actual diver');
});

test('failed first search keeps real progress pending and teaches recover, reposition and retry', () => {
  let w = tutorial();
  w.career.intro.step = 5; // An old save, or a player who skipped the arrival lesson.
  Object.assign(w.boat, { x: 88.4, y: 110.5, heading: -0.543, throttle: 0 });
  tick(w, 0.1, { recoverDiver: true });
  tick(w, 82);
  assert.equal(w.divers[0].state, 'surface');
  assert.equal(w.divers[0].bag, 0);
  assert.equal(w.divers[0].reason, 'Search time limit reached');
  assert.equal(w.career.intro.step, 5);
  assert.match(introLesson(w)[1], /each float.*PORT rail/);
  assert.doesNotMatch(introLesson(w)[1], /deploy .* here/i);
  w = decode(encode(w));
  assert.match(introLesson(w)[1], /try the marked shelf again/);
  const d = w.divers[0];
  Object.assign(w.boat, { x: d.x + 4, y: d.y, heading: 0, vx: 0.015, vy: 0, turn: 0 });
  tick(w, 0.1, { recoverDiver: true });
  for (let i = 0; i < 15 && d.state !== 'ready'; i++) tick(w, 1);
  assert.equal(d.state, 'ready');
  assert.equal(w.catch, 0);
  assert.equal(w.career.intro.step, 5);
  assert.match(introLesson(w)[1], /did not bring back.*Move closer/);
  placeDrop(w, 82, 88);
  tick(w, 0.1, { recoverDiver: true });
  for (let i = 0; i < 30 && w.career.intro.step === 5; i++) tick(w, 1);
  assert.equal(w.career.intro.step, 6);
  assert(d.bag > 0);
});

test('guidance handles both divers, automatic deployment target, orders and hidden surface state', () => {
  const w = tutorial();
  placeDrop(w, 82, 88);
  w.divers[0].condition = 'injured';
  assert.equal(introMarkedDrop(w).diver.id, 1);
  assert(advanceIntro(w));
  assert.match(introLesson(w)[1], /Milo/);
  w.divers[0].condition = 'fit';
  w.divers.forEach((d) => {
    d.state = 'searching';
  });
  assert.match(introLesson(w)[1], /Follow the bubbles/);
  w.divers[0].state = 'surface';
  w.divers[0].x = 200;
  w.divers[0].y = 200;
  assert.match(introLesson(w)[1], /each float/);
  w.career.difficulty = 'realistic';
  w.career.assists.diverIndicators = false;
  assert.match(
    introLesson(w)[1],
    /Follow the bubbles/,
    'distant hidden float does not reveal surfacing',
  );
  w.divers.forEach((d) => {
    d.state = 'ready';
    d.minQuality = 0.95;
  });
  assert.match(introLesson(w)[1], /Open Orders.*80%/);
  w.career.intro.step = 4;
  assert.equal(advanceIntro(w), false);
  assert.match(introLesson(w)[1], /Open Orders/);
});
