import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/';
const output = process.env.URCHIN_HUD_REVIEW_OUTPUT || 'test-results/ui-overhaul/hud-context';
mkdirSync(output, { recursive: true });
const results = [],
  errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});

// These are isolated presentation fixtures after a natural tutorial start.
// They test communication of existing simulation states, not a completed trip.
async function stage(page, scenario) {
  await page.evaluate((scenario) => {
    const d = urchinDebug,
      w = d.world;
    w.career.intro.status = 'complete';
    w.career.assists.controlsHelp = false;
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
    Object.assign(w.environment, { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 });
    Object.assign(w.divers[0], {
      state: 'surface',
      depth: 0,
      bag: 300,
      qualitySum: 240,
      x: w.boat.x + (scenario === 'far-speech' ? -8 : scenario.startsWith('wrong-side') ? 4 : -4),
      y: w.boat.y + (scenario === 'far-speech' ? -14 : 0),
      hook: scenario === 'recovery-overflow' ? 1 : 0,
      hooking: scenario === 'recovery-overflow',
      recoveryAction: scenario === 'recovery-overflow' ? 'recoverDiver' : null,
      recoveryPause: '',
      bagHandled: false,
      reason: 'Bag full',
      air: 50,
      speech:
        scenario === 'far-speech'
          ? { icon: '💬', text: 'Bag full. About 90 seconds waiting.', until: w.time + 5 }
          : null,
    });
    w.catch = scenario.endsWith('overflow') ? 7450 : 0;
    w.selectedDiverId = w.divers[0].id;
    Object.assign(w.divers[1], { state: 'ready' });
    d.ui.importantNotice =
      scenario === 'recovery-overflow'
        ? {
            text: 'Keep alongside while the diver and bag come aboard.',
            until: performance.now() + 5000,
          }
        : null;
  }, scenario);
  await page.waitForTimeout(150);
  const title = await page.locator('#message > strong').innerText();
  if (scenario === 'ready')
    assert.equal(title, 'Ready to recover', 'Fixture must be eligible for recovery');
  else if (scenario === 'far-speech')
    assert.match(await page.locator('#message').innerText(), /out of range/i);
  else if (scenario.startsWith('wrong-side'))
    assert.match(
      await page.locator('#message').innerText(),
      /bring float to port side/i,
      'Fixture must exercise working-side denial',
    );
  else {
    assert.match(title, /diver \+ bag recovery/i, 'Fixture must be actively recovering');
    assert(await page.locator('#message progress').evaluate((e) => e.value > 0));
  }
}

async function capture(page, name) {
  const measurement = await page.evaluate(() => {
    const panel = document.getElementById('message'),
      box = panel.getBoundingClientRect(),
      target = urchinDebug.world.divers[0],
      floatPoint = urchinDebug.three.project(target.x, target.y);
    const speech = urchinDebug.three.diverCues.labels[0].speech,
      speechBox = speech.getBoundingClientRect(),
      speechObstructions = speech.hidden
        ? []
        : [...document.querySelectorAll('[data-hud-window], #keyboardHelm, #touchControls')]
            .filter((element) => {
              const style = getComputedStyle(element),
                rect = element.getBoundingClientRect();
              return (
                !element.hidden &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                Number(style.opacity) > 0.25 &&
                rect.width > 0 &&
                rect.height > 0 &&
                speechBox.left < rect.right &&
                speechBox.right > rect.left &&
                speechBox.top < rect.bottom &&
                speechBox.bottom > rect.top
              );
            })
            .map((element) => element.id);
    const children = [...panel.children]
      .filter((e) => getComputedStyle(e).display !== 'none')
      .map((e) => ({
        tag: e.tagName,
        className: e.className,
        text: e.textContent,
        rect: e.getBoundingClientRect().toJSON(),
        clipped: e.getBoundingClientRect().bottom > box.bottom + 1,
      }));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      touch: urchinDebug.input.touchEnabled,
      topControls: ['touchMenu', 'touchHudToggle', 'touchLockToggle'].map((id) => {
        const rect = document.getElementById(id).getBoundingClientRect();
        return { id, width: rect.width, height: rect.height };
      }),
      rect: box.toJSON(),
      clientHeight: panel.clientHeight,
      scrollHeight: panel.scrollHeight,
      legend: {
        client: document.getElementById('groundLegend').clientHeight,
        scroll: document.getElementById('groundLegend').scrollHeight,
      },
      text: panel.innerText,
      speech: {
        visible: !speech.hidden,
        text: speech.textContent,
        rect: speechBox.toJSON(),
        obstructions: speechObstructions,
      },
      duplicateCueHidden: urchinDebug.three.diverCues.labels[0].label.hidden,
      selectedFloatClear:
        floatPoint.x + 5 < box.left ||
        floatPoint.x - 5 > box.right ||
        floatPoint.y + 5 < box.top ||
        floatPoint.y - 5 > box.bottom,
      durationClearOfProgress:
        !panel.querySelector('.pickup-duration') ||
        panel.querySelector('.pickup-duration').getBoundingClientRect().bottom <=
          panel.querySelector('progress').getBoundingClientRect().top,
      children,
    };
  });
  results.push({ name, ...measurement });
  await page.screenshot({ path: `${output}/${name}.png` });
  console.log(
    `${name}: message ${measurement.clientHeight}px / content ${measurement.scrollHeight}px`,
  );
}

