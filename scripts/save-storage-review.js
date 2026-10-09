// October 4 regression in a real browser: storage pre-filled with legacy
// uncompressed restore points (as on the designer's itch.io install) must not
// break New Career, autosave across reload, Load Game or deleting saves.
import { chromium, firefox } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { careerWorld, snapshot, SAVE_KEY } from '../src/career-save.js';
import { checksum } from '../src/save-codec.js';
import { createCareer } from '../src/career-state.js';
import { enterSector } from '../src/sectors.js';
import { PHYSICAL_AREAS } from '../src/coasts.js';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/',
  output = process.env.URCHIN_SAVE_OUTPUT || 'test-results/save-storage',
  useFirefox = process.argv.includes('--firefox');
mkdirSync(output, { recursive: true });

// Several travelled careers stored the old way: ~600 KB each.
const legacy = [];
for (let i = 0; i < 6; i++) {
  const w = careerWorld(createCareer(9000 + i));
  w.career.intro = { status: 'complete' };
  w.career.day = 2 + i;
  for (const area of PHYSICAL_AREAS) enterSector(w, area.id);
  const payload = JSON.stringify(snapshot(w));
  legacy.push(JSON.stringify({ version: 1, checksum: checksum(payload), payload }));
}
const legacyBytes = legacy.reduce((n, s) => n + s.length, 0);

const browser = await (useFirefox ? firefox : chromium).launch({
  headless: true,
  args: useFirefox ? [] : ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const record = { started: new Date().toISOString(), browser: useFirefox ? 'firefox' : 'chromium' };
let passed = false;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.evaluate(
    ({ legacy, key }) => {
      localStorage.clear();
      localStorage.setItem(key, legacy[0]);
      legacy.forEach((raw, i) => localStorage.setItem(`${key}-archive-${1000 + i}`, raw));
    },
    { legacy, key: SAVE_KEY },
  );
  record.legacyChars = legacyBytes + legacy[0].length;
  await page.reload();
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 120000 });
  const usage = () =>
    page.evaluate(() => {
      let n = 0;
      for (let i = 0; i < localStorage.length; i++)
        n += localStorage.key(i).length + localStorage.getItem(localStorage.key(i)).length;
      return n;
    });
  record.charsAfterLaunch = await usage();
  assert(record.charsAfterLaunch < record.legacyChars / 4, 'launch compacts legacy saves');
  record.restorePointsAfterLaunch = await page.evaluate(
    () => urchinDebug.ui.hooks.archives().length,
  );
  assert.equal(record.restorePointsAfterLaunch, legacy.length, 'no restore point lost');

  // New Career goes to a new career, not Load Game.
  await page.locator('[data-title-action="new"]').click();
  await page.waitForFunction(() => ['intro', 'starter', 'harbour'].includes(urchinDebug.ui.screen));
  record.newCareerScreen = await page.evaluate(() => urchinDebug.ui.screen);
  const seed = await page.evaluate(() => urchinDebug.world.career.seed);
  await page.screenshot({ path: `${output}/new-career.png` });

  // Change state, let the page hide (as when switching apps), reload, continue.
  await page.evaluate(() => {
    urchinDebug.world.career.cash = 12345;
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.reload();
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 120000 });
  const restored = await page.evaluate(() => ({
    seed: urchinDebug.world.career.seed,
    cash: urchinDebug.world.career.cash,
  }));
  assert.deepEqual(restored, { seed, cash: 12345 }, 'hidden-page save survives reload');

  // Load an older career from Load Game, then delete a restore point.
  await page.locator('[data-title-action="load"]').click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'archives');
  await page.screenshot({ path: `${output}/load-game.png` });
  const target = await page.evaluate(() => urchinDebug.ui.archives.find((a) => a.day === 4).key);
  await page.locator(`[data-action="archive-${target}"]`).click();
  await page.waitForFunction((seed) => urchinDebug.world.career.seed !== seed, seed);
  record.loaded = await page.evaluate(() => ({
    day: urchinDebug.world.career.day,
    seed: urchinDebug.world.career.seed,
  }));
  assert.equal(record.loaded.day, 4);

  await page.evaluate(() => urchinDebug.ui.open('archives'));
  const before = await page.evaluate(() => urchinDebug.ui.archives.length);
  await page.locator('[data-action="delete-mode"]').click();
  await page.waitForFunction(() =>
    document.querySelector('#playtest [data-action^="delete-urchin"]'),
  );
  const victim = await page.evaluate(() =>
    document.querySelector('#playtest [data-action^="delete-urchin"]').dataset.action.slice(7),
  );
  await page.locator(`[data-action="delete-${victim}"]`).click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'purchase');
  await page.screenshot({ path: `${output}/delete-confirm.png` });
  await page.locator('[data-action="cancel-purchase"]').click();
  assert.equal(await page.evaluate(() => urchinDebug.ui.archives.length), before, 'cancel keeps');
  await page.locator(`[data-action="delete-${victim}"]`).click();
  await page.locator('[data-action="confirm-purchase"]').click();
  await page.waitForFunction((n) => urchinDebug.ui.archives.length === n - 1, before);
  assert.equal(await page.evaluate((k) => localStorage.getItem(k), victim), null);
  await page.screenshot({ path: `${output}/after-delete.png` });

  // October 8: a failed autosave at sea is announced even with the default
  // assists, where the action-message overlay is off (Bible §12). Sail a real
  // working day through the menu, then make every storage write fail.
  await page.evaluate(() => {
    urchinDebug.ui.chartGroundId = 'near';
    urchinDebug.ui.open('departure');
  });
  await page.getByRole('button', { name: 'Begin working day' }).click();
  await page.waitForFunction(
    () => urchinDebug.world.day.phase === 'working' && !urchinDebug.ui.screen,
    null,
    { timeout: 60000 },
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  record.feedbackOverlayDefault = await page.evaluate(
    () => !!urchinDebug.world.career.assists.feedbackOverlay,
  );
  await page.waitForFunction(
    () => /SAVE FAILED/.test(document.querySelector('#seaSpeech:not([hidden])')?.textContent || ''),
    null,
    { timeout: 30000 },
  );
  record.seaSaveFailure = await page.evaluate(
    () => document.querySelector('#seaSpeech').textContent,
  );
  await page.screenshot({ path: `${output}/save-failed-at-sea.png` });
  record.errors = errors;
  assert.deepEqual(errors, []);
  passed = true;
} finally {
  await browser.close();
  record.passed = passed;
  record.ended = new Date().toISOString();
  writeFileSync(`${output}/receipt-${record.browser}.json`, JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));
}
