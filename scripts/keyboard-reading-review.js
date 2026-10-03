import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, firefox } from '@playwright/test';
import { gamepadScript } from './gamepad-fixture.js';
import '../tests/matter-helper.js';
import { createCareer } from '../src/career-state.js';
import { careerWorld, encode, SAVE_KEY } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';

const engine = process.argv.includes('--firefox') ? firefox : chromium,
  engineName = engine === firefox ? 'firefox' : 'chromium',
  output = process.env.URCHIN_READING_OUTPUT || 'test-results/keyboard-reading-2026-10-03',
  base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/',
  startedAt = new Date().toISOString(),
  records = [],
  errors = [];
mkdirSync(output, { recursive: true });
// A saved career at sea isolates menu access. All navigation, reading and helm
// checks after loading use native keyboard events, with no focus/scroll injection.
const fixture = careerWorld(createCareer(17));
assert(chooseGround(fixture, 'near').ok);
Object.assign(fixture.boat, { x: 250, y: 250, throttle: 0, rudder: 0, vx: 0, vy: 0 });
const snapshot = encode(fixture);
const browser = await engine.launch({
  headless: true,
  ...(engine === chromium ? { args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'] } : {}),
});
let passed = false,
  failure = null;

async function key(page, value) {
  await page.keyboard.press(value, { delay: 55 });
  await page.waitForTimeout(80);
}

async function tabTo(page, locator, backwards = false) {
  await locator.waitFor({ state: 'visible' });
  const trace = [];
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    trace.push(
      await page.evaluate(() => ({
        focusedDocument: document.hasFocus(),
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id,
        reader: document.activeElement?.dataset.menuReading,
        choice: document.activeElement?.dataset.choiceIndex,
      })),
    );
    await key(page, backwards ? 'Shift+Tab' : 'Tab');
  }
  writeFileSync(`${output}/${engineName}-tab-failure.json`, JSON.stringify(trace, null, 2));
  await page.screenshot({ path: `${output}/${engineName}-tab-failure.png` });
  throw new Error(
    `Native ${backwards ? 'Shift+Tab' : 'Tab'} did not reach ${await locator.getAttribute('aria-label')}`,
  );
}

async function activate(page, name) {
  await tabTo(page, page.getByRole('button', { name, exact: true }));
  await key(page, 'Enter');
}

async function position(pane) {
  return pane.evaluate((element) => ({
    label: element.getAttribute('aria-label'),
    role: element.getAttribute('role'),
    top: element.scrollTop,
    max: element.scrollHeight - element.clientHeight,
    focus: element === document.activeElement,
  }));
}

async function scroll(page, pane, name, requireOverflow = true) {
  await tabTo(page, pane);
  const before = await position(pane),
    index = await page.evaluate(() => urchinDebug.ui.index);
  assert(before.label, 'Reading region has a useful accessible name');
  assert.equal(before.role, 'region');
  if (requireOverflow) assert(before.max > 40, `${name} must contain content below the fold`);
  await page.screenshot({ path: `${output}/${engineName}-${name}-focused.png` });
  await key(page, 'Home');
  await page.waitForFunction(
    (selector) => document.querySelector(selector).scrollTop <= 1,
    await pane.evaluate((element) => `[data-menu-reading="${element.dataset.menuReading}"]`),
  );
  await key(page, 'PageDown');
  if (before.max > 40)
    await page.waitForFunction(
      (selector) => document.querySelector(selector).scrollTop > 30,
      await pane.evaluate((element) => `[data-menu-reading="${element.dataset.menuReading}"]`),
    );
  const paged = await position(pane);
  await key(page, 'End');
  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      return element.scrollTop >= element.scrollHeight - element.clientHeight - 2;
    },
    await pane.evaluate((element) => `[data-menu-reading="${element.dataset.menuReading}"]`),
  );
  const end = await position(pane);
  await page.screenshot({ path: `${output}/${engineName}-${name}-end.png` });
  await key(page, 'Home');
  await page.waitForFunction(
    (selector) => document.querySelector(selector).scrollTop <= 1,
    await pane.evaluate((element) => `[data-menu-reading="${element.dataset.menuReading}"]`),
  );
  await key(page, 'ArrowDown');
  await page.waitForTimeout(200);
  const arrow = await position(pane);
  if (before.max > 40) assert(arrow.top > 0, 'ArrowDown scrolls focused reading text');
  assert.equal(await page.evaluate(() => urchinDebug.ui.index), index);
  const screen = await page.evaluate(() => urchinDebug.ui.screen);
  await key(page, 'Enter');
  await key(page, 'Space');
  assert.equal(await page.evaluate(() => urchinDebug.ui.screen), screen);
  assert.equal(await page.evaluate(() => urchinDebug.ui.index), index);
  await key(page, 'PageUp');
  await key(page, 'Home');
  await page.waitForFunction(
    (selector) => document.querySelector(selector).scrollTop <= 1,
    await pane.evaluate((element) => `[data-menu-reading="${element.dataset.menuReading}"]`),
  );
  assert((await position(pane)).top <= 1);
  return { before, paged, end, arrow };
}

