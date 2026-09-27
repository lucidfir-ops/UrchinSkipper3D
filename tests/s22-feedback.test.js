import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, settleCareer } from '../src/career-state.js';
import { careerWorld, encode, decode, nextCareerDay } from '../src/career-save.js';
import { inspectionSchedule, inspectionDue } from '../src/inspection-schedule.js';
import { insurancePremium } from '../src/insurance.js';
import { chooseGround, requestRescue } from '../src/day.js';
import { step, deploymentStatus } from '../src/simulation.js';
import { advanceIntro, introTerrain } from '../src/career-intro.js';
import { checkDiverSafety } from '../src/diver-safety.js';
import { boatSpec } from '../src/boats.js';
import { createWorld } from '../src/world.js';
import { careerActions, careerActivate } from '../src/career-actions.js';
import { purchaseActions } from '../src/purchase.js';
import { depthAt } from '../src/terrain.js';

function intro() {
  const c = createCareer(100, { chooseStarter: true });
  c.day = 0;
  c.intro = { status: 'active', step: 0 };
  return careerWorld(c);
}
test('inspection day/time survives saves, never arrives early or after 14:00, no missed-day backlog', () => {
  const w = careerWorld(createCareer(837));
  w.career.day = 3;
  const s = inspectionSchedule(w.career);
  assert(s.minute >= 660 && s.minute <= 840);
  for (const minute of [480, 659, s.minute - 1, 841]) {
    w.day.minute = minute;
    assert(!inspectionDue(w));
  }
  w.day.minute = s.minute;
  assert(inspectionDue(w));
  const copy = decode(encode(w));
  assert.deepEqual(inspectionSchedule(copy.career), s);
  s.completed = true;
  assert(!inspectionDue(w));
  w.career.day = 4;
  assert(!inspectionDue(w));
  for (let day = 9; day < 49; day += 8) {
    w.career.day = day;
    const block = inspectionSchedule(w.career);
    assert(block.day >= day && block.day < day + 8);
    if (block.day < day + 7) {
      w.career.day = block.day + 1;
      w.day.minute = 840;
      assert(!inspectionDue(w));
    }
  }
});
test('injury raises future premiums once, including medical injury; paid trip retains its premium', () => {
  const w = careerWorld();
  assert(chooseGround(w, 'near').ok);
  assert.equal(w.day.insurancePaid, 65);
  w.diver.condition = 'injured';
  w.emergency = { reason: 'Diver injured', mandatoryRescue: false };
  const result = requestRescue(w);
  assert(result.ok);
  assert.equal(insurancePremium(w.career), 90);
  assert.equal(w.day.insurancePaid, 65);
  settleCareer(w, result);
  assert.equal(insurancePremium(w.career), 90);
  const restored = decode(encode(w));
  assert.equal(insurancePremium(restored.career), 90);
  const next = nextCareerDay(restored);
  assert(chooseGround(next, 'near').ok);
  assert.equal(next.day.insurancePaid, 90);
});
test('gentle forward contact is more forgiving; powered stern reversal still injures or kills', () => {
  for (const [speed, stern, expected] of [
    [2, false, 'fit'],
    [3, false, 'injured'],
    [5, false, 'deceased'],
    [1.9, true, 'injured'],
    [2.3, true, 'deceased'],
  ]) {
    const w = createWorld({ practice: true, boatId: 'outboard' }),
      spec = boatSpec(w);
    Object.assign(w.environment, { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 } });
    Object.assign(w.boat, { vx: 0, vy: stern ? speed : -speed, throttle: stern ? -1 : 0, turn: 0 });
    Object.assign(w.diver, {
      state: 'surface',
      x: w.boat.x,
      y: w.boat.y + (stern ? spec.length / 2 : 0),
    });
    checkDiverSafety(w, { ...w.boat });
    assert.equal(w.diver.condition, expected, `${speed}/${stern}`);
  }
});
test('day zero has distinct shallow terrain, real harvestable marked/hidden patches, and saves work in progress', () => {
  let w = intro();
  assert.equal(w.terrain.size, 240);
  assert.equal(w.patches.length, 2);
  assert.equal(w.patches[1].charted, false);
  assert(depthAt(w, 82, 88) > 5);
  for (const id of ['lesson-marked', 'lesson-hidden']) {
    const p = w.patches.find((p) => p.id === id);
    Object.assign(w.boat, { x: p.x + 7, y: p.y, heading: 0, vx: 0, vy: 0, throttle: 0, rudder: 0 });
    w.diver.state = 'ready';
    w.diver.bag = 0;
    w.diver.qualitySum = 0;
    w.diver.air = 100;
    assert(deploymentStatus(w).available);
    step(w, { recoverDiver: true }, 1 / 60);
    for (let i = 0; i < 60 * 45 && w.diver.bag <= 0; i++) step(w, {}, 1 / 60);
    assert(w.diver.bag > 0, `${p.id} yields actual catch`);
    advanceIntro(w);
    assert(p.id === 'lesson-marked' ? w.career.intro.markedCatch : w.career.intro.discovery);
    const before = p.remaining;
    w = decode(encode(w));
    assert.equal(w.patches.find((q) => q.id === p.id).remaining, before);
    assert.equal(w.diver.patch.id, p.id);
  }
  assert.equal(w.career.records.days, 0);
  assert.deepEqual(w.career.stock, {});
  assert.equal(introTerrain().patches[0].remaining, 2400);
  const old = careerWorld();
  assert.equal(old.career.intro, undefined);
  assert.equal(old.day.phase, 'planning');
});
test('purchase cancellation cannot spend money; confirmation uses the original transaction once', () => {
  const w = careerWorld();
  w.boat.fuel -= 10;
  const history = [];
  const ui = {
    screen: 'accounts',
    index: 0,
    input: { suppress() {} },
    hooks: { save() {} },
    open(s) {
      history.push(this.screen);
      this.screen = s;
      this.index = 0;
    },
    previous() {
      this.screen = history.pop();
    },
  };
  ui.index = careerActions(ui, w).findIndex((a) => a.id === 'fuel');
  const cash = w.career.cash;
  careerActivate(ui, w);
  assert.equal(ui.screen, 'purchase');
  assert.equal(w.career.cash, cash);
  purchaseActions(ui)[0].run();
  assert.equal(w.career.cash, cash);
  ui.index = careerActions(ui, w).findIndex((a) => a.id === 'fuel');
  careerActivate(ui, w);
  purchaseActions(ui)[1].run();
  assert.equal(w.career.cash, cash - 21.5);
  purchaseActions(ui)[1].run();
  assert.equal(w.career.cash, cash - 21.5);
});

