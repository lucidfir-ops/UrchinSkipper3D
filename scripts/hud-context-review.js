import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/',
  output = process.env.URCHIN_HUD_REVIEW_OUTPUT || 'test-results/ui-overhaul/hud-context',
  startedAt = new Date().toISOString(),
  results = [],
  errors = [];
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
let passed = false,
  failure = null;

// Explicit presentation fixtures after the actual tutorial start. Flat, calm
// water isolates HUD states; real keyboard/touch input starts real boarding.
async function stage(page, scenario, tutorial = true) {
  const status = await page.evaluate(
    ({ scenario, tutorial }) => {
      const debug = urchinDebug,
        w = debug.world;
      w.career.intro.status = tutorial ? 'active' : 'complete';
      w.career.intro.step = 8;
      w.career.intro.scoutSeconds = 0;
      w.career.assists.actionPrompts = true;
      w.career.assists.controlsHelp = false;
      w.career.assists.widePickup = true;
      w.career.trafficSettings = { rate: 0 };
      w.day.phase = 'practice';
      w.day.minute = 600;
      w.day.inspection = { status: 'cleared' };
      w.day.crewRest = 0;
      w.terrain.depths = w.terrain.depths.map(() => 20);
      w.patches = [];
      w.rocks = [];
      w.logs = [];
      w.debris = [];
      w.traffic = null;
      w.environment = {
        model: 'uniform',
        seaLevel: 0,
        current: { x: 0, y: 0 },
        wind: { x: 0, y: 0 },
        waves: 0,
      };
      Object.assign(w.boat, {
        heading: 0,
        vx: 0,
        vy: 0,
        throttle: 0,
        rudder: 0,
        speed: 0,
        turn: 0,
        grounded: false,
      });
      Object.assign(w.divers[0], {
        state: 'surface',
        condition: 'fit',
        depth: 0,
        bag: 30,
        qualitySum: 24,
        x:
          w.boat.x +
          (scenario === 'wrong-side' ? 1 : -1) * (debug.simulation.boatSpec(w).width / 2 + 1),
        y: w.boat.y,
        hook: 0,
        hooking: false,
        recoveryAction: null,
        recoveryPause: '',
        bagHandled: false,
        transit: null,
        reason: 'Bag full',
        air: 50,
        speech: null,
      });
      Object.assign(w.divers[1], { state: 'ready', speech: null });
      w.selectedDiverId = w.divers[0].id;
      w.catch = 0;
      w.bags = [];
      debug.ui.importantNotice = null;
      debug.ui.seaMessages?.clear();
      return debug.simulation.recoveryStatus(w, undefined, w.divers[0]);
    },
    { scenario, tutorial },
  );
  assert.equal(status.available, scenario === 'ready');
  if (scenario === 'wrong-side') assert.match(status.reason, /PORT SIDE/);
  await page.waitForFunction(
    ({ scenario, tutorial }) => {
      const panel = document.querySelector('#seaSpeech'),
        entry = urchinDebug.ui.seaMessages?.get('pickup');
      if (!entry || !panel || panel.hidden || panel.textContent !== entry.text) return false;
      return scenario === 'ready'
        ? panel.textContent.includes(tutorial ? 'is alongside' : 'RECOVERY AVAILABLE')
        : panel.textContent.includes(tutorial ? 'port ladder' : 'PORT SIDE');
    },
    { scenario, tutorial },
  );
  return status;
}

