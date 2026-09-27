import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaytestUI } from '../src/playtest-ui.js';
import { createWorld } from '../src/world.js';
function setup(phase = 'practice') {
  globalThis.document = { hidden: false, hasFocus: () => true };
  let w = createWorld({ practice: phase === 'practice' }),
    resets = 0;
  const ui = Object.create(PlaytestUI.prototype);
  Object.assign(ui, {
    started: true,
    fallback: false,
    ended: false,
    screen: 'pause',
    index: 5,
    history: [{ screen: 'chart', index: 1 }],
    messages: [],
    input: {
      connected: true,
      activePad: { id: 'Preconnected Xbox' },
      raw: {},
      label: () => '',
      cancelNaming() {},
      suppress() {
        this.suppressed = true;
      },
    },
    panel: {
      scrollTop: 0,
      scrollLeft: 0,
      querySelectorAll() {
        return [0, 1, 2, 3].map((i) => ({
          dataset: { choiceIndex: String(i) },
          getBoundingClientRect: () => ({ x: 0, y: i * 50, width: 200, height: 40 }),
        }));
      },
    },
    canvas: { focus() {} },
    start: { querySelectorAll: () => [] },
    status: {},
    render() {},
    notify() {},
    hooks: {
      world: () => w,
      reset() {
        resets++;
        w = createWorld({ practice: phase === 'practice' });
      },
    },
  });
  return { ui, world: () => w, resets: () => resets };
}
test('Session Ended freezes simulation while B restores the prior screen, choice and history', () => {
  const { ui, world } = setup();
  const before = JSON.stringify(world());
  ui.exit();
  assert(ui.ended);
  assert.equal(ui.lockReason, 'SESSION ENDED');
  ui.update({ menuDown: true }, world());
  assert.equal(ui.index, 1);
  ui.update({ back: true }, world());
  assert(!ui.ended);
  assert.equal(ui.screen, 'pause');
  assert.equal(ui.index, 5);
  assert.deepEqual(ui.history, [{ screen: 'chart', index: 1 }]);
  assert.equal(JSON.stringify(world()), before);
});
test('Retry makes one fresh trip; Launcher stays on title with preconnected controller even during planning', () => {
  const a = setup();
  a.world().catch = 100;
  a.ui.exit();
  a.ui.index = 1;
  a.ui.activate(a.world());
  assert.equal(a.resets(), 1);
  assert.equal(a.world().catch, 0);
  assert(!a.ui.ended);
  const { ui, world } = setup('planning');
  ui.exit();
  ui.index = 2;
  ui.activate(world());
  assert(!ui.started);
  ui.update({}, world());
  assert.equal(ui.screen, null);
  assert(!ui.start.hidden);
  ui.update({ confirm: true }, world());
  assert(ui.started);
  assert.equal(ui.screen, 'chart');
});

test('left/right keeps the remapping row and prototype drop action while changing their secondary setting', () => {
  const { ui, world } = setup('planning');
  ui.panel.querySelectorAll = () =>
    [
      { id: -1, x: 0, y: 0 },
      { id: 0, x: 250, y: 70 },
    ].map((p) => ({
      dataset: { choiceIndex: String(p.id) },
      getBoundingClientRect: () => ({ x: p.x, y: p.y, width: 100, height: 40 }),
    }));
  ui.screen = 'bindings';
  ui.index = 0;
  ui.remapDevice = 'gamepad';
  ui.update({ menuLeft: true }, world());
  assert.equal(ui.index, 0);
  assert.equal(ui.remapDevice, 'keyboard');
  ui.screen = 'departure';
  ui.index = 0;
  ui.chartGroundId = 'near';
  ui.chartPatchId = 'good';
  ui.update({ menuLeft: true }, world());
  assert.equal(ui.index, 0);
  assert(ui.chartPatchId);
});

test('repeated helm feedback cannot bury a radio notice or fill message history', () => {
  const { ui } = setup();
  PlaytestUI.prototype.notify.call(ui, 'RADIO · WEATHER CHANGING');
  for (let i = 0; i < 20; i++) PlaytestUI.prototype.notify.call(ui, `THROTTLE ${i}%`);
  assert(ui.messages.some((m) => m.text.includes('WEATHER CHANGING')));
  assert.equal(ui.radioLog.length, 1);
  assert.equal(ui.messages.length, 2);
});

