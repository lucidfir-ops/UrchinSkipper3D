import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5186/';
const output = process.env.URCHIN_MENU_REVIEW_OUTPUT || 'test-results/ui-overhaul/adversarial';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const results = [],
  errors = [];
let captureIndex = 0;
async function screen(page, destination) {
  await page.waitForFunction((destination) => urchinDebug.ui.screen === destination, destination);
  await page.waitForTimeout(160);
}
async function ready(viewport = { width: 1280, height: 800 }, touch = false) {
  const page = await browser.newPage({ viewport, hasTouch: touch });
  await page.addInitScript(gamepadScript, {
    name: 'reviewPad',
    id: 'Independent review synthetic Xbox',
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.setDefaultTimeout(20000);
  await page.goto(base);
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  return page;
}
async function check(page, name, run) {
  try {
    const detail = await run();
    results.push({ name, pass: true, detail });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, pass: false, reason: error.message });
    console.log('FAIL', name, error.message);
  }
  await page.screenshot({
    path: `${output}/${String(++captureIndex).padStart(2, '0')}.png`,
    animations: 'disabled',
  });
}
async function back(page) {
  await page.getByRole('button', { name: 'Back to previous menu', exact: true }).click();
}
async function starter(page, realistic = false) {
  await page.locator('#keyboardFallback').click();
  await screen(page, 'intro');
  await page.getByRole('button', { name: 'Skip day 0 · choose my boat', exact: true }).click();
  await screen(page, 'starter');
  if (realistic) await page.locator('[data-action="difficulty"]').click();
  await page
    .getByRole('button', { name: 'Choose Harbour Workhorse · $15,000', exact: true })
    .click();
}
async function purchase(page) {
  await page.locator('[data-action="buy-selected"]').click();
  await screen(page, 'purchase');
  await page.locator('[data-action="confirm-purchase"]').click();
  await screen(page, 'harbour');
}
async function settings(page) {
  await page.locator('[data-action="settings"]').click();
  await screen(page, 'settings');
}

