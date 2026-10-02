import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const output = 'test-results/surface-drift-2026-10-01';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
async function enter(page, touch = false) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.locator('#keyboardFallback').click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
  await page.locator('#playtest [data-choice-index="0"]').click();
  await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.screen);
  if (touch) await page.evaluate(() => urchinDebug.ui.touch.setEnabled(true));
  await page.waitForTimeout(300);
}
const fixture = () => {
  const d = urchinDebug,
    w = d.world,
    r = d.three;
  r.host.scene.pause();
  w.career.testConditions = null;
  w.environment.model = 'uniform';
  w.environment.current = { x: 1.5, y: 0.3 };
  w.environment.wind = { x: 0, y: 0 };
  w.weather = { ...w.weather, visibility: 1000, rain: 0, wave: 0, sunlight: 1, night: false };
  w.day.minute = 750;
  w.career.assists.currentArrows = false;
  Object.assign(w.boat, { x: 145, y: 170, heading: 0, throttle: 0, rudder: 0 });
  r.host.cameras.main.setZoom(1.4);
  // The tutorial deliberately has no drifting material during instruction.
  // Use the normal 900-particle sea density for this rendering fixture.
  if (!w.debris.length) {
    let seed = 92041;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 900 * (w.terrain.size / 600) ** 2; i++) {
      const x = random() * w.terrain.size,
        y = random() * w.terrain.size;
      if (d.depthAt(x, y) > 0.2) w.debris.push({ x, y, phase: random() * Math.PI * 2 });
    }
  }
  r.draw(w, { ...d.ui, screen: null, started: true }, 0);
  const count = r.surfaceDrift.mesh.count;
  const wakes = r.vessels.wakes;
  wakes.reset();
  wakes.update(0, 0, w);
  wakes.emit(w.boat.x, w.boat.y, 0.7, 0, 0, 2, 0, true);
  const bubble = wakes.particles[(wakes.index - 1) % wakes.size];
  const start = { x: bubble.x, z: bubble.z };
  wakes.update(0.25, 0, w);
  const pausedDisplacement = { x: bubble.x - start.x, y: bubble.z - start.z };
  w.time += 0.5;
  wakes.update(0.125, 0, w);
  return {
    count,
    particles: w.debris.length,
    size: w.terrain.size,
    nearby: w.debris.filter((p) => Math.abs(p.x - w.boat.x) < 45 && Math.abs(p.y - w.boat.y) < 35)
      .length,
    viewport: { width: r.width, height: r.height, zoom: r.host.cameras.main.zoom },
    displacement: { x: bubble.x - start.x, y: bubble.z - start.z },
    pausedDisplacement,
  };
};
try {
  await enter(page);
  const result = await page.evaluate(fixture);
  await page.screenshot({ path: `${output}/day-no-arrows.png` });
  assert(
    result.count > 3,
    `natural material visible in the working viewport: ${JSON.stringify(result)}`,
  );
  assert(Math.abs(result.displacement.x - 0.75) < 1e-9);
  assert(Math.abs(result.displacement.y - 0.15) < 1e-9);
  assert.deepEqual(result.pausedDisplacement, { x: 0, y: 0 });
  await page.evaluate(() => {
    const d = urchinDebug;
    d.world.weather.visibility = 35;
    d.three.draw(d.world, { ...d.ui, screen: null, started: true }, 0);
  });
  await page.screenshot({ path: `${output}/fog-no-arrows.png` });
  const fogCount = await page.evaluate(() => urchinDebug.three.surfaceDrift.mesh.count);
  assert(fogCount < result.count);
  await page.close();
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await enter(page, true);
  const mobile = await page.evaluate(fixture);
  await page.screenshot({ path: `${output}/phone-no-arrows.png` });
  assert.deepEqual(errors, []);
  writeFileSync(
    `${output}/report.json`,
    JSON.stringify({ ...result, fogCount, mobile, errors }, null, 2),
  );
  console.log(
    'PASS: natural material with arrows disabled, daylight/fog, current-advected bubbles, desktop and phone captures.',
  );
} finally {
  await browser.close();
}
