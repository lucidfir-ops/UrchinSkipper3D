import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import '../tests/matter-helper.js';
import { createCareer, freshVessel, useVessel } from '../src/career-state.js';
import { careerWorld, encode, SAVE_KEY } from '../src/career-save.js';
import { setPreset } from '../src/assists.js';
import { chooseGround } from '../src/day.js';
import { soundingDepth } from '../src/hazard-depth.js';

const output = process.env.URCHIN_TRAINING_OUTPUT || 'test-results/training-preferences-2026-10-03';
const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/';
mkdirSync(output, { recursive: true });
// Explicitly staged career/equipment and lesson positions. Browser actions below
// exercise real controls/preferences; this is not an unaided tutorial playthrough.
function fixture(realistic = false) {
  const w = careerWorld(createCareer(17));
  w.career.fleet.twinjet = freshVessel('twinjet');
  useVessel(w, 'twinjet');
  w.career.fleet.twinjet.equipment = ['bowthruster', 'scanner', 'lights', 'tank'];
  if (realistic) {
    w.career.difficulty = 'realistic';
    setPreset(w, 'realistic');
  }
  assert(chooseGround(w, 'near').ok);
  return encode(w);
}
const normalSave = fixture(),
  realisticSave = fixture(true),
  records = [],
  errors = [],
  startedAt = new Date().toISOString();
