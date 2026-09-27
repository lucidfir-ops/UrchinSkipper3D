import { gamepadScript, pressGamepad, pressAction } from './gamepad-fixture.js';
import { chooseStarter } from './career-start.js';
import assert from 'node:assert/strict';
import { chooseController } from './controller-menu.js';
export async function videoFeedbackChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1152, height: 720 } }),
    errors = [];
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(gamepadScript, {
    name: 'feedbackPad',
    id: 'Video regression Xbox',
    index: 0,
    mapping: 'standard',
  });
  async function button(i) {
    return pressGamepad(page, 'feedbackPad', i);
  }
  const action = async (name) => {
    return pressAction(page, 'feedbackPad', name);
  };
  const choose = (prefix) => chooseController(page, action, prefix);
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await button(0);
    await chooseStarter(page, choose);
    // Reproduce the recording's operating state in an isolated browser save.
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.day = 3;
      w.boat.fuel = 33;
      w.career.weatherPlan = [{ minute: 0, kind: 'calm', bearing: 210 }];
    });
    await choose('Sail');
    await choose('Sheltered Kelp');
    const briefing = await page.locator('#playtest').innerText();
    assert.match(briefing, /33.0 L aboard.*outward 15.0 L.*home 15.0 L/s);
    assert.match(briefing, /no fuel reserve/);
    await page.screenshot({ path: 'test-results/video-fuel-departure.png' });
    await choose('Fuel, repairs & accounts');
    await choose('Refuel');
    await button(1);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.fuel), 480);
    await choose('Begin working day');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.boat.fuel = 0;
      w.boat.vy = -1;
    });
    await action('fullAhead');
    await page.waitForFunction(() =>
      document.querySelector('#hud').textContent.includes('OUT OF FUEL'),
    );
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), 1);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.driveHealth), 1);
    assert.match(await page.locator('#message').innerText(), /HELM RESPONDING/);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.driveHealth), 1);
    await page.screenshot({ path: 'test-results/video-empty-fuel-helm.png' });
    await action('pause');
    assert(
      await page
        .getByRole('button', { name: 'Radio for rescue / end fishing', exact: true })
        .evaluate((b) => b.getBoundingClientRect().bottom < window.innerHeight),
    );
    await choose('Settings');
    await choose('Exit Game');
    await action('back');
    assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'settings');
    // B from Settings intentionally has the stable Harbour destination. Menu
    // retains the visited on-water Pause parent for this rescue scenario.
    await action('pause');
    await choose('Radio for rescue');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'summary');
    assert.equal(
      await page.evaluate(() => urchinDebug.world.day.result.rescue.reason),
      'Out of fuel',
    );
    await choose('Prepare next day');
    await choose('Harbour office');
    await choose('Rest a day');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.day), 5);
    const cash = await page.evaluate(() => urchinDebug.world.career.cash);
    await choose('Harbour office');
    await choose('Work a day on the dock');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.day), 6);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), cash + 420);
    await choose('Weather & tides');
    await choose('Tide & current almanac');
    const minute = await page.evaluate(() => urchinDebug.world.day.minute);
    await page.evaluate(() => (feedbackPad.axes[0] = 0.8));
    await page.waitForFunction(() => urchinDebug.ui.index === 1);
    await page.evaluate(() => (feedbackPad.axes[0] = 0));
    await button(7);
    assert((await page.evaluate(() => urchinDebug.ui.forecastOffset)) >= 30);
    assert.equal(await page.evaluate(() => urchinDebug.world.day.minute), minute);
    assert.match(await page.locator('.offload-stamp').innerText(), /Day 6/);
    assert(!/\+5d/.test(await page.locator('.offload-stamp').innerText()));
    await page.screenshot({ path: 'test-results/video-day-almanac.png' });
    await choose('Back / Close');
    assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'conditions');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: recording fuel budget, refuel and Back, responsive empty-tank helm, visible rescue, Exit cancel, rest/dock functions, spatial analogue forecast, trigger scrub and career-day labels.',
    );
  } catch (error) {
    await page.screenshot({ path: 'test-results/video-feedback-failure.png' }).catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}
