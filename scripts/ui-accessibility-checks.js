import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, firefox } from '@playwright/test';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/';
const output = process.env.URCHIN_ACCESS_OUTPUT || 'test-results/ui-overhaul/accessibility';
const engine = process.argv.includes('--firefox') ? firefox : chromium;
const browser = await engine.launch({
  headless: true,
  ...(engine === chromium ? { args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'] } : {}),
});
mkdirSync(output, { recursive: true });
const checks = [],
  errors = [];
async function ready(page) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(base);
  assert.deepEqual(errors, [], 'The page and its bundled resources loaded');
  await Promise.race([
    page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 60000 }),
    new Promise((_, reject) => page.once('pageerror', reject)),
  ]);
}
async function screen(page, value) {
  await page.waitForFunction((value) => urchinDebug.ui.screen === value, value);
  await page.waitForTimeout(150);
}
async function back(page) {
  await page.getByRole('button', { name: 'Back to previous menu', exact: true }).click();
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await ready(page);
  await page.locator('#keyboardFallback').click();
  await screen(page, 'intro');
  await page.getByRole('button', { name: 'Come aboard · learn with Frank', exact: true }).click();
  await screen(page, null);
  await page.keyboard.press('F6');
  await screen(page, 'assists');
  const toggle = page.locator('[data-action="assist-timepiece"]');
  await toggle.evaluate((element) => {
    window.reviewedSwitch = element;
  });
  await page.locator('[data-action="assist-depthInstrument"]').focus();
  await page.waitForTimeout(200);
  assert(
    await toggle.evaluate((element) => element === window.reviewedSwitch),
    'Index movement preserves switch nodes',
  );
  assert.match(await page.locator('.assist-explanation h3').textContent(), /Depth instrument/);
  const before = await toggle.getAttribute('aria-checked');
  const box = await toggle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  assert(
    await toggle.evaluate((element) => element === window.reviewedSwitch),
    'Pointer down preserves pressed switch',
  );
  await page.mouse.up();
  await page.waitForFunction(
    (before) =>
      document.querySelector('[data-action="assist-timepiece"]').getAttribute('aria-checked') !==
      before,
    before,
  );
  assert(await toggle.evaluate((element) => element === window.reviewedSwitch));
  assert(
    await toggle.evaluate((element) => element === document.activeElement),
    'Pressed switch keeps native focus',
  );
  assert.equal(await page.locator('.assist-status strong').textContent(), 'Custom');
  await page.screenshot({ path: `${output}/desktop-information.png` });
  checks.push(
    'Assist controls preserve DOM identity through focus and a 300ms held pointer click; switch and Custom status update after release.',
  );
  await page.keyboard.press('Escape');
  await screen(page, null);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await screen(page, 'settings');
  await page.locator('[data-action="touch-options"]').click();
  await screen(page, 'touch-options');
  await page.screenshot({ path: `${output}/desktop-touch-options.png` });
  await page.close();

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const touch = await context.newPage();
    await ready(touch);
    await touch.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
    await screen(touch, 'touch-options');
    await touch.locator('[data-action="touchscreen"]').tap();
    await touch.waitForTimeout(150);
    assert.equal(
      await touch.locator('[data-action="touchscreen"]').getAttribute('aria-checked'),
      'true',
    );
    const slider = touch.locator('#touchScale');
    await slider.evaluate((element) => {
      window.reviewedSlider = element;
    });
    await slider.scrollIntoViewIfNeeded();
    const rect = await slider.boundingBox();
    await touch.mouse.move(rect.x + rect.width * 0.75, rect.y + rect.height / 2);
    await touch.mouse.down();
    await touch.mouse.move(rect.x + rect.width * 0.6, rect.y + rect.height / 2, { steps: 6 });
    await touch.waitForTimeout(200);
    await touch.mouse.up();
    assert(
      await slider.evaluate((element) => element === window.reviewedSlider),
      'Slider remains mounted during drag',
    );
    assert.notEqual(await slider.inputValue(), '100');
    await touch.locator('[data-action="touch-reset"]').tap();
    await touch.waitForTimeout(150);
    assert.equal(await slider.inputValue(), '100');
    await touch.locator('[data-action="touch-fainter"]').tap();
    await touch.waitForTimeout(150);
    assert.equal(await touch.locator('#touchOpacity').inputValue(), '95');
    await touch.locator('[data-action="touch-adjust"]').tap();
    await touch.locator('[data-action="touch-hud"]').tap();
    await touch.waitForTimeout(150);
    assert.equal(
      await touch.locator('[data-action="touch-adjust"]').getAttribute('aria-checked'),
      'true',
    );
    assert.equal(
      await touch.locator('[data-action="touch-hud"]').getAttribute('aria-checked'),
      'false',
    );
    await touch.evaluate(() => {
      document.querySelector('#playtest').scrollTop = 0;
    });
    await touch.screenshot({ path: `${output}/touch-options-${viewport.width}.png` });
    const undersized = await touch
      .locator('#playtest button:not([hidden]), #playtest input[type="range"]')
      .evaluateAll((elements) =>
        elements
          .map((element) => ({
            text: element.textContent || element.id,
            rect: element.getBoundingClientRect(),
          }))
          .filter(
            ({ rect }) => rect.width && rect.height && (rect.height < 43.9 || rect.width < 43.9),
          )
          .map(({ text, rect }) => ({ text, width: rect.width, height: rect.height })),
      );
    assert.deepEqual(undersized, [], 'Touch menu controls have physical 44px targets');
    assert.equal(
      await touch.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await back(touch);
    await touch.waitForFunction(() => !urchinDebug.ui.started);
    await touch.reload();
    await touch.waitForFunction(() => window.urchinDebug?.ready);
    await touch.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
    await screen(touch, 'touch-options');
    assert.equal(await touch.locator('#touchOpacity').inputValue(), '95');
    assert.equal(
      await touch.locator('[data-action="touchscreen"]').getAttribute('aria-checked'),
      'true',
    );
    if (viewport.width === 390) {
      await back(touch);
      await touch.locator('#keyboardFallback').tap();
      await screen(touch, 'intro');
      await touch
        .getByRole('button', { name: 'Come aboard · learn with Frank', exact: true })
        .tap();
      await screen(touch, null);
      await touch.locator('#touchMenu').tap();
      await touch.getByRole('button', { name: 'UI / difficulty options', exact: true }).tap();
      await screen(touch, 'assists');
      const description = touch.locator('#assist-about-timepiece');
      await touch.getByRole('button', { name: 'About Timepiece', exact: true }).tap();
      assert(await description.isVisible(), 'Touch explanation opens next to the chosen control');
      await touch.screenshot({ path: `${output}/phone-information.png` });
    }
    checks.push(
      `${viewport.width}×${viewport.height}: touch toggle, stable slider drag, 5% opacity step, reset, Adjust UI, information switch, Back context, reload persistence and physical 44px menu targets pass.`,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(
    `${output}/results-${engine === firefox ? 'firefox' : 'chromium'}.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(checks.join('\n'));
  await browser.close();
}
