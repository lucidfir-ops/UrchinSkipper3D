import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

export async function harbourShopChecks(browser) {
  const engine = browser.browserType().name(),
    context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true }),
    page = await context.newPage(),
    errors = [],
    records = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  const tap = (s) => page.locator(s).tap(),
    action = (id) => tap(`[data-action="${id}"]`),
    screen = (name) => page.waitForFunction((s) => urchinDebug.ui.screen === s, name),
    shot = (name) => page.screenshot({ path: `test-results/harbour-shops-${engine}-${name}.png` }),
    cash = () => page.evaluate(() => urchinDebug.world.career.cash);
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await tap('[data-touch-options]');
    await tap('[data-action="touchscreen"]');
    await tap('.screen-back');
    await tap('#keyboardFallback');
    await screen('intro');
    await tap('#playtest [data-choice-index="0"]');
    await screen(null);
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.intro.step = 7;
      w.career.intro.scoutSeconds = 5;
      w.boat.x = 82;
      w.boat.y = 106;
    });
    await page.waitForFunction(() =>
      document.querySelector('#frankAboard').textContent.includes('5–11 m'),
    );
    await tap('#touchMenu');
    await screen('intropause');
    const paused = await page.evaluate(() => urchinDebug.world.career.intro.scoutSeconds);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.intro.scoutSeconds), paused);
    await page.evaluate(() => {
      urchinDebug.world.career.intro.scoutSeconds = 59.8;
    });
    await tap('#playtest [data-choice-index="0"]');
    await screen(null);
    await page.locator('.frank-scout-hint').waitFor({ state: 'visible' });
    assert.equal(
      await page.locator('.frank-scout-hint').textContent(),
      'The urchins are east of the patch you can see, right next to it!',
    );
    await shot('frank-hint');
    await tap('#touchHudToggle');
    for (const zoom of [0.4, 1, 2.8]) {
      await page.evaluate((zoom) => {
        urchinDebug.terrainView.scene.cameras.main.setZoom(zoom);
      }, zoom);
      await page.waitForTimeout(100);
      const bounds = await page.evaluate(() => {
        const t = urchinDebug.terrainView,
          ppm = urchinDebug.config.pixelsPerMeter;
        return t.labels.flatMap((label, i) =>
          label.visible
            ? [
                {
                  bottom: label.getBounds().bottom,
                  north: Math.min(...t.patchGraphics[i].outline.map((p) => p.y)) * ppm,
                  zoom: t.scene.cameras.main.zoom,
                },
              ]
            : [],
        );
      });
      assert(bounds.length > 0);
      for (const b of bounds)
        assert(b.bottom <= b.north - 7.9 / b.zoom, 'label clears every point of its ground');
      records.push({ labelBounds: bounds });
      if (zoom === 1) await shot('ground-label');
    }
    await tap('#touchHudToggle');
    await tap('[data-intro="next"]');
    await page.waitForFunction(() =>
      document.querySelector('#frankAboard').textContent.includes('5 m and 25 m'),
    );
    const lesson = await page.locator('#frankAboard').textContent();
    for (const text of ['Recording chartplotter', 'shallower', 'kelp', 'slope'])
      assert(lesson.includes(text));
    await shot('frank-discovery');
    await tap('[data-intro="skip"]');
    await screen('starter');
    const startCash = await cash();
    await action('starter-basic');
    await action('starter-basic');
    await screen('starter');
    assert.equal(await cash(), startCash);
    await shot('starter-preview');
    await action('buy-inline');
    await screen('purchase');
    assert.equal(
      await page.evaluate(() => urchinDebug.ui.index),
      0,
      'Cancel is initially selected',
    );
    await action('cancel-purchase');
    await screen('starter');
    assert.equal(await cash(), startCash);
    await action('buy-selected');
    await action('confirm-purchase');
    await screen('harbour');
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 780, height: 360 },
      { width: 360, height: 780 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(200);
      await page.locator('#playtest').evaluate((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
      const layout = await page.evaluate(() => {
        const panel = document.querySelector('#playtest'),
          scene = panel.querySelector('.wharf-scene'),
          r = scene.getBoundingClientRect();
        return {
          background: getComputedStyle(panel).backgroundColor,
          art: getComputedStyle(panel.querySelector('.wharf-content')).backgroundImage,
          canvas: panel.querySelector('.wharf-content').getBoundingClientRect().toJSON(),
          width: r.width,
          height: r.height,
          places: [...scene.querySelectorAll('button')].map((el) => {
            const b = el.getBoundingClientRect();
            return {
              id: el.dataset.action,
              x: (b.x + b.width / 2 - r.x) / r.width,
              y: (b.y + b.height / 2 - r.y) / r.height,
              width: b.width,
              height: b.height,
            };
          }),
        };
      });
      assert.equal(layout.background, 'rgba(0, 0, 0, 0)');
      assert(layout.art.includes('harbour-training-mode-v1.png'));
      assert(layout.canvas.width >= viewport.width && layout.canvas.height >= viewport.height);
      assert.equal(layout.places.length, 9);
      const at = (id) => layout.places.find((p) => p.id === id);
      assert(at('settings').x > 0.8 && at('settings').y < 0.2, 'Settings: top right');
      assert(at('help').x < 0.2 && at('help').y > 0.8, 'Frank: bottom left');
      assert(
        at('outfit').x < 0.2 && Math.abs(at('outfit').y - 0.5) < 0.002,
        'Chandlery: centre left',
      );
      assert(at('fleet').x > 0.8 && Math.abs(at('fleet').y - 0.5) < 0.002);
      assert(Math.abs(at('crew').x - 0.5) < 0.002 && Math.abs(at('crew').y - 0.5) < 0.002);
      if (viewport.width === 1280) {
        assert.equal(layout.canvas.width, 1280);
        assert.equal(layout.canvas.height, 800);
      } else {
        assert(
          Math.abs(layout.canvas.width / layout.canvas.height - 1.6) < 0.002,
          'phone panning preserves the approved harbour composition',
        );
      }
      if (viewport.width === 360 && engine === 'chromium') {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: 300, y: 400 }],
        });
        for (let n = 1; n <= 8; n++) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: 300 - n * 28, y: 400 }],
          });
          await page.waitForTimeout(25);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
        await page.waitForFunction(() => document.querySelector('#playtest').scrollLeft > 20);
        await page.waitForTimeout(400);
      }
      for (const place of layout.places) {
        assert(place.width >= 44 && place.height >= 44);
        await page.locator(`[data-action="${place.id}"]`).scrollIntoViewIfNeeded();
        const hit = await page.locator(`[data-action="${place.id}"]`).evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        });
        assert(hit, `dock ${place.id} is reachable at ${viewport.width}`);
      }
      await page.locator('#playtest').evaluate((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
      await shot(`harbour-${viewport.width}`);
      records.push({ viewport, layout });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    // Funds/rank are a shopping fixture; transactions still use real purchase paths.
    await page.evaluate(() => {
      urchinDebug.world.career.cash = 1000000;
      urchinDebug.world.career.xp = 12000;
    });
    await action('fleet');
    await screen('fleet');
    for (const [shop, preview, name] of [
      ['fleet', 'buy-jet', 'Shoal Skipper'],
      ['outfit', 'equipment-plotter', 'Recording chartplotter'],
    ]) {
      if (shop === 'outfit') {
        await page.evaluate(() => urchinDebug.ui.open('outfit'));
        await screen(shop);
      }
      await action('your-boat');
      await screen('yourboat');
      assert((await page.locator('.career-detail').textContent()).includes('Current setup'));
      await page.locator('.screen-back').tap();
      await screen(shop);
      const before = await cash();
      for (const viewport of [
        { width: 1280, height: 800 },
        { width: 780, height: 360 },
        { width: 360, height: 780 },
      ]) {
        await page.setViewportSize(viewport);
        await action(preview);
        await action(preview);
        await screen(shop);
        assert.equal(await cash(), before);
        assert.equal(await page.locator('button button').count(), 0);
        assert.equal(await page.locator('.shop-inline-buy').count(), 1);
        assert((await page.locator('.career-detail').textContent()).includes(name));
        if (viewport.width === 360) {
          assert(await page.locator('.shop-inline-detail').isVisible());
          await page.evaluate(() => {
            while (!document.querySelector('[data-ui-scale]').textContent.includes('150%'))
              urchinDebug.ui.titleAction('scale');
          });
          if (shop === 'fleet') {
            const original = await page.locator('[data-action="buy-jet"]').boundingBox(),
              sister = await page.locator('[data-action="buy-jet-sister"]').boundingBox();
            assert(
              sister.x > original.x && Math.abs(sister.y - original.y) < 2,
              'sister stays beside original',
            );
          }
          await page.locator('.shop-inline-buy').evaluate((el) => {
            el.closest('.shop-row').scrollIntoView({ block: 'start' });
          });
          await page.locator('.shop-inline-detail').evaluate((el) => {
            el.scrollTop = el.scrollHeight;
          });
          await page.waitForTimeout(100);
          if (shop === 'fleet')
            assert(await page.locator('.shop-inline-detail').evaluate((el) => el.scrollTop > 10));
        }
        await shot(`${shop}-preview-${viewport.width}`);
        await action('buy-inline');
        await screen('purchase');
        await action('cancel-purchase');
        await screen(shop);
        assert.equal(await cash(), before);
        await action('buy-selected');
        await screen('purchase');
        await action('cancel-purchase');
      }
      await page.evaluate(() => {
        while (!document.querySelector('[data-ui-scale]').textContent.includes('100%'))
          urchinDebug.ui.titleAction('scale');
      });
      await page.setViewportSize({ width: 1280, height: 800 });
      await action('buy-top');
      await action('confirm-purchase');
      await screen(shop);
      assert((await cash()) < before);
      assert(await page.locator('[data-action="buy-selected"]').isDisabled());
      records.push({
        shop,
        inspection: 'no charge',
        explicitBuy: 'inline, top and bottom',
        purchase: 'successful',
      });
    }
    // Synthetic Xbox navigation inspects independently of buying; cancel stays safe.
    await page.evaluate(gamepadScript);
    await page.evaluate(() => {
      urchinDebug.ui.touch.setEnabled(false);
      urchinDebug.ui.open('fleet');
    });
    await page.waitForFunction(() => urchinDebug.input.connected && !urchinDebug.input.suppressed);
    const pad = (action) => pressAction(page, 'fakePad', action),
      beforePad = await cash();
    await chooseController(page, pad, 'Island Tender');
    await screen('fleet');
    assert.equal(await cash(), beforePad);
    await chooseController(page, pad, 'Buy selected boat', false);
    await pad('confirm');
    await screen('purchase');
    await chooseController(page, pad, 'Cancel');
    await screen('fleet');
    assert.equal(await cash(), beforePad);
    await page.evaluate(() => {
      urchinDebug.ui.open('harbour');
    });
    await action('chart');
    await tap('#playtest [data-choice-index="0"]');
    await action('sail');
    await action('confirm-purchase');
    await screen(null);
    await page.evaluate(() => {
      urchinDebug.ui.touch.setEnabled(true);
    });
    await tap('#touchMenu');
    await screen('pause');
    assert.equal(
      await page.locator('#playtest [data-choice-index="2"]').textContent(),
      'UI / difficulty options',
    );
    await tap('#playtest [data-choice-index="2"]');
    await screen('assists');
    await shot('assists');
    assert.deepEqual(errors, []);
    writeFileSync(
      `test-results/harbour-shops-${engine}.json`,
      JSON.stringify({ engine, records, errors }, null, 2),
    );
    console.log(`Harbour / shops passed: ${engine}`);
  } catch (error) {
    console.error(
      'Failed state:',
      await page.evaluate(() => ({
        screen: urchinDebug.ui.screen,
        index: urchinDebug.ui.index,
        choices: urchinDebug.ui.choices(urchinDebug.world),
      })),
    );
    await shot('failure');
    throw error;
  } finally {
    await context.close();
  }
}
