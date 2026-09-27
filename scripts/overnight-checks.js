import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
export async function overnightChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto((process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/') + '?prototype=1');
  await page.locator('#keyboardFallback').click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
  const previews = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate((i) => {
      urchinDebug.ui.index = i;
      urchinDebug.ui.signature = null;
    }, i);
    await page.waitForFunction(
      (i) =>
        document.querySelector('.area-preview')?.title ===
        ['Sheltered Kelp', 'South Reef', 'Outer Ledge'][i],
      i,
    );
    previews.push(await page.locator('.area-preview canvas').evaluate((c) => c.toDataURL()));
  }
  assert.equal(new Set(previews).size, 3, 'initial highlighted sector previews differ');
  await page.screenshot({ path: 'test-results/overnight-area-preview.png' });
  await page.getByRole('button', { name: 'Visit prototype boatyard' }).click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'boatyard');
  await page.getByRole('button', { name: 'Coastal Workhorse', exact: true }).click();
  await page.waitForFunction(() => urchinDebug.world.boat.configuration === 'thruster');
  await page.screenshot({ path: 'test-results/overnight-boatyard.png' });
  await page.getByRole('button', { name: 'Back to previous menu', exact: true }).click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
  await page.locator('.chart-choices button').first().click();
  await page.locator('.departure-choices button').first().click();
  await page.waitForFunction(
    () => !urchinDebug.ui.blocked && urchinDebug.world.day.phase === 'working',
  );
  await page.evaluate(() => {
    urchinDebug.ui.open('pause');
    const w = urchinDebug.world;
    w.terrain.depths.fill(30);
    w.environment.model = 'uniform';
    w.environment.current = { x: 0, y: 0 };
    w.environment.wind = { x: 0, y: 0 };
    w.environment.waves = 0;
    w.logs = [];
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
    urchinDebug.ui.open(null);
  });
  const neutralTime = await page.evaluate(() => urchinDebug.world.time);
  await page.waitForFunction(
    (time) => !urchinDebug.ui.blocked && urchinDebug.world.time > time + 0.1,
    neutralTime,
  );
  assert.equal(await page.evaluate(() => urchinDebug.world.boat.configuration), 'thruster');
  await page.keyboard.down('f');
  try {
    await page.waitForFunction(() => urchinDebug.world.boat.heading > 0.06);
  } catch (error) {
    const state = await page.evaluate(() => ({
      lock: urchinDebug.ui.lockReason,
      blocked: urchinDebug.ui.blocked,
      suppressed: urchinDebug.input.suppressed,
      keys: [...urchinDebug.input.keys],
      raw: urchinDebug.input.raw,
      boat: urchinDebug.world.boat,
      day: urchinDebug.world.day,
      time: urchinDebug.world.time,
      focused: document.hasFocus(),
      target: document.activeElement?.tagName,
    }));
    writeFileSync('test-results/overnight-thruster-failure.json', JSON.stringify(state, null, 2));
    await page.screenshot({ path: 'test-results/overnight-thruster-failure.png' });
    throw error;
  } finally {
    await page.keyboard.up('f');
  }
  await page.waitForFunction(() => urchinDebug.world.boat.thruster === 0);
  await page.keyboard.press('g');
  await page.waitForFunction(() => urchinDebug.ui.screen === 'boatyard');
  for (const name of [
    'Reef Runner',
    'Island Tender',
    'Shoal Skipper',
    'Channel Master',
    'Harbour Workhorse',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(
      (name) => document.querySelector('.yard-detail h3')?.textContent === name,
      name,
    );
  }
  assert.equal(
    await page.evaluate(() => urchinDebug.world.boat.configuration),
    'thruster',
    'at-sea inspection cannot change fitted boat',
  );
  assert.match(await page.locator('#playtest').textContent(), /START A NEW DAY TO CHANGE BOAT/);
  await page.evaluate(() => {
    urchinDebug.reset({ practice: false, boatId: 'basic' });
    urchinDebug.ui.open('chart');
  });
  await page.locator('.chart-choices button').first().click();
  await page.locator('.departure-choices button').first().click();
  await page.waitForFunction(() => !urchinDebug.ui.blocked && urchinDebug.world.time > 0.1);
  await page.keyboard.press('t');
  await page.waitForFunction(() => urchinDebug.ui.screen === 'almanac');
  const clockBefore = await page.evaluate(() => urchinDebug.world.day.minute);
  const mapBefore = await page.locator('.almanac-map canvas').evaluate((c) => c.toDataURL());
  await page.getByRole('slider', { name: 'Forecast time, minutes ahead' }).fill('480');
  await page.waitForFunction(() => urchinDebug.ui.forecastOffset === 480);
  await page.screenshot({ path: 'test-results/overnight-almanac.png' });
  assert.equal(await page.evaluate(() => urchinDebug.world.day.minute), clockBefore);
  assert.notEqual(
    await page.locator('.almanac-map canvas').evaluate((c) => c.toDataURL()),
    mapBefore,
  );
  await page.evaluate(() => {
    urchinDebug.ui.realistic = true;
    urchinDebug.ui.signature = null;
  });
  await page.waitForFunction(() =>
    document.querySelector('.almanac-map p')?.textContent.includes('Main channel:'),
  );
  assert(!/Reference flow/.test(await page.locator('.almanac-map').textContent()));
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.screenshot({ path: 'test-results/overnight-almanac-1024.png' });
  const fits = await page.locator('.almanac-layout').evaluate((el) => {
    const a = el.getBoundingClientRect(),
      p = document.querySelector('#playtest').getBoundingClientRect(),
      footer = document.querySelector('.day-footer').getBoundingClientRect();
    return (
      a.bottom < footer.top &&
      a.right < p.right &&
      [...document.querySelectorAll('.almanac-choices button')].every(
        (b) => b.getBoundingClientRect().bottom < footer.top,
      )
    );
  });
  assert(fits, 'all forecast controls fit above the footer');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    urchinDebug.ui.realistic = false;
    urchinDebug.ui.open(null);
    const w = urchinDebug.world,
      s = w.terrain.tidalSites[0];
    Object.assign(w.boat, {
      x: s.x + 28,
      y: s.y + 10,
      heading: 0,
      throttle: 0,
      rudder: 0,
      turn: 0,
      vx: 0,
      vy: 0,
    });
    w.day.minute = 660;
  });
  await page.waitForFunction(
    () => urchinDebug.world.environment.minute >= 660 && urchinDebug.world.environment.minute < 665,
  );
  await page.screenshot({ path: 'test-results/overnight-tide-high.png' });
  await page.evaluate(() => (urchinDebug.world.day.minute = 1050));
  await page.waitForFunction(() => urchinDebug.world.environment.minute >= 1050);
  await page.screenshot({ path: 'test-results/overnight-tide-low.png' });
  // A rescue is an explicit in-game action and preserves both crew members.
  await page.evaluate(() => {
    const w = urchinDebug.world;
    w.boat.configuration = 'sterndrive';
    w.boat.driveHealth = 0;
    w.catch = 600;
    w.bags = [{ weight: 600, quality: 0.9, harvestMinute: 960 }];
    Object.assign(w.diver, { state: 'surface', bag: 200, qualitySum: 160 });
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Radio for rescue / end fishing', exact: true }).click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'summary');
  assert.equal(await page.evaluate(() => urchinDebug.world.day.result.gross), 800);
  assert(await page.evaluate(() => urchinDebug.world.divers.every((d) => d.state === 'ready')));
  await page.screenshot({ path: 'test-results/overnight-rescue-results.png' });
  // The real rendered good ground also depletes locally while its diver moves.
  await page.evaluate(() => {
    urchinDebug.reset({ practice: false, boatId: 'basic' });
    urchinDebug.ui.open('chart');
  });
  await page.locator('.chart-choices button').first().click();
  await page.locator('.departure-choices button').first().click();
  await page.waitForFunction(() => !urchinDebug.ui.blocked && urchinDebug.world.time > 0.1);
  await page.keyboard.press('1'); // Keyboard amendment: deploy/board.
  await page.waitForFunction(() => urchinDebug.world.diver.state === 'deploying');
  const harvest = await page.evaluate(() => {
    const w = urchinDebug.world,
      d = w.diver,
      start = { x: d.x, y: d.y };
    urchinDebug.step(35);
    const p = w.patches.find((p) => p.id === 'good');
    return {
      distance: Math.hypot(d.x - start.x, d.y - start.y),
      bag: d.bag,
      depleted: p.clumps.filter((c) => c.remaining < 0.001).length,
      stock: p.remaining,
    };
  });
  assert(harvest.distance > 5 && harvest.bag > 150 && harvest.depleted >= 2);
  assert(Math.abs(harvest.stock + harvest.bag - 1000) < 0.001);
  await page.waitForFunction(() => urchinDebug.world.time > 35.2);
  await page.screenshot({ path: 'test-results/overnight-clump-harvest.png' });
  assert.deepEqual(errors, []);
  writeFileSync(
    'test-results/overnight-browser-report.json',
    JSON.stringify(
      {
        previews: 3,
        boats: 6,
        forecastNonMutating: true,
        compactControlsFit: true,
        tideScreenshots: true,
        rescueCrewAndCatch: true,
        harvest,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS: three highlighted previews, six boat packages, actual keyboard bow-thruster hold/release, nonmutating forecast, Realistic information limits, compact controls, high/low tide rendering, rescue/settlement, and rendered local clump depletion/movement.',
  );
  await page.close();
}
