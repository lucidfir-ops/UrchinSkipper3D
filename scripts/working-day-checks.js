import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import '../tests/matter-helper.js';
import { createCareer, freshVessel, useVessel } from '../src/career-state.js';
import { careerWorld, encode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { FLEET } from '../src/career-data.js';

export async function workingDayChecks(browser) {
  const name = browser.browserType().name(),
    results = [],
    errors = [];
  for (const renderer of name === 'chromium' ? ['canvas', 'webgl'] : ['canvas']) {
    const c = createCareer(171709);
    c.cash = 1e6;
    c.records.totalRevenue = 40000;
    c.records.safeDays = 7;
    for (const id of Object.keys(FLEET)) c.fleet[id] = freshVessel(id);
    let w = careerWorld(c);
    useVessel(w, 'twinjet');
    w.career.fleet.twinjet.equipment = ['lights', 'plotter', 'hoist', 'torch'];
    const encoded = encode(w);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript((saved) => {
      if (!localStorage.getItem('urchin-career-v1'))
        localStorage.setItem('urchin-career-v1', saved);
    }, encoded);
    let page = await context.newPage();
    const visit = async () => {
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(
        (process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/') + `?renderer=${renderer}`,
      );
      await page.waitForFunction(() => window.urchinDebug?.ready, { timeout: 30000 });
      await page.locator('#keyboardFallback').click();
    };
    const open = async (screen) => {
      await page.evaluate((s) => urchinDebug.ui.open(s), screen);
      await page.waitForFunction((s) => urchinDebug.ui.screen === s, screen);
    };
    const action = async (id) => page.locator(`[data-action="${id}"]`).click();
    try {
      await visit();
      await open('market');
      await action('buyer-premium');
      assert.equal(await page.evaluate(() => urchinDebug.world.career.buyerToday.id), 'premium');
      await page.screenshot({ path: `test-results/working-${name}-${renderer}-market.png` });
      await open('equipment-controls');
      await action('switch-lights');
      assert(
        await page.evaluate(() =>
          urchinDebug.world.career.fleet.twinjet.disabledEquipment.includes('lights'),
        ),
      );
      await page.close();
      page = await context.newPage();
      await visit();
      assert.equal(await page.evaluate(() => urchinDebug.world.boat.configuration), 'twinjet');
      assert(
        await page.evaluate(() =>
          urchinDebug.world.career.fleet.twinjet.disabledEquipment.includes('lights'),
        ),
      );
      // Each of the twelve owned hulls survives a save and a complete page reload.
      for (const id of Object.keys(FLEET)) {
        const sailing = careerWorld(structuredClone(c));
        useVessel(sailing, id);
        chooseGround(sailing, 'near');
        await page.evaluate(
          (text) => urchinDebug.ui.hooks.changeCareer(null, text),
          encode(sailing),
        );
        await page.reload();
        await page.waitForFunction(() => window.urchinDebug?.ready);
        await page
          .waitForFunction((id) => urchinDebug.vesselTexture === `vessel-raster-${id}`, id)
          .catch(async (error) => {
            console.log(
              'Hull reload failure',
              id,
              await page.evaluate(() => ({
                ready: urchinDebug.ready,
                configuration: urchinDebug.world.boat.configuration,
                active: urchinDebug.world.career.activeBoat,
                texture: urchinDebug.vesselTexture,
                screen: urchinDebug.ui.screen,
              })),
              errors,
            );
            await page.screenshot({ path: 'test-results/hull-reload-failure.png' });
            throw error;
          });
        const pixels = await page.evaluate(async (id) => {
          const d = urchinDebug,
            scene = d.terrainView.scene,
            expected = await d.vesselCanvas(id),
            actual = scene.textures.get(d.vesselTexture).getSourceImage();
          const hash = (canvas) => {
            const data = canvas
              .getContext('2d')
              .getImageData(0, 0, canvas.width, canvas.height).data;
            let total = 0;
            for (let i = 0; i < data.length; i++) total = (Math.imul(total, 31) + data[i]) >>> 0;
            return total;
          };
          return {
            id: d.world.boat.configuration,
            active: d.world.career.activeBoat,
            key: d.vesselTexture,
            expected: hash(expected),
            actual: hash(actual),
          };
        }, id);
        assert.equal(pixels.id, id);
        assert.equal(pixels.active, id);
        assert.equal(pixels.key, `vessel-raster-${id}`);
        assert.equal(pixels.actual, pixels.expected);
        results.push({ renderer, ...pixels });
        await page.locator('#keyboardFallback').click();
      }
      await open('settings');
      await action('boat-art');
      await page.reload();
      await page.waitForFunction(
        () => urchinDebug.vesselTexture === 'vessel-vector-twinjet-sister',
      );
      assert.equal(
        await page.evaluate(() => urchinDebug.world.boat.configuration),
        'twinjet-sister',
      );
      await page.locator('#keyboardFallback').click();
      await open('settings');
      await action('boat-art');
      // A real working save supplies render, deck menu and reload evidence.
      w = careerWorld(c);
      useVessel(w, 'basic');
      chooseGround(w, 'near');
      w.day.minute = 720;
      w.bags = Array.from({ length: 25 }, (_, i) => ({
        id: `sample-${i}`,
        weight: 300,
        quality: i === 24 ? 0.61 : 0.94,
        harvestMinute: w.day.minute,
        haulSeconds: 3,
      }));
      w.catch = 7500;
      await page.evaluate((text) => {
        const d = urchinDebug;
        d.ui.hooks.changeCareer(null, text);
        d.ui.open(null);
        d.ui.started = true;
        d.ui.realistic = false;
        d.world.career.trafficSettings = { rate: 0 };
      }, encode(w));
      await page.waitForFunction(() => urchinDebug.ready);
      await page.screenshot({ path: `test-results/working-${name}-${renderer}-deck.png` });
      await open('deck-catch');
      await action('dump-24');
      await page.waitForFunction(
        () => !urchinDebug.world.day.dump && urchinDebug.world.bags.length === 24,
      );
      assert.equal(await page.evaluate(() => urchinDebug.world.catch), 7200);
      await page.evaluate(() => {
        const d = urchinDebug,
          w = d.world,
          diver = w.divers[0];
        Object.assign(diver, {
          state: 'surfacing',
          timer: 0.01,
          x: w.boat.x - 5,
          y: w.boat.y,
          bag: 300,
          qualitySum: 285,
          reason: 'Bag full',
        });
        d.step(0.05);
      });
      await page.waitForFunction(() => urchinDebug.terrainView.scene.view.speechLabels[0].visible);
      await page.screenshot({ path: `test-results/working-${name}-${renderer}-pickup.png` });
      // Night and day use the same equipment switch; never a daylight beam.
      await page.evaluate(() => {
        const d = urchinDebug;
        d.world.career.fleet[d.world.boat.configuration].equipment = ['lights', 'torch'];
        d.world.career.debugConditions = { weather: 'calm', tideHeight: null };
        d.world.day.minute = 1260;
        d.step(0.1);
      });
      await page.screenshot({ path: `test-results/working-${name}-${renderer}-night.png` });
      await open('equipment-controls');
      await action('switch-lights');
      await open(null);
      await page.screenshot({ path: `test-results/working-${name}-${renderer}-lights-off.png` });
      await page.setViewportSize({ width: 402, height: 873 });
      await open('deck-catch');
      await page.locator('[data-action="dump-0"]').scrollIntoViewIfNeeded();
      assert(await page.locator('[data-action="dump-0"]').isVisible());
      await page.screenshot({
        path: `test-results/working-${name}-${renderer}-phone-deck-menu.png`,
      });
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(`test-results/working-${name}.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(
    `PASS: ${name} saved hull identity/pixels, cold page reopen, buyer selection, equipment switches, timed dumping and day/night deck screenshots`,
  );
}
