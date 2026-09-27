import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/';
const output = 'test-results/three-touch';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
const results = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});

async function screenshot(name) {
  await page.evaluate(() => urchinDebug.three.host.game.loop.sleep());
  try {
    await page.screenshot({ path: `${output}/${name}.png` });
  } finally {
    await page.evaluate(() => urchinDebug.three.host.game.loop.wake());
  }
}

async function viewportReady() {
  await page.waitForFunction(
    () =>
      urchinDebug.three.host.scale.width === innerWidth &&
      urchinDebug.three.host.scale.height === innerHeight,
  );
}

async function careerLayout(name) {
  await viewportReady();
  await page.waitForFunction(() => !urchinDebug.input.suppressed && !urchinDebug.ui.blocked);
  await page.locator('[data-touch="fullAhead"]').tap();
  await page.waitForFunction(() => urchinDebug.world.boat.throttle === 1);
  await page.locator('[data-touch="neutral"]').tap();
  await page.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
  await page.waitForFunction(
    () =>
      !document.querySelector('#actionFeedback').hidden &&
      document.querySelector('#actionFeedback').textContent.includes('THROTTLE NEUTRAL'),
  );
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#diverPanel .nitrogen-info:not([hidden])').count(), 2);
  const layout = await page.evaluate(() => {
    const d = urchinDebug;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      touch: d.input.touchEnabled,
      touchScale: Number(
        getComputedStyle(document.documentElement).getPropertyValue('--touch-scale'),
      ),
      boat: d.three.project(d.world.boat.x, d.world.boat.y, 0),
      panels: ['message', 'groundLegend', 'actionFeedback', 'diverPanel'].map((id) => {
        const e = document.getElementById(id);
        return {
          id,
          rect: e.getBoundingClientRect().toJSON(),
          clientHeight: e.clientHeight,
          scrollHeight: e.scrollHeight,
          text: e.textContent,
        };
      }),
      controls: [...document.querySelectorAll('#touchControls button')].map((e) => ({
        action: e.dataset.touch,
        rect: e.getBoundingClientRect().toJSON(),
      })),
    };
  });
  assert(layout.touch);
  assert.equal(layout.touchScale, 1, 'Fresh-context default touch scale is 100%');
  for (const panel of layout.panels) {
    if (panel.id !== 'diverPanel') {
      assert(panel.scrollHeight <= panel.clientHeight, `${name}: ${panel.id} clips vertically`);
      const r = panel.rect;
      assert(
        layout.boat.x < r.left ||
          layout.boat.x > r.right ||
          layout.boat.y < r.top ||
          layout.boat.y > r.bottom,
        `${name}: ${panel.id} covers the boat centre`,
      );
    }
  }
  assert(layout.controls.length > 0);
  for (const control of layout.controls) {
    assert(
      control.rect.width >= 44 && control.rect.height >= 44,
      `${control.action}: touch target below 44px`,
    );
  }
  results.push({ name, ...layout });
  await screenshot(name);
  await hitTargets(name);
}

async function hitTargets(name) {
  // A geometry fixture tests the largest legal camera zoom without changing helm rules.
  const originalZoom = await page.evaluate(() => urchinDebug.zoom);
  await page.evaluate(() => urchinDebug.three.host.cameras.main.setZoom(2.2));
  await page.waitForTimeout(150);
  const targets = await page.evaluate(() =>
    [...document.querySelectorAll('#touchControls [data-touch]')].map((e) => {
      const r = e.getBoundingClientRect();
      return {
        action: e.dataset.touch,
        hits: [0.25, 0.5, 0.75].map((fraction) => {
          const hit = document.elementFromPoint(r.left + r.width * fraction, r.top + r.height / 2);
          return { clear: hit === e || e.contains(hit), target: hit?.id || hit?.dataset.touch };
        }),
      };
    }),
  );
  for (const target of targets) {
    assert(
      target.hits.every((hit) => hit.clear),
      `${name}: ${target.action} intercepted at maximum zoom`,
    );
  }
  results.push({ name: `${name}-maximum-zoom-hit-targets`, targets });
  await page.evaluate((zoom) => urchinDebug.three.host.cameras.main.setZoom(zoom), originalZoom);
}

try {
  await page.goto(base);
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 60000 });
  await viewportReady();
  await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
  await page.getByRole('button', { name: 'Touchscreen mode: OFF', exact: true }).tap();
  await page.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
  await page.locator('#keyboardFallback').tap();
  await page.getByRole('button', { name: 'Come aboard · learn with Frank', exact: true }).tap();
  await page.waitForFunction(
    () => urchinDebug.world.career?.intro?.status === 'active' && urchinDebug.input.touchEnabled,
  );
  await page.waitForTimeout(700);
  const lesson = await page.evaluate(() => {
    const d = urchinDebug;
    return {
      boat: d.three.project(d.world.boat.x, d.world.boat.y, 0),
      expected: { x: innerWidth * 0.58, y: innerHeight * 0.34 },
      dialog: document.querySelector('#frankAboard').getBoundingClientRect().toJSON(),
      viewport: { width: innerWidth, height: innerHeight },
      scale: { width: d.three.host.scale.width, height: d.three.host.scale.height },
      offset: {
        x: d.three.host.cameras.main.followOffset.x,
        y: d.three.host.cameras.main.followOffset.y,
      },
    };
  });
  assert(Math.abs(lesson.boat.x - lesson.expected.x) < 2, 'Compact lesson horizontal framing');
  assert(Math.abs(lesson.boat.y - lesson.expected.y) < 2, 'Compact lesson vertical framing');
  assert(lesson.dialog.right < lesson.boat.x - 25, 'Frank panel must clear the boat');
  results.push({ name: 'touch-lesson', ...lesson });
  await screenshot('touch-lesson');

  // Isolated presentation fixture: retain the real borrowed boat and assigned crew,
  // then end its tutorial flag to expose normal career nitrogen and air telemetry.
  await page.evaluate(() => {
    const d = urchinDebug;
    d.world.career.intro.status = 'complete';
    d.world.career.assists.controlsHelp = false;
    d.world.career.assists.pickingLegend = true;
    d.world.career.assists.feedbackOverlay = true;
    d.world.day.minute = 600;
    d.ui.open(null);
  });
  await careerLayout('touch-career-landscape');
  await page.setViewportSize({ width: 390, height: 844 });
  await careerLayout('touch-career-portrait');
  for (const scale of [0.7, 0.5]) {
    await page.evaluate(
      (value) => document.documentElement.style.setProperty('--touch-scale', value),
      String(scale),
    );
    const rect = await page.locator('[data-touch="fullAhead"]').boundingBox();
    assert(
      rect.height < 44 && rect.height >= 44 * scale - 1,
      'Explicit smaller touch scale remains available',
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    'Touch tutorial camera, career telemetry, throttle feedback, orientation and 44px control targets passed.',
  );
} finally {
  writeFileSync(`${output}/review.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
