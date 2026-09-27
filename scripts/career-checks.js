import { gamepadScript, pressGamepad } from './gamepad-fixture.js';
import { chooseStarter } from './career-start.js';
import { chooseController } from './controller-menu.js';
import assert from 'node:assert/strict';
export async function careerChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error('PAGE ERROR', e.message);
  });
  await page.addInitScript(gamepadScript, {
    name: 'fakePad',
    id: 'Career Xbox',
    index: 0,
    mapping: 'standard',
  });
  async function button(i) {
    return pressGamepad(page, 'fakePad', i);
  }
  async function choose(prefix) {
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    return chooseController(
      page,
      (name) => button({ confirm: 0, menuDown: 13, menuUp: 12, menuLeft: 14, menuRight: 15 }[name]),
      prefix,
    );
  }
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    assert(!(await page.evaluate(() => urchinDebug.ui.started)));
    await page.screenshot({ path: 'test-results/career-title.png' });
    await button(0);
    await chooseStarter(page, choose);
    await page.evaluate(() => {
      // This fixture exercises a separate explicit inspection later in the flow.
      urchinDebug.world.career.patrolSchedule = {
        window: 'opening-1',
        day: 1,
        visit: false,
        completed: true,
      };
    });
    await page.screenshot({ path: 'test-results/career-harbour.png' });
    await choose('Meet the crew');
    await choose('Berth 1');
    await choose('Nell Fraser');
    assert.equal(await page.evaluate(() => urchinDebug.world.divers[0].name), 'Nell Fraser');
    await page.screenshot({ path: 'test-results/career-crew.png' });
    await button(1);
    await choose('Chandlery');
    await choose('Deck and working lights');
    assert(
      await page.evaluate(() => urchinDebug.world.career.fleet.basic.equipment.includes('lights')),
    );
    await button(1);
    await choose('Sail');
    await choose('Sheltered Kelp');
    await choose('Begin working day');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    await page.evaluate(() => {
      const w = urchinDebug.world;
      Object.assign(w.environment, {
        model: 'uniform',
        current: { x: 0, y: 0 },
        wind: { x: 0, y: 0 },
        waves: 0,
      });
      w.logs = [];
      const p = w.patches.find((p) => p.id === 'good') || w.patches[0];
      Object.assign(w.boat, { x: p.x + 4, y: p.y, vx: 0, vy: 0, throttle: 0, rudder: 0, turn: 0 });
    });
    await button(
      await page.evaluate(() =>
        Number(urchinDebug.input.map.recoverDiver.find((c) => /^b\d+$/.test(c)).slice(1)),
      ),
    );
    await page.waitForFunction(() =>
      ['harvesting', 'searching'].includes(urchinDebug.world.diver.state),
    );
    await page.evaluate(() => urchinDebug.step(70));
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'surface');
    const bag = await page.evaluate(() => urchinDebug.world.diver.bag);
    assert(bag > 0);
    await page.evaluate(() => {
      const w = urchinDebug.world;
      Object.assign(w.boat, { x: w.diver.x + 4, y: w.diver.y, vx: 0, vy: 0 });
    });
    await button(
      await page.evaluate(() =>
        Number(urchinDebug.input.map.recoverDiver.find((c) => /^b\d+$/.test(c)).slice(1)),
      ),
    );
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'ready');
    assert(await page.evaluate(() => urchinDebug.world.catch > 0));
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.day.minute = 1000;
      Object.assign(w.boat, {
        x: 300,
        y: w.terrain.size - 0.001,
        heading: Math.PI,
        vx: 0,
        vy: 1,
        throttle: 1,
        rudder: 0,
      });
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'summary');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.records.days), 1);
    await page.screenshot({ path: 'test-results/career-offload.png' });
    await choose('Prepare next day');
    await page.waitForFunction(() => urchinDebug.world.career.day === 2);
    await button(1);
    await page.waitForFunction(() => !urchinDebug.ui.started);
    await button(0);
    await page.waitForFunction(() => urchinDebug.ui.screen === 'harbour');
    await choose('Harbour office');
    await choose('Fleet landings');
    await page.screenshot({ path: 'test-results/career-fleet-board.png' });
    await button(1);
    await button(1);
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.screenshot({ path: 'test-results/career-harbour-1024.png' });
    const saved = await page.evaluate(() => {
      urchinDebug.ui.hooks.save();
      return {
        cash: urchinDebug.world.career.cash,
        crew: urchinDebug.world.career.crew,
        day: urchinDebug.world.career.day,
      };
    });
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await button(0);
    await page.waitForFunction(() => urchinDebug.ui.screen === 'harbour');
    assert.deepEqual(
      await page.evaluate(() => ({
        cash: urchinDebug.world.career.cash,
        crew: urchinDebug.world.career.crew,
        day: urchinDebug.world.career.day,
      })),
      saved,
    );
    await choose('Weather & tides');
    await choose('Early start');
    assert.equal(await page.evaluate(() => urchinDebug.world.day.minute), 300);
    await page.screenshot({ path: 'test-results/career-weather-plan.png' });
    await button(1);
    await choose('Settings');
    await choose('Difficulty / assists');
    await choose('Realistic preset');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.assists.groundDots), false);
    await page.screenshot({ path: 'test-results/career-assists.png' });
    await button(1);
    await button(1);
    await choose('Chandlery');
    await choose('Recording chartplotter');
    // If the starter budget needs financing, arrange it through actual menus.
    if (
      !(await page.evaluate(() =>
        urchinDebug.world.career.fleet.basic.equipment.includes('plotter'),
      ))
    ) {
      await button(1);
      await choose('Harbour office');
      await choose('Fuel, repairs');
      await choose('Borrow up to');
      await button(1);
      await button(1);
      await choose('Chandlery');
      await choose('Recording chartplotter');
    }
    await button(1);
    await choose('Sail');
    await choose('Sheltered Kelp');
    await page.screenshot({ path: 'test-results/career-chart-realistic.png' });
    await choose('Begin working day');
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    await page.evaluate(() => {
      const w = urchinDebug.world,
        p = w.patches[0];
      Object.assign(w.boat, { x: p.x + 9, y: p.y, vx: 0, vy: 0, throttle: 0 });
      w.career.weatherPlan = [{ minute: 0, kind: 'fog', bearing: 210 }];
      w.career.fleet.basic.equipment.push('radar', 'scanner');
      w.logs = [{ x: p.x + 29, y: p.y, heading: 0, length: 3, radius: 0.2 }];
    });
    await page.waitForFunction(() => urchinDebug.world.weather?.kind === 'fog');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.current-instrument').count(), 0);
    assert(await page.evaluate(() => urchinDebug.terrainView.labels.every((l) => !l.visible)));
    assert(
      await page
        .locator('#electronics')
        .innerText()
        .then((t) => t.includes('RADAR') && t.includes('SCANNER')),
    );
    await page.screenshot({ path: 'test-results/career-night-fog.png' });
    await button(9);
    await choose('Local Chart');
    await choose('Mark current position');
    assert(await page.evaluate(() => urchinDebug.world.career.marks.length === 1));
    await page.screenshot({ path: 'test-results/career-chart-recorded.png' });
    await button(1);
    await choose('Resume');
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.bags = [{ weight: 300, quality: 0.8, undersizeCount: 0, harvestMinute: w.day.minute }];
      w.catch = 300;
      w.day.inspection = { status: 'calling', minute: w.day.minute - 1 };
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'patrol');
    await choose('Divers up, come over');
    await page.waitForFunction(() => urchinDebug.world.day.inspection.status === 'boarding');
    await page.screenshot({ path: 'test-results/career-inspection.png' });
    await page.evaluate(() => urchinDebug.step(38));
    assert.equal(await page.evaluate(() => urchinDebug.world.day.inspection.status), 'cleared');
    assert.equal(await page.evaluate(() => urchinDebug.world.day.inspectionFine), 0);
    await button(9);
    await choose('Settings');
    await choose('Exit Game');
    await button(1);
    assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'settings');
    await choose('Exit Game');
    await choose('Launcher / title');
    assert.equal(await page.evaluate(() => urchinDebug.ui.started), false);
    await button(0);
    await page.waitForFunction(() => urchinDebug.ui.started);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.day), 2);
    // Restart from the harbour logbook; the live career is archived, then restored using only menu buttons.
    await page.evaluate(() => {
      const w = urchinDebug.world;
      Object.assign(w.boat, {
        x: 300,
        y: w.terrain.size - 0.001,
        heading: Math.PI,
        vx: 0,
        vy: 1,
        throttle: 1,
        rudder: 0,
      });
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'summary');
    await choose('Prepare next day');
    await choose('Harbour office');
    await choose('Skipper logbook');
    const oldSeed = await page.evaluate(() => urchinDebug.world.career.seed);
    await choose('Start a new career');
    await chooseStarter(page, choose);
    assert.notEqual(await page.evaluate(() => urchinDebug.world.career.seed), oldSeed);
    await choose('Harbour office');
    await choose('Skipper logbook');
    await choose('Archived careers');
    await choose('Resume day');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.seed), oldSeed);
    await choose('Harbour office');
    await choose('Skipper logbook');
    const download = page.waitForEvent('download');
    await choose('Export career backup');
    const file = await download;
    assert(file.suggestedFilename().startsWith('urchin-career-day-'));
    await file.saveAs('test-results/exported-career.json');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import career backup', exact: true }).click();
    await (await chooser).setFiles('test-results/exported-career.json');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'harbour');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.seed), oldSeed);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: controller career title, harbour, hiring, equipment, actual autonomous harvest/recovery, offload settlement, next day and save/reload at compact resolution; weather / early start, assists, recorded chart, radar/scanner night fog rendering, direct DFO invitation and inspection and career Exit/Back/Launcher.',
    );
  } catch (error) {
    console.error(
      'Career failure state',
      await page
        .evaluate(() => ({
          screen: urchinDebug.ui.screen,
          index: urchinDebug.ui.index,
          lock: urchinDebug.ui.lockReason,
          day: urchinDebug.world.day,
          divers: urchinDebug.world.divers.map((d) => ({
            name: d.name,
            state: d.state,
            bag: d.bag,
          })),
        }))
        .catch(() => null),
    );
    await page.screenshot({ path: 'test-results/career-failure.png' }).catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}
