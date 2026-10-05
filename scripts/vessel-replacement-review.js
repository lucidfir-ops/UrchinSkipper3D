import '../tests/matter-helper.js';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createCareer } from '../src/career-state.js';
import { careerWorld, nextCareerDay, encode, SAVE_KEY } from '../src/career-save.js';
import { chooseFirstBoat } from '../src/starter-career.js';
import { chooseGround, requestRescue } from '../src/day.js';
import { FLEET } from '../src/career-data.js';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/',
  output = process.env.URCHIN_REPLACEMENT_OUTPUT || 'test-results/vessel-replacement-2026-10-03',
  startedAt = new Date().toISOString(),
  records = [],
  errors = [];
mkdirSync(output, { recursive: true });

// Real career initialization, starter purchase, rescue/insurance and day advance.
// Only the shipwreck damage is staged; this is not a natural collision playthrough.
const source = careerWorld(createCareer(171709, { chooseStarter: true }));
assert(chooseFirstBoat(source, 'basic').ok);
assert(chooseGround(source, 'near').ok);
Object.assign(source.boat, { hullHealth: 0, driveHealth: 0.4, fuel: 37, sinking: true });
source.emergency = { mandatoryRescue: true, reason: 'Vessel sinking' };
assert(requestRescue(source).ok);
const fixture = nextCareerDay(source),
  saved = encode(fixture),
  price = FLEET.basic.price,
  capacity = FLEET.basic.fuelCapacity,
  initialCash = fixture.career.cash;
assert(initialCash >= price);

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
let passed = false,
  failure = null;

const state = (page) =>
  page.evaluate(() => {
    const w = urchinDebug.world;
    return {
      cash: w.career.cash,
      boat: w.boat.configuration,
      hull: w.boat.hullHealth,
      drive: w.boat.driveHealth,
      fuel: w.boat.fuel,
      sinking: w.boat.sinking,
      lost: w.career.fleet[w.boat.configuration].lost,
      phase: w.day.phase,
    };
  });
const screen = (page, name) => page.waitForFunction((name) => urchinDebug.ui.screen === name, name);
const settledLayout = async (page, kind) => {
  const measurement = await page.waitForFunction(
    (kind) => {
      const rect = (element) => {
          if (!element) return null;
          const r = element.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        },
        visible = (element) => element && element.getBoundingClientRect().height > 0,
        inside = (inner, outer) =>
          inner && outer && inner.y >= outer.y - 1 && inner.bottom <= outer.bottom + 1,
        touch = document.body.classList.contains('touchscreen');
      if (kind === 'shop') {
        const detail = [...document.querySelectorAll('.shop-inline-detail, .career-detail')].find(
            (element) => visible(element) && element.querySelector(':scope > .vessel-model'),
          ),
          figure = detail?.querySelector(':scope > .vessel-model'),
          canvas = figure?.querySelector('canvas'),
          preview = rect(figure),
          painted = rect(canvas),
          caption = rect(figure?.querySelector('figcaption')),
          heading = rect(detail?.querySelector('h3')),
          description = rect(detail?.querySelector('p')),
          selected = rect(document.querySelector('.shop-row.is-preview .shop-vessel-state')),
          buy = rect(document.querySelector('.shop-row.is-preview .shop-inline-buy'));
        return (
          canvas?.dataset.loaded === 'true' &&
          inside(painted, preview) &&
          inside(caption, preview) &&
          heading?.y >= preview.bottom - 1 &&
          description?.y >= heading.bottom - 1 &&
          selected &&
          buy &&
          (selected.bottom <= buy.y || selected.right <= buy.x || selected.x >= buy.right) && {
            preview,
            painted,
            caption,
            heading,
            description,
            selected,
            buy,
          }
        );
      }
      const map = rect(document.querySelector('.chart-map-frame > :is(canvas, svg)')),
        heading = rect(document.querySelector('.day-heading')),
        caption = rect(document.querySelector('.sector-picture .map-caption')),
        footer = rect(document.querySelector('.day-footer')),
        reader = rect(document.querySelector('.expedition-copy')),
        travel = rect(document.querySelector('.travel-strip')),
        times = [...document.querySelectorAll('.travel-strip strong')].map((element) => ({
          text: element.textContent,
          ...rect(element),
        }));
      return (
        map?.width > 0 &&
        Math.abs(map.width - map.height) <= 1 &&
        times.length === 2 &&
        times.every((time) => /^\d{1,2}:\d{2}$/.test(time.text)) &&
        (touch ||
          (map.y >= heading.bottom &&
            map.bottom <= caption.y + 1 &&
            caption.bottom <= footer.y &&
            inside(travel, reader) &&
            times.every((time) => inside(time, reader)))) && {
          map,
          heading,
          caption,
          footer,
          reader,
          travel,
          times,
        }
      );
    },
    kind,
    { timeout: 5000 },
  );
  return measurement.jsonValue();
};

