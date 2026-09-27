import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';

export async function deviceEmbedChecks(browser) {
  const name = browser.browserType().name(),
    root = resolve('dist'),
    prefix = '/uploads/device-update/',
    errors = [],
    missing = [],
    viewportChecks = [];
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
    if (path === '/play') {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        `<html><body style="margin:0"><iframe allow="fullscreen;autoplay;gamepad" allowfullscreen src="http://localhost:${server.address().port}${prefix}index.html" style="border:0;width:100vw;height:100vh"></iframe></body></html>`,
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
    res.setHeader(
      'Content-Type',
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      }[extname(file)] || 'application/octet-stream',
    );
    res.end(readFileSync(file));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/play`);
    let frame = await page
      .locator('iframe')
      .elementHandle()
      .then((el) => el.contentFrame());
    await frame.waitForFunction(() => window.urchinDebug?.ui);
    await frame.locator('[data-fullscreen]').click();
    await frame.waitForFunction(() => !!document.fullscreenElement);
    await frame.locator('[data-logging]').click();
    await frame.locator('#keyboardFallback').click();
    await frame.getByRole('button', { name: 'Skip day 0 · choose my boat', exact: true }).click();
    await frame.getByRole('button', { name: /Choose Harbour Workhorse/ }).click();
    await frame.locator('[data-action="buy-selected"]').click();
    await frame.locator('[data-action="confirm-purchase"]').click();
    for (let n = 0; n < 4; n++) {
      await frame.locator('[data-action="workshop"]').click();
      await frame
        .getByRole('button', { name: 'Channel Master · controls showcase', exact: true })
        .click();
      await frame.waitForFunction(
        () => urchinDebug.world.career.trainingReplay && !urchinDebug.ui.screen,
      );
      assert.match(await frame.locator('#frankAboard').innerText(), /Channel Master/);
      assert(!/\{(?:pivot|thrust)/.test(await frame.locator('#frankAboard').innerText()));
      await frame.locator('[data-intro="skip"]').click();
      await frame.waitForFunction(() => urchinDebug.ui.screen === 'harbour');
    }
    await frame.evaluate(() => urchinDebug.ui.showTitle());
    await frame.locator('[data-fullscreen]').click();
    await frame.waitForFunction(() => !document.fullscreenElement);
    await page.reload();
    frame = await page
      .locator('iframe')
      .elementHandle()
      .then((el) => el.contentFrame());
    await frame.waitForFunction(() => window.urchinDebug?.ui);
    assert.match(await frame.locator('[data-logging]').innerText(), /ON/);
    // Model a mobile host whose default is landscape and whose child needs
    // its own fullscreen permission. Keep actual fullscreen and trusted touch.
    await frame.evaluate(() => {
      window.rotationCheck = { mode: 'landscape', requests: [], unlocks: 0 };
      screen.orientation.lock = async (mode) => {
        window.rotationCheck.requests.push({ mode, owned: !!document.fullscreenElement });
        if (!document.fullscreenElement)
          throw new DOMException('Child fullscreen required', 'SecurityError');
        window.rotationCheck.mode = mode;
      };
      screen.orientation.unlock = () => {
        window.rotationCheck.unlocks++;
        window.rotationCheck.mode = 'landscape';
      };
      dispatchEvent(new Event('focus'));
    });
    await frame.locator('[data-touch-options]').tap();
    assert.equal(await frame.evaluate(() => !!document.fullscreenElement), false);
    await frame.locator('.screen-back').tap();
    await page.evaluate(() => {
      const launch = document.createElement('button');
      launch.id = 'host-launch';
      launch.textContent = 'Launch embedded game';
      launch.style.cssText = 'position:fixed;top:0;left:0;z-index:99999';
      launch.onclick = () => document.querySelector('iframe').requestFullscreen();
      document.body.append(launch);
    });
    await page.locator('#host-launch').click();
    await page.waitForFunction(() => document.fullscreenElement?.tagName === 'IFRAME');
    // A mouse interaction does not adopt the host's fullscreen.
    await frame.locator('[data-touch-options]').click();
    assert.equal(await frame.evaluate(() => !!document.fullscreenElement), false);
    await frame.locator('.screen-back').click();
    await frame.locator('[data-touch-options]').tap();
    await frame.waitForFunction(
      () => !!document.fullscreenElement && window.rotationCheck.mode === 'any',
    );
    const unlocks = await frame.evaluate(() => window.rotationCheck.unlocks);
    await frame.evaluate(() => {
      for (let n = 0; n < 5; n++) {
        dispatchEvent(new Event('orientationchange'));
        dispatchEvent(new Event('resize'));
      }
    });
    await frame.waitForTimeout(350);
    assert.equal(await frame.evaluate(() => window.rotationCheck.mode), 'any');
    assert.equal(await frame.evaluate(() => window.rotationCheck.unlocks), unlocks);
    await frame.locator('.screen-back').click();
    // A deliberate exit must not immediately re-enter on the next touch.
    await frame.locator('[data-fullscreen]').tap();
    await frame.waitForFunction(() => !document.fullscreenElement);
    await frame.locator('[data-touch-options]').tap();
    assert.equal(await frame.evaluate(() => !!document.fullscreenElement), false);
    await frame.locator('.screen-back').tap();
    await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
    for (const viewport of [
      { width: 402, height: 873 },
      { width: 873, height: 402 },
    ]) {
      await page.setViewportSize(viewport);
      await frame.waitForFunction(
        ({ width, height }) => innerWidth === width && innerHeight === height,
        viewport,
      );
      // Resize outside native fullscreen. Headless Firefox uses its fixed
      // 1366x768 display in fullscreen even after setViewportSize; require the
      // child to fill the real host, and verify each phone layout after exit.
      await page.locator('#host-launch').click();
      await page.waitForFunction(() => document.fullscreenElement?.tagName === 'IFRAME');
      const hostSize = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      if (name === 'chromium') assert.deepEqual(hostSize, viewport);
      await frame.waitForFunction(
        ({ width, height }) => innerWidth === width && innerHeight === height,
        hostSize,
      );
      await frame.locator('[data-touch-options]').tap();
      await frame.waitForFunction(
        () => !!document.fullscreenElement && window.rotationCheck.mode === 'any',
      );
      await frame.locator('.screen-back').waitFor({ state: 'visible', timeout: 5000 });
      viewportChecks.push({ requested: viewport, fullscreen: hostSize, orientation: 'any' });
      await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
      await frame.waitForFunction(
        ({ width, height }) => innerWidth === width && innerHeight === height,
        viewport,
      );
      await page.screenshot({ path: `test-results/rotation-${name}-${viewport.width}.png` });
      await frame.locator('.screen-back').tap();
    }
    await page.locator('#host-launch').evaluate((el) => el.remove());
    await frame.waitForTimeout(300);
    const downloadPromise = page.waitForEvent('download');
    await frame.getByRole('button', { name: 'Download troubleshooting log', exact: true }).click();
    const download = await downloadPromise;
    await download.saveAs('test-results/september20-troubleshooting-download.txt');
    assert.match(
      readFileSync('test-results/september20-troubleshooting-download.txt', 'utf8'),
      /launch: Page loaded/,
    );
    assert.match(
      readFileSync('test-results/september20-troubleshooting-download.txt', 'utf8'),
      /viewport:/,
    );
    await page.screenshot({ path: 'test-results/sep20-embedded-title.png' });
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    writeFileSync(
      `test-results/device-embed-${name}.json`,
      JSON.stringify(
        {
          errors,
          missing,
          trainingReloads: 4,
          fullscreen: true,
          viewportChecks,
          automaticTouchRecovery: true,
          inlineAndMouseUnchanged: true,
          deliberateExitRespected: true,
          orientation: await frame.evaluate(() => window.rotationCheck),
          logDownload: true,
        },
        null,
        2,
      ),
    );
    if (name === 'chromium')
      copyFileSync(`test-results/device-embed-${name}.json`, 'test-results/sep20-embed.json');
    console.log(
      `PASS ${name}: cross-origin hosting, automatic touch rotation recovery, intentional fullscreen exit, four Channel Master replays and persisted log download.`,
    );
  } catch (error) {
    const frame = page.frames().find((f) => f.url().includes(prefix));
    const state = await frame?.evaluate(() => ({
      screen: window.urchinDebug?.ui.screen,
      size: [innerWidth, innerHeight],
      fullscreen: !!document.fullscreenElement,
      orientation: window.rotationCheck,
    }));
    console.log('Embed failure state', JSON.stringify(state));
    writeFileSync(
      `test-results/device-embed-${name}-failure.json`,
      JSON.stringify(state ?? { url: page.url() }, null, 2),
    );
    await page.screenshot({ path: `test-results/device-embed-${name}-failure.png` });
    throw error;
  } finally {
    await page.close();
    server.close();
    server.closeAllConnections();
  }
}
