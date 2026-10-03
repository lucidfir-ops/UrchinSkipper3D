import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const output = process.env.URCHIN_TUTORIAL_OUTPUT || 'test-results/tutorial-retry-2026-10-02';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const errors = [],
  records = [];
const startedAt = new Date().toISOString();
let passed = false;
const url = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/';
async function tutorial(viewport = { width: 1280, height: 800 }, touch = false) {
  const page = await browser.newPage({ viewport, hasTouch: touch });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  if (touch) {
    await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
    await page.getByRole('switch', { name: 'Touchscreen mode: OFF', exact: true }).tap();
    await page.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
  }
  await page.locator('#keyboardFallback')[touch ? 'tap' : 'click']();
  const begin = page.getByRole('button', { name: 'Come aboard · learn with Frank', exact: true });
  await begin[touch ? 'tap' : 'click']();
  await page.waitForFunction(() => !urchinDebug.ui.screen);
  return page;
}
async function key(page, code, ms = 150) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
  await page.waitForTimeout(100);
}
async function capture(page, name) {
  await page.screenshot({ path: `${output}/${name}.png` });
}
async function read(page, name) {
  const record = await page.evaluate(() => ({
    step: urchinDebug.world.career.intro.step,
    markedCatch: !!urchinDebug.world.career.intro.markedCatch,
    catch: urchinDebug.world.catch,
    lesson: document.querySelector('#frankAboard')?.innerText,
    boat: { x: urchinDebug.world.boat.x, y: urchinDebug.world.boat.y },
    divers: urchinDebug.world.divers.map((d) => ({
      id: d.id,
      state: d.state,
      bag: d.bag,
      reason: d.reason,
      patch: d.patch?.id,
    })),
  }));
  records.push({ name, ...record });
  return record;
}
try {
  const page = await tutorial();
  // Recreate the measured approach from the independent keyboard playthrough.
  // Only the initial lesson/boat pose is staged; helm, deployment, search and
  // catch progression after this point are ordinary runtime actions.
  await page.evaluate(() => {
    const w = urchinDebug.world;
    w.career.intro.step = 4;
    Object.assign(w.boat, {
      x: 89.35097,
      y: 111.50986,
      heading: -0.52311,
      throttle: 0,
      rudder: 0,
      vx: 0,
      vy: 0,
      turn: 0,
    });
  });
  await page.waitForTimeout(250);
  assert.equal((await read(page, 'old-approach-rejected')).step, 4);
  await capture(page, '01-old-approach-stays-find-ground');
  await key(page, 'w', 300);
  await page.waitForFunction(() => urchinDebug.world.boat.y < 95, null, { timeout: 30000 });
  await key(page, 'x');
  await page.waitForFunction(() => urchinDebug.world.career.intro.step === 5);
  const accepted = await read(page, 'keyboard-approach-accepted');
  assert.match(accepted.lesson, /deploy Ada.*port rail here/);
  await capture(page, '02-port-drop-ready');
  await page.getByRole('button', { name: 'Chart & notes', exact: true }).click();
  await page.waitForTimeout(350);
  assert.doesNotMatch(await page.locator('body').innerText(), /\{recoverDiver\}/);
  assert.match(await page.locator('body').innerText(), /Use 1 to deploy Ada/);
  await capture(page, '03-chart-drop-guidance');
  await page.getByRole('button', { name: 'Resume lesson', exact: true }).click();
  // Closing a menu suppresses input until a released-input frame is polled.
  // Wait for that real guard to clear before issuing a new keydown.
  await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
  await key(page, '1');
  await page.waitForFunction(() => urchinDebug.world.divers[0].state !== 'ready');
  await capture(page, '04-follow-the-dive');
  await page.waitForFunction(() => urchinDebug.world.career.intro.step === 6, null, {
    timeout: 30000,
  });
  const success = await read(page, 'real-marked-catch');
  assert(success.markedCatch);
  assert(success.divers.some((d) => d.bag > 0 && d.patch === 'lesson-marked'));
  assert.equal(success.catch, 0, 'actual catch is still with the diver');
  await capture(page, '05-real-catch-next-lesson');
  await page.close();

  const retry = await tutorial();
  // An existing step-6 save (or skipped arrival lesson) may already permit a
  // drop here. Reproduce the failed dive using the unchanged simulation.
  await retry.evaluate(() => {
    const w = urchinDebug.world;
    w.career.intro.step = 5;
    Object.assign(w.boat, {
      x: 88.4,
      y: 110.5,
      heading: -0.543,
      throttle: 0,
      rudder: 0,
      vx: 0,
      vy: 0,
      turn: 0,
    });
  });
  await retry.waitForTimeout(250);
  await capture(retry, '06-old-save-reposition-advice');
  await key(retry, '1');
  await retry.waitForFunction(() => urchinDebug.world.divers[0].state === 'searching');
  // Advance actual physics to the search deadline; no diver state or catch is assigned.
  await retry.evaluate(() => urchinDebug.step(82));
  await retry.waitForFunction(() => urchinDebug.world.divers[0].state === 'surface');
  const failed = await read(retry, 'empty-search-recovery-guidance');
  assert.equal(failed.step, 5);
  assert.equal(failed.divers[0].bag, 0);
  assert.equal(failed.divers[0].reason, 'Search time limit reached');
  assert.match(failed.lesson, /each float.*PORT rail/);
  assert.doesNotMatch(failed.lesson, /deploy .*here/i);
  await capture(retry, '07-empty-float-recovery-advice');
  await retry.getByRole('button', { name: 'Skip this step', exact: true }).click();
  await retry.waitForFunction(() => urchinDebug.world.career.intro.step === 6);
  const skipped = await read(retry, 'explicit-skip-remains-available');
  assert.equal(skipped.markedCatch, false);
  assert.equal(skipped.catch, 0);
  await retry.close();
  for (const [name, width, height] of [
    ['phone', 390, 844],
    ['landscape', 844, 390],
  ]) {
    const touch = await tutorial({ width, height }, true);
    await touch.evaluate(() => {
      const w = urchinDebug.world;
      w.career.intro.step = 5;
      Object.assign(w.boat, {
        x: 88.4,
        y: 110.5,
        heading: -0.543,
        throttle: 0,
        rudder: 0,
        vx: 0,
        vy: 0,
        turn: 0,
      });
    });
    await touch.waitForTimeout(250);
    await touch.locator('[data-touch="recoverDiver"]').tap();
    await touch.waitForFunction(() => urchinDebug.world.divers[0].state === 'searching');
    await touch.evaluate(() => urchinDebug.step(82));
    await touch.waitForFunction(() => urchinDebug.world.divers[0].state === 'surface');
    const record = await read(touch, `${name}-empty-search-guidance`);
    assert.equal(record.step, 5);
    assert.equal(record.divers[0].bag, 0);
    assert.match(record.lesson, /each float.*PORT rail/);
    assert.match(record.lesson, /Deploy \/ board to bring the diver aboard/);
    const layout = await touch.locator('#frankAboard').evaluate((panel) => {
      const rect = panel.getBoundingClientRect();
      return {
        rect: rect.toJSON(),
        horizontalOverflow: panel.scrollWidth > panel.clientWidth + 1,
        contentHeight: panel.scrollHeight,
        visibleHeight: panel.clientHeight,
        buttons: [...panel.querySelectorAll('button')].map((button) => ({
          text: button.textContent,
          disabled: button.disabled,
        })),
      };
    });
    assert(layout.rect.top >= 0 && layout.rect.bottom <= height);
    assert(layout.rect.left >= 0 && layout.rect.right <= width);
    assert.equal(layout.horizontalOverflow, false);
    records.push({ name: `${name}-frank-layout`, ...layout });
    await capture(touch, `08-${name}-empty-float-guidance`);
    await touch.getByRole('button', { name: 'Chart & notes', exact: true }).tap();
    await touch.waitForFunction(() => urchinDebug.ui.screen === 'introchart');
    await touch.waitForTimeout(350);
    assert.doesNotMatch(await touch.locator('body').innerText(), /\{recoverDiver\}/);
    assert.match(
      await touch.locator('body').innerText(),
      /Deploy \/ board to bring the diver aboard/,
    );
    await capture(touch, `09-${name}-chart-recovery-guidance`);
    await touch.getByRole('button', { name: 'Resume lesson', exact: true }).tap();
    await touch.waitForFunction(() => !urchinDebug.ui.screen);
    await touch.getByRole('button', { name: 'Skip this step', exact: true }).tap();
    await touch.waitForFunction(() => urchinDebug.world.career.intro.step === 6);
    records.push({ name: `${name}-native-touch-chart-resume-skip`, passed: true });
    await touch.close();
  }
  // These are explicitly staged recovery poses, separate from the keyboard
  // approach/catch playthrough above. The command preview is checked against
  // the live eligibility rules, then actual input begins the boarding action.
  for (const [name, width, height, touch] of [
    ['desktop', 1280, 800, false],
    ['phone', 390, 844, true],
    ['landscape', 844, 390, true],
  ]) {
    const recovery = await tutorial({ width, height }, touch);
    for (const pose of ['wrong-side', 'too-fast', 'ready']) {
      await recovery.evaluate((pose) => {
        const d = urchinDebug,
          w = d.world;
        w.career.intro.step = 6;
        w.career.intro.markedCatch = true;
        Object.assign(w.boat, {
          x: 120,
          y: 120,
          heading: 0,
          throttle: 0,
          rudder: 0,
          turn: 0,
          vx: 0.015,
          vy: pose === 'too-fast' ? 3 : 0,
        });
        const side = d.simulation.boatSpec(w).width / 2 + 3;
        Object.assign(w.divers[0], {
          state: 'surface',
          x: 120 + (pose === 'wrong-side' ? side : -side),
          y: 120,
          bag: 70,
          qualitySum: 56,
          air: 90,
          reason: 'Skipper recalled diver',
          bagHandled: false,
          hooking: false,
          hook: 0,
          recoveryAction: null,
          recoveryPause: '',
          transit: null,
        });
        Object.assign(w.divers[1], { state: 'ready', x: 120, y: 120, bag: 0 });
        w.selectedDiverId = 0;
      }, pose);
      await recovery.waitForTimeout(120);
      const record = await read(recovery, `${name}-staged-recovery-${pose}`);
      records.at(-1).fixture =
        'Staged boat and surfaced-diver pose; no claim of a full natural tutorial.';
      const reason = await recovery.evaluate(
        () =>
          urchinDebug.simulation.recoveryStatus(
            urchinDebug.world,
            undefined,
            urchinDebug.world.divers[0],
          ).reason,
      );
      if (pose === 'wrong-side') {
        assert.equal(reason, 'BRING FLOAT TO PORT SIDE');
        assert.match(record.lesson, /Ada is not beside the port ladder/);
        assert.match(record.lesson, /would deploy Milo now/);
      } else if (pose === 'too-fast') {
        assert.equal(reason, 'SLOW DOWN');
        assert.match(record.lesson, /Ada is on port.*moving too fast.*Neutral/);
        assert.match(record.lesson, /would deploy Milo now/);
        assert.match(await recovery.locator('#seaSpeech').innerText(), /Neutral.*match the float/);
      } else {
        assert.equal(reason, '');
        assert.match(record.lesson, /Ada is alongside on port.*brings them and their catch aboard/);
        assert.doesNotMatch(record.lesson, /would deploy Milo/);
      }
      await capture(recovery, `10-${name}-recovery-${pose}`);
    }
    await recovery.waitForFunction(() => !urchinDebug.input.suppressed);
    if (touch) await recovery.locator('[data-touch="recoverDiver"]').tap();
    else await key(recovery, '1');
    await recovery.waitForFunction(() => urchinDebug.world.divers[0].hooking);
    const ongoing = await read(recovery, `${name}-boarding-from-staged-pose`);
    assert.match(ongoing.lesson, /Ada is coming aboard.*no further button press/);
    assert.equal(ongoing.divers[1].state, 'ready');
    await capture(recovery, `11-${name}-boarding-in-progress`);
    await recovery.close();
  }
  assert.deepEqual(errors, []);
  passed = true;
  console.log(
    'Tutorial port-drop arrival, actual keyboard catch, failed-search guidance and explicit skip passed.',
  );
} catch (error) {
  errors.push(error.stack || error.message || String(error));
  throw error;
} finally {
  writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(
      {
        passed,
        startedAt,
        finishedAt: new Date().toISOString(),
        url,
        scope:
          'Isolated measured start positions; actual keyboard helm/deployment; actual simulated search/catch. No physical controller or device acceptance.',
        records,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
