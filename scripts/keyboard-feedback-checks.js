import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEFAULTS } from '../src/input.js';

export async function keyboardFeedbackChecks(browser) {
  const name = browser.browserType().name();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.keyboardEvents = [];
    for (const type of ['keydown', 'keyup'])
      window.addEventListener(type, (e) => {
        window.keyboardEvents.push({
          type,
          code: e.code,
          key: e.key,
          shift: e.shiftKey,
          alt: e.altKey,
          ctrl: e.ctrlKey,
          prevented: e.defaultPrevented,
          repeat: e.repeat,
        });
        window.keyboardEvents = window.keyboardEvents.slice(-40);
      });
  });
  const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/';
  mkdirSync('test-results', { recursive: true });
  const shot = (label) => page.screenshot({ path: `test-results/keyboard-${name}-${label}.png` });
  const screen = (value) => page.waitForFunction((value) => urchinDebug.ui.screen === value, value);
  const released = () => page.waitForFunction(() => !urchinDebug.input.suppressed);
  try {
    await page.goto(base + '?practice=1');
    await page.locator('#keyboardFallback').click();
    await screen(null);
    await released();
    await page.keyboard.press('F2');
    await screen('bindings');
    assert.equal(await page.locator('.keyboard-diagram').count(), 1);
    assert.equal(await page.locator('.controller-diagrams svg').count(), 0);
    assert.equal(await page.locator('.binding-row select').count(), Object.keys(DEFAULTS).length);
    const keys = await page
      .locator('.keycap.bound')
      .evaluateAll((caps) => caps.map((e) => e.dataset.key));
    for (const code of new Set(
      Object.values(DEFAULTS)
        .flat()
        .filter((c) => !/^(b\d+|a\d+[+-])$/.test(c)),
    ))
      assert(keys.includes(code), `${code} visible on keyboard`);
    const before = await page.evaluate(() => structuredClone(urchinDebug.input.map));
    for (const view of ['controller', 'deck', 'keyboard']) {
      await page.locator(`[data-binding-view=${view}]`).click();
      await page.waitForFunction((view) => urchinDebug.ui.bindingView === view, view);
      await page.locator(`[data-binding-view=${view}][aria-pressed=true]`).waitFor();
      assert.equal(await page.locator('.keyboard-diagram').count(), view === 'keyboard' ? 1 : 0);
      assert.equal(
        await page.locator('.controller-diagrams svg').count(),
        view === 'keyboard' ? 0 : 1,
      );
      await shot(view);
    }
    assert.deepEqual(
      await page.evaluate(() => urchinDebug.input.map),
      before,
      'view changes do not remap controls',
    );
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 1024, height: 640 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(120);
      const layout = await page.evaluate(() => {
        const left = document.querySelector('.controller-diagrams');
        const right = document.querySelector('.bindings-panel .choices');
        const a = left.getBoundingClientRect(),
          b = right.getBoundingClientRect();
        return {
          split: a.right <= b.left,
          overflow: document.body.scrollWidth > innerWidth,
          diagramClipped: left.scrollWidth > left.clientWidth + 1,
          keysBelowPanel:
            document.querySelector('.keyboard-diagram').getBoundingClientRect().bottom >
            a.bottom + 1,
        };
      });
      assert(
        layout.split && !layout.overflow && !layout.diagramClipped && !layout.keysBelowPanel,
        JSON.stringify(layout),
      );
      await shot(`keyboard-${viewport.width}`);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByLabel('Increase throttle keyboard binding', { exact: true })
      .selectOption('KeyZ');
    await page.waitForFunction(() => urchinDebug.input.map.throttleUp.includes('KeyZ'));
    await page.waitForFunction(() =>
      document.querySelector('[data-key=KeyZ]').textContent.includes('Throttle up'),
    );
    await shot('remapped');
    await page
      .getByLabel('Centre rudder keyboard binding', { exact: true })
      .selectOption('capture');
    await page.waitForFunction(
      () => urchinDebug.input.capture && !urchinDebug.input.capture.waitRelease,
    );
    await page.keyboard.press('k');
    await page.waitForFunction(
      () => !urchinDebug.input.capture && urchinDebug.input.map.centerRudder.includes('KeyK'),
    );
    await page.getByLabel('Increase throttle keyboard binding', { exact: true }).focus();
    await page.keyboard.press('Escape');
    await screen(null);
    await released();
    await page.reload();
    await page.locator('#keyboardFallback').click();
    await released();
    assert(await page.evaluate(() => urchinDebug.input.map.throttleUp.includes('KeyZ')));
    await page.keyboard.press('F2');
    await screen('bindings');
    await page.getByRole('button', { name: 'Reset to Defaults · Keyboard', exact: true }).click();
    await page.waitForFunction(() => urchinDebug.input.map.throttleUp.includes('KeyW'));
    await page.keyboard.press('Escape');
    await screen(null);
    await released();
    for (const [key, field, sign] of [
      ['w', 'throttle', 1],
      ['s', 'throttle', -1],
      ['a', 'steer', -1],
      ['d', 'steer', 1],
      ['q', 'pivot', -1],
      ['e', 'pivot', 1],
      ['CapsLock', 'thruster', -1],
      ['f', 'thruster', 1],
      ['ArrowLeft', 'thruster', -1],
      ['ArrowRight', 'thruster', 1],
      ['ArrowUp', 'pivot', -1],
      ['ArrowDown', 'pivot', 1],
    ]) {
      await page.keyboard.down(key);
      await page.waitForFunction(
        ({ field, sign }) => urchinDebug.input.resolved[field] * sign > 0,
        { field, sign },
      );
      await page.keyboard.up(key);
      await page.waitForFunction((field) => !urchinDebug.input.resolved[field], field);
    }
    for (const key of ['x', 'Space']) {
      await page.waitForFunction(() => !urchinDebug.input.raw.neutral);
      await page.evaluate(() => {
        urchinDebug.world.boat.throttle = 0.5;
        urchinDebug.world.boat.rudder = 0.5;
      });
      await page.keyboard.press(key);
      await page.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
      assert.equal(await page.evaluate(() => urchinDebug.world.boat.rudder), 0.5);
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => urchinDebug.world.boat.rudder === 0);
    const diver = await page.evaluate(() => urchinDebug.world.selectedDiverId);
    await page.keyboard.press('Tab');
    await page.waitForFunction((old) => urchinDebug.world.selectedDiverId !== old, diver);
    await page.keyboard.press('Tab');
    await page.keyboard.press('1');
    await page.waitForFunction(() => urchinDebug.world.diver.state !== 'ready');
    await page.keyboard.press('Escape');
    await screen('pause');
    await page.getByRole('button', { name: 'Controls / Remapping', exact: true }).click();
    await screen('bindings');
    await page.keyboard.press('Escape');
    await screen(null);
    await released();
    const url = page.url();
    for (const key of [
      'F1',
      'F5',
      'F6',
      'F7',
      'F10',
      'F11',
      'F12',
      '/',
      "'",
      'Home',
      'End',
      'Backspace',
    ]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(70);
      assert.equal(page.url(), url, key);
      assert.equal(context.pages().length, 1, key);
      assert(await page.evaluate(() => document.hasFocus()), key);
      // F6 is a retained in-game shortcut. Close any resulting game menu.
      if (await page.evaluate(() => !!urchinDebug.ui.screen)) {
        await page.keyboard.press('Escape');
        await screen(null);
        await released();
      }
    }
    await shot('water');
    await page.goto(base);
    await page.locator('#keyboardFallback').click();
    await screen('intro');
    await page.getByRole('button', { name: /Skip day 0/ }).click();
    await screen('starter');
    await page.getByRole('button', { name: /Choose Harbour Workhorse/ }).click();
    await page.locator('[data-action="buy-selected"]').click();
    await screen('purchase');
    await page.locator('[data-action="confirm-purchase"]').click();
    await screen('harbour');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Controls / Remapping', exact: true }).click();
    await screen('bindings');
    await page.getByLabel('Increase throttle keyboard binding', { exact: true }).focus();
    await page.keyboard.press('Escape');
    await screen('harbour');
    await released();
    await page.keyboard.press('Escape');
    await screen('pause');
    await released();
    await page.keyboard.press('Escape');
    await screen('harbour');
    await shot('harbour');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).click();
    await page.getByRole('button', { name: 'Touchscreen mode: OFF', exact: true }).click();
    await page.getByRole('button', { name: 'Touchscreen mode: ON', exact: true }).waitFor();
    await released();
    await page.keyboard.press('Escape');
    await screen('harbour');
    await page.locator('#touchFullscreen').click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await released();
    await page.keyboard.press('Escape');
    await screen('pause');
    const fullscreen = {
      browser: name,
      version: browser.version(),
      keptFullscreenAfterEscape: await page.evaluate(() => !!document.fullscreenElement),
      stayedInGame: page.url() === base,
    };
    assert(fullscreen.stayedInGame);
    writeFileSync(
      `test-results/keyboard-${name}-fullscreen.json`,
      JSON.stringify(fullscreen, null, 2),
    );
    await shot('fullscreen-escape');
    assert.deepEqual(errors, []);
    console.log(
      `PASS: ${name} keyboard defaults, one-device diagrams, split layout, remap persistence, separate neutral commands, Escape at water/harbour/from dropdowns, and browser key protection.`,
    );
  } catch (error) {
    writeFileSync(
      `test-results/keyboard-${name}-failure.json`,
      JSON.stringify(
        await page.evaluate(() => ({
          events: window.keyboardEvents,
          map: urchinDebug.input.map,
          raw: urchinDebug.input.raw,
          resolved: urchinDebug.input.resolved,
          screen: urchinDebug.ui.screen,
          lock: urchinDebug.ui.lockReason,
          focused: document.activeElement?.tagName,
        })),
        null,
        2,
      ),
    );
    await shot('failure');
    throw error;
  } finally {
    await context.close();
  }
}
