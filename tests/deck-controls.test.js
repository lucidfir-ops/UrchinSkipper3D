import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckCodes, looksLikeSteamDeck } from '../src/deck-controls.js';
import { installBackGuard } from '../src/back-guard.js';
import { DEFAULTS } from '../src/input.js';

test('Steam Deck desktop-layout keys steer the boat instead of firing thrusters', () => {
  const codes = (action) => deckCodes(action, DEFAULTS[action], true);
  assert(codes('throttleUp').includes('ArrowUp'));
  assert(codes('throttleDown').includes('ArrowDown'));
  assert(codes('left').includes('ArrowLeft'));
  assert(codes('right').includes('ArrowRight'));
  assert(codes('recoverDiver').includes('ControlLeft'), 'L1 deploys / boards');
  assert(codes('work').includes('AltLeft'), 'R1 exchanges a bag');
  for (const action of ['pivotPort', 'pivotStarboard', 'thrustPort', 'thrustStarboard'])
    assert(!codes(action).some((c) => c.startsWith('Arrow')), action);
  assert(!codes('debug').some((c) => c.startsWith('Shift')), 'back grip cannot toggle debug');
  // Menus keep arrows; A/B/Y/Start keep Enter/Escape/Space.
  assert(codes('menuUp').includes('ArrowUp'));
  assert(codes('confirm').includes('Enter'));
  assert(codes('pause').includes('Escape'));
  assert(codes('neutral').includes('Space'));
  // Without the layout, keyboard players keep their thrusters; the wheel zooms for all.
  assert.deepEqual(deckCodes('pivotPort', DEFAULTS.pivotPort, false), DEFAULTS.pivotPort);
  assert(deckCodes('zoomIn', DEFAULTS.zoomIn, false).includes('WheelUp'));
  assert(DEFAULTS.pause.includes('KeyP'), 'P opens the menu where Escape is taken');
});

test('Steam Deck detection uses Linux plus the Deck screen or a Valve pad', () => {
  const nav = (ua, ids = []) => ({ userAgent: ua, getGamepads: () => ids.map((id) => ({ id })) });
  const linux = 'Mozilla/5.0 (X11; Linux x86_64; rv:156.0) Gecko/20100101 Firefox/156.0';
  assert(looksLikeSteamDeck(nav(linux), { width: 1280, height: 800 }));
  assert(looksLikeSteamDeck(nav(linux, ['28de-11ff-Microsoft X-Box 360 pad 0']), {}));
  assert(!looksLikeSteamDeck(nav(linux), { width: 1920, height: 1080 }));
  assert(!looksLikeSteamDeck(nav('Mozilla/5.0 (Linux; Android 14)'), { width: 1280, height: 800 }));
});

function fakeWindow() {
  const listeners = {},
    on = (name, fn) => ((listeners[name] ||= []).push(fn), undefined);
  const win = {
    pushed: 0,
    history: { pushState: () => win.pushed++ },
    addEventListener: on,
    fire: (name, event = {}) => listeners[name]?.forEach((fn) => fn(event)),
  };
  const doc = { addEventListener: on, fullscreenElement: null };
  return { win, doc, fire: win.fire };
}

test('browser Back opens the pause menu once, then closes menus, then can leave', () => {
  const { win, doc, fire } = fakeWindow(),
    opened = [];
  const ui = {
    started: true,
    ended: false,
    screen: null,
    open: (s) => opened.push(s),
    back: () => opened.push('back'),
  };
  const armed = installBackGuard(ui, win, doc);
  fire('pointerdown', { isTrusted: false });
  assert.equal(win.pushed, 0, 'scripted events cannot arm the guard');
  fire('keydown', { isTrusted: true });
  fire('keydown', { isTrusted: true });
  assert.equal(win.pushed, 1);
  assert(armed());
  fire('popstate');
  assert.deepEqual(opened, ['pause']);
  assert(!armed());
  fire('popstate');
  assert.deepEqual(opened, ['pause'], 'a second Back without a gesture is left to the browser');
  ui.screen = 'pause';
  fire('pointerdown', { isTrusted: true });
  fire('popstate');
  assert.deepEqual(opened, ['pause', 'back']);
  ui.screen = null;
  fire('fullscreenchange');
  assert.deepEqual(opened, ['pause', 'back', 'pause'], 'leaving fullscreen pauses');
});

test('right clicks and long-presses never open the browser menu over the game', () => {
  const { win, doc, fire } = fakeWindow();
  installBackGuard({ started: false }, win, doc);
  const menu = (matches) => {
    const event = {
      target: { matches },
      prevented: false,
      preventDefault: () => (event.prevented = true),
    };
    fire('contextmenu', event);
    return event.prevented;
  };
  assert(
    menu(() => false),
    'sea, canvas and menus, even before a voyage starts',
  );
  assert(menu(undefined), 'targets such as the document itself');
  assert(!menu((selector) => selector.includes('textarea')), 'text entry keeps copy and paste');
});
