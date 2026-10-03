import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { gamepadScript } from './gamepad-fixture.js';
import '../tests/matter-helper.js';
import { createCareer } from '../src/career-state.js';
import { careerWorld, encode, SAVE_KEY } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';

const output = process.env.URCHIN_WEATHER_OUTPUT || 'test-results/continuous-weather-2026-10-02';
mkdirSync(output, { recursive: true });
const fixture = careerWorld(createCareer(17));
assert(chooseGround(fixture, 'near').ok);
assert(fixture.career.weatherPlan.every((period) => period.kind === 'calm'));
// Clock-staged continuous-voyage fixture, not a simulation of a full overnight
// passage. Natural seed 17 is dry on day 1; day 2 rain starts at minute 914.
// Preserve the departure plan, all weather overrides and actual daily weather.
fixture.day.minute = 1440 + 894;
Object.assign(fixture.boat, { x: 250, y: 250, throttle: 0, rudder: 0, vx: 0, vy: 0 });
const snapshot = encode(fixture);
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const errors = [],
  records = [];
const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/';
const startedAt = new Date().toISOString();
let passed = false,
  failure = null;

async function activate(page, name, touch) {
  const button = page.getByRole('button', { name, exact: true });
  if (touch) await button.tap();
  else {
    await button.focus();
    await page.keyboard.press('Enter', { delay: 80 });
  }
}

async function pause(page, touch) {
  if (touch) await page.locator('#touchMenu').tap();
  else await page.keyboard.press('Escape', { delay: 80 });
  await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
}

async function openForecast(page, touch) {
  await activate(page, /^Skipper’s desk/, touch);
  await page.waitForFunction(() => urchinDebug.ui.screen === 'skipper-stuff');
  await activate(page, 'Weather', touch);
  await page.waitForFunction(() => urchinDebug.ui.screen === 'conditions');
  await page.locator('.week-forecast tbody tr').last().waitFor();
}

function weatherRecord() {
  const d = urchinDebug,
    w = d.world,
    r = d.three;
  return {
    departureDay: w.career.day,
    minute: w.day.minute,
    weather: w.weather,
    forced: w.career.debugConditions?.weather || w.career.testConditions?.weather || null,
    savedPlan: w.career.weatherPlan,
    wind: w.environment.wind,
    shaderWind: r.coast.water.material.uniforms.uWind.value.toArray(),
    renderedRain: r.rain.visible,
    turbidity: r.coast.rockColumn.uniforms.uColumnTurbidity.value,
    sunlight: r.coast.water.material.uniforms.uDaylight.value,
  };
}

async function forecastRecord(page) {
  return page.evaluate(() => ({
    minute: urchinDebug.world.day.minute,
    savedPlan: urchinDebug.world.career.weatherPlan,
    footer: document.querySelector('.day-footer').innerText,
    detail: document.querySelector('.expedition-copy').innerText,
    todayVisible: (() => {
      const pane = document.querySelector('.expedition-copy').getBoundingClientRect();
      const row = document.querySelector('.week-forecast tbody tr').getBoundingClientRect();
      return row.top >= pane.top && row.bottom <= pane.bottom + 1;
    })(),
    rows: [...document.querySelectorAll('.week-forecast tbody tr')].map((row) => ({
      day: row.querySelector('th').textContent,
      outlook: row.querySelector('td').textContent,
    })),
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    contentHeight: document.querySelector('.expedition-copy').getBoundingClientRect().height,
    backHeight: document.querySelector('.screen-back').getBoundingClientRect().height,
    actionHeight: document.querySelector('.expedition-choices button').getBoundingClientRect()
      .height,
    internalWidths: ['.expedition-copy', '.forecast-detail', '.forecast-detail > section'].flatMap(
      (selector) =>
        [...document.querySelectorAll(selector)].map((element) => ({
          selector,
          available: element.clientWidth,
          content: element.scrollWidth,
          scrollLeft: element.scrollLeft,
        })),
    ),
  }));
}

