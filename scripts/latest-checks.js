import { gamepadScript, pressGamepad } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
import assert from 'node:assert/strict';
export async function latestChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(gamepadScript, {
    name: 'fakePad',
    id: 'Xbox already connected at process start',
    mapping: 'standard',
    index: 2,
  });
  async function button(i) {
    return pressGamepad(page, 'fakePad', i);
  }
  async function choose(prefix) {
    return chooseController(
      page,
      (name) => button({ confirm: 0, menuDown: 13, menuUp: 12, menuLeft: 14, menuRight: 15 }[name]),
      prefix,
    );
  }
  try {
    await page.goto((process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/') + '?prototype=1');
    await page.waitForFunction(() => urchinDebug?.ui?.screen === 'chart');
    assert.equal(await page.evaluate(() => urchinDebug.input.activePad.index), 2);
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    await choose('South Reef');
    await choose('Begin working day');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.day.minute = 590;
      Object.assign(w.boat, {
        x: 312,
        y: 270,
        configuration: 'twinjet',
        throttle: 0,
        rudder: 0,
        turn: 0,
      });
    });
    await page.waitForTimeout(100);
    const current = await page.evaluate(() => {
      const w = urchinDebug.world,
        c = urchinDebug.currentAt(w.boat.x, w.boat.y);
      return (Math.hypot(c.x, c.y) * urchinDebug.config.knotsPerMps).toFixed(1);
    });
    assert(Number(current) > 3);
    assert((await page.locator('.current-instrument').textContent()).includes(current + ' kn'));
    await button(5);
    await page.screenshot({ path: 'test-results/latest-strong-channel.png' });
    await button(5);
    await button(9);
    await choose('Tide & current almanac');
    await page.screenshot({ path: 'test-results/latest-almanac.png' });
    await button(1);
    await choose('Resume');
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.terrain.depths.fill(20);
      Object.assign(w.environment, {
        model: 'uniform',
        current: { x: 0, y: 0 },
        wind: { x: 0, y: 0 },
        waves: 0,
      });
      w.logs = [];
      Object.assign(w.boat, { vx: 0, vy: 0, throttle: 0, rudder: 0, turn: 0 });
      fakePad.axes = [0, 0, 0, 1];
    });
    await page.waitForFunction(() => urchinDebug.world.boat.turn > 0.2);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), 0);
    await page.evaluate(() => (fakePad.axes = [0, 0, 0, 0]));
    await page.waitForTimeout(100);
    await button(12);
    await page.evaluate(() => (fakePad.axes[3] = 1));
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.pivot), 0);
    await page.evaluate(() => (fakePad.axes[3] = 0));
    await button(14);
    await button(9);
    await choose('Exit Game');
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.screenshot({ path: 'test-results/latest-exit-1024.png' });
    assert(await page.getByRole('button', { name: 'Cancel exit', exact: true }).isVisible());
    await button(1);
    assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'pause');
    assert(!(await page.evaluate(() => urchinDebug.ui.ended)));
    assert.deepEqual(errors, []);
    console.log(
      'PASS: preconnected sparse-index Xbox startup, controller title/chart/departure/helm/almanac/exit/back, current instrument agrees with simulation, independent neutral jet pivot and compact exit rendering.',
    );
  } finally {
    await page.close();
  }
}
