import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { FLEET } from '../src/career-data.js';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/',
  output = process.env.URCHIN_HUD_REVIEW_OUTPUT || 'test-results/ui-overhaul/hud-context',
  startedAt = new Date().toISOString(),
  results = [],
  matrixFailures = [],
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
async function stage(page, scenario, tutorial = true, options = {}) {
  const status = await page.evaluate(
    ({ scenario, tutorial, options }) => {
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
        heading: options.heading || 0,
        vx: 0,
        vy: 0,
        throttle: 0,
        rudder: 0,
        speed: 0,
        turn: 0,
        grounded: false,
      });
      if (options.configuration) {
        w.boat.configuration = options.configuration;
        w.boat.fuel = options.fuel;
        w.career.activeBoat = options.configuration;
        w.career.fleet[options.configuration] ??= {
          id: options.configuration,
          lost: false,
          equipment: [],
          hullHealth: 1,
          driveHealth: 1,
          fuel: options.fuel,
        };
      }
      if (options.zoom) debug.three.host.cameras.main.setZoom(options.zoom);
      const side =
        (scenario === 'wrong-side' ? 1 : -1) * (debug.simulation.boatSpec(w).width / 2 + 1);
      Object.assign(w.divers[0], {
        state: 'surface',
        condition: 'fit',
        depth: 0,
        bag: 30,
        qualitySum: 24,
        x: w.boat.x + side * Math.cos(w.boat.heading),
        y: w.boat.y + side * Math.sin(w.boat.heading),
        heading: w.boat.heading,
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
      Object.assign(w.divers[1], {
        state: 'ready',
        speech: null,
        bag: 0,
        qualitySum: 0,
        hook: 0,
        hooking: false,
        recoveryAction: null,
      });
      if (options.twoFloats)
        Object.assign(w.divers[1], {
          state: 'surface',
          condition: 'fit',
          depth: 0,
          bag: 30,
          qualitySum: 24,
          x: w.divers[0].x + Math.sin(w.boat.heading) * 3,
          y: w.divers[0].y - Math.cos(w.boat.heading) * 3,
          heading: w.boat.heading,
          hook: 0,
          hooking: false,
          recoveryAction: null,
          recoveryPause: '',
          bagHandled: false,
          transit: null,
          reason: 'Bag full',
          air: 50,
        });
      w.selectedDiverId = w.divers[0].id;
      w.catch = 0;
      w.bags = [];
      if (options.bagCount) {
        const weight = debug.simulation.boatSpec(w).capacity / (2 * options.bagCount);
        w.bags = Array.from({ length: options.bagCount }, () => ({ weight, quality: 0.8 }));
        w.catch = weight * options.bagCount;
      }
      debug.ui.importantNotice = null;
      debug.ui.seaMessages?.clear();
      return debug.simulation.recoveryStatus(w, undefined, w.divers[0]);
    },
    {
      scenario,
      tutorial,
      options: { ...options, fuel: FLEET[options.configuration]?.fuelCapacity },
    },
  );
  assert.equal(status.available, scenario === 'ready');
  if (scenario === 'wrong-side') assert.match(status.reason, /PORT SIDE/);
  await page.waitForFunction(
    ({ scenario, tutorial }) => {
      const panel = document.querySelector('#seaSpeech'),
        entry = urchinDebug.ui.seaMessages?.get('pickup');
      if (
        !entry ||
        !panel ||
        panel.hidden ||
        ![entry.text, entry.compactText].includes(panel.textContent)
      )
        return false;
      return scenario === 'ready'
        ? panel.textContent.includes(tutorial ? 'is alongside' : 'RECOVERY AVAILABLE')
        : tutorial
          ? panel.textContent.includes('port ladder')
          : /port/i.test(panel.textContent);
    },
    { scenario, tutorial },
  );
  return status;
}

