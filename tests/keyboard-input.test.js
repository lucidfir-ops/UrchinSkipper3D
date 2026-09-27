import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input, DEFAULTS } from '../src/input.js';
import { PREVIOUS_KEYBOARD, isGamepadCode } from '../src/keyboard-controls.js';

function setup(store = {}, pads = []) {
  const listeners = {};
  globalThis.window = {
    addEventListener: (name, fn) => {
      listeners[name] = fn;
    },
  };
  globalThis.localStorage = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = value;
    },
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { getGamepads: () => pads },
  });
  const input = new Input();
  const send = (type, code, extra = {}) => {
    const event = {
      code,
      target: { matches: () => false },
      preventDefault() {
        this.prevented = true;
      },
      ...extra,
    };
    listeners[type](event);
    return event;
  };
  return { input, store, send };
}
const padBindings = (map) =>
  Object.fromEntries(Object.entries(map).map(([a, codes]) => [a, codes.filter(isGamepadCode)]));
const oldMap = () =>
  Object.fromEntries(
    Object.entries(DEFAULTS).map(([action, codes]) => [
      action,
      [
        ...(PREVIOUS_KEYBOARD[action] || codes.filter((c) => !isGamepadCode(c))),
        ...codes.filter(isGamepadCode),
      ],
    ]),
  );

test('every requested keyboard key resolves its command, including arrow alternatives and separate neutral steering', () => {
  const { input, send } = setup();
  for (const [code, command, value] of [
    ['Tab', 'cycleDiver', true],
    ['KeyW', 'throttle', 1],
    ['KeyS', 'throttle', -1],
    ['KeyX', 'neutral', true],
    ['Space', 'neutral', true],
    ['Enter', 'centerRudder', true],
    ['KeyA', 'steer', -1],
    ['KeyD', 'steer', 1],
    ['KeyQ', 'pivot', -1],
    ['KeyE', 'pivot', 1],
    ['ArrowUp', 'pivot', -1],
    ['ArrowDown', 'pivot', 1],
    ['CapsLock', 'thruster', -1],
    ['KeyF', 'thruster', 1],
    ['ArrowLeft', 'thruster', -1],
    ['ArrowRight', 'thruster', 1],
    ['Digit1', 'recoverDiver', true],
    ['Digit2', 'work', true],
    ['Digit3', 'recall', true],
    ['Escape', 'keyboardEscape', true],
    ['Equal', 'zoom', 1],
    ['Minus', 'zoom', -1],
    ['ShiftLeft', 'debug', true],
    ['ShiftRight', 'debug', true],
  ]) {
    send('keydown', code);
    send('keyup', code);
    const actions = input.poll();
    assert.equal(actions[command], value, code);
    if (command === 'neutral') {
      assert(!actions.work);
      assert(!actions.recoverDiver);
      assert(!actions.centerRudder);
    }
    input.poll();
  }
});

test('unchanged old keyboard defaults migrate once while every controller binding survives reload', () => {
  const old = oldMap();
  old.recoverDiver = ['KeyX', 'b11'];
  old.assists = ['F6'];
  const store = { 'urchin-input-v3': JSON.stringify(old) };
  const first = setup(store).input;
  assert.deepEqual(padBindings(first.map), padBindings(old));
  for (const action of Object.keys(DEFAULTS))
    assert.deepEqual(
      first.map[action].filter((c) => !isGamepadCode(c)),
      DEFAULTS[action].filter((c) => !isGamepadCode(c)),
    );
  assert.equal(store['urchin-input-before-keyboard-20260915'], JSON.stringify(old));
  first.beginCapture('work', 'keyboard');
  assert(first.assign('KeyY'));
  const second = setup(store).input;
  assert.deepEqual(second.map.work, ['KeyY', 'b3']);
  assert.deepEqual(padBindings(second.map), padBindings(old));
  assert.equal(store['urchin-input-before-keyboard-20260915'], JSON.stringify(old));
});

test('custom keyboard keys take priority over new defaults without resetting pad profiles', () => {
  const old = oldMap();
  old.throttleUp = ['KeyA', 'a1-'];
  old.recall = ['Digit2', 'b0'];
  const { input } = setup({ 'urchin-input-v3': JSON.stringify(old) });
  assert.deepEqual(input.map.throttleUp, old.throttleUp);
  assert.deepEqual(input.map.recall, old.recall);
  assert.deepEqual(input.map.left, ['a2-']);
  assert.deepEqual(input.map.work, ['b3']);
  assert.deepEqual(padBindings(input.map), padBindings(old));
});

