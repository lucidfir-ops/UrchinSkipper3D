// Screenshots of the Sail / voyage plan on the three test devices, fresh and
// with an over-fished map ("Fished hard last season" note). Usage (production
// build served, e.g. URCHIN_PORT=5186 node scripts/serve-build.js):
//   URCHIN_TEST_URL=http://127.0.0.1:5186/ PLAYWRIGHT_BROWSERS_PATH=.browser-cache \
//     node scripts/voyage-plan-shots.js
// Saves PNGs under test-results/voyage-plan/ and fails on page errors or on
// panel text overflowing the viewport. Visual review is still required.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { chooseStarter } from './career-start.js';
import { DEVICES } from './ui-gallery-devices.js';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5186/',
  output = process.env.URCHIN_SHOT_OUTPUT || 'test-results/voyage-plan';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const failures = [];
try {
  for (const device of DEVICES) {
    const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: device.scale,
        hasTouch: device.touch,
        isMobile: false,
      }),
      page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (device.touch)
      await page.addInitScript(() => localStorage.setItem('urchin-touchscreen-v1', 'on'));
    await page.goto(base);
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 120000 });
    const tap = (selector) =>
      device.touch ? page.locator(selector).tap() : page.locator(selector).click();
    await tap('[data-title-action="new"]');
    await page.waitForFunction(() =>
      ['intro', 'starter', 'harbour'].includes(urchinDebug.ui.screen),
    );
    await chooseStarter(page, async (label) => {
      await page.getByRole('button', { name: label }).first().click();
    });
    for (const worked of [false, true]) {
      await page.evaluate((worked) => {
        const { ui, world: w } = urchinDebug;
        for (const area of Object.values(w.career.quotaAreas.areas))
          for (const record of area.subAreas) record.health = worked ? 0.5 : 1;
        ui.chartGroundId = 'near';
        ui.open('departure');
      }, worked);
      await page.waitForTimeout(500);
      const text = await page.evaluate(
        () => document.querySelector('.menu-panel, .panel, body').innerText,
      );
      if (worked !== /fished hard last season/.test(text))
        failures.push(`${device.id}: fished-hard note ${worked ? 'missing' : 'unexpected'}`);
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll('p, h3, button')]
          .filter((e) => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1)
          .map((e) => e.textContent.slice(0, 40)),
      );
      if (overflow.length) failures.push(`${device.id}: overflow ${overflow.join(' | ')}`);
      await page.screenshot({ path: `${output}/${device.id}-${worked ? 'worked' : 'fresh'}.png` });
      // The note sits in the scrolling detail; capture it scrolled into view too.
      if (worked) {
        await page.evaluate(() =>
          [...document.querySelectorAll('p')]
            .find((p) => p.textContent.includes('fished hard'))
            ?.scrollIntoView({ block: 'center' }),
        );
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${output}/${device.id}-worked-note.png` });
      }
    }
    if (errors.length) failures.push(`${device.id}: ${errors.join('; ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`voyage plan screenshots in ${output}`);