async function scrollForecastByTouch(page) {
  const session = await page.context().newCDPSession(page);
  const trace = [];
  try {
    for (let swipe = 0; swipe <= 24; swipe++) {
      const view = await page.evaluate(() => {
        const element = document.querySelector('.expedition-copy');
        const pane = element.getBoundingClientRect();
        const row = document.querySelector('.week-forecast tbody tr:last-child');
        const last = row.getBoundingClientRect();
        return {
          visible: last.top >= pane.top && last.bottom <= pane.bottom + 1,
          lastDay: row.querySelector('th').textContent,
          scrollTop: element.scrollTop,
          maxScroll: element.scrollHeight - element.clientHeight,
          paneTop: pane.top,
          paneBottom: pane.bottom,
          lastTop: last.top,
          lastBottom: last.bottom,
          x: pane.left + pane.width * 0.55,
          from: pane.bottom - 20,
          to: pane.top + 20,
        };
      });
      trace.push(view);
      if (view.visible) return { swipes: swipe, lastDay: view.lastDay, visible: true, trace };
      if (swipe === 24) break;
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: view.x, y: view.from }],
      });
      for (let step = 1; step <= 8; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: view.x, y: view.from + ((view.to - view.from) * step) / 8 }],
        });
        await page.waitForTimeout(16);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(160);
    }
    assert.fail(
      `native touch scrolling must bring the final forecast day into view: ${JSON.stringify(trace)}`,
    );
  } finally {
    await session.detach();
  }
}

