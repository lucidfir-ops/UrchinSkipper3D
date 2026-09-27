import { gamepadScript, pressGamepad, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

// Runs through real UI/actions. Time acceleration and fixture positioning are explicit.
export async function prototypeChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.setDefaultTimeout(12000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('crash', () => errors.push('BROWSER PAGE CRASHED'));
  await page.addInitScript(gamepadScript, { name: 'fakePad', absent: true });
  async function raw(index, value) {
    await page.evaluate(
      ({ index, value }) => {
        fakePad.buttons[index] = { value, pressed: !!value };
      },
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
  async function axes(x, y) {
    await page.evaluate(
      ({ x, y }) => {
        fakePad.axes[0] = x;
        fakePad.axes[1] = y;
      },
      { x, y },
    );
    await page.waitForFunction(
      ({ x, y }) => urchinDebug.input.aim.x === x && urchinDebug.input.aim.y === y,
      { x, y },
    );
  }
  async function choose(prefix) {
    return chooseController(page, action, prefix);
  }
  async function menu() {
    await action('pause');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
  }
  try {
    await page.goto((process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/') + '?prototype=1');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    assert.equal(await page.evaluate(() => urchinDebug.world.day.phase), 'planning');
    await page.evaluate(() => {
      window.fakePad = {
        id: 'Synthetic built-in Deck',
        mapping: 'standard',
        connected: true,
        index: 0,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
      };
      fakePad.buttons[0].value = 1;
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
    await raw(0, 0);
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    await page.screenshot({ path: 'test-results/prototype-chart.png' });
    await choose('Sheltered Kelp');
    await choose('Begin working day');
    await page.waitForFunction(() => urchinDebug.world.time > 0.1);
    const arrivalMinute = await page.evaluate(() => urchinDebug.world.day.minute);
    assert(arrivalMinute >= 540 && arrivalMinute < 550, 'one-hour passage arrives around 09:00');
    assert.equal(await page.evaluate(() => urchinDebug.world.divers.length), 2);
    await page.mouse.click(800, 500);
    await page.waitForFunction(() => urchinDebug.audio.manager.context.state === 'running');
    console.log('Prototype: chart, travel and audio unlocked');
    const helm = await page.evaluate(() => ({
      throttle: urchinDebug.world.boat.throttle,
      rudder: urchinDebug.world.boat.rudder,
    }));
    await raw(1, 1);
    await page.waitForFunction(() => urchinDebug.ui.screen === 'instructions');
    await axes(0.7, -0.7);
    await page.waitForFunction(() => urchinDebug.ui.draft.direction === 2);
    await page.waitForFunction(() => urchinDebug.ui.instructionHold > 0.22);
    await page.screenshot({ path: 'test-results/prototype-compass.png' });
    await raw(1, 0);
    await page.waitForFunction(() => urchinDebug.ui.screen !== 'instructions');
    await axes(0, 0);
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    assert.equal(await page.evaluate(() => urchinDebug.world.divers[0].direction), 2);
    assert.deepEqual(
      await page.evaluate(() => ({
        throttle: urchinDebug.world.boat.throttle,
        rudder: urchinDebug.world.boat.rudder,
      })),
      helm,
    );
    await action('cycleDiver');
    await action('instructions');
    await axes(-1, 0);
    await action('menuRight');
    await action('confirm');
    await axes(0, 0);
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    assert.deepEqual(
      await page.evaluate(() => urchinDebug.world.divers.map((d) => d.direction)),
      [2, 7],
    );
    assert.deepEqual(
      await page.evaluate(() => urchinDebug.world.divers.map((d) => d.minQuality)),
      [0, 0.6],
    );
    // Cancel a changed direction without modifying either set of orders.
    await action('instructions');
    await axes(0, 1);
    await action('back');
    await axes(0, 0);
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    assert.equal(await page.evaluate(() => urchinDebug.world.divers[1].direction), 7);
    // A neutral gamepad must not erase a touch/mouse choice on the next frame.
    await action('instructions');
    const wheel = await page.locator('.compass svg').boundingBox();
    await page.mouse.click(wheel.x + wheel.width * 0.84, wheel.y + wheel.height / 2);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => urchinDebug.ui.draft.direction), 3);
    await page.locator('[data-order=apply]').click();
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    assert.equal(await page.evaluate(() => urchinDebug.world.divers[1].direction), 3);
    await action('instructions');
    await axes(-1, 0);
    await axes(0, 0);
    assert.equal(await page.evaluate(() => urchinDebug.ui.draft.direction), 0);
    await action('confirm');
    console.log(
      'Prototype: hold, tap, touch, deadzone, confirmation, cancellation and independent compass orders',
    );
    await action('cycleDiver');
    await action('recoverDiver');
    await page.waitForFunction(() =>
      ['searching', 'harvesting'].includes(urchinDebug.world.divers[0].state),
    );
    await page.evaluate(() => urchinDebug.step(7));
    await page.waitForFunction(() => urchinDebug.world.divers[0].state === 'harvesting');
    await action('cycleDiver');
    await page.evaluate(() => {
      const w = urchinDebug.world,
        p = w.patches.find((p) => p.id === 'poor'),
        c = urchinDebug.currentAt(p.drop.x, p.drop.y);
      Object.assign(w.boat, {
        ...p.drop,
        heading: 0,
        vx: c.x,
        vy: c.y,
        throttle: 0,
        rudder: 0,
        turn: 0,
      });
    });
    await action('recoverDiver');
    await page.waitForFunction(() => urchinDebug.world.divers[1].state === 'harvesting');
    assert(
      await page.evaluate(() => urchinDebug.world.divers.every((d) => d.state === 'harvesting')),
    );
    assert.notEqual(
      ...(await page.evaluate(() => urchinDebug.world.divers.map((d) => d.patch.id))),
    );
    await page.screenshot({ path: 'test-results/prototype-two-divers.png' });
    await action('chart');
    await choose('Outer Ledge');
    await choose('Travel to sector');
    assert.match(await page.locator('#playtest').textContent(), /BRING BOTH DIVERS ABOARD FIRST/);
    await action('back');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
    await action('back');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    await menu();
    const before = await page.evaluate(() => JSON.stringify(urchinDebug.world));
    await choose('Information:');
    assert.equal(await page.evaluate(() => JSON.stringify(urchinDebug.world)), before);
    assert(await page.locator('#divers').isHidden());
    await choose('Resume');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    await page.screenshot({ path: 'test-results/prototype-realistic.png' });
    assert(await page.locator('#message').isHidden(), 'All Off hides action telemetry');
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.events.push('DIVER 1: DIVER SURFACED — GET ALONGSIDE ON PORT');
    });
    await page.waitForFunction(() => urchinDebug.world.events.length === 0);
    assert(!/SURFACED/.test(await page.locator('#actionFeedback').textContent()));
    await menu();
    await choose('Information:');
    await choose('Resume');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    // Adjacent simultaneous floats: an explicit fixture for targeting and recovery.
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
      const patch = w.patches.find((p) => p.id === 'good');
      window.pickupBoatX = patch.x + 4;
      Object.assign(w.boat, {
        x: patch.x + 4,
        y: patch.y,
        heading: 0,
        vx: 0,
        vy: 0,
        throttle: 0,
        rudder: 0,
        turn: 0,
        grounded: false,
      });
      for (const d of w.divers)
        Object.assign(d, {
          state: 'surface',
          x: patch.x,
          y: patch.y + d.id,
          bag: 300,
          qualitySum: 240,
          air: 40,
          reason: 'Bag full',
          patch,
          bagHandled: false,
          hook: 0,
          hooking: false,
          recoveryAction: null,
          recoveryPause: '',
        });
      w.selectedDiverId = 0;
    });
    await page.waitForFunction(() =>
      document.querySelector('#help').textContent.includes('Take + give bag'),
    );
    assert.match(
      await page.locator('#help').textContent(),
      /X — Take \+ give bag.*Y — Recover Diver/,
    );
    await page.screenshot({ path: 'test-results/prototype-adjacent-floats.png' });
    await action('work');
    await page.waitForFunction(() => urchinDebug.world.divers[0].hook > 0.3);
    await page.evaluate(() => (urchinDebug.world.boat.x += 30));
    await page.waitForFunction(() => urchinDebug.world.divers[0].recoveryPause === 'OUT OF RANGE');
    const hook = await page.evaluate(() => urchinDebug.world.divers[0].hook);
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => urchinDebug.world.divers[0].hook), hook);
    await page.evaluate(() => (urchinDebug.world.boat.x = window.pickupBoatX));
    await page.waitForFunction(() => urchinDebug.world.catch === 300);
    assert.equal(await page.evaluate(() => urchinDebug.world.divers[1].bag), 300);
    assert.equal(await page.evaluate(() => urchinDebug.world.divers[1].hook), 0);
    // The completed bag exchange sends Diver 1 back down. Maneuver to make Diver 2
    // the nearest hull target; HUD selection deliberately does not pick for us.
    await page.evaluate(() => {
      const w = urchinDebug.world,
        d = w.divers[1];
      w.boat.x = d.x + 4;
      w.boat.y = d.y + 5.5;
    });
    await action('cycleDiver');
    await action('recoverDiver');
    await page.waitForFunction(() => urchinDebug.world.divers[1].state === 'ready');
    assert.equal(await page.evaluate(() => urchinDebug.world.catch), 600);
    assert.notEqual(await page.evaluate(() => urchinDebug.world.divers[0].state), 'ready');
    assert(
      ['deploying', 'searching', 'harvesting'].includes(
        await page.evaluate(() => urchinDebug.world.divers[0].state),
      ),
    );
    // The diver now walks between clumps. This recovery fixture must maneuver
    // alongside their actual surfaced position instead of assuming a stationary harvester.
    await page.evaluate(() => {
      urchinDebug.step(70);
      const w = urchinDebug.world,
        d = w.divers[0];
      Object.assign(w.boat, {
        x: d.x + 4,
        y: d.y,
        heading: 0,
        vx: 0,
        vy: 0,
        throttle: 0,
        rudder: 0,
        turn: 0,
      });
    });
    await action('cycleDiver');
    await action('recoverDiver');
    await page.waitForFunction(() => urchinDebug.world.divers.every((d) => d.state === 'ready'));
    assert.equal(await page.evaluate(() => urchinDebug.world.bags.length), 3);
    assert(await page.evaluate(() => urchinDebug.audio.played > 3));
    await page.screenshot({ path: 'test-results/prototype-loaded-deck.png' });
    console.log(
      'Prototype: independent grounds, realistic presentation, targeted bag/boarding and audio events',
    );
    // Capacity fixture: actual controller boarding remains possible with overflow.
    await action('debug');
    await menu();
    await choose('Test pickup: two full bags / 100 lb free');
    await page.waitForFunction(() => urchinDebug.ready && !urchinDebug.ui.blocked);
    // Reset prepares a new scene; let its ready transition release the input gate.
    await page.waitForFunction(() => urchinDebug.ui.lastReady && !urchinDebug.input.suppressed);
    await page.waitForFunction(() =>
      document.querySelector('#help').textContent.includes('Recover Diver'),
    );
    await action('recoverDiver');
    await page.waitForFunction(() => urchinDebug.world.divers[0].state === 'ready');
    assert.equal(await page.evaluate(() => urchinDebug.world.catch), 5000);
    assert.equal(await page.evaluate(() => urchinDebug.world.discarded), 200);
    assert.match(await page.locator('#message').textContent(), /200 lb EXCESS CATCH RELEASED/);
    await action('cycleDiver');
    await action('recoverDiver');
    await page.waitForFunction(() => urchinDebug.world.divers.every((d) => d.state === 'ready'));
    assert.equal(await page.evaluate(() => urchinDebug.world.discarded), 500);
    await action('debug');
    // Mute and restored-volume preferences are exercised through the real pause menu.
    await menu();
    for (
      let attempt = 0;
      attempt < 5 && (await page.evaluate(() => urchinDebug.audio.volume !== 0));
      attempt++
    )
      await choose('Sound volume:');
    assert.equal(await page.evaluate(() => localStorage.getItem('urchin-volume')), '0');
    const played = await page.evaluate(() => urchinDebug.audio.played);
    await page.evaluate(() => urchinDebug.world.effects.push({ type: 'bag', weight: 1 }));
    await page.waitForFunction(() => urchinDebug.world.effects.length === 0);
    assert.equal(await page.evaluate(() => urchinDebug.audio.played), played);
    await choose('Sound volume:');
    await choose('Sound volume:');
    assert.equal(await page.evaluate(() => urchinDebug.audio.volume), 0.35);
    await choose('Resume');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    // Keyboard arrows point without silently changing the quality preset.
    await page.keyboard.press('b');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'instructions');
    const quality = await page.evaluate(() => urchinDebug.ui.draft.quality);
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => urchinDebug.ui.draft.direction === 7);
    assert.equal(await page.evaluate(() => urchinDebug.ui.draft.quality), quality);
    await page.keyboard.press('PageUp');
    await page.waitForFunction((q) => urchinDebug.ui.draft.quality !== q, quality);
    await page.keyboard.press('Enter');
    // Keep pointing until the frame that consumes Confirm; centring cancels the bearing.
    await page.waitForFunction(() => urchinDebug.ui.screen !== 'instructions');
    await page.keyboard.up('ArrowLeft');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.direction), 7);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), 0);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.rudder), 0);
    // Complete both sides of the exact deadline through the physical harbour edge.
    for (const late of [false, true]) {
      await page.evaluate(() => urchinDebug.reset({ practice: false }));
      await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
      await choose('Outer Ledge');
      await choose('Begin working day');
      await page.waitForFunction(() => !urchinDebug.ui.blocked);
      await page.evaluate((late) => {
        const w = urchinDebug.world;
        w.day.minute = 960 + (late ? 1 : 0) - 0.5 / 60;
        w.catch = 300;
        w.bags = [{ weight: 300, quality: 0.8 }];
        Object.assign(w.boat, {
          x: 300,
          y: w.terrain.size - 0.005,
          heading: Math.PI,
          vx: 0,
          vy: 1,
          throttle: 1,
          rudder: 0,
          turn: 0,
        });
      }, late);
      await page.waitForFunction(() => urchinDebug.world.day.phase === 'complete');
      assert.equal(await page.evaluate(() => urchinDebug.world.day.result.onTime), !late);
      assert.equal(await page.evaluate(() => urchinDebug.world.day.offloaded), 300);
      assert.equal(await page.evaluate(() => urchinDebug.world.catch), 0);
      await page.screenshot({
        path: `test-results/prototype-day-${late ? 'late' : 'success'}.png`,
      });
      assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'summary');
      const time = await page.evaluate(() => urchinDebug.world.time);
      await button(12);
      await page.waitForTimeout(80);
      assert.equal(await page.evaluate(() => urchinDebug.world.time), time);
      await choose('Start a new day');
      await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS: two-diver prototype, compass hold/tap/touch/deadzone/cancel, sound unlock/events/mute, chart travel, mode privacy, adjacent-float targeting, debug overflow recovery, exact 19:00 offload, delayed shipping, physical harbour exit and new day.',
    );
  } catch (error) {
    await page.screenshot({ path: 'test-results/prototype-failure.png' }).catch(() => {});
    const state = await page
      .evaluate(() =>
        window.urchinDebug
          ? {
              screen: urchinDebug.ui.screen,
              lock: urchinDebug.ui.lockReason,
              day: urchinDebug.world.day,
              divers: urchinDebug.world.divers,
              selected: urchinDebug.world.selectedDiverId,
            }
          : {},
      )
      .catch(() => ({}));
    writeFileSync(
      'test-results/prototype-failure.json',
      JSON.stringify({ error: error.message, errors, state }, null, 2),
    );
    throw error;
  } finally {
    await page.close();
  }
}
