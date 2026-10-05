import '../tests/matter-helper.js';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { careerWorld, encode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { updateEnvironment } from '../src/environment.js';
import { updateWeather } from '../src/weather.js';
import { gamepadScript, pressAction } from './gamepad-fixture.js';

const directory = 'test-results/boundary-2026-10-05';
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
// October 5: crossing offers a compact Return to harbour chip; it never pauses
// play, opens no dialog, and there is no on-water edge label.
async function cross(page) {
  await page.evaluate(() => {
    const w = urchinDebug.world;
    Object.assign(w.boat, { y: w.terrain.size - 0.01, heading: Math.PI, vy: 3, throttle: 0.4 });
    urchinDebug.step(1 / 60);
  });
  await page.waitForFunction(() => !document.querySelector('#returnHarbourChip')?.hidden);
  const before = await page.evaluate(() => urchinDebug.world.day.minute);
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => ({
    screen: urchinDebug.ui.screen,
    fade: urchinDebug.world.day.returnFade,
    phase: urchinDebug.world.day.phase,
    minute: urchinDebug.world.day.minute,
    labels: document.querySelectorAll('.sector-boundary-label').length,
  }));
  assert.equal(state.screen, null, 'no dialog opens at the line');
  assert.equal(state.fade, undefined, 'crossing alone never departs');
  assert.equal(state.phase, 'working');
  assert.equal(state.labels, 0, 'no on-water warning box');
  assert(state.minute > before, 'time keeps running beyond the line');
}
async function inside(page) {
  await page.evaluate(() => {
    const w = urchinDebug.world;
    Object.assign(w.boat, { y: w.terrain.size - 30, vy: 0, vx: 0, throttle: 0 });
    urchinDebug.step(1 / 60);
  });
  await page.waitForFunction(() => document.querySelector('#returnHarbourChip')?.hidden);
}
async function chipBox(page, viewport) {
  const box = await page.locator('#returnHarbourChip').boundingBox();
  assert(
    box && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width,
    'chip must be visible and touch-sized',
  );
  assert(box.y + box.height <= viewport.height);
  assert(
    await page.locator('#returnHarbourChip').evaluate((chip) => {
      const r = chip.getBoundingClientRect();
      return chip.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
    'chip must be on top and tappable',
  );
  return box;
}
try {
  {
    const viewport = { width: 1280, height: 800 };
    const { page, context } = await setup({ viewport });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${directory}/desktop-near-edge.png` });
    assert(await page.evaluate(() => urchinDebug.three.navigation.boundary.group.visible));
    assert(await page.evaluate(() => document.querySelector('#returnHarbourChip')?.hidden ?? true));
    await cross(page);
    await chipBox(page, viewport);
    assert.match(await page.locator('#returnHarbourChip').textContent(), /Press H/);
    await page.screenshot({ path: `${directory}/desktop-beyond-line.png` });
    await inside(page);
    await cross(page);
    await page.keyboard.press('KeyH');
    await page.waitForFunction(() => urchinDebug.world.day.phase === 'complete');
    records.push(
      'Desktop: no edge label near the line; crossing keeps time running with no dialog; chip shows "Press H"; returning inside withdraws it; H explicitly returns.',
    );
    await context.close();
  }
  {
    const { page, context } = await setup({ viewport: { width: 1280, height: 800 } });
    await cross(page);
    await pressAction(page, 'boundaryPad', 'pause');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
    assert.equal(
      await page.evaluate(() => urchinDebug.ui.choices(urchinDebug.world)[0]),
      'Return to harbour',
    );
    await pressAction(page, 'boundaryPad', 'back');
    await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
    assert.equal(await page.evaluate(() => urchinDebug.world.day.phase), 'working');
    await pressAction(page, 'boundaryPad', 'pause');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
    await page.evaluate(() => (urchinDebug.ui.index = 0));
    await pressAction(page, 'boundaryPad', 'confirm');
    await page.waitForFunction(() => urchinDebug.world.day.phase === 'complete');
    records.push(
      'Synthetic controller: Menu lists Return to harbour first beyond the line; Back keeps fishing; Confirm returns.',
    );
    await context.close();
  }
  for (const [name, viewport] of [
    ['portrait', { width: 390, height: 844 }],
    ['landscape', { width: 844, height: 390 }],
  ]) {
    const { page, context } = await setup({ viewport, hasTouch: true, isMobile: true });
    await page.evaluate(() => urchinDebug.ui.touch.setEnabled(true));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${directory}/${name}-near-edge.png` });
    await cross(page);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${directory}/${name}-beyond-line.png` });
    const box = await chipBox(page, viewport);
    const overlaps = await page.evaluate((box) => {
      return [
        ...document.querySelectorAll(
          '#touchControls button:not(#touchBoat), #touchControls .touch-stick',
        ),
      ]
        .filter((el) => el.offsetParent)
        .map((el) => el.getBoundingClientRect())
        .filter(
          (r) =>
            r.width &&
            r.x < box.x + box.width &&
            r.x + r.width > box.x &&
            r.y < box.y + box.height &&
            r.y + r.height > box.y,
        ).length;
    }, box);
    assert.equal(overlaps, 0, `${name}: chip must not cover touch controls`);
    const hull = await page.evaluate(() => {
      const r = urchinDebug.three,
        b = urchinDebug.world.boat;
      return r.project(b.x, b.y, 0);
    });
    assert(
      hull.x < box.x || hull.x > box.x + box.width || hull.y < box.y || hull.y > box.y + box.height,
      `${name}: chip must not sit over the boat`,
    );
    await page.locator('#returnHarbourChip').tap();
    await page.waitForFunction(() => urchinDebug.world.day.phase === 'complete');
    records.push(`${name}: chip ≥44 px, on screen, clear of touch controls; tap returns.`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(records.join('\n'));
} finally {
  writeFileSync(`${directory}/input-results.json`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
