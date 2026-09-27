import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

export async function s22LatestChecks(browser) {
  const engine = browser.browserType().name();
  const context = await browser.newContext({
    viewport: { width: 780, height: 360 },
    hasTouch: true,
  });
  const page = await context.newPage(),
    errors = [],
    records = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  const tap = (selector) => page.locator(selector).tap();
  const screen = async (name) => {
    await page.waitForFunction((name) => urchinDebug.ui.screen === name, name);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  };
  const action = (id) => tap(`[data-action="${id}"]`);
  const shot = (name) => page.screenshot({ path: `test-results/s22-latest-${engine}-${name}.png` });
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await tap('[data-touch-options]');
    await tap('[data-action="touchscreen"]');
    await tap('.screen-back');
    await tap('#keyboardFallback');
    await screen('intro');
    await tap('[data-choice-index="1"]');
    await screen('starter');
    assert(await page.locator('[data-action="buy-selected"]').isDisabled());
    assert.match(await page.locator('.career-detail').textContent(), /Nothing is selected/);
    assert.equal(await page.locator('.shop-row.is-preview').count(), 0);
    await action('starter-basic');
    await action('buy-selected');
    await screen('purchase');
    assert.equal(await page.evaluate(() => urchinDebug.ui.index), 0);
    await action('confirm-purchase');
    await screen('harbour');
    await action('workshop');
    await action('repeat-tutorial');
    await screen(null);
    assert(await page.evaluate(() => urchinDebug.world.career.trainingReplay));
    assert.match(await page.locator('#frankAboard').textContent(), /Equipment 1/);
    const savedBefore = await page.evaluate(() => localStorage.getItem('urchin-career-v1'));
    await tap('[data-intro="next"]');
    await page.waitForFunction(() => urchinDebug.world.career.intro.prepIndex === 1);
    for (const viewport of [
      { width: 780, height: 360 },
      { width: 360, height: 780 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);
      assert.equal(await page.locator('#helmPanel #divers').count(), 0);
      const bounds = await page.evaluate(() => {
        const rect = (id) => {
          const r = document.querySelector(id).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
        };
        return {
          helm: rect('#helmPanel'),
          divers: rect('#diverPanel'),
          controls: rect('#touchControls'),
          frank: getComputedStyle(document.querySelector('#frankAboard')).backgroundColor,
        };
      });
      await shot(`layout-${viewport.width}`);
      assert(bounds.helm.y >= bounds.controls.bottom - 1, JSON.stringify(bounds));
      assert(bounds.divers.y >= bounds.controls.bottom - 1);
      assert(bounds.helm.bottom <= viewport.height && bounds.divers.bottom <= viewport.height);
      assert.equal(bounds.frank, 'rgba(0, 0, 0, 0)');
      assert.equal(await page.locator('#diverPanel .nitrogen-bar').count(), 2);
      assert(
        await page
          .locator('#diverPanel')
          .evaluate((el) =>
            [...el.querySelectorAll('.nitrogen-info')].every(
              (n) => n.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom,
            ),
          ),
        'both readiness lines fit the compact row',
      );
      assert(!/N₂|ready at/i.test(await page.locator('#diverPanel').textContent()));
      await page.evaluate(() => {
        urchinDebug.world.boat.throttle = -0.7;
        urchinDebug.world.boat.rudder = 0.8;
      });
      await page.waitForFunction(
        () => document.querySelector('[data-stick="helm"]').dataset.direction === 'negative',
      );
      await shot(`lesson-${viewport.width}`);
      records.push({ viewport, bounds });
    }
    await page.setViewportSize({ width: 780, height: 360 });
    await tap('[data-intro="skip"]');
    await screen('harbour');
    assert.equal(await page.evaluate(() => localStorage.getItem('urchin-career-v1')), savedBefore);
    await action('chart');
    await tap('#playtest [data-choice-index="0"]');
    await action('sail');
    await screen('purchase');
    await action('confirm-purchase');
    await screen(null);
    await page.waitForTimeout(400);
    // A directly opened chart returns to the water, while the pause-menu route retains its parent.
    await tap('[data-touch="chart"]');
    await screen('knowledge');
    await tap('.screen-back');
    await screen(null);
    await tap('#touchMenu');
    await tap('#playtest [data-choice-index="3"]:not([hidden]):not(.screen-back)');
    await screen('assists');
    assert.match(await page.locator('#playtest').textContent(), /UI options · any difficulty/);
    await action('off');
    await action('assist-currentOverlay');
    await action('assist-frankOverlay');
    assert.match(await page.locator('.assist-explanation').textContent(), /Frank/);
    await action('easy');
    await action('custom');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.helmOverlay), false);
    await shot('options');
    await tap('.screen-back');
    await tap('#playtest [data-choice-index="0"]');
    await screen(null);
    await page.locator('#currentReadout').waitFor({ state: 'visible' });
    assert(!(await page.locator('#helmPanel').isVisible()));
    const mover = page.locator('[data-move-window="currentReadout"]');
    await page.waitForFunction(() => {
      const rect = document
        .querySelector('[data-move-window="currentReadout"]')
        ?.getBoundingClientRect();
      return rect && rect.width > 0 && rect.height > 0;
    });
    const r = await mover.boundingBox();
    assert(r, 'live-current window has a drag target');
    await page.mouse.move(r.x + 12, r.y + 12);
    await page.mouse.down();
    await page.mouse.move(r.x - 90, r.y + 60, { steps: 8 });
    await page.mouse.up();
    assert((await page.locator('#currentReadout').getAttribute('data-window-moved')) !== null);
    await tap('[data-close-window="currentReadout"]');
    await page.waitForFunction(() => !urchinDebug.world.career.assists.currentOverlay);
    await tap('#touchMenu');
    await tap('#playtest [data-choice-index="2"]');
    await action('easy');
    await action('assist-diverIndicators');
    await tap('.screen-back');
    await tap('#playtest [data-choice-index="0"]');
    await page.locator('#divers.portrait-only').waitFor({ state: 'visible' });
    await tap('#divers button:nth-child(2)');
    assert.equal(await page.evaluate(() => urchinDebug.world.selectedDiverId), 1);
    const preset = await page.evaluate(() => JSON.stringify(urchinDebug.world.career.assists));
    await tap('#touchHudToggle');
    assert(!(await page.locator('#diverPanel').isVisible()));
    await tap('#touchHudToggle');
    assert(await page.locator('#diverPanel').isVisible());
    assert.equal(
      await page.evaluate(() => JSON.stringify(urchinDebug.world.career.assists)),
      preset,
    );
    await shot('sea');
    await page.evaluate(() => urchinDebug.ui.open('settings'));
    await action('ui-scale');
    for (let i = 0; i < 6; i++) await action('ui-smaller');
    assert.match(await page.locator('[data-action="ui-smaller"]').textContent(), /50%/);
    await tap('.screen-back');
    await action('touch-options');
    await action('touch-smaller');
    await action('touch-smaller');
    await page.waitForFunction(() =>
      document.querySelector('[data-action="touch-smaller"]').textContent.includes('90%'),
    );
    await shot('settings-50');
    await tap('.screen-back');
    await action('bindings');
    await tap('[data-binding-view="keyboard"]');
    const mapping = await page.evaluate(() => JSON.stringify(urchinDebug.input.map));
    await tap('[data-key="KeyL"]');
    await page.locator('.binding-picker').waitFor({ state: 'visible' });
    assert((await page.locator('[data-assign-action]').count()) > 25);
    await tap('.binding-picker > button');
    assert.equal(await page.evaluate(() => JSON.stringify(urchinDebug.input.map)), mapping);
    await tap('[data-key="Digit8"]');
    await tap('[data-assign-action="quickOrders"]');
    await page.waitForFunction(() => !urchinDebug.ui.bindingPicker);
    assert(await page.evaluate(() => urchinDebug.input.map.quickOrders.includes('Digit8')));
    await tap('[data-key="KeyW"]');
    const beforeConflict = await page.evaluate(() => JSON.stringify(urchinDebug.input.map));
    await tap('[data-assign-action="work"]');
    assert.match(await page.locator('.binding-picker > p').textContent(), /already controls/);
    assert.equal(await page.evaluate(() => JSON.stringify(urchinDebug.input.map)), beforeConflict);
    await tap('.binding-picker > button');
    await shot('bindings');
    await page.evaluate(() => urchinDebug.ui.open('settings'));
    await page.locator('[data-action="touch-options"]').click();
    await page.setViewportSize({ width: 360, height: 780 });
    for (let i = 0; i < 12; i++) await action('touch-larger');
    await page.waitForFunction(() =>
      document.querySelector('[data-action="touch-larger"]').textContent.includes('150%'),
    );
    await page.evaluate(() => urchinDebug.ui.open(null));
    await page.waitForTimeout(200);
    const controls = await page.locator('#touchControls [data-touch]').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { label: e.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
    );
    assert(
      controls.every((r) => r.left >= 0 && r.right <= 360 && r.top >= 0 && r.bottom <= 728),
      JSON.stringify(controls),
    );
    await shot('portrait-large-controls');
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.input);
    assert(await page.evaluate(() => urchinDebug.input.map.quickOrders.includes('Digit8')));
    assert.equal(await page.evaluate(() => localStorage.getItem('urchin-touch-scale-v1')), '150');
    assert.equal(await page.evaluate(() => localStorage.getItem('urchin-ui-scale-v1')), '50');
    assert.deepEqual(errors, []);
    writeFileSync(
      `test-results/s22-latest-${engine}.json`,
      JSON.stringify({ records, errors, passed: true }, null, 2),
    );
  } finally {
    await shot('last-state');
    await context.close();
  }
}