let passed = false,
  failure = null;
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const panels = [
  'timepiecePanel',
  'depthInstrumentPanel',
  'speedPanel',
  'throttlePanel',
  'fuelPanel',
];
async function action(page, locator, touch) {
  await locator.scrollIntoViewIfNeeded();
  if (touch) await locator.tap();
  else {
    await locator.focus();
    await page.keyboard.press('Enter', { delay: 60 });
  }
}
async function openAssists(page, touch) {
  if (touch) {
    await page.locator('#touchMenu').tap();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'intropause');
    await action(
      page,
      page.getByRole('button', { name: 'UI / difficulty options', exact: true }),
      true,
    );
  } else {
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    await page.keyboard.press('F6', { delay: 60 });
  }
  await page.waitForFunction(() => urchinDebug.ui.screen === 'assists');
}
async function closeMenus(page, touch) {
  if (!touch) await page.keyboard.press('Escape', { delay: 60 });
  else {
    for (let n = 0; n < 4 && (await page.evaluate(() => !!urchinDebug.ui.screen)); n++) {
      const screen = await page.evaluate(() => urchinDebug.ui.screen);
      const button =
        screen === 'intropause'
          ? page.getByRole('button', { name: 'Resume lesson', exact: true })
          : page.locator('.screen-back');
      await action(page, button, true);
    }
  }
  await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
}
async function mounted(touch, viewport, saved = normalSave) {
  const context = await browser.newContext({ viewport, hasTouch: touch });
  await context.addInitScript(
    ({ key, data, touch }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, data);
      if (touch) localStorage.setItem('urchin-touchscreen-v1', 'on');
    },
    { key: SAVE_KEY, data: saved, touch },
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(20000);
  const response = await page.goto(base);
  if (process.env.URCHIN_PRODUCTION_TEST === '1') {
    assert.equal(response.headers()['x-urchin-build'], 'production');
    assert.equal(response.headers()['x-urchin-edition'], 'three');
  }
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  return { context, page };
}
async function visiblePanels(page) {
  return page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => {
          const e = document.getElementById(id),
            r = e.getBoundingClientRect(),
            s = getComputedStyle(e);
          return [
            id,
            !e.hidden &&
              s.display !== 'none' &&
              s.visibility !== 'hidden' &&
              r.width > 0 &&
              r.height > 0,
          ];
        }),
      ),
    panels,
  );
}
async function unobscured(page, selectors) {
  const result = await page.evaluate((selectors) => {
    return selectors.map((selector) => {
      const element = document.querySelector(selector),
        r = element.getBoundingClientRect(),
        samples = [
          [0.2, 0.2],
          [0.8, 0.2],
          [0.5, 0.5],
          [0.2, 0.8],
          [0.8, 0.8],
        ].map(([x, y]) => {
          const top = document.elementFromPoint(r.left + r.width * x, r.top + r.height * y);
          return { clear: !!top && element.contains(top), covering: top?.id || top?.className };
        });
      return {
        selector,
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
        inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        samples,
      };
    });
  }, selectors);
  for (const item of result) {
    assert(item.inViewport, `${item.selector} leaves the viewport`);
    assert(
      item.samples.every((sample) => sample.clear),
      JSON.stringify(item),
    );
  }
  return result;
}
async function readFrankByTouch(page) {
  const session = await page.context().newCDPSession(page),
    trace = [];
  try {
    for (let swipe = 0; swipe <= 12; swipe++) {
      const state = await page.locator('.frank-body').evaluate((element) => {
        const r = element.getBoundingClientRect();
        return {
          top: element.scrollTop,
          max: element.scrollHeight - element.clientHeight,
          x: r.left + r.width * 0.65,
          from: r.bottom - 5,
          to: r.top + 5,
        };
      });
      trace.push(state);
      if (state.top >= state.max - 1) return trace;
      if (swipe === 12) break;
      assert(state.from - state.to >= 20, 'Frank must leave room for a native reading swipe');
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: state.x, y: state.from }],
      });
      for (let step = 1; step <= 8; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: state.x, y: state.from + ((state.to - state.from) * step) / 8 }],
        });
        await page.waitForTimeout(16);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(160);
    }
    assert.fail(`Frank's full text must be reachable by native touch: ${JSON.stringify(trace)}`);
  } finally {
    await session.detach();
  }
}
try {
  for (const [name, viewport, touch] of [
    ['desktop', { width: 1280, height: 800 }, false],
    ['phone', { width: 390, height: 844 }, true],
    ['landscape', { width: 844, height: 390 }, true],
  ]) {
    const { context, page } = await mounted(touch, viewport);
    try {
      await action(page, page.locator('[data-title-action="test"]'), touch);
      await page.waitForFunction(
        () => urchinDebug.world.career.trainingReplay && !urchinDebug.ui.screen,
      );
      const protectedSave = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
      await page.waitForTimeout(300);
      assert(Object.values(await visiblePanels(page)).every((value) => !value));
      assert(
        !(await page.locator('.frank-helm').isVisible()),
        'preparation has no scouting readout',
      );
      if (!touch) {
        await page.evaluate(() => {
          const input = urchinDebug.input;
          input.map.thrustPort = ['KeyJ', 'b4'];
          input.map.thrustStarboard = ['KeyL', 'b5'];
        });
      }
      // Focused-button setup isolates native Enter activation here. It does not
      // establish Tab reachability at sea, where Tab keeps selecting divers.
      await action(page, page.locator('[data-intro="next"]'), touch);
      await page.waitForFunction(() =>
        document.querySelector('.frank-line strong').textContent.includes('Bow thruster'),
      );
      const instructions = await page.locator('.frank-line p').innerText();
      assert.match(instructions, touch ? /Bow left.*Bow right/ : /J.*L/);
      assert.doesNotMatch(instructions, /\{\w+\}|left stick sideways/);
      records.push({ name, kind: 'binding-aware-training', instructions });
      if (!touch) {
        await page.waitForFunction(() => !urchinDebug.input.suppressed);
        await page.keyboard.press('Escape', { delay: 60 });
        await page.waitForFunction(() => urchinDebug.ui.screen === 'intropause');
        let tabs = 0;
        while (
          !(await page.evaluate(
            () => document.activeElement?.textContent.trim() === 'Continue to next lesson',
          )) &&
          tabs < 30
        ) {
          await page.keyboard.press('Tab', { delay: 60 });
          tabs++;
        }
        assert(tabs < 30, 'pause-menu Continue must be reachable using native Tab');
        await page.keyboard.press('Enter', { delay: 60 });
        await page.waitForFunction(
          () =>
            !urchinDebug.ui.screen &&
            document.querySelector('.frank-line strong').textContent.includes('Twin-jet pivot'),
        );
        records.push({ name, kind: 'keyboard-pause-continue', tabs, lesson: 'Twin-jet pivot' });
      }

      await openAssists(page, touch);
      assert.equal(
        await page.locator('[data-action="assist-timepiece"]').getAttribute('aria-checked'),
        'false',
      );
      const beforeLayout = await page.evaluate(() =>
        JSON.stringify(urchinDebug.world.career.assists),
      );
      await action(page, page.locator('[data-action="layout"]'), touch);
      await page.waitForFunction(() => urchinDebug.ui.screen === 'layout');
      await action(page, page.locator('[data-action="layout-save"]'), touch);
      await page.waitForFunction(() => urchinDebug.ui.screen === 'assists');
      assert.equal(
        await page.evaluate(() => JSON.stringify(urchinDebug.world.career.assists)),
        beforeLayout,
      );
      await action(page, page.locator('[data-action="assist-timepiece"]'), touch);
      assert.equal(
        await page.locator('[data-action="assist-timepiece"]').getAttribute('aria-checked'),
        'true',
      );
      await closeMenus(page, touch);
      await page.locator('#timepiecePanel').waitFor({ state: 'visible' });
      const chosen = await visiblePanels(page);
      assert(chosen.timepiecePanel);
      assert(panels.filter((id) => id !== 'timepiecePanel').every((id) => !chosen[id]));
      records.push({ name, kind: 'one-explicit-instrument', panels: chosen });

      // Verify the old CSS exceptions no longer suppress explicitly chosen
      // clock/weather panels; All Off and Custom preserve the exact choice.
      await openAssists(page, touch);
      for (const key of ['clockOverlay', 'weatherOverlay'])
        await action(page, page.locator(`[data-action="assist-${key}"]`), touch);
      await closeMenus(page, touch);
      await page.locator('#clock').waitFor({ state: 'visible' });
      await page.locator('#electronics').waitFor({ state: 'visible' });
      await openAssists(page, touch);
      await action(page, page.locator('[data-action="off"]'), touch);
      await closeMenus(page, touch);
      assert(!(await page.locator('#frankAboard').isVisible()));
      assert(!(await page.locator('#clock').isVisible()));
      await openAssists(page, touch);
      await action(page, page.locator('[data-action="custom"]'), touch);
      await closeMenus(page, touch);
      await page.locator('#frankAboard').waitFor({ state: 'visible' });
      await page.locator('#clock').waitFor({ state: 'visible' });
      records.push({
        name,
        kind: 'chosen-instruments-unobscured',
        panels: await unobscured(page, ['#timepiecePanel', '#clock', '#electronics']),
      });
      await page.screenshot({ path: `${output}/${name}-chosen-instruments.png` });
      // Restore the quiet preset before inspecting the lesson's own readout.
      await openAssists(page, touch);
      await action(page, page.locator('[data-action="easy"]'), touch);
      await closeMenus(page, touch);
      for (const [step, x, y] of [
        [4, 113, 164],
        [7, 160, 100],
      ]) {
        await page.evaluate(
          ({ step, x, y }) => {
            const w = urchinDebug.world;
            w.career.intro.prepIndex = 99;
            w.career.intro.step = step;
            delete w.career.intro.discovery;
            Object.assign(w.boat, { x, y, vx: 0, vy: 0, throttle: 0, rudder: 0, turn: 0 });
          },
          { step, x, y },
        );
        await page.waitForFunction(
          (step) =>
            urchinDebug.world.career.intro.step === step &&
            !document.querySelector('.frank-helm').hidden,
          step,
        );
        await page.waitForTimeout(150);
        const reading = await page.evaluate(() => {
          const w = urchinDebug.world,
            element = document.querySelector('.frank-helm'),
            rect = element.getBoundingClientRect(),
            panel = document.querySelector('#frankAboard').getBoundingClientRect();
          return {
            text: element.textContent,
            display: getComputedStyle(element).display,
            rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
            panel: { top: panel.top, bottom: panel.bottom, left: panel.left, right: panel.right },
            world: { terrain: w.terrain, environment: w.environment, rocks: w.rocks, boat: w.boat },
          };
        });
        assert.notEqual(reading.display, 'none');
        assert(reading.rect.bottom > reading.rect.top);
        assert(
          reading.rect.top >= reading.panel.top && reading.rect.bottom <= reading.panel.bottom,
        );
        assert(reading.rect.left >= 0 && reading.rect.right <= viewport.width);
        const depth = soundingDepth(reading.world, reading.world.boat.x, reading.world.boat.y);
        assert.equal(reading.text, `Sounder · ${depth.toFixed(1)} m beneath us`);
        records.push({
          name,
          kind: 'rendered-scouting-sounder',
          step,
          text: reading.text,
          rect: reading.rect,
          visibleActions: await unobscured(page, [
            '.frank-helm',
            '[data-intro="chart"]',
            '[data-intro="next"]',
            '[data-intro="skip"]',
          ]),
        });
        await page.screenshot({ path: `${output}/${name}-lesson-${step + 1}-sounder.png` });
        if (touch) {
          records.push({
            name,
            kind: 'touch-lesson-reading',
            step,
            trace: await readFrankByTouch(page),
          });
          await page.screenshot({ path: `${output}/${name}-lesson-${step + 1}-read-to-end.png` });
          await page.locator('[data-intro="chart"]').tap();
          await page.waitForFunction(() => urchinDebug.ui.screen === 'introchart');
          await page.getByRole('button', { name: 'Resume lesson', exact: true }).tap();
          await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
        }
      }
      await page.evaluate(() => {
        urchinDebug.world.career.intro.step = 6;
      });
      await page.waitForFunction(() => document.querySelector('.frank-helm').hidden);
      assert(!(await page.locator('.frank-helm').isVisible()), 'other lessons stay quiet');
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
        protectedSave,
      );
      await page.reload();
      await page.waitForFunction(() => window.urchinDebug?.ready);
      assert(!(await page.evaluate(() => !!urchinDebug.world.career.trainingReplay)));
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
        protectedSave,
      );
      records.push({ name, kind: 'training-save-isolation', preservedOnReload: true });
    } finally {
      await context.close();
    }
  }
  const { context, page } = await mounted(false, { width: 1280, height: 800 }, realisticSave);
  try {
    await action(page, page.locator('#keyboardFallback'), false);
    await page.waitForFunction(() => !urchinDebug.ui.screen);
    await page.waitForTimeout(300);
    const shown = await visiblePanels(page);
    assert(Object.values(shown).every(Boolean));
    await page.screenshot({ path: `${output}/realistic-career-defaults.png` });
    records.push({ kind: 'realistic-career-defaults', panels: shown });
  } finally {
    await context.close();
  }
  assert.deepEqual(errors, []);
  passed = true;
} catch (error) {
  failure = error.stack || String(error);
  throw error;
} finally {
  await browser.close();
  writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(
      {
        passed,
        failure,
        base,
        startedAt,
        endedAt: new Date().toISOString(),
        production: process.env.URCHIN_PRODUCTION_TEST === '1',
        fixture:
          'Staged working career, fitted twinjet, lesson positions and desktop remaps; native keyboard/touch actions. Not a natural tutorial completion or physical-device test.',
        records,
        errors,
      },
      null,
      2,
    ),
  );
}
