import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gamepadScript, pressAction } from './gamepad-fixture.js';

export async function diverOperationsChecks(browser) {
  const output = 'test-results/diver-operations';
  mkdirSync(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true }),
    errors = [],
    records = [];
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (entry) => {
    if (entry.type() === 'error') errors.push(entry.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  async function stageRecovery() {
    await page.evaluate(() => {
      const w = urchinDebug.world;
      urchinDebug.ui.importantNotice = null;
      urchinDebug.ui.seaMessages?.clear();
      w.career.intro.status = 'complete';
      w.day.phase = 'working';
      w.day.crewRest = 0;
      // Isolate deck operations from the tutorial's seeded patrol arrival.
      w.day.inspection = { status: 'cleared' };
      w.career.trafficSettings = { rate: 0 };
      if (w.traffic) w.traffic.actors = [];
      Object.assign(w.boat, {
        vx: 0,
        vy: 0,
        throttle: 0,
        rudder: 0,
        heading: 0,
        turn: 0,
        speed: 0,
        grounded: false,
      });
      Object.assign(w.divers[0], {
        state: 'surface',
        x: w.boat.x - 4,
        y: w.boat.y,
        bag: 150,
        qualitySum: 120,
        air: 70,
        hook: 0,
        hooking: false,
        recoveryAction: null,
        recoveryPause: '',
        bagHandled: false,
        transit: null,
        condition: 'fit',
        reason: 'Bag full',
        speech: null,
      });
      w.divers[1].state = 'ready';
      w.selectedDiverId = 1;
    });
  }
  try {
    // Other agents may edit the dev server during this isolated review. Keep the
    // modules loaded for this page stable; production verification has no HMR.
    await page.routeWebSocket('**', (socket) => {
      const server = socket.connectToServer();
      server.onMessage(() => {});
    });
    await page.addInitScript(gamepadScript, {
      name: 'diverPad',
      id: 'Diver Operations Synthetic Xbox',
    });
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    console.log('Diver operations: title ready');
    await page.locator('#keyboardFallback').click({ noWaitAfter: true });
    await page
      .getByRole('button', { name: 'Come aboard · learn with Frank', exact: true })
      .click({ noWaitAfter: true });
    await page.waitForFunction(() => !urchinDebug.ui.screen);
    console.log('Diver operations: at sea');
    await page.keyboard.press('Space');
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => urchinDebug.world.divers[0].state === 'deploying');
    records.push(
      await page.evaluate(() => ({
        kind: 'keyboard-deployment',
        transit: urchinDebug.world.divers[0].transit,
      })),
    );
    await page.screenshot({ path: `${output}/keyboard-preparing.png` });
    await page.waitForFunction(() =>
      ['searching', 'harvesting'].includes(urchinDebug.world.divers[0].state),
    );
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), 0);
    await page.screenshot({ path: `${output}/keyboard-underwater-neutral.png` });
    await stageRecovery();
    const firstCatch = await page.evaluate(() => urchinDebug.world.catch);
    await pressAction(page, 'diverPad', 'recoverDiver');
    await page.waitForFunction(() => urchinDebug.world.divers[0].hooking);
    await page.screenshot({ path: `${output}/controller-approach.png` });
    await page.waitForFunction(() => urchinDebug.world.divers[0].state === 'ready', null, {
      timeout: 15000,
    });
    assert.equal(await page.evaluate(() => urchinDebug.world.catch), firstCatch + 150);
    records.push({
      kind: 'synthetic-controller-port-recovery',
      catchAdded: 150,
      physicalController: false,
    });
    console.log('Diver operations: controller recovery passed');
    await stageRecovery();
    await page.evaluate(() => urchinDebug.ui.touch.setEnabled(true));
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(200);
    records.push(
      await page.evaluate(() => ({
        kind: 'touch-setup',
        screen: urchinDebug.ui.screen,
        enabled: urchinDebug.input.touchEnabled,
        device: urchinDebug.input.lastDevice,
        hidden: document.getElementById('touchControls').hidden,
      })),
    );
    await page.waitForFunction(() => !document.getElementById('touchControls').hidden);
    await page.locator('[data-touch="recoverDiver"]').tap();
    await page.waitForFunction(() => urchinDebug.world.divers[0].hooking);
    await page.waitForFunction(() => {
      const speech = document.getElementById('seaSpeech');
      return speech && !speech.hidden && /ladder|recovery|climbing/i.test(speech.textContent);
    });
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.getElementById('help')).display),
      'none',
      'brief recovery speech replaces the overlapping compact helm primer',
    );
    assert(
      await page.locator('#message').evaluate((element) => element.hidden),
      'the obsolete permanent pickup panel must stay hidden',
    );
    await page.screenshot({ path: `${output}/touch-port-recovery.png` });
    await page.waitForFunction(() => urchinDebug.world.divers[0].state === 'ready', null, {
      timeout: 15000,
    });
    assert.equal(await page.evaluate(() => urchinDebug.world.catch), firstCatch + 300);
    await page.waitForFunction(
      () =>
        !urchinDebug.world.career.assists.controlsHelp ||
        (document.getElementById('seaSpeech').hidden &&
          getComputedStyle(document.getElementById('help')).display !== 'none'),
    );
    records.push({ kind: 'native-touch-port-recovery', catchAdded: 150 });
    console.log('Diver operations: touch recovery passed');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      const debug = urchinDebug,
        w = debug.world,
        renderer = debug.three;
      renderer.host.scene.pause();
      debug.ui.touch.setEnabled(false);
      renderer.host.cameras.main.setZoom(3.7);
      document.querySelectorAll('body > *:not(#game)').forEach((element) => {
        element.style.display = 'none';
      });
      document.querySelectorAll('#game > *:not(#ocean3d)').forEach((element) => {
        element.style.display = 'none';
      });
      w.career.intro.status = 'complete';
      w.weather = {
        night: false,
        visibility: 1000,
        kind: 'clear',
        wave: 0.1,
        rain: 0,
        sunlight: 1,
      };
      w.environment.waves = w.environment.waveHeight = 0;
      Object.assign(w.boat, { heading: 0, vx: 0, vy: 0, throttle: 0, turn: 0, speed: 0 });
      Object.assign(w.divers[0], {
        state: 'surfacing',
        transit: { kind: 'ascent', depth: 7, total: 5 },
        x: w.boat.x - 6,
        y: w.boat.y + 0.5,
        hook: 0,
        hooking: false,
        recoveryAction: null,
        speech: null,
      });
      w.divers[1].state = 'ready';
    });
    for (const depth of [0, 1, 2, 3.5, 5]) {
      const record = await page.evaluate((depth) => {
        const debug = urchinDebug,
          w = debug.world;
        w.divers[0].timer = (depth / 7) * 5;
        debug.three.draw(w, debug.ui, 0);
        const visual = debug.three.vessels.divers[0];
        return {
          kind: 'frozen-depth-fixture',
          requestedDepth: depth,
          pose: visual.group.userData.motion,
          visible: visual.group.visible,
          contrast: visual.group.userData.contrast,
        };
      }, depth);
      assert(Math.abs(record.pose.depth - depth) < 0.001, JSON.stringify(record));
      assert.equal(record.visible, depth < 5);
      records.push(record);
      await page.screenshot({
        path: `${output}/column-${String(depth).replace('.', '-')}-metres.png`,
      });
    }
    // Judge the two-metre target at playable zooms as well as the enlarged
    // inspection captures; a technically visible mesh can still be unreadable.
    for (const zoom of [2.2, 1.1]) {
      await page.evaluate((zoom) => {
        const debug = urchinDebug;
        debug.world.divers[0].timer = (2 / 7) * 5;
        debug.three.host.cameras.main.setZoom(zoom);
        debug.three.draw(debug.world, debug.ui, 0);
      }, zoom);
      await page.screenshot({ path: `${output}/column-2-metres-zoom-${zoom}.png` });
    }
    await page.evaluate(() => urchinDebug.three.host.cameras.main.setZoom(3.7));
    for (const phase of ['preparing', 'entering', 'descending', 'hauling', 'boarding', 'stowing']) {
      const record = await page.evaluate((phase) => {
        const debug = urchinDebug,
          w = debug.world,
          d = w.divers[phase === 'stowing' ? 1 : 0],
          spec = debug.simulation.boatSpec(w);
        d.x = w.boat.x - spec.width / 2 - 2;
        d.y = w.boat.y;
        if (phase === 'stowing') {
          w.divers[0].state = 'ready';
          Object.assign(d, { state: 'ready', transit: null, deckWalkStarted: w.time - 0.2 });
        } else if (phase === 'boarding' || phase === 'hauling') {
          Object.assign(d, {
            state: 'surface',
            x: w.boat.x - spec.width / 2 - 0.6,
            y: w.boat.y + spec.length * 0.08,
            hooking: true,
            hook: phase === 'boarding' ? 4.6 : 1.4,
            hookSeconds: 3,
            recoveryAction: 'recoverDiver',
            bagHandled: false,
            bag: 150,
            transit: null,
          });
        } else {
          d.state = 'deploying';
          d.transit = {
            kind: 'descent',
            fromDeck: true,
            depth: 7,
            total: 2,
            prepareSeconds: 0.95,
            entrySeconds: 0.35,
            heading: -Math.PI / 2,
          };
          d.timer = phase === 'preparing' ? 1.5 : phase === 'entering' ? 0.86 : 0.4;
        }
        debug.three.draw(w, debug.ui, 0);
        return {
          kind: 'frozen-phase-fixture',
          phase,
          pose: debug.three.vessels.divers[d.id].group.userData.motion,
        };
      }, phase);
      assert.equal(record.pose.phase, phase);
      records.push(record);
      await page.screenshot({ path: `${output}/phase-${phase}.png` });
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS diver operations: actual keyboard deployment, synthetic-controller and native-touch recovery; frozen depth/phase renderer evidence.',
    );
  } catch (error) {
    records.push(
      await page
        .evaluate(() => ({
          kind: 'failure-state',
          time: urchinDebug.world.time,
          screen: urchinDebug.ui.screen,
          lock: urchinDebug.ui.lockReason,
          boat: urchinDebug.world.boat,
          divers: urchinDebug.world.divers.map(
            ({ state, x, y, hook, hooking, recoveryPause, recoveryAction, condition }) => ({
              state,
              x,
              y,
              hook,
              hooking,
              recoveryPause,
              recoveryAction,
              condition,
            }),
          ),
        }))
        .catch(() => ({ kind: 'failure-state-unavailable' })),
    );
    await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
    throw error;
  } finally {
    writeFileSync(
      `${output}/results.json`,
      JSON.stringify(
        {
          records,
          errors,
          limits:
            'Depth/phase screenshots are isolated presentation fixtures. Controller coverage uses synthetic browser input, not physical hardware.',
        },
        null,
        2,
      ),
    );
    await page.close();
  }
}
