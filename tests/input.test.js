import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input, DEFAULTS } from '../src/input.js';
function setup(saved = JSON.stringify(DEFAULTS)) {
  const listeners = {},
    storage = {};
  globalThis.window = {
    addEventListener(name, fn) {
      listeners[name] = fn;
    },
  };
  globalThis.localStorage = {
    getItem() {
      return saved;
    },
    setItem(k, v) {
      storage[k] = v;
    },
  };
  const p = {
    id: 'Synthetic Deck',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0 })),
  };
  let pads = [p];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { getGamepads: () => pads },
  });
  return { input: new Input(), p, listeners, storage, setPads: (v) => (pads = v) };
}
test('left-stick diagonal commands never change throttle and thrust together', () => {
  const { input, p } = setup();
  input.poll();
  p.axes[0] = 0.6;
  p.axes[1] = -0.8;
  let action = input.poll();
  assert(action.throttle > 0);
  assert.equal(action.thruster, 0);
  p.axes[0] = 0.9;
  p.axes[1] = -0.4;
  action = input.poll();
  assert.equal(action.throttle, 0);
  assert(action.thruster > 0);
  p.axes[0] = p.axes[1] = 0;
  action = input.poll();
  assert.equal(action.throttle, 0);
  assert.equal(action.thruster, 0);
});
test('independent touch pointers steer and throttle together, release separately, and cancel on suppression', () => {
  const { input, setPads } = setup();
  setPads([]);
  input.touchEnabled = true;
  input.poll();
  input.setTouch(1, { throttleUp: 0.8 });
  input.setTouch(2, { right: 0.7 });
  const a = input.poll();
  assert(a.throttle > 0);
  assert(a.steer > 0);
  input.setTouch(1, null);
  input.poll();
  assert.equal(input.resolved.throttle, 0);
  assert(input.resolved.steer > 0);
  input.suppress();
  input.poll();
  input.poll();
  assert.equal(input.resolved.steer, 0);
  assert.equal(input.touchSources.size, 0);
  input.setTouch(3, { recoverDiver: 1 });
  input.setTouch(3, null);
  assert(input.poll().recoverDiver, 'a tap between frames is delivered once');
  assert(!input.poll().recoverDiver);
  input.setTouch(4, { fullAhead: 1 });
  input.setTouch(4, null, true);
  assert(!input.poll().fullAhead, 'cancelled contact cannot issue a pending command');
});
test('older device profiles retain X/Y and custom boarding when optional shortcuts are added', () => {
  const map = structuredClone(DEFAULTS);
  delete map.chart;
  delete map.quickOrders;
  delete map.assists;
  map.recoverDiver = ['KeyX', 'b11'];
  const key = 'Synthetic Deck|standard|17/4';
  const { input, p } = setup(
    JSON.stringify({
      version: 1,
      legacyOwner: key,
      devices: {
        [key]: {
          map,
          faceNames: { b2: 'Y', b3: 'X', b11: 'Y' },
          trusted: true,
          explicit: ['recoverDiver'],
          legacy: true,
        },
      },
    }),
  );
  input.poll();
  assert.deepEqual(input.map.recoverDiver, ['Digit1', 'b11']);
  assert(input.map.work.includes('b3'));
  assert(!input.map.quickOrders.includes('b11'));
  assert(input.map.chart.includes('b10'));
  p.buttons[11].value = 1;
  assert(input.poll().recoverDiver);
  p.buttons[11].value = 0;
  input.poll();
  p.buttons[3].value = 1;
  assert(input.poll().work);
});
test('analog input resolves magnitude; released stick resolves zero; diver recovery has one edge', () => {
  const { input, p } = setup();
  p.axes[1] = -1;
  p.axes[2] = 0.8;
  p.buttons[7].value = 1;
  p.buttons[2].value = 1;
  let a = input.poll();
  assert.equal(a.throttle, 1);
  assert(a.steer > 0.7);
  assert.equal(a.zoom, 1);
  assert(a.recoverDiver);
  assert(!('bag' in a));
  assert(!('recover' in a));
  assert.equal(input.poll().recoverDiver, false);
  p.axes = [0, 0, 0, 0];
  p.buttons[7].value = 0;
  a = input.poll();
  assert.equal(a.throttle, 0);
  assert.equal(a.steer, 0);
  p.axes[1] = -0.59;
  assert(Math.abs(input.poll().throttle - 0.5) < 0.001);
  p.axes[1] = 0.15;
  assert.equal(input.poll().throttle, 0);
});
test('controller Back suppression consumes a held B until a physical release', () => {
  const { input, p } = setup();
  input.poll();
  p.buttons[1].value = 1;
  assert(input.poll().back);
  input.suppress();
  assert(!input.poll().back);
  assert(input.suppressed);
  p.buttons[1].value = 0;
  assert(!input.poll().back);
  assert(!input.suppressed);
  p.buttons[1].value = 1;
  assert(input.poll().back);
});
test('D-pad resolves immediate Full Ahead / Full Reverse commands', () => {
  const { input, p } = setup();
  p.buttons[12].value = 1;
  assert(input.poll().fullAhead);
  assert(!input.poll().fullAhead);
  p.buttons[12].value = 0;
  p.buttons[13].value = 1;
  assert(input.poll().fullReverse);
});
test('controller polls from startup, tolerates delayed browser exposure and disconnect', () => {
  const { input, setPads, p } = setup();
  setPads([]);
  input.poll();
  assert(!input.connected);
  setPads([p]);
  input.poll();
  assert(input.connected);
  setPads([]);
  assert.equal(input.poll().throttle, 0);
  assert(!input.connected);
});
test('rebind waits for release, applies immediately, persists, and suppresses capture input', () => {
  const { input, p, storage } = setup();
  p.buttons[0].value = 1;
  input.poll();
  input.beginCapture('recoverDiver');
  input.poll();
  assert(input.capture.waitRelease);
  p.buttons[0].value = 0;
  input.poll();
  assert(!input.capture.waitRelease);
  p.buttons[11].value = 1;
  assert(!input.poll().recoverDiver);
  assert.equal(input.capture, null);
  assert.equal(input.label('recoverDiver', 'gamepad'), 'R3');
  assert(
    JSON.parse(storage['urchin-device-profiles-v1']).devices[
      input.profileKey
    ].map.recoverDiver.includes('b11'),
  );
  assert(!input.poll().recoverDiver);
  p.buttons[11].value = 0;
  input.poll();
  p.buttons[11].value = 1;
  assert(input.poll().recoverDiver);
  p.buttons[11].value = 0;
  p.buttons[2].value = 1;
  assert(!input.poll().recoverDiver);
});
test('axis binding works, gameplay conflicts rejected, cross-context shared input allowed', () => {
  const { input, p } = setup();
  input.beginCapture('throttleUp');
  input.poll();
  p.axes[3] = -1;
  input.poll();
  assert(input.map.throttleUp.includes('a3-'));
  p.axes[3] = 0;
  input.poll();
  input.beginCapture('recoverDiver');
  input.poll();
  p.buttons[3].value = 1;
  input.poll();
  assert(input.capture);
  assert.match(input.notice, /already controls Take \+ give bag/);
  p.buttons[3].value = 0;
  input.poll();
  p.buttons[0].value = 1;
  input.poll();
  assert.equal(input.capture, null);
  assert(input.map.confirm.includes('b0'));
  assert(!input.map.recall.includes('b0'), 'default recall yields to explicit custom bindings');
  assert(input.map.work.includes('b3'));
});
test('capture can cancel with abstract Back/Pause or timeout and reset restores defaults', () => {
  const { input, p } = setup();
  input.beginCapture('recoverDiver');
  input.poll();
  p.buttons[1].value = 1;
  input.poll();
  assert.equal(input.capture, null);
  assert.match(input.notice, /CANCELLED/);
  p.buttons[1].value = 0;
  input.poll();
  input.beginCapture('recoverDiver');
  input.poll();
  p.buttons[9].value = 1;
  input.poll();
  assert.equal(input.capture, null);
  p.buttons[9].value = 0;
  input.poll();
  input.beginCapture('recoverDiver');
  input.poll(20);
  assert.equal(input.capture, null);
  assert.match(input.notice, /TIMED OUT/);
  input.beginCapture('recoverDiver');
  input.assign('b11');
  input.reset();
  assert.deepEqual(input.map, DEFAULTS);
});
test('held menu/capture inputs cannot leak into gameplay on close', () => {
  const { input, p } = setup();
  p.buttons[0].value = 1;
  p.axes[1] = -1;
  input.poll();
  input.suppress();
  assert.equal(input.poll().throttle, 0);
  p.buttons[0].value = 0;
  assert.equal(input.poll().throttle, 0);
  p.axes[1] = 0;
  input.poll();
  p.axes[1] = -1;
  assert.equal(input.poll().throttle, 1);
});
test('short keyboard presses survive frames and repeated keydown does not repeat actions', () => {
  const { input, listeners } = setup(),
    event = { code: 'Digit2', target: { matches: () => false }, preventDefault() {} };
  listeners.keydown(event);
  listeners.keyup(event);
  assert(input.poll().work);
  assert(!input.poll().work);
  listeners.keydown({ ...event, repeat: true });
  assert(!input.poll().work);
});
test('invalid saved bindings recover usable defaults; labels reflect actual maps', () => {
  const { input } = setup(JSON.stringify({ ...DEFAULTS, pause: ['b0'] }));
  assert.deepEqual(input.map, DEFAULTS);
  input.beginCapture('pause');
  assert(input.assign('b11'));
  assert.equal(input.label('pause', 'gamepad'), 'R3');
  assert.equal(input.label('throttleUp', 'gamepad'), 'Left stick Up');
});

