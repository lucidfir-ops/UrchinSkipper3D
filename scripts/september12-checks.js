import { gamepadScript, pressAction } from './gamepad-fixture.js';
import assert from 'node:assert/strict';
import { chooseController } from './controller-menu.js';

export async function september12Checks(browser, name = 'chromium') {
  const page = await browser.newPage({ viewport: { width: 1152, height: 720 } }),
    errors = [];
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('crash', () => errors.push('Page crashed'));
  await page.addInitScript(gamepadScript, {
    name: 'reviewPad',
    id: 'September 12 Xbox',
    index: 0,
    mapping: 'standard',
  });
  const action = async (action) => {
    return pressAction(page, 'reviewPad', action);
  };
  const choose = (prefix) => chooseController(page, action, prefix),
    shot = (label) => page.screenshot({ path: `test-results/september12-${name}-${label}.png` });
  try {
    const response = await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    assert.equal(response.headers()['x-urchin-build'], 'production');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await action('confirm');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
    await choose('Skip day 0');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'starter');
    assert.equal(await page.locator('[data-action^="starter-"]').count(), 2);
    assert.match(await page.locator('.career-detail').innerText(), /\$20,000.*\$5,000/s);
    await shot('starter');
    await action('back');
    assert(!(await page.evaluate(() => urchinDebug.ui.started)));
    await action('confirm');
    await choose('Choose Harbour Workhorse');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), 2000);
    await choose('Your boats');
    assert.match(await page.locator('.career-detail').innerText(), /7,500 lb.*15 L\/h/s);
    await shot('workhorse');
    await action('back');
    await choose('Talk to Frank');
    assert.match(
      await page.locator('.frank-lesson').innerText(),
      /Harbour Workhorse.*shaft boat.*two knots.*empty bag/s,
    );
    await shot('frank');
    await action('back');
    await choose('Meet the crew');
    assert.match(await page.locator('.crew-progress').innerText(), /Level 1 \/ 5/);
    assert.match(await page.locator('.crew-level').innerText(), /Level 1 \/ 5/);
    for (const viewport of [
      { width: 1152, height: 720 },
      { width: 1024, height: 640 },
    ]) {
      await page.setViewportSize(viewport);
      assert(
        await page.locator('.crew-level').evaluate((el) => {
          const rect = el.getBoundingClientRect(),
            panel = el.closest('.career-detail').getBoundingClientRect();
          return rect.top >= panel.top && rect.bottom <= panel.bottom && rect.right <= panel.right;
        }),
        'Crew level must be readable without scrolling',
      );
      await shot(`crew-${viewport.width}`);
    }
    await page.setViewportSize({ width: 1152, height: 720 });
    await action('back');
    await choose('Harbour office');
    await choose('Skipper logbook');
    await page.locator('.catch-sheet').waitFor({ state: 'visible' });
    assert(await page.locator('.catch-sheet').evaluate((el) => el.complete && el.naturalWidth > 0));
    await shot('yellow-log');
    const downloaded = page.waitForEvent('download');
    await choose('Export yellow catch sheet');
    const file = await downloaded;
    assert(file.suggestedFilename().endsWith('.svg'));
    await file.saveAs(`test-results/september12-${name}-catch-sheet.svg`);
    await action('back');
    await action('back');
    await choose('Weather & tides');
    await choose('Early start');
    assert.match(await page.locator('#playtest').innerText(), /6%.*fatigue/);
    await choose('Tide & current almanac');
    assert.deepEqual(await page.locator('.trigger-badge').allTextContents(), ['LT', 'RT']);
    const clock = await page.evaluate(() => urchinDebug.world.day.minute);
    await action('zoomIn');
    assert((await page.evaluate(() => urchinDebug.ui.forecastOffset)) > 0);
    assert.equal(await page.evaluate(() => urchinDebug.world.day.minute), clock);
    await shot('almanac');
    await action('back');
    await action('back');
    await choose('Settings');
    await choose('Controller setup');
    await choose('Use standard gamepad layout');
    assert(
      await page.evaluate(
        () =>
          urchinDebug.input.map.work.includes('b2') &&
          urchinDebug.input.map.recoverDiver.includes('b3'),
      ),
    );
    await action('back');
    await action('back');
    await choose('Sail');
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 1152, height: 720 },
      { width: 1024, height: 640 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(200);
      const size = await page
        .locator('.area-preview canvas')
        .evaluate((e) => e.getBoundingClientRect().width);
      assert(Math.abs(size - (viewport.height < 700 ? 99 : 126)) <= 2);
      const geometry = await page.evaluate(() => {
        const canvas = document.querySelector('.area-preview canvas'),
          rect = canvas.getBoundingClientRect(),
          panel = document.querySelector('.day-panel').getBoundingClientRect(),
          stamp = document.querySelector('.offload-stamp').getBoundingClientRect(),
          neighbours = [...document.querySelector('.day-heading').children].slice(0, -1),
          before = neighbours.map((e) => e.getBoundingClientRect().toJSON());
        // Restoring the original preview size must not move any other header item.
        canvas.style.width = canvas.style.height = innerHeight < 700 ? '66px' : '84px';
        const after = neighbours.map((e) => e.getBoundingClientRect().toJSON());
        canvas.style.width = canvas.style.height = '';
        return {
          clockGap: rect.left - stamp.right,
          panelOverflow: rect.right - panel.right,
          before,
          after,
        };
      });
      assert(geometry.clockGap >= 0, `Preview covers clock: ${JSON.stringify(geometry)}`);
      assert(geometry.panelOverflow <= 1, `Preview outside panel: ${JSON.stringify(geometry)}`);
      assert.deepEqual(geometry.before, geometry.after);
      await shot(`chart-${viewport.width}`);
    }
    await choose('Sheltered Kelp');
    assert.match(await page.locator('[data-action="arrival"]').innerText(), /South entrance/);
    await choose('Arrival approach');
    assert.match(await page.locator('[data-action="arrival"]').innerText(), /Southwest/);
    await shot('departure');
    await choose('Begin working day');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    await action('debug');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.preset), 'realistic');
    await action('debug');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.preset), 'off');
    await action('debug');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.preset), 'easy');
    assert.match(await page.locator('#help').innerText(), /RB Information/);
    // Explicit state fixture reproduces a previously exhausted, boarded diver.
    // Actual mapped X/Y and the production simulation perform the new dive/recovery.
    await action('pause');
    await page.evaluate(() => {
      const w = urchinDebug.world,
        p =
          w.patches.find((p) => p.id === 'shelf-south') || w.patches.find((p) => p.remaining > 500);
      w.logs = [];
      w.debris = [];
      w.career.weatherPlan = [{ minute: 0, kind: 'calm', bearing: 210 }];
      Object.assign(w.environment, {
        model: 'uniform',
        current: { x: 0, y: 0 },
        wind: { x: 0, y: 0 },
        waves: 0,
      });
      const c = p.clumps[0];
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
      Object.assign(w.diver, {
        state: 'ready',
        localSearch: { x: 1, y: 1, elapsed: 10 },
        reason: 'Patch exhausted',
      });
      w.catch = 41;
      w.bags = [{ weight: 41, quality: 0.8, harvestMinute: w.day.minute }];
    });
    await choose('Resume');
    await action('recoverDiver');
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'deploying');
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.bag), 0);
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'harvesting');
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.localSearch), null);
    await page.evaluate(() => urchinDebug.step(55));
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'surface');
    assert(await page.evaluate(() => urchinDebug.world.diver.bag > 100));
    await action('pause');
    await page.evaluate(() => {
      const w = urchinDebug.world;
      Object.assign(w.boat, { x: w.diver.x + 4, y: w.diver.y, heading: 0, vx: 0, vy: 0, turn: 0 });
    });
    await choose('Resume');
    await page.waitForFunction(() =>
      document.querySelector('#help').textContent.includes('Recover Diver'),
    );
    assert.match(
      await page.locator('#help').innerText(),
      /X — Take \+ give bag.*Y — Recover Diver/s,
    );
    assert.match(await page.locator('#message').innerText(), /lb in bag/);
    await shot('recovery');
    await action('recoverDiver');
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'ready');
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.bag), 0);
    assert(await page.evaluate(() => urchinDebug.world.catch > 141));
    await action('chart');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'knowledge');
    assert.equal(await page.evaluate(() => urchinDebug.ui.chartGroundId), 'near');
    assert.match(await page.locator('.knowledge-reports').innerText(), /sampled quality/);
    await shot('known-ground');
    assert.deepEqual(errors, []);
    console.log(
      `PASS September 12 (${name}): funded starter, boat balance, Frank, crew levels, yellow SVG export, early fatigue, LT/RT, compact charts, compass arrival, RB information, physical X/Y software routing, repeat dive and recorded catch.`,
    );
  } catch (error) {
    await shot('failure').catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}
