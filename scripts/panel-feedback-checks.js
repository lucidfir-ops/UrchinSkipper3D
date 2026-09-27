import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseStarter } from './career-start.js';
import assert from 'node:assert/strict';
import { chooseController } from './controller-menu.js';
export async function panelFeedbackChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } }),
    errors = [];
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(gamepadScript, {
    name: 'panelPad',
    id: 'Panel Xbox',
    index: 0,
    mapping: 'standard',
  });
  const action = async (name) => {
    return pressAction(page, 'panelPad', name);
  };
  const choose = (p) => chooseController(page, action, p);
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await action('confirm');
    await chooseStarter(page, choose);
    await choose('Harbour office');
    await choose('Fuel, repairs');
    await choose('Borrow up to');
    await action('back');
    await action('back');
    await choose('Chandlery');
    await choose('Auxiliary fuel tank');
    assert.match(await page.locator('.career-detail').innerText(), /Installed tank: 120 L/);
    const top = await page.locator('.career-detail').evaluate((e) => e.scrollTop);
    await page.evaluate(() => (panelPad.axes[3] = 1));
    await page.waitForFunction(
      (top) => document.querySelector('.career-detail').scrollTop > top,
      top,
    );
    await page.evaluate(() => (panelPad.axes[3] = 0));
    await page.screenshot({ path: 'test-results/feedback-equipment-stations.png' });
    await action('back');
    await choose('Meet the crew');
    await choose('Dave Kaimana');
    assert.match(await page.locator('.career-detail').innerText(), /Coastal skipper/);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.crew[0]), 'ada');
    await page.screenshot({ path: 'test-results/feedback-crew-unlocks.png' });
    await choose('Berth 2');
    await choose('Roy Bell');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.crew[1]), 'roy');
    await action('back');
    await choose('Talk to Frank');
    assert.match(await page.locator('#playtest').innerText(), /shaft boat/);
    await page.screenshot({ path: 'test-results/feedback-frank-lesson.png' });
    await action('back');
    await choose('Sail');
    await choose('Sheltered Kelp');
    await choose('Arrival approach');
    assert.equal(await page.evaluate(() => urchinDebug.ui.arrivalLane), 1);
    await choose('Begin working day');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    assert(await page.evaluate(() => Math.abs(urchinDebug.world.boat.x - 210) < 5));
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.day.inspection = { status: 'calling', minute: w.day.minute };
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'patrol');
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    assert.match(await page.locator('#playtest').innerText(), /May we come alongside/);
    await page.screenshot({ path: 'test-results/feedback-dfo-dialogue.png' });
    await action('back');
    assert.equal(await page.evaluate(() => urchinDebug.ui.screen), null);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: compact equipment stations / installed volume / right-stick scrolling, locked crew inspection and berth assignment, Frank lesson, alternate safe entrance and DFO dialogue with controller Back.',
    );
  } catch (e) {
    await page.screenshot({ path: 'test-results/feedback-panels-failure.png' }).catch(() => {});
    throw e;
  } finally {
    await page.close();
  }
}
