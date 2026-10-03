import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { gamepadScript, pressAction } from './gamepad-fixture.js';

const output = process.env.URCHIN_SHOAL_OUTPUT || 'test-results/shoal-recovery-2026-10-03',
  base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/',
  startedAt = new Date().toISOString(),
  errors = [],
  records = [];
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
let passed = false,
  failure = null;
try {
  for (const [name, width, height] of [
    ['keyboard', 1280, 800],
    ['controller', 1280, 800],
    ['touch', 844, 390],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: name === 'touch',
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    if (name === 'controller')
      await page.addInitScript(gamepadScript, {
        name: 'shoalPad',
        id: 'Shoal Recovery Synthetic Xbox',
      });
    const response = await page.goto(base);
    if (process.env.URCHIN_PRODUCTION_TEST === '1') {
      assert.equal(response.headers()['x-urchin-build'], 'production');
      assert.equal(response.headers()['x-urchin-edition'], 'three');
    }
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    if (name === 'touch') {
      await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
      await page.getByRole('switch', { name: 'Touchscreen mode: OFF', exact: true }).tap();
      await page.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
    }
    const inputMethod = name === 'touch' ? 'tap' : 'click';
    await page.locator('#keyboardFallback')[inputMethod]();
    const begin = page.getByRole('button', {
      name: 'Come aboard · learn with Frank',
      exact: true,
    });
    await begin[inputMethod]();
    await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.input.suppressed);
    const initial = await page.evaluate(() => {
      const w = urchinDebug.world,
        n = Math.round(w.terrain.size / w.terrain.spacing) + 1;
      // Isolate a surfaced, fit diver on a wet shoal. After this initial setup,
      // ordinary runtime physics performs escape and real input requests boarding.
      w.career.intro.status = 'complete';
      w.career.difficulty = 'realistic';
      w.career.assists.widePickup = false;
      w.career.assists.exactLoad = false;
      w.career.trafficSettings = { rate: 0 };
      w.day.phase = 'practice';
      w.day.minute = 600;
      w.day.inspection = { status: 'cleared' };
      w.day.crewRest = 0;
      w.terrain = {
        ...w.terrain,
        depths: Array.from({ length: n * n }, (_, i) =>
          (i % n) * w.terrain.spacing < 120 ? 1 : 12,
        ),
        patches: [],
      };
      w.patches = [];
      w.logs = [];
      w.rocks = [];
      w.debris = [];
      w.traffic = null;
      w.environment = {
        model: 'uniform',
        seaLevel: 0,
        current: { x: 0, y: 0 },
        wind: { x: 0, y: 0 },
        waves: 0,
      };
      w.sectorRevision = (w.sectorRevision || 0) + 1;
      Object.assign(w.boat, {
        x: 124,
        y: 120,
        heading: 0,
        vx: 0,
        vy: 0,
        throttle: 0,
        rudder: 0,
        turn: 0,
        speed: 0,
        grounded: false,
      });
      Object.assign(w.divers[0], {
        x: 118,
        y: 120,
        state: 'surface',
        condition: 'fit',
        bag: 30,
        qualitySum: 24,
        bagHandled: false,
        hook: 0,
        hooking: false,
        recoveryAction: null,
        transit: null,
      });
      w.divers[1].state = 'ready';
      w.selectedDiverId = 0;
      w.catch = 0;
      w.bags = [];
      return {
        position: { x: w.divers[0].x, y: w.divers[0].y },
        actual: urchinDebug.simulation.recoveryStatus(w, 2, w.divers[0]),
        former: urchinDebug.simulation.recoveryStatus(w, 5, w.divers[0]),
      };
    });
    assert.equal(initial.actual.reason, 'OUT OF RANGE');
    assert.equal(initial.former.available, true);
    await page.waitForFunction(() => urchinDebug.world.divers[0].x > 118.4, null, {
      timeout: 15000,
    });
    await page.screenshot({ path: `${output}/${name}-swimming.png` });
    await page.waitForFunction(
      () => {
        const w = urchinDebug.world;
        return urchinDebug.simulation.recoveryStatus(w, 2, w.divers[0]).available;
      },
      null,
      { timeout: 15000 },
    );
    const alongside = await page.evaluate(() => {
      const w = urchinDebug.world;
      return {
        position: { x: w.divers[0].x, y: w.divers[0].y },
        state: w.divers[0].state,
        bag: w.divers[0].bag,
        catch: w.catch,
        actual: urchinDebug.simulation.recoveryStatus(w, 2, w.divers[0]),
      };
    });
    assert(alongside.position.x > initial.position.x + 1.5);
    assert.equal(alongside.state, 'surface');
    assert.equal(alongside.bag, 30);
    assert.equal(alongside.catch, 0);
    if (name === 'keyboard') {
      await page.keyboard.down('Digit1');
      await page.waitForTimeout(100);
      await page.keyboard.up('Digit1');
    } else if (name === 'controller') await pressAction(page, 'shoalPad', 'recoverDiver');
    else await page.locator('[data-touch="recoverDiver"]').tap();
    await page.waitForFunction(() => urchinDebug.world.divers[0].hooking);
    await page.screenshot({ path: `${output}/${name}-boarding.png` });
    await page.waitForFunction(() => urchinDebug.world.divers[0].state === 'ready', null, {
      timeout: 15000,
    });
    const result = await page.evaluate(() => ({
      states: urchinDebug.world.divers.map((d) => d.state),
      catch: urchinDebug.world.catch,
      bags: urchinDebug.world.bags.map(({ weight, quality }) => ({ weight, quality })),
      events: urchinDebug.world.events.slice(-6),
    }));
    assert.deepEqual(result.states, ['ready', 'ready']);
    assert.equal(result.catch, 30);
    assert.deepEqual(result.bags, [{ weight: 30, quality: 0.8 }]);
    await page.screenshot({ path: `${output}/${name}-aboard.png` });
    records.push({ name, initial, alongside, result });
    console.log(`PASS ${name}: shoal escape reaches actual 2 m gate, input boards 30 lb once`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  passed = true;
} catch (error) {
  failure = error.stack || error.message;
  throw error;
} finally {
  writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(
      {
        passed,
        failure,
        base,
        production: process.env.URCHIN_PRODUCTION_TEST === '1',
        startedAt,
        completedAt: new Date().toISOString(),
        records,
        errors,
        limits:
          'Isolated wet-shoal fixture; actual runtime escape, keyboard and native browser touch, synthetic gamepad. Does not establish physical controller or phone acceptance.',
      },
      null,
      2,
    ),
  );
  await browser.close();
}
