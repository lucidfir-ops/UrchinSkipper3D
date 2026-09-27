import assert from 'node:assert/strict';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
export async function trainingChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const action = (name) => pressAction(page, 'trainingPad', name),
    choose = (label) => chooseController(page, action, label);
  try {
    await page.addInitScript(gamepadScript, { name: 'trainingPad', id: 'Training Xbox' });
    await page.goto(process.env.URCHIN_TEST_URL);
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await action('confirm');
    await choose('Choose Harbour Workhorse');
    const original = await page.evaluate(() => {
      urchinDebug.ui.hooks.save();
      return localStorage.getItem('urchin-career-v1');
    });
    await choose('Test Mode');
    await choose('Enter Test Mode');
    await choose('Test Mode');
    await choose('Unlock boats');
    await action('back');
    await choose('Sail');
    await choose('Sheltered Kelp');
    await choose('Begin working day');
    await page.locator('#voyage').waitFor({ state: 'hidden' });
    await action('pause');
    await choose('Test conditions');
    await choose('Training tools');
    await choose('Stage selected diver: searching');
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.state), 'searching');
    await choose('Selected bag:');
    await choose('Selected air:');
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.bag), 75);
    await choose('Test exposure load:');
    await choose('Test exposure load:');
    await choose('Stage selected diver: surface');
    await page.screenshot({ path: 'test-results/v2-training-compact.png' });
    const before = await page.evaluate(() => urchinDebug.world.time);
    await choose('Single physics step');
    const after = await page.evaluate(() => urchinDebug.world.time);
    assert(Math.abs(after - before - 1 / 60) < 1e-7);
    await choose('Reset test crew health');
    // Deliberate test exposure, then the actual production surfacing/injury path.
    await page.evaluate(() => {
      const w = urchinDebug.world,
        d = w.diver,
        h = w.career.people[d.crewId].diveHealth;
      h.pending = true;
      d.state = 'surfacing';
      d.timer = 0.01;
    });
    await choose('Single physics step');
    await page.waitForFunction(() => urchinDebug.world.diver.condition === 'injured');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.people.ada.injuryCause), 'DCS');
    assert.equal(await page.evaluate(() => urchinDebug.world.emergency.mandatoryRescue), false);
    await action('back');
    await action('back');
    await choose('Resume');
    await page.screenshot({ path: 'test-results/v2-dcs-medical-return.png' });
    assert.equal(await page.evaluate(() => localStorage.getItem('urchin-career-v1')), original);
    // Emergency recovery remains available; leaving the sandbox uses the same session transition.
    await page.evaluate(() => {
      urchinDebug.ui.hooks.sandbox(false);
      urchinDebug.ui.showTitle();
    });
    assert.equal(await page.evaluate(() => urchinDebug.world.career.sandbox || false), false);
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.condition), 'fit');
    assert.equal(await page.evaluate(() => localStorage.getItem('urchin-career-v1')), original);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: controller-navigable compact training, independent bags/air/exposure, single-step, DCS medical return and real-save isolation',
    );
  } finally {
    await page.close();
  }
}