test('horizontal header navigation reaches Forward without changing the remapping device', () => {
  const { ui, world } = setup();
  ui.screen = 'bindings';
  ui.index = -1;
  ui.bindingView = 'controller';
  ui.remapDevice = 'gamepad';
  ui.panel.querySelectorAll = () =>
    [
      { id: -1, x: 0, y: 0 },
      { id: -2, x: 110, y: 0 },
      { id: 0, x: 0, y: 80 },
    ].map((p) => ({
      dataset: { choiceIndex: String(p.id) },
      getBoundingClientRect: () => ({ x: p.x, y: p.y, width: 90, height: 44 }),
    }));
  ui.update({ menuRight: true }, world());
  assert.equal(ui.index, -2);
  assert.equal(ui.bindingView, 'controller');
  assert.equal(ui.remapDevice, 'gamepad');
});

test('Escape and Menu retain their behavior; Back returns sea Settings to the water', () => {
  const { ui, world } = setup();
  ui.screen = 'bindings';
  ui.history = [{ screen: null }, { screen: 'pause' }, { screen: 'settings' }];
  ui.update({ keyboardEscape: true, pause: true }, world());
  assert.equal(ui.screen, null);
  assert.deepEqual(ui.history, []);
  ui.update({ keyboardEscape: true, pause: true }, world());
  assert.equal(ui.screen, 'pause');
  ui.screen = 'bindings';
  ui.history = [{ screen: 'settings', index: 3 }];
  ui.update({ pause: true }, world());
  assert.equal(ui.screen, 'settings');
  assert.equal(ui.index, 3);
  ui.screen = 'bindings';
  ui.history = [{ screen: 'settings', index: 3 }];
  ui.update({ back: true }, world());
  assert.equal(ui.screen, 'settings');
  assert(ui.started);
  ui.update({ back: true }, world());
  assert.equal(ui.screen, null);
  assert(ui.started);
  assert.deepEqual(ui.history, []);
  ui.forward();
  assert.equal(ui.screen, null);
});

test('multiple Back/Forward steps retain each menu, chart choices and scroll without executing actions', () => {
  const { ui, world } = setup('planning');
  world().career = { starterPending: false };
  let saves = 0;
  ui.hooks.save = () => saves++;
  ui.screen = 'harbour';
  ui.history = [];
  ui.open('chart');
  ui.index = 1;
  ui.chartGroundId = 'middle';
  ui.open('departure');
  ui.index = 2;
  ui.chartGroundId = 'far';
  ui.arrivalLane = 3;
  ui.panel.scrollTop = 240;
  const before = JSON.stringify(world());
  ui.back();
  assert.equal(ui.screen, 'chart');
  assert.equal(ui.index, 1);
  assert.equal(ui.chartGroundId, 'middle');
  ui.back();
  assert.equal(ui.screen, 'harbour');
  ui.back();
  assert(!ui.started);
  assert.equal(saves, 1);
  assert.equal(ui.screen, null);
  ui.forward();
  assert.equal(ui.screen, 'harbour');
  ui.forward();
  assert.equal(ui.screen, 'chart');
  ui.forward();
  assert.equal(ui.screen, 'departure');
  assert.equal(ui.index, 2);
  assert.equal(ui.chartGroundId, 'far');
  assert.equal(ui.arrivalLane, 3);
  assert.equal(ui.pendingScroll.top, 240);
  assert.equal(JSON.stringify(world()), before);
  ui.forward();
  assert.equal(ui.screen, 'departure');
});

test('Back dismisses a purchase; Forward cannot revive its transaction or cross a world replacement', () => {
  const { ui, world } = setup('planning');
  world().career = { starterPending: false };
  ui.screen = 'purchase';
  ui.history = [{ screen: 'accounts', index: 2 }];
  ui.pendingPurchase = {
    run() {
      throw new Error('must not run');
    },
  };
  ui.back();
  assert.equal(ui.pendingPurchase, null);
  assert.equal(ui.screen, 'accounts');
  assert(ui.started);
  ui.forward();
  assert.equal(ui.screen, 'accounts');
  ui.back();
  ui.hooks.reset();
  ui.forward();
  assert(ui.started);
  assert.equal(ui.screen, 'harbour');
});

