import assert from 'node:assert/strict';
import { gamepadScript, pressGamepad, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

export async function v2Checks(browser) {
  const name = process.env.URCHIN_TEST_BROWSER || 'chromium';
  for (const difficulty of ['easy', 'realistic']) {
    const page = await browser.newPage({
      viewport: difficulty === 'easy' ? { width: 1280, height: 800 } : { width: 1024, height: 640 },
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const action = (name) => pressAction(page, 'v2Pad', name);
    const choose = (label) => chooseController(page, action, label);
    try {
      await page.addInitScript(gamepadScript, { name: 'v2Pad', id: 'V2 Xbox', index: 1 });
      await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
      await page.waitForFunction(() => window.urchinDebug?.ui);
      await pressGamepad(page, 'v2Pad', 0);
      await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
      await choose('Skip day 0');
      await page.waitForFunction(() => urchinDebug.ui.screen === 'starter');
      if (difficulty === 'realistic') await choose('Career difficulty');
      await choose('Choose Island Tender');
      assert.equal(await page.evaluate(() => urchinDebug.world.career.difficulty), difficulty);
      assert.equal(await page.evaluate(() => urchinDebug.world.boat.configuration), 'outboard');
      await choose('Sail');
      await choose('Sheltered Kelp');
      await choose('Begin working day');
      await page.waitForFunction(() => !urchinDebug.ui.blocked);
      await pressGamepad(page, 'v2Pad', 11);
      await page.waitForFunction(() => urchinDebug.ui.screen === 'assists');
      if (difficulty === 'realistic')
        assert.equal(await page.locator('[data-action="easy"]').count(), 0);
      await choose('Realistic preset');
      assert(
        await page.evaluate(() =>
          ['exactLoad', 'clockOverlay', 'helmOverlay', 'chartGrounds', 'diverIndicators'].every(
            (k) => urchinDebug.world.career.assists[k],
          ),
        ),
      );
      await choose('Diver indicators');
      assert(await page.evaluate(() => urchinDebug.world.career.assists.diverPortraits));
      const saved = await page.evaluate(() => structuredClone(urchinDebug.world.career.assists));
      await page.screenshot({ path: `test-results/v2-${name}-${difficulty}-assists.png` });
      await action('back');
      await page.waitForSelector('#divers.portrait-only svg');
      assert.equal(await page.locator('#divers svg').count(), 2);
      assert.equal((await page.locator('#divers').innerText()).trim(), '');
      const selected = await page.evaluate(() => urchinDebug.world.selectedDiverId);
      await action('cycleDiver');
      assert.notEqual(await page.evaluate(() => urchinDebug.world.selectedDiverId), selected);
      assert.equal(await page.locator('#divers [aria-pressed="true"]').count(), 1);
      await page.screenshot({ path: `test-results/v2-${name}-${difficulty}-portraits.png` });
      await action('debug');
      assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.preset), 'off');
      assert(await page.locator('#divers').isHidden());
      await action('debug');
      if (difficulty === 'easy') {
        assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.preset), 'easy');
        await action('debug');
      }
      assert.deepEqual(await page.evaluate(() => urchinDebug.world.career.assists), saved);
      await page.evaluate(() => {
        const w = urchinDebug.world,
          p = w.patches.find((p) => p.remaining > 300),
          c = p.clumps[0];
        Object.assign(w.environment, {
          model: 'uniform',
          current: { x: 0, y: 0 },
          wind: { x: 0, y: 0 },
          waves: 0,
        });
        Object.assign(w.boat, {
          x: c.x + 4,
          y: c.y,
          heading: 0,
          vx: 0,
          vy: 0,
          throttle: 0,
          rudder: 0,
          turn: 0,
        });
      });
      await action('work');
      assert.equal(await page.evaluate(() => urchinDebug.world.diver.state), 'ready');
      await action('recoverDiver');
      await page.evaluate(() => urchinDebug.step(6));
      assert(
        ['searching', 'harvesting'].includes(
          await page.evaluate(() => urchinDebug.world.diver.state),
        ),
      );
      await page.evaluate(() => {
        const w = urchinDebug.world;
        Object.assign(w.boat, { x: w.diver.x + 4, y: w.diver.y, vx: 0, vy: 0 });
      });
      await action('recall');
      assert(await page.evaluate(() => urchinDebug.world.diver.recallAt > urchinDebug.world.time));
      await page.evaluate(() => urchinDebug.step(6));
      assert(
        ['surfacing', 'surface'].includes(await page.evaluate(() => urchinDebug.world.diver.state)),
      );
      await page.reload();
      await page.waitForFunction(() => window.urchinDebug?.ui);
      await pressGamepad(page, 'v2Pad', 0);
      assert.deepEqual(await page.evaluate(() => urchinDebug.world.career.assists), saved);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
  console.log(
    `PASS ${name}: v2 starting difficulties, Island Tender, R3, both RB cycles, portrait-only selection, compact layout and save/reload`,
  );
}
