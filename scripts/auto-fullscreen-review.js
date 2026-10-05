// October 5: on touch screens, starting play enters fullscreen (where the game
// requests every orientation) so the view turns with the device. Keyboard
// play, a deliberate exit and the Settings switch all leave the page alone.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const directory = 'test-results/auto-fullscreen-2026-10-05';
mkdirSync(directory, { recursive: true });
const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/',
  records = [],
  errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
async function open({ touch, auto = 'on' }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: touch,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(
    ({ touch, auto }) => {
      localStorage.setItem('urchin3d-auto-fullscreen-v1', auto);
      if (touch) localStorage.setItem('urchin-touchscreen-v1', 'on');
      window.orientationRequests = [];
      const lock = screen.orientation?.lock?.bind(screen.orientation);
      if (screen.orientation)
        screen.orientation.lock = (value) => {
          window.orientationRequests.push(value);
          return lock ? lock(value).catch(() => {}) : Promise.resolve();
        };
    },
    { touch, auto },
  );
  await page.goto(base);
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 120000 });
  return { context, page };
}
const fullscreen = (page) => page.evaluate(() => !!document.fullscreenElement);
try {
  {
    const { context, page } = await open({ touch: true });
    await page.locator('[data-title-action="new"]').tap();
    await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 });
    await page.waitForTimeout(400);
    assert(
      (await page.evaluate(() => window.orientationRequests)).includes('any'),
      'fullscreen asks for every orientation',
    );
    records.push('Touch: New career entered fullscreen and requested every orientation.');
    await page.evaluate(() => document.exitFullscreen());
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.evaluate(() => urchinDebug.ui.showTitle());
    await page.locator('[data-title-action="continue"]').tap();
    await page.waitForTimeout(600);
    assert.equal(await fullscreen(page), false, 'a deliberate exit is respected');
    records.push('Touch: after leaving fullscreen deliberately, Continue does not re-enter it.');
    await context.close();
  }
  {
    const { context, page } = await open({ touch: true, auto: 'off' });
    await page.locator('[data-title-action="new"]').tap();
    await page.waitForTimeout(600);
    assert.equal(await fullscreen(page), false);
    records.push('Touch with the setting OFF: no automatic fullscreen.');
    await context.close();
  }
  {
    const { context, page } = await open({ touch: false });
    await page.locator('[data-title-action="new"]').click();
    await page.waitForTimeout(600);
    assert.equal(await fullscreen(page), false);
    records.push('Keyboard/mouse: no automatic fullscreen.');
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(records.join('\n'));
} finally {
  writeFileSync(`${directory}/results.json`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
