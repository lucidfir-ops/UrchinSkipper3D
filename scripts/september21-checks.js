import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gamepadScript, pressAction } from './gamepad-fixture.js';

export async function september21Checks(browser) {
  const records = [];
  const career = readFileSync('feedback/9-21/urchin-career-day-17-1790034858921.json', 'utf8');
  for (const [name, width, height, touch, tiny] of [
    ['desktop', 1366, 768, false, false],
    ['portrait', 402, 873, true, false],
    ['portrait-tiny', 402, 873, true, true],
    ['phone-tiny', 873, 402, true, true],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.addInitScript(gamepadScript, { name: 'sep21Pad', id: 'September 21 Xbox' });
      await page.addInitScript(
        ({ career, touch, tiny }) => {
          localStorage.setItem('urchin-career-v1', career);
          localStorage.setItem('urchin-touchscreen-v1', touch ? 'on' : 'off');
          localStorage.setItem('urchin-touch-scale-v1', tiny ? '70' : '100');
        },
        { career, touch, tiny },
      );
      await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/');
      await page.waitForFunction(() => window.urchinDebug?.ui);
      await page.locator('#keyboardFallback').click();
      await page.evaluate(async (touch) => {
        const { chooseGround } = await import('/src/day.js');
        const u = urchinDebug.ui,
          w = urchinDebug.world;
        u.touch.setEnabled(touch);
        u.started = true;
        w.day.minute = 600;
        w.career.day = 19;
        const result = chooseGround(w, 'near');
        if (!result.ok) throw Error(result.reason);
        u.open(null);
      }, touch);
      await page.locator('#voyage').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => urchinDebug.vesselTexture?.startsWith('vessel-'));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/sep21-${name}-water.png` });
      assert(!(await page.locator('#landscapeNotice').isVisible()));
      if (touch) {
        for (const rect of await page.locator('#touchControls button').evaluateAll((es) =>
          es.map((e) => {
            const r = e.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              text: e.innerText,
            };
          }),
        ))
          assert(
            rect.left >= 0 && rect.right <= width + 1 && rect.top >= 0 && rect.bottom <= height,
            JSON.stringify(rect),
          );
      }
      for (const mode of ['vector', 'raster']) {
        await page.evaluate(async (mode) => {
          const { setBoatArtMode } = await import('/src/boat-art-mode.js');
          setBoatArtMode(mode);
        }, mode);
        await page.waitForFunction(
          (mode) => urchinDebug.vesselTexture === `vessel-${mode}-basic`,
          mode,
        );
      }
      if (!touch) {
        await page.route('**/fleet/taxi5.png', (route) => route.abort(), { times: 1 });
        assert(
          await page.evaluate(() =>
            urchinDebug.vesselCanvas('taxi-5', 'raster').then(
              () => false,
              () => true,
            ),
          ),
        );
        assert(
          await page.evaluate(() =>
            urchinDebug.vesselCanvas('taxi-5', 'raster').then((c) => c.width > 0),
          ),
        );
        const diag = await page.evaluate(async () => {
          const { encode, readSnapshot } = await import('/src/career-save.js');
          return readSnapshot(encode(urchinDebug.world, true)).troubleshooting;
        });
        assert(diag.entries.some((e) => e.type === 'asset-error'));
      }
      assert.equal(await page.locator('#minimapPanel').getAttribute('data-presentation'), 'chart');
      assert.equal(await page.locator('#minimapPanel button:visible').count(), 0);
      for (const screen of ['crew', 'yourboat', 'layout']) {
        await page.evaluate((s) => urchinDebug.ui.open(s), screen);
        await page.waitForTimeout(200);
        if (screen === 'yourboat') await page.locator('.boat-blueprint').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/sep21-${name}-${screen}.png` });
      }
      await page.locator('[data-action="layout-diverPanel"]').click();
      await page.locator('[data-action="layout-move"]').click();
      const down = await page.locator('[data-layout-adjust="down"]').boundingBox();
      await page.mouse.move(down.x + down.width / 2, down.y + down.height / 2);
      await page.mouse.down();
      await page.waitForFunction(() => {
        const r = urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'diverPanel').rect;
        return r.top + r.height >= innerHeight - 5;
      });
      await page.mouse.up();
      await page.locator('[data-layout-adjust="finish"]').click();
      await page.locator('[data-action="layout-save"]').click();
      await page.evaluate(() => urchinDebug.ui.open('layout'));
      await page.locator('[data-action="layout-diverPanel"]').click();
      await page.locator('[data-action="layout-toggle"]').click();
      await page.evaluate(() => urchinDebug.ui.back());
      await page.waitForSelector('[role="alertdialog"]');
      await page.getByRole('button', { name: 'Exit without saving', exact: true }).click();
      await page.evaluate(() => urchinDebug.ui.open(null));
      await page.waitForTimeout(200);
      const bottom = await page
        .locator('#diverPanel')
        .evaluate((e) => e.getBoundingClientRect().bottom);
      assert(Math.abs(bottom - height + 4) < 2, `${name} bottom ${bottom}`);
      if (!touch) {
        await page.keyboard.press('KeyW');
        await page.waitForSelector('#keyboardHelm:not([hidden])');
        const audio = await page.evaluate(async () => {
          const a = urchinDebug.audio,
            w = urchinDebug.world,
            read = async (throttle) => {
              w.boat.throttle = throttle;
              a.update(w, true, 1);
              await new Promise((resolve) => setTimeout(resolve, 150));
              return {
                gear: Object.entries(a.engines).find(([, s]) => s === a.engine)[0],
                volume: a.engine.volume,
                rate: a.engine.rate,
              };
            };
          a.unlock();
          await a.manager.context.resume();
          return { idle: await read(0), forward: await read(1), reverse: await read(-1) };
        });
        assert.equal(audio.idle.gear, 'neutral');
        assert.equal(audio.forward.gear, 'forward');
        assert.equal(audio.reverse.gear, 'reverse');
        assert(audio.forward.volume > audio.idle.volume * 6, JSON.stringify(audio));
        await page.screenshot({ path: 'test-results/sep21-keyboard.png' });
        await pressAction(page, 'sep21Pad', 'pause');
        assert(!!(await page.evaluate(() => urchinDebug.ui.screen)));
      }
      for (let n = 0; n < 2; n++) {
        await page.evaluate(() => {
          urchinDebug.ui.hooks.trainingReplay({ boatId: 'twinjet', scenario: 'boat' });
          urchinDebug.ui.open(null);
        });
        await page.waitForTimeout(300);
        assert(await page.evaluate(() => urchinDebug.world.career.trainingReplay));
        await page.evaluate(() => urchinDebug.ui.open('settings'));
        await page.locator('[data-action="touch-options"]').click();
        await page.locator('[data-action="tiny-touch"]').click();
      }
      assert.deepEqual(errors, []);
      records.push({ name, errors, vessel: await page.evaluate(() => urchinDebug.vesselTexture) });
      console.log(`PASS September 21 ${name}`);
    } catch (e) {
      await page.screenshot({ path: `test-results/sep21-${name}-failure.png` });
      console.error(errors);
      throw e;
    } finally {
      await page.close();
    }
  }
  writeFileSync('test-results/sep21-browser.json', JSON.stringify(records, null, 2));
}
