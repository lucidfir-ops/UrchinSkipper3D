import { gamepadScript, pressGamepad, pressAction } from './gamepad-fixture.js';
import { chooseStarter } from './career-start.js';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chooseController } from './controller-menu.js';
import { summarizeFrames } from '../src/frame-metrics.js';
import { checkFrameBudget, FRAME_BUDGETS } from './performance-checks.js';
export async function iterationChecks(
  browser,
  {
    name = 'chromium',
    url = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/',
    production = false,
  } = {},
) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(gamepadScript, {
    name: 'iterationPad',
    id: 'Xbox already connected iteration',
    index: 0,
    mapping: 'standard',
  });
  const button = async (i) => {
    return pressGamepad(page, 'iterationPad', i);
  };
  const action = async (name) => {
    return pressAction(page, 'iterationPad', name);
  };
  const choose = (text) => chooseController(page, action, text);
  const shot = (label) => page.screenshot({ path: `test-results/iteration-${name}-${label}.png` });
  const state = () =>
    page.evaluate(() => ({
      screen: urchinDebug.ui.screen,
      day: urchinDebug.world.career.day,
      cash: urchinDebug.world.career.cash,
      sandbox: !!urchinDebug.world.career.sandbox,
    }));
  try {
    const response = await page.goto(url);
    if (production) assert.equal(response.headers()['x-urchin-build'], 'production');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await button(0);
    await chooseStarter(page, choose);
    assert(await page.locator('body').evaluate((b) => b.classList.contains('in-port')));
    assert.equal(
      await page.locator('#hud').evaluate((el) => getComputedStyle(el).visibility),
      'hidden',
    );
    assert.equal(await page.locator('.wharf-place').count(), 9);
    await shot('harbour');
    assert(
      await page
        .locator('.wharf-place')
        .evaluateAll((buttons) =>
          buttons.every(
            (b) => b.getBoundingClientRect().width < 340 && b.getBoundingClientRect().left >= 0,
          ),
        ),
    );
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.waitForTimeout(180);
    await shot('harbour-compact');
    assert(
      await page
        .locator('#playtest')
        .evaluate(
          (panel) =>
            panel.getBoundingClientRect().right <= innerWidth &&
            panel.getBoundingClientRect().left >= 0,
        ),
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await action('back');
    await page.waitForFunction(() => !urchinDebug.ui.started);
    await button(0);
    await page.waitForFunction(() => urchinDebug.ui.screen === 'harbour');
    await choose('Meet the crew');
    await choose('Berth 2');
    await choose('Roy');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.crew[1]), 'roy');
    await shot('crew');
    await action('back');
    await choose('Your boats');
    assert.equal(await page.locator('[data-action^="fit-"]').count(), 1);
    await choose('Boats for sale');
    await shot('boatyard');
    await action('back');
    await action('back');
    await choose('Harbour office');
    await choose('Fuel, repairs');
    const cash = (await state()).cash;
    await choose('Licence valid');
    assert.equal((await state()).cash, cash);
    await shot('office');
    await action('back');
    await action('back');
    await choose('Talk to Frank');
    assert(await page.locator('.frank-portrait').isVisible());
    await shot('frank');
    await action('back');
    await choose('Settings');
    await choose('Test Mode');
    const real = await state();
    const saved = await page.evaluate(() => localStorage.getItem('urchin-career-v1'));
    await choose('Enter Test Mode');
    await page.waitForFunction(() => urchinDebug.world.career.sandbox);
    await choose('Settings');
    await choose('Test Mode');
    const testCash = (await state()).cash;
    await choose('Add $100,000');
    await choose('Unlock boats');
    assert.equal((await state()).cash, testCash + 100000);
    assert.equal(await page.evaluate(() => localStorage.getItem('urchin-career-v1')), saved);
    await shot('workshop');
    await choose('Leave Test Mode');
    assert.equal((await state()).cash, real.cash);
    assert(!(await state()).sandbox);
    await choose('Harbour office');
    await choose('Rest a day');
    assert.equal((await state()).day, real.day + 1);
    await choose('Harbour office');
    const beforeDock = (await state()).cash;
    await choose('Work a day');
    assert.equal((await state()).cash, beforeDock + 420);
    await choose('Weather & tides');
    await shot('forecast');
    await action('back');
    await choose('Sail');
    await choose('Sheltered Kelp');
    await shot('departure');
    await choose('Weather & tides');
    await action('back');
    await choose('Begin working day');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    await button(11);
    await page.waitForFunction(() => urchinDebug.ui.screen === 'assists');
    await action('back');
    await button(10);
    await page.waitForFunction(() => urchinDebug.ui.screen === 'knowledge');
    await shot('chart');
    await action('back');
    await action('pause');
    const sea = await page.evaluate(() => urchinDebug.ui.choices(urchinDebug.world));
    assert(!sea.some((c) => /Harbour office|Equipment|Refuel|Rest a day/.test(c)));
    await choose('Settings');
    await choose('Exit Game');
    await action('back');
    assert.equal((await state()).screen, 'settings');
    await action('back');
    await choose('Resume');
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.weatherPlan = [{ minute: 0, kind: 'storm', bearing: 65 }];
      w.boat.x = 300;
      w.boat.y = 390;
      w.boat.throttle = 0;
      w.boat.vx = 0;
      w.boat.vy = 0;
      w.logs = [];
    });
    await page.waitForTimeout(1200);
    await shot('wind-rain');
    const zoomIndex = await page.evaluate(() =>
      Number(urchinDebug.input.map.zoomOut.find((c) => /^b\d+$/.test(c)).slice(1)),
    );
    await page.evaluate((i) => (iterationPad.buttons[i] = { value: 1, pressed: true }), zoomIndex);
    await page.waitForFunction(() => urchinDebug.zoom < 0.42);
    await page.evaluate((i) => (iterationPad.buttons[i] = { value: 0, pressed: false }), zoomIndex);
    await shot('zoomed-out');
    // Identical scene, compare drawing every simulation frame with the bounded surface redraw.
    const costs = {};
    for (const hz of [60, 15]) {
      await page.evaluate((hz) => {
        urchinDebug.setSurfaceRefresh(hz);
        urchinDebug.resetRenderSamples();
      }, hz);
      await page.waitForFunction(() => urchinDebug.renderSamples.length >= 120);
      costs[hz] = summarizeFrames(await page.evaluate(() => urchinDebug.renderSamples.slice(-120)));
    }
    writeFileSync(`test-results/iteration-${name}-drawing.json`, JSON.stringify(costs, null, 2));
    checkFrameBudget(
      costs[15],
      FRAME_BUDGETS[process.env.URCHIN_PERFORMANCE_PROFILE || 'software'],
    );
    await page.evaluate(() => (iterationPad.connected = false));
    await page.waitForFunction(() => !urchinDebug.input.connected);
    await page.evaluate(() => (iterationPad.connected = true));
    await button(0);
    await page.waitForFunction(() => urchinDebug.input.connected);
    await action('pause');
    await choose('Settings');
    await choose('Exit Game');
    await choose('Launcher / title');
    await page.waitForFunction(() => !urchinDebug.ui.started);
    await button(0);
    await page.waitForFunction(() => urchinDebug.ui.started);
    await page.setViewportSize({ width: 1024, height: 640 });
    await action('pause');
    await shot('compact-sea-menu');
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${name}: production=${production}, connected pad startup/hotplug, harbour, berths, licence, workshop isolation, rest/dock, forecast/departure, L3/R3, at-sea settings, exit cancel/title; drawing ${JSON.stringify(costs)}`,
    );
  } catch (error) {
    console.log('Iteration failure state:', await state().catch(() => null), 'errors:', errors);
    await shot('failure').catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}
