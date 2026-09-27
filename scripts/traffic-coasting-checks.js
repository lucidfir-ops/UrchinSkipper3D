import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { careerWorld, encode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { spawnTraffic, stepTraffic } from '../src/traffic.js';
import { clearWater } from '../src/water-route.js';

export async function trafficCoastingChecks(browser) {
  const name = browser.browserType().name(),
    errors = [],
    w = careerWorld();
  chooseGround(w, 'near');
  w.day.minute = 700;
  w.career.trafficSettings = { rate: 0 };
  Object.assign(w.career.assists, {
    helmOverlay: false,
    diverCards: false,
    weatherOverlay: false,
    departureGuidance: false,
    actionPrompts: false,
    pickingLegend: false,
  });
  const fleet = w.career.todayFleet.find((f) => !f.hidden);
  Object.assign(fleet, { area: 'near', begin: 0, end: 1120, goal: 20000, gross: 0, qualitySum: 0 });
  const actor = spawnTraffic(w, 'rival', { fleetId: fleet.id });
  assert(actor);
  for (let n = 0; n < 2000 && actor.phase !== 'fishing'; n++) {
    w.time += 0.1;
    stepTraffic(w, 0.1);
  }
  assert.equal(actor.phase, 'fishing');
  const patch = w.patches.find((p) => p.id === actor.patchId);
  const station = [
    { x: actor.x + 25, y: actor.y },
    { x: actor.x, y: actor.y + 25 },
    { x: actor.x - 25, y: actor.y },
  ].find((p) => clearWater(w.terrain, w.environment.seaLevel || 0, p, { draft: 3, radius: 7 }));
  assert(station);
  Object.assign(w.boat, station, { throttle: 0, rudder: 0, vx: 0, vy: 0, turn: 0 });
  w.career.debugConditions = { weather: 'calm', bearing: 0, tideHeight: null };
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript((save) => {
    if (!localStorage.getItem('urchin-career-v1')) localStorage.setItem('urchin-career-v1', save);
  }, encode(w));
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const press = async (key) => {
    await page.waitForFunction(() => urchinDebug.ready && !urchinDebug.input.suppressed);
    await page.keyboard.press(key, { delay: 80 });
  };
  try {
    await page.goto((process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/') + '?renderer=canvas');
    await page.waitForFunction(() => window.urchinDebug?.ready);
    await page.locator('#keyboardFallback').click();
    await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
    await press('Enter');
    await page.waitForTimeout(1000);
    const before = await page.evaluate(
      (id) => urchinDebug.world.patches.find((p) => p.id === id).remaining,
      patch.id,
    );
    await page.evaluate(() => urchinDebug.step(3));
    const fishing = await page.evaluate((id) => {
      const w = urchinDebug.world,
        a = w.traffic.actors.find((a) => a.kind === 'rival');
      return {
        phase: a.phase,
        speed: a.speed,
        bubbles: a.divers.length,
        bags: a.deckBags,
        remaining: w.patches.find((p) => p.id === id).remaining,
      };
    }, patch.id);
    assert.equal(fishing.phase, 'fishing');
    assert.equal(fishing.speed, 0);
    assert(fishing.bubbles > 0 && fishing.remaining < before);
    await page.screenshot({ path: `test-results/traffic-coasting-${name}-fishing.png` });
    assert.equal(await page.locator('#touchMenu').isVisible(), false);
    assert(await page.locator('#keyboardHelm [data-action="pause"]').isVisible());
    assert.equal(await page.locator('#minimapPanel').getAttribute('data-presentation'), 'chart');
    await page.locator('#keyboardHelm [data-action="pause"]').click();
    await page.getByRole('button', { name: 'Arrange UI layout', exact: true }).click();
    await page.locator('[data-action="layout-almanacPanel"]').click();
    await page.screenshot({ path: `test-results/traffic-coasting-${name}-layout.png` });
    await page.locator('[data-action="layout-toggle"]').click();
    await page.locator('[data-action="layout-save"]').click();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    assert.equal(await page.locator('#almanacPanel').isVisible(), false);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.currentOverlay), true);
    // Isolate keyboard commands in deep, calm water. Real coastal traffic was
    // checked above; the force and tide regressions exercise actual bathymetry.
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.terrain.depths = w.terrain.depths.slice().fill(40);
      w.traffic.actors = [];
      w.logs = [];
      w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
      Object.assign(w.boat, {
        x: 300,
        y: 300,
        heading: 0,
        vx: 0,
        vy: 0,
        throttle: 0,
        rudder: 0,
        turn: 0,
      });
    });
    await press('PageUp');
    await page.keyboard.down('d');
    await page.waitForFunction(() => urchinDebug.world.boat.rudder >= 0.99);
    await page.keyboard.up('d');
    await page.waitForFunction(
      () =>
        document
          .querySelector('#keyboardHelm [data-action="right"]')
          .style.getPropertyValue('--command-level') === '100%',
    );
    assert.equal(
      await page
        .locator('#keyboardHelm [data-action="throttleUp"]')
        .evaluate((el) => el.style.getPropertyValue('--command-level')),
      '100%',
    );
    await page.screenshot({ path: `test-results/traffic-coasting-${name}-keyboard.png` });
    await press('Space');
    await page.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
    assert.equal(
      await page
        .locator('#keyboardHelm [data-action="right"]')
        .evaluate((el) => el.style.getPropertyValue('--command-level')),
      '100%',
    );
    await press('Enter');
    await page.waitForFunction(() => urchinDebug.world.boat.rudder === 0);
    await press('PageDown');
    await page.waitForFunction(
      () =>
        document
          .querySelector('#keyboardHelm [data-action="throttleDown"]')
          .style.getPropertyValue('--command-level') === '100%',
    );
    await press('Space');
    await press('Escape');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'pause');
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ready);
    assert.equal(
      await page.evaluate(() => urchinDebug.world.career.assists.almanacShortcut),
      false,
    );
    assert.deepEqual(errors, []);
    writeFileSync(
      `test-results/traffic-coasting-${name}.json`,
      JSON.stringify(
        {
          fishing,
          keyboard: 'latched throttle/rudder gradients, neutral, centering, reverse and menu',
          almanac: 'independent hide saved through reload',
          errors,
        },
        null,
        2,
      ),
    );
    console.log(
      `PASS ${name}: real marked-bed fishing, stock loss, keyboard gradients/menu, independent almanac layout and saved preference`,
    );
  } finally {
    await context.close();
  }
}