test('Frank lessons progress through real helm, harvest and boarding, then finish with untouched starter funds', async () => {
  const { createSessionHooks } = await import('../src/career-session.js');
  const w = intro();
  const tick = (seconds, actions = {}) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      step(w, i === 0 ? actions : {}, 1 / 60);
      advanceIntro(w);
    }
  };
  tick(1, { fullAhead: true });
  assert.equal(w.career.intro.step, 1);
  for (let i = 0; i < 180; i++) {
    step(w, { steer: 1 }, 1 / 60);
    advanceIntro(w);
  }
  assert.equal(w.career.intro.step, 2);
  advanceIntro(w, { zoom: -1 });
  advanceIntro(w, {}, 'introchart');
  assert.equal(w.career.intro.step, 4);
  for (const id of ['lesson-marked', 'lesson-hidden']) {
    const p = w.patches.find((p) => p.id === id);
    Object.assign(w.boat, {
      x: p.x + 7,
      y: p.y,
      heading: 0,
      vx: 0,
      vy: 0,
      throttle: 0,
      rudder: 0,
      turn: 0,
    });
    advanceIntro(w);
    tick(0.1, { recoverDiver: true });
    for (let i = 0; i < 50 && w.diver.bag < 5; i++) tick(1);
    assert(w.diver.bag >= 5);
    assert.equal(w.career.intro.step, id === 'lesson-marked' ? 6 : 8);
    // Approach bubbles and issue the real recall; then line up safely on port.
    Object.assign(w.boat, { x: w.diver.x + 3, y: w.diver.y, vx: 0, vy: 0, throttle: 0, rudder: 0 });
    tick(0.1, { recall: true });
    for (let i = 0; i < 30 && w.diver.state !== 'surface'; i++) tick(1);
    assert.equal(w.diver.state, 'surface');
    Object.assign(w.boat, {
      x: w.diver.x + 4,
      y: w.diver.y,
      vx: 0.015,
      vy: 0,
      heading: 0,
      turn: 0,
    });
    tick(0.1, { recoverDiver: true });
    for (let i = 0; i < 15 && w.diver.state !== 'ready'; i++) tick(1);
    assert.equal(w.diver.state, 'ready');
    assert.equal(w.career.intro.step, id === 'lesson-marked' ? 7 : 9);
  }
  const context = { world: decode(encode(w)), persist: () => ({ ok: true }) };
  const hooks = createSessionHooks({}, context);
  hooks.finishIntro(false);
  assert.equal(context.world.career.day, 1);
  assert.equal(context.world.career.intro.status, 'complete');
  assert.equal(context.world.career.intro.skipped, false);
  assert.equal(context.world.career.cash, 20000);
  assert(context.world.career.starterPending);
  assert.equal(context.world.catch, 0);
  assert(context.world.divers.every((d) => d.condition === 'fit' && d.state === 'ready'));
  hooks.finishIntro(false);
  assert.equal(context.world.career.cash, 20000);
});
