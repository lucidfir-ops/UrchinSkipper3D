// October 5: bull kelp reads as a long floating stipe, a round air bulb and a
// few streamlined blades. Captures the same plants at low / mid / high tide,
// in running current both ways and at slack, top-down (as played) and in an
// oblique close-up. Output: test-results/bull-kelp-2026-10-05/ (or KELP_OUT).
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const output = process.env.KELP_OUT || 'test-results/bull-kelp-2026-10-05';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [],
  records = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const settle = (state) =>
  page.evaluate(({ tide, flow, zoom }) => {
    const d = urchinDebug,
      r = d.three,
      w = d.world;
    w.environment.seaLevel = tide;
    w.environment.current = { x: flow, y: 0 };
    r.host.cameras.main.setZoom(zoom);
    r.coast.vegetation.nextFlow = 0;
    for (let i = 0; i < 300; i++) r.coast.update(w, 0.1, r.camera);
    r.draw(w, { ...d.ui, screen: null, started: true }, 0);
    const plants = r.coast.kelpPatches;
    return {
      tide,
      flow,
      surfaced: plants.filter((p) => p.length >= p.depth + tide).length,
      plants: plants.length,
      calls: r.renderer.info.render.calls,
      triangles: r.renderer.info.render.triangles,
    };
  }, state);
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
      r = d.three,
      w = d.world;
    r.host.scene.pause();
    document.querySelectorAll('body > *:not(#game)').forEach((e) => (e.style.display = 'none'));
    w.career.testConditions = null;
    w.environment.model = 'uniform';
    w.environment.wind = { x: 0, y: 0 };
    w.weather = { ...w.weather, visibility: 1000, rain: 0, wave: 0.1, sunlight: 1 };
    w.day.minute = 600;
    w.career.assists.currentArrows = false;
    const plants = r.coast.kelpPatches,
      candidates = plants.filter((p) => p.x > 140),
      p = candidates[Math.floor(candidates.length / 2)] || plants[0];
    window.kelpFocus = { x: p.x, z: p.z };
    Object.assign(w.boat, { x: p.x + 9, y: p.z + 6, heading: 0, throttle: 0, rudder: 0 });
  });
  for (const [label, state] of [
    ['low-tide-flood', { tide: -0.5, flow: 0.8, zoom: 1.6 }],
    ['low-tide-ebb', { tide: -0.5, flow: -0.8, zoom: 1.6 }],
    ['low-tide-slack', { tide: -0.5, flow: 0, zoom: 1.6 }],
    ['mid-tide-flood', { tide: 1.2, flow: 0.8, zoom: 1.6 }],
    ['high-tide-flood', { tide: 2.8, flow: 0.8, zoom: 1.6 }],
    ['low-tide-wide', { tide: -0.5, flow: 0.5, zoom: 0.8 }],
  ]) {
    records.push({ label, ...(await settle(state)) });
    await page.screenshot({ path: `${output}/${label}.png` });
  }
  for (const [label, tide] of [
    ['close-low', -0.5],
    ['close-high', 2.8],
  ]) {
    await settle({ tide, flow: 0.8, zoom: 1.6 });
    await page.evaluate(() => {
      const r = urchinDebug.three,
        { x, z } = window.kelpFocus;
      r.camera.left = -12;
      r.camera.right = 12;
      r.camera.top = 7.5;
      r.camera.bottom = -7.5;
      r.camera.position.set(x - 6, 14, z + 20);
      r.camera.lookAt(x + 3, -1, z);
      r.camera.updateProjectionMatrix();
      r.camera.updateMatrixWorld();
      r.renderer.render(r.scene, r.camera);
    });
    await page.screenshot({ path: `${output}/${label}.png` });
  }
  const [low, , , mid, high] = records;
  assert(low.surfaced >= mid.surfaced && mid.surfaced >= high.surfaced, 'tide exposure');
  assert(high.surfaced >= 0.8 * high.plants, 'bulbs and blades stay afloat at high water');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(records, null, 1));
} finally {
  writeFileSync(`${output}/records.json`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
