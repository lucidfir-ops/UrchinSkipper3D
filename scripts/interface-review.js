import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/';
const output = process.env.URCHIN_REVIEW_OUTPUT || 'test-results/ui-overhaul/review';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const errors = [],
  results = [],
  captures = [];
async function ready(page) {
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(base);
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
}
async function screen(page, name) {
  await page.waitForFunction((name) => urchinDebug.ui.screen === name, name);
  await page.waitForTimeout(120);
}
async function click(page, name) {
  await page.getByRole('button', { name, exact: true }).click({ noWaitAfter: true });
}
async function back(page) {
  await click(page, 'Back to previous menu');
}
async function capture(page, name) {
  console.log('Capture:', name);
  await page.waitForFunction(
    () =>
      urchinDebug.three.host.scale.width === innerWidth &&
      urchinDebug.three.host.scale.height === innerHeight,
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/${name}.png`, animations: 'disabled' });
  const clippedCrewLabels = await page.locator('.crew-card').evaluateAll((cards) =>
    cards.flatMap((card) => {
      const bounds = card.getBoundingClientRect();
      return [...card.querySelectorAll(':scope > span:not(.crew-portrait-image), :scope > small')]
        .filter((label) => {
          const rect = label.getBoundingClientRect();
          return (
            rect.left < bounds.left - 0.5 ||
            rect.right > bounds.right + 0.5 ||
            rect.top < bounds.top - 0.5 ||
            rect.bottom > bounds.bottom + 0.5
          );
        })
        .map((label) => label.textContent);
    }),
  );
  assert.deepEqual(clippedCrewLabels, [], `${name}: crew identity/status must fit its card`);
  captures.push({
    name,
    ...(await page.evaluate(() => {
      const panel = document.querySelector('#playtest');
      return {
        viewport: { width: innerWidth, height: innerHeight },
        screen: urchinDebug.ui.screen,
        panel: panel.hidden ? null : panel.getBoundingClientRect().toJSON(),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })),
  });
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await ready(page);
  await capture(page, '01-title');
  // Enter must activate the actual focused title control after native Tab.
  await page.locator('#keyboardFallback').focus();
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement?.tagName === 'BUTTON'));
  const focused = await page.evaluate(() => document.activeElement.textContent);
  assert(!/^Continue$/.test(focused), 'Tab moves to another title action');
  await click(page, 'Settings');
  await screen(page, 'settings');
  const titleTime = await page.evaluate(() => urchinDebug.world.time);
  await capture(page, '02-title-settings');
  await page.locator('[data-action="ui-scale"]').focus();
  await page.keyboard.press('Enter');
  await screen(page, 'ui-scale');
  for (let i = 0; i < 3; i++)
    await page.locator('[data-action="ui-larger"]').click({ noWaitAfter: true });
  await capture(page, '02b-large-ui');
  await page.locator('[data-action="ui-reset"]').click({ noWaitAfter: true });
  await back(page);
  await screen(page, 'settings');
  await back(page);
  await page.waitForFunction(() => !urchinDebug.ui.started);
  assert.equal(await page.evaluate(() => urchinDebug.world.time), titleTime);
  results.push(
    'Title Settings child Back restores Settings, root Back restores Title without advancing time; focused Enter works.',
  );

  await page.locator('#keyboardFallback').click({ noWaitAfter: true });
  await screen(page, 'intro');
  await capture(page, '03-frank-briefing');
  await click(page, 'Skip day 0 · choose my boat');
  await screen(page, 'starter');
  await click(page, 'Choose Harbour Workhorse · $15,000');
  await capture(page, '04-starter');
  await page.locator('[data-action="buy-selected"]').click({ noWaitAfter: true });
  await screen(page, 'purchase');
  assert.equal(await page.evaluate(() => urchinDebug.ui.index), 0, 'Purchase starts on Cancel');
  await capture(page, '05-purchase');
  if (process.argv.includes('--visual-pass')) {
    await page.locator('[data-action="confirm-purchase"]').click({ noWaitAfter: true });
  } else {
    const purchaseButton = await page.locator('[data-action="confirm-purchase"]').boundingBox();
    await page.mouse.move(
      purchaseButton.x + purchaseButton.width / 2,
      purchaseButton.y + purchaseButton.height / 2,
    );
    await page.mouse.down();
    await page.waitForTimeout(400);
    await page.mouse.up();
  }
  await screen(page, 'harbour');
  await capture(page, '06-harbour');
  await page.locator('[data-action="settings"]').click({ noWaitAfter: true });
  await screen(page, 'settings');
  await capture(page, '07-settings');
  for (const [action, destination, name] of [
    ['assists', 'assists', '08-information'],
    ['touch-options', 'touch-options', '09-touch-options'],
    ['bindings', 'bindings', '10-bindings'],
    ['layout', 'layout', '11-arrange-ui'],
  ]) {
    await page.locator(`[data-action="${action}"]`).click({ noWaitAfter: true });
    await screen(page, destination);
    await capture(page, name);
    await back(page);
    await screen(page, 'settings');
  }
  await back(page);
  await screen(page, 'harbour');
  for (const [action, name] of [
    ['crew', '12-crew'],
    ['fleet', '13-fleet'],
    ['outfit', '14-chandlery'],
    ['office', '15-office'],
    ['conditions', '16-weather'],
  ]) {
    await page.locator(`[data-action="${action}"]`).click({ noWaitAfter: true });
    await screen(page, action);
    await capture(page, name);
    await back(page);
    await screen(page, 'harbour');
  }
  results.push(
    'Natural funded career purchase, harbour destinations, Settings children and return contexts pass.',
  );
  await page.close();

  // A normal tutorial start gives a reproducible water view. Removing its lesson
  // flag below is a presentation fixture, not a claim to have completed a voyage.
  const water = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await ready(water);
  await water.locator('#keyboardFallback').click({ noWaitAfter: true });
  await click(water, 'Come aboard · learn with Frank');
  await screen(water, null);
  await capture(water, '17-tutorial-hud');
  await water.evaluate(() => {
    const w = urchinDebug.world;
    w.career.intro.status = 'complete';
    w.career.assists.controlsHelp = false;
  });
  await water.keyboard.press('Space');
  await water.waitForFunction(() => !document.querySelector('#keyboardHelm').hidden);
  await capture(water, '18-easy-hud');
  await water.setViewportSize({ width: 844, height: 390 });
  await capture(water, '18b-compact-keyboard-hud');
  await water.setViewportSize({ width: 1280, height: 800 });
  await water.keyboard.down('w');
  await water.waitForTimeout(350);
  await water.keyboard.up('w');
  const throttle = await water.evaluate(() => urchinDebug.world.boat.throttle);
  assert(throttle > 0);
  await water.waitForTimeout(150);
  assert.equal(await water.evaluate(() => urchinDebug.world.boat.throttle), throttle);
  await water.keyboard.press('Space');
  await water.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
  await water.keyboard.press('Escape');
  await screen(water, 'pause');
  await capture(water, '19-pause');
  await click(water, 'Settings');
  await screen(water, 'settings');
  await water.locator('[data-action="assists"]').click({ noWaitAfter: true });
  await screen(water, 'assists');
  await water.locator('[data-action="realistic"]').click({ noWaitAfter: true });
  await back(water);
  await screen(water, 'settings');
  await back(water);
  await screen(water, null);
  assert(await water.locator('#divers').evaluate((e) => e.classList.contains('portrait-only')));
  assert(await water.locator('#currentReadout').isHidden());
  assert.equal(await water.locator('#divers .diver-meters').count(), 0);
  await capture(water, '20-realistic-hud');
  await water.keyboard.press('m');
  await water.waitForFunction(() => /chart|knowledge/.test(urchinDebug.ui.screen));
  await capture(water, '21-chart');
  await back(water);
  await screen(water, null);
  await water.keyboard.press('Escape');
  await screen(water, 'pause');
  await click(water, 'UI / difficulty options');
  await screen(water, 'assists');
  await water.locator('[data-action="off"]').click({ noWaitAfter: true });
  await water.keyboard.press('Escape');
  await screen(water, null);
  await capture(water, '21b-all-off');
  for (const id of [
    'timepiecePanel',
    'depthInstrumentPanel',
    'loadPanel',
    'minimapPanel',
    'diverPanel',
  ])
    assert(await water.locator(`#${id}`).isHidden(), `${id} respects All Off`);
  results.push(
    'Persistent keyboard helm, neutral, sea Settings Back to water, direct Chart Back to water and Realistic identity-only HUD pass.',
  );
  await water.close();

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(gamepadScript, { name: 'reviewPad' });
  const controller = await context.newPage();
  await ready(controller);
  const action = (name) => pressAction(controller, 'reviewPad', name);
  const choose = (prefix) => chooseController(controller, action, prefix);
  await action('confirm');
  await screen(controller, 'intro');
  await choose('Come aboard');
  await screen(controller, null);
  await action('pause');
  await screen(controller, 'intropause');
  await choose('Settings');
  await screen(controller, 'settings');
  await choose('Touchscreen Options');
  await screen(controller, 'touch-options');
  await action('back');
  await screen(controller, 'settings');
  await choose('Controller Remapping');
  await screen(controller, 'bindings');
  await action('back');
  await screen(controller, 'settings');
  await action('back');
  await screen(controller, null);
  results.push(
    'Synthetic mapped controller navigates tutorial, grouped Settings, touch options and remapping; B returns to correct contexts. Physical hardware was not tested.',
  );
  await context.close();

  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const touch = await touchContext.newPage();
  await ready(touch);
  await capture(touch, '22-phone-title');
  await touch.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
  await screen(touch, 'touch-options');
  await touch.locator('[data-action=touchscreen]').tap();
  await capture(touch, '23-phone-touch-options');
  await touch.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
  await touch.locator('#keyboardFallback').tap();
  await touch.getByRole('button', { name: 'Come aboard · learn with Frank', exact: true }).tap();
  await screen(touch, null);
  await capture(touch, '24-phone-tutorial');
  await touch.setViewportSize({ width: 844, height: 390 });
  await capture(touch, '24b-landscape-tutorial');
  await touch.setViewportSize({ width: 390, height: 844 });
  await touch.evaluate(() => {
    urchinDebug.world.career.intro.status = 'complete';
    urchinDebug.world.career.assists.controlsHelp = false;
  });
  await touch.locator('[data-touch="fullAhead"]').tap();
  await touch.waitForFunction(() => urchinDebug.world.boat.throttle === 1);
  await touch.locator('[data-touch="neutral"]').tap();
  await touch.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
  await capture(touch, '25-phone-hud');
  await touch.locator('#touchMenu').tap();
  await screen(touch, 'pause');
  await capture(touch, '26-phone-pause');
  await touch.getByRole('button', { name: 'Settings', exact: true }).tap();
  await screen(touch, 'settings');
  await capture(touch, '27-phone-settings');
  await touch.setViewportSize({ width: 844, height: 390 });
  await capture(touch, '28-landscape-settings');
  await touch.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
  await screen(touch, null);
  await capture(touch, '29-landscape-hud');
  for (const rect of await touch
    .locator('#touchControls [data-touch]')
    .evaluateAll((elements) =>
      elements.map((e) => ({ name: e.dataset.touch, ...e.getBoundingClientRect().toJSON() })),
    )) {
    assert(rect.width >= 44 && rect.height >= 44, `${rect.name}: core touch target below 44px`);
  }
  results.push(
    'Native touchscreen taps, helm, menu return, portrait/landscape resize and core 44px touch targets pass.',
  );
  await touchContext.close();
  assert.deepEqual(errors, []);
  assert(
    captures.every((capture) => !capture.horizontalOverflow),
    'No page-level horizontal overflow',
  );
  console.log(results.join('\n'));
} finally {
  writeFileSync(`${output}/results.json`, JSON.stringify({ results, captures, errors }, null, 2));
  await browser.close();
}
