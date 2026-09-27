import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, saveCareer } from '../src/career-save.js';
import { createTestCareer } from '../src/test-mode.js';
import { chooseGround } from '../src/day.js';
import {
  trainingActions,
  stageTrainingDiver,
  setTrainingGround,
  restTrainingCrew,
} from '../src/training-tools.js';
import { careerActions } from '../src/career-actions.js';
import { RANKS } from '../src/career-data.js';

function fixture() {
  const w = careerWorld(createTestCareer(null, 99));
  chooseGround(w, 'near');
  w.career.trafficSettings = { rate: 0 };
  w.terrain.depths = w.terrain.depths.slice().fill(20);
  w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  return w;
}
test('all training mutations reject a real career, and sandbox work cannot write its save', () => {
  const real = careerWorld(),
    before = structuredClone(real.career);
  assert.equal(trainingActions(real, {}).length, 0);
  assert.equal(stageTrainingDiver(real, 'surface').ok, false);
  assert.equal(setTrainingGround(real, { stock: 0 }).ok, false);
  assert.equal(restTrainingCrew(real).ok, false);
  assert.deepEqual(real.career, before);
  assert(
    saveCareer(fixture(), {
      setItem() {
        throw Error('must not write');
      },
    }).ok,
  );
});
test('training stages independent diver states, air/bags and conservative/ignoring-table scenarios', () => {
  const w = fixture(),
    other = structuredClone(w.divers[1]),
    ui = { debug: false };
  const act = (id) =>
    trainingActions(w, ui)
      .find((a) => a.id === id)
      .run();
  act('train-searching');
  assert.equal(w.diver.state, 'searching');
  assert(w.diver.patch);
  act('train-bag');
  assert.equal(w.diver.bag, 75);
  act('train-air');
  assert.equal(w.diver.air, 20);
  act('train-style');
  assert.equal(w.diver.diveStyle, 'tables');
  act('train-exposure');
  assert.equal(w.career.people.ada.diveHealth.load, 0.5);
  act('train-surface');
  assert.equal(w.diver.state, 'surface');
  assert.deepEqual(w.divers[1], other);
  w.diver.condition = 'injured';
  act('train-rest');
  assert.equal(w.diver.condition, 'fit');
  assert.equal(w.career.people.ada.diveHealth.load, 0);
});
test('training ground edits keep clump totals, and levelling, unlocks and single-step use real systems', () => {
  const w = fixture(),
    ui = { debug: false, screen: 'workshop', open() {}, back() {} },
    act = (id) =>
      trainingActions(w, ui)
        .find((a) => a.id === id)
        .run();
  w.career.training = { patchId: w.patches[0].id, timeScale: 1 };
  const p = w.patches[0];
  setTrainingGround(w, { stock: 0.5, quality: 0.9, rate: 10 });
  assert.equal(
    p.remaining,
    p.clumps.reduce((n, c) => n + c.remaining, 0),
  );
  assert(p.clumps.every((c) => c.quality === 0.9));
  assert.equal(p.rate, 10);
  act('train-level');
  assert.equal(w.diver.experience, 3000);
  for (let i = 0; i < 4; i++) act('train-level');
  assert.equal(w.diver.experience, 65000);
  careerActions(ui, w)
    .find((a) => a.id === 'rank')
    .run();
  assert.equal(w.career.xp, RANKS.at(-1).xp);
  const time = w.time;
  act('train-step');
  assert(Math.abs(w.time - time - 1 / 60) < 1e-9);
  act('train-scale');
  assert.equal(w.career.training.timeScale, 2);
});