test('legacy actions remain unchanged and unverified labels use browser-standard X/Y positions', () => {
  const { input, p } = setup();
  p.buttons[3].value = 1;
  assert(input.poll().work);
  p.buttons[3].value = 0;
  input.poll();
  assert.equal(input.label('work', 'gamepad'), 'Y');
  assert.equal(input.label('recoverDiver', 'gamepad'), 'X');
  for (const index of [14, 15]) {
    p.buttons[index].value = 1;
    assert(input.poll().neutral);
    p.buttons[index].value = 0;
    input.poll();
  }
  p.buttons[2].value = 1;
  assert(input.poll().recoverDiver);
});
test('fresh Bluetooth activity takes over from a stale USB pad without a stuck release gate', () => {
  const { input, p, setPads } = setup();
  p.index = 0;
  p.axes[1] = -1;
  input.poll();
  const bluetooth = {
    ...p,
    index: 1,
    id: 'Bluetooth Xbox',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0 })),
  };
  setPads([p, bluetooth]);
  input.poll();
  bluetooth.buttons[2].value = 1;
  assert(input.poll().work);
  assert.equal(input.activePad, bluetooth);
  input.suppress();
  bluetooth.buttons[2].value = 0;
  input.poll();
  assert(!input.suppressed);
  assert.equal(input.poll().throttle, 0);
});
test('physical face naming changes labels only, retaining every saved gameplay input', () => {
  const { input, p } = setup(),
    before = structuredClone(input.map);
  input.nameButtons();
  input.poll();
  for (const index of [0, 1, 3, 2]) {
    p.buttons[index].value = 1;
    input.poll();
    p.buttons[index].value = 0;
    input.poll();
  }
  assert.equal(input.naming, null);
  assert.deepEqual(input.map, before);
  assert.equal(input.label('work', 'gamepad'), 'X');
  assert.equal(input.label('recoverDiver', 'gamepad'), 'Y');
});
test('new diver/chart shortcuts yield to legacy remaps without exchanging work/boarding', () => {
  const old = { ...DEFAULTS, recoverDiver: ['KeyX', 'b4'], menuDown: ['ArrowDown', 'b10'] };
  delete old.cycleDiver;
  delete old.chart;
  const { input } = setup(JSON.stringify(old));
  assert.deepEqual(input.map.recoverDiver, ['Digit1', 'b4']);
  assert.deepEqual(input.map.work, old.work);
  assert(!input.map.cycleDiver.includes('b4'));
  assert(!input.map.chart.includes('b10'));
  assert(input.map.cycleDiver.includes('Tab'));
});
test('same held button on a newly active pad creates its own edge', () => {
  const { input, p, setPads } = setup();
  p.index = 0;
  p.buttons[3].value = 1;
  input.poll();
  const next = {
    ...p,
    index: 1,
    id: 'Replacement pad',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0 })),
  };
  setPads([p, next]);
  input.poll();
  next.buttons[2].value = 1;
  assert(input.poll().work);
  assert.equal(input.activePad, next);
});
test('nonstandard physical face names survive reload and remap notices use those names', () => {
  const { input } = setup(JSON.stringify({ b0: 'A', b1: 'B', b11: 'X', b2: 'Y' }));
  input.beginCapture('work');
  assert(input.assign('b11'));
  assert.equal(input.label('work', 'gamepad'), 'X');
  assert.match(input.notice, /→ X · APPLIED/);
});

