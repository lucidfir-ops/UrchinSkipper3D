import '../tests/matter-helper.js';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { careerWorld, encode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { updateEnvironment } from '../src/environment.js';
import { updateWeather } from '../src/weather.js';
import { gamepadScript, pressAction } from './gamepad-fixture.js';

const directory = 'test-results/boundary-2026-10-01';
mkdirSync(directory, { recursive: true });
const source = careerWorld();
assert(chooseGround(source, 'near').ok);
source.day.minute = 660;
updateEnvironment(source);
updateWeather(source);
Object.assign(source.boat, {
  x: 300,
  y: source.terrain.size - 24,
  heading: Math.PI,
  throttle: 0,
  rudder: 0,
  vx: 0,
  vy: 0,
});
const saved = encode(source),
  errors = [],
  records = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
async function setup(options = {}) {
  const context = await browser.newContext(options);
  await context.addInitScript(gamepadScript, { name: 'boundaryPad' });
  const page = await context.newPage();
  // Keep the loaded page stable while other agents edit the development build.
  await page.routeWebSocket('**', (socket) => {
    socket.connectToServer().onMessage(() => {});
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  const loaded = await page.evaluate((saved) => {
    const d = urchinDebug,
      result = d.ui.hooks.changeCareer(null, saved);
    d.ui.begin(true);
    d.ui.open(null);
    d.three.host.cameras.main.setZoom(1.3);
    return result;
  }, saved);
  assert(loaded.ok, loaded.reason);
  await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
  return { context, page };
}
async function cross(page) {
  await page.evaluate(() => {
    const w = urchinDebug.world;
    delete w.day.returnDismissed;
    Object.assign(w.boat, { y: w.terrain.size - 0.01, heading: Math.PI, vy: 3, throttle: 0.4 });
    urchinDebug.step(1 / 60);
  });
  await page.waitForFunction(() => urchinDebug.ui.screen === 'harbour-return');
  assert.equal(await page.evaluate(() => urchinDebug.ui.index), 0);
  assert.equal(await page.locator('#playtest h2').textContent(), 'Return to harbour?');
  const before = await page.evaluate(() => ({
    time: urchinDebug.world.time,
    minute: urchinDebug.world.day.minute,
  }));
  await page.waitForTimeout(200);
  assert.deepEqual(
    await page.evaluate(() => ({
      time: urchinDebug.world.time,
      minute: urchinDebug.world.day.minute,
    })),
    before,
  );
  await page.waitForFunction(() => !urchinDebug.input.suppressed);
}
async function cancelled(page) {
  await page.waitForFunction(() => !urchinDebug.ui.screen);
  const state = await page.evaluate(() => ({
    dismissed: urchinDebug.world.day.returnDismissed,
    fade: urchinDebug.world.day.returnFade,
    phase: urchinDebug.world.day.phase,
    throttle: urchinDebug.world.boat.throttle,
  }));
  assert.deepEqual(state, { dismissed: true, fade: undefined, phase: 'working', throttle: 0 });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => urchinDebug.ui.screen), null);
}
try {
  {
    const { page, context } = await setup({ viewport: { width: 1280, height: 800 } });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${directory}/desktop-boundary.png` });
    assert(await page.evaluate(() => urchinDebug.three.navigation.boundary.group.visible));
    await cross(page);
    await page.screenshot({ path: `${directory}/desktop-confirmation.png` });
    await page.keyboard.press('Enter');
    await cancelled(page);
    await cross(page);
    await page.keyboard.press('Escape');
    await cancelled(page);
    await cross(page);
    await page.locator('#playtest [data-choice-index="0"]').click();
    await cancelled(page);
    await cross(page);
    await pressAction(page, 'boundaryPad', 'back');
    await cancelled(page);
    await pressAction(page, 'boundaryPad', 'pause');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
    await pressAction(page, 'boundaryPad', 'back');
    await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
    assert.equal(await page.evaluate(() => urchinDebug.ui.forwardHistory.length), 0);
    await cross(page);
    await pressAction(page, 'boundaryPad', 'pause');
    await cancelled(page);
    await cross(page);
    await pressAction(page, 'boundaryPad', 'menuDown');
    assert.equal(await page.evaluate(() => urchinDebug.ui.index), 1);
    await pressAction(page, 'boundaryPad', 'confirm');
    await page.waitForFunction(() => urchinDebug.world.day.phase === 'complete');
    records.push(
      'Keyboard Enter defaults to Cancel; Escape, mouse Cancel and synthetic controller Back/Menu retain the trip; ordinary controller pause/back still resumes after cancellation; controller Down + Confirm explicitly returns.',
    );
    await context.close();
  }
  for (const [name, viewport] of [
    ['portrait', { width: 390, height: 844 }],
    ['landscape', { width: 844, height: 390 }],
  ]) {
    const { page, context } = await setup({ viewport, hasTouch: true, isMobile: true });
    await page.evaluate(() => urchinDebug.ui.touch.setEnabled(true));
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${directory}/${name}-boundary.png` });
    await cross(page);
    await page.screenshot({ path: `${directory}/${name}-confirmation.png` });
    for (const index of [0, 1]) {
      const box = await page.locator(`#playtest [data-choice-index="${index}"]`).boundingBox();
      assert(
        box && box.height >= 44 && box.y >= 0 && box.y + box.height <= viewport.height,
        `${name}: button ${index} must be visible and touch-sized`,
      );
      assert(
        await page.locator(`#playtest [data-choice-index="${index}"]`).evaluate((button) => {
          const r = button.getBoundingClientRect();
          return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
        `${name}: button ${index} must not be clipped by the dialog`,
      );
    }
    await page.locator('#playtest [data-choice-index="0"]').tap();
    await cancelled(page);
    await cross(page);
    await page.locator('#playtest [data-choice-index="1"]').tap();
    await page.waitForFunction(() => urchinDebug.world.day.phase === 'complete');
    records.push(
      `${name}: touch Cancel keeps fishing and explicit Return completes; both buttons visible at ≥44 px.`,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(records.join('\n'));
} finally {
  writeFileSync(`${directory}/input-results.json`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
