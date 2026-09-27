import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
import { chooseStarter } from './career-start.js';
import { PHYSICAL_AREAS } from '../src/coasts.js';
import { summarizeFrames } from '../src/frame-metrics.js';

export async function coastalProgressionChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true }),
    errors = [],
    records = [];
  const pad = (name) => pressAction(page, 'coastPad', name),
    choose = (label) => chooseController(page, pad, label);
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(20000);
  try {
    await page.addInitScript(gamepadScript, { name: 'coastPad', id: 'Coastal acceptance Xbox' });
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.locator('#keyboardFallback').click();
    await chooseStarter(page, choose);
    await choose('Sail');
    await page.locator('[data-ground="frontier-bank"]').waitFor();
    assert.equal(await page.locator('[data-ground]').count(), 9);
    const text = await page.locator('.chart-choices').innerText();
    for (const area of PHYSICAL_AREAS) assert(text.includes(area.name), area.name);
    assert.match(text, /Area not open.*12,000/s);
    assert.match(text, /Area not open.*30,000/s);
    await page.screenshot({ path: 'test-results/coasts-overview-deck.png' });
    await choose('Stormbreak Channel');
    await page.locator('[data-action="sail"]').waitFor();
    await page.locator('[data-action="sail"]').click();
    assert.equal(await page.evaluate(() => urchinDebug.world.day.phase), 'planning');
    await page.evaluate(() => {
      urchinDebug.world.career.cash = 60000;
      urchinDebug.ui.open('accounts');
    });
    await page.locator('[data-action="area-storm"]').click();
    await page.locator('[data-action="cancel-purchase"]').click();
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), 60000);
    await page.locator('[data-action="area-storm"]').click();
    await page.locator('[data-action="confirm-purchase"]').click();
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), 48000);
    await page.locator('[data-action="area-storm"]').click();
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), 48000);
    await page.locator('[data-action="area-frontier"]').click();
    await page.locator('[data-action="confirm-purchase"]').click();
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), 18000);
    await page.evaluate(() => {
      urchinDebug.world.career.day = 5;
      urchinDebug.ui.open('chart');
    });
    for (const area of PHYSICAL_AREAS.filter((a) => a.tier)) {
      await page.evaluate(() => {
        urchinDebug.ui.open('chart');
      });
      await page.locator('.chart-choices [data-choice-index="8"]').waitFor();
      await choose(area.name);
      await page.locator('#playtest h2').filter({ hasText: area.name }).waitFor();
      await page.locator('[data-chart-mode="vector"]').click();
      await page.locator('.sector-picture > svg').waitFor();
      const chartBounds = await page.evaluate(() => {
        const box = (selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        };
        return {
          caption: box('.sector-picture .map-caption'),
          footer: box('.day-footer'),
          surface: box('.sector-picture > svg'),
        };
      });
      assert(
        chartBounds.caption.bottom <= chartBounds.footer.top,
        `${area.name}: chart caption overlaps footer ${JSON.stringify(chartBounds)}`,
      );
      assert.equal(
        (await page.locator('.sector-picture [data-chart-terrain] path').count()) > 50,
        true,
      );
      await page.screenshot({ path: `test-results/coasts-chart-${area.id}.png` });
      await page.locator('[data-action="sail"]').click();
      if (await page.evaluate(() => urchinDebug.ui.screen === 'purchase'))
        await page.locator('[data-action="confirm-purchase"]').click();
      await page.waitForFunction(
        (id) => urchinDebug.world.day.groundId === id && urchinDebug.world.terrain.id === id,
        area.id,
      );
      await page.locator('#voyage').waitFor({ state: 'hidden' });
      await page.keyboard.down('-');
      await page.waitForTimeout(750);
      await page.keyboard.up('-');
      await page.waitForTimeout(300);
      if (area.id === 'frontier-bank') {
        await page.evaluate(() => {
          urchinDebug.world.career.debugConditions = { weather: 'storm', tideHeight: null };
          urchinDebug.resetRenderSamples();
        });
        await page.waitForFunction(() => urchinDebug.renderSamples.length >= 140, null, {
          timeout: 60000,
        });
        const samples = await page.evaluate(() => urchinDebug.renderSamples.slice(-120));
        const summary = summarizeFrames(samples);
        assert(samples.every((sample) => Number.isFinite(sample.totalCpuMs)));
        assert(
          summary.totalCpuMs.p95 < 50,
          `Vector HUD CPU regression: ${JSON.stringify(summary)}`,
        );
        const sounder = await page.evaluate(() => ({
          shown: Number.parseFloat(document.querySelector('#sounderPanel output').textContent),
          actual: urchinDebug.depthAt(urchinDebug.world.boat.x, urchinDebug.world.boat.y),
        }));
        assert(
          Math.abs(sounder.shown - sounder.actual) < 0.15,
          `Vector mode sounder must stay live: ${JSON.stringify(sounder)}`,
        );
        records.push({ scene: 'Frontier storm', ...summary });
      }
      records.push(
        await page.evaluate(() => ({
          id: urchinDebug.world.terrain.id,
          rocks: urchinDebug.world.rocks.length,
          patches: urchinDebug.world.patches.length,
          depth: urchinDebug.depthAt(urchinDebug.world.boat.x, urchinDebug.world.boat.y),
        })),
      );
      await page.screenshot({ path: `test-results/coasts-water-${area.id}.png` });
      await page.evaluate(() => {
        urchinDebug.ui.hooks.save();
      });
      await page.reload();
      await page.locator('#keyboardFallback').click();
      await page.waitForFunction(
        (id) => urchinDebug.world.day.groundId === id && urchinDebug.world.terrain.id === id,
        area.id,
      );
    }
    // Physical controller behavior remains a separate manual test. Exercise the
    // production list with browser-standard press/release events and touch taps.
    await page.evaluate(() => {
      urchinDebug.ui.open('chart');
    });
    await page.setViewportSize({ width: 360, height: 780 });
    await page.evaluate(() => {
      urchinDebug.ui.touch.setEnabled(true);
    });
    await page.locator('[data-ground="frontier-bank"]').waitFor();
    await page.evaluate(() => {
      urchinDebug.ui.panel.scrollTop = 0;
    });
    await page.screenshot({ path: 'test-results/coasts-overview-phone.png' });
    await page.locator('.chart-choices [data-choice-index="8"]').tap();
    await page.locator('#playtest h2').filter({ hasText: 'Last Light Bank' }).waitFor();
    await page.evaluate(() => {
      urchinDebug.ui.panel.scrollTop = 0;
    });
    await page.screenshot({ path: 'test-results/coasts-departure-phone.png' });
    await page.setViewportSize({ width: 780, height: 360 });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      urchinDebug.ui.panel.scrollTop = 0;
    });
    await page.screenshot({ path: 'test-results/coasts-departure-landscape.png' });
    assert.deepEqual(errors, []);
    writeFileSync(
      'test-results/coastal-progression-browser.json',
      JSON.stringify(records, null, 2),
    );
    console.log(
      'PASS: nine physical destinations, blocked access, coast purchase/cancel/repeat, six live maps/reloads, vector charts and phone orientation.',
    );
  } finally {
    await page.close();
  }
}