async function capture(page, name, { tutorial = true, custom = false } = {}) {
  const measurement = await page.evaluate(() => {
    const debug = urchinDebug,
      w = debug.world,
      speech = document.querySelector('#seaSpeech'),
      rect = speech.getBoundingClientRect(),
      frank = document.querySelector('#frankAboard'),
      frankRect = frank.getBoundingClientRect(),
      crew = document.querySelector('#diverPanel'),
      crewRect = crew.getBoundingClientRect(),
      boat = debug.three.project(w.boat.x, w.boat.y),
      float = debug.three.project(w.divers[0].x, w.divers[0].y),
      clear = (p) =>
        p.x < rect.left - 5 || p.x > rect.right + 5 || p.y < rect.top - 5 || p.y > rect.bottom + 5;
    // The bubble is pointer-transparent normally. Brief hit tests check actual
    // paint order, including Frank's high-z-index card, then restore behavior.
    const previousPointer = speech.style.pointerEvents;
    speech.style.pointerEvents = 'auto';
    const above = [0.2, 0.5, 0.8].every(
      (fraction) =>
        document.elementFromPoint(rect.left + rect.width * fraction, rect.top + rect.height / 2) ===
        speech,
    );
    speech.style.pointerEvents = previousPointer;
    const touchActions = [
      ...document.querySelectorAll(
        '#touchControls button, #touchMenu, #touchHudToggle, #touchLockToggle',
      ),
    ].flatMap((button) => {
      const r = button.getBoundingClientRect(),
        style = getComputedStyle(button);
      return button.hidden || !r.width || style.display === 'none' || style.visibility === 'hidden'
        ? []
        : [{ label: button.textContent, width: r.width, height: r.height }];
    });
    return {
      viewport: [innerWidth, innerHeight],
      touch: debug.input.touchEnabled,
      text: speech.textContent,
      rect: rect.toJSON(),
      above,
      float,
      boat,
      floatClear: clear(float),
      boatClear: clear(boat),
      frankVisible: !frank.hidden,
      frank: frankRect.toJSON(),
      crewVisible: !crew.hidden && crewRect.width > 0 && crewRect.height > 0,
      crew: crewRect.toJSON(),
      crewClear:
        frankRect.right <= crewRect.left ||
        crewRect.right <= frankRect.left ||
        frankRect.bottom <= crewRect.top ||
        crewRect.bottom <= frankRect.top,
      oldPanelHidden: document.querySelector('#message').hidden,
      operation: {
        state: w.divers[0].state,
        action: w.divers[0].recoveryAction,
        hooking: w.divers[0].hooking,
        hook: w.divers[0].hook,
        phase: debug.three.vessels.divers[0].group.userData.motion.phase,
      },
      touchActions,
    };
  });
  results.push({ name, ...measurement });
  await page.screenshot({ path: output + '/' + name + '.png' });
  assert(measurement.oldPanelHidden, 'Retired large recovery panel stays hidden');
  assert(measurement.above, 'Speech paints above cards');
  assert(measurement.rect.left >= 0 && measurement.rect.top >= 0);
  assert(measurement.rect.right <= measurement.viewport[0] + 1);
  assert(measurement.rect.bottom <= measurement.viewport[1] + 1);
  if (!custom) {
    assert(measurement.floatClear, name + ': speech leaves the selected float clear');
    assert(measurement.boatClear, name + ': speech leaves the boat centre clear');
    if (measurement.frankVisible && measurement.crewVisible)
      assert(measurement.crewClear, name + ': default Frank and crew cards do not overlap');
  }
  if (tutorial) {
    assert(measurement.frankVisible);
    assert(
      measurement.rect.top <= measurement.frank.top,
      'Tutorial speech stays at Frank’s upper edge',
    );
  } else assert(!measurement.frankVisible);
  if (measurement.touch) {
    assert(measurement.touchActions.length >= 12);
    assert(
      measurement.touchActions.every((button) => button.width >= 43.9 && button.height >= 43.9),
      'Visible on-water touch actions keep 44px targets',
    );
  }
  return measurement;
}

async function activate(page, locator, touch) {
  await locator[touch ? 'tap' : 'click']();
}

