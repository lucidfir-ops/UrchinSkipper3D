import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

// A strict subdirectory host catches root-relative URLs that a normal dev server hides.
export async function itchFeedbackChecks(browser) {
  const root = resolve('dist'),
    prefix = '/uploads/6789/',
    missing = [],
    errors = [],
    types = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
    if (path === '/play') {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        `<html><body style="margin:0"><iframe title="Game" allow="fullscreen; autoplay; gamepad" allowfullscreen src="http://localhost:${server.address().port}${prefix}index.html" style="border:0;width:100vw;height:100vh"></iframe></body></html>`,
      );
      return;
    }
    const file = resolve(root, path.slice(prefix.length));
    if (
      !path.startsWith(prefix) ||
      !file.startsWith(root + '/') ||
      !existsSync(file) ||
      !statSync(file).isFile()
    ) {
      missing.push(path);
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`,
    name = browser.browserType().name(),
    page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  mkdirSync('test-results', { recursive: true });
  page.on('pageerror', (error) => errors.push(error.message));
  const action = (id) => pressAction(page, 'itchPad', id),
    choose = (label, activate = true) => chooseController(page, action, label, activate),
    shot = (label) => page.screenshot({ path: `test-results/itch-${name}-${label}.png` });
  try {
    await page.addInitScript(gamepadScript, { name: 'itchPad', id: 'Itch Test Xbox' });
    await page.goto(origin + prefix + 'index.html');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await page.locator('#keyboardFallback').click();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
    await choose('Skip day 0');
    await page.waitForFunction(() => urchinDebug.ui.screen === 'starter');
    await choose('Choose Harbour Workhorse');
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 1024, height: 640 },
    ]) {
      await page.setViewportSize(viewport);
      await choose('Sail', false);
      await action('menuUp');
      assert.equal(await page.locator('.wharf-place.selected').getAttribute('data-action'), 'crew');
      await action('menuUp');
      assert.equal(
        await page.locator('.wharf-place.selected').getAttribute('data-action'),
        'conditions',
      );
      await action('menuDown');
      await action('menuRight');
      assert.equal(
        await page.locator('.wharf-place.selected').getAttribute('data-action'),
        'fleet',
      );
      await shot(`harbour-${viewport.width}`);
    }
    await choose('Weather & tides');
    assert.equal(await page.locator('.week-forecast tbody tr').count(), 7);
    await page.locator('.week-forecast').scrollIntoViewIfNeeded();
    await shot('forecast');
    await action('back');
    await choose('Settings');
    assert.equal(await page.locator('#timeSpeed').inputValue(), '25');
    await choose('Time speed +5%');
    assert.equal(await page.locator('#timeSpeed').inputValue(), '30');
    await page.locator('#timeSpeed').evaluate((e) => {
      e.value = '100';
      e.dispatchEvent(new Event('input'));
      e.dispatchEvent(new Event('change'));
    });
    await page.waitForFunction(() => localStorage.getItem('urchin-time-speed-v1') === '100');
    await shot('settings');
    await page.locator('#timeSpeed').evaluate((e) => {
      e.value = '25';
      e.dispatchEvent(new Event('change'));
    });
    await action('back');
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.cash = 1e6;
      w.career.xp = 12000;
    });
    await choose('Your boats');
    await choose('Boats for sale');
    await choose('Reef Runner II', false);
    await page.waitForFunction(
      () => document.querySelector('.career-detail h3')?.textContent === 'Reef Runner II',
    );
    const cash = await page.evaluate(() => urchinDebug.world.career.cash);
    await action('confirm');
    await page.locator('[data-action=cancel-buy]').waitFor();
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), cash);
    await shot('purchase');
    await choose('Cancel');
    await choose('Channel Master ·');
    await choose('Buy Channel Master');
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.configuration), 'twinjet');
    await action('back');
    await action('back');
    await choose('Sail');
    await choose('Sheltered Kelp');
    await choose('Begin working day');
    await page.locator('#voyage').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      const ui = urchinDebug.ui,
        w = urchinDebug.world;
      w.career.trafficSettings = { rate: 0 };
      w.traffic.actors = [];
      w.day.inspection = null;
      w.terrain.depths.fill(15);
      w.logs = [];
      Object.assign(w.boat, {
        x: 250,
        y: 250,
        heading: Math.PI / 2,
        vx: 0,
        vy: 0,
        throttle: 0,
        rudder: 0,
      });
      ui.touch.setEnabled(true);
      ui.open(null);
    });
    const patrolId = await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.trafficSettings.inspectionMinutes = 1;
      return urchinDebug.spawnTraffic('dfo', { start: { x: 380, y: 250 } }).id;
    });
    await page.waitForFunction(
      () => urchinDebug.ui.screen === 'patrol' && !urchinDebug.input.suppressed,
    );
    await choose('Divers up, come over');
    await page.waitForFunction(() => urchinDebug.world.day.inspection.status === 'boarding');
    await shot('dfo-alongside');
    await page.waitForFunction(() => urchinDebug.world.day.inspection.status === 'departing');
    await page.locator('#dfoTransition').waitFor({ state: 'visible' });
    await shot('dfo-casting-off');
    await page.waitForFunction(() => urchinDebug.world.day.inspection.status === 'cleared');
    await page.waitForTimeout(1800);
    assert(
      await page.evaluate((id) => {
        const w = urchinDebug.world,
          actor = w.traffic.actors.find((a) => a.id === id);
        return (
          !actor ||
          (actor.phase === 'leaving' && Math.hypot(actor.x - w.boat.x, actor.y - w.boat.y) > 30)
        );
      }, patrolId),
    );
    await shot('dfo-away');
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.boat.heading = Math.PI / 2;
      w.boat.turn = 0;
    });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('#touchBoat').waitFor();
    assert(
      await page.evaluate(() => {
        const a = document.querySelector('#touchMenu').getBoundingClientRect(),
          b = document.querySelector('#touchFullscreen').getBoundingClientRect();
        return (
          a.bottom <= b.top &&
          document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2)?.id === 'touchMenu'
        );
      }),
      'Menu and Fullscreen have separate reachable touch targets',
    );
    await page.waitForTimeout(200);
    // Drag from the visible boat's centre to its bow (east) with a real pointer.
    await page.mouse.move(422, 195);
    await page.mouse.down();
    await page.mouse.move(492, 195);
    await page.waitForFunction(() => urchinDebug.world.boat.throttle > 0.2);
    await page.mouse.up();
    const throttle = await page.evaluate(() => urchinDebug.world.boat.throttle);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.throttle), throttle);
    await page.evaluate(() => {
      urchinDebug.world.boat.rudder = 0.7;
    });
    await page.touchscreen.tap(422, 195);
    await page.waitForFunction(
      () => urchinDebug.world.boat.throttle === 0 && urchinDebug.world.boat.rudder === 0,
    );
    await shot('touch-helm');
    await page.mouse.move(422, 195);
    await page.mouse.down();
    await page.mouse.move(422, 265);
    await page.waitForFunction(() => Math.abs(urchinDebug.world.boat.rudder) > 0.1);
    await page.evaluate(() => urchinDebug.ui.open('pause'));
    await page.mouse.up();
    assert.equal(await page.evaluate(() => urchinDebug.input.touchSources.size), 0);
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.boat.throttle = w.boat.rudder = 0;
      w.boat.heading = 0;
      w.day.minute = 1200;
      w.career.fleet[w.boat.configuration].equipment.push('lights');
      urchinDebug.ui.open(null);
    });
    await page.waitForFunction(() => urchinDebug.world.weather.night);
    await page.waitForTimeout(250);
    await shot('night-cone');
    const cone = await page.locator('#weatherVeil').evaluate((canvas) => {
      const ctx = canvas.getContext('2d'),
        x = canvas.width / 2,
        y = canvas.height / 2;
      return {
        ahead: ctx.getImageData(x, y - 80, 1, 1).data[3],
        astern: ctx.getImageData(x, y + 80, 1, 1).data[3],
      };
    });
    assert(cone.ahead < cone.astern - 10, JSON.stringify(cone));
    await page.locator('#touchFullscreen').tap();
    await page.waitForFunction(
      () => document.fullscreenElement || !document.querySelector('#fullscreenNotice').hidden,
    );
    assert(await page.evaluate(() => !!document.fullscreenElement), 'native fullscreen works');
    await page.locator('#touchFullscreen').tap();
    await page.waitForFunction(() => !document.fullscreenElement);
    // Separate-origin iframe: same shape as an itch page embedding CDN assets.
    await page.goto(origin + '/play');
    const frame = page.frameLocator('iframe');
    await frame.locator('[data-touch-options]').tap();
    await frame.locator('[data-action="touchscreen"]').tap();
    await frame.locator('.screen-back').tap();
    await frame.locator('#touchFullscreen').tap();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await shot('embedded-fullscreen');
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, [], 'all assets stay under the upload subdirectory');
    console.log(
      `${name}: nested static host, controller harbour, forecast, speed, exact purchase, boat drag/tap, night cone and embedded fullscreen passed`,
    );
  } catch (error) {
    await shot('failure');
    console.error({ missing, errors });
    throw error;
  } finally {
    await page.close();
    await new Promise((done) => server.close(done));
  }
}
