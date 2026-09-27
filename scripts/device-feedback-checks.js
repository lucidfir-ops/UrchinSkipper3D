import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
import { chooseStarter } from './career-start.js';

export async function deviceFeedbackChecks(browser) {
  const records = [];
  for (const [name, width, height, touch] of [
    ['tablet', 1224, 816, true],
    ['s22', 873, 402, true],
    ['deck', 1280, 800, false],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.setDefaultTimeout(15000);
    const pad = (action) => pressAction(page, 'devicePad', action);
    const choose = (label) => chooseController(page, pad, label);
    try {
      await page.addInitScript(gamepadScript, { name: 'devicePad', id: 'Device acceptance Xbox' });
      await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
      await page.waitForFunction(() => window.urchinDebug?.ui);
      await page.evaluate((touch) => urchinDebug.ui.touch.setEnabled(touch), touch);
      if (touch) await page.locator('#keyboardFallback').click();
      else await pad('confirm');
      await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
      assert.match(await page.locator('#playtest').innerText(), /Frank/);
      await page.screenshot({ path: `test-results/sep20-${name}-frank.png` });
      await chooseStarter(page, choose);
      console.log(`Device ${name}: intro and starter passed`);
      for (const screen of ['crew', 'conditions', 'fleetboard', 'settings', 'layout']) {
        await page.evaluate((screen) => urchinDebug.ui.open(screen), screen);
        await page.waitForTimeout(250);
        await page.screenshot({ path: `test-results/sep20-${name}-${screen}.png` });
        const rect = await page.locator('#playtest').evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        });
        assert(
          rect.left >= -1 && rect.top >= -1 && rect.right <= width + 1 && rect.bottom <= height + 1,
          `${name} ${screen}: ${JSON.stringify(rect)}`,
        );
      }
      await page.locator('[data-action="layout-diverPanel"]').click();
      await page.locator('[data-action="layout-move"]').click();
      const up = page.locator('[data-layout-adjust="up"]');
      const bounds = await up.boundingBox();
      const before = await page.evaluate(
        () => urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'diverPanel').rect.top,
      );
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(750);
      await page.mouse.up();
      const moved = await page.evaluate(
        () => urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'diverPanel').rect.top,
      );
      assert(moved <= before - 48, `${name}: held arrow must repeat`);
      const down = await page.locator('[data-layout-adjust="down"]').boundingBox();
      await page.mouse.move(down.x + down.width / 2, down.y + down.height / 2);
      await page.mouse.down();
      await page.waitForFunction(() => {
        const r = urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'diverPanel').rect;
        return Math.abs(r.top + r.height - innerHeight + 4) < 1;
      });
      await page.mouse.up();
      assert(
        await page.evaluate(() => {
          const e = urchinDebug.ui.layoutEditor,
            r = e.rows.find((r) => r.id === 'diverPanel').rect;
          return Math.abs(r.top + r.height - innerHeight + 4) < 1;
        }),
        'bottom strip must be reachable',
      );
      await page.locator('[data-layout-adjust="finish"]').click();
      await page.locator('[data-action="layout-reset-all"]').click();
      await page.locator('[data-action="layout-save"]').click();
      await page.evaluate(() => urchinDebug.ui.open('settings'));
      await page.locator('[data-action="touch-options"]').click();
      await page.locator('[data-action="tiny-touch"]').click();
      await page.evaluate(() => urchinDebug.ui.open('harbour'));
      await page.waitForTimeout(200);
      await page.screenshot({ path: `test-results/sep20-${name}-harbour-tiny-touch.png` });
      await page.evaluate(() => urchinDebug.ui.open('settings'));
      await page.locator('[data-action="touch-options"]').click();
      await page.locator('[data-action="tiny-touch"]').click();
      await page.evaluate(() => {
        urchinDebug.ui.open('harbour');
      });
      await page.waitForFunction(
        () => urchinDebug.ui.panel.dataset.screen === 'harbour' && !urchinDebug.input.suppressed,
      );
      await choose('Sail');
      await choose('Sheltered Kelp');
      await choose('Vector chart');
      await page.waitForFunction(() => urchinDebug.ui.chartMode === 'vector');
      await choose('Raster chart');
      await page.locator('[data-action="sail"]').click();
      await page.waitForFunction(() => urchinDebug.world.day.phase === 'working');
      await page.locator('#voyage').waitFor({ state: 'hidden' });
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => urchinDebug.ui.screen), null);
      await page.screenshot({ path: `test-results/sep20-${name}-water.png` });
      console.log(`Device ${name}: layout, fitting, chart selection and departure passed`);
      await pad('pause');
      await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
      await choose('Settings');
      await choose('UI Scale');
      await pad('back');
      await page.waitForFunction(() => urchinDebug.ui.screen === 'settings');
      await pad('back');
      await page.waitForFunction(() => urchinDebug.ui.screen === null);
      await pad('pause');
      await pad('back');
      await page.waitForFunction(() => urchinDebug.ui.screen === null);
      if (touch) {
        assert.match(await page.locator('#touchLockToggle').innerText(), /Adjust UI.*OFF/s);
        await page.locator('[data-touch="chart"]').tap();
        await page.waitForTimeout(500);
        assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'knowledge');
        await pad('back');
        await page.waitForFunction(() => urchinDebug.ui.screen === null);
        await page.locator('.minimap-chart').tap();
        assert.equal(await page.locator('#minimapPanel').getAttribute('data-see-through'), 'on');
        await page.locator('.minimap-chart').tap();
        assert.equal(await page.locator('#minimapPanel').getAttribute('data-see-through'), 'off');
      }
      await page.evaluate(() => {
        urchinDebug.ui.hooks.trainingReplay({ boatId: 'twinjet', scenario: 'boat' });
        urchinDebug.ui.open(null);
      });
      await page.waitForFunction(
        () => urchinDebug.world.career.trainingReplay && !urchinDebug.ui.screen,
      );
      await page.waitForTimeout(300);
      assert(await page.locator('#help').isVisible(), 'tutorial help defaults on');
      await page.screenshot({ path: `test-results/sep20-${name}-tutorial.png` });
      assert.deepEqual(errors, []);
      records.push({ name, width, height, touch, errors });
    } catch (error) {
      await page.screenshot({ path: `test-results/sep20-${name}-failure.png` });
      console.error(
        name,
        errors,
        await page.evaluate(() => ({
          screen: urchinDebug.ui.screen,
          text: document.querySelector('#playtest').innerText,
        })),
      );
      throw error;
    } finally {
      await page.close();
    }
  }
  writeFileSync('test-results/sep20-device-feedback.json', JSON.stringify(records, null, 2));
}