try {
  for (const [name, width, height, touch] of [
    ['keyboard-desktop', 1280, 800, false],
    ['keyboard-compact', 844, 390, false],
    ['touch-phone', 390, 844, true],
    ['touch-landscape', 844, 390, true],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch }),
      page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
    });
    const response = await page.goto(base);
    if (process.env.URCHIN_PRODUCTION_TEST === '1') {
      assert.equal(response.headers()['x-urchin-build'], 'production');
      assert.equal(response.headers()['x-urchin-edition'], 'three');
    }
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    if (touch) {
      await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
      await page.getByRole('switch', { name: 'Touchscreen mode: OFF', exact: true }).tap();
      await page.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
    }
    await activate(page, page.locator('#keyboardFallback'), touch);
    await activate(
      page,
      page.getByRole('button', { name: 'Come aboard · learn with Frank', exact: true }),
      touch,
    );
    await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
    for (const scenario of ['ready', 'wrong-side']) {
      await stage(page, scenario);
      const captureResult = await capture(page, name + '-tutorial-' + scenario);
      assert.match(
        captureResult.text,
        scenario === 'ready' ? /alongside.*bring aboard/ : /port ladder/,
      );
    }
    const speechKey = await page.evaluate(() => urchinDebug.ui.seaMessages.get('pickup').key);
    await page.waitForFunction(() => document.querySelector('#seaSpeech').hidden, null, {
      timeout: 4500,
    });
    assert.equal(
      await page.evaluate(() => urchinDebug.ui.seaMessages.get('pickup').key),
      speechKey,
      'Repeated recovery telemetry does not renew the expired 2.6-second HUD bubble',
    );
    results.push({ name, kind: 'semantic-speech-expiry', passed: true });

    await stage(page, 'ready');
    if (touch) await page.locator('[data-touch="recoverDiver"]').tap();
    else await page.keyboard.press('Digit1', { delay: 70 });
    await page.waitForFunction(() => urchinDebug.world.divers[0].hooking);
    await page.waitForFunction(() =>
      document.querySelector('#seaSpeech').textContent.includes('coming alongside'),
    );
    const boarding = await capture(page, name + '-native-boarding');
    assert.equal(boarding.operation.action, 'recoverDiver');
    assert(['approaching', 'hauling', 'boarding'].includes(boarding.operation.phase));
    await page.waitForFunction(() => urchinDebug.world.divers[0].state === 'ready', null, {
      timeout: 15000,
    });
    const landed = await page.evaluate(() => ({
      catch: urchinDebug.world.catch,
      bags: urchinDebug.world.bags.map((bag) => bag.weight),
    }));
    assert.deepEqual(landed, { catch: 30, bags: [30] });
    results.push({ name, kind: 'native-recovery-accounting', ...landed });

    await stage(page, 'wrong-side', false);
    await capture(page, name + '-career-speech', { tutorial: false });

    await stage(page, 'ready');
    const saved = await page.evaluate(() => {
      const ui = urchinDebug.ui,
        h = ui.hudWindows,
        entry = h.windows.get('frankAboard');
      h.move(entry, 18, 70);
      h.size(entry, Math.min(330, innerWidth - 36), 178);
      h.save();
      ui.hooks.save();
      return JSON.parse(localStorage.getItem('urchin-hud-layout-v1')).frankAboard[h.layout];
    });
    // Moving Frank updates CSS synchronously; its speech follows on the next
    // rendered frame. Wait for both visible geometries before measuring them.
    await page.waitForFunction(
      (saved) => {
        const rect = document.querySelector('#frankAboard').getBoundingClientRect(),
          panel = document.querySelector('#seaSpeech'),
          speech = panel.getBoundingClientRect();
        return (
          ['left', 'top', 'width', 'height'].every(
            (key) => Math.abs(rect[key] - saved[key]) <= 1,
          ) &&
          !panel.hidden &&
          speech.width <= rect.width + 1 &&
          Math.abs(speech.left + speech.width / 2 - (rect.left + rect.width / 2)) <= 1 &&
          speech.bottom <= rect.top
        );
      },
      saved,
      { timeout: 5000 },
    );
    await capture(page, name + '-custom-frank', { custom: true });
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    await activate(page, page.locator('#keyboardFallback'), touch);
    await page.waitForFunction(
      () => !urchinDebug.ui.screen && !document.querySelector('#frankAboard').hidden,
    );
    const restored = await page.evaluate(() => {
      const h = urchinDebug.ui.hudWindows,
        panel = document.querySelector('#frankAboard'),
        rect = panel.getBoundingClientRect();
      return {
        saved: JSON.parse(localStorage.getItem('urchin-hud-layout-v1')).frankAboard[h.layout],
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        custom: !panel.hasAttribute('data-default-position'),
      };
    });
    assert.deepEqual(restored.saved, saved);
    assert(restored.custom);
    for (const key of ['left', 'top', 'width', 'height'])
      assert(
        Math.abs(restored.rect[key] - saved[key]) <= 1,
        'Saved Frank ' + key + ' survives reload',
      );
    results.push({ name, kind: 'saved-custom-layout-reload', ...restored });
    await context.close();
    console.log('PASS ' + name + ': current speech, recovery, targets and saved layout');
  }
  assert.deepEqual(errors, []);
  passed = true;
} catch (error) {
  failure = error.stack || error.message;
  throw error;
} finally {
  writeFileSync(
    output + '/results.json',
    JSON.stringify(
      {
        passed,
        failure,
        base,
        startedAt,
        completedAt: new Date().toISOString(),
        production: process.env.URCHIN_PRODUCTION_TEST === '1',
        fixture:
          'Staged calm-water recovery and custom Frank geometry after actual tutorial entry; native keyboard/touch boarding and reload. Not a natural voyage or physical-device acceptance.',
        results,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  await browser.close();
}