test('left-stick horizontal docking thrust is proportional, releases to zero, and stays suppressed through menus', () => {
  const { input, p } = setup();
  p.axes[0] = 0.59;
  assert(Math.abs(input.poll().thruster - 0.5) < 1e-7);
  p.axes[0] = -1;
  assert.equal(input.poll().thruster, -1);
  input.suppress();
  assert.equal(input.poll().thruster || 0, 0);
  p.axes[0] = 0;
  input.poll();
  p.axes[0] = 1;
  assert.equal(input.poll().thruster, 1);
  p.axes[0] = 0;
  assert.equal(input.poll().thruster, 0);
});
test('new docking bindings yield to an older custom left-stick helm without resetting X/Y', () => {
  const old = { ...DEFAULTS, left: ['a0-'], right: ['a0+'] };
  delete old.thrustPort;
  delete old.thrustStarboard;
  const { input } = setup(JSON.stringify(old));
  assert.deepEqual(input.map.left, ['a0-']);
  assert.deepEqual(input.map.thrustPort, ['CapsLock', 'ArrowLeft']);
  assert(input.map.work.includes('b3'));
  assert(input.map.recoverDiver.includes('b2'));
});

test('device profiles preserve the existing pad and keep a newly mapped controller independent across reconnects', () => {
  const { input, p, setPads, storage } = setup();
  input.poll();
  input.beginCapture('recoverDiver');
  assert(input.assign('b11'));
  const other = {
    ...p,
    id: 'Other standard Xbox',
    mapping: 'standard',
    index: 1,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0 })),
  };
  setPads([other]);
  input.poll();
  assert(input.map.recoverDiver.includes('b3'));
  assert(input.map.work.includes('b2'));
  input.beginCapture('recoverDiver');
  assert(input.assign('b10') === false, 'chart still owns L3');
  input.capture = null;
  setPads([{ ...p, index: 4 }]);
  input.poll();
  assert(input.map.recoverDiver.includes('b11'));
  assert(input.map.work.includes('b3'));
  const profiles = JSON.parse(storage['urchin-device-profiles-v1']);
  assert.equal(Object.keys(profiles.devices).length, 2);
});
test('unrecognized raw axes cannot drive the vessel; idle negative triggers do not trap the release gate', () => {
  const { input, p } = setup();
  p.mapping = '';
  p.axes = [0, 0, -1, -1];
  input.poll();
  assert(input.needsMapping);
  input.suppress();
  input.poll();
  assert(!input.suppressed);
  p.axes[1] = -1;
  assert.equal(input.poll().throttle, 0);
  p.axes[1] = 0;
  input.beginCapture('throttleUp');
  input.poll();
  p.axes[1] = -1;
  input.poll();
  assert(input.map.throttleUp.includes('a1-'));
  p.axes[1] = 0;
  input.poll();
  p.axes[1] = -1;
  assert.equal(input.poll().throttle, 1);
  assert.equal(input.poll().steer, 0);
});
test('physical X/Y verification binds their distinct actions without changing helm controls', () => {
  const { input, p } = setup();
  input.poll();
  const helm = structuredClone(input.map.throttleUp);
  input.checkRecoveryButtons();
  input.poll();
  for (const index of [2, 3]) {
    p.buttons[index].value = 1;
    input.poll();
    p.buttons[index].value = 0;
    input.poll();
  }
  assert(!input.naming);
  assert.deepEqual(input.map.throttleUp, helm);
  assert(input.map.work.includes('b2'));
  assert(input.map.recoverDiver.includes('b3'));
  assert.equal(input.label('work', 'gamepad'), 'X');
  assert.equal(input.label('recoverDiver', 'gamepad'), 'Y');
});
test('desktop modifier shortcuts cannot become a propulsion command inside the browser', () => {
  const { input, listeners } = setup();
  listeners.keydown({
    code: 'KeyW',
    metaKey: true,
    target: { matches: () => false },
    preventDefault() {},
  });
  assert.equal(input.poll().throttle, 0);
  assert(!input.keys.size);
});

test('fresh standard controller uses physical X for bags and Y for boarding', () => {
  const { input, p } = setup(null);
  p.mapping = 'standard';
  input.poll();
  assert(input.map.work.includes('b2'));
  assert(input.map.recoverDiver.includes('b3'));
  p.buttons[2].value = 1;
  assert(input.poll().work);
  p.buttons[2].value = 0;
  input.poll();
  p.buttons[3].value = 1;
  assert(input.poll().recoverDiver);
  assert.equal(input.label('work', 'gamepad'), 'X');
  assert.equal(input.label('recoverDiver', 'gamepad'), 'Y');
});

test('a fresh standard profile cannot claim legacy defaults for a second controller after reload', () => {
  const { input, p, setPads, storage } = setup(null);
  p.mapping = 'standard';
  input.poll();
  globalThis.localStorage.getItem = (k) => storage[k] || null;
  const restored = new Input();
  restored.poll();
  setPads([{ ...p, id: 'Second fresh Xbox', index: 1 }]);
  restored.poll();
  assert(restored.map.work.includes('b2'));
  assert(restored.map.recoverDiver.includes('b3'));
});
