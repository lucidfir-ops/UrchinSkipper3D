import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { careerWorld, encode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';

export async function crewCoastsChecks(browser) {
  const name = browser.browserType().name(),
    errors = [],
    results = [];
  const w = careerWorld();
  chooseGround(w, 'near');
  w.day.minute = 720;
  w.career.trafficSettings = { rate: 0 };
  w.career.debugConditions = { weather: 'calm', bearing: 0, tideHeight: null };
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript((saved) => {
    if (!localStorage.getItem('urchin-career-v1')) localStorage.setItem('urchin-career-v1', saved);
  }, encode(w));
  const page = await context.newPage();
  const press = async (key) => {
    await page.waitForFunction(() => !urchinDebug.input.suppressed && urchinDebug.ready);
    await page.keyboard.press(key, { delay: 80 });
  };
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto((process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/') + '?renderer=canvas');
    await page.waitForFunction(() => window.urchinDebug?.ready);
    await page.locator('#keyboardFallback').click();
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    await page.evaluate(() => {
      const d = urchinDebug,
        w = d.world,
        p = w.patches.find((p) => p.charted !== false && p.quality >= 0.8);
      d.ui.open(null);
      w.day.minute = 720;
      w.day.inspection = null;
      w.logs = [];
      w.career.trafficSettings = { rate: 0 };
      w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
      w.terrain.depths = w.terrain.depths.slice().fill(20);
      Object.assign(w.boat, {
        x: p.x + 4,
        y: p.y,
        heading: 0,
        vx: 0,
        vy: 0,
        throttle: 0,
        rudder: 0,
        turn: 0,
      });
      for (const diver of w.divers)
        Object.assign(diver, {
          state: 'surface',
          x: p.x,
          y: p.y + diver.id,
          patch: p,
          bag: 300,
          qualitySum: 270,
          air: 80,
          bagHandled: false,
          hooking: false,
          hook: 0,
          maxBagSeconds: 0,
          minQuality: 0,
        });
      w.selectedDiverId = 1;
    });
    await press('2');
    await page.waitForFunction(() => urchinDebug.world.catch === 300);
    const exchange = await page.evaluate(() => ({
      states: urchinDebug.world.divers.map((d) => d.state),
      bags: urchinDebug.world.divers.map((d) => d.bag),
      selected: urchinDebug.world.selectedDiverId,
    }));
    assert(['deploying', 'searching', 'harvesting'].includes(exchange.states[0]));
    assert.equal(exchange.bags[1], 300);
    assert.equal(exchange.selected, 1);
    results.push({ exchange });
    // Direct bag offer to an unselected low-air diver produces a visible answer.
    await page.evaluate(() => {
      const d = urchinDebug,
        w = d.world,
        a = w.divers[0];
      Object.assign(a, {
        state: 'surface',
        x: w.boat.x - 4,
        y: w.boat.y,
        bag: 0,
        qualitySum: 0,
        bagHandled: true,
        air: 20,
        hooking: false,
        recoveryAction: null,
      });
      Object.assign(w.divers[1], { state: 'ready', x: w.boat.x, y: w.boat.y, bag: 0 });
      Object.assign(w.boat, { throttle: 0, vx: 0, vy: 0, heading: 0, turn: 0, rudder: 0 });
    });
    await press('2');
    await page.waitForFunction(
      () =>
        urchinDebug.terrainView.scene.view.speechLabels[0].visible &&
        urchinDebug.world.divers[0].speech?.text.includes('Low air'),
    );
    await page.screenshot({ path: `test-results/crew-coasts-${name}-refusal.png` });
    await press('1');
    await page.waitForFunction(() => urchinDebug.world.divers[0].state === 'ready');
    assert.equal(await page.evaluate(() => urchinDebug.world.selectedDiverId), 1);
    // Per-person orders are reachable with mouse/touch and preserve across reload.
    await press('o');
    await page.waitForSelector('[data-order=bag]');
    for (let i = 0; i < 4; i++) await page.locator('[data-order=quality-more]').click();
    for (let i = 0; i < 3; i++) await page.locator('[data-order=bag]').click();
    await page.screenshot({ path: `test-results/crew-coasts-${name}-orders.png` });
    await page.locator('[data-order=apply]').click();
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ready);
    assert.equal(await page.evaluate(() => urchinDebug.world.divers[1].maxBagSeconds), 45);
    assert.equal(await page.evaluate(() => urchinDebug.world.divers[1].minQuality), 0.9);
    await page.locator('#keyboardFallback').click();
    // Two new reports beside each other must remain legible instead of overlapping.
    await page.evaluate(() => {
      const d = urchinDebug,
        w = d.world;
      w.day.minute = 720;
      w.day.inspection = null;
      for (const [i, a] of w.divers.entries())
        Object.assign(a, {
          state: 'surfacing',
          timer: 0.01,
          x: w.boat.x - 5,
          y: w.boat.y + i,
          bag: 100,
          qualitySum: 80,
          minQuality: 0.9,
          groundSample: { patchId: 'observed', quality: 0.8 },
          lastBagSeconds: 80,
          maxBagSeconds: 45,
          reason: 'Picking slower than bag time order',
          bagHandled: false,
        });
      d.ui.open(null);
      d.step(0.05);
    });
    await page.waitForFunction(() =>
      urchinDebug.terrainView.scene.view.speechLabels.every((s) => s.visible),
    );
    const bounds = await page.evaluate(() =>
      urchinDebug.terrainView.scene.view.speechLabels.map((s) => {
        const r = s.getBounds();
        return { x: r.x, right: r.right, text: s.text };
      }),
    );
    assert(bounds[0].right < bounds[1].x);
    assert(bounds.every((b) => /80%.*90%/.test(b.text) && b.text.includes('45s')));
    await page.screenshot({ path: `test-results/crew-coasts-${name}-reports.png` });
    results.push({ reports: bounds });
    await page.setViewportSize({ width: 412, height: 915 });
    await press('o');
    await page.waitForSelector('[data-order=bag]');
    await page.locator('[data-order=bag]').click();
    assert(
      await page.evaluate(() =>
        [...document.querySelectorAll('[data-order]')].every((b) => {
          const r = b.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth;
        }),
      ),
      'Order controls fit the phone width',
    );
    await page.locator('[data-order=apply]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/crew-coasts-${name}-phone-orders.png` });
    await page.locator('[data-order=apply]').click();
    await page.evaluate(() => urchinDebug.ui.open('conditions'));
    await page.waitForFunction(
      () =>
        document.querySelector('#panel')?.textContent.includes('weak storms') ||
        document.body.textContent.includes('Home Coast gets weak storms'),
    );
    await page.screenshot({ path: `test-results/crew-coasts-${name}-forecast.png` });
    assert.deepEqual(errors, []);
    writeFileSync(
      `test-results/crew-coasts-${name}.json`,
      JSON.stringify({ results, errors }, null, 2),
    );
    console.log(
      `PASS: ${name} one-press targeting, refusal bubbles, quality/speed reports, saved orders, phone controls and forecast advice.`,
    );
  } catch (error) {
    console.log(
      'Crew/coasts browser failure',
      await page.evaluate(() => ({
        screen: urchinDebug.ui.screen,
        lock: urchinDebug.ui.lockReason,
        message: urchinDebug.world.message,
        day: urchinDebug.world.day,
        divers: urchinDebug.world.divers.map((d) => ({
          state: d.state,
          condition: d.condition,
          x: d.x,
          y: d.y,
          hook: d.hook,
          reason: d.reason,
          pause: d.recoveryPause,
        })),
        catch: urchinDebug.world.catch,
      })),
      errors,
    );
    await page.screenshot({ path: `test-results/crew-coasts-${name}-failure.png` });
    throw error;
  } finally {
    await context.close();
  }
}
