import { learningInterfaceChecks } from './learning-interface-checks.js';
import { diverOperationsChecks } from './diver-operations-checks.js';
import { trafficCoastingChecks } from './traffic-coasting-checks.js';
import { september25Checks } from './september25-checks.js';
import { september21Checks } from './september21-checks.js';
import { workingDayChecks } from './working-day-checks.js';
import { crewCoastsChecks } from './crew-coasts-checks.js';
import { tabletFeedbackChecks } from './tablet-feedback-checks.js';
import { september23Checks } from './september23-checks.js';
import { audioSchedulingChecks } from './audio-scheduling-checks.js';
import { september22Checks, september22Performance } from './september22-checks.js';
import { chartLayoutChecks } from './chart-layout-checks.js';
import { deviceFeedbackChecks } from './device-feedback-checks.js';
import { deviceEmbedChecks } from './device-embed-checks.js';
import { coastalProgressionChecks } from './coastal-progression-checks.js';
import { debugModeChecks } from './debug-mode-checks.js';
import { minimapLayoutChecks } from './minimap-layout-checks.js';
import { shoreHazardChecks } from './shore-hazard-checks.js';
import { s22LatestChecks } from './s22-latest-checks.js';
import { s22FeedbackChecks, s22TitleChecks } from './s22-feedback-checks.js';
import { frankNavigationChecks } from './frank-navigation-checks.js';
import { harbourShopChecks } from './harbour-shop-checks.js';
import { hudWindowChecks } from './hud-window-checks.js';
import { september15Checks } from './september15-checks.js';
import { itchFeedbackChecks } from './itch-feedback-checks.js';
import { keyboardFeedbackChecks } from './keyboard-feedback-checks.js';
import { september13Checks } from './september13-checks.js';
import { touchFeedbackChecks } from './touch-feedback-checks.js';
import { performanceChecks } from './performance-checks.js';
import { v2Checks } from './v2-checks.js';
import { vesselChecks } from './vessel-checks.js';
import { trafficChecks } from './traffic-checks.js';
import { wildlifeChecks } from './wildlife-checks.js';
import { trainingChecks } from './training-checks.js';
import { iterationChecks } from './iteration-checks.js';
import { september12Checks } from './september12-checks.js';
import { panelFeedbackChecks } from './panel-feedback-checks.js';
import { videoFeedbackChecks } from './video-feedback-checks.js';
import { chromium, firefox } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { prototypeChecks } from './prototype-checks.js';
import { environmentChecks } from './environment-checks.js';
import { overnightChecks } from './overnight-checks.js';
import { feedbackChecks } from './feedback-checks.js';
import { voyageChecks } from './voyage-checks.js';
import { renderBrandArt } from './brand-art.js';
import { careerChecks } from './career-checks.js';
import { latestChecks } from './latest-checks.js';
mkdirSync('test-results', { recursive: true });
const browserType = process.env.URCHIN_TEST_BROWSER === 'firefox' ? firefox : chromium;
const launchOptions = {
  headless: true,
  ...(browserType === chromium
    ? {
        args: [
          '--no-sandbox',
          ...(process.env.URCHIN_HARDWARE === '1' ? ['--enable-gpu', '--use-angle=vulkan'] : []),
        ],
      }
    : {}),
};
let browser = await browserType.launch(launchOptions);
try {
  if (process.argv.includes('--diver-operations-only')) await diverOperationsChecks(browser);
  else if (process.argv.includes('--learning-interface-only'))
    await learningInterfaceChecks(browser);
  else if (process.argv.includes('--september25-only')) await september25Checks(browser);
  else if (process.argv.includes('--traffic-coasting-only')) await trafficCoastingChecks(browser);
  else if (process.argv.includes('--tablet-feedback-only')) await tabletFeedbackChecks(browser);
  else if (process.argv.includes('--crew-coasts-only')) await crewCoastsChecks(browser);
  else if (process.argv.includes('--working-day-only')) await workingDayChecks(browser);
  else if (process.argv.includes('--audio-baseline-only'))
    await audioSchedulingChecks(browser, true);
  else if (process.argv.includes('--audio-scheduling-only')) await audioSchedulingChecks(browser);
  else if (process.argv.includes('--september23-only')) await september23Checks(browser);
  else if (process.argv.includes('--september22-only')) await september22Checks(browser);
  else if (process.argv.includes('--september22-performance-only'))
    await september22Performance(browser);
  else if (process.argv.includes('--september21-only')) await september21Checks(browser);
  else if (process.argv.includes('--device-embed-only')) await deviceEmbedChecks(browser);
  else if (process.argv.includes('--device-feedback-only')) await deviceFeedbackChecks(browser);
  else if (process.argv.includes('--coastal-progression-only'))
    await coastalProgressionChecks(browser);
  else if (process.argv.includes('--debug-mode-only')) await debugModeChecks(browser);
  else if (process.argv.includes('--minimap-layout-only')) await minimapLayoutChecks(browser);
  else if (process.argv.includes('--chart-layout-only')) await chartLayoutChecks(browser);
  else if (process.argv.includes('--shore-hazards-only')) await shoreHazardChecks(browser);
  else if (process.argv.includes('--s22-latest-only')) await s22LatestChecks(browser);
  else if (process.argv.includes('--harbour-shops-only')) await harbourShopChecks(browser);
  else if (process.argv.includes('--hud-windows-only')) await hudWindowChecks(browser);
  else if (process.argv.includes('--frank-navigation-only')) await frankNavigationChecks(browser);
  else if (process.argv.includes('--s22-title-only')) await s22TitleChecks(browser);
  else if (process.argv.includes('--s22-feedback-only')) await s22FeedbackChecks(browser);
  else if (process.argv.includes('--keyboard-feedback-only')) await keyboardFeedbackChecks(browser);
  else if (process.argv.includes('--itch-feedback-only')) await itchFeedbackChecks(browser);
  else if (process.argv.includes('--september15-only')) await september15Checks(browser);
  else if (process.argv.includes('--touch-feedback-only')) await touchFeedbackChecks(browser);
  else if (process.argv.includes('--training-only')) await trainingChecks(browser);
  else if (process.argv.includes('--traffic-only')) await trafficChecks(browser);
  else if (process.argv.includes('--wildlife-only')) await wildlifeChecks(browser);
  else if (process.argv.includes('--vessels-only')) await vesselChecks(browser);
  else if (process.argv.includes('--v2-only')) await v2Checks(browser);
  else if (process.argv.includes('--performance-only')) await performanceChecks(browser);
  else if (process.argv.includes('--september13-only'))
    await september13Checks(browser, process.env.URCHIN_TEST_BROWSER || 'chromium');
  else if (process.argv.includes('--september12-only'))
    await september12Checks(browser, process.env.URCHIN_TEST_BROWSER || 'chromium');
  else if (process.argv.includes('--iteration-only'))
    await iterationChecks(browser, {
      name: process.env.URCHIN_TEST_BROWSER || 'chromium',
      production: process.env.URCHIN_PRODUCTION_TEST === '1',
    });
  else if (process.argv.includes('--art-only')) await renderBrandArt(browser);
  else if (process.argv.includes('--career-only')) {
    await renderBrandArt(browser);
    await careerChecks(browser);
    await browser.close();
    browser = await browserType.launch(launchOptions);
    await voyageChecks(browser);
  } else if (process.argv.includes('--feedback-only')) {
    await feedbackChecks(browser);
    await latestChecks(browser);
    await browser.close();
    browser = await browserType.launch(launchOptions);
    await videoFeedbackChecks(browser);
  } else if (process.argv.includes('--prototype-only')) await prototypeChecks(browser);
  else if (process.argv.includes('--overnight-only')) {
    await overnightChecks(browser);
    await panelFeedbackChecks(browser);
  } else if (process.argv.includes('--environment-only')) await environmentChecks(browser);
  else {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto((process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/') + '?practice=1');
    await page.locator('#keyboardFallback').click();
    await page.waitForFunction(() => window.urchinDebug?.world.time > 0.1);
    assert.equal(await page.locator('#enter').count(), 0);
    assert.match(await page.locator('#help').textContent(), /KEYBOARD.*1.*Deploy Diver/);
    assert.match(await page.locator('#hud').textContent(), /Speed [\d.]+ kn/);
    await page.keyboard.down('w');
    await page.waitForFunction(() => urchinDebug.world.boat.throttle > 0.1);
    await page.keyboard.up('w');
    const throttle = await page.evaluate(() => urchinDebug.world.boat.throttle);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), throttle);
    await page.keyboard.press('x');
    await page.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
    await page.keyboard.press('b');
    await page.locator('#playtest').waitFor({ state: 'visible' });
    await page.keyboard.press('b');
    await page.locator('#playtest').waitFor({ state: 'hidden' });
    await page.evaluate(() => urchinDebug.reset());
    await page.keyboard.press('F3');
    await page.locator('#testMap').waitFor({ state: 'visible' });
    for (const label of ['GOOD', 'POOR', 'EMPTY'])
      assert((await page.locator('#testInfo').textContent()).includes(label));
    await page.keyboard.down('-');
    await page.waitForFunction(() => urchinDebug.zoom <= 0.41);
    await page.keyboard.up('-');
    await page.screenshot({ path: 'test-results/coastal-test-reveal.png' });
    await page.keyboard.press('1');
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'searching');
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.bag), 0);
    assert(
      !/Take + give bag|Recover Diver|Deploy Diver/.test(await page.locator('#help').textContent()),
    );
    await page.evaluate(() => urchinDebug.step(6));
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.state), 'harvesting');
    await page.screenshot({ path: 'test-results/harvesting-reveal.png' });
    await page.evaluate(() => urchinDebug.step(30));
    assert.equal(await page.evaluate(() => Math.round(urchinDebug.world.diver.bag)), 300);
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'surface');
    // Reposition only for pickup fixture; the actual natural search/harvest/ascent ran above.
    await page.evaluate(() => {
      const w = urchinDebug.world,
        d = w.diver,
        c = w.environment.current;
      Object.assign(w.boat, {
        x: d.x - 4,
        y: d.y,
        heading: 0,
        vx: c.x,
        vy: c.y,
        throttle: 0,
        rudder: 0,
        turn: 0,
      });
    });
    await page.waitForFunction(() =>
      document.querySelector('#message').textContent.includes('PORT SIDE'),
    );
    assert(!/Take + give bag|Recover Diver/.test(await page.locator('#help').textContent()));
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.boat.x = w.diver.x + 4;
    });
    await page.waitForFunction(() =>
      document.querySelector('#help').textContent.includes('Take + give bag'),
    );
    assert.match(
      await page.locator('#help').textContent(),
      /2.*Take \+ give bag.*1 — Recover Diver/,
    );
    await page.screenshot({ path: 'test-results/port-pickup.png' });
    await page.keyboard.press('2');
    await page.waitForFunction(() => urchinDebug.world.diver.hook > 0.2);
    assert(await page.locator('#message progress').isVisible());
    await page.waitForFunction(() => urchinDebug.world.catch === 300);
    console.log('Keyboard: first full bag aboard');
    assert(
      ['deploying', 'searching', 'harvesting'].includes(
        await page.evaluate(() => urchinDebug.world.diver.state),
      ),
    );
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'harvesting');
    assert.equal(await page.evaluate(() => urchinDebug.visuals.bags.length), 1);
    assert.deepEqual(await page.evaluate(() => urchinDebug.visuals.diver), {
      bubbles: true,
      surface: false,
      aboard: false,
    });
    await page.evaluate(() => urchinDebug.step(45));
    assert.equal(await page.evaluate(() => urchinDebug.world.diver.state), 'surface');
    await page.evaluate(() => {
      const w = urchinDebug.world,
        d = w.diver,
        c = w.environment.current;
      Object.assign(w.boat, {
        x: d.x + 4,
        y: d.y,
        heading: 0,
        vx: c.x,
        vy: c.y,
        throttle: 0,
        rudder: 0,
        turn: 0,
      });
    });
    await page.keyboard.press('1');
    await page.waitForFunction(() => urchinDebug.world.diver.state === 'ready');
    assert.equal(await page.evaluate(() => urchinDebug.visuals.bags.length), 2);
    await page.keyboard.press('F3');
    await page.locator('#testMap').waitFor({ state: 'hidden' });
    await page.screenshot({ path: 'test-results/normal-deck-load.png' });
    await page.keyboard.press('F2');
    await page.locator('#playtest').waitFor({ state: 'visible' });
    await page.keyboard.press('F2');
    await page.locator('#playtest').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log(
      'PASS: Phaser 4.2.1 rendering, coastal reveal, keyboard mapping, knots, neutral, zoom, natural search/full bag/ascent, port gating, 2 bag turnaround, second dive, keyboard 1 combined pickup and visible deck bags.',
    );
    await prototypeChecks(browser);
    await environmentChecks(browser);
  }
} finally {
  await browser.close();
}
