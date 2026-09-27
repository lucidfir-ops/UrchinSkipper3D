import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

export async function hudWindowChecks(browser) {
  const engine = browser.browserType().name(),
    context = await browser.newContext({ viewport: { width: 780, height: 360 }, hasTouch: true }),
    page = await context.newPage(),
    errors = [],
    records = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) =>
      page.screenshot({ path: `test-results/hud-windows-${engine}-${name}.png` }),
    tap = (selector) => page.locator(selector).tap(),
    screen = async (name) => {
      await page.waitForFunction((name) => urchinDebug.ui.screen === name, name);
      await page.locator('#playtest').waitFor({ state: name ? 'visible' : 'hidden' });
    };
  const resize = async (id, dx, dy, finger = false) => {
    const box = await page.locator(`[data-resize-window="${id}"]`).boundingBox();
    assert(box, `${id} has a visible grip`);
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    if (finger) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + (dx * i) / 8, y: y + (dy * i) / 8 }],
        });
        await page.waitForTimeout(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 8 });
      await page.mouse.up();
    }
    await page.waitForTimeout(180);
  };
  const scroll = async (id, finger = false) => {
    const panel = page.locator(`#${id}`),
      box = await panel.boundingBox();
    await panel.evaluate((el) => {
      el.scrollTop = 0;
    });
    if (finger) {
      const cdp = await context.newCDPSession(page),
        x = box.x + box.width / 2,
        y = box.y + box.height - Math.min(16, box.height / 4);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: y - (Math.max(60, box.height - 30) * i) / 8 }],
        });
        await page.waitForTimeout(30);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 400);
    }
    await page.waitForFunction((id) => document.getElementById(id).scrollTop > 15, id);
    await page.waitForTimeout(400);
    assert(await panel.evaluate((el) => el.scrollTop > 15), 'live HUD updates preserve scrolling');
  };
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await tap('[data-touch-options]');
    await tap('[data-action="touchscreen"]');
    await tap('.screen-back');
    await tap('#keyboardFallback');
    await screen('intro');
    await tap('#playtest [data-choice-index="0"]');
    await screen(null);
    assert.equal(await page.locator('#touchLockToggle').textContent(), 'Adjust UI: OFF');
    assert.equal(
      await page.locator('.hud-resize:visible,.hud-move:visible,.hud-close:visible').count(),
      0,
      'touch manipulation is locked by default',
    );
    await tap('#touchLockToggle');
    assert.equal(await page.locator('#touchLockToggle').textContent(), 'Adjust UI: ON');
    await page.waitForFunction(() => document.querySelector('.hud-resize:not([hidden])'));
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.intro.step = 6;
      w.divers.forEach((d, i) =>
        Object.assign(d, {
          state: 'surface',
          x: w.boat.x - 10 - i * 5,
          y: w.boat.y - 5,
          bag: 20,
          depth: 0,
        }),
      );
    });
    for (const viewport of [
      { width: 780, height: 360 },
      { width: 360, height: 780 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(250);
      assert(await page.locator('#helmPanel').isVisible(), 'boat card remains in the lesson');
      const readings = await page.locator('#hud').textContent();
      for (const text of ['kn', 'm', 'Rudder', 'Fuel', 'Hull', 'Drive'])
        assert(readings.includes(text), `boat card includes ${text}`);
      const helm = await page.locator('#helmPanel').boundingBox();
      const before = await page.locator('#frankAboard').boundingBox();
      assert(
        helm.x + helm.width <= before.x ||
          helm.y + helm.height <= before.y ||
          before.y + before.height <= helm.y,
        'default boat card and Frank do not overlap',
      );
      await shot(`lesson-cards-${viewport.width}`);
      if (viewport.width === 780) {
        await tap('#touchLockToggle');
        assert.equal(
          await page.locator('.hud-resize:visible,.hud-move:visible,.hud-close:visible').count(),
          0,
          'Lock Screen hides every live manipulation control',
        );
        await tap('#touchLockToggle');
      }
      await resize('frankAboard', -30, -55, engine === 'chromium');
      const after = await page.locator('#frankAboard').boundingBox();
      assert(after.width < before.width - 20 && after.height < before.height - 35);
      await scroll('frankAboard', engine === 'chromium');
      await shot(`lesson-scroll-${viewport.width}`);
      await tap('#touchHudToggle');
      assert(await page.locator('#frankAboard').isHidden());
      assert(await page.locator('#helmPanel').isHidden());
      assert.equal(await page.locator('#touchHudToggle').textContent(), 'Show UI');
      await page.waitForFunction(() => urchinDebug.visuals.lessonCues.every((c) => !c.visible));
      assert(await page.locator('[data-touch="recoverDiver"]').isVisible());
      assert(await page.locator('#touchMenu').isVisible());
      const time = await page.evaluate(() => urchinDebug.world.time);
      await tap('[data-touch="fullAhead"]');
      await page.waitForFunction(() => urchinDebug.world.boat.throttle > 0.1);
      await tap('[data-touch="neutral"]');
      await page.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
      assert(await page.evaluate((time) => urchinDebug.world.time > time, time));
      await shot(`lesson-hidden-${viewport.width}`);
      await tap('#touchMenu');
      await screen('intropause');
      assert(await page.locator('#playtest').isVisible());
      await tap('#playtest [data-choice-index="0"]');
      await screen(null);
      assert(await page.locator('#frankAboard').isHidden());
      await tap('#touchHudToggle');
      assert(await page.locator('#frankAboard').isVisible());
      assert(await page.locator('#helmPanel').isVisible());
      assert.equal(await page.evaluate(() => urchinDebug.world.career.intro.step), 6);
      assert.equal((await page.locator('#frankAboard').boundingBox()).width, after.width);
      records.push({ viewport, lesson: 'scroll, resize, hide, controls, menu, restore' });
    }
    // Finish the tutorial through its real action, then launch a funded career.
    await tap('[data-intro="skip"]');
    await screen('starter');
    await tap('[data-action="starter-basic"]');
    await tap('[data-action="buy-selected"]');
    await screen('purchase');
    await tap('[data-action="confirm-purchase"]');
    await screen('harbour');
    await tap('[data-action="chart"]');
    await screen('chart');
    await tap('#playtest [data-choice-index="0"]');
    await screen('departure');
    await tap('[data-action="sail"]');
    await screen(null);
    for (const viewport of [
      { width: 780, height: 360 },
      { width: 360, height: 780 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        Object.assign(urchinDebug.world.career.assists, {
          speedGauge: true,
          throttleGauge: true,
          fuelGauge: true,
        });
      });
      await page.waitForFunction(() =>
        ['speedPanel', 'throttlePanel', 'fuelPanel'].every(
          (id) => !document.getElementById(id).hidden,
        ),
      );
      for (const id of ['speedPanel', 'throttlePanel', 'fuelPanel']) {
        assert(await page.locator(`#${id}`).isVisible(), `${id} is independently visible`);
        assert(
          await page.evaluate((id) => urchinDebug.ui.hudWindows.windows.has(id), id),
          `${id} participates in the independent window manager`,
        );
      }
      await page.evaluate(() => {
        urchinDebug.world.career.assists.helmOverlay = false;
      });
      await page.waitForFunction(() => document.querySelector('#hud').hidden);
      assert(
        await page.locator('#speedPanel').isVisible(),
        'separate gauges survive a hidden card',
      );
      await page.evaluate(() => {
        urchinDebug.world.career.assists.helmOverlay = true;
      });
      await page.waitForFunction(() => !document.querySelector('#hud').hidden);
      await page.evaluate(() => {
        while (!document.querySelector('[data-ui-scale]').textContent.includes('150%'))
          urchinDebug.ui.titleAction('scale');
      });
      await resize('diverPanel', 25, -70, engine === 'chromium');
      // Compact nitrogen/readiness cards are separate from the boat instruments.
      assert.equal(await page.locator('#helmPanel #divers').count(), 0);
      assert.equal(await page.locator('#diverPanel .nitrogen-bar').count(), 2);
      await shot(`helm-scroll-${viewport.width}`);
      // The right-anchored instrument grip expands toward the left.
      const instrumentBefore = await page.locator('#electronics').boundingBox();
      await resize('electronics', 35, 30);
      assert(
        (await page.locator('#electronics').boundingBox()).width > instrumentBefore.width + 20,
      );
      await tap('#touchHudToggle');
      for (const id of ['helmPanel', 'diverPanel', 'message', 'clock', 'electronics', 'navigation'])
        assert(await page.locator(`#${id}`).isHidden(), id);
      await shot(`sea-hidden-${viewport.width}`);
      await tap('#touchHudToggle');
      assert(await page.locator('#helmPanel').isVisible());
      records.push({
        viewport,
        scale: 150,
        sea: 'last diver reachable, right anchor resize, hide and restore',
      });
    }
    // Desktop customization now uses the paused layout editor, with no live grips.
    await page.evaluate(() => urchinDebug.ui.touch.setEnabled(false));
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.waitForTimeout(250);
    assert(await page.locator('#touchHudToggle').isHidden());
    assert.equal(
      await page.locator('.hud-resize:visible,.hud-move:visible,.hud-close:visible').count(),
      0,
    );
    const edit = async () => {
      await tap('#touchMenu');
      await screen('pause');
      await page.getByRole('button', { name: 'Arrange UI layout', exact: true }).click();
      await screen('layout');
      await page.locator('[data-action="layout-helmPanel"]').click();
    };
    const save = async () => {
      await page.locator('[data-action="layout-save"]').click();
      await screen('pause');
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await screen(null);
    };
    await edit();
    await page.locator('[data-action="layout-size"]').click();
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    const widthBefore = await page.evaluate(
      () => urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'helmPanel').rect.width,
    );
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      (width) =>
        urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'helmPanel').rect.width > width,
      widthBefore,
    );
    for (let i = 0; i < 7; i++) await page.locator('[data-layout-adjust="up"]').click();
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.thruster), 0);
    await page.locator('[data-layout-adjust="finish"]').click();
    await save();
    await page.waitForFunction(() =>
      document.querySelector('#helmPanel').hasAttribute('data-window-sized'),
    );
    await scroll('helmPanel');
    await edit();
    await page.locator('[data-action="layout-reset"]').click();
    await save();
    await page.waitForFunction(
      () => !document.querySelector('#helmPanel').hasAttribute('data-window-sized'),
    );
    await shot('desktop');
    assert.deepEqual(errors, []);
    writeFileSync(
      `test-results/hud-windows-${engine}.json`,
      JSON.stringify({ engine, records, errors }, null, 2),
    );
    console.log(`HUD windows passed: ${engine}`);
  } catch (error) {
    await shot('failure');
    throw error;
  } finally {
    await context.close();
  }
}
