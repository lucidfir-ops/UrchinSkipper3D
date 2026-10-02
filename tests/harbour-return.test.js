import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { step } from '../src/simulation.js';
import {
  cancelDeparture,
  confirmDeparture,
  requestDeparture,
  RETURN_REARM_DISTANCE,
} from '../src/departure-transition.js';
import { open, back, previous, escapeMenu } from '../src/screen-navigation.js';
import { updateReturnPrompt, activateReturn, RETURN_CHOICES } from '../src/harbour-return.js';
import { advanceDebugTime } from '../src/debug-mode.js';

function boundaryWorld(edge = 'south') {
  const w = careerWorld();
  assert(chooseGround(w, 'near').ok);
  const size = w.terrain.size;
  w.day.returnExit.edge = edge;
  Object.assign(w.boat, {
    x: edge === 'west' ? 0 : edge === 'east' ? size : size / 2,
    y: edge === 'north' ? 0 : edge === 'south' ? size : size / 2,
    throttle: 0.6,
    vx: 2,
    vy: 3,
  });
  return w;
}
function uiFor(w) {
  const ui = {
    hooks: { world: () => w },
    input: {
      suppress() {
        this.suppressed = true;
      },
      cancelNaming() {},
    },
    panel: { scrollTop: 0, scrollLeft: 0, style: { removeProperty() {} } },
    canvas: { focus() {} },
    history: [],
    screen: null,
    started: true,
  };
  ui.open = open.bind(ui);
  return ui;
}

test('all four designated edges request a frozen decision, survive reload and need explicit confirmation', () => {
  for (const edge of ['north', 'south', 'east', 'west']) {
    let w = boundaryWorld(edge);
    assert(!confirmDeparture(w), 'confirmation requires a pending request');
    assert(requestDeparture(w));
    assert.equal(w.day.returnFade, undefined);
    const before = encode(w);
    for (let i = 0; i < 300; i++) step(w, { fullAhead: true, recoverDiver: true }, 1 / 60);
    assert.equal(encode(w), before, 'no time, fuel, motion, catch or crew changes during decision');
    w = decode(before);
    assert.equal(w.day.returnPending, true);
    assert(confirmDeparture(w));
    assert.equal(w.day.returnPending, undefined);
    assert.equal(w.day.returnFade, 0);
  }
});

test('cancel safely holds at the edge until the skipper returns inward and approaches again', () => {
  const w = boundaryWorld();
  assert(requestDeparture(w));
  assert(cancelDeparture(w));
  assert.equal(w.boat.throttle, 0);
  assert.equal(w.boat.vx, 0);
  assert.equal(w.boat.vy, 0);
  for (let i = 0; i < 10; i++) assert(!requestDeparture(w));
  w.boat.y = w.terrain.size - RETURN_REARM_DISTANCE + 1;
  assert(!requestDeparture(w));
  assert(w.day.returnDismissed);
  w.boat.y = w.terrain.size - RETURN_REARM_DISTANCE;
  assert(!requestDeparture(w));
  assert.equal(w.day.returnDismissed, undefined);
  w.boat.y = w.terrain.size;
  assert(requestDeparture(w));
});

test('wrong edge, crew in the water, bag work and ordinary practice cannot request a harbour return', () => {
  const w = boundaryWorld();
  w.boat.y = 0;
  assert(!requestDeparture(w));
  w.boat.y = w.terrain.size;
  w.divers[0].state = 'surface';
  assert(!requestDeparture(w));
  w.divers[0].state = 'ready';
  w.day.dump = {};
  assert(!requestDeparture(w));
  delete w.day.dump;
  w.day.phase = 'practice';
  assert(!requestDeparture(w));
});

test('prompt starts on Cancel and Back, Menu, Escape and button cancel all resume without travel', () => {
  for (const exit of [
    back,
    previous,
    escapeMenu,
    function () {
      activateReturn(this, this.hooks.world());
    },
  ]) {
    const w = boundaryWorld(),
      ui = uiFor(w);
    assert(requestDeparture(w));
    updateReturnPrompt(ui, w, true);
    assert.equal(ui.screen, 'harbour-return');
    assert.equal(ui.index, 0);
    assert.match(RETURN_CHOICES[ui.index], /Cancel/);
    assert(ui.input.suppressed, 'held crossing inputs must be released');
    exit.call(ui);
    assert.equal(ui.screen, null);
    assert.equal(w.day.returnPending, undefined);
    assert.equal(w.day.returnFade, undefined);
    assert(w.day.returnDismissed);
  }
});

test('explicit return action starts fade without triggering cancellation or duplicate settlement', () => {
  const w = boundaryWorld(),
    ui = uiFor(w);
  requestDeparture(w);
  updateReturnPrompt(ui, w, true);
  ui.index = 1;
  activateReturn(ui, w);
  assert.equal(ui.screen, null);
  assert.equal(w.day.returnFade, 0);
  assert.equal(w.day.returnDismissed, undefined);
  assert(!confirmDeparture(w));
});

test('accelerated time stops at a harbour decision rather than reporting fictitious time progress', () => {
  const w = boundaryWorld();
  requestDeparture(w);
  const minute = w.day.minute;
  const result = advanceDebugTime(w, 30);
  assert.equal(w.day.minute, minute);
  assert.equal(w.day.returnPending, true);
  assert.match(result.reason, /harbour boundary/);
  assert.match(result.reason, /Advanced 0 minutes/);
});
