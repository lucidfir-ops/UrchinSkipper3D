import assert from 'node:assert/strict';

export async function debugModeChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.intro = { status: 'complete', step: 9 };
      w.career.day = 1;
      w.day.phase = 'working';
      w.day.minute = 600;
      w.day.returnExit = { edge: 'south', bearing: 180, label: 'SOUTH' };
      urchinDebug.ui.begin(true);
      urchinDebug.ui.open('pause');
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
    const pause = await page.locator('.choices button').allTextContents();
    assert.deepEqual(pause.slice(0, 4), [
      'Resume',
      'REVEAL EVERY URCHIN: OFF',
      'Debug mode',
      'Arrange UI layout',
    ]);
    await page.getByRole('button', { name: 'Debug mode', exact: true }).click();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'debug-mode');
    await page.locator('#playtest h2').filter({ hasText: 'DEBUG MODE' }).waitFor();
    assert.match(
      await page.locator('#playtest').innerText(),
      /ASSISTED PLAYTEST.*live simulation/s,
    );
    for (const label of [
      'Skip forward 30 minutes',
      'Set time · 10:00',
      'Set weather · Natural forecast',
      'Set tide height · Natural tide',
      'Spawn taxi',
      'Spawn rival',
    ])
      assert(await page.getByRole('button', { name: label, exact: true }).isVisible(), label);
    await page.screenshot({ path: 'test-results/debug-mode-desktop.png' });
    await page.getByRole('button', { name: 'Set weather · Natural forecast', exact: true }).click();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'debug-weather');
    await page.locator('#playtest h2').filter({ hasText: 'SET WEATHER' }).waitFor();
    assert(await page.getByRole('button', { name: 'Rough weather', exact: true }).isVisible());
    await page.screenshot({ path: 'test-results/debug-weather-desktop.png' });
    await page.setViewportSize({ width: 360, height: 780 });
    await page.screenshot({ path: 'test-results/debug-weather-phone.png' });
    const bounds = await page.locator('#playtest').evaluate((panel) => {
      const r = panel.getBoundingClientRect();
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
    });
    assert(bounds.top >= 0 && bounds.left >= 0 && bounds.right <= 360 && bounds.bottom <= 780);
    assert.deepEqual(errors, []);
    console.log('PASS: Debug order, scope copy, controls and desktop/phone layout.');
  } catch (error) {
    console.error(
      JSON.stringify({
        errors,
        state: await page
          .evaluate(() => ({
            screen: urchinDebug.ui.screen,
            title: document.querySelector('#playtest h2')?.textContent,
            text: document.querySelector('#playtest')?.innerText,
            lock: urchinDebug.ui.lockReason,
          }))
          .catch(() => null),
      }),
    );
    throw error;
  } finally {
    await page.close();
  }
}
