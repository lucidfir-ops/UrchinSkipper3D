import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import '../tests/matter-helper.js';
import { createCareer } from '../src/career-state.js';
import { careerWorld, encode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';

export async function september23Checks(browser) {
  const name = browser.browserType().name();
  const page = await browser.newPage({ viewport: { width: 402, height: 873 }, hasTouch: true });
  const errors = [],
    results = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(20000);
  const action = async (id) => {
    await page.locator(`[data-action="${id}"]`).click();
  };
  const shown = async (screen) => {
    await page.waitForFunction(
      (screen) => document.querySelector('#playtest').dataset.screen === screen,
      screen,
    );
  };
  const open = async (screen) => {
    await page.evaluate((s) => urchinDebug.ui.open(s), screen);
    await shown(screen);
  };
  const slider = async (id, value) => {
    await page.locator(`#${id}`).fill(String(value));
    await page.waitForFunction(
      ({ id, value }) =>
        document.querySelector(`label[for="${id}"] strong`).textContent === `${value}%`,
      { id, value },
    );
  };
  try {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('sep23-initialized')) {
        localStorage.setItem('urchin-tiny-mode-v1', 'on');
        localStorage.setItem('urchin-troubleshooting-v1-enabled', 'on');
        sessionStorage.setItem('sep23-initialized', 'yes');
      }
      window.rotationCalls = 0;
      const unlock = screen.orientation?.unlock.bind(screen.orientation);
      if (unlock)
        screen.orientation.unlock = () => {
          window.rotationCalls++;
          if (window.rotationCalls === 1)
            throw new DOMException('Host still launching', 'SecurityError');
          return unlock();
        };
    });
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.waitForFunction(() => window.urchinDebug?.ready);
    await page.waitForFunction(() => window.rotationCalls >= 2);
    assert.equal(await page.evaluate(() => document.body.classList.contains('tiny-mode')), false);
    const careerBefore = await page.evaluate(() => JSON.stringify(urchinDebug.world.career));
    await page.locator('[data-touch-options]').tap();
    await shown('touch-options');
    await action('touchscreen');
    await action('tiny-touch');
    await slider('touchOpacity', 43);
    const range = page.locator('#touchScale');
    await range.scrollIntoViewIfNeeded();
    const handle = await range.elementHandle();
    const r = await range.boundingBox();
    await page.mouse.move(r.x + r.width * 0.2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width * 0.65, r.y + r.height / 2, { steps: 16 });
    await page.waitForTimeout(250);
    await page.mouse.up();
    assert(
      await handle.evaluate((e) => e.isConnected),
      'Slider remains mounted during native drag',
    );
    await slider('touchScale', 70);
    await page.screenshot({ path: `test-results/sep23-${name}-touch-options.png` });
    await page.locator('.screen-back').click();
    await page.locator('#startup').waitFor({ state: 'visible' });
    assert.equal(
      await page.evaluate(() => JSON.stringify(urchinDebug.world.career)),
      careerBefore,
      'Title options do not advance or replace career',
    );
    await page.reload();
    await page.waitForFunction(() => urchinDebug.ready);
    assert.equal(await page.evaluate(() => localStorage.getItem('urchin-touch-scale-v1')), '70');
    assert.equal(await page.evaluate(() => localStorage.getItem('urchin-touch-opacity-v1')), '43');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('urchin-tiny-mode-v1')),
      'on',
      'Older export preference is preserved',
    );
    await page.locator('#keyboardFallback').click();
    await page.getByRole('button', { name: 'Skip day 0 · choose my boat', exact: true }).click();
    await action('starter-basic');
    await action('buy-selected');
    await action('confirm-purchase');
    await shown('harbour');
    for (const [width, height] of [
      [402, 873],
      [873, 402],
      [816, 1224],
      [1224, 816],
    ]) {
      await page.setViewportSize({ width, height });
      for (const target of [50, 60, 70, 100, 150]) {
        await open('ui-scale');
        await action('ui-reset');
        for (let n = 0; n < (target < 100 ? (100 - target) / 10 : 3); n++) {
          if (target === 100) break;
          await action(target < 100 ? 'ui-smaller' : 'ui-larger');
        }
        await open('harbour');
        await page.locator('[data-action="settings"]').scrollIntoViewIfNeeded();
        const geometry = await page.evaluate(() => {
          const header = document.querySelector('.wharf-heading').getBoundingClientRect();
          const settings = document
            .querySelector('[data-action="settings"]')
            .getBoundingClientRect();
          const hit = document.elementFromPoint(
            settings.x + settings.width / 2,
            settings.y + settings.height / 2,
          );
          return {
            headerHeight: header.height,
            headerBottom: header.bottom,
            settingsTop: settings.top,
            reachable: !!hit?.closest('[data-action="settings"]'),
          };
        });
        assert(
          geometry.headerHeight < 145 &&
            geometry.headerBottom < geometry.settingsTop &&
            geometry.reachable,
          JSON.stringify({ width, height, target, geometry }),
        );
        if ([50, 150].includes(target))
          await page.screenshot({
            path: `test-results/sep23-${name}-harbour-${width}-${target}.png`,
          });
        await action('settings');
        await action('touch-options');
        await page.locator('.screen-back').click();
        await shown('settings');
        results.push({ width, height, uiScale: target, ...geometry });
      }
    }
    const w = careerWorld(createCareer(923));
    assert(chooseGround(w, 'near').ok);
    await page.evaluate((career) => {
      const result = urchinDebug.ui.hooks.changeCareer(null, career);
      if (!result.ok) throw Error(result.reason);
      urchinDebug.ui.open(null);
    }, encode(w));
    await page.waitForFunction(() => urchinDebug.ready && urchinDebug.world.time > 0);
    await page.locator('#voyage').waitFor({ state: 'hidden' });
    for (const [width, height] of [
      [320, 740],
      [402, 873],
      [873, 402],
      [816, 1224],
      [1224, 816],
    ]) {
      await page.setViewportSize({ width, height });
      const sizes = [];
      for (const scale of [50, 70, 100, 150]) {
        await open('touch-options');
        await slider('touchScale', scale);
        await slider('touchOpacity', 43);
        await open('ui-scale');
        await action('ui-reset');
        await page.evaluate(() => {
          urchinDebug.input.lastDevice = 'touch';
          urchinDebug.ui.open(null);
        });
        await page.locator('#touchControls').waitFor({ state: 'visible' });
        await page.waitForTimeout(200);
        const geometry = await page.evaluate(() => {
          const rect = (e) => {
            const r = e.getBoundingClientRect();
            return {
              label: e.getAttribute('aria-label'),
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            };
          };
          return {
            controls: [
              ...document.querySelectorAll(
                '#touchControls [data-touch], #touchControls .touch-stick',
              ),
            ].map(rect),
            stick: rect(document.querySelector('[data-stick="helm"]')),
            chart: rect(document.querySelector('[data-touch="chart"]')),
            opacity: getComputedStyle(document.querySelector('.touch-actions')).opacity,
            menuOpacity: getComputedStyle(document.querySelector('#touchMenu')).opacity,
            timepiece: rect(document.querySelector('#timepiecePanel')),
            message: rect(document.querySelector('#message')),
            controlsTop: document.querySelector('#touchControls').getBoundingClientRect().top,
          };
        });
        for (const r of geometry.controls)
          assert(
            r.left >= -1 && r.right <= width + 1 && r.top >= 0 && r.bottom <= height + 1,
            JSON.stringify({ width, height, scale, r }),
          );
        assert.equal(geometry.opacity, '0.43');
        if (width < height)
          assert(
            geometry.message.bottom < geometry.controlsTop,
            'Default prompts stay above resized controls',
          );
        assert.equal(geometry.menuOpacity, '1');
        sizes.push({ scale, ...geometry });
        if (width === 402 && [70, 100].includes(scale))
          await page.screenshot({ path: `test-results/sep23-${name}-portrait-${scale}.png` });
        await page.locator('[data-touch="chart"]').tap();
        await shown('knowledge');
        await page.evaluate(() => urchinDebug.ui.open(null));
        await page.locator('#touchMenu').tap();
        await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).click();
        await page.locator('.screen-back').click();
        await shown('pause');
        await page.locator('.screen-back').click();
        await page.waitForFunction(() => !urchinDebug.ui.screen);
      }
      for (let n = 1; n < sizes.length; n++) {
        assert(sizes[n].stick.width > sizes[n - 1].stick.width, 'Stick grows with control scale');
        assert(
          sizes[n].chart.height > sizes[n - 1].chart.height,
          'Action buttons grow with control scale',
        );
        assert.equal(
          sizes[n].timepiece.width,
          sizes[0].timepiece.width,
          'Touch scale leaves instruments alone',
        );
      }
      results.push({ width, height, sizes });
    }
    await open('touch-options');
    await slider('touchOpacity', 0);
    await page.evaluate(() => urchinDebug.ui.open(null));
    await page.locator('#touchMenu').tap();
    await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).click();
    await action('touch-reset');
    assert.equal(await page.locator('#touchOpacity').inputValue(), '100');
    const before = await page.evaluate(() => window.rotationCalls);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await page.waitForFunction((n) => window.rotationCalls > n, before);
    await page.evaluate(() => urchinDebug.ui.showTitle());
    await page.locator('[data-fullscreen]').click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.locator('[data-fullscreen]').click();
    await page.waitForFunction(() => !document.fullscreenElement);
    assert.deepEqual(errors, []);
    writeFileSync(
      `test-results/sep23-${name}.json`,
      JSON.stringify({ results, errors, passed: true }, null, 2),
    );
    console.log(
      `PASS ${name}: title/settings/pause touch options, native slider, persistence, 20 harbour scales, 20 helm sizes, Chart taps, rotation recovery and fullscreen.`,
    );
  } catch (error) {
    await page.screenshot({ path: `test-results/sep23-${name}-failure.png` });
    console.error(errors);
    throw error;
  } finally {
    await page.close();
  }
}