function assertForecast(record) {
  assert.deepEqual(
    record.rows.map((row) => row.day),
    ['Today', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8'],
  );
  assert.match(record.rows[0].outlook, /Coastal rain/);
  assert(record.pageWidth <= record.viewportWidth, 'forecast must not widen the viewport');
  if (record.viewportWidth > 700 && record.viewportHeight <= 500) {
    assert(record.contentHeight >= 180, 'short landscape must retain a readable forecast pane');
    assert(
      record.backHeight >= 43.9 && record.actionHeight >= 43.9,
      'compact actions retain 44px targets',
    );
  }
  for (const region of record.internalWidths) {
    assert(
      region.content <= region.available + 1,
      `forecast content must fit without horizontal scrolling: ${JSON.stringify(region)}`,
    );
    assert.equal(region.scrollLeft, 0, 'reading the forecast must not shift its content sideways');
  }
}

try {
  for (const [name, width, height, touch] of [
    ['desktop', 1280, 800, false],
    ['portrait', 390, 844, true],
    ['landscape', 844, 390, true],
  ]) {
    if (process.env.URCHIN_WEATHER_VIEWPORT && process.env.URCHIN_WEATHER_VIEWPORT !== name)
      continue;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch });
    const page = await context.newPage();
    if (!touch)
      await page.addInitScript(gamepadScript, {
        name: 'forecastPad',
        id: 'Forecast Synthetic Xbox',
      });
    page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${name}: ${message.text()}`);
    });
    await page.addInitScript(
      ({ key, data }) => {
        // A real reload must use the game's freshly saved state, not reseed it.
        if (!localStorage.getItem(key)) localStorage.setItem(key, data);
      },
      { key: SAVE_KEY, data: snapshot },
    );
    await page.goto(base);
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    if (touch) {
      await activate(page, 'Touchscreen Options', true);
      await page.getByRole('switch', { name: 'Touchscreen mode: OFF', exact: true }).tap();
      await activate(page, 'Back to previous menu', true);
    }
    await page.locator('#keyboardFallback')[touch ? 'tap' : 'click']();
    await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.screen);
    await pause(page, touch);
    const dry = await page.evaluate(weatherRecord);
    assert.equal(dry.departureDay, 1);
    assert.equal(dry.weather.kind, 'calm');
    assert.equal(dry.weather.rain, 0);
    assert.equal(dry.renderedRain, false);
    assert(!dry.forced || dry.forced === 'natural');

    await page.evaluate(() => {
      const d = urchinDebug;
      d.world.day.minute = 1440 + 954;
      // Exercise the served simulation's updateWeather; never assign w.weather.
      d.step(1 / 60);
      d.three.host.cameras.main.setZoom(0.7);
    });
    if (touch) await activate(page, 'Resume', true);
    else await page.keyboard.press('Escape', { delay: 80 });
    await page.waitForFunction(() => !urchinDebug.ui.screen && urchinDebug.three.rain.visible);
    const wet = await page.evaluate(weatherRecord);
    assert.equal(wet.weather.kind, 'rain');
    assert.equal(wet.weather.rain, 0.65);
    assert.equal(wet.departureDay, 1);
    assert(wet.minute >= 1440 + 954 && wet.minute < 1440 + 970);
    assert.equal(wet.renderedRain, true);
    assert(wet.turbidity > dry.turbidity + 0.09, 'rain must shorten the actual water column');
    assert.notDeepEqual(wet.wind, dry.wind);
    assert.deepEqual(wet.shaderWind, [wet.wind.x, wet.wind.y]);
    assert.deepEqual(wet.savedPlan, dry.savedPlan, 'natural departure weather stays unchanged');
    await page.screenshot({ path: `${output}/${name}-day-2-rain.png` });

    await pause(page, touch);
    const paused = await page.evaluate(weatherRecord);
    await openForecast(page, touch);
    const forecast = await forecastRecord(page);
    assertForecast(forecast);
    assert(
      forecast.todayVisible,
      'Today must be readable as soon as the forecast opens, including portrait',
    );
    assert.doesNotMatch(
      forecast.detail,
      /Departure|Before 07:00|Waiting back/,
      'at-sea forecast must not offer harbour departure advice',
    );
    if (touch) {
      assert.match(forecast.footer, /Tap to choose.*Swipe to scroll/);
      assert.doesNotMatch(forecast.footer, /stick|Up \/ Down/i);
    }
    assert.equal(forecast.minute, paused.minute, 'viewing forecasts does not advance time');
    assert.deepEqual(forecast.savedPlan, dry.savedPlan);
    await page.screenshot({ path: `${output}/${name}-forecast.png` });
    // Capture the scrollable table separately without changing the page layout.
    await page.locator('.week-forecast').scrollIntoViewIfNeeded();
    assertForecast(await forecastRecord(page));
    await page.screenshot({ path: `${output}/${name}-forecast-table.png` });
    let touchScroll = null;
    if (touch) {
      await page.locator('.expedition-copy').evaluate((element) => (element.scrollTop = 0));
      touchScroll = await scrollForecastByTouch(page);
      assertForecast(await forecastRecord(page));
      await page.screenshot({ path: `${output}/${name}-forecast-final-days.png` });
    }
    let controllerScroll = null;
    if (!touch) {
      // The standard synthetic pad drives the real input polling and menu scroll.
      const before = await page
        .locator('.expedition-copy')
        .evaluate((element) => element.scrollTop);
      await page.evaluate(() => {
        window.forecastPad.axes[3] = 0.8;
      });
      await page.waitForFunction(() => urchinDebug.input.lastDevice === 'gamepad');
      await page.waitForFunction(
        (value) => document.querySelector('.expedition-copy').scrollTop > value + 40,
        before,
      );
      await page.evaluate(() => {
        window.forecastPad.axes[3] = 0;
      });
      controllerScroll = await page.evaluate(() => ({
        top: document.querySelector('.expedition-copy').scrollTop,
        footer: document.querySelector('.day-footer').innerText,
        minute: urchinDebug.world.day.minute,
      }));
      assert.match(controllerScroll.footer, /Right stick scrolls forecast/);
      assert.equal(controllerScroll.minute, paused.minute);
      await page.screenshot({ path: `${output}/desktop-controller-forecast.png` });
    }
    if (touch) await activate(page, 'Back to previous menu', true);
    else await page.keyboard.press('Backspace', { delay: 80 });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'skipper-stuff');
    await activate(page, 'Weather', touch);
    await page.waitForFunction(() => urchinDebug.ui.screen === 'conditions');
    assertForecast(await forecastRecord(page));

    const save = await page.evaluate((key) => {
      const before = JSON.stringify(urchinDebug.world.career.weatherPlan);
      const result = urchinDebug.ui.hooks.save();
      const envelope = JSON.parse(localStorage.getItem(key));
      const stored = JSON.parse(envelope.payload);
      return {
        result,
        storedMinute: stored.day.minute,
        storedDay: stored.career.day,
        unchangedPlan: JSON.stringify(stored.career.weatherPlan) === before,
      };
    }, SAVE_KEY);
    assert.equal(save.storedDay, 1);
    assert(save.storedMinute >= 1440 + 954);
    assert(save.unchangedPlan);
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    await page.locator('#keyboardFallback')[touch ? 'tap' : 'click']();
    await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.screen);
    await pause(page, touch);
    const restored = await page.evaluate(weatherRecord);
    assert.equal(restored.departureDay, 1);
    assert(restored.minute >= save.storedMinute && restored.minute < save.storedMinute + 10);
    assert.equal(restored.weather.kind, wet.weather.kind);
    assert.equal(restored.weather.rain, wet.weather.rain);
    assert.equal(restored.turbidity, wet.turbidity);
    assert.equal(restored.renderedRain, true);
    assert.deepEqual(restored.savedPlan, dry.savedPlan);
    await openForecast(page, touch);
    assertForecast(await forecastRecord(page));
    records.push({
      name,
      input: touch ? 'native browser touch' : 'keyboard',
      dry,
      wet,
      forecast,
      touchScroll,
      controllerScroll,
      save,
      restored,
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  passed = true;
  console.log(
    'Clock-staged continuous-weather, forecast input, rendering and save/reload checks passed.',
  );
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(
      {
        passed,
        failure,
        base,
        production: process.env.URCHIN_PRODUCTION_TEST === '1',
        startedAt,
        completedAt: new Date().toISOString(),
        fixture: 'Natural seed 17; day-1 departure; clock staged into day-2 rain',
        records,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
