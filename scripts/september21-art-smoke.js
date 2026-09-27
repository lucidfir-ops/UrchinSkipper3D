import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.setDefaultTimeout(15000);
try {
  await page.addInitScript(
    (raw) => localStorage.setItem('urchin-career-v1', raw),
    readFileSync('feedback/9-21/urchin-career-day-17-1790034858921.json', 'utf8'),
  );
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/');
  await page.waitForFunction(() => window.urchinDebug?.ui);
  await page.locator('#keyboardFallback').click();
  await page.evaluate(async () => {
    const { chooseGround } = await import('/src/day.js'),
      { spawnWildlife } = await import('/src/wildlife.js');
    const u = urchinDebug.ui,
      w = urchinDebug.world;
    u.started = true;
    w.career.day = 19;
    w.day.minute = 600;
    chooseGround(w, 'near');
    u.open(null);
    for (const [species, x, y, count, heading] of [
      ['humpback', 24, -25, 1, 1.1],
      ['orca', -22, -15, 2, -0.8],
    ]) {
      const e = spawnWildlife(w, species, {
        force: true,
        point: { x: w.boat.x + x, y: w.boat.y + y },
        count,
        heading,
        announce: false,
      });
      if (!e) throw new Error(`Could not stage ${species} in visible habitat`);
      for (const m of e.members) {
        m.phase = 0;
        m.surfaced = true;
      }
    }
  });
  await page.locator('#voyage').waitFor({ state: 'hidden' });
  await page.screenshot({ path: 'test-results/sep21-wildlife.png' });
  await page.evaluate(async () => {
    const { spawnWildlife } = await import('/src/wildlife.js'),
      w = urchinDebug.world;
    w.wildlife.encounters = [];
    for (const [species, x, y, count, heading] of [
      ['goose', 15, -12, 7, Math.PI],
      ['seagull', -25, -15, 6, 1],
    ]) {
      const e = spawnWildlife(w, species, {
        force: true,
        point: { x: w.boat.x + x, y: w.boat.y + y },
        count,
        heading,
        announce: false,
      });
      if (!e) throw new Error(`Could not stage ${species}`);
    }
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'test-results/sep21-birds.png' });
  console.log('PASS visible whale and bird fixtures');
  for (const tide of [0, 2]) {
    await page.evaluate((tide) => {
      const w = urchinDebug.world;
      w.career.day = 1;
      w.day.groundId = 'outer-vault';
      w.day.minute = tide === 0 ? 962.5 : 590;
      w.career.debugConditions = { weather: 'natural', tideHeight: null };
      urchinDebug.ui.open('knowledge');
      urchinDebug.ui.chartGroundId = 'outer-vault';
      urchinDebug.ui.chartMode = 'vector';
      urchinDebug.ui.signature = null;
    }, tide);
    await page.waitForTimeout(250);
    await page.getByRole('heading', { name: /The Locked Vault/ }).waitFor();
    await page.screenshot({ path: `test-results/sep21-vault-${tide}.png` });
  }
  await page.evaluate(async () => {
    const { crewProfile } = await import('/src/crew-roster.js'),
      { portrait } = await import('/src/crew-portrait.js');
    const panel = document.createElement('section');
    panel.id = 'portrait-review';
    panel.style.cssText =
      'position:fixed;inset:0;z-index:1000;overflow:auto;background:#193642;display:grid;grid-template-columns:repeat(7,1fr);gap:10px;padding:16px;color:#e4e8d5';
    const c = urchinDebug.world.career,
      profiles = Object.keys(c.people)
        .map((id) => crewProfile(c, id))
        .filter((p) => Number.isInteger(p?.portraitTile));
    if (profiles.length !== 28)
      throw new Error(`Expected 28 new portraits; got ${profiles.length}`);
    panel.innerHTML = profiles
      .map((p) => `<div>${portrait(p)}<small>${p.name}</small></div>`)
      .join('');
    panel
      .querySelectorAll('svg')
      .forEach((e) => (e.style.cssText = 'width:100%;height:180px;display:block'));
    document.body.append(panel);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/sep21-portrait-atlas-review.png' });
  assert.deepEqual(errors, []);
  console.log('PASS wildlife, tidal chart and all remaining portrait frames');
} catch (error) {
  await page.screenshot({ path: 'test-results/sep21-art-failure.png' });
  console.error('Runtime errors:', errors);
  throw error;
} finally {
  await browser.close();
}
