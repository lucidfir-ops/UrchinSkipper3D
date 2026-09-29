import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import '../tests/matter-helper.js';
import { createCareer, freshVessel } from '../src/career-state.js';
import { careerWorld, encode, SAVE_KEY } from '../src/career-save.js';
import { FLEET_ORDER, UPGRADES } from '../src/career-data.js';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  hasTouch: true,
});
const career = createCareer(971);
career.cash = 1000000;
for (const id of FLEET_ORDER) career.fleet[id] = freshVessel(id);
await context.addInitScript(({ key, data }) => localStorage.setItem(key, data), {
  key: SAVE_KEY,
  data: encode(careerWorld(career)),
});
const page = await context.newPage(),
  errors = [],
  records = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.routeWebSocket('**', (socket) => {
  socket.connectToServer().onMessage(() => {});
});
const action = (id) => page.locator(`[data-action="${id}"]`).click();
const open = async (screen) => {
  await page.evaluate((name) => urchinDebug.ui.open(name), screen);
  await page.waitForFunction((name) => urchinDebug.ui.screen === name, screen);
};
const shot = async (name) => {
  await page.screenshot({ path: `test-results/equipment-${name}.png` });
};
const cash = () => page.evaluate(() => urchinDebug.world.career.cash);
try {
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
  await page.waitForFunction(() => window.urchinDebug?.ready, { timeout: 45000 });
  await page.locator('#keyboardFallback').click();
  console.log('Equipment review: loaded; inspecting and fitting equipment.');
  await open('outfit');
  await action('equipment-hoist');
  await page.waitForFunction(
    () =>
      document.querySelector('.career-detail [data-fitting-preview]')?.dataset.loaded === 'true',
  );
  assert(await page.locator('[data-action="buy-selected"]').isEnabled());
  await shot('hauler-preview');
  const before = await cash();
  await action('buy-inline');
  assert.equal(await page.evaluate(() => urchinDebug.ui.index), 0);
  await shot('installation-confirmation');
  await action('cancel-purchase');
  assert.equal(await cash(), before);
  await action('buy-selected');
  await action('confirm-purchase');
  assert.equal(await cash(), before - 3400);
  assert(await page.locator('[data-action="buy-selected"]').isDisabled());
  assert.match(
    await page.locator('.day-footer').innerText(),
    /Hydraulic bag hauler installed.*Port working rail/,
  );
  await shot('hauler-installed');
  await action('equipment-nitrox');
  assert(await page.locator('[data-action="buy-selected"]').isDisabled());
  assert.match(await page.locator('.career-detail').innerText(), /0 \/ 4,500 experience/);
  await shot('supplier-status');
  await action('equipment-engine');
  await shot('engine-preview');
  const canvas = page.locator('.career-detail [data-fitting-preview]');
  const firstPixels = await canvas.evaluate((element) => element.toDataURL());
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  assert.notEqual(await canvas.evaluate((element) => element.toDataURL()), firstPixels);
  await action('buy-selected');
  await action('confirm-purchase');
  records.push({
    purchase: 'hauler and repower',
    confirmationCancel: true,
    rankVisible: true,
    keyboardPreviewRotation: true,
  });
  await page.evaluate(() => {
    urchinDebug.input.suppress();
    urchinDebug.ui.touch.setEnabled(true);
  });
  console.log('Equipment review: keyboard and purchases passed; checking touch.');
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.locator('[data-action="equipment-fuel-system"]').tap();
    const detail = (await page.locator('.shop-inline-detail').isVisible())
      ? page.locator('.shop-inline-detail')
      : page.locator('.career-detail');
    await detail.scrollIntoViewIfNeeded();
    assert(await detail.isVisible());
    await page.locator('.shop-inline-buy').scrollIntoViewIfNeeded();
    await shot(`touch-${viewport.width}`);
    const button = await page.locator('.shop-inline-buy').boundingBox();
    assert(button.height >= 44);
    await page.locator('.shop-inline-buy').tap();
    await page.waitForTimeout(500);
    await shot(`touch-confirm-${viewport.width}`);
    const detailBox = await page.locator('.career-detail').boundingBox();
    const cancelBox = await page.locator('[data-action="cancel-purchase"]').boundingBox();
    assert(
      detailBox.y + detailBox.height <= cancelBox.y,
      'cost details must not overlap purchase buttons',
    );
    await page.locator('[data-action="cancel-purchase"]').tap();
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(gamepadScript);
  await page.evaluate(() => {
    urchinDebug.ui.touch.setEnabled(false);
  });
  await page.waitForFunction(() => urchinDebug.input.connected && !urchinDebug.input.suppressed);
  const pad = (name) => pressAction(page, 'fakePad', name);
  await chooseController(page, pad, 'Fuel management package');
  await chooseController(page, pad, 'Buy selected equipment', false);
  await pad('confirm');
  await page.waitForFunction(() => urchinDebug.ui.screen === 'purchase');
  await chooseController(page, pad, 'Cancel');
  records.push({
    touch: 'portrait and landscape purchase/cancel',
    syntheticController: 'inspect, buy, cancel',
  });
  await page.evaluate(
    (ids) => {
      const w = urchinDebug.world;
      w.career.xp = 12000;
      w.career.fleet[w.boat.configuration].equipment = ids;
    },
    UPGRADES.map((item) => item.id),
  );
  await open('yourboat');
  await page.waitForFunction(
    () =>
      document.querySelector('.career-detail [data-fitting-preview]')?.dataset.loaded === 'true',
  );
  await shot('complete-installation');
  const fleetRenders = new Set();
  for (const id of FLEET_ORDER) {
    await action(`fit-${id}`);
    await page.waitForFunction((id) => {
      const canvas = document.querySelector('.career-detail [data-fitting-preview]');
      return canvas?.dataset.loaded === 'true' && canvas.dataset.previewBoat === id;
    }, id);
    fleetRenders.add(
      await page
        .locator('.career-detail [data-fitting-preview]')
        .evaluate((canvas) => canvas.toDataURL()),
    );
    await shot(`boat-${id}`);
  }
  assert.equal(
    fleetRenders.size,
    FLEET_ORDER.length,
    'every authored hull has a distinct rendered preview',
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    'test-results/equipment-review.json',
    JSON.stringify({ records, errors, physicalController: 'not tested' }, null, 2),
  );
  console.log(
    'Equipment preview, transactions, all boats, keyboard, touch and synthetic controller checks passed.',
  );
} catch (error) {
  await shot('failure');
  console.error(
    await page.evaluate(() => ({
      screen: window.urchinDebug?.ui?.screen,
      index: window.urchinDebug?.ui?.index,
      errors: document.body.innerText.slice(-300),
    })),
  );
  throw error;
} finally {
  await browser.close();
}
