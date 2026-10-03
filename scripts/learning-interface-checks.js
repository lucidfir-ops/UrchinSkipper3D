import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

export async function learningInterfaceChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true }),
    errors = [],
    records = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error('PAGE ERROR', error.message);
  });
  page.setDefaultTimeout(20000);
  const screen = (value) => page.waitForFunction((value) => urchinDebug.ui.screen === value, value),
    pad = (action) => pressAction(page, 'learningPad', action),
    shot = (name) =>
      page.screenshot({
        path: `test-results/learning-interface-${name}.png`,
        animations: 'disabled',
      });
  const preset = async (id) => {
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    await pad('assists');
    await screen('assists');
    await page.locator(`[data-action="${id}"]`).click();
    await page.keyboard.press('Escape');
    await screen(null);
  };
  try {
    await page.routeWebSocket('**', (socket) => {
      socket.connectToServer().onMessage(() => {});
    });
    await page.addInitScript(gamepadScript, {
      name: 'learningPad',
      id: 'Learning Interface Synthetic Xbox',
    });
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
    await page.waitForFunction(() => window.urchinDebug?.ready);
    await page.locator('[data-title-action="settings"]').click();
    await screen('settings');
    const slider = page.locator('#soundVolume');
    assert.equal(await slider.getAttribute('type'), 'range');
    await slider.focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(() => urchinDebug.audio.volume === 0);
    await page.keyboard.press('End');
    await page.waitForFunction(() => urchinDebug.audio.volume === 1);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => Math.abs(urchinDebug.audio.volume - 0.99) < 0.0001);
    await chooseController(page, pad, 'Sound volume', false);
    await pad('menuLeft');
    await page.waitForFunction(() => Math.abs(urchinDebug.audio.volume - 0.94) < 0.0001);
    const node = await slider.elementHandle(),
      rect = await slider.boundingBox();
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: rect.x + rect.width * 0.75, y: rect.y + rect.height / 2 }],
    });
    for (const fraction of [0.65, 0.5, 0.35, 0.2])
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: rect.x + rect.width * fraction, y: rect.y + rect.height / 2 }],
      });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    assert(
      await node.evaluate((element) => element === document.querySelector('#soundVolume')),
      'native touch keeps the original range mounted',
    );
    const volume = await page.evaluate(() => ({
      value: urchinDebug.audio.volume,
      saved: Number(localStorage.getItem('urchin-volume')),
    }));
    assert(volume.value >= 0.1 && volume.value <= 0.3, JSON.stringify(volume));
    assert.equal(volume.value, volume.saved);
    records.push({ kind: 'keyboard/controller/native-touch-volume', ...volume });
    await shot('settings-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await slider.scrollIntoViewIfNeeded();
    await shot('settings-phone');
    await page.setViewportSize({ width: 1280, height: 800 });
    await pad('back');
    await page.locator('#keyboardFallback').click();
    await screen('intro');
    await page.locator('#playtest [data-choice-index="0"]').click();
    await screen(null);
    await page.waitForTimeout(400);
    await shot('tutorial-first-task');
    await page.evaluate(() => {
      urchinDebug.world.career.intro.step = 9;
    });
    await page.waitForFunction(() =>
      document.querySelector('#frankAboard').textContent.includes('SOUTH'),
    );
    const lastWords = (await page.locator('.frank-line p').textContent()).split(/\s+/).length;
    assert(lastWords < 55, `last task remains actionable (${lastWords} words)`);
    await shot('tutorial-return-task');
    await page.locator('[data-intro="chart"]').click();
    await screen('introchart');
    await shot('full-chart-raster');
    await page.locator('[data-chart-mode="vector"]').click();
    await page.waitForFunction(() => !!document.querySelector('#playtest [data-ownship-symbol]'));
    assert.match(
      await page.locator('#playtest .sector-chart-vector').textContent(),
      /YOU · \d{3}°/,
    );
    await shot('full-chart-vector');
    await page.locator('.screen-back').click();
    await screen(null);
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.intro.status = 'complete';
      Object.assign(w.boat, { throttle: 0, rudder: 0 });
      for (const [i, d] of w.divers.entries())
        Object.assign(d, {
          state: 'searching',
          x: w.boat.x + 18 + i * 7,
          y: w.boat.y - 20,
          air: 70,
          searchLimit: 0,
          searchTime: 0,
        });
    });
    await preset('easy');
    await page.waitForTimeout(400);
    assert(await page.locator('#diverPanel').isVisible());
    assert.equal(await page.locator('#divers > button:visible').count(), 2);
    assert.match(await page.locator('#divers').textContent(), /Searching|Harvesting/);
    // The September 29 presentation moved diver status into the crew cards;
    // the former floating DOM labels no longer exist. Check the current Easy
    // assistance ring, and its information boundary under Realistic below.
    const cues = await page.evaluate(() => ({
      groupVisible: urchinDebug.three.diverCues.group.visible,
      ringVisible: urchinDebug.three.diverCues.ring.visible,
    }));
    assert(
      cues.groupVisible && cues.ringVisible,
      'Easy permits the selected underwater diver ring',
    );
    records.push({ kind: 'easy-underwater-assistance', ...cues });
    await shot('easy-underwater-neutral');
    await preset('realistic');
    await page.waitForTimeout(250);
    assert(await page.locator('#diverPanel').isVisible());
    assert.equal(await page.locator('#divers > button:visible').count(), 2);
    assert.doesNotMatch(
      await page.locator('#divers').textContent(),
      /Searching|Harvesting|Air|Bag/,
    );
    assert.doesNotMatch(
      await page.locator('#message').textContent(),
      /Diver searching|Diver working|Diver surfacing/i,
    );
    assert(
      !(await page.evaluate(() => urchinDebug.three.diverCues.ring.visible)),
      'Realistic does not expose the underwater diver ring',
    );
    await shot('realistic-underwater-neutral');
    await preset('off');
    await page.waitForTimeout(200);
    assert(!(await page.locator('#diverPanel').isVisible()));
    records.push({
      kind: 'diver-cards',
      easy: '2 visible with state in neutral underwater',
      realistic: '2 identity-only visible in neutral underwater',
      allOff: 'hidden as requested',
    });
    assert.deepEqual(errors, []);
    writeFileSync(
      'test-results/learning-interface-checks.json',
      JSON.stringify(
        { records, errors, physicalController: 'Not tested; controller input was synthetic.' },
        null,
        2,
      ),
    );
    console.log(
      'PASS: keyboard/native touch volume, synthetic controller adjustment, concise tutorial, raster/vector ownship, Easy/Realistic/All Off underwater crew cards.',
    );
  } finally {
    await page.close();
  }
}
