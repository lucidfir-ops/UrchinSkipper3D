import { gamepadScript, pressGamepad, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

// Real DOM/controller integration. Fixture placement and accelerated physics are
// explicit; this cannot establish physical USB/Steam Deck device behaviour.
export async function feedbackChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(gamepadScript, { name: 'fakePad', absent: true });
  async function raw(index, value) {
    await page.evaluate(
      ({ index, value }) => (fakePad.buttons[index] = { value, pressed: !!value }),
      { index, value },
    );
    await page.waitForFunction(
      ({ index, value }) => !!urchinDebug.input.buttonPrevious[`pad0/b${index}`] === !!value,
      { index, value },
    );
  }
  async function button(index) {
    return pressGamepad(page, 'fakePad', index);
  }
  async function action(name) {
    return pressAction(page, 'fakePad', name);
  }
  async function choose(prefix) {
    return chooseController(page, action, prefix);
  }
  async function back() {
    await page.getByRole('button', { name: 'Back to previous menu', exact: true }).click();
  }
  async function calm(boatId = 'sterndrive') {
    await page.evaluate((boatId) => {
      urchinDebug.reset({ practice: true, boatId });
      const w = urchinDebug.world;
      w.terrain.depths.fill(30);
      w.environment.model = 'uniform';
      w.environment.current = { x: 0, y: 0 };
      w.environment.wind = { x: 0, y: 0 };
      w.environment.waves = 0;
      w.logs = [];
      Object.assign(w.boat, { vx: 0, vy: 0, heading: 0 });
      urchinDebug.ui.open(null);
    }, boatId);
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
  }
  async function float() {
    await page.evaluate(() => {
      const w = urchinDebug.world;
      Object.assign(w.diver, {
        state: 'surface',
        x: w.boat.x - 4,
        y: w.boat.y,
        bag: 300,
        qualitySum: 270,
        air: 60,
        patch: w.patches[0],
        bagHandled: false,
        hook: 0,
        hooking: false,
        recoveryAction: null,
      });
    });
    await page.waitForFunction(() =>
      document.querySelector('#help').textContent.includes('Take + give bag'),
    );
  }
  try {
    await page.goto((process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/') + '?prototype=1');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await page.evaluate(() => {
      fakePad = {
        id: 'Xbox synthetic existing playtest',
        index: 0,
        mapping: 'standard',
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
      };
      fakePad.buttons[0].value = 1;
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
    await raw(0, 0);
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    assert(
      await page.evaluate(
        () =>
          urchinDebug.input.map.work.includes('b2') &&
          urchinDebug.input.map.recoverDiver.includes('b3'),
      ),
      'fresh Xbox uses the standard layout',
    );
    await action('menuDown');
    await action('menuDown');
    await page.waitForFunction(
      () => document.querySelector('.area-preview')?.title === 'Outer Ledge',
    );
    await chooseController(page, action, 'Tide & current almanac', false);
    assert.match(
      await page.locator('.chart-actions .selected').textContent(),
      /Tide & current almanac/i,
    );
    await page.screenshot({ path: 'test-results/feedback-chart-1280.png' });
    await action('confirm');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'almanac');
    assert.equal(await page.evaluate(() => urchinDebug.ui.almanacGroundId), 'far');
    const minute = await page.evaluate(() => urchinDebug.world.day.minute),
      map = await page.locator('.almanac-map canvas').evaluate((c) => c.toDataURL());
    await choose('Forecast +30');
    await choose('Forecast +30');
    assert.equal(await page.evaluate(() => urchinDebug.world.day.minute), minute);
    assert.notEqual(await page.locator('.almanac-map canvas').evaluate((c) => c.toDataURL()), map);
    await page.screenshot({ path: 'test-results/feedback-current-almanac.png' });
    await action('back');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
    assert.equal(await page.evaluate(() => urchinDebug.ui.index), 3);
    await choose('Visit prototype boatyard');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'boatyard');
    await choose('Channel Master');
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.configuration), 'twinjet');
    assert.match(await page.locator('.yard-detail').textContent(), /72 h/);
    assert(!/half depth access/i.test(await page.locator('#playtest').textContent()));
    await back();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
    assert.equal(await page.evaluate(() => urchinDebug.ui.index), 4);
    // Menu, not Back, opens the prototype Pause root. Back deliberately walks
    // the planning chart to the title root under the clarified history model.
    await action('pause');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
    await choose('Coastal chart');
    await choose('South Reef');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'departure');
    await back();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
    assert.equal(await page.evaluate(() => urchinDebug.ui.index), 1);
    await action('pause');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
    await choose('Coastal chart');
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.screenshot({ path: 'test-results/feedback-chart-1024.png' });
    const chartFits = await page.locator('.chart-actions').evaluate((el) => {
      const r = el.getBoundingClientRect(),
        p = document.querySelector('#playtest').getBoundingClientRect();
      return (
        r.left >= p.left &&
        r.right <= p.right &&
        [...el.querySelectorAll('button')].every((b) => b.getBoundingClientRect().height >= 48)
      );
    });
    assert(chartFits);
    assert(
      await page
        .locator('.chart-choices')
        .evaluate((el) =>
          [...el.querySelectorAll('button')].every(
            (b) =>
              b.getBoundingClientRect().bottom <=
              document.querySelector('.day-footer').getBoundingClientRect().top,
          ),
        ),
      'all chart options fit',
    );
    await choose('Tide & current almanac');
    await page.screenshot({ path: 'test-results/feedback-almanac-1024.png' });
    assert(
      await page.getByRole('button', { name: 'Back to previous menu', exact: true }).isVisible(),
    );
    assert(
      await page
        .locator('.day-heading')
        .evaluate(
          (el) =>
            el.getBoundingClientRect().top >=
            document.querySelector('#playtest').getBoundingClientRect().top,
        ),
      'heading remains inside frame',
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await action('back');
    await action('back');
    await choose('Controller setup');
    await choose('Verify physical X / Y actions');
    await page.waitForFunction(
      () => urchinDebug.input.naming && !urchinDebug.input.naming.waitRelease,
    );
    await button(3);
    await page.waitForFunction(
      () => urchinDebug.input.naming?.index === 1 && !urchinDebug.input.naming.waitRelease,
    );
    await button(2);
    await page.waitForFunction(() => !urchinDebug.input.naming);
    assert.match(await page.locator('#playtest').textContent(), /X.*Y/s);
    const key = await page.evaluate(() => urchinDebug.input.profileKey);
    await page.evaluate(() => {
      fakePad.id = 'Second standard Xbox';
    });
    await page.waitForFunction(() => urchinDebug.input.profileKey.includes('Second standard'));
    assert(
      await page.evaluate(
        () =>
          urchinDebug.input.map.work.includes('b2') &&
          urchinDebug.input.map.recoverDiver.includes('b3'),
      ),
    );
    await page.evaluate(() => (fakePad.id = 'Xbox synthetic existing playtest'));
    await page.waitForFunction((key) => urchinDebug.input.profileKey === key, key);
    assert(
      await page.evaluate(() => urchinDebug.input.map.work.includes('b3')),
      'per-device mapping restored',
    );
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => urchinDebug.input.deviceLabel === 'Keyboard');
    assert.match(await page.locator('#help').textContent(), /^KEYBOARD/);
    await action('menuDown');
    await page.waitForFunction(() =>
      document.querySelector('#help').textContent.startsWith('XBOX'),
    );
    console.log(
      'Feedback: visible Back history, gamepad chart utilities, forecast arrows and device-specific controls',
    );
    await calm();
    await float();
    await page.evaluate(() => {
      urchinDebug.world.diver.air = 20;
    });
    await action('work');
    await page.waitForFunction(() => urchinDebug.world.diver.bagHandled);
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.state), 'surface');
    assert.match(await page.locator('#help').textContent(), /X — Offer bag.*Y — Board Diver/s);
    await page.screenshot({ path: 'test-results/feedback-bag-choice.png' });
    await action('recoverDiver');
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'ready');
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.air), 100);
    assert.equal(await page.evaluate(() => urchinDebug.world.catch), 300);
    const panels = await page.evaluate(() => ({
      hud: document.querySelector('#hud').getBoundingClientRect().bottom,
      divers: document.querySelector('#divers').getBoundingClientRect().top,
    }));
    assert(panels.divers >= panels.hud);
    assert(await page.locator('.current-instrument').isVisible());
    assert.deepEqual(
      await page.evaluate(() => [
        urchinDebug.world.boat.hullHealth,
        urchinDebug.world.boat.driveHealth,
      ]),
      [1, 1],
    );
    assert.equal(await page.locator('.drive-alert').count(), 0);
    await page.evaluate(() => (urchinDebug.ui.realistic = true));
    await page.locator('#hud').waitFor({ state: 'hidden' });
    assert(await page.locator('.current-instrument').isHidden());
    assert(await page.locator('#speedPanel').isHidden());
    await page.evaluate(() => (urchinDebug.ui.realistic = false));
    await page.locator('#hud').waitFor({ state: 'visible' });
    await calm();
    await page.evaluate(() => {
      const w = urchinDebug.world;
      Object.assign(w.diver, { state: 'surface', x: 250, y: 250, bag: 100, qualitySum: 90 });
      // Match the deterministic moderate-contact unit fixture. The older
      // 1.2 m/s overlap is now intentionally only a near miss.
      w.boat.vy = -3;
      urchinDebug.step(1 / 60);
      w.boat.vy = 0;
    });
    await page.waitForFunction(() => urchinDebug.world.diver.condition === 'injured');
    assert(
      await page
        .locator('#hud')
        .textContent()
        .then((t) => t.includes('MEDICAL RETURN')),
    );
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.diver.x = w.boat.x - 4;
      w.diver.y = w.boat.y;
    });
    await action('recoverDiver');
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'ready');
    await action('recoverDiver');
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.state), 'ready');
    await page.screenshot({ path: 'test-results/feedback-medical-return.png' });
    await calm();
    await page.evaluate(() => {
      const w = urchinDebug.world;
      Object.assign(w.diver, { state: 'surface', x: 250, y: 250, bag: 100, qualitySum: 90 });
      w.boat.vy = -5;
      urchinDebug.step(1 / 60);
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'emergency');
    await page.screenshot({ path: 'test-results/feedback-diver-emergency.png' });
    await action('confirm');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'summary');
    assert.equal(await page.evaluate(() => urchinDebug.world.day.result.safety.fatalities), 1);
    assert.match(await page.locator('#playtest').textContent(), /fatal/i);
    await calm('twinjet');
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.boat.vy = -7.7;
      w.logs = [
        {
          id: 'large-test',
          kind: 'large log',
          x: 250,
          y: 245,
          heading: Math.PI / 2,
          length: 10,
          radius: 0.65,
          severity: 2.4,
        },
      ];
      urchinDebug.step(1 / 60);
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'emergency');
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.hullHealth), 0);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.driveHealth), 1);
    await action('confirm');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'summary');
    assert(await page.evaluate(() => urchinDebug.world.day.result.sunk));
    await page.screenshot({ path: 'test-results/feedback-sinking-results.png' });
    await action('pause');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
    assert.match(await page.locator('#playtest h2').textContent(), /HARBOUR/);
    await choose('Offload receipt');
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.screenshot({ path: 'test-results/feedback-results-1024.png' });
    assert(
      await page
        .locator('.landing-receipt')
        .evaluate(
          (el) =>
            el.getBoundingClientRect().bottom <=
            document.querySelector('.day-footer').getBoundingClientRect().top,
        ),
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await calm();
    await action('pause');
    await choose('Controller setup');
    await page.evaluate(() => {
      fakePad.id = 'Unknown raw desktop device';
      fakePad.mapping = '';
      fakePad.axes = [0, 0, 0, 0, -1, -1];
      fakePad.buttons = Array.from({ length: 22 }, () => ({ value: 0, pressed: false }));
    });
    await page.waitForFunction(() => urchinDebug.input.needsMapping);
    assert(
      await page.evaluate(() => !urchinDebug.input.map.throttleUp.some((c) => /^[ab]\d/.test(c))),
    );
    await page.evaluate(() => (fakePad.axes[1] = -1));
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), 0);
    await page.evaluate(() => (fakePad.axes[1] = 0));
    await page.screenshot({ path: 'test-results/feedback-raw-controller.png' });
    assert.deepEqual(errors, []);
    writeFileSync(
      'test-results/feedback-browser-report.json',
      JSON.stringify(
        {
          navigationAndHistory: true,
          gamepadUtilities: true,
          compactChart: true,
          forecastNonMutating: true,
          deviceProfiles: true,
          bagChoice: true,
          healthPrivacy: true,
          medicalReturn: true,
          fatalityRescue: true,
          jetHullSinking: true,
          unknownRawInputGuard: true,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(
      'PASS: playtest-feedback menus, forecast, controller profiles, explicit recovery choices, health privacy, injured-diver boarding, fatality outcomes and jet hull sinking/rescue.',
    );
  } catch (error) {
    await page.screenshot({ path: 'test-results/feedback-failure.png' }).catch(() => {});
    const state = await page
      .evaluate(() => ({
        screen: urchinDebug.ui.screen,
        index: urchinDebug.ui.index,
        lock: urchinDebug.ui.lockReason,
        notice: urchinDebug.ui.menuNotice,
        day: urchinDebug.world.day,
        boat: urchinDebug.world.boat,
        divers: urchinDebug.world.divers,
      }))
      .catch(() => ({}));
    writeFileSync(
      'test-results/feedback-failure.json',
      JSON.stringify({ error: error.message, errors, state }, null, 2),
    );
    throw error;
  } finally {
    await page.close();
  }
}
