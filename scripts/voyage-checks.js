import { gamepadScript, pressGamepad } from './gamepad-fixture.js';
import { chooseStarter } from './career-start.js';
import { chooseController } from './controller-menu.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
export async function voyageChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.setDefaultTimeout(25000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    // Match the repeatable unit-voyage career; its generated weather still evolves normally.
    window.voyageClock = Date.now;
    Date.now = () => 171709;
  });
  await page.addInitScript(gamepadScript, {
    name: 'voyagePad',
    id: 'Voyage Xbox',
    index: 0,
    mapping: 'standard',
  });
  const button = async (i) => {
    return pressGamepad(page, 'voyagePad', i);
  };
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await page.evaluate(() => {
      Date.now = window.voyageClock;
      delete window.voyageClock;
    });
    await button(0);
    await chooseStarter(page, (prefix) =>
      chooseController(
        page,
        (name) =>
          button({ confirm: 0, menuDown: 13, menuUp: 12, menuLeft: 14, menuRight: 15 }[name]),
        prefix,
      ),
    );
    await button(0);
    await page.waitForFunction(() => urchinDebug.ui.screen === 'chart');
    await button(0);
    await page.waitForFunction(() => urchinDebug.ui.screen === 'departure');
    await button(0);
    await page.waitForFunction(() => !urchinDebug.ui.blocked);
    await page.exposeFunction('voyageObserve', async (label) => {
      if (['drop', 'surface', 'recovered', 'offload'].includes(label)) {
        await page.waitForTimeout(80);
        await page.screenshot({ path: `test-results/natural-voyage-${label}.png` });
      }
    });
    const pilot = readFileSync(new URL('./voyage-pilot.js', import.meta.url), 'utf8').replace(
      /^import .*;$/gm,
      '',
    );
    await page.addScriptTag({
      type: 'module',
      content:
        'const { step, deploymentStatus, recoveryStatus, boatSpec, depthAt, currentAt } = urchinDebug.simulation;\n' +
        'const answerPatrol = (w) => { const ui = urchinDebug.ui; ui.open("patrol"); ui.index = 0; ui.activate(w); };\n' +
        pilot +
        '\nwindow.careerVoyage = careerVoyage;',
    });
    await page.waitForFunction(() => !!window.careerVoyage);
    const result = await page.evaluate(async () => {
      return window.careerVoyage(urchinDebug.world, async (label) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await window.voyageObserve(label);
      });
    });
    assert(result.hull >= 0.99, 'ordinary voyage must return without material hull damage');
    assert(result.crew.every((c) => c === 'fit'));
    await page.waitForFunction(() => urchinDebug.ui.screen === 'summary');
    assert(await page.evaluate(() => urchinDebug.world.day.result.onTime));
    assert.deepEqual(errors, []);
    console.log(
      'PASS: complete career voyage with actual boat navigation, unchanged tide/weather, natural harvest, maneuvered recovery, physical return and settlement.',
      result,
    );
  } catch (error) {
    console.log(
      'Voyage failure state',
      await page
        .evaluate(() => ({
          time: urchinDebug.world.time,
          lock: urchinDebug.ui.lockReason,
          frame: urchinDebug.three.renderer.info.render.frame,
          loop: {
            running: urchinDebug.three.host.game.loop.running,
            sleep: urchinDebug.three.host.game.loop.isRunning,
          },
          pad: urchinDebug.input.buttonPrevious,
          samples: urchinDebug.renderSamples.slice(-2),
        }))
        .catch((e) => ({ error: e.message })),
    );
    await page.screenshot({ path: 'test-results/natural-voyage-failure.png' }).catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}
