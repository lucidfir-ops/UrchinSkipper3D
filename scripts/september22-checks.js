import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import '../tests/matter-helper.js';
import { careerWorld, decode, encode } from '../src/career-save.js';
import { createCareer } from '../src/career-state.js';
import { chooseGround } from '../src/day.js';
import { enterSector, SECTORS } from '../src/sectors.js';
import { summarizeFrames } from '../src/frame-metrics.js';

function careerFixture() {
  const file = [
    'feedback/9-21/urchin-career-day-17-1790034858921.json',
    'feedback/archive of feedback/9-21/urchin-career-day-17-1790034858921.json',
  ].find(existsSync);
  const w = file ? decode(readFileSync(file, 'utf8')) : careerWorld(createCareer(922));
  console.log('September 22 fixture:', file || 'synthetic career; private day-17 save unavailable');
  w.day.minute = 600;
  w.career.day = 19;
  w.career.preferences ||= {};
  w.career.preferences.timepiece = 'digital';
  for (const key of ['timepiece', 'loadGauge', 'exactLoad', 'minimap'])
    w.career.assists[key] = true;
  assert(chooseGround(w, 'near').ok);
  return encode(w);
}
export async function september22Checks(browser) {
  const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/';
  const html = await fetch(base),
    pageText = await html.text();
  const script = new URL(
    pageText.match(/src="([^"]+\/assets\/index-[^"]+\.js)"/)?.[1] ||
      pageText.match(/src="(\.\/assets\/index-[^"]+\.js)"/)[1],
    base,
  );
  const plain = await fetch(script, { headers: { 'Accept-Encoding': 'identity' } }),
    plainText = await plain.text();
  const packed = await fetch(script, { headers: { 'Accept-Encoding': 'br, gzip' } });
  assert.equal(packed.headers.get('content-encoding'), 'br');
  assert(
    Number(packed.headers.get('content-length')) < Number(plain.headers.get('content-length')) / 2,
  );
  assert.equal(await packed.text(), plainText, 'Compressed delivery restores identical game bytes');
  const unchanged = await fetch(script, {
    headers: { 'If-None-Match': packed.headers.get('etag') },
  });
  assert.equal(unchanged.status, 304);
  const results = [],
    name = process.env.URCHIN_TEST_BROWSER || 'chromium',
    career = careerFixture();
  const farWorld = decode(career),
    farSector = SECTORS.at(-1).id;
  enterSector(farWorld, farSector);
  farWorld.day.groundId = farSector;
  const farCareer = encode(farWorld);
  assert.equal(decode(farCareer).day.groundId, farSector);
  for (const [device, width, height] of [
    ['phone', 873, 402],
    ['tablet', 1224, 816],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    const errors = [],
      requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => requests.push(request.url()));
    page.setDefaultTimeout(20000);
    try {
      await page.addInitScript((data) => {
        localStorage.setItem('urchin-career-v1', data);
        localStorage.setItem('urchin-touchscreen-v1', 'on');
      }, career);
      await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
      await page.waitForFunction(() => window.urchinDebug?.ready);
      await page.locator('#keyboardFallback').click();
      await page.evaluate(() => {
        urchinDebug.ui.started = true;
        urchinDebug.ui.open(null);
      });
      await page.waitForFunction(() => urchinDebug.ready && urchinDebug.world.time > 1);
      await page.locator('#voyage').waitFor({ state: 'hidden' });
      assert(
        !requests.some((url) => /\/fleet(?:-vector)?\//.test(url)),
        'No original full-resolution boat loads',
      );
      for (let i = 0; i < 6; i++) {
        await page.locator('[data-touch="chart"]').tap();
        await page.waitForFunction(() => urchinDebug.ui.screen === 'knowledge');
        await page.waitForTimeout(120);
        assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'knowledge');
        await page.evaluate(() => urchinDebug.ui.open(null));
      }
      await page.locator('#touchLockToggle').tap();
      await page.evaluate(() => {
        urchinDebug.world.day.minute = 1440 + 61;
      });
      for (const [orientation, w, h] of [
        ['portrait', height, width],
        ['landscape', width, height],
        ['portrait-again', height, width],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(300);
        const geometry = await page.evaluate(() => {
          const rect = (e) => {
            const r = e.getBoundingClientRect();
            return {
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            };
          };
          const clock = document.querySelector('.digital-clock'),
            output = clock.querySelector('output');
          const range = document.createRange();
          range.selectNodeContents(output);
          const chart = document.querySelector('#minimapPanel'),
            css = getComputedStyle(chart);
          return {
            panels: ['timepiecePanel', 'loadPanel', 'minimapPanel'].map((id) => ({
              id,
              ...rect(document.getElementById(id)),
            })),
            clock: rect(clock),
            digits: rect(range),
            chart: {
              background: css.backgroundColor,
              border: css.borderTopWidth,
              shadow: css.boxShadow,
              labels: [...chart.querySelectorAll('.minimap-heading,.minimap-text,small')].some(
                (e) => e.getClientRects().length > 0,
              ),
            },
          };
        });
        for (const r of geometry.panels)
          assert(
            r.width >= 32 &&
              r.height >= 20 &&
              r.left >= -1 &&
              r.top >= -1 &&
              r.right <= w + 1 &&
              r.bottom <= h + 1,
            JSON.stringify(r),
          );
        const { clock, digits, chart } = geometry;
        assert(
          digits.left >= clock.left + clock.width * 0.09 &&
            digits.right <= clock.right - clock.width * 0.09 &&
            digits.top >= clock.top + clock.height * 0.24 &&
            digits.bottom <= clock.top + clock.height * 0.71,
          JSON.stringify({ clock, digits }),
        );
        assert.equal(chart.background, 'rgba(0, 0, 0, 0)');
        assert.equal(chart.border, '0px');
        assert.equal(chart.shadow, 'none');
        assert(!chart.labels);
        await page.screenshot({ path: `test-results/sep22-${name}-${device}-${orientation}.png` });
      }
      await page.evaluate(() => urchinDebug.ui.open('layout'));
      await page.locator('[data-action="layout-timepiecePanel"]').click();
      await page.locator('[data-action="layout-move"]').click();
      await page.locator('[data-layout-adjust="down"]').click();
      const portrait = await page.evaluate(() => ({
        layout: urchinDebug.ui.layoutEditor.layout,
        rect: { ...urchinDebug.ui.layoutEditor.rows.find((r) => r.id === 'timepiecePanel').rect },
      }));
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      await page.locator('[data-layout-adjust="right"]').click();
      await page.locator('[data-layout-adjust="finish"]').click();
      await page.locator('[data-action="layout-save"]').click();
      const saved = await page.evaluate(
        () => JSON.parse(localStorage.getItem('urchin-hud-layout-v1')).timepiecePanel,
      );
      assert.equal(
        saved[portrait.layout].top,
        portrait.rect.top,
        'Portrait draft survives rotation and Save',
      );
      assert(Object.keys(saved).length >= 2, 'Both orientation layouts saved');
      await page.evaluate(() => {
        urchinDebug.ui.open(null);
        urchinDebug.world.boat.throttle = -1;
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `test-results/sep22-${name}-${device}-reverse.png` });
      // All vessel canvases are ready: switching artwork needs no connection.
      await page.context().setOffline(true);
      assert(
        await page.evaluate(
          async () => (await urchinDebug.vesselCanvas('taxi-5', 'raster')).width > 0,
        ),
      );
      await page.evaluate((data) => {
        const result = urchinDebug.ui.hooks.changeCareer(null, data);
        if (!result.ok) throw Error(result.reason);
        urchinDebug.ui.open(null);
      }, farCareer);
      await page.waitForFunction(
        (id) =>
          urchinDebug.ready &&
          urchinDebug.world.day.groundId === id &&
          urchinDebug.terrainView.prepared,
        farSector,
      );
      await page.context().setOffline(false);
      assert.deepEqual(errors, []);
      results.push({
        device,
        errors,
        orientations: 3,
        chartTaps: 6,
        offlineArtwork: true,
        offlineSector: farSector,
      });
    } catch (error) {
      await page.screenshot({ path: `test-results/sep22-${name}-${device}-failure.png` });
      console.error(errors);
      throw error;
    } finally {
      await page.close();
    }
  }
  const recovery = await browser.newPage({ viewport: { width: 873, height: 402 } });
  const recoveryErrors = [];
  recovery.on('pageerror', (error) => recoveryErrors.push(error.message));
  try {
    await recovery.route('**/fleet-runtime/sep22/raster-basic.png', (route) => route.abort(), {
      times: 1,
    });
    await recovery.route('**/*terrain-painter.worker-*.js', (route) => route.abort());
    await recovery.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await recovery.getByRole('button', { name: 'Retry preparation' }).waitFor({ state: 'visible' });
    const time = await recovery.evaluate(() => urchinDebug.world.time);
    await recovery.waitForTimeout(250);
    assert.equal(
      await recovery.evaluate(() => urchinDebug.world.time),
      time,
      'Failed preparation keeps simulation stopped',
    );
    await recovery.getByRole('button', { name: 'Retry preparation' }).click();
    await recovery.waitForFunction(() => urchinDebug.ready);
    assert(
      await recovery.evaluate(
        () => !urchinDebug.terrainView.painter.worker && urchinDebug.terrainView.prepared,
      ),
      'Blocked worker uses complete yielded fallback',
    );
    assert.deepEqual(recoveryErrors, []);
    results.push({ retry: true, blockedWorkerFallback: true, errors: recoveryErrors });
  } finally {
    await recovery.close();
  }
  writeFileSync(`test-results/sep22-${name}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
}

export async function september22Performance(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.addInitScript(
      (career) => localStorage.setItem('urchin-career-v1', career),
      careerFixture(),
    );
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.waitForFunction(() => window.urchinDebug?.ready);
    await page.locator('#keyboardFallback').click();
    await page.evaluate(() => {
      urchinDebug.ui.started = true;
      urchinDebug.ui.open(null);
    });
    await page.waitForFunction(() => urchinDebug.world.time > 2);
    await page.evaluate(() => {
      window.measuredFrames = [];
      window.tideUploads = [];
      window.saveCommits = [];
      const samples = urchinDebug.renderSamples,
        push = samples.push;
      samples.push = function (...items) {
        window.measuredFrames.push(...items);
        return push.apply(this, items);
      };
      const texture = urchinDebug.terrainView.texture.context,
        refresh = texture.putImageData;
      texture.putImageData = function (...args) {
        window.tideUploads.push(performance.now());
        return refresh.apply(this, args);
      };
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        const start = performance.now();
        const result = set.call(this, key, value);
        if (key === 'urchin-career-v1')
          window.saveCommits.push({ ms: performance.now() - start, bytes: value.length });
        return result;
      };
    });
    await page.waitForTimeout(22000);
    const measured = await page.evaluate(() => ({
      samples: window.measuredFrames,
      tideUploads: window.tideUploads,
      saveCommits: window.saveCommits,
      actors: urchinDebug.world.traffic.actors.length,
    }));
    assert(measured.tideUploads.length > 0, 'Must include a live tide texture update');
    assert(measured.saveCommits.length >= 2, 'Must include two real mature-career autosaves');
    assert.deepEqual(errors, []);
    const report = {
      summary: summarizeFrames(measured.samples),
      tideUpdates: measured.tideUploads.length,
      saveCommits: measured.saveCommits,
      actors: measured.actors,
      errors,
    };
    writeFileSync(
      `test-results/sep22-performance-${process.env.URCHIN_TEST_BROWSER || 'chromium'}.json`,
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
    await page.screenshot({ path: 'test-results/sep22-mature-performance.png' });
  } finally {
    await page.close();
  }
}