test('saving keyboard-only changes cannot turn a first standard controller into an old X/Y layout', () => {
  const { input, store } = setup();
  input.reset('keyboard');
  const pad = {
    id: 'First Xbox',
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0 })),
  };
  const reloaded = setup(store, [pad]).input;
  reloaded.poll();
  assert(reloaded.map.work.includes('b2'));
  assert(reloaded.map.recoverDiver.includes('b3'));
});

test('reset keyboard preserves custom controller bindings and reset controller preserves keyboard', () => {
  const pad = {
    id: 'Verified Xbox',
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0 })),
  };
  const { input, store } = setup({}, [pad]);
  input.poll();
  input.beginCapture('recoverDiver', 'gamepad');
  assert(input.assign('b11'));
  input.beginCapture('throttleUp', 'keyboard');
  assert(input.assign('KeyZ'));
  const gamepad = padBindings(input.map);
  input.reset('keyboard');
  assert.deepEqual(padBindings(input.map), gamepad);
  assert.deepEqual(input.map.throttleUp, ['KeyW', 'a1-']);
  input.beginCapture('throttleUp', 'keyboard');
  assert(input.assign('KeyZ'));
  input.reset('gamepad');
  assert(input.map.throttleUp.includes('KeyZ'));
  assert(input.map.recoverDiver.includes('b3'));
  const reloaded = setup(store, [pad]).input;
  reloaded.poll();
  assert(input.map.throttleUp.includes('KeyZ'));
  assert(reloaded.map.recoverDiver.includes('b3'));
});

test('single browser keys are cancelled, text fields remain usable, and modified shortcuts are untouched', () => {
  const { input, send } = setup();
  for (const code of [
    'Escape',
    'F1',
    'F2',
    'F3',
    'F5',
    'F6',
    'F7',
    'F10',
    'F11',
    'F12',
    'BrowserHome',
    'BrowserBack',
    'Slash',
    'Quote',
    'Home',
    'Backspace',
  ]) {
    assert(send('keydown', code).prevented, code);
    assert(send('keyup', code).prevented, code);
  }
  input.poll();
  for (const [code, modifiers] of [
    ['Tab', { altKey: true }],
    ['F4', { altKey: true }],
    ['KeyF', { ctrlKey: true }],
    ['KeyW', { metaKey: true }],
    ['F3', { shiftKey: true }],
  ]) {
    assert(!send('keydown', code, modifiers).prevented, code);
    assert(!send('keyup', code, modifiers).prevented, code);
    assert.equal(input.poll().throttle, 0);
  }
  const target = { matches: () => true };
  assert(!send('keydown', 'KeyA', { target }).prevented);
  assert(!send('keydown', 'ArrowDown', { target }).prevented);
  assert(send('keydown', 'F5', { target }).prevented);
  assert(send('keydown', 'Escape', { target }).prevented);
});

test('Shift taps cycle details but Shift chords and the plus key never also cycle details', () => {
  const { input, send } = setup();
  send('keydown', 'ShiftLeft', { shiftKey: true });
  assert(!input.poll().debug);
  send('keyup', 'ShiftLeft');
  assert(input.poll().debug);
  input.poll();
  send('keydown', 'ShiftLeft', { shiftKey: true });
  assert(send('keydown', 'Equal', { shiftKey: true, key: '+' }).prevented);
  assert.equal(input.poll().zoom, 1);
  send('keyup', 'Equal', { shiftKey: true, key: '+' });
  send('keyup', 'ShiftLeft');
  assert(!input.poll().debug);
  send('keydown', 'ShiftLeft', { shiftKey: true });
  assert(!send('keydown', 'F3', { shiftKey: true }).prevented);
  send('keyup', 'F3', { shiftKey: true });
  send('keyup', 'ShiftLeft');
  assert(!input.poll().debug);
});

test('Escape cancels physical capture and naming even when a short press ends between frames', () => {
  const { input, send } = setup();
  input.beginCapture('throttleUp', 'keyboard');
  input.poll();
  send('keydown', 'Escape');
  send('keyup', 'Escape');
  assert(!input.poll().keyboardEscape);
  assert.equal(input.capture, null);
  input.nameButtons();
  send('keydown', 'Escape');
  send('keyup', 'Escape');
  input.poll();
  assert.equal(input.naming, null);
});
