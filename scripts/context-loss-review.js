// October 5: a WebGL context lost without a webglcontextlost event (the
// designer's blank-sea itch.io reload on Firefox Android) must still pause play,
// show the notice, and offer "Reload graphics". A normal loss/restore recovers.
import '../tests/matter-helper.js';
import { chromium, firefox } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCareer } from '../src/career-state.js';
import { careerWorld, encode, SAVE_KEY } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';

const useFirefox = process.argv.includes('--firefox'),
  tag = useFirefox ? 'firefox' : 'chromium',
  directory = 'test-results/context-loss-2026-10-05';
mkdirSync(directory, { recursive: true });
const source = careerWorld(createCareer(17));
source.career.intro = { status: 'complete' };
assert(chooseGround(source, 'near').ok);
source.day.minute = 740;
const saved = encode(source),
  errors = [],
  records = [];
const browser = await (useFirefox ? firefox : chromium).launch({
  headless: true,
  args: useFirefox ? [] : ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: !useFirefox,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(
    ({ key, value }) => {
      if (sessionStorage.getItem('staged')) return;
      sessionStorage.setItem('staged', '1');
      localStorage.clear();
      localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: saved },
  );
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 120000 });
  await page.locator('[data-title-action="continue"]').tap();
  await page.waitForFunction(() => !urchinDebug.ui.screen && urchinDebug.ui.started);
  await page.waitForTimeout(1500);
  const state = () =>
    page.evaluate(() => ({
      minute: urchinDebug.world.day.minute,
      lost: !!urchinDebug.three.contextLost,
      notice: !!document.getElementById('rendererNotice'),
      reload: !!document.querySelector('#rendererNotice button'),
    }));
  // Ordinary loss and restore.
  await page.evaluate(() => {
    window.loseExtension = urchinDebug.three.renderer
      .getContext()
      .getExtension('WEBGL_lose_context');
    window.loseExtension.loseContext();
  });
  await page.waitForFunction(() => !!document.getElementById('rendererNotice'));
  await page.evaluate(() => window.loseExtension.restoreContext());
  await page.waitForFunction(() => !document.getElementById('rendererNotice'), null, {
    timeout: 10000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${directory}/${tag}-restored.png` });
  records.push(`${tag}: ordinary loss shows the notice; restore removes it and drawing resumes.`);
  // Loss whose event never reaches the game.
  await page.evaluate(() => {
    window.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true,
    );
    window.loseExtension.loseContext();
  });
  await page.waitForFunction(() => !!document.getElementById('rendererNotice'));
  const paused = await state();
  await page.waitForTimeout(1200);
  const later = await state();
  assert(later.lost && later.notice, 'silent loss is detected');
  assert.equal(later.minute, paused.minute, 'simulation pauses while graphics are lost');
  await page.waitForFunction(() => !!document.querySelector('#rendererNotice button'), null, {
    timeout: 6000,
  });
  await page.screenshot({ path: `${directory}/${tag}-silent-loss.png` });
  records.push(
    `${tag}: silent loss is detected by polling; the clock stops; "Reload graphics" appears after 3 s.`,
  );
  await Promise.all([page.waitForEvent('load'), page.locator('#rendererNotice button').click()]);
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 120000 });
  await page.locator('[data-title-action="continue"]').tap();
  await page.waitForFunction(() => !urchinDebug.ui.screen && urchinDebug.ui.started);
  await page.waitForTimeout(1500);
  const after = await state();
  assert(!after.lost && !after.notice, 'reload returns to a drawing game');
  assert(after.minute >= later.minute, 'the save taken before reload is resumed');
  await page.screenshot({ path: `${directory}/${tag}-after-reload.png` });
  records.push(
    `${tag}: Reload graphics saves, reloads and resumes the career with drawing restored.`,
  );
  assert.deepEqual(errors, []);
  console.log(records.join('\n'));
  await context.close();
} finally {
  writeFileSync(`${directory}/${tag}-results.json`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