try {
  const page = await ready();
  await starter(page);
  await check(page, 'Purchase cancel and Forward cannot replay the transaction', async () => {
    const before = await page.evaluate(() => ({
      cash: urchinDebug.world.career.cash,
      fleet: Object.keys(urchinDebug.world.career.fleet),
    }));
    await page.locator('[data-action="buy-selected"]').click();
    await screen(page, 'purchase');
    await page.keyboard.press('Backspace');
    await screen(page, 'starter');
    assert.deepEqual(
      await page.evaluate(() => ({
        cash: urchinDebug.world.career.cash,
        fleet: Object.keys(urchinDebug.world.career.fleet),
      })),
      before,
    );
    assert(
      await page.evaluate(
        () => !urchinDebug.ui.forwardHistory?.some((point) => point.screen === 'purchase'),
      ),
    );
    assert.equal(await page.evaluate(() => urchinDebug.ui.pendingPurchase), null);
  });
  await purchase(page);
  await settings(page);
  await check(
    page,
    'Held native Space activates the focused preference switch exactly once',
    async () => {
      // Volume is a native range now; Space is not its activation gesture. Use a
      // real preference button to retain this keyboard double-activation guard.
      const preference = page.locator('[data-action="logging"]');
      await preference.focus();
      await page.waitForTimeout(300);
      const before = await preference.getAttribute('aria-checked');
      await page.evaluate(() => {
        window.reviewClickCount = 0;
        document.querySelector('#playtest').addEventListener('click', (e) => {
          if (e.target.closest('[data-action="logging"]')) window.reviewClickCount++;
        });
      });
      await page.keyboard.down('Space');
      await page.waitForTimeout(500);
      assert.equal(
        await preference.getAttribute('aria-checked'),
        before,
        'Space waits for release',
      );
      await page.keyboard.up('Space');
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.reviewClickCount), 1);
      assert.equal(await preference.getAttribute('aria-checked'), String(before !== 'true'));
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'logging');
      // Leave the device preference as we found it.
      await preference.click();
      assert.equal(await preference.getAttribute('aria-checked'), before);
    },
  );
  await check(
    page,
    'Every Settings action has an actual controller route and is brought into view',
    async () => {
      const action = (name) => pressAction(page, 'reviewPad', name);
      const choices = await page.evaluate(() => urchinDebug.ui.choices(urchinDebug.world));
      const targets = choices.filter((label) => !/^Back/.test(label));
      for (const label of targets) {
        await chooseController(page, action, label, false);
        const visible = await page.evaluate(() => {
          const node = document.querySelector(
              `#playtest [data-choice-index="${urchinDebug.ui.index}"]`,
            ),
            r = node.getBoundingClientRect();
          let top = 0,
            bottom = innerHeight,
            left = 0,
            right = innerWidth;
          for (let p = node.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (/auto|scroll|hidden/.test(s.overflowY)) {
              const q = p.getBoundingClientRect();
              top = Math.max(top, q.top);
              bottom = Math.min(bottom, q.bottom);
            }
            if (/auto|scroll|hidden/.test(s.overflowX)) {
              const q = p.getBoundingClientRect();
              left = Math.max(left, q.left);
              right = Math.min(right, q.right);
            }
          }
          return {
            label: node.textContent,
            visible:
              r.top >= top - 2 &&
              r.bottom <= bottom + 2 &&
              r.left >= left - 2 &&
              r.right <= right + 2,
          };
        });
        assert(visible.visible, `${label} is not fully revealed by controller focus`);
      }
      return `${targets.length} non-Back actions reached without directly setting ui.index; Back is exercised by the navigation checks.`;
    },
  );
  await check(page, 'Escape cancels keyboard remapping before leaving its menu', async () => {
    await page.locator('[data-action="bindings"]').click();
    await screen(page, 'bindings');
    const before = await page.evaluate(() => structuredClone(urchinDebug.input.map));
    await page
      .locator('[data-choice-index]')
      .filter({ hasText: /^Increase throttle:/ })
      .click();
    await page.waitForFunction(() => !!urchinDebug.input.capture);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'bindings');
    assert.equal(await page.evaluate(() => !!urchinDebug.input.capture), false);
    assert.deepEqual(await page.evaluate(() => structuredClone(urchinDebug.input.map)), before);
  });
  if (await page.evaluate(() => urchinDebug.ui.screen === 'bindings')) await back(page);
  await check(
    page,
    'Partial controller naming survives refresh and cancels without changing bindings',
    async () => {
      await page.locator('[data-action="controller"]').click();
      await screen(page, 'controller');
      const before = await page.evaluate(() => ({
        map: structuredClone(urchinDebug.input.map),
        names: structuredClone(urchinDebug.input.faceNames),
      }));
      await page.getByRole('button', { name: 'Name physical face buttons', exact: true }).click();
      await page.waitForFunction(
        () => urchinDebug.input.naming && !urchinDebug.input.naming.waitRelease,
      );
      await page.evaluate(() => {
        window.reviewPad.buttons[2] = { value: 1, pressed: true };
      });
      await page.waitForFunction(() => urchinDebug.input.naming?.index === 1);
      await page.evaluate(() => {
        window.reviewPad.buttons[2] = { value: 0, pressed: false };
      });
      await page.setViewportSize({ width: 1180, height: 800 });
      await page.waitForTimeout(450);
      assert.equal(await page.evaluate(() => urchinDebug.input.naming?.names.b2), 'A');
      assert.equal(await page.evaluate(() => urchinDebug.input.naming?.index), 1);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !urchinDebug.input.naming);
      assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'controller');
      assert.deepEqual(
        await page.evaluate(() => ({
          map: structuredClone(urchinDebug.input.map),
          names: structuredClone(urchinDebug.input.faceNames),
        })),
        before,
      );
      await page.setViewportSize({ width: 1280, height: 800 });
      await back(page);
      await screen(page, 'settings');
    },
  );
  if (await page.evaluate(() => urchinDebug.ui.screen === 'settings')) await back(page);
  await screen(page, 'harbour');
  await check(
    page,
    'Back/Forward restores a nested shop position and a new branch clears Forward',
    async () => {
      await page.locator('[data-action="fleet"]').click();
      await screen(page, 'fleet');
      const item = page.locator('.career-choices .shop-inspect').last();
      await item.click();
      await item.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const before = await page.evaluate(() => ({
        index: urchinDebug.ui.index,
        boat: urchinDebug.ui.boatCandidate,
        scroll: document.querySelector('.career-choices').scrollTop,
      }));
      await pressAction(page, 'reviewPad', 'back');
      await screen(page, 'harbour');
      await page.locator('#playtest .screen-forward:not(:disabled)').click();
      await screen(page, 'fleet');
      const after = await page.evaluate(() => ({
        index: urchinDebug.ui.index,
        boat: urchinDebug.ui.boatCandidate,
        scroll: document.querySelector('.career-choices').scrollTop,
      }));
      assert.equal(after.boat, before.boat);
      assert.equal(after.index, before.index);
      assert(Math.abs(after.scroll - before.scroll) < 3);
      await pressAction(page, 'reviewPad', 'back');
      await screen(page, 'harbour');
      await page.locator('[data-action="crew"]').click();
      await screen(page, 'crew');
      assert.equal(await page.evaluate(() => !!urchinDebug.ui.forwardHistory?.length), false);
    },
  );
  await page.close();

  const realistic = await ready();
  await starter(realistic, true);
  await purchase(realistic);
  await settings(realistic);
  await realistic.locator('[data-action="assists"]').click();
  await screen(realistic, 'assists');
  await check(
    realistic,
    'Realistic career retains information limits through Custom and All Off switches',
    async () => {
      assert.equal(
        await realistic.evaluate(() => urchinDebug.world.career.difficulty),
        'realistic',
      );
      assert.equal(
        await realistic.locator('[data-action="easy"]').count(),
        0,
        'Easy preset is not an available action in a Realistic career',
      );
      const unavailable = ['diverIndicators', 'groundDots', 'offscreenArrows', 'currentOverlay'];
      for (const key of unavailable)
        assert.equal(
          await realistic.locator(`[data-action="assist-${key}"]`).count(),
          0,
          `${key} stays unavailable`,
        );
      const load = realistic.locator('[data-action="assist-exactLoad"]');
      assert(await load.isEnabled(), 'Exact deck readouts remain a Realistic preference');
      await load.click();
      await realistic.waitForTimeout(150);
      assert.equal(await load.getAttribute('aria-checked'), 'false');
      await realistic.locator('[data-action="off"]').click();
      await realistic.locator('[data-action="custom"]').click();
      await realistic.waitForTimeout(150);
      assert.equal(
        await load.getAttribute('aria-checked'),
        'false',
        'Custom slot retains the deliberate change',
      );
      assert.equal(
        await realistic.evaluate(() => urchinDebug.world.career.difficulty),
        'realistic',
      );
      for (const key of unavailable)
        assert.equal(await realistic.locator(`[data-action="assist-${key}"]`).count(), 0);
    },
  );
  await realistic.close();

  const touch = await ready({ width: 390, height: 844 }, true);
  await touch.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
  await screen(touch, 'touch-options');
  await touch.locator('[data-action="touchscreen"]').tap();
  await check(
    touch,
    'Native touch scroll beginning on a switch never activates that switch',
    async () => {
      const control = touch.locator('[data-action="touch-adjust"]');
      await control.scrollIntoViewIfNeeded();
      const before = await control.getAttribute('aria-checked'),
        r = await control.boundingBox(),
        client = await touch.context().newCDPSession(touch);
      const x = r.x + r.width / 2,
        y = r.y + r.height / 2;
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
      });
      for (let n = 1; n <= 8; n++) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: y - n * 20 }],
        });
        await touch.waitForTimeout(30);
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.waitForTimeout(250);
      assert.equal(await control.getAttribute('aria-checked'), before);
      await client.detach();
    },
  );
  await touch.close();
} finally {
  writeFileSync(`${output}/results.json`, JSON.stringify({ base, results, errors }, null, 2));
  await browser.close();
}
assert.deepEqual(errors, [], 'No browser or resource errors');
assert(
  results.every((result) => result.pass),
  'Independent menu checks failed; see the saved results.',
);
