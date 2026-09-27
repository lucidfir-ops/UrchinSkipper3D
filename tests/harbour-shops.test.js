import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer } from '../src/career-state.js';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { careerActions, careerActivate } from '../src/career-actions.js';
import { FLEET } from '../src/career-data.js';
import { tickIntroHint, INTRO_STEPS } from '../src/career-intro.js';
import { patchOutline, patchLabelAnchor } from '../src/patch-style.js';
import { choices } from '../src/screen-actions.js';
import { chooseFirstBoat } from '../src/starter-career.js';

test('both funded starter choices show and charge the same 15,000 price', () => {
  assert.equal(FLEET.basic.price, 15000);
  assert.equal(FLEET.outboard.price, 15000);
  for (const id of ['basic', 'outboard']) {
    const w = careerWorld(createCareer(18, { chooseStarter: true }));
    const ui = { screen: 'starter', starterCandidate: id };
    const labels = careerActions(ui, w)
      .map((action) => action.label)
      .join(' ');
    assert.match(labels, /15,000/);
    const before = w.career.cash;
    const result = chooseFirstBoat(w, id);
    assert.equal(result.ok, true);
    assert.equal(before - w.career.cash, 15000);
    assert.equal(w.career.firstBoat.price, 15000);
  }
});

test('Frank hint counts only active step-8 time, survives reload and never repeats', () => {
  const c = createCareer(17, { chooseStarter: true });
  c.day = 0;
  c.intro = { status: 'active', step: 7 };
  let w = careerWorld(c);
  assert(!tickIntroHint(w, 40, true));
  assert(!tickIntroHint(w, 120, false));
  assert.equal(w.career.intro.scoutSeconds, 40);
  w = decode(encode(w));
  assert(!tickIntroHint(w, 19.9, true));
  assert(tickIntroHint(w, 0.1, true));
  assert(!tickIntroHint(w, 180, true));
  assert.equal(w.career.intro.scoutSeconds, 60);
  w.career.intro.step = 8;
  assert(!tickIntroHint(w, 100, true));
  assert.match(INTRO_STEPS[7][1], /5–11 m/);
  assert.match(INTRO_STEPS[8][1], /Recording chartplotter/);
  assert.match(INTRO_STEPS[8][1], /5 m and 25 m/);
});

test('patch labels stay above the entire rendered outline at close and wide zoom', () => {
  const w = careerWorld(createCareer(37));
  for (const patch of [...w.patches, { x: 0, y: 0, radius: 20 }]) {
    const outline = patchOutline(patch);
    for (const zoom of [0.25, 0.4, 1, 2.8]) {
      const anchor = patchLabelAnchor(outline, 6, zoom);
      assert(outline.every((p) => anchor.y <= p.y * 6 - 8 / zoom + 1e-8));
      assert.equal(
        anchor.x,
        (Math.min(...outline.map((p) => p.x)) + Math.max(...outline.map((p) => p.x))) * 3,
      );
    }
  }
});

test('starter, boatyard and chandlery separate inspection from explicit purchase and cancel', () => {
  for (const [screen, preview, installed] of [
    ['starter', 'starter-basic', (w) => w.career.starterPending === false],
    ['fleet', 'buy-jet', (w) => w.career.activeBoat === 'jet'],
    [
      'outfit',
      'equipment-plotter',
      (w) => w.career.fleet[w.boat.configuration].equipment.includes('plotter'),
    ],
  ]) {
    const w = careerWorld(createCareer(17, { chooseStarter: screen === 'starter' }));
    w.career.cash = 1000000;
    w.career.xp = 12000;
    w.day.phase = 'planning';
    const ui = {
      screen,
      index: 0,
      hooks: { save() {} },
      input: { suppress() {} },
      open(s) {
        this.screen = s;
      },
      previous() {
        this.screen = screen;
      },
    };
    const activate = (id) => {
      ui.index = careerActions(ui, w).findIndex((a) => a.id === id);
      assert(ui.index >= 0, id);
      careerActivate(ui, w);
    };
    const before = encode(w);
    activate(preview);
    activate(preview);
    assert.equal(ui.screen, screen);
    assert.equal(encode(w), before);
    activate('buy-inline');
    assert.equal(ui.screen, 'purchase');
    activate('cancel-purchase');
    assert.equal(encode(w), before);
    activate('buy-selected');
    assert.equal(ui.screen, 'purchase');
    activate('confirm-purchase');
    assert(installed(w), screen);
    assert(w.career.cash < 1000000);
  }
});

test('at-sea pause places Debug below reveal without changing the information preset', () => {
  const w = careerWorld(createCareer(37));
  w.day.phase = 'working';
  const ui = { screen: 'pause', input: { touchEnabled: true }, hooks: {}, revealUrchins: false };
  const before = JSON.stringify(w.career.assists);
  assert.equal(choices.call(ui, w)[2], 'Debug mode');
  assert.equal(choices.call(ui, w)[3], 'Arrange UI layout');
  assert.equal(choices.call(ui, w)[4], 'UI / difficulty options');
  assert.equal(JSON.stringify(w.career.assists), before);
});
