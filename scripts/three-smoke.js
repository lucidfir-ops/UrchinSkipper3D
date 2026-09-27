import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = 'test-results/three';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
try {
  await page.goto(
    process.env.URCHIN_TEST_URL || process.env.URCHIN_URL || 'http://127.0.0.1:5184/',
    {
      waitUntil: 'networkidle',
      timeout: 90000,
    },
  );
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${output}/title.png` });
  console.log(
    'title',
    await page.evaluate(() => ({
      renderer: urchinDebug.renderer,
      canvas: document.querySelector('#ocean3d')?.getBoundingClientRect().toJSON(),
      three: urchinDebug.three.renderer.info.render,
      boat: urchinDebug.world.boat,
      phase: urchinDebug.world.day.phase,
    })),
  );
  await page.locator('#keyboardFallback').click({ noWaitAfter: true });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${output}/started.png` });
  console.log(
    'started',
    await page.evaluate(() => ({
      screen: urchinDebug.ui.screen,
      lock: urchinDebug.ui.lockReason,
      body: document.querySelector('#playtest').innerText.slice(0, 1500),
    })),
  );
  await page
    .getByRole('button', { name: 'Come aboard · learn with Frank', exact: true })
    .click({ noWaitAfter: true });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${output}/sea.png` });
  await page.evaluate(() => {
    urchinDebug.ui.open(null);
    urchinDebug.three.host.cameras.main.setZoom(1.65);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}/sea-close.png` });
  console.log(
    'sea',
    await page.evaluate(() => ({
      screen: urchinDebug.ui.screen,
      lock: urchinDebug.ui.lockReason,
      triangles: urchinDebug.three.renderer.info.render,
      terrain: urchinDebug.world.terrain.size,
    })),
  );
  if (process.argv.includes('--inspect')) {
    await page.evaluate(() => {
      urchinDebug.ui.hooks.finishIntro(true);
      urchinDebug.ui.open('harbour');
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${output}/harbour.png` });
  }
  console.log('errors', errors);
  writeFileSync(`${output}/errors.json`, JSON.stringify(errors, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
