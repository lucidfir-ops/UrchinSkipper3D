import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

// Rendered environment checks. Repositioning and clock jumps are explicitly
// test-only; the resulting tide refresh, field sampling, UI and exit are real.
export async function environmentChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [],
    report = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto((process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/') + '?prototype=1');
    await page.locator('#keyboardFallback').click();
    for (const [id, name] of [
      ['near', 'Sheltered Kelp'],
      ['middle', 'South Reef'],
      ['far', 'Outer Ledge'],
    ]) {
      await page.evaluate(() => {
        urchinDebug.ui.realistic = false;
        urchinDebug.ui.debug = false;
        urchinDebug.reset({ practice: false });
        urchinDebug.ui.open('chart');
      });
      await page.getByRole('button', { name: new RegExp(name) }).click();
      await page.waitForFunction(() => urchinDebug.ui.screen === 'departure');
      await page.locator('.matrix-cell').first().waitFor({ state: 'visible' });
      assert.equal(await page.locator('.matrix-cell').count(), 16);
      await page.screenshot({ path: `test-results/major-${id}-chart.png` });
      await page.locator('.matrix-cell').filter({ hasText: '80% · 60s' }).click();
      assert.match(await page.locator('.ground-detail').textContent(), /80%.*60s.*1,000 lb/s);
      await page.getByRole('button', { name: 'Begin working day', exact: true }).click();
      await page.waitForFunction(() => urchinDebug.world.time > 0.2 && !urchinDebug.ui.blocked);
      const sector = await page.evaluate(() => urchinDebug.world.terrain.id);
      assert.equal(sector, id);
      await page.keyboard.down('-');
      await page.waitForFunction(() => urchinDebug.zoom <= 0.41);
      await page.keyboard.up('-');
      await page.keyboard.press('F3');
      await page.waitForFunction(() => urchinDebug.ui.debug);
      await page.screenshot({ path: `test-results/major-${id}-current.png` });
      const high = await page.evaluate(() => {
        const w = urchinDebug.world,
          c = urchinDebug.currentAt(w.boat.x, w.boat.y);
        return {
          tide: w.environment.seaLevel,
          wet: w.terrain.depths.filter((d) => d + w.environment.seaLevel > 0).length,
          depth: urchinDebug.depthAt(w.boat.x, w.boat.y),
          current: c,
          texture: urchinDebug.terrainView.texture.canvas.toDataURL(),
        };
      });
      await page.evaluate(() => {
        urchinDebug.world.day.minute = 1050;
      });
      await page.waitForFunction(
        () =>
          urchinDebug.world.environment.minute > 1050 &&
          urchinDebug.terrainView.tideKey ===
            Math.round(urchinDebug.world.environment.seaLevel * 20),
      );
      const low = await page.evaluate(() => {
        const w = urchinDebug.world;
        return {
          tide: w.environment.seaLevel,
          wet: w.terrain.depths.filter((d) => d + w.environment.seaLevel > 0).length,
          current: urchinDebug.currentAt(w.boat.x, w.boat.y),
          texture: urchinDebug.terrainView.texture.canvas.toDataURL(),
        };
      });
      assert(high.tide - low.tide > 2);
      assert(high.wet > low.wet + 100);
      assert.notEqual(high.texture, low.texture);
      assert(
        high.current.x * low.current.x + high.current.y * low.current.y < 0,
        'local flow reverses by the afternoon',
      );
      await page.screenshot({ path: `test-results/major-${id}-low-tide.png` });
      await page.keyboard.press('F3');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Information: EASY', exact: true }).click();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await page.waitForFunction(() => !urchinDebug.ui.blocked);
      assert(
        await page.evaluate(() => urchinDebug.terrainView.labels.every((label) => !label.visible)),
      );
      assert(!/%/.test(await page.locator('#groundLegend').textContent()));
      await page.screenshot({ path: `test-results/major-${id}-realistic.png` });
      await page.keyboard.press('m');
      await page.getByRole('button', { name: new RegExp(name) }).click();
      assert(!/%|\d+s\b|lb remaining/.test(await page.locator('.ground-detail').textContent()));
      await page.getByRole('button', { name: 'Resume fishing', exact: true }).click();
      report.push({
        sector: id,
        tideChange: high.tide - low.tide,
        exposedCells: high.wet - low.wet,
        highCurrent: high.current,
        lowCurrent: low.current,
      });
    }
    // A full visible landing receipt, plus a compact-screen layout check.
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.day.minute = 1050;
      w.catch = 1200;
      w.bags = [
        { weight: 600, quality: 0.9, harvestMinute: 840 },
        { weight: 600, quality: 0.8, harvestMinute: 900 },
      ];
      Object.assign(w.boat, {
        x: 300,
        y: w.terrain.size - 0.005,
        heading: Math.PI,
        vx: 0,
        vy: 1,
        turn: 0,
        throttle: 1,
        rudder: 0,
      });
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'summary');
    assert.match(await page.locator('.result-status').textContent(), /DELAYED SHIPPING/);
    assert.match(
      await page.locator('.landing-receipt').textContent(),
      /Recovered gross catch.*1,200 lb.*Estimated water loss.*Payable/s,
    );
    const result = await page.evaluate(() => urchinDebug.world.day.result);
    assert(
      result.value > 0 &&
        result.landed < 1200 &&
        result.delayHours >= 12 &&
        result.delayHours <= 24,
    );
    await page.screenshot({ path: 'test-results/major-harbour-results.png' });
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.screenshot({ path: 'test-results/major-results-1024.png' });
    const layout = await page.evaluate(() => {
      const panel = document.querySelector('#playtest').getBoundingClientRect(),
        receipt = document.querySelector('.landing-receipt').getBoundingClientRect();
      return {
        bottom: receipt.bottom,
        limit: panel.bottom,
        right: receipt.right,
        edge: panel.right,
      };
    });
    assert(
      layout.bottom < layout.limit && layout.right < layout.edge,
      'landing receipt fits the smaller viewport',
    );
    await page.getByRole('button', { name: 'Start a new day', exact: true }).click();
    await page.getByRole('button', { name: /South Reef/ }).click();
    await page.screenshot({ path: 'test-results/major-departure-1024.png' });
    assert(await page.getByRole('button', { name: 'Begin working day', exact: true }).isVisible());
    await page.getByRole('button', { name: 'Begin working day', exact: true }).click();
    await page.waitForFunction(() => !urchinDebug.ui.blocked && urchinDebug.world.time > 0.2);
    await page.keyboard.press('F3');
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: 'Ground laboratory / practice drop', exact: true })
      .click();
    await page.locator('.matrix-cell').filter({ hasText: '90% · 20s' }).click();
    const tideBeforePractice = await page.evaluate(() => urchinDebug.world.environment.seaLevel);
    await page
      .getByRole('button', { name: 'Practice drop on selected ground', exact: true })
      .click();
    await page.waitForFunction(
      () => urchinDebug.world.day.phase === 'practice' && !urchinDebug.ui.blocked,
    );
    const practice = await page.evaluate(() => {
      const w = urchinDebug.world,
        p = w.patches.find((p) => p.id === 'q90-fast');
      return {
        assisted: w.day.assisted,
        stock: p.remaining,
        distance: Math.hypot(w.boat.x - p.drop.x, w.boat.y - p.drop.y),
        tide: w.environment.seaLevel,
      };
    });
    assert(practice.assisted && practice.distance < 2);
    assert.equal(practice.stock, 1000);
    assert(Math.abs(practice.tide - tideBeforePractice) < 0.03);
    // A requested test move is still forbidden while a diver is down.
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: 'Ground laboratory / practice drop', exact: true })
      .click();
    await page.evaluate(() => (urchinDebug.world.divers[0].state = 'searching'));
    await page
      .getByRole('button', { name: 'Practice drop on selected ground', exact: true })
      .click();
    assert.match(await page.locator('.day-footer').textContent(), /BRING BOTH DIVERS ABOARD/);
    assert.deepEqual(errors, []);
    writeFileSync(
      'test-results/environment-browser-report.json',
      JSON.stringify({ errors, report, result, layout }, null, 2),
    );
    console.log(
      'PASS: three distinct sectors, clickable 16-cell matrix, local flood/ebb, tide shoreline refresh, Realistic patch cues without numbers, physical exit, payable receipt, compact layout, and crew-safe practice drops without tide jumps.',
    );
  } catch (error) {
    await page.screenshot({ path: 'test-results/environment-failure.png' }).catch(() => {});
    writeFileSync(
      'test-results/environment-failure.json',
      JSON.stringify({ error: error.message, errors, report }, null, 2),
    );
    throw error;
  } finally {
    await page.close();
  }
}
