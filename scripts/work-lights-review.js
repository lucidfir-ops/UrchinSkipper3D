import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import '../tests/matter-helper.js';
import { createCareer } from '../src/career-state.js';
import { careerWorld, encode, SAVE_KEY } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';

const output = 'test-results/work-lights-2026-10-01';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  hasTouch: true,
});
const career = createCareer(971);
career.cash = 50000;
await context.addInitScript(({ key, data }) => localStorage.setItem(key, data), {
  key: SAVE_KEY,
  data: encode(careerWorld(career)),
});
const page = await context.newPage(),
  errors = [],
  records = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.routeWebSocket('**', (socket) => {
  socket.connectToServer().onMessage(() => {});
});
const action = (id) => page.locator(`[data-action="${id}"]`).click();
const open = async (screen) => {
  await page.evaluate((name) => urchinDebug.ui.open(name), screen);
  await page.waitForFunction((name) => urchinDebug.ui.screen === name, screen);
};
const shot = (name) => page.screenshot({ path: `${output}/${name}.png` });
const state = () =>
  page.evaluate(() => {
    const d = urchinDebug,
      v = d.world.career.fleet[d.world.boat.configuration];
    return {
      mode: v.workLightMode || 'auto',
      equipment: v.equipment,
      disabled: v.disabledEquipment || [],
      cash: d.world.career.cash,
    };
  });
