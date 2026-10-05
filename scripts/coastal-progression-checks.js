import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
import { chooseStarter } from './career-start.js';
import { COASTS, PHYSICAL_AREAS } from '../src/coasts.js';
import { summarizeFrames } from '../src/frame-metrics.js';

export async function coastalProgressionChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true }),
    errors = [],
    records = [],
    performanceFailures = [],
    startedAt = new Date().toISOString();
  let passed = false,
    failure = null;
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
    assert.equal(await page.locator('[data-ground]').count(), PHYSICAL_AREAS.length);
    const text = await page.locator('.chart-choices').innerText();
    for (const area of PHYSICAL_AREAS) assert(text.includes(area.name), area.name);
    for (const coast of COASTS.filter((coast) => coast.accessCost))
      assert(text.includes(coast.accessCost.toLocaleString()), `${coast.name}: permit price`);
    await page.screenshot({ path: 'test-results/coasts-overview-deck.png' });
    await choose('Stormbreak Channel');
    await page.locator('[data-action="sail"]').waitFor();
    await page.locator('[data-action="sail"]').click();
    assert.equal(await page.evaluate(() => urchinDebug.world.day.phase), 'planning');
    // Funds and the open season day are staged to exercise every physical map;
    // permit payment/cancellation/repeat protection use the actual menus.
    let expectedCash = COASTS.reduce((sum, coast) => sum + coast.accessCost, 18000);
    await page.evaluate((cash) => {
      urchinDebug.world.career.cash = cash;
      urchinDebug.ui.open('accounts');
    }, expectedCash);
    for (const coast of COASTS.filter((coast) => coast.accessCost)) {
      const permit = page.locator(`[data-action="area-${coast.id}"]`);
      await permit.click();
      await page.locator('[data-action="cancel-purchase"]').click();
      assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), expectedCash);
      await permit.click();
      await page.locator('[data-action="confirm-purchase"]').click();
      await page.waitForFunction(() => urchinDebug.ui.screen === 'coast-access');
      assert.match(await page.locator('.coast-access-notice').innerText(), /PERMANENT PERMIT/);
      expectedCash -= coast.accessCost;
      assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), expectedCash);
      await page.locator('.screen-back').click();
      await page.waitForFunction(() => urchinDebug.ui.screen === 'accounts');
      await permit.click();
      assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), expectedCash);
      assert.equal(
        await page.evaluate(
          (id) => urchinDebug.world.career.coastAccess.filter((coast) => coast === id).length,
          coast.id,
        ),
        1,
      );
      records.push({ scene: 'Permanent permit', coast: coast.id, cash: expectedCash });
    }
    await page.evaluate(
      (day) => {
        urchinDebug.world.career.day = day;
        urchinDebug.ui.open('chart');
      },
      Math.max(...PHYSICAL_AREAS.map((area) => area.openDay)),
    );
    for (const area of PHYSICAL_AREAS.filter((a) => a.tier)) {
      await page.evaluate(() => {
        urchinDebug.ui.open('chart');
      });
      await page.locator('.chart-choices [data-choice-index="8"]').waitFor();
      await choose(area.name);
      await page.locator('#playtest h2').filter({ hasText: area.name }).waitFor();
      await page.locator('[data-chart-mode="vector"]').click();
      await page.locator('.chart-map-frame > svg').waitFor();
      const chartBounds = await page.evaluate(() => {
        const box = (selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        };
        return {
          caption: box('.sector-picture .map-caption'),
          footer: box('.day-footer'),
          surface: box('.chart-map-frame > svg'),
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
        if (summary.totalCpuMs.p95 >= 50)
          performanceFailures.push({ scene: 'Frontier storm', limitP95Ms: 50, ...summary });
        // The staged storm can drift the boat across the harbour-facing edge,
        // which correctly pauses for "Return to harbour?". Decline it first.
        if (await page.evaluate(() => urchinDebug.ui.screen === 'harbour-return')) {
          await page.locator('#playtest [data-choice-index="0"]').click();
          await page.waitForFunction(() => !urchinDebug.ui.screen);
        }
        await page
          .locator('#depthInstrumentPanel')
          .waitFor({ state: 'visible' })
          .catch(async (error) => {
            const state = await page.evaluate(() => ({
              screen: urchinDebug.ui.screen,
              started: urchinDebug.ui.started,
              ended: urchinDebug.ui.ended,
              phase: urchinDebug.world.day.phase,
              depthAssist: urchinDebug.world.career.assists?.depthInstrument,
              preset: urchinDebug.world.career.assists?.preset,
              difficulty: urchinDebug.world.career.difficulty,
            }));
            throw new Error('Depth gauge hidden: ' + JSON.stringify(state), { cause: error });
          });
        const sounder = await page.evaluate(() => {
          const w = urchinDebug.world,
            { x, y } = w.boat;
          let actual = urchinDebug.depthAt(x, y);
          for (const rock of w.rocks) {
            const dx = x - rock.x,
              dy = y - rock.y,
              side = dx * Math.cos(rock.heading) + dy * Math.sin(rock.heading),
              fore = dx * Math.sin(rock.heading) - dy * Math.cos(rock.heading);
            if (Math.hypot(side, Math.max(0, Math.abs(fore) - rock.length / 2)) <= rock.radius)
              actual = Math.min(actual, rock.topDepth + w.environment.seaLevel);
          }
          return {
            shown: Number.parseFloat(
              document.querySelector('#depthInstrumentPanel output').textContent,
            ),
            actual: Math.max(0, actual),
          };
        });
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
      assert.deepEqual(
        await page.evaluate(() => urchinDebug.world.career.coastAccess),
        COASTS.map((coast) => coast.id),
        'All paid permanent permits survive every sector reload',
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
    assert.deepEqual(
      performanceFailures,
      [],
      'Frontier storm must retain total CPU p95 below 50ms',
    );
    passed = true;
    console.log(
      `PASS: ${PHYSICAL_AREAS.length} physical destinations, blocked access, four permanent permit purchase/cancel/repeat flows, twelve later-coast maps/reloads, vector charts and phone orientation. Funds and open season day were staged.`,
    );
  } catch (error) {
    failure = error.stack || error.message;
    throw error;
  } finally {
    writeFileSync(
      'test-results/coastal-progression-browser.json',
      JSON.stringify(
        {
          passed,
          failure,
          startedAt,
          completedAt: new Date().toISOString(),
          fixture: 'Staged funds and open season day; real permit menus, travel and save/reload.',
          performanceFailures,
          records,
          errors,
        },
        null,
        2,
      ) + '\n',
    );
    await page.close();
  }
}