try {
  for (const [name, method, width, height] of [
    ['keyboard', 'keyboard', 1280, 800],
    ['controller', 'controller', 1280, 800],
    ['touch', 'touch', 390, 844],
    ['keyboard-compact', 'keyboard', 844, 390],
    ['touch-landscape', 'touch', 844, 390],
  ]) {
    const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: method === 'touch',
      }),
      page = await context.newPage();
    await context.addInitScript(
      ({ saved, key }) => {
        if (!localStorage.getItem('replacement-fixture-loaded')) {
          localStorage.setItem(key, saved);
          localStorage.setItem('replacement-fixture-loaded', '1');
        }
      },
      { saved, key: SAVE_KEY },
    );
    if (method === 'controller')
      await context.addInitScript(gamepadScript, {
        name: 'replacementPad',
        id: 'Vessel Replacement Synthetic Xbox',
      });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    const response = await page.goto(base);
    if (process.env.URCHIN_PRODUCTION_TEST === '1') {
      assert.equal(response.headers()['x-urchin-build'], 'production');
      assert.equal(response.headers()['x-urchin-edition'], 'three');
    }
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    if (method === 'touch') {
      await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
      await page.getByRole('switch', { name: 'Touchscreen mode: OFF', exact: true }).tap();
      await page.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
    }
    await page.locator('#keyboardFallback')[method === 'touch' ? 'tap' : 'click']();
    await screen(page, 'harbour');

    const input = async (action) => {
      await page.waitForFunction(() => !urchinDebug.input.suppressed);
      if (method === 'controller') return pressAction(page, 'replacementPad', action);
      const key = {
        menuUp: 'ArrowUp',
        menuDown: 'ArrowDown',
        menuLeft: 'ArrowLeft',
        menuRight: 'ArrowRight',
        confirm: 'Enter',
      }[action];
      await page.keyboard.press(key, { delay: 60 });
      await page.waitForTimeout(80);
    };
    const select = async (selector) => {
      const button = page.locator(selector);
      await button.waitFor({ state: 'visible' });
      if (method === 'touch') return button.tap();
      const label = await button.evaluate(
        (element) => urchinDebug.ui.choices(urchinDebug.world)[Number(element.dataset.choiceIndex)],
      );
      assert(label, 'A rendered menu choice is available');
      // Suppress the helper's automatic confirmation: cancellation and the
      // initially selected Cancel action are part of this transaction check.
      await chooseController(page, input, label, false);
      await input('confirm');
    };
    const shot = (capture) =>
      page.screenshot({ path: `${output}/${name}-${capture}.png`, animations: 'disabled' });

    const lost = await state(page);
    assert.equal(lost.lost, true);
    assert.equal(lost.hull, 0);
    assert.equal(lost.cash, initialCash);
    await select('[data-action="fleet"]');
    await screen(page, 'fleet');
    await select('[data-action="buy-basic"]');
    assert.deepEqual(await state(page), lost, 'Preview cannot alter the wreck or charge cash');
    await select('[data-action="buy-top"]');
    await screen(page, 'purchase');
    assert.equal(await page.evaluate(() => urchinDebug.ui.index), 0);
    await shot('replacement-confirmation');
    await select('[data-action="cancel-purchase"]');
    await screen(page, 'fleet');
    assert.deepEqual(await state(page), lost, 'Cancel preserves the wreck and balance');
    await select('[data-action="buy-top"]');
    await screen(page, 'purchase');
    await select('[data-action="confirm-purchase"]');
    await screen(page, 'fleet');
    const replacement = await state(page);
    assert.deepEqual(replacement, {
      cash: initialCash - price,
      boat: 'basic',
      hull: 1,
      drive: 1,
      fuel: capacity,
      sinking: false,
      lost: false,
      phase: 'planning',
    });
    assert(await page.locator('[data-action="buy-top"]').isDisabled());
    const shopLayout = await settledLayout(page, 'shop');
    await shot('replacement-owned');
    await page.waitForFunction(
      ({ key, cash }) => {
        const data = urchinDebug.readSave(localStorage.getItem(key));
        return (
          data.career.cash === cash && !data.career.fleet.basic.lost && data.boat.hullHealth === 1
        );
      },
      { key: SAVE_KEY, cash: initialCash - price },
    );
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    await page.locator('#keyboardFallback')[method === 'touch' ? 'tap' : 'click']();
    await screen(page, 'harbour');
    assert.deepEqual(await state(page), replacement, 'The paid fresh vessel survives reload');
    await select('[data-action="chart"]');
    await screen(page, 'chart');
    await select('#playtest [data-choice-index="0"]');
    await screen(page, 'departure');
    assert.equal(await page.locator('[data-action="resolve-departure"]').count(), 0);
    const departureLayout = await settledLayout(page, 'departure');
    await shot('replacement-ready-to-sail');
    await select('[data-action="sail"]');
    await page.waitForFunction(
      () => urchinDebug.world.day.phase === 'working' && !urchinDebug.ui.screen,
    );
    const departed = await state(page);
    assert.equal(departed.sinking, false);
    assert.equal(departed.lost, false);
    assert.equal(departed.boat, 'basic');
    assert(departed.hull > 0.99 && departed.drive > 0.99);
    assert(departed.fuel < capacity && departed.fuel > 0);
    records.push({
      name,
      method,
      viewport: { width, height },
      lost,
      replacement,
      restored: true,
      departed,
      shopLayout,
      departureLayout,
    });
    console.log(`PASS ${name}: cancel, replace active wreck once, reload and sail`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  passed = true;
} catch (error) {
  failure = error.stack || error.message;
  throw error;
} finally {
  writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(
      {
        passed,
        failure,
        base,
        startedAt,
        completedAt: new Date().toISOString(),
        fixture:
          'Staged shipwreck through real starter/rescue/day APIs; native browser keyboard/touch and synthetic controller purchases, cancellation, saved reload and departure. No natural shipwreck or physical-controller claim.',
        records,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  await browser.close();
}
