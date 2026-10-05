// Captures the main menus and the working HUD on the designer's three test
// devices for visual review. Usage (against a production build):
//   URCHIN_TEST_URL=http://127.0.0.1:5190/ URCHIN_GALLERY_OUTPUT=test-results/ui-gallery \
//     PLAYWRIGHT_BROWSERS_PATH=.browser-cache node scripts/ui-gallery.js [deviceId,...]
// The screenshots require human/agent visual inspection; this script only
// checks that every screen opens without page errors.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chooseStarter } from './career-start.js';
import { DEVICES } from './ui-gallery-devices.js';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/',
  output = process.env.URCHIN_GALLERY_OUTPUT || 'test-results/ui-gallery';
export { DEVICES };
const only = process.argv[2]?.split(',');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const report = [];
try {
  for (const device of DEVICES.filter((d) => !only || only.includes(d.id))) {
    const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: device.scale,
        hasTouch: device.touch,
        // isMobile lets Chromium widen the layout viewport to 480 px (shrink to
        // fit), unlike the designer's Firefox for Android. Keep CSS pixels exact.
        isMobile: false,
      }),
      page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (device.touch)
      await page.addInitScript(() => localStorage.setItem('urchin-touchscreen-v1', 'on'));
    await page.goto(base);
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 120000 });
    const shot = async (name) => {
      await page.waitForTimeout(450);
      const path = `${output}/${device.id}-${name}.png`;
      await page.screenshot({ path });
      report.push({ device: device.id, name, path });
    };
    await shot('title');
    const tap = (selector) =>
      device.touch ? page.locator(selector).tap() : page.locator(selector).click();
    await tap('[data-title-action="new"]');
    await page.waitForFunction(() =>
      ['intro', 'starter', 'harbour'].includes(urchinDebug.ui.screen),
    );
    await shot('new-career');
    await chooseStarter(page, async (label) => {
      await page.getByRole('button', { name: label }).first().click();
    });
    await shot('harbour');
    const screens = process.env.URCHIN_GALLERY_SCREENS?.split(',') || [
      'settings',
      'archives',
      'pause',
      'logbook',
    ];
    for (const screen of screens) {
      await page.evaluate((s) => urchinDebug.ui.open(s), screen);
      await shot(screen);
    }
    // Working day at sea with both divers aboard: the plain helm HUD.
    await page.evaluate(() => {
      const ui = urchinDebug.ui,
        w = urchinDebug.world;
      ui.open(null);
      w.day.phase = 'working';
      w.day.minute = 600;
      w.boat.throttle = 0.35;
      w.boat.rudder = -0.2;
    });
    await page.evaluate(() => {
      const ui = urchinDebug.ui;
      ui.history = [];
      ui.open(null);
    });
    await shot('helm');
    // A surfaced diver waiting at the port rail: recovery speech and crew state.
    await page.evaluate(() => {
      const w = urchinDebug.world,
        side = -(urchinDebug.simulation.boatSpec(w).width / 2 + 1.2);
      w.boat.throttle = 0;
      w.boat.rudder = 0;
      Object.assign(w.divers[0], {
        state: 'surface',
        condition: 'fit',
        depth: 0,
        bag: 180,
        qualitySum: 140,
        x: w.boat.x + side * Math.cos(w.boat.heading),
        y: w.boat.y + side * Math.sin(w.boat.heading),
        heading: w.boat.heading,
        hook: 0,
        hooking: false,
        recoveryAction: null,
        recoveryPause: '',
        bagHandled: false,
        transit: null,
        reason: 'Bag full',
        air: 46,
        speech: null,
      });
      w.selectedDiverId = w.divers[0].id;
    });
    await shot('helm-surface');
    // Frank's tutorial card over the same working view.
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.intro = { status: 'active', step: 8, scoutSeconds: 0 };
      w.day.phase = 'practice';
    });
    await shot('helm-frank');
    if (!device.touch) {
      // Keyboard players with Controls Help on: the on-screen helm keys.
      await page.evaluate(() => {
        const w = urchinDebug.world;
        w.career.intro = { status: 'complete' };
        w.day.phase = 'working';
        w.career.assists.controlsHelp = true;
        w.career.assists.manual = { ...w.career.assists.manual, controlsHelp: true };
      });
      await shot('helm-keys');
    }
    report.push({ device: device.id, errors });
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${output}/gallery.json`, JSON.stringify(report, null, 2));
}
console.log(
  JSON.stringify(
    report.filter((r) => r.errors?.length),
    null,
    2,
  ),
);
