import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { summarizeFrames } from '../src/frame-metrics.js';

// Software-rendered CI is a regression guard, not certification of physical Deck FPS.
// The hardware profile targets sustained 60 Hz; both profiles fail on regressions.
export const FRAME_BUDGETS = {
  software: { frameMean: 40, frameP95: 65, cpuP95: 25 },
  hardware: { frameMean: 17.5, frameP95: 22, cpuP95: 14 },
};
export function checkFrameBudget(summary, budget) {
  assert(summary.frames >= 120, 'At least 120 measured frames required');
  assert(
    summary.frameMs.mean <= budget.frameMean,
    `Mean frame ${summary.frameMs.mean.toFixed(1)} > ${budget.frameMean} ms`,
  );
  assert(
    summary.frameMs.p95 <= budget.frameP95,
    `p95 frame ${summary.frameMs.p95.toFixed(1)} > ${budget.frameP95} ms`,
  );
  assert(
    summary.totalCpuMs.p95 <= budget.cpuP95,
    `p95 CPU ${summary.totalCpuMs.p95.toFixed(1)} > ${budget.cpuP95} ms`,
  );
}
export async function performanceChecks(browser) {
  const name = process.env.URCHIN_TEST_BROWSER || 'chromium',
    results = [];
  for (const renderer of ['auto', 'webgl']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(
        `${process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/'}?practice=1&renderer=${renderer}`,
      );
      await page.locator('#keyboardFallback').click();
      await page.waitForFunction(() => urchinDebug.world.time > 1);
      await page.evaluate(() => urchinDebug.resetRenderSamples());
      await page.waitForFunction(() => urchinDebug.renderSamples.length >= 180, null, {
        timeout: 60000,
      });
      const samples = await page.evaluate(() => urchinDebug.renderSamples.slice(-180));
      assert(
        samples.every((s) => Number.isFinite(s.totalCpuMs) && Number.isFinite(s.rendererMs)),
        'The loaded build must expose complete frame metrics',
      );
      results.push({
        renderer: await page.evaluate(() => urchinDebug.renderer),
        summary: summarizeFrames(samples),
      });
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `test-results/performance-${name}-${renderer}.png` });
    } finally {
      await page.close();
    }
  }
  const trafficPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const trafficErrors = [];
  trafficPage.on('pageerror', (e) => trafficErrors.push(e.message));
  try {
    await trafficPage.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await trafficPage.waitForFunction(() => window.urchinDebug?.ui);
    await trafficPage.evaluate(() => {
      const ui = urchinDebug.ui;
      ui.hooks.sandbox(true);
      ui.started = true;
      ui.fallback = true;
      ui.open('harbour');
    });
    await trafficPage.evaluate(() => {
      // Functional suites exercise physical UI navigation. Here setup uses the
      // same production actions without depending on decorative chart-card text.
      const ui = urchinDebug.ui;
      for (const label of ['Sail', 'Sheltered Kelp', 'Begin working day']) {
        const w = urchinDebug.world;
        ui.index = ui.choices(w).findIndex((choice) => choice.startsWith(label));
        if (ui.index < 0) throw Error('Missing performance setup action: ' + label);
        ui.activate(w);
      }
    });
    await trafficPage.locator('#voyage').waitFor({ state: 'hidden' });
    await trafficPage.keyboard.down('Minus');
    await trafficPage.waitForFunction(() => urchinDebug.zoom < 0.42);
    await trafficPage.keyboard.up('Minus');
    const count = await trafficPage.evaluate(() => {
      const w = urchinDebug.world;
      w.day.minute = 850;
      w.career.trafficSettings = { rate: 0 };
      w.career.testConditions.freezeClock = true;
      w.career.testConditions.weather = 'calm';
      const p = w.patches.find((p) => p.remaining > 0 && p.quality >= 0.6);
      Object.assign(w.boat, { x: p.x + 40, y: p.y + 40, throttle: 0, vx: 0, vy: 0 });
      for (const kind of ['taxi', 'taxi', 'tourist', 'tourist', 'tourist', 'dfo', 'rival']) {
        for (let i = 0; i < 20; i++) if (urchinDebug.spawnTraffic(kind)) break;
      }
      // A deliberate maximum-density render fixture, still using real depth/collision data.
      const positions = [];
      for (let x = p.x - 60; x <= p.x + 60; x += 20)
        for (let y = p.y - 40; y <= p.y + 40; y += 20)
          if (
            [-5, 0, 5].every((dx) =>
              [-5, 0, 5].every((dy) => urchinDebug.simulation.depthAt(w, x + dx, y + dy) > 3),
            )
          )
            positions.push({ x, y });
      if (positions.length < 8)
        throw Error('Traffic performance fixture requires eight clear water positions');
      Object.assign(w.boat, positions[0]);
      w.traffic.actors.forEach((a, i) => {
        Object.assign(a, positions[i + 1]);
        // Measure moving traffic continuously; invitation dialogue has its own UI checks.
        if (a.kind === 'dfo') Object.assign(a, { forPlayer: false, checked: ['player'] });
        a.route = [{ x: a.x, y: a.y - 100 }];
        a.waypoint = 0;
      });
      return w.traffic.actors.length;
    });
    assert.equal(count, 7, 'Measure the configured maximum traffic population');
    await trafficPage.waitForTimeout(1500);
    await trafficPage.evaluate(() => urchinDebug.resetRenderSamples());
    await trafficPage.waitForFunction(() => urchinDebug.renderSamples.length >= 180, null, {
      timeout: 60000,
    });
    const samples = await trafficPage.evaluate(() => urchinDebug.renderSamples.slice(-180));
    results.push({
      scene: 'career-seven-vessels',
      renderer: await trafficPage.evaluate(() => urchinDebug.renderer),
      summary: summarizeFrames(samples),
    });
    assert.equal(await trafficPage.evaluate(() => urchinDebug.world.traffic.actors.length), 7);
    assert.deepEqual(trafficErrors, []);
    await trafficPage.screenshot({ path: `test-results/performance-${name}-traffic.png` });
  } finally {
    await trafficPage.close();
  }
  writeFileSync(`test-results/performance-${name}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
  const profile = process.env.URCHIN_PERFORMANCE_PROFILE || 'software';
  assert(FRAME_BUDGETS[profile], 'Unknown performance profile');
  checkFrameBudget(results[0].summary, FRAME_BUDGETS[profile]);
  checkFrameBudget(results[2].summary, FRAME_BUDGETS[profile]);
}
