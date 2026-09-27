import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

export async function frankNavigationChecks(browser) {
  const engine = browser.browserType().name(),
    errors = [],
    records = [],
    context = await browser.newContext({ viewport: { width: 780, height: 360 }, hasTouch: true }),
    page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => errors.push(error.message));
  mkdirSync('test-results', { recursive: true });
  const screen = (name) => page.waitForFunction((name) => urchinDebug.ui.screen === name, name),
    tap = (selector) => page.locator(selector).tap(),
    shot = (name) =>
      page.screenshot({ path: `test-results/frank-navigation-${engine}-${name}.png` });
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await tap('[data-touch-options]');
    await tap('[data-action="touchscreen"]');
    await tap('.screen-back');
    await tap('#keyboardFallback');
    await screen('intro');
    await tap('#playtest [data-choice-index="0"]');
    await screen(null);
    await page.waitForFunction(() => urchinDebug.visuals.lessonCues.every((cue) => cue.visible));
    for (const viewport of [
      { width: 780, height: 360 },
      { width: 360, height: 780 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => {
        urchinDebug.world.career.intro.step = 6;
      });
      for (const heading of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        await page.evaluate((heading) => {
          urchinDebug.world.boat.heading = heading;
        }, heading);
        await page.waitForTimeout(120);
        const cues = await page.evaluate(() => {
          const b = urchinDebug.world.boat,
            p = urchinDebug.config.pixelsPerMeter;
          return urchinDebug.visuals.lessonCues.map((cue) => ({
            ...cue,
            dx: cue.anchor.x - b.x * p,
            dy: cue.anchor.y - b.y * p,
          }));
        });
        assert(cues.every((cue) => cue.visible));
        assert(
          cues[0].dx * Math.cos(heading) + cues[0].dy * Math.sin(heading) < 0,
          'pickup label follows port',
        );
        assert(
          -cues[1].dx * Math.sin(heading) + cues[1].dy * Math.cos(heading) > 0,
          'warning follows stern',
        );
      }
      await page.evaluate(() => {
        urchinDebug.world.boat.heading = 0;
        document.querySelector('#frankAboard').scrollTop = 0;
      });
      await page.waitForTimeout(100);
      await shot(`pickup-${viewport.width}`);
      await tap('[data-intro="chart"]');
      await screen('introchart');
      await tap('.screen-back');
      await page.waitForFunction(() => !urchinDebug.ui.started);
      assert(await page.locator('#startup').isVisible());
      assert(await page.locator('#startup .screen-forward').isEnabled());
      const before = await page.evaluate(() => ({
        time: urchinDebug.world.time,
        cash: urchinDebug.world.career.cash,
      }));
      await page.waitForTimeout(250);
      assert.deepEqual(
        await page.evaluate(() => ({
          time: urchinDebug.world.time,
          cash: urchinDebug.world.career.cash,
        })),
        before,
      );
      await tap('#startup .screen-forward');
      await screen('introchart');
      await tap('#playtest [data-choice-index="0"]');
      await screen(null);
      records.push({ viewport, tutorialNavigation: true });
    }
    await tap('[data-intro="skip"]');
    await screen('starter');
    await tap('[data-action="starter-basic"]');
    await tap('[data-action="buy-selected"]');
    await screen('purchase');
    await tap('.screen-back');
    await screen('starter');
    assert(await page.locator('#playtest .screen-forward').isDisabled());
    await tap('.screen-back');
    await page.waitForFunction(() => !urchinDebug.ui.started);
    await tap('#startup .screen-forward');
    await screen('starter');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), 20000);
    assert.equal(await page.evaluate(() => urchinDebug.ui.pendingPurchase), null);
    await tap('[data-action="starter-basic"]');
    await tap('[data-action="buy-selected"]');
    await tap('[data-action="confirm-purchase"]');
    await screen('harbour');
    for (const viewport of [
      { width: 780, height: 360 },
      { width: 360, height: 780 },
    ]) {
      await page.setViewportSize(viewport);
      for (const scale of [80, 100, 150]) {
        await page.evaluate((scale) => {
          while (
            Number(document.querySelector('[data-ui-scale]').textContent.match(/(\d+)%/)[1]) !==
            scale
          )
            urchinDebug.ui.titleAction('scale');
          urchinDebug.ui.open(null);
          urchinDebug.ui.open('harbour');
        }, scale);
        await tap('[data-action="settings"]');
        await screen('settings');
        await tap('[data-action="bindings"]');
        await screen('bindings');
        await tap('.screen-back');
        await screen('settings');
        assert(await page.locator('#playtest .screen-forward').isEnabled());
        await page.locator('#playtest .screen-forward').scrollIntoViewIfNeeded();
        const backBox = await page.locator('.screen-back').boundingBox(),
          forwardBox = await page.locator('#playtest .screen-forward').boundingBox();
        assert(
          Math.abs(backBox.y + backBox.height / 2 - forwardBox.y - forwardBox.height / 2) < 2,
          'Back and Forward stay beside each other',
        );
        assert(forwardBox.x + forwardBox.width <= viewport.width);
        await shot(`settings-forward-${viewport.width}-${scale}`);
        await tap('#playtest .screen-forward');
        await screen('bindings');
        await tap('.screen-back');
        await screen('settings');
        await tap('.screen-back');
        await screen('harbour');
        await tap('.screen-back');
        await page.waitForFunction(() => !urchinDebug.ui.started);
        const forward = page.locator('#startup .screen-forward');
        await forward.scrollIntoViewIfNeeded();
        const box = await forward.boundingBox();
        assert(box.width >= 43 && box.height >= 43);
        await shot(`title-${viewport.width}-${scale}`);
        await tap('#startup .screen-forward');
        await screen('harbour');
        await tap('#playtest .screen-forward');
        await screen('settings');
        await tap('#playtest .screen-forward');
        await screen('bindings');
        assert(await page.locator('#playtest .screen-forward').isDisabled());
        records.push({
          viewport,
          scale,
          route: 'title / harbour / settings / bindings',
          forward: true,
        });
      }
    }
    await page.setViewportSize({ width: 780, height: 360 });
    await page.evaluate(() => {
      while (!document.querySelector('[data-ui-scale]').textContent.includes('100%'))
        urchinDebug.ui.titleAction('scale');
      urchinDebug.ui.open('harbour');
    });
    await tap('[data-action="chart"]');
    await screen('chart');
    await tap('#playtest [data-choice-index="0"]');
    await screen('departure');
    await tap('[data-action="sail"]');
    await screen('purchase');
    await tap('[data-action="confirm-purchase"]');
    await screen(null);
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.trafficSettings = { rate: 0 };
      w.traffic.actors = [];
      w.logs = [];
      w.terrain.depths.fill(30);
      w.day.inspection = null;
      Object.assign(w.boat, {
        x: 250,
        y: w.terrain.size - 0.1,
        heading: Math.PI,
        vx: 0,
        vy: 3,
        throttle: 0.4,
        rudder: 0,
      });
    });
    await page.waitForFunction(() => urchinDebug.world.day.returnFade !== undefined);
    const started = Date.now();
    await page.waitForFunction(
      () => urchinDebug.visuals.departureAlpha < 0.65 && urchinDebug.visuals.departureAlpha > 0.25,
    );
    const middle = await page.evaluate(() => ({
      alpha: urchinDebug.visuals.departureAlpha,
      phase: urchinDebug.world.day.phase,
    }));
    assert.equal(middle.phase, 'working');
    assert(await page.locator('#departureNotice').isVisible());
    await shot('departure-midfade');
    await screen('summary');
    const elapsed = Date.now() - started;
    assert(elapsed >= 1500, 'fade remains visible at normal world speed');
    await shot('offload');
    await tap('.screen-back');
    await page.waitForFunction(() => !urchinDebug.ui.started);
    await tap('#startup .screen-forward');
    await screen('summary');
    records.push({ midfade: middle, elapsed, receiptRestored: true });
    assert.deepEqual(errors, []);
    writeFileSync(
      `test-results/frank-navigation-${engine}.json`,
      JSON.stringify({ engine, records, errors }, null, 2),
    );
    console.log(`Frank, departure and title navigation passed: ${engine}`);
  } finally {
    await context.close();
  }
}
