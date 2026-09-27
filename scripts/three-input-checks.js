import { chromium, firefox } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/';
const engine = process.argv.includes('--firefox') ? firefox : chromium;
const browser = await engine.launch({
  headless: true,
  ...(engine === chromium ? { args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'] } : {}),
});
const errors = [],
  results = [];
mkdirSync('test-results/three', { recursive: true });
const watch = (p) => {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
};
const ready = async (p) => {
  await p.goto(base + '?practice=1');
  await p.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 60000 });
  assert(
    await p.evaluate(
      () =>
        urchinDebug.three.host.scale.width === innerWidth &&
        urchinDebug.three.host.scale.height === innerHeight,
    ),
  );
};
const water = async (p) => {
  await p.locator('#keyboardFallback').click({ noWaitAfter: true });
  await p.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.blocked);
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  watch(page);
  await ready(page);
  await water(page);
  assert(
    await page.evaluate(
      () => urchinDebug.world.trafficView.rangeX > 0 && urchinDebug.world.trafficView.rangeY > 0,
    ),
  );
  await page.keyboard.down('w');
  await page.waitForTimeout(800);
  await page.keyboard.up('w');
  const throttle = await page.evaluate(() => urchinDebug.world.boat.throttle);
  assert(throttle > 0.15);
  await page.waitForTimeout(200);
  assert(Math.abs((await page.evaluate(() => urchinDebug.world.boat.throttle)) - throttle) < 0.01);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
  await page.keyboard.down('d');
  await page.waitForTimeout(450);
  await page.keyboard.up('d');
  assert(await page.evaluate(() => urchinDebug.world.boat.rudder > 0.1));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => urchinDebug.world.boat.rudder === 0);
  await page.keyboard.press('1');
  await page.waitForFunction(() => urchinDebug.world.divers.some((d) => d.state !== 'ready'));
  assert.equal(await page.evaluate(() => urchinDebug.world.divers.length), 2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
  const pausedTime = await page.evaluate(() => urchinDebug.world.time);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => urchinDebug.world.time), pausedTime);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !urchinDebug.ui.screen);
  await page.evaluate(() => urchinDebug.ui.hooks.testPickup(false));
  await page.waitForFunction(() => !urchinDebug.input.suppressed);
  await page.screenshot({ path: 'test-results/three/recovery-prompts.png' });
  await page.keyboard.press('2');
  await page.waitForFunction(() => urchinDebug.world.catch >= 300, null, { timeout: 15000 });
  assert(
    await page.evaluate(() =>
      urchinDebug.world.divers.some((d) => d.state !== 'surface' && d.state !== 'ready'),
    ),
  );
  await page.keyboard.press('1');
  await page.waitForFunction(() => urchinDebug.world.divers.some((d) => d.state === 'ready'));
  await page.keyboard.press('m');
  await page.waitForFunction(() => !!urchinDebug.ui.screen);
  assert(await page.evaluate(() => /chart/.test(urchinDebug.ui.screen)));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !urchinDebug.ui.screen);
  const quality = await page.evaluate(() => urchinDebug.ui.hooks.cycleGraphics());
  assert.equal(quality, 'Balanced');
  await page.reload();
  await page.waitForFunction(() => window.urchinDebug?.ready);
  assert.equal(await page.evaluate(() => urchinDebug.ui.hooks.graphicsLabel()), 'Balanced');
  console.log('Keyboard checks passed');
  results.push(
    'Keyboard persistent helm, neutral/centre, independent deployment, pause, one-press bag exchange, boarding, chart and saved graphics pass.',
  );
  await page.close();
  if (engine === chromium) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
    });
    const p = await context.newPage();
    watch(p);
    await ready(p);
    await p
      .getByRole('button', { name: 'Touchscreen Options', exact: true })
      .click({ noWaitAfter: true });
    await p
      .getByRole('button', { name: 'Touchscreen mode: OFF', exact: true })
      .click({ noWaitAfter: true });
    await p.waitForTimeout(300);
    await p
      .getByRole('button', { name: 'Back to previous menu', exact: true })
      .click({ noWaitAfter: true });
    await water(p);
    await p.locator('[data-touch="fullAhead"]').tap();
    await p.waitForFunction(() => urchinDebug.world.boat.throttle === 1);
    const boat = await p.evaluate(() => urchinDebug.three.boatScreenPose(urchinDebug.world));
    await p.touchscreen.tap(boat.x, boat.y);
    await p.waitForFunction(
      () => urchinDebug.world.boat.throttle === 0 && urchinDebug.world.boat.rudder === 0,
    );
    await p.locator('[data-touch="fullAhead"]').tap();
    await p.waitForFunction(() => urchinDebug.world.boat.throttle === 1);
    await p.locator('[data-touch="neutral"]').tap();
    await p.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
    await p.locator('[data-touch="chart"]').tap();
    await p.waitForFunction(() => !!urchinDebug.ui.screen);
    assert(await p.evaluate(() => /chart/.test(urchinDebug.ui.screen)));
    await p.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
    await p.waitForFunction(() => !urchinDebug.ui.screen);
    await p.screenshot({ path: 'test-results/three/touch-landscape.png' });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForFunction(
      () =>
        urchinDebug.three.host.scale.width === innerWidth &&
        urchinDebug.three.host.scale.height === innerHeight,
    );
    await p.waitForTimeout(300);
    await p.screenshot({ path: 'test-results/three/touch-portrait.png' });
    assert(await p.locator('#touchMenu').isVisible());
    results.push(
      'Touch full-ahead/neutral, projected boat-tap neutral/centre, chart and landscape/portrait rendering pass.',
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(results.join('\n'));
} finally {
  writeFileSync(
    `test-results/three/input-${engine === firefox ? 'firefox' : 'chromium'}.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
