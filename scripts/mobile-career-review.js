import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5186/';
const output = process.env.URCHIN_MOBILE_CAREER_OUTPUT || 'test-results/ui-overhaul/mobile-career';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const results = [],
  captures = [],
  errors = [];
async function screen(page, value) {
  await page.waitForFunction((value) => urchinDebug.ui.screen === value, value);
  await page.waitForTimeout(150);
}
async function tap(page, selector) {
  await page.locator(selector).tap();
  await page.waitForTimeout(140);
}
async function back(page) {
  await page.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
}
async function capture(page, name) {
  await page.screenshot({ path: `${output}/${name}.png`, animations: 'disabled' });
  const measured = await page.evaluate(() => ({
    screen: urchinDebug.ui.screen,
    viewport: { width: innerWidth, height: innerHeight },
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    panel: document.querySelector('#playtest').getBoundingClientRect().toJSON(),
    harbourPan:
      urchinDebug.ui.screen === 'harbour'
        ? {
            left: document.querySelector('#playtest').scrollLeft,
            top: document.querySelector('#playtest').scrollTop,
            cue: document.querySelector('.harbour-pan-cue')?.textContent,
            index: urchinDebug.ui.index,
            focusedChoiceKey: urchinDebug.ui.focusedChoiceKey,
            pendingScroll: urchinDebug.ui.pendingScroll,
            clientWidth: document.querySelector('#playtest').clientWidth,
            clientHeight: document.querySelector('#playtest').clientHeight,
            scrollWidth: document.querySelector('#playtest').scrollWidth,
            scrollHeight: document.querySelector('#playtest').scrollHeight,
            active: {
              text: document.activeElement?.textContent?.slice(0, 150),
              action: document.activeElement?.dataset.action,
              pan: document.activeElement?.dataset.harbourPan,
            },
            heading: document.querySelector('.wharf-heading').getBoundingClientRect().toJSON(),
            controls: document
              .querySelector('.harbour-pan-controls')
              .getBoundingClientRect()
              .toJSON(),
            destinations: [...document.querySelectorAll('.wharf-place')].map((element) => ({
              action: element.dataset.action,
              choice: element.dataset.choiceIndex,
              selected: element.classList.contains('selected'),
              rect: element.getBoundingClientRect().toJSON(),
            })),
          }
        : null,
    undersized: [...document.querySelectorAll('#playtest button:not([hidden])')]
      .map((element) => ({ text: element.textContent.trim(), r: element.getBoundingClientRect() }))
      .filter(({ r }) => r.width && r.height && (r.width < 43.9 || r.height < 43.9))
      .map(({ text, r }) => ({ text, width: r.width, height: r.height })),
  }));
  captures.push({ name, ...measured });
  assert.equal(measured.horizontalOverflow, false, `${name}: page spills horizontally`);
  // Collect target failures without stopping the journey so remaining screens
  // still receive independent visual and interaction review. Layout miniatures
  // have a separate full-size picker and are not menu action targets.
  if (measured.screen !== 'layout' && measured.undersized.length)
    console.log('TARGET DEFECT', name, JSON.stringify(measured.undersized));
}
async function harbourScroll(page) {
  return page.locator('#playtest').evaluate((panel) => ({
    left: panel.scrollLeft,
    top: panel.scrollTop,
  }));
}
async function visibleTarget(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const r = element.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2,
      top = document.elementFromPoint(x, y),
      heading = document.querySelector('.wharf-heading')?.getBoundingClientRect(),
      pan = document.querySelector('.harbour-pan-controls')?.getBoundingClientRect(),
      destination = element.matches('.wharf-place');
    return {
      rect: r.toJSON(),
      visible:
        r.left >= -0.5 &&
        r.right <= innerWidth + 0.5 &&
        r.top >= -0.5 &&
        r.bottom <= innerHeight + 0.5 &&
        (!destination || (r.top >= heading.bottom - 0.5 && r.bottom <= pan.top + 0.5)) &&
        !!top &&
        (top === element || element.contains(top)),
      direction:
        r.left < 0
          ? 'left'
          : r.right > innerWidth
            ? 'right'
            : r.top < (heading?.bottom || 0)
              ? 'up'
              : r.bottom > (pan?.top || innerHeight)
                ? 'down'
                : '',
    };
  });
}
async function tapVisibleHarbour(page, selector) {
  const target = await visibleTarget(page, selector);
  assert(target.visible, `${selector} must be visible before a native coordinate tap`);
  await page.touchscreen.tap(
    target.rect.left + target.rect.width / 2,
    target.rect.top + target.rect.height / 2,
  );
  await page.waitForTimeout(160);
}
async function revealHarbour(page, action) {
  const selector = `[data-action="${action}"]`;
  for (let n = 0; n < 12; n++) {
    const state = await visibleTarget(page, selector);
    if (state.visible) return;
    assert(state.direction, `Harbour ${action} is covered without a usable pan direction`);
    const control = `[data-harbour-pan="${state.direction}"]`,
      button = page.locator(control);
    assert((await visibleTarget(page, control)).visible, `${control} must be visibly reachable`);
    assert(await button.isEnabled(), `${control} cannot reveal Harbour ${action}`);
    await tapVisibleHarbour(page, control);
  }
  assert.fail(`Harbour ${action} could not be reached through visible pan controls`);
}
async function reviewHarbour(page, prefix) {
  // The approved scenic composition deliberately pans on compact displays.
  // Check discoverability and actual controls before Playwright can auto-scroll
  // a hidden destination into view while tapping it.
  const cue = page.locator('.harbour-pan-cue');
  assert(await cue.isVisible(), 'Compact Harbour needs a visible panning cue');
  assert.match(await cue.innerText(), /Swipe.*arrows/i);
  assert((await visibleTarget(page, '[data-action="chart"]')).visible, 'Sail is visible on entry');
  assert((await visibleTarget(page, '.screen-back')).visible, 'Harbour Back is visible on entry');
  for (const action of [
    'office',
    'outfit',
    'help',
    'conditions',
    'crew',
    'chart',
    'settings',
    'fleet',
    'workshop',
  ]) {
    await revealHarbour(page, action);
    const target = await visibleTarget(page, `[data-action="${action}"]`);
    assert(target.rect.width >= 43.9 && target.rect.height >= 43.9);
    if (['help', 'chart', 'workshop'].includes(action))
      await capture(page, `${prefix}-04-pan-${action}`);
    if (action === 'help')
      assert(
        await page.locator('[data-harbour-pan="left"]').isDisabled(),
        'No empty left pan step',
      );
    if (action === 'workshop')
      assert(
        await page.locator('[data-harbour-pan="right"]').isDisabled(),
        'No empty right pan step',
      );
  }
}
async function hit(page, selector) {
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const measured = await locator.evaluate((element) => {
    const r = element.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2,
      top = document.elementFromPoint(x, y);
    return {
      rect: r.toJSON(),
      hit: !!top && (top === element || element.contains(top)),
      label: element.textContent,
    };
  });
  assert(measured.hit, `${selector} is not reachable at its visible centre: ${measured.label}`);
  assert(
    measured.rect.width >= 43.9 && measured.rect.height >= 43.9,
    `${selector} has an undersized target`,
  );
}
async function swipe(page, selector, horizontal = false) {
  const client = await page.context().newCDPSession(page),
    r = await page.locator(selector).boundingBox(),
    v = page.viewportSize();
  const x = Math.max(
      40,
      Math.min(v.width - 40, horizontal ? r.x + r.width - 25 : r.x + r.width / 2),
    ),
    y = Math.min(v.height - 70, horizontal ? r.y + 65 : r.y + r.height - 25);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let n = 1; n <= 7; n++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: horizontal ? Math.max(45, x - n * 25) : x,
          y: horizontal ? y : Math.max(95, y - n * 20),
        },
      ],
    });
    await page.waitForTimeout(25);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  await client.detach();
}

