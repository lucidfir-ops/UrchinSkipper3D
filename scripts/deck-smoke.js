import { gamepadScript, pressGamepad, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('crash', () => console.error('CONTROLLER HARNESS: page crash'));
  browser.on('disconnected', () => console.log('CONTROLLER HARNESS: browser disconnected'));
  page.setDefaultTimeout(20000);
  await page.addInitScript(gamepadScript, { name: 'fakePad', absent: true });
  await page.goto((process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/') + '?practice=1');
  await page.waitForFunction(() => window.urchinDebug?.ui);
  assert.equal(await page.evaluate(() => urchinDebug.world.time), 0);
  await page.evaluate(() => {
    window.fakePad = {
      id: 'Synthetic Deck',
      mapping: 'standard',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
    };
    fakePad.buttons[0].value = 1;
  });
  await page.waitForFunction(() => urchinDebug.ui.started);
  assert.equal(await page.evaluate(() => urchinDebug.world.diver.state), 'ready');
  async function rawButton(i, value) {
    await page.evaluate(
      ({ i, value }) => {
        fakePad.buttons[i] = { value, pressed: !!value };
      },
      { i, value },
    );
    await page.waitForFunction(
      ({ i, value }) => !!urchinDebug.input.buttonPrevious[`pad0/b${i}`] === !!value,
      { i, value },
    );
  }
  async function button(i) {
    return pressGamepad(page, 'fakePad', i);
  }
  async function action(name) {
    return pressAction(page, 'fakePad', name);
  }
  async function choose(prefix) {
    return chooseController(page, action, prefix);
  }
  async function axes(values) {
    await page.evaluate((values) => {
      for (const [i, v] of Object.entries(values)) fakePad.axes[i] = v;
    }, values);
    await page.waitForTimeout(80);
  }
  async function surfaced({ full = false, weight = 100 } = {}) {
    await page.evaluate(
      ({ full, weight }) => {
        const w = urchinDebug.world;
        Object.assign(w.boat, {
          x: 232,
          y: 238,
          heading: 0,
          vx: 0,
          vy: 0,
          throttle: 0,
          rudder: 0,
          speed: 0,
          turn: 0,
          grounded: false,
        });
        Object.assign(w.environment, { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 });
        Object.assign(w.diver, {
          state: 'surface',
          hook: 0,
          hooking: false,
          recoveryPause: '',
          bagHandled: false,
          recoveryAction: null,
          bag: weight,
          qualitySum: weight * 0.8,
          x: w.boat.x - 4,
          y: w.boat.y,
          reason: full ? 'Bag full' : 'Patch exhausted',
          air: 50,
          patch: full ? w.patches[0] : null,
        });
        if (full) Object.assign(w.diver.patch, { remaining: 500, rate: 10 });
      },
      { full, weight },
    );
    await page.waitForFunction(() =>
      document.querySelector('#message').textContent.includes('RECOVERY AVAILABLE'),
    );
  }
  await rawButton(0, 0);
  await page.waitForFunction(() => urchinDebug.world.time > 0.1);
  assert(await page.locator('#startup').isHidden());
  await axes({ 1: -0.59 });
  await page.waitForFunction(() => urchinDebug.world.boat.throttle > 0.1);
  await axes({ 1: 0 });
  const throttle = await page.evaluate(() => urchinDebug.world.boat.throttle);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), throttle);
  await button(12);
  assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), 1);
  await button(13);
  assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), -1);
  await axes({ 2: 0.6 });
  await page.waitForFunction(() => urchinDebug.world.boat.rudder > 0.15);
  await axes({ 2: 0 });
  const rudder = await page.evaluate(() => urchinDebug.world.boat.rudder);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => urchinDebug.world.boat.rudder), rudder);
  assert.match(
    await page.locator('#hud').textContent(),
    /COMMANDED THROTTLE.*REVERSE.*COMMANDED RUDDER.*STARBOARD/s,
  );
  assert.match(await page.locator('#actionFeedback').textContent(), /RUDDER/);
  await button(14);
  assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), 0);
  await button(12);
  await button(15);
  assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), 0);
  await button(5);
  await page.locator('#testMap').waitFor({ state: 'visible' });
  await button(5);
  await page.locator('#testMap').waitFor({ state: 'hidden' });
  await action('pause');
  await choose('Controller Diagnostics');
  assert(await page.locator('#diagnostics').isVisible());
  assert.match(await page.locator('#diagnostics').textContent(), /Synthetic Deck/);
  await action('diagnostics');
  await choose('Controls / Remapping');
  await choose('Recover Diver / deploy:');
  await page.waitForFunction(
    () => urchinDebug.input.capture && !urchinDebug.input.capture.waitRelease,
  );
  await button(11);
  await page.waitForFunction(() => !urchinDebug.input.capture);
  assert.match(await page.locator('#playtest .selected').textContent(), /R3/);
  // Controller cancel and timeout both leave usable menus.
  await action('confirm');
  await page.waitForFunction(
    () => urchinDebug.input.capture && !urchinDebug.input.capture.waitRelease,
  );
  await action('back');
  assert.equal(await page.evaluate(() => urchinDebug.input.capture), null);
  await action('confirm');
  await page.waitForFunction(
    () => urchinDebug.input.capture && !urchinDebug.input.capture.waitRelease,
  );
  await page.evaluate(() => (urchinDebug.input.capture.remaining = 0.01));
  await page.waitForFunction(() => !urchinDebug.input.capture);
  // Rebind a menu navigation action and navigate with its new input immediately.
  await choose('Menu down:');
  await page.waitForFunction(
    () => urchinDebug.input.capture && !urchinDebug.input.capture.waitRelease,
  );
  await button(4);
  await page.waitForFunction(() => !urchinDebug.input.capture);
  await page.screenshot({ path: 'test-results/remapping.png' });
  const index = await page.evaluate(() => urchinDebug.ui.index);
  await button(4);
  assert.equal(await page.evaluate(() => urchinDebug.ui.index), index + 1);
  await choose('Back / Close');
  await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
  await choose('Forward');
  await page.waitForFunction(() => urchinDebug.ui.screen === 'bindings');
  await action('back');
  await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
  await action('back');
  // Sea Pause Back resumes water under the current menu-history design.
  await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.blocked);
  await action('pause');
  await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
  await choose('Controls / Remapping');
  await page.waitForFunction(() => urchinDebug.ui.screen === 'bindings');
  await action('back');
  await choose('Resume');
  await page.waitForFunction(() => !urchinDebug.ui.blocked);
  console.log('Controller: remapping complete');
  await surfaced();
  assert.match(await page.locator('#help').textContent(), /R3 — Recover Diver/);
  await button(3);
  assert(!(await page.evaluate(() => urchinDebug.world.diver.hooking)));
  await button(11);
  await page.waitForFunction(() => urchinDebug.world.diver.hook > 0.2);
  assert.match(await page.locator('#message').textContent(), /DIVER \+ BAG RECOVERY/);
  assert(await page.locator('#message progress').isVisible());
  await page.evaluate(() => (urchinDebug.world.boat.x += 30));
  await page.waitForFunction(() =>
    document.querySelector('#message').textContent.includes('PAUSED — OUT OF RANGE'),
  );
  const progress = await page.evaluate(() => urchinDebug.world.diver.hook);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => urchinDebug.world.diver.hook), progress);
  assert.match(await page.locator('#message').textContent(), /BOAT CONTROLS AVAILABLE/);
  await page.screenshot({ path: 'test-results/recovery-paused.png' });
  await page.evaluate(() => {
    const w = urchinDebug.world;
    w.boat.x = w.diver.x + 4;
    w.boat.y = w.diver.y;
  });
  await page.waitForFunction(() => urchinDebug.world.catch === 100);
  await page.waitForFunction(() => urchinDebug.world.diver.state === 'ready');
  assert.equal(await page.evaluate(() => urchinDebug.visuals.bags.length), 1);
  assert(await page.evaluate(() => urchinDebug.visuals.diver.aboard));
  await page.screenshot({ path: 'test-results/bag-and-diver-aboard.png' });
  await action('recoverDiver');
  await page.waitForFunction(() =>
    ['searching', 'harvesting'].includes(urchinDebug.world.diver.state),
  );
  assert.deepEqual(await page.evaluate(() => urchinDebug.visuals.diver), {
    bubbles: true,
    surface: false,
    aboard: false,
  });
  await action('recoverDiver');
  await page.waitForFunction(() => urchinDebug.world.divers[1].state === 'deploying');
  assert.equal(await page.evaluate(() => urchinDebug.world.selectedDiverId), 0);
  await action('recoverDiver');
  assert.match(await page.locator('#actionFeedback').textContent(), /RECOVERY REJECTED/);
  await surfaced({ full: true, weight: 300 });
  await page.screenshot({ path: 'test-results/surfaced-diver.png' });
  console.log('Controller: test X bag turnaround');
  await action('work');
  await page.waitForFunction(() => urchinDebug.world.catch === 400);
  assert(
    ['deploying', 'searching', 'harvesting'].includes(
      await page.evaluate(() => urchinDebug.world.diver.state),
    ),
  );
  await page.waitForFunction(() =>
    ['searching', 'harvesting'].includes(urchinDebug.world.diver.state),
  );
  assert.equal(await page.evaluate(() => urchinDebug.visuals.bags.length), 2);
  // Pause during a timed recovery, resume, and ensure no stale command/action.
  await surfaced();
  await action('recoverDiver');
  await page.waitForFunction(() => urchinDebug.world.diver.hook > 0.2);
  await action('pause');
  const pausedTime = await page.evaluate(() => urchinDebug.world.time);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => urchinDebug.world.time), pausedTime);
  assert.match(await page.locator('#message').textContent(), /CONTROLS LOCKED: PAUSED/);
  await choose('Resume');
  await page.waitForFunction(() => urchinDebug.world.diver.state === 'ready');
  assert.equal(await page.evaluate(() => urchinDebug.world.catch), 500);
  await action('instructions');
  await axes({ 0: 1 });
  await action('confirm');
  await axes({ 0: 0 });
  assert.equal(await page.evaluate(() => urchinDebug.world.diver.direction), 3);
  await action('pause');
  await choose('Controls / Remapping');
  await choose('Reset to Defaults');
  await page.waitForFunction(() => urchinDebug.input.map.recoverDiver.includes('b3'));
  assert.deepEqual(await page.evaluate(() => urchinDebug.input.map.menuDown), ['ArrowDown', 'b13']);
  // Axis capture and reset, entirely through controller navigation.
  await choose('Increase starboard rudder:');
  await page.waitForFunction(
    () => urchinDebug.input.capture && !urchinDebug.input.capture.waitRelease,
  );
  await axes({ 3: 1 });
  await page.waitForFunction(() => !urchinDebug.input.capture);
  await axes({ 3: 0 });
  assert.match(await page.locator('#playtest .selected').textContent(), /Right stick Down/);
  await choose('Reset to Defaults');
  await choose('Back / Close');
  await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
  await choose('Action feedback');
  assert(!(await page.evaluate(() => urchinDebug.ui.feedback)));
  await choose('Resume');
  await surfaced();
  await page.evaluate(() => (urchinDebug.world.boat.x += 30));
  await action('recoverDiver');
  await page.waitForFunction(() =>
    document.querySelector('#message').textContent.includes('RECOVERY REJECTED'),
  );
  assert(await page.locator('#actionFeedback').isHidden());
  await action('pause');
  await choose('Action feedback');
  assert(await page.evaluate(() => urchinDebug.ui.feedback));
  await choose('Restart Prototype');
  await page.waitForFunction(() => !urchinDebug.ui.blocked);
  assert.equal(await page.evaluate(() => urchinDebug.world.catch), 0);
  assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), 0);
  assert.equal(await page.evaluate(() => urchinDebug.world.boat.rudder), 0);
  await page.waitForFunction(() => urchinDebug.ready && urchinDebug.visuals.bags.length === 0);
  // Held stick on resume is visibly gated until released, then fresh motion works.
  await action('pause');
  await axes({ 1: -1 });
  await action('pause');
  await page.waitForFunction(() =>
    document.querySelector('#message').textContent.includes('RELEASE ALL'),
  );
  assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), 0);
  await axes({ 1: 0 });
  await page.waitForFunction(() => !urchinDebug.ui.blocked);
  await axes({ 1: -1 });
  await page.waitForFunction(() => urchinDebug.world.boat.throttle > 0);
  await axes({ 1: 0 });
  // Disconnect/reconnect never silently resumes a held input.
  await page.evaluate(() => {
    window.savedPad = fakePad;
    window.fakePad = null;
  });
  await page.waitForFunction(() => !document.querySelector('#startup').hidden);
  assert.match(await page.locator('#message').textContent(), /CONTROLLER DISCONNECTED/);
  await page.evaluate(() => (window.fakePad = window.savedPad));
  await page.waitForFunction(() => !urchinDebug.ui.blocked);
  await action('pause');
  await page.screenshot({ path: 'test-results/pause-menu.png' });
  await choose('Exit Game');
  await page.waitForFunction(() => urchinDebug.ui.ended);
  const endedTime = await page.evaluate(() => urchinDebug.world.time);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => urchinDebug.world.time), endedTime);
  await page.screenshot({ path: 'test-results/exit-session.png' });
  await action('back');
  await page.waitForFunction(() => !urchinDebug.ui.ended && urchinDebug.ui.screen === 'pause');
  await choose('Resume');
  await page.waitForFunction(() => !urchinDebug.ui.blocked);
  await action('pause');
  await choose('Exit Game');
  await choose('Launcher / title');
  await page.waitForFunction(() => !urchinDebug.ui.started);
  assert(await page.locator('#startup').isVisible());
  await action('confirm');
  await page.waitForFunction(() => !urchinDebug.ui.blocked);
  await action('pause');
  await choose('Exit Game');
  await choose('Retry game');
  await page.waitForFunction(() => !urchinDebug.ui.blocked);
  assert.equal(await page.evaluate(() => urchinDebug.world.catch), 0);
  await action('pause');
  await choose('Exit Game');
  await choose('Exit Game');
  await page.waitForFunction(() =>
    document.querySelector('#playtest').textContent.includes('Steam → Exit Game'),
  );
  await action('back');
  assert(!(await page.evaluate(() => urchinDebug.ui.ended)));
  // Exercise browser CORS/auth to the real companion, through controller Exit Game.
  const sessionDir = await mkdtemp(join(tmpdir(), 'urchin-browser-exit-'));
  const companion = spawn(
    process.execPath,
    [
      'scripts/session-server.js',
      join(sessionDir, 'url'),
      (process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/') + '?practice=1',
    ],
    { stdio: 'pipe' },
  );
  const companionExit = new Promise((resolve) => companion.once('exit', (code) => resolve(code)));
  try {
    let sessionUrl;
    for (let n = 0; n < 100; n++) {
      try {
        sessionUrl = (await readFile(join(sessionDir, 'url'), 'utf8')).trim();
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    }
    assert(sessionUrl, 'companion URL created');
    await page.goto(sessionUrl);
    await page.reload();
    await page.evaluate(() => {
      window.fakePad = {
        id: 'Synthetic Deck',
        mapping: 'standard',
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
      };
    });
    await page.waitForFunction(() => window.urchinDebug?.world.time > 0.1);
    await action('pause');
    await choose('Exit Game');
    await choose('Exit Game');
    await page.waitForFunction(() =>
      document.querySelector('#playtest').textContent.includes('Closing the game window'),
    );
    assert.equal(await companionExit, 0);
  } finally {
    companion.kill();
    await companionExit;
    await rm(sessionDir, { recursive: true, force: true });
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS: controller-only start, analog latch, D-pad commands, persistent rudder, menu navigation/rebinding/cancel/timeout/reset, progress/range pause, X bag turnaround / Y boarding / redive visuals, lock reasons, pause/restart/disconnect and exit fallback. Synthetic gamepad; physical Deck verification still required.',
  );
} finally {
  await browser.close();
}
