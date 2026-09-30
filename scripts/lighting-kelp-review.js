import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const output = 'test-results/lighting-kelp-2026-09-30';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const errors = [],
  records = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.locator('#keyboardFallback').click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
  await page.locator('#playtest [data-choice-index="0"]').click();
  await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.screen);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world,
      r = d.three;
    r.host.scene.pause();
    document.querySelectorAll('body > *:not(#game)').forEach((e) => (e.style.display = 'none'));
    w.career.testConditions = null;
    w.environment.model = 'uniform';
    w.environment.current = { x: 0.8, y: 0 };
    w.environment.wind = { x: 0, y: 0 };
    w.environment.seaLevel = -1;
    w.weather = { ...w.weather, visibility: 1000, rain: 0, wave: 0.1, sunlight: 1, night: false };
    w.day.minute = 600;
    w.career.assists.currentArrows = false;
    const plants = r.coast.kelpPatches.filter((p) => p.x > 140);
    const p = plants[Math.floor(plants.length / 2)];
    window.habitatFocus = { x: p.x, z: p.z };
    Object.assign(w.boat, { x: p.x + 8, y: p.z + 5, heading: 0, throttle: 0, rudder: 0 });
    r.host.cameras.main.setZoom(1.6);
    w.career.fleet[w.boat.configuration].equipment = [
      ...new Set([...w.career.fleet[w.boat.configuration].equipment, 'lights', 'torch']),
    ];
    // Start from the natural current at the selected point.
    for (const cell of r.coast.vegetation.cells) for (const p of cell.plants) p.motion = undefined;
    r.coast.vegetation.lastFlow = null;
    r.coast.vegetation.nextFlow = 0;
    r.draw(w, { ...d.ui, screen: null, started: true }, 0.1);
  });
  const advance = async (seconds) =>
    page.evaluate((seconds) => {
      const d = urchinDebug;
      for (let t = 0; t < seconds; t += 0.1) d.three.coast.update(d.world, 0.1, d.three.camera);
      d.three.draw(d.world, { ...d.ui, screen: null, started: true }, 0);
      return d.three.coast.kelpPatches.slice(0, 5).map((p) => p.motion);
    }, seconds);
  const shot = async (name) => {
    await page.screenshot({ path: `${output}/${name}.png` });
  };
  await advance(4);
  await shot('kelp-flood');
  await page.evaluate(() => {
    urchinDebug.world.environment.current = { x: 0, y: 0 };
  });
  await advance(5);
  await shot('kelp-slack');
  records.push({ phase: 'slack', motion: await advance(0.1) });
  await page.evaluate(() => {
    urchinDebug.world.environment.current = { x: -0.8, y: 0 };
  });
  for (const [seconds, name] of [
    [1, 'kelp-turn-1'],
    [2, 'kelp-turn-3'],
    [5, 'kelp-ebb'],
  ]) {
    records.push({ phase: name, motion: await advance(seconds) });
    await shot(name);
  }
  for (const tide of [-1, 2, 5]) {
    const state = await page.evaluate((tide) => {
      const d = urchinDebug;
      d.world.environment.seaLevel = tide;
      d.three.draw(d.world, { ...d.ui, screen: null, started: true }, 0);
      return {
        tide,
        surfaced: d.three.coast.kelpPatches.filter((p) => p.length >= p.depth + tide).length,
      };
    }, tide);
    records.push(state);
    await shot(`kelp-tide-${tide}`);
  }
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world;
    w.environment.seaLevel = -1;
    w.weather.night = true;
    w.weather.sunlight = 0;
    w.day.minute = 1260;
    w.logs.push({
      x: w.boat.x - 2,
      y: w.boat.y - 15,
      length: 7,
      width: 0.5,
      angle: 0.4,
      vx: 0,
      vy: 0,
    });
    d.three.draw(w, { ...d.ui, screen: null, started: true }, 0.1);
  });
  for (const heading of [0, 1.2]) {
    await page.evaluate((heading) => {
      const d = urchinDebug;
      d.world.boat.heading = heading;
      d.three.draw(d.world, { ...d.ui, screen: null, started: true }, 0.1);
    }, heading);
    await shot(`night-lights-${heading}`);
  }
  await page.evaluate(() => {
    const d = urchinDebug;
    d.world.career.fleet[d.world.boat.configuration].disabledEquipment = ['lights'];
    d.three.draw(d.world, { ...d.ui, screen: null, started: true }, 0.1);
  });
  await shot('night-lights-off');
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world;
    w.career.fleet[w.boat.configuration].disabledEquipment = [];
    Object.assign(w.divers[0], {
      x: w.boat.x - 5,
      y: w.boat.y - 3,
      state: 'surfacing',
      transit: { kind: 'ascent', depth: 7, total: 5 },
      timer: (1.2 / 7) * 5,
      heading: 0,
    });
    d.three.draw(w, { ...d.ui, screen: null, started: true }, 0.1);
  });
  await shot('diver-torch');
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world,
      r = d.three;
    w.career.fleet[w.boat.configuration].disabledEquipment = ['lights'];
    r.draw(w, { ...d.ui, screen: null, started: true }, 0.1);
    r.camera.left = -10;
    r.camera.right = 10;
    r.camera.top = 6.25;
    r.camera.bottom = -6.25;
    r.camera.updateProjectionMatrix();
    r.renderer.render(r.scene, r.camera);
  });
  await shot('diver-torch-isolated');
  records.push(
    await page.evaluate(() => ({
      torchIntensity: urchinDebug.three.vessels.diverTorches[0].light.intensity,
    })),
  );
  assert(records.at(-1).torchIntensity > 0);
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world;
    w.career.fleet[w.boat.configuration].disabledEquipment = [];
    w.weather.wave = 1.5;
    w.environment.wind = { x: 3, y: 5 };
    d.three.draw(w, { ...d.ui, screen: null, started: true }, 0.1);
  });
  await shot('night-ripples');
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world;
    w.weather.wave = 0.1;
    w.environment.wind = { x: 0, y: 0 };
    d.three.draw(w, { ...d.ui, screen: null, started: true }, 0.1);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const d = urchinDebug;
    d.three.resize();
    d.three.draw(d.world, { ...d.ui, screen: null, started: true }, 0.1);
  });
  await shot('night-phone');
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world;
    w.day.minute = 600;
    Object.assign(w.weather, { night: false, kind: 'fog', sunlight: 0.25, visibility: 80 });
    d.three.draw(w, { ...d.ui, screen: null, started: true }, 0.1);
  });
  await shot('fog-phone');
  await page.evaluate(() => {
    Object.assign(urchinDebug.world.weather, {
      night: true,
      kind: 'calm',
      sunlight: 0,
      visibility: 1000,
    });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world;
    document.querySelectorAll('body > *:not(#game)').forEach((e) => (e.style.display = ''));
    w.career.intro = { status: 'complete', step: 9 };
    w.career.day = 1;
    w.day.phase = 'working';
    w.day.minute = 600;
    w.career.debugConditions = { weather: 'natural', tideHeight: null, godmode: true };
    w.logs = [];
    w.divers.forEach((d) => {
      d.state = 'ready';
      d.depth = 0;
    });
    d.three.host.scene.resume();
    d.ui.open('debug-mode');
  });
  // Measure the fully rendered lit scene while the simulation is paused.
  await page.evaluate(() => {
    urchinDebug.world.weather.night = true;
    urchinDebug.world.day.minute = 1260;
  });
  records.push(
    await page.evaluate(async () => {
      const begin = performance.now();
      let frames = 0;
      await new Promise((resolve) => {
        const tick = () => {
          frames++;
          if (performance.now() - begin < 4000) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      const gl = urchinDebug.three.renderer.getContext(),
        ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        litSceneFPS: (1000 * frames) / (performance.now() - begin),
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      };
    }),
  );
  await page.evaluate(() => {
    urchinDebug.world.day.minute = 600;
    urchinDebug.ui.signature = null;
  });
  await page.getByRole('button', { name: 'Skip forward 30 minutes', exact: true }).click();
  await page.locator('dialog.time-advance').waitFor();
  const first = await page.locator('dialog progress').getAttribute('value');
  await shot('advance-desktop');
  await page.waitForFunction(() => !urchinDebug.ui.debugAdvancing, null, { timeout: 120000 });
  records.push({
    advanceStart: first,
    notice: await page.evaluate(() => urchinDebug.ui.menuNotice),
  });
  assert.match(records.at(-1).notice, /Advanced 30 minutes/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Set time ·/ }).click();
  await page.getByRole('button', { name: 'Advance to 21:00', exact: true }).tap();
  await page.locator('dialog.time-advance').waitFor();
  await page.waitForFunction(() => document.querySelector('dialog progress').value > 0);
  await shot('advance-phone');
  await page.getByRole('button', { name: 'Stop here', exact: true }).tap();
  await page.waitForFunction(() => !urchinDebug.ui.debugAdvancing);
  assert.match(await page.evaluate(() => urchinDebug.ui.menuNotice), /stopped here/);
  // Keyboard can start a later target and stop without a delayed Back action.
  await page.evaluate(() => {
    const ui = urchinDebug.ui;
    ui.index = 9;
    ui.signature = null;
  });
  await page.keyboard.press('Enter');
  await page.locator('dialog.time-advance').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !urchinDebug.ui.debugAdvancing);
  assert.equal(await page.evaluate(() => urchinDebug.ui.screen), 'debug-time');
  // Synthetic pad uses the same confirm/back path; this is not physical-device validation.
  await page.evaluate(gamepadScript, { name: 'reviewPad' });
  await page.evaluate(() => {
    const ui = urchinDebug.ui;
    ui.index = 9;
    ui.signature = null;
  });
  await pressAction(page, 'reviewPad', 'confirm');
  await page.locator('dialog.time-advance').waitFor();
  await page.setViewportSize({ width: 844, height: 390 });
  await shot('advance-landscape');
  await pressAction(page, 'reviewPad', 'back');
  await page.waitForFunction(() => !urchinDebug.ui.debugAdvancing);
  assert.match(await page.evaluate(() => urchinDebug.ui.menuNotice), /stopped here/);
  await page.evaluate(() => {
    window.reviewPad.connected = false;
    urchinDebug.ui.open('gameplay-speed');
  });
  assert.equal(await page.evaluate(() => urchinDebug.ui.hooks.save().ok), true);
  await page.locator('#timeSpeed').fill('0');
  await page.screenshot({ path: `${output}/speed-landscape.png` });
  await page.locator('#timeSpeed').fill('-50');
  assert.equal(await page.evaluate(() => localStorage.getItem('urchin-time-speed-v2')), '-50');
  await page.reload();
  await page.waitForFunction(() => window.urchinDebug?.ready);
  assert.equal(await page.evaluate(() => localStorage.getItem('urchin-time-speed-v2')), '-50');
  records.push({
    inputs:
      'Pointer/native touch tap, keyboard Enter/Escape and synthetic controller confirm/back time advance; saved speed reload.',
  });
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(`${output}/receipt.json`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
