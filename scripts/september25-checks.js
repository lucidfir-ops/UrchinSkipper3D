import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { careerWorld, encode } from '../src/career-save.js';
import { createCareer } from '../src/career-state.js';
import { chooseFirstBoat } from '../src/starter-career.js';
import { assignCrew } from '../src/crew.js';
import { chooseGround } from '../src/day.js';
import { checkDiverSafety } from '../src/diver-safety.js';

export async function september25Checks(browser) {
  const name = browser.browserType().name(),
    errors = [],
    w = careerWorld(createCareer(2509, { chooseStarter: true }));
  chooseFirstBoat(w, 'basic');
  w.career.day = 8;
  w.career.cash = 150000;
  w.career.people.ada.availableDay = 10;
  assignCrew(w);
  w.career.trafficSettings = { rate: 0 };
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript((save) => {
    if (!localStorage.getItem('urchin-career-v1')) localStorage.setItem('urchin-career-v1', save);
  }, encode(w));
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/';
  const open = async (screen) => {
    await page.evaluate((s) => urchinDebug.ui.open(s), screen);
    await page.waitForFunction(
      (s) => urchinDebug.ui.screen === s && !urchinDebug.input.suppressed,
      screen,
    );
    await page.waitForTimeout(150);
  };
  try {
    await page.goto(base + '?renderer=canvas');
    await page.waitForFunction(() => window.urchinDebug?.ready);
    await page.locator('#keyboardFallback').click();
    await open('departure');
    await page.getByRole('button', { name: 'Begin working day', exact: true }).click();
    await page.getByRole('heading', { name: /Are you sure\?/ }).waitFor();
    assert.equal(await page.evaluate(() => urchinDebug.ui.index), 0);
    assert.match(await page.locator('.career-detail').innerText(), /Ada.*unavailable/);
    await page.screenshot({ path: `test-results/september25-${name}-unfit.png` });
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    await page.keyboard.press('Enter', { delay: 80 });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'departure');
    assert.equal(await page.evaluate(() => urchinDebug.world.day.phase), 'planning');
    await page.getByRole('button', { name: 'Sleep · fish next day', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel · keep today', exact: true }).click();
    assert.equal(await page.evaluate(() => urchinDebug.world.career.day), 8);
    await open('office');
    await page.locator('[data-action="rest"]').click();
    await page.getByRole('button', { name: 'Yes · rest until tomorrow', exact: true }).click();
    await page.waitForFunction(() => urchinDebug.world.career.day === 9 && urchinDebug.ready);
    await open('accounts');
    const before = await page.evaluate(() => urchinDebug.world.career.cash);
    for (let i = 0; i < 5; i++) await page.locator('[data-action="borrow"]').click();
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), before + 25000);
    await page.locator('[data-action="area-maelstrom"]').click();
    await page.locator('[data-action="confirm-purchase"]').click();
    await page.getByRole('heading', { name: /MAELSTROM COAST · ACCESS PURCHASED/ }).waitFor();
    assert.match(
      await page.locator('.coast-access-notice').innerText(),
      /Upgrade to a stronger.*boat/,
    );
    await page.screenshot({ path: `test-results/september25-${name}-permit.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test-results/september25-${name}-permit-portrait.png` });
    const bounds = await page.locator('[data-action="chart"]').boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    await page.setViewportSize({ width: 1280, height: 800 });
    await open('departure');
    await page.getByRole('button', { name: 'Begin working day', exact: true }).click();
    await page.getByRole('button', { name: 'Yes · sail with this crew', exact: true }).click();
    await page.waitForFunction(
      () =>
        urchinDebug.ready && !urchinDebug.ui.screen && urchinDebug.world.day.phase === 'working',
    );
    await open('assists');
    await page.locator('[data-action="easy"]').click();
    await page.locator('[data-action="assist-currentOverlay"]').click();
    await page.evaluate(() => urchinDebug.ui.open(null));
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#currentReadout').isVisible(), false);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.currentArrows), true);
    await page.screenshot({ path: `test-results/september25-${name}-arrows.png` });
    await open('debug-mode');
    await page.getByRole('button', { name: /^Godmode: OFF/ }).click();
    await page.locator('#godmodeNotice').waitFor({ state: 'visible' });
    await page.screenshot({ path: `test-results/september25-${name}-godmode.png` });
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ready);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.debugConditions.godmode), true);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.currentOverlay), false);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.currentArrows), true);
    // Isolated render fixture: observe all three conditional cues with simulation paused.
    await page.evaluate(() => {
      const w = urchinDebug.world;
      urchinDebug.ui.open('pause');
      w.career.debugConditions.godmode = false;
      Object.assign(w.boat, { grounded: true, hullHealth: 0.4, driveHealth: 0.4, speed: 5 });
      w.environment.waves = 0.7;
      document.querySelector('#playtest').style.visibility = 'hidden';
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `test-results/september25-${name}-sea-cues.png` });
    assert.deepEqual(errors, []);
  } catch (e) {
    await page.screenshot({ path: `test-results/september25-${name}-FAILURE.png` });
    throw e;
  } finally {
    await context.close();
  }

  // Render an actual fatal strike saved by the ordinary collision path.
  const fatal = careerWorld();
  chooseGround(fatal, 'near');
  fatal.career.trafficSettings = { rate: 0 };
  const b = fatal.boat,
    d = fatal.divers[0];
  Object.assign(b, { heading: 0, vx: 0, vy: -10, turn: 0, throttle: 1, speed: 10 });
  Object.assign(d, { x: b.x, y: b.y - 5, state: 'surface' });
  checkDiverSafety(fatal, { x: b.x, y: b.y + 10, heading: 0 });
  assert.equal(d.state, 'fatality');
  const bloodContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await bloodContext.addInitScript(
    (save) => localStorage.setItem('urchin-career-v1', save),
    encode(fatal),
  );
  const blood = await bloodContext.newPage();
  blood.on('pageerror', (e) => errors.push(e.message));
  try {
    await blood.goto(base + '?renderer=canvas');
    await blood.waitForFunction(() => window.urchinDebug?.ready);
    await blood.locator('#keyboardFallback').click();
    await blood.waitForTimeout(500);
    await blood.waitForFunction(() => urchinDebug.ui.screen === 'emergency');
    assert((await blood.locator('#playtest').boundingBox()).y > 400);
    await blood.screenshot({ path: `test-results/september25-${name}-blood.png` });
    assert.equal(await blood.evaluate(() => urchinDebug.world.safety.fatalities), 1);
    await blood.setViewportSize({ width: 390, height: 844 });
    await blood.evaluate(() => urchinDebug.ui.touch.setEnabled(true));
    await blood.waitForTimeout(250);
    assert((await blood.locator('#playtest').boundingBox()).y > 422);
    const rescue = blood.getByRole('button', {
      name: 'Radio for rescue / end fishing',
      exact: true,
    });
    const button = await rescue.boundingBox();
    assert(button.y >= 0 && button.y + button.height <= 844);
    await blood.screenshot({ path: `test-results/september25-${name}-blood-portrait.png` });
    await rescue.click();
    await blood.waitForFunction(() => urchinDebug.world.day.phase === 'complete');
    assert.equal(await blood.evaluate(() => urchinDebug.world.safety.fatalities), 1);
    assert.deepEqual(errors, []);
  } finally {
    await bloodContext.close();
  }
  writeFileSync(
    `test-results/september25-${name}.json`,
    JSON.stringify(
      {
        confirmations: true,
        permit: true,
        portrait: true,
        repeatLoans: true,
        arrowsIndependent: true,
        godmodeReload: true,
        fatalBlood: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS ${name}: confirmations, permit/Frank, portrait, loans, independent arrows, godmode/reload and saved fatal blood`,
  );
}