try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const prefix = viewport.width === 390 ? 'portrait' : 'landscape';
    const page = await browser.newPage({ viewport, hasTouch: true });
    page.setDefaultTimeout(20000);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    try {
      await page.goto(base);
      await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
      await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
      await screen(page, 'touch-options');
      await tap(page, '[data-action="touchscreen"]');
      await back(page);
      await page.waitForFunction(() => !urchinDebug.ui.started);
      await tap(page, '#keyboardFallback');
      await screen(page, 'intro');
      await page.getByRole('button', { name: 'Skip day 0 · choose my boat', exact: true }).tap();
      await screen(page, 'starter');
      await capture(page, `${prefix}-01-starter`);
      await hit(page, '[data-action="difficulty"]');
      await tap(page, '[data-action="difficulty"]');
      assert.equal(await page.evaluate(() => urchinDebug.world.career.difficulty), 'realistic');
      await tap(page, '[data-action="difficulty"]');
      assert.equal(await page.evaluate(() => urchinDebug.world.career.difficulty), 'easy');
      await page
        .getByRole('button', { name: 'Choose Harbour Workhorse · $15,000', exact: true })
        .tap();
      await page.waitForTimeout(180);
      await hit(page, '[data-action="buy-selected"]');
      await capture(page, `${prefix}-02-selected-boat`);
      await tap(page, '[data-action="buy-selected"]');
      await screen(page, 'purchase');
      await capture(page, `${prefix}-03-purchase`);
      await tap(page, '[data-action="cancel-purchase"]');
      await screen(page, 'starter');
      assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), 20000);
      await tap(page, '[data-action="buy-selected"]');
      await screen(page, 'purchase');
      await tap(page, '[data-action="confirm-purchase"]');
      await screen(page, 'harbour');
      assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), 5000);
      await capture(page, `${prefix}-04-harbour`);
      await reviewHarbour(page, prefix);
      await revealHarbour(page, 'crew');
      const crewReturnPosition = await harbourScroll(page);
      await tapVisibleHarbour(page, '[data-action="crew"]');
      await screen(page, 'crew');
      await capture(page, `${prefix}-05-crew`);
      const crew = await page.evaluate(() => JSON.stringify(urchinDebug.world.career.crew));
      await swipe(page, '.crew-grid');
      await capture(page, `${prefix}-06-crew-scroll`);
      assert.equal(
        await page.evaluate(() => JSON.stringify(urchinDebug.world.career.crew)),
        crew,
        'A crew-list swipe must not assign a diver',
      );
      await back(page);
      await screen(page, 'harbour');
      assert.deepEqual(
        await harbourScroll(page),
        crewReturnPosition,
        'Crew Back restores Harbour pan',
      );
      await revealHarbour(page, 'settings');
      const settingsReturnPosition = await harbourScroll(page);
      await tapVisibleHarbour(page, '[data-action="settings"]');
      await screen(page, 'settings');
      await capture(page, `${prefix}-07-settings`);
      await tap(page, '[data-action="bindings"]');
      await screen(page, 'bindings');
      await capture(page, `${prefix}-08-bindings`);
      const bindings = await page.evaluate(() => structuredClone(urchinDebug.input.map));
      const keyboardOverflows = await page
        .locator('.binding-figure')
        .evaluate((figure) => figure.scrollWidth > figure.clientWidth);
      if (keyboardOverflows) {
        await swipe(page, '.binding-figure', true);
        assert(
          (await page.locator('.binding-figure').evaluate((figure) => figure.scrollLeft)) > 0,
          'The keyboard swipe cue must correspond to native horizontal scrolling',
        );
        assert.equal(await page.evaluate(() => !!urchinDebug.ui.bindingPicker?.open), false);
        assert.deepEqual(
          await page.evaluate(() => structuredClone(urchinDebug.input.map)),
          bindings,
        );
        await capture(page, `${prefix}-08b-keyboard-swipe`);
      }
      await page.locator('[data-binding-view="keyboard"]').focus();
      await page.keyboard.press('Tab');
      assert.equal(
        await page.evaluate(() => document.activeElement?.dataset.bindingView),
        'controller',
      );
      await page.keyboard.press('Space');
      await page.waitForTimeout(180);
      assert.equal(await page.evaluate(() => urchinDebug.ui.bindingView), 'controller');
      assert.deepEqual(
        await page.evaluate(() => structuredClone(urchinDebug.input.map)),
        bindings,
        'Changing a diagram must not remap controls',
      );
      await capture(page, `${prefix}-09-controller-diagram`);
      await back(page);
      await screen(page, 'settings');
      const savedLayout = await page.evaluate(() => localStorage.getItem('urchin-hud-layout-v1'));
      await tap(page, '[data-action="layout"]');
      await screen(page, 'layout');
      await capture(page, `${prefix}-10-arrange`);
      await tap(page, '[data-action="layout-timepiecePanel"]');
      const left = await page.evaluate(
        () => urchinDebug.ui.layoutEditor.rows[urchinDebug.ui.layoutEditor.selected].rect.left,
      );
      await tap(page, '[data-action="layout-move"]');
      await hit(page, '[data-layout-adjust="right"]');
      await tap(page, '[data-layout-adjust="right"]');
      assert(
        (await page.evaluate(
          () => urchinDebug.ui.layoutEditor.rows[urchinDebug.ui.layoutEditor.selected].rect.left,
        )) > left,
      );
      await capture(page, `${prefix}-11-move`);
      await tap(page, '[data-layout-adjust="finish"]');
      await back(page);
      await page.waitForFunction(() => urchinDebug.ui.layoutEditor?.cancelPending);
      await capture(page, `${prefix}-12-discard`);
      await tap(page, '[data-action="layout-keep-editing"]');
      await back(page);
      await tap(page, '[data-action="layout-discard"]');
      await screen(page, 'settings');
      assert.equal(
        await page.evaluate(() => localStorage.getItem('urchin-hud-layout-v1')),
        savedLayout,
        'Discard must retain the previously saved layout',
      );
      await back(page);
      await screen(page, 'harbour');
      assert.deepEqual(
        await harbourScroll(page),
        settingsReturnPosition,
        'Settings Back restores Harbour pan',
      );
      await capture(page, `${prefix}-13-harbour-return`);
      assert.equal(await page.evaluate(() => urchinDebug.world.day.phase), 'planning');
      results.push({
        viewport,
        pass: true,
        detail:
          'Natural purchase/difficulty/cancel, visible Harbour pan controls expose all nine destinations and preserve return position, Crew/Settings, native Tab/Space diagrams, and Arrange move/discard pass.',
      });
      console.log('PASS', prefix);
    } catch (error) {
      results.push({ viewport, pass: false, reason: error.message });
      console.log('FAIL', prefix, error.message);
      await capture(page, `${prefix}-failure`);
    } finally {
      await page.close();
    }
  }
} finally {
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify({ base, results, captures, errors }, null, 2),
  );
  await browser.close();
}
assert.deepEqual(errors, [], 'No page or resource errors');
assert.deepEqual(
  captures.filter((capture) => capture.screen !== 'layout' && capture.undersized.length),
  [],
  'Menu action below 44px; inspect recorded captures.',
);
assert(
  results.every((result) => result.pass),
  'Mobile career acceptance failed; inspect results and captures.',
);
