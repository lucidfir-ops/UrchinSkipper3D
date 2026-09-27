import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

export async function chartLayoutChecks(browser) {
  const engine = browser.browserType().name(),
    page = await browser.newPage({ viewport: { width: 1728, height: 1117 }, hasTouch: true }),
    errors = [],
    records = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  const screen = (name) => page.waitForFunction((name) => urchinDebug.ui.screen === name, name);
  const action = (id) => page.locator(`[data-action="${id}"]`).click();
  const pad = (id) => pressAction(page, 'chartPad', id);
  const choose = (label) => chooseController(page, pad, label);
  const inspect = async (label, touch = false) => {
    await page.waitForTimeout(150);
    const rects = await page.evaluate(() => {
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      };
      const surface = document.querySelector('.sector-picture :is(canvas, svg)'),
        picture = surface.parentElement;
      return {
        panel: box(document.querySelector('#playtest')),
        canvas: box(surface),
        tag: surface.tagName,
        picture: box(picture),
        background: getComputedStyle(picture).backgroundImage,
        caption: box(picture.querySelector('.map-caption')),
        viewport: { width: innerWidth, height: innerHeight },
        back: box(document.querySelector('.screen-back')),
      };
    });
    assert.equal(rects.background, 'none');
    assert(
      Math.abs(rects.canvas.width - rects.canvas.height) < 2,
      'map stays square for accurate chart selection',
    );
    assert(rects.canvas.width / rects.picture.width > 0.85, 'map fills its column');
    assert(rects.back.x >= 0 && rects.back.right <= rects.viewport.width, 'Back remains reachable');
    assert(rects.canvas.right <= rects.panel.right + 1);
    if (!touch) {
      assert(rects.panel.width / rects.viewport.width < 0.9, 'large-screen window is bounded');
      assert(
        Math.abs(rects.panel.x - (rects.viewport.width - rects.panel.width) / 2) < 2,
        'window stays centered',
      );
      assert(rects.caption.bottom <= rects.panel.bottom - 12, 'caption fits above footer');
      if (rects.viewport.width >= 1700)
        assert(rects.canvas.width > 480, 'large-screen chart exceeds old cap');
    }
    records.push({ label, ...rects });
    await page.screenshot({ path: `test-results/chart-layout-${engine}-${label}.png` });
  };
  try {
    await page.addInitScript(gamepadScript, { name: 'chartPad', id: 'Chart Layout Xbox' });
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.locator('#keyboardFallback').click();
    await screen('intro');
    await choose('Skip day 0');
    await screen('starter');
    await action('starter-basic');
    await action('buy-selected');
    await screen('purchase');
    await action('confirm-purchase');
    await screen('harbour');
    await action('chart');
    await page.locator('#playtest [data-choice-index="0"]').click();
    await screen('departure');
    for (const [width, height] of [
      [1728, 1117],
      [1920, 1080],
      [1280, 800],
      [1024, 640],
    ]) {
      await page.setViewportSize({ width, height });
      await inspect(`desktop-${width}`);
    }
    await page.setViewportSize({ width: 1728, height: 1117 });
    for (const scale of [0.5, 1.5]) {
      await page.evaluate(
        (s) => document.documentElement.style.setProperty('--ui-scale', s),
        scale,
      );
      await inspect(`scale-${scale * 100}`);
    }
    await page.evaluate(() => document.documentElement.style.setProperty('--ui-scale', 1));
    // Controller chart selection and Back use the actual focus and input routes.
    await choose('Local Chart');
    await screen('knowledge');
    await inspect('knowledge');
    await page.locator('[data-chart-mode="vector"]').click();
    await page.waitForTimeout(120);
    const vector = await page.evaluate(() => {
      const panel = document.querySelector('#playtest').getBoundingClientRect(),
        surface = document.querySelector('.sector-picture :is(canvas, svg)');
      return { panelWidth: panel.width, viewportWidth: innerWidth, tag: surface.tagName };
    });
    assert(
      vector.panelWidth / vector.viewportWidth > 0.94,
      'vector chart uses the available screen',
    );
    assert.equal(
      vector.tag,
      'svg',
      'vector chart is scalable SVG geometry, not a stretched canvas',
    );
    await page.screenshot({ path: `test-results/chart-layout-${engine}-vector.png` });
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    await pad('back');
    await screen('departure');
    await page.keyboard.press('Backspace');
    await screen('chart');
    await page.keyboard.press('Backspace');
    await screen('harbour');
    // Existing touchscreen page scrolling still reaches charts and departure actions.
    await page.evaluate(() => urchinDebug.ui.touch.setEnabled(true));
    await action('chart');
    await page.locator('#playtest [data-choice-index="0"]').click();
    await screen('departure');
    for (const [width, height] of [
      [780, 360],
      [360, 780],
    ]) {
      await page.setViewportSize({ width, height });
      await inspect(`touch-${width}`, true);
      await page.locator('[data-action="sail"]').scrollIntoViewIfNeeded();
      assert(await page.locator('[data-action="sail"]').isVisible());
      await page.locator('.screen-back').scrollIntoViewIfNeeded();
    }
    assert.deepEqual(errors, []);
    writeFileSync(
      `test-results/chart-layout-${engine}.json`,
      JSON.stringify({ errors, records }, null, 2),
    );
    console.log(
      `${engine}: responsive chart sizing, scales, controller/keyboard Back and touch scrolling passed`,
    );
  } finally {
    await page.close();
  }
}