const select = async (mode, input) => {
  const label = await page.locator(`[data-action="switch-lights-${mode}"]`).innerText();
  await chooseController(page, input, label);
  await page.waitForFunction(
    (mode) =>
      urchinDebug.world.career.fleet[urchinDebug.world.boat.configuration].workLightMode === mode,
    mode,
  );
  assert.equal(
    await page.locator(`[data-action="switch-lights-${mode}"]`).getAttribute('aria-pressed'),
    'true',
  );
};
try {
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.locator('#keyboardFallback').click();
  await open('outfit');
  await action('equipment-lights-double');
  assert(await page.locator('[data-action="buy-selected"]').isDisabled());
  await shot('supplier-locked');
  await action('equipment-lights');
  await action('buy-selected');
  await action('confirm-purchase');
  assert.equal((await state()).cash, 48900);
  await page.evaluate(() => {
    urchinDebug.world.career.xp = 1200;
  });
  await action('equipment-lights-double');
  await shot('double-preview');
  await action('buy-selected');
  await action('cancel-purchase');
  assert.equal((await state()).cash, 48900);
  await action('buy-selected');
  await action('confirm-purchase');
  assert.equal((await state()).cash, 45700);
  await page.evaluate(() => {
    urchinDebug.world.career.xp = 4500;
  });
  await action('equipment-lights-quad');
  await shot('quad-preview');
  await action('buy-selected');
  await action('confirm-purchase');
  assert.equal((await state()).cash, 37200);
  records.push({ purchases: 'rank gates, tier preview, cancel, 2× and 4× charged', cash: 37200 });

  await open('equipment-controls');
  const keys = {
    menuUp: 'ArrowUp',
    menuDown: 'ArrowDown',
    menuLeft: 'ArrowLeft',
    menuRight: 'ArrowRight',
    confirm: 'Enter',
  };
  const keyboard = async (key) => {
    await page.keyboard.press(keys[key]);
    await page.waitForTimeout(150);
  };
  for (const mode of ['on', 'off', 'auto']) await select(mode, keyboard);
  await shot('switches-desktop');
  await page.evaluate(() => {
    urchinDebug.input.suppress();
    urchinDebug.ui.touch.setEnabled(true);
  });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(200);
    for (const mode of ['on', 'off', 'auto']) {
      const button = page.locator(`[data-action="switch-lights-${mode}"]`);
      await button.tap();
      await page.waitForTimeout(150);
      assert((await button.boundingBox()).height >= 44);
      assert.equal((await state()).mode, mode);
    }
    await shot(`switches-touch-${viewport.width}`);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(gamepadScript);
  await page.evaluate(() => {
    urchinDebug.ui.touch.setEnabled(false);
  });
  await page.waitForFunction(() => urchinDebug.input.connected && !urchinDebug.input.suppressed);
  const pad = (key) => pressAction(page, 'fakePad', key);
  for (const mode of ['on', 'off', 'auto']) await select(mode, pad);
  records.push({
    keyboard: 'all three modes',
    touch: 'all three modes portrait and landscape',
    controller: 'all three modes, synthetic only',
  });

  const nightWorld = careerWorld(career);
  assert(chooseGround(nightWorld, 'near').ok);
  nightWorld.day.minute = 1260;
  const loaded = await page.evaluate((saved) => {
    const d = urchinDebug,
      result = d.ui.hooks.changeCareer(null, saved);
    d.ui.begin(true);
    d.ui.open(null);
    return result;
  }, encode(nightWorld));
  assert(loaded.ok, loaded.reason);
  await page.waitForFunction(() => {
    const d = urchinDebug;
    return (
      d.world.day.phase === 'working' &&
      d.world.day.groundId === 'near' &&
      d.three.coast.terrain === d.world.terrain &&
      !d.ui.screen
    );
  });
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world;
    d.ui.open(null);
    d.ui.started = true;
    d.three.host.scene.pause();
    document.querySelectorAll('body > *:not(#game)').forEach((e) => {
      e.style.display = 'none';
    });
    document.body.classList.remove('in-port');
    w.day.minute = 1260;
    w.environment.model = 'uniform';
    w.environment.current = { x: 0.5, y: 0 };
    w.environment.wind = { x: 0, y: 0 };
    w.environment.waves = 0.1;
    w.environment.seaLevel = 0;
    Object.assign(w.weather, { night: true, sunlight: 0, visibility: 1000, rain: 0, wave: 0.1 });
    w.boat.heading = 0;
    w.boat.throttle = 0;
    w.career.assists.currentArrows = false;
    const plants = d.three.coast.kelpPatches;
    const plant = plants[Math.floor(plants.length / 2)];
    if (plant) Object.assign(w.boat, { x: plant.x + 5, y: plant.z + 4 });
    w.logs = [
      { x: w.boat.x - 2, y: w.boat.y - 15, length: 7, width: 0.5, angle: 0.4, vx: 0, vy: 0 },
    ];
    d.three.host.cameras.main.setZoom(1.35);
  });
  for (const outputStrength of [1, 2, 4]) {
    const record = await page.evaluate((strength) => {
      const d = urchinDebug,
        w = d.world,
        vessel = w.career.fleet[w.boat.configuration];
      vessel.equipment = [
        'lights',
        ...(strength >= 2 ? ['lights-double'] : []),
        ...(strength >= 4 ? ['lights-quad'] : []),
      ];
      vessel.workLightMode = 'auto';
      vessel.disabledEquipment = [];
      d.three.draw(w, { ...d.ui, screen: null, started: true }, 0.1);
      const views = d.three.vessels;
      return {
        strength,
        ground: w.day.groundId,
        phase: w.day.phase,
        intensities: views.workSpots.map((s) => s.intensity),
        ranges: views.workSpots.map((s) => s.distance),
        lenses: views.boat.userData.workLenses.length,
        water: d.three.coast.water.material.uniforms.uWorkPower.value,
      };
    }, outputStrength);
    assert.deepEqual(record.intensities, [240 * outputStrength, 240 * outputStrength]);
    assert.deepEqual(record.water, record.intensities);
    assert.equal(record.lenses, outputStrength * 2);
    records.push(record);
    await shot(`night-${outputStrength}x`);
  }
  for (const mode of ['off', 'auto', 'on']) {
    const intensity = await page.evaluate((mode) => {
      const d = urchinDebug,
        w = d.world,
        vessel = w.career.fleet[w.boat.configuration];
      w.weather.night = false;
      w.weather.sunlight = 0.45;
      w.day.minute = 1020;
      vessel.workLightMode = mode;
      vessel.disabledEquipment = mode === 'off' ? ['lights'] : [];
      d.three.draw(w, { ...d.ui, screen: null, started: true }, 0.1);
      return d.three.vessels.workSpots[0].intensity;
    }, mode);
    assert.equal(intensity, mode === 'on' ? 960 : 0);
    await shot(`day-${mode}`);
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify({ records, errors, physicalController: 'not tested' }, null, 2),
  );
  console.log(
    'Work light purchase, keyboard, touch, synthetic controller and actual rendered tier output passed.',
  );
} catch (error) {
  await shot('failure');
  throw error;
} finally {
  await browser.close();
}