function worldRead() {
  const w = urchinDebug.world;
  return {
    minute: w.day.minute,
    throttle: w.boat.throttle,
    rudder: w.boat.rudder,
    catch: w.catch,
    orders: w.divers.map(({ minQuality, searchLimit, maxBagSeconds, searchDirection }) => ({
      minQuality,
      searchLimit,
      maxBagSeconds,
      searchDirection,
    })),
  };
}

try {
  for (const [name, width, height] of [
    ['desktop', 1280, 800],
    ['compact', 844, 390],
    ['portrait', 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(({ key, data }) => localStorage.setItem(key, data), {
      key: SAVE_KEY,
      data: snapshot,
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(base);
    if (process.env.URCHIN_PRODUCTION_TEST === '1') {
      assert.equal(response.headers()['x-urchin-build'], 'production');
      assert.equal(response.headers()['x-urchin-edition'], 'three');
    }
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    await tabTo(page, page.locator('#keyboardFallback'));
    await key(page, 'Enter');
    await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.screen);
    await key(page, 'Escape');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
    const paused = await page.evaluate(worldRead);
    await activate(page, /^Skipper’s desk/);
    await activate(page, 'Weather');
    await page.waitForSelector('.expedition-copy[data-menu-reading]');
    assert.match(await page.locator('.day-footer').innerText(), /Tab.*PgUp.*PgDn/i);
    const forecast = await scroll(
      page,
      page.locator('.expedition-copy[data-menu-reading]'),
      `${name}-forecast`,
    );
    await key(page, 'End');
    await page.waitForTimeout(200);
    const historyTop = (await position(page.locator('.expedition-copy'))).top;
    await key(page, 'Backspace');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'skipper-stuff');
    await activate(page, 'Forward to next menu');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'conditions');
    assert(Math.abs((await position(page.locator('.expedition-copy'))).top - historyTop) < 2);
    await activate(page, 'Tide & current almanac');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'almanac');
    const almanac = await scroll(
      page,
      page.locator('[data-menu-reading="almanac-curves"]'),
      `${name}-almanac`,
      name !== 'desktop',
    );
    let chart;
    if (name !== 'portrait')
      chart = await scroll(
        page,
        page.locator('[data-menu-reading="almanac-map"]'),
        `${name}-almanac-chart`,
        name === 'compact',
      );
    const chartReader = page.locator(
      name === 'portrait'
        ? '[data-menu-reading="almanac-curves"]'
        : '[data-menu-reading="almanac-map"]',
    );
    await tabTo(page, chartReader);
    await key(page, 'End');
    await page.waitForTimeout(250);
    const chartBounds = await chartReader.evaluate((element) => {
      const reader = element.getBoundingClientRect(),
        map = document.querySelector('.almanac-map'),
        last = map.querySelector('p').getBoundingClientRect(),
        canvas = map.querySelector('canvas').getBoundingClientRect();
      return {
        readerTop: reader.top,
        readerBottom: reader.bottom,
        lastTop: last.top,
        lastBottom: last.bottom,
        chartWidth: canvas.width,
      };
    });
    assert(chartBounds.lastTop >= chartBounds.readerTop - 1);
    assert(chartBounds.lastBottom <= chartBounds.readerBottom + 1, 'Chart caption is reachable');
    if (name === 'portrait') assert(chartBounds.chartWidth >= 250, 'Portrait chart stays readable');
    const slider = page.getByRole('slider', { name: 'Forecast time, minutes ahead' });
    // The wide chart follows the controls; the portrait reader contains them.
    // Traverse toward the slider without leaving the document through browser chrome.
    await tabTo(page, slider, name !== 'portrait');
    const offsetBefore = Number(await slider.inputValue());
    await key(page, 'ArrowRight');
    assert.equal(Number(await slider.inputValue()), offsetBefore + 30);
    let controllerReading;
    if (name !== 'desktop') {
      const readers = page.locator(
        '.almanac-layout[data-menu-reading], .almanac-layout [data-menu-reading]',
      );
      for (const reader of await readers.all()) {
        await tabTo(page, reader);
        await key(page, 'Home');
        await page.waitForFunction(
          (selector) => document.querySelector(selector).scrollTop <= 1,
          await reader.evaluate(
            (element) => `[data-menu-reading="${element.dataset.menuReading}"]`,
          ),
        );
      }
      await page.waitForTimeout(200);
      await page.evaluate(gamepadScript, { name: 'readingPad', id: 'Reading Synthetic Xbox' });
      await page.evaluate(() => {
        window.readingPad.axes[3] = 0.8;
      });
      await page.waitForFunction(() =>
        [
          ...document.querySelectorAll(
            '.almanac-layout[data-menu-reading], .almanac-layout [data-menu-reading]',
          ),
        ]
          .filter((element) => element.scrollHeight > element.clientHeight + 40)
          .every((element) => element.scrollTop > 40),
      );
      await page.evaluate(() => {
        window.readingPad.axes[3] = 0;
      });
      controllerReading = await readers.evaluateAll((elements) =>
        elements.map((element) => ({
          key: element.dataset.menuReading,
          top: element.scrollTop,
          max: element.scrollHeight - element.clientHeight,
        })),
      );
      assert(controllerReading.some((reader) => reader.max > 40));
    }
    assert.deepEqual(await page.evaluate(worldRead), paused, 'Reading never advances the world');
    await key(page, 'Escape');
    await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
    await key(page, 'b');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'instructions');
    const ordersPane = page.locator('.orders-panel [data-menu-reading]').first();
    await tabTo(page, ordersPane);
    assert(await page.locator('.orders-reading-hint').isVisible());
    const draftBefore = await page.evaluate(() => JSON.stringify(urchinDebug.ui.draft));
    const orders = await scroll(page, ordersPane, `${name}-orders`, name === 'compact');
    assert.equal(await page.evaluate(() => JSON.stringify(urchinDebug.ui.draft)), draftBefore);
    await key(page, 'Escape');
    await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
    await key(page, 'PageUp');
    await page.waitForFunction(() => urchinDebug.world.boat.throttle === 1);
    await key(page, 'PageDown');
    await page.waitForFunction(() => urchinDebug.world.boat.throttle === -1);
    await key(page, 'x');
    await page.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
    records.push({
      name,
      forecast,
      almanac,
      chart,
      chartBounds,
      controllerReading,
      orders,
      historyTop,
      paused,
      helmDefaultsPreserved: true,
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  passed = true;
  console.log(
    `PASS ${engineName}: native keyboard reading, menu history, slider and helm isolation`,
  );
} catch (error) {
  failure = error.stack || error.message;
  throw error;
} finally {
  writeFileSync(
    `${output}/${engineName}-receipt.json`,
    JSON.stringify(
      { passed, failure, base, startedAt, completedAt: new Date().toISOString(), records, errors },
      null,
      2,
    ) + '\n',
  );
  await browser.close();
}
