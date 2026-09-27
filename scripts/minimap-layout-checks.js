import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

export async function minimapLayoutChecks(browser) {
  const engine = browser.browserType().name(),
    page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true }),
    errors = [],
    records = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  const screen = (name) => page.waitForFunction((name) => urchinDebug.ui.screen === name, name),
    action = (id) => page.locator(`[data-action="${id}"]`).click(),
    pad = (id) => pressAction(page, 'layoutPad', id),
    choose = (prefix) => chooseController(page, pad, prefix),
    ready = () => page.waitForFunction(() => !urchinDebug.input.suppressed),
    rect = () =>
      page.evaluate(() => ({
        ...urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'minimapPanel').rect,
      })),
    shot = (name) => page.screenshot({ path: `test-results/minimap-layout-${engine}-${name}.png` });
  try {
    await page.addInitScript(gamepadScript, { name: 'layoutPad', id: 'UI Layout Xbox' });
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.locator('#keyboardFallback').click();
    await screen('intro');
    await page.locator('[data-choice-index="0"]').click();
    await screen(null);
    await page.waitForFunction(() => urchinDebug.ui.hudWindows?.windows.has('minimapPanel'));
    assert(await page.locator('#minimapPanel').isVisible());
    assert(await page.locator('#sounderPanel').isVisible());
    await page.evaluate(() => {
      urchinDebug.ui.chartMode = 'vector';
    });
    await page.waitForFunction(
      () =>
        document.querySelector('#minimapPanel .sector-chart-vector:not([hidden])')?.viewBox.baseVal
          .width > 0,
    );
    assert.equal(
      await page.locator('#minimapPanel .sector-chart-vector').evaluate((el) => el.tagName),
      'svg',
    );
    await page.evaluate(() => {
      urchinDebug.ui.chartMode = 'raster';
    });
    assert.equal(
      await page.locator('.hud-resize:visible,.hud-move:visible,.hud-close:visible').count(),
      0,
    );
    // Actual chart use advances the existing chart lesson; the minimap opens it.
    await page.evaluate(() => {
      urchinDebug.world.career.intro.step = 3;
    });
    await page.waitForFunction(() =>
      document.querySelector('#frankAboard').textContent.includes('pink crosses'),
    );
    await shot('desktop-water');
    await page.locator('#minimapPanel .minimap-chart').click();
    await screen('introchart');
    assert.match(await page.locator('#playtest').textContent(), /unmarked rocks|Unmarked rocks/);
    await ready();
    await pad('back');
    await screen(null);
    await page.waitForFunction(() => urchinDebug.world.career.intro.step === 4);
    await ready();
    await pad('pause');
    await screen('intropause');
    await choose('UI / difficulty options');
    await screen('assists');
    for (const id of [
      'assist-minimap',
      'assist-sounder',
      'assist-speedGauge',
      'assist-throttleGauge',
      'assist-fuelGauge',
    ])
      assert(await page.locator(`[data-action="${id}"]`).isVisible(), `${id} is selectable`);
    await action('assist-speedGauge');
    await action('assist-throttleGauge');
    await action('assist-fuelGauge');
    await action('assist-helmOverlay');
    await page.waitForFunction(() => !urchinDebug.world.career.assists.helmOverlay);
    await action('assist-minimap');
    await page.waitForFunction(() => !urchinDebug.world.career.assists.minimap);
    await page.keyboard.press('Escape');
    await screen(null);
    await page.waitForFunction(
      () => document.querySelector('#minimapPanel').hidden && document.querySelector('#hud').hidden,
    );
    assert(
      await page.locator('#sounderPanel').isVisible(),
      'sounder is independent of helm/minimap',
    );
    for (const id of ['speedPanel', 'throttlePanel', 'fuelPanel'])
      assert(
        await page.locator(`#${id}`).isVisible(),
        `${id} is independent of the instruments card`,
      );
    await ready();
    await pad('pause');
    await screen('intropause');
    await choose('UI / difficulty options');
    await screen('assists');
    await choose('Arrange UI layout');
    await screen('layout');
    assert.equal(await page.locator('.layout-card').count(), 16);
    assert(await page.locator('.layout-controls-card').isVisible());
    assert(await page.locator('.layout-elements-card').isVisible());
    assert.match(await page.locator('[data-action="layout-screen-lock"]').textContent(), /ON/);
    await action('layout-screen-lock');
    assert.match(await page.locator('[data-action="layout-screen-lock"]').textContent(), /OFF/);
    await action('layout-screen-lock');
    assert(
      await page.locator('[data-layout-window="minimapPanel"]').isVisible(),
      'hidden windows remain selectable',
    );
    await choose('Chart minimap');
    const before = await rect(),
      time = await page.evaluate(() => urchinDebug.world.time);
    await choose('Move selected');
    await ready();
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(
      (left) =>
        urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'minimapPanel').rect.left < left,
      before.left,
    );
    await page.keyboard.press('ArrowUp');
    const afterKeys = await rect();
    await page.evaluate(() => {
      window.layoutPad.axes[0] = -0.8;
    });
    await page.waitForFunction(
      (left) =>
        urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'minimapPanel').rect.left < left,
      afterKeys.left,
    );
    await page.evaluate(() => {
      window.layoutPad.axes[0] = 0;
    });
    await pad('confirm');
    await choose('Resize selected');
    await ready();
    await pad('menuLeft');
    await pad('menuUp');
    await pad('confirm');
    const changed = await rect();
    assert(changed.width < before.width && changed.height < before.height);
    await choose('Show selected');
    await shot('desktop-editor');
    assert.equal(
      await page.evaluate(() => urchinDebug.world.time),
      time,
      'layout space pauses simulation',
    );
    await choose('Save layout');
    await screen('assists');
    const saved = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('urchin-hud-layout-v1')).minimapPanel['desktop:landscape'],
    );
    records.push({ before, changed, saved });
    assert.deepEqual(saved, changed);
    await page.keyboard.press('Escape');
    await screen(null);
    await page.waitForFunction(() => !document.querySelector('#minimapPanel').hidden);
    const live = await page.locator('#minimapPanel').boundingBox();
    assert(Math.abs(live.x - changed.left) < 2 && Math.abs(live.width - changed.width) < 2);
    await shot('custom-water');
    // Save survives reload; Back discards an additional change.
    await page.reload();
    await page.locator('#keyboardFallback').click();
    await screen(null);
    await page.waitForFunction(() => urchinDebug.ui.hudWindows?.windows.has('minimapPanel'));
    const reloaded = await page.locator('#minimapPanel').boundingBox();
    assert(Math.abs(reloaded.x - saved.left) < 2 && Math.abs(reloaded.width - saved.width) < 2);
    await ready();
    await pad('pause');
    await screen('intropause');
    await choose('Settings');
    await screen('settings');
    await choose('Arrange UI layout');
    await screen('layout');
    const previewCard = page.locator('[data-layout-window="minimapPanel"]');
    await previewCard.click();
    await action('layout-reset');
    assert.equal(
      await page.evaluate(
        () => urchinDebug.ui.layoutEditor.rows[urchinDebug.ui.layoutEditor.selected].id,
      ),
      'minimapPanel',
      'clicking the preview selects the window',
    );
    assert(await page.locator('[data-action="layout-move"]').isVisible());
    const preview = await previewCard.boundingBox();
    await page.mouse.move(preview.x + preview.width / 2, preview.y + preview.height / 2);
    await page.mouse.down();
    await page.mouse.move(preview.x + preview.width / 2 - 40, preview.y + preview.height / 2 - 20, {
      steps: 6,
    });
    await page.mouse.up();
    await page.waitForFunction(() => {
      const row = urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'minimapPanel');
      return row.rect.left < row.defaults.left;
    });
    await page.keyboard.press('Backspace');
    await screen('settings');
    assert.deepEqual(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('urchin-hud-layout-v1')).minimapPanel[
            'desktop:landscape'
          ],
      ),
      saved,
    );
    await page.keyboard.press('Escape');
    await screen(null);
    // Local sounding over a barely visible charted rock agrees with the collision surface.
    await ready();
    await pad('pause');
    await screen('intropause');
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
    await action('sail');
    await screen('purchase');
    await action('confirm-purchase');
    await screen(null);
    await page.waitForFunction(() => urchinDebug.world.rocks?.length === 40);
    await page.evaluate(() => {
      const w = urchinDebug.world,
        rock = w.rocks.find((r) => r.charted && r.topDepth > 0);
      w.boat.x = rock.x;
      w.boat.y = rock.y;
      w.boat.vx = w.boat.vy = 0;
      w.boat.throttle = 0;
      window.layoutRock = rock;
    });
    await page.waitForTimeout(200);
    const depth = await page.evaluate(() => ({
      readout: parseFloat(document.querySelector('#sounderPanel output').textContent),
      expected: Math.max(
        0,
        window.layoutRock.topDepth + (urchinDebug.world.environment.seaLevel || 0),
      ),
    }));
    assert(Math.abs(depth.readout - depth.expected) < 0.11, JSON.stringify(depth));
    // Touch keeps live handles, separate orientation layouts and usable menu scrolling.
    await page.evaluate(() => urchinDebug.ui.touch.setEnabled(true));
    for (const viewport of [
      { width: 780, height: 360 },
      { width: 360, height: 780 },
    ]) {
      await page.setViewportSize(viewport);
      if (viewport.width === 780) {
        assert.equal(await page.locator('#touchLockToggle').textContent(), 'Lock Screen: ON');
        assert.equal(
          await page.locator('.hud-resize:visible,.hud-move:visible,.hud-close:visible').count(),
          0,
          'touch HUD manipulation starts locked',
        );
        await page.locator('#touchLockToggle').tap();
        assert.equal(await page.locator('#touchLockToggle').textContent(), 'Lock Screen: OFF');
      }
      await page.waitForFunction(
        () => !document.querySelector('[data-resize-window="minimapPanel"]').hidden,
      );
      assert(await page.locator('[data-resize-window="minimapPanel"]').isVisible());
      await page.locator('#touchMenu').click();
      await screen('pause');
      await page.getByRole('button', { name: 'UI / difficulty options', exact: true }).click();
      await screen('assists');
      await action('layout');
      await screen('layout');
      const touchCard = page.locator('.layout-card').last(),
        touchedId = await touchCard.getAttribute('data-layout-window');
      await touchCard.tap();
      assert.equal(
        await page.evaluate(
          () => urchinDebug.ui.layoutEditor.rows[urchinDebug.ui.layoutEditor.selected].id,
        ),
        touchedId,
        'touching a preview card selects it',
      );
      await page
        .locator('[data-action="layout-minimapPanel"]')
        .evaluate((button) => button.click());
      assert.equal(
        await page.evaluate(
          () => urchinDebug.ui.layoutEditor.rows[urchinDebug.ui.layoutEditor.selected].id,
        ),
        'minimapPanel',
      );
      const elementScroll = page.locator('.layout-elements-card'),
        beforeScroll = await rect();
      await elementScroll.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const scrollState = await elementScroll.evaluate((el) => ({
        top: el.scrollTop,
        height: el.clientHeight,
        scrollHeight: el.scrollHeight,
        overflow: getComputedStyle(el).overflowY,
      }));
      const elementsCanScroll = scrollState.scrollHeight > scrollState.height;
      if (elementsCanScroll) assert(scrollState.top > 0, JSON.stringify(scrollState));
      assert.deepEqual(await rect(), beforeScroll, 'scrolling the list does not move the preview');
      assert.equal(
        await page.evaluate(
          () => urchinDebug.ui.layoutEditor.rows[urchinDebug.ui.layoutEditor.selected].id,
        ),
        'minimapPanel',
        'scrolling the list keeps the arranged card selected',
      );
      await action('layout-move');
      await ready();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await action('layout-size');
      await page.locator('[data-layout-adjust="up"]').tap();
      await page.locator('[data-layout-adjust="finish"]').tap();
      await shot(`touch-editor-${viewport.width}`);
      await page.locator('[data-action="layout-save"]').scrollIntoViewIfNeeded();
      await action('layout-save');
      await screen('assists');
      await page.keyboard.press('Escape');
      await screen(null);
      await shot(`touch-water-${viewport.width}`);
    }
    await page.evaluate(() => urchinDebug.ui.touch.setEnabled(false));
    await page.waitForTimeout(200);
    assert.equal(
      await page.locator('.hud-resize:visible,.hud-move:visible,.hud-close:visible').count(),
      0,
    );
    assert.deepEqual(errors, []);
    writeFileSync(
      `test-results/minimap-layout-${engine}.json`,
      JSON.stringify({ errors, records, depth }, null, 2),
    );
    console.log(
      `${engine}: minimap/sounder, tutorial chart, keyboard/controller layout, save/reload/discard and touch orientations passed`,
    );
  } catch (error) {
    await shot('failure');
    writeFileSync(
      `test-results/minimap-layout-${engine}-failure.json`,
      JSON.stringify(
        await page.evaluate(() => ({
          screen: urchinDebug.ui.screen,
          index: urchinDebug.ui.index,
          assists: urchinDebug.world.career.assists,
          hudHidden: document.querySelector('#hud').hidden,
          minimapHidden: document.querySelector('#minimapPanel').hidden,
        })),
        null,
        2,
      ),
    );
    throw error;
  } finally {
    await page.close();
  }
}
