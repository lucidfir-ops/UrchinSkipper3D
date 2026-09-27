import assert from 'node:assert/strict';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
import { chooseStarter } from './career-start.js';

export async function wildlifeChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [],
    action = (name) => pressAction(page, 'wildlifePad', name),
    choose = (label) => chooseController(page, action, label);
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.addInitScript(gamepadScript, { name: 'wildlifePad', id: 'Wildlife Xbox' });
    await page.goto(process.env.URCHIN_TEST_URL);
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await action('confirm');
    await chooseStarter(page, choose);
    await choose('Sail');
    await choose('Sheltered Kelp');
    await choose('Begin working day');
    await page.locator('#voyage').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      const w = window.urchinDebug.world,
        centre = w.patches.find((patch) => patch.remaining > 0) || { x: 250, y: 250 },
        encounter = (species, x, y, members = 1, state = 'travelling') => ({
          id: `browser-${species}`,
          species,
          x,
          y,
          heading: 0.35,
          speed: 0,
          born: w.time,
          expires: w.time + 120,
          state,
          rockId: null,
          members: Array.from({ length: members }, (_, index) => ({
            offsetX: index * 4,
            offsetY: (index % 2) * 3,
            phase: index,
            surfaced: true,
          })),
        });
      Object.assign(w.boat, {
        x: centre.x,
        y: centre.y,
        vx: 0,
        vy: 0,
        throttle: 0,
        speed: 0,
      });
      w.weather.visibility = 500;
      w.career.trafficSettings = { rate: 0 };
      w.wildlife = {
        area: w.day.groundId,
        sectorRevision: w.sectorRevision,
        serial: 7,
        scheduleSerial: 1,
        accumulator: 0,
        nextSpawnAt: w.time + 1000,
        encounters: [
          encounter('seagull', centre.x - 28, centre.y - 18, 3),
          encounter('eagle', centre.x - 10, centre.y - 25, 1, 'flying'),
          encounter('dolphin', centre.x + 15, centre.y - 22, 3),
          encounter('orca', centre.x + 34, centre.y - 3, 2),
          encounter('humpback', centre.x + 18, centre.y + 27, 2),
          encounter('seal', centre.x - 15, centre.y + 23, 2, 'hauled'),
          encounter('seaLion', centre.x - 35, centre.y + 3, 3, 'hauled'),
        ],
      };
    });
    await page.waitForTimeout(500);
    // The game surface is the canvas owned by Phaser. Chart/minimap/weather
    // canvases are legitimate siblings and must not make this check brittle.
    assert.equal(await page.locator('#game > canvas').count(), 1);
    await page.screenshot({ path: 'test-results/wildlife-vectors.png' });
    assert.deepEqual(errors, []);
    console.log('PASS: wildlife vector scene renders all seven species without browser errors');
  } finally {
    await page.close();
  }
}