test('Settings suboptions always return to Settings, then Settings returns to Harbour', () => {
  const { ui, world } = setup('planning');
  world().career = { starterPending: false };
  for (const submenu of [
    'layout',
    'assists',
    'controller',
    'bindings',
    'ui-scale',
    'touch-options',
    'gameplay-speed',
  ]) {
    ui.screen = 'settings';
    ui.history = [{ screen: 'harbour', index: 0 }];
    ui.forwardHistory = [];
    ui.open(submenu);
    ui.back();
    assert.equal(ui.screen, 'settings', submenu);
    assert.deepEqual(ui.history, [{ screen: 'harbour', index: 0 }], submenu);
  }
  ui.back();
  assert.equal(ui.screen, 'harbour');
  assert.deepEqual(ui.history, []);
});

test('Back from an on-water pause always resumes gameplay', () => {
  const { ui } = setup();
  ui.screen = 'pause';
  ui.history = [{ screen: 'settings', index: 0 }];
  ui.back();
  assert.equal(ui.screen, null);
  assert(ui.started);
  assert(ui.input.suppressed, 'held controller inputs remain gated until release');
  assert.deepEqual(ui.history, []);
  assert.deepEqual(ui.forwardHistory, []);
});

test('Resume and repeated Back routes cannot reuse stale menu history', () => {
  const { ui, world } = setup();
  for (let repeat = 0; repeat < 3; repeat++) {
    ui.screen = 'pause';
    ui.history = [
      { screen: 'settings', index: 0 },
      { screen: 'bindings', index: 3 },
    ];
    ui.index = 0;
    ui.activate(world());
    assert.equal(ui.screen, null);
    assert.deepEqual(ui.history, []);
    assert(ui.input.suppressed);
  }
});

test('opening a new route after Back clears Forward; resuming gameplay cannot reopen old menus', () => {
  const { ui } = setup();
  ui.history = [];
  ui.screen = 'pause';
  ui.open('settings');
  ui.open('bindings');
  ui.back();
  assert.equal(ui.screen, 'settings');
  assert.equal(ui.forwardHistory.length, 0);
  ui.open('help');
  ui.forward();
  assert.equal(ui.screen, 'help');
  assert.equal(ui.forwardHistory.length, 0);
  ui.back();
  ui.open(null);
  ui.forward();
  assert.equal(ui.screen, null);
  assert.equal(ui.forwardHistory.length, 0);
});

test('title-root history retains a test world for Forward while explicit leave still restores career', () => {
  const { ui, world } = setup('planning');
  world().career = { sandbox: true };
  let leaves = 0;
  ui.hooks.sandbox = () => leaves++;
  ui.screen = 'harbour';
  ui.history = [];
  ui.back();
  assert(!ui.started);
  assert.equal(leaves, 0);
  ui.forward();
  assert.equal(ui.screen, 'harbour');
  assert.equal(leaves, 0);
  ui.showTitle();
  assert.equal(leaves, 1);
  assert.equal(ui.forwardHistory.length, 0);
});

test('keyboard Escape returns to harbour and opens/closes its menu without visiting title', () => {
  const { ui, world } = setup('planning');
  world().career = { starterPending: false };
  ui.screen = 'bindings';
  ui.escapeMenu();
  assert.equal(ui.screen, 'harbour');
  assert(ui.started);
  ui.escapeMenu();
  assert.equal(ui.screen, 'pause');
  ui.escapeMenu();
  assert.equal(ui.screen, 'harbour');
  assert.deepEqual(ui.history, []);
  world().day.phase = 'complete';
  ui.screen = 'settings';
  ui.escapeMenu();
  assert.equal(ui.screen, 'summary', 'offload receipt is retained until next-day preparation');
});

test('explicit prototype sessions retain their world on the launcher title; main-game labs return to career', () => {
  const { ui, world } = setup();
  let resumes = 0;
  ui.hooks.resumeCareer = () => {
    resumes++;
  };
  ui.hooks.prototypeOnly = true;
  const before = world();
  ui.showTitle();
  assert.equal(world(), before);
  assert.equal(resumes, 0);
  ui.hooks.prototypeOnly = false;
  ui.showTitle();
  assert.equal(resumes, 1);
});
