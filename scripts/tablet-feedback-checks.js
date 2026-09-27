import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

export async function tabletFeedbackChecks(browser) {
  const name = browser.browserType().name(),
    errors = [],
    results = [];
  const page = await browser.newPage({ viewport: { width: 864, height: 1296 }, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(25000);
  const action = (id) => page.locator(`[data-action="${id}"]`).click();
  try {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('tablet-feedback')) {
        localStorage.setItem(
          'urchin-instrument-style-v1',
          JSON.stringify({ minimapPanel: 'graphic' }),
        );
        sessionStorage.setItem('tablet-feedback', 'yes');
      }
    });
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.waitForFunction(() => window.urchinDebug?.ready);
    assert.match(
      await page.locator('[data-fullscreen]').textContent(),
      /Fullscreen & Rotate screen/,
    );
    await page.screenshot({ path: `test-results/tablet-${name}-title.png` });
    await page.locator('#keyboardFallback').click();
    await page.getByRole('button', { name: 'Skip day 0 · choose my boat', exact: true }).click();
    for (const id of ['starter-basic', 'buy-selected', 'confirm-purchase']) await action(id);
    await page.waitForFunction(
      () => document.querySelector('#playtest').dataset.screen === 'harbour',
    );
    await page.evaluate(() => {
      const ui = urchinDebug.ui;
      ui.touch.setEnabled(true);
      for (const label of ['Sail', 'Sheltered Kelp', 'Begin working day']) {
        ui.index = ui.choices(urchinDebug.world).findIndex((c) => c.startsWith(label));
        if (ui.index < 0) throw Error('Missing departure action: ' + label);
        ui.activate(urchinDebug.world);
      }
    });
    await page.waitForFunction(
      () =>
        urchinDebug.ready &&
        urchinDebug.world.time > 2 &&
        !urchinDebug.ui.lockReason &&
        urchinDebug.vesselTexture &&
        urchinDebug.terrainView.prepared,
    );
    assert(await page.locator('#loadPanel').isVisible());
    assert(await page.locator('#minimapPanel > small').isVisible());
    // An old labelled chart can switch directly, retaining its saved size.
    const before = await page.locator('#minimapPanel').boundingBox();
    await page.locator('[data-minimap-style]').tap();
    await page.waitForFunction(
      () => document.querySelector('#minimapPanel').dataset.presentation === 'chart',
    );
    assert.equal(await page.locator('#minimapPanel > small').isVisible(), false);
    const after = await page.locator('#minimapPanel').boundingBox();
    assert.equal(after.width, before.width);
    await page.screenshot({ path: `test-results/tablet-${name}-departure.png` });
    results.push({
      departure: 'visible boat and prepared terrain',
      chartOnly: true,
      deckLoad: true,
    });
    // Stage a safe calm pickup to exercise the real touch command and HUD.
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.terrain.depths = w.terrain.depths.slice().fill(20);
      w.logs = [];
      w.day.inspection = null;
      w.day.crewRest = 0;
      w.day.minute = 720;
      w.career.trafficSettings = { rate: 0 };
      w.career.debugConditions = { weather: 'calm', bearing: 0, tideHeight: null };
      Object.assign(w.boat, {
        x: 250,
        y: 250,
        vx: 0,
        vy: 0,
        heading: 0,
        throttle: 0,
        rudder: 0,
        turn: 0,
      });
      Object.assign(w.divers[0], { state: 'searching', x: 180, y: 180, air: 100, searchTime: 0 });
      Object.assign(w.divers[1], { state: 'ready', air: 100 });
      w.selectedDiverId = 0;
    });
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    await page.locator('[data-touch="recoverDiver"]').tap();
    await page.waitForFunction(() => urchinDebug.world.divers[1].state === 'deploying');
    assert.equal(await page.evaluate(() => urchinDebug.world.selectedDiverId), 0);
    results.push({ touchDeploysUnselectedCrew: true });
    // Observe actual Canvas redraws and unchanged control text during dry play.
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.debugConditions.weather = 'calm';
      w.day.minute = 720;
      const context = document.querySelector('#weatherVeil').getContext('2d');
      const clear = context.clearRect.bind(context);
      window.weatherClears = 0;
      context.clearRect = (...a) => {
        window.weatherClears++;
        return clear(...a);
      };
      window.touchTextWrites = 0;
      const observer = new MutationObserver((records) => {
        window.touchTextWrites += records.length;
      });
      for (const el of document.querySelectorAll(
        '#touchControls .command-arrow, #touchHudToggle, #touchLockToggle',
      ))
        observer.observe(el, { childList: true, characterData: true, subtree: true });
      window.tabletObserver = observer;
      urchinDebug.resetRenderSamples();
    });
    await page.waitForTimeout(1800);
    const retained = await page.evaluate(() => {
      window.tabletObserver.disconnect();
      return {
        frames: urchinDebug.renderSamples.length,
        weatherClears: window.weatherClears,
        textWrites: window.touchTextWrites,
      };
    });
    assert(retained.frames > 15);
    assert(retained.weatherClears < retained.frames / 2, JSON.stringify(retained));
    assert(retained.textWrites < 8, JSON.stringify(retained));
    results.push({ retained });
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.debugConditions.weather = 'storm';
      w.day.minute = 1320;
      w.career.fleet[w.boat.configuration].equipment.push('lights');
    });
    await page.waitForFunction(
      () => urchinDebug.world.weather.night && urchinDebug.world.weather.rain > 0.1,
    );
    const rainStart = await page.evaluate(() => window.weatherClears);
    await page.waitForFunction((start) => window.weatherClears > start + 10, rainStart);
    await page.screenshot({ path: `test-results/tablet-${name}-night-rain.png` });
    await page.evaluate(() => {
      urchinDebug.world.career.debugConditions.weather = 'calm';
    });
    await page.waitForFunction(() => urchinDebug.world.weather.rain === 0);
    const light = await page.locator('#weatherVeil').evaluate((el) => el.toDataURL());
    await page.evaluate(() => {
      urchinDebug.world.boat.heading += Math.PI / 2;
    });
    await page.waitForFunction(
      (before) => document.querySelector('#weatherVeil').toDataURL() !== before,
      light,
    );
    await page.screenshot({ path: `test-results/tablet-${name}-night-lights.png` });
    results.push({ rainAnimates: true, nightLightsTurn: true });
    for (const [width, height] of [
      [402, 873],
      [873, 402],
      [1296, 864],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      await page.evaluate(() => urchinDebug.ui.open('pause'));
      await page.waitForFunction(
        () => document.querySelector('#playtest').dataset.screen === 'pause',
      );
      const button = page.getByRole('button', { name: /Fullscreen & Rotate screen/ });
      await button.scrollIntoViewIfNeeded();
      assert(await button.isVisible());
      const box = await button.boundingBox();
      assert(box.x >= 0 && box.x + box.width <= width + 1);
      await page.screenshot({ path: `test-results/tablet-${name}-pause-${width}.png` });
      await page.evaluate(() => urchinDebug.ui.open(null));
    }
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ready);
    await page.locator('#keyboardFallback').click();
    await page.waitForFunction(
      () => urchinDebug.ready && !!urchinDebug.vesselTexture && urchinDebug.terrainView.prepared,
    );
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('urchin-instrument-style-v1')).minimapPanel,
      ),
      'chart',
    );
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({ path: `test-results/tablet-${name}-failure.png` });
    throw error;
  } finally {
    writeFileSync(`test-results/tablet-${name}.json`, JSON.stringify({ results, errors }, null, 2));
    await page.close();
  }
}
