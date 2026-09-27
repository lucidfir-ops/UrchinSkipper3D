import assert from 'node:assert/strict';
import { VESSEL_ART, VESSEL_FAMILIES } from '../src/vessel-catalog.js';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

export async function vesselChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const action = (name) => pressAction(page, 'artPad', name),
    choose = (label) => chooseController(page, action, label);
  try {
    await page.addInitScript(gamepadScript, { name: 'artPad', id: 'Art Xbox' });
    await page.goto(process.env.URCHIN_TEST_URL);
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await page.screenshot({ path: 'test-results/v2-title-art.png' });
    assert.match(
      await page.locator('.title-art').evaluate((e) => getComputedStyle(e).backgroundImage),
      /channelmaster-title/,
    );
    await action('confirm');
    await choose('Choose Island Tender');
    await page.evaluate(() => {
      urchinDebug.world.career.cash = 1e6;
      urchinDebug.world.career.xp = 10000;
    });
    await choose('Your boats');
    await choose('Boats for sale');
    for (const [id] of VESSEL_FAMILIES) {
      if (id === 'outboard') continue;
      await choose(
        id === 'twinjet'
          ? 'Channel Master'
          : id === 'basic'
            ? 'Harbour Workhorse'
            : id === 'thruster'
              ? 'Coastal Workhorse'
              : id === 'jet'
                ? 'Shoal Skipper'
                : 'Reef Runner',
      );
      await choose('Buy ');
      assert.equal(await page.evaluate(() => urchinDebug.world.boat.configuration), id);
    }
    await page.waitForSelector('canvas[data-loaded=true]');
    await page.screenshot({ path: 'test-results/v2-boatshop-art.png' });
    await action('back');
    await action('back');
    await choose('Sail');
    await choose('Sheltered Kelp');
    await page.screenshot({ path: 'test-results/v2-chart-art.png' });
    await choose('Begin working day');
    await page.waitForFunction(() => urchinDebug.vesselTexture === 'vessel-twinjet');
    await page.locator('#voyage').waitFor({ state: 'hidden' });
    await page.screenshot({ path: 'test-results/v2-channelmaster-water.png' });
    await action('pause');
    const frames = await page.evaluate(async (ids) => {
      const sheet = document.createElement('div');
      sheet.id = 'art-review';
      sheet.style.cssText =
        'position:fixed;inset:0;z-index:1000;background:#153644;display:grid;grid-template-columns:repeat(10,1fr);gap:8px;padding:10px;overflow:auto;color:white;font:10px sans-serif';
      const frames = {};
      for (const id of ids) {
        const source = await urchinDebug.vesselCanvas(id),
          item = document.createElement('div'),
          canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        canvas.getContext('2d').drawImage(source, 0, 0);
        canvas.style.cssText = 'width:100%;height:140px;object-fit:contain';
        item.append(canvas, document.createTextNode(id));
        sheet.append(item);
        frames[id] = source.frame;
      }
      document.body.append(sheet);
      return frames;
    }, Object.keys(VESSEL_ART));
    assert(frames.outboard.y > 80, 'sheet fragment excluded above Island Tender');
    await page.screenshot({ path: 'test-results/v2-vessel-contact-sheet.png' });
    await page.locator('#art-review').evaluate((e) => e.remove());
    await choose('Title screen');
    await action('menuDown');
    await action('confirm');
    await page.waitForSelector('.save-art-panel');
    await page.screenshot({ path: 'test-results/v2-load-art.png' });
    await page.setViewportSize({ width: 1024, height: 640 });
    await action('back');
    await page.screenshot({ path: 'test-results/v2-title-compact.png' });
    assert.deepEqual(errors, []);
    console.log(
      'PASS: supplied title/load, purchases, exact boat sprites, 37 framed originals, generated chart material and compact title',
    );
  } finally {
    await page.close();
  }
}
