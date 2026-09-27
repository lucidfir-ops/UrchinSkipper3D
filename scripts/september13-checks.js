import { gamepadScript, pressAction } from './gamepad-fixture.js';
import assert from 'node:assert/strict';
import { chooseController } from './controller-menu.js';
import { DEFAULTS, LABELS } from '../src/input.js';
export async function september13Checks(browser, name = 'chromium') {
  const page = await browser.newPage({ viewport: { width: 1152, height: 720 } }),
    errors = [];
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(gamepadScript, {
    name: 'reviewPad',
    id: 'September 13 Xbox',
    index: 0,
    mapping: 'standard',
  });
  const action = async (action) => {
    return pressAction(page, 'reviewPad', action);
  };
  const choose = (prefix) => chooseController(page, action, prefix),
    shot = (label) => page.screenshot({ path: `test-results/september13-${name}-${label}.png` });
  try {
    await page.goto(process.env.URCHIN_TEST_URL);
    await page.waitForFunction(() => window.urchinDebug?.ui);
    for (const viewport of [
      { width: 1152, height: 720 },
      { width: 1024, height: 640 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(120);
      assert(
        await page.locator('.title-choices').evaluate((el) =>
          [...el.children].every((b) => {
            const r = b.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
          }),
        ),
      );
      await shot(`title-${viewport.width}`);
    }
    await page.setViewportSize({ width: 1152, height: 720 });
    await action('confirm');
    await choose('Choose Harbour Workhorse');
    await shot('harbour');
    assert.equal(await page.locator('.wharf-readiness').count(), 0);
    assert(
      await page
        .locator('.wharf-panel')
        .evaluate((el) => el.getBoundingClientRect().width === innerWidth),
    );
    await choose('Sail');
    await choose('Sheltered Kelp');
    await choose('Arrival approach');
    const arrival = await page.evaluate(() => urchinDebug.world.career.preferences.arrivals.near);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'departure');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    await action('back');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
    await choose('Sheltered Kelp');
    assert.equal(
      await page.evaluate(() => urchinDebug.world.career.preferences.arrivals.near),
      arrival,
    );
    await shot('departure');
    await action('back');
    await action('back');
    await choose('Settings');
    await choose('Controls / Remapping');
    assert.equal(await page.locator('.controller-diagrams svg').count(), 1);
    assert.equal(await page.locator('.binding-row select').count(), Object.keys(DEFAULTS).length);
    for (const action of Object.keys(DEFAULTS))
      assert.equal(
        await page.getByLabel(`${LABELS[action]} gamepad binding`, { exact: true }).count(),
        1,
      );
    await shot('controllers');
    // A dropdown conflict must not replace an unrelated binding.
    const old = await page.evaluate(() => structuredClone(urchinDebug.input.map));
    await page.locator('.binding-row select').first().selectOption('b2');
    assert.deepEqual(await page.evaluate(() => urchinDebug.input.map), old);
    assert.match(await page.locator('#playtest').innerText(), /already controls/);
    await action('back');
    await choose('Difficulty / assists');
    await choose('Weather readout');
    const custom = await page.evaluate(() => structuredClone(urchinDebug.world.career.assists));
    await action('back');
    await action('back');
    await choose('Sail');
    await choose('Sheltered Kelp');
    await choose('Begin working day');
    await page.waitForFunction(() => urchinDebug.world.time > 0.1);
    await shot('custom-water');
    assert(await page.locator('#touchMenu').isHidden());
    assert(await page.locator('#electronics').isHidden());
    await action('debug');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.preset), 'realistic');
    assert(await page.evaluate(() => urchinDebug.world.career.assists.exactLoad));
    await action('debug');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.preset), 'off');
    for (const id of [
      'help',
      'divers',
      'hud',
      'clock',
      'navigation',
      'openAlmanac',
      'electronics',
      'groundLegend',
      'message',
    ])
      assert(await page.locator('#' + id).isHidden(), `${id} leaks in All Off`);
    await shot('realistic');
    await action('debug');
    assert.deepEqual(await page.evaluate(() => urchinDebug.world.career.assists), custom);
    await action('instructions');
    for (let i = 0; i < 2; i++) await action('zoomIn');
    assert.equal(await page.evaluate(() => urchinDebug.ui.draft.searchLimit), 10);
    await shot('orders');
    await action('confirm');
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.searchLimit), 10);
    await action('pause');
    await choose('Settings');
    await choose('Difficulty / assists');
    await choose('Easy preset');
    await action('back');
    await action('back');
    await choose('Resume');
    await shot('easy-water');
    await action('pause');
    await choose('Radio history');
    await shot('radio');
    await action('back');
    await choose('Title screen');
    await action('menuDown');
    await action('menuDown');
    await action('menuDown');
    await action('confirm');
    await page.waitForFunction(() => urchinDebug.world.career.sandbox);
    assert.deepEqual(await page.evaluate(() => urchinDebug.world.career.knowledge), {});
    await choose('Test Mode');
    await choose('Current:');
    await choose('Weather:');
    await choose('Weather:');
    await choose('Clock:');
    await shot('test-conditions');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.testConditions.current), 0);
    await choose('Leave Test Mode');
    assert(!(await page.evaluate(() => urchinDebug.world.career.sandbox)));
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.searchLimit), 10);
    // The actual save restores the chosen lane, orders and original career.
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await action('confirm');
    assert.equal(
      await page.evaluate(() => urchinDebug.world.career.preferences.arrivals.near),
      arrival,
    );
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.searchLimit), 10);
    await action('pause');
    await choose('Title screen');
    await action('menuDown');
    await action('confirm');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'archives');
    assert(await page.locator('[data-action=latest]').isVisible());
    await shot('load');
    assert.deepEqual(errors, []);
    console.log(
      `September 13 ${name}: title, harbour, persistence, diagrams, HUD, RB, orders, Test Mode and load pass.`,
    );
  } catch (error) {
    await shot('FAILURE');
    throw error;
  } finally {
    await page.close();
  }
}