async function capture(page, name, { tutorial = true, custom = false, screenshot = true } = {}) {
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
    // Inspect the rendered meshes independently of the placement algorithm.
    // A centre point misses a covered bow, cabin or port ladder at close zoom.
    const projectedBounds = (group, instances = false) => {
      const points = [];
      group.updateWorldMatrix(true, true);
      group.traverseVisible((part) => {
        if (!part.isMesh || !part.geometry || !!part.isInstancedMesh !== instances) return;
        part.geometry.computeBoundingBox();
        const box = part.geometry.boundingBox,
          transform = part.matrixWorld.clone(),
          instance = part.matrixWorld.clone();
        for (let i = 0; i < (part.isInstancedMesh ? part.count : 1); i++) {
          if (part.isInstancedMesh) {
            part.getMatrixAt(i, instance);
            transform.multiplyMatrices(part.matrixWorld, instance);
          }
          for (const x of [box.min.x, box.max.x])
            for (const y of [box.min.y, box.max.y])
              for (const z of [box.min.z, box.max.z]) {
                const point = part.position.clone().set(x, y, z).applyMatrix4(transform);
                points.push(debug.three.project(point.x, point.z, point.y));
              }
        }
      });
      return points.length
        ? {
            left: Math.min(...points.map((p) => p.x)),
            right: Math.max(...points.map((p) => p.x)),
            top: Math.min(...points.map((p) => p.y)),
            bottom: Math.max(...points.map((p) => p.y)),
          }
        : null;
    };
    const hullBounds = projectedBounds(debug.three.vessels.boat),
      // A single union of a tall load and a wide hull invents solid empty
      // corners beside the stack. Measure these independent rendered groups.
      loadBounds = projectedBounds(debug.three.vessels.boat, true),
      surfaceBounds = debug.three.vessels.divers.flatMap((visual, i) =>
        w.divers[i].state === 'surface' && visual.group.visible
          ? [projectedBounds(visual.group)]
          : [],
      ),
      boundsClear = (bounds) =>
        !bounds ||
        bounds.right <= rect.left - 3 ||
        bounds.left >= rect.right + 3 ||
        bounds.bottom <= rect.top - 3 ||
        bounds.top >= rect.bottom + 8;
    // The bubble is pointer-transparent normally. Brief hit tests check actual
    // paint order, including Frank's high-z-index card, then restore behavior.
    const previousPointer = speech.style.pointerEvents;
    speech.style.pointerEvents = 'auto';
    const above = [0.2, 0.5, 0.8].every(
      (fraction) =>
        document.elementFromPoint(rect.left + rect.width * fraction, rect.top + rect.height / 2) ===
        speech,
    );
    const coveredBy = [0.2, 0.5, 0.8].map((fraction) => {
      const hit = document.elementFromPoint(
        rect.left + rect.width * fraction,
        rect.top + rect.height / 2,
      );
      return hit === speech ? 'speech' : `${hit?.tagName}#${hit?.id}.${hit?.className}`;
    });
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
    const actionRects = [
      ...document.querySelectorAll(
        '#keyboardHelm .helm-key, #keyboardHelm button, #touchControls button, #touchControls .touch-stick, #touchMenu, #touchHudToggle, #touchLockToggle',
      ),
    ].flatMap((element) => {
      const r = element.getBoundingClientRect(),
        style = getComputedStyle(element);
      return element.hidden ||
        !r.width ||
        !r.height ||
        (!element.textContent.trim() && !element.matches('.touch-stick')) ||
        style.display === 'none' ||
        style.visibility === 'hidden'
        ? []
        : [{ label: element.textContent.trim(), rect: r.toJSON() }];
    });
    return {
      viewport: [innerWidth, innerHeight],
      configuration: w.boat.configuration,
      heading: w.boat.heading,
      zoom: debug.zoom,
      bagCount: w.bags.length,
      touch: debug.input.touchEnabled,
      text: speech.textContent,
      rect: rect.toJSON(),
      above,
      coveredBy,
      float,
      boat,
      floatClear: clear(float),
      boatClear: clear(boat),
      hullBounds,
      loadBounds,
      surfaceBounds,
      hullClear: boundsClear(hullBounds),
      loadClear: boundsClear(loadBounds),
      surfacedPeopleClear: surfaceBounds.every(boundsClear),
      actionRects,
      actionsClear: actionRects.every((action) => boundsClear(action.rect)),
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
  if (screenshot) await page.screenshot({ path: output + '/' + name + '.png' });
  assert(measurement.oldPanelHidden, 'Retired large recovery panel stays hidden');
  assert(measurement.above, 'Speech paints above cards: ' + measurement.coveredBy.join(' | '));
  assert(measurement.rect.left >= 0 && measurement.rect.top >= 0);
  assert(measurement.rect.right <= measurement.viewport[0] + 1);
  assert(measurement.rect.bottom <= measurement.viewport[1] + 1);
  if (!custom) {
    assert(measurement.floatClear, name + ': speech leaves the selected float clear');
    assert(measurement.boatClear, name + ': speech leaves the boat centre clear');
    if (!tutorial) {
      assert(measurement.hullClear, name + ': speech leaves the full rendered boat/ladder clear');
      assert(measurement.loadClear, name + ': speech leaves the actual deck load clear');
      assert(
        measurement.surfacedPeopleClear,
        name + ': speech leaves surfaced people/floats clear',
      );
      assert(measurement.actionsClear, name + ': speech leaves action labels and controls clear');
    }
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

    if (process.env.URCHIN_SPEECH_MATRIX === '1') {
      const capturedFailures = new Set();
      for (const configuration of Object.keys(FLEET))
        for (const heading of Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4))
          for (const zoom of [0.4, 1.1, 2.2]) {
            await stage(page, 'wrong-side', false, {
              configuration,
              heading,
              zoom,
              twoFloats: true,
            });
            const label = `${name}-${configuration}-${Math.round((heading * 180) / Math.PI)}deg-${zoom}zoom`;
            try {
              await capture(page, label, {
                tutorial: false,
                screenshot:
                  ['basic', 'twinjet-sister'].includes(configuration) &&
                  zoom === 2.2 &&
                  heading <= Math.PI / 2,
              });
            } catch (error) {
              matrixFailures.push({ name: label, message: error.message });
              if (!capturedFailures.has(configuration)) {
                await page.screenshot({ path: output + '/' + label + '-failure.png' });
                capturedFailures.add(configuration);
              }
            }
          }
      const failed = matrixFailures.filter((entry) => entry.name.startsWith(name)).length;
      console.log(
        `${name}: all twelve hulls, eight headings and three zoom levels checked; ${failed} failures`,
      );
      // Catch bags are instanced and can grow beyond the fixed rig envelope.
      // Change the load without replacing the model to exercise cache refresh.
      for (const configuration of ['outboard', 'twinjet-sister'])
        for (const heading of [0, Math.PI / 4, Math.PI / 2, Math.PI])
          for (const bagCount of [0, 160, 1, 0]) {
            await stage(page, 'wrong-side', false, {
              configuration,
              heading,
              zoom: 2.2,
              twoFloats: true,
              bagCount,
            });
            const label = `${name}-${configuration}-${Math.round((heading * 180) / Math.PI)}deg-${bagCount}bags`;
            try {
              await capture(page, label, {
                tutorial: false,
                screenshot: bagCount === 160 && heading <= Math.PI / 4,
              });
            } catch (error) {
              matrixFailures.push({ name: label, message: error.message });
              if (!capturedFailures.has(configuration + '-load')) {
                await page.screenshot({ path: output + '/' + label + '-failure.png' });
                capturedFailures.add(configuration + '-load');
              }
            }
          }
      await stage(page, 'wrong-side', false, {
        configuration: 'twinjet-sister',
        heading: Math.PI / 4,
        zoom: 2.2,
        twoFloats: true,
      });
      const activeSpeechSample = await page.evaluate(async () => {
        const renderer = urchinDebug.three.renderer,
          startFrame = renderer.info.render.frame,
          start = performance.now();
        urchinDebug.resetRenderSamples();
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const elapsed = performance.now() - start,
          frames = renderer.info.render.frame - startFrame;
        return {
          elapsed,
          frames,
          fps: (frames * 1000) / elapsed,
          speechVisible: !document.querySelector('#seaSpeech').hidden,
          samples: urchinDebug.renderSamples,
        };
      });
      results.push({ name, kind: 'active-speech-performance', ...activeSpeechSample });
      assert(activeSpeechSample.speechVisible, 'Performance sample includes the active notice');
      if (activeSpeechSample.fps < 40)
        matrixFailures.push({
          name: name + '-active-speech-performance',
          message: `Speech placement below 40 FPS: ${activeSpeechSample.fps}`,
        });
      await page.evaluate(() => {
        urchinDebug.world.boat.throttle = 0.2;
        urchinDebug.world.boat.rudder = 0.3;
      });
      assert(await page.locator('#seaSpeech').isVisible());
      if (touch) {
        await page.locator('[data-touch="neutral"]').tap();
        await page.locator('[data-touch="centerRudder"]').tap();
      } else {
        await page.keyboard.press('KeyX');
        await page.keyboard.press('Enter');
      }
      await page.waitForFunction(
        () => urchinDebug.world.boat.throttle === 0 && urchinDebug.world.boat.rudder === 0,
      );
      assert(await page.locator('#seaSpeech').isVisible(), 'Helm commands finish during speech');
      results.push({ name, kind: 'native-helm-during-large-hull-speech', touch, passed: true });
    }

    await stage(page, 'ready', true, { configuration: 'basic', heading: 0, zoom: 1.1 });
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
  assert.equal(
    matrixFailures.length,
    0,
    `${matrixFailures.length} speech clearance cases failed; see receipt and captured examples`,
  );
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
        matrixFailures,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  await browser.close();
}