try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      hasTouch: touch,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(base);
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    if (touch) {
      await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
      await page.getByRole('switch', { name: 'Touchscreen mode: OFF', exact: true }).tap();
      await page.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
    }
    await page.locator('#keyboardFallback').click();
    await page.getByRole('button', { name: 'Come aboard · learn with Frank', exact: true }).click();
    await page.waitForFunction(() => !urchinDebug.ui.screen);
    if (!touch) await page.keyboard.press('Space');
    for (const viewport of touch
      ? [
          { width: 390, height: 844 },
          { width: 844, height: 390 },
        ]
      : [
          { width: 1280, height: 800 },
          { width: 844, height: 390 },
        ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);
      for (const scenario of [
        'ready',
        'wrong-side',
        'wrong-side-overflow',
        'recovery-overflow',
        ...(!touch && viewport.width === 1280 ? ['far-speech'] : []),
      ]) {
        await stage(page, scenario);
        await capture(page, `${touch ? 'touch' : 'keyboard'}-${viewport.width}-${scenario}`);
        if (scenario === 'far-speech') {
          const previous = await page.evaluate(() => {
            const debug = urchinDebug,
              cues = debug.three.diverCues,
              entry = cues.labels[0],
              diver = debug.world.divers[0],
              previous = { box: { ...entry.speechBox }, text: entry.speech.textContent };
            // The same words must receive a new placement after a voyage
            // restarts its clock, despite the prior future layout deadline.
            entry.nextSpeechLayout = 10000;
            debug.world.time = 0;
            diver.x = debug.world.boat.x - 6;
            diver.y = debug.world.boat.y + 3;
            diver.speech.until = 5;
            cues.reset();
            return previous;
          });
          await page.waitForTimeout(150);
          const current = await page.evaluate(() => {
            const entry = urchinDebug.three.diverCues.labels[0];
            return {
              box: entry.speechBox,
              text: entry.speech.textContent,
              deadline: entry.nextSpeechLayout,
            };
          });
          assert.equal(current.text, previous.text);
          assert.notDeepEqual(
            current.box,
            previous.box,
            'Same speech must follow its new voyage position',
          );
          assert(current.deadline < 1, 'Speech layout deadline must use the restarted clock');
          await capture(page, 'keyboard-1280-speech-clock-reset');
        }
      }
      // A deliberate custom message keeps its exact location and restores the
      // original world cue; hiding prompts must also restore displaced gauges.
      await stage(page, 'ready');
      await page.evaluate(() => {
        const h = urchinDebug.ui.hudWindows;
        h.move(h.windows.get('message'), 4, 20);
      });
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(() => urchinDebug.three.diverCues.labels[0].label.hidden),
        false,
      );
      assert.equal(Math.round((await page.locator('#message').boundingBox()).x), 4);
      assert.equal(Math.round((await page.locator('#message').boundingBox()).y), 20);
      await page.evaluate(() => {
        const h = urchinDebug.ui.hudWindows;
        h.reset(h.windows.get('message'));
        urchinDebug.world.career.assists.actionPrompts = false;
      });
      await page.waitForTimeout(100);
      assert(await page.locator('#message').isHidden());
      const secondary =
        !touch && viewport.height < 560
          ? '#currentReadout'
          : touch && viewport.height < 500
            ? '#electronics'
            : null;
      if (secondary)
        assert.equal(
          await page.locator(secondary).evaluate((e) => getComputedStyle(e).visibility),
          'visible',
        );
      await page.evaluate(() => {
        urchinDebug.world.career.assists.actionPrompts = true;
      });
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert(
    results.every((result) => result.duplicateCueHidden),
    'Active default context replaces only the duplicate target text cue',
  );
  assert(
    results.every((result) => result.durationClearOfProgress),
    'Recovery duration must stay above the progress meter when the title wraps',
  );
  assert(
    results.every((result) => result.selectedFloatClear),
    'Default recovery context must leave the selected physical float visible on either side',
  );
  const farSpeech = results.find((result) => result.name.endsWith('far-speech'));
  assert(farSpeech.speech.visible, 'Fixture must show the surfaced diver’s spoken message');
  assert.deepEqual(
    farSpeech.speech.obstructions,
    [],
    'Diver speech must remain clear of visible HUD',
  );
  assert(
    results
      .filter((result) => result.speech.visible)
      .every((result) => !result.speech.obstructions.length),
    'Repeated speech must also remain clear after a voyage clock restart',
  );
  assert(
    results
      .filter((result) => result.touch)
      .every((result) =>
        result.topControls.every((control) => control.width >= 44 && control.height >= 44),
      ),
    'On-water menu, visibility and layout controls must provide 44-pixel touch targets',
  );
  for (const result of results.filter((r) => r.touch && r.viewport.width === 390))
    assert(
      result.legend.scroll <= result.legend.client,
      'Portrait ground legend must fit without scrolling',
    );
  const clipped = results.flatMap((result) =>
    result.children
      .filter(
        (child) =>
          child.clipped &&
          (['important-notice', 'pickup-requirement', 'pickup-reason', 'control-status'].includes(
            child.className,
          ) ||
            child.tag === 'PROGRESS' ||
            child.tag === 'STRONG'),
      )
      .map((child) => `${result.name}: ${child.text || child.tag}`),
  );
  assert.deepEqual(
    clipped,
    [],
    'Default HUD must show its status, progress and urgent notices without scrolling',
  );
} finally {
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify(
      { base, fixture: 'isolated presentation states, not a completed voyage', results, errors },
      null,
      2,
    ),
  );
  await browser.close();
}
