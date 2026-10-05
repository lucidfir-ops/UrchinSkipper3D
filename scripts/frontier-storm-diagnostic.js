import '../tests/matter-helper.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';
import { createCareer, buyAreaAccess } from '../src/career-state.js';
import { careerWorld, encode } from '../src/career-save.js';
import { chooseFirstBoat } from '../src/starter-career.js';
import { chooseGround } from '../src/day.js';
import { COASTS, PHYSICAL_AREAS } from '../src/coasts.js';
import { summarizeFrames } from '../src/frame-metrics.js';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5199/',
  output = process.env.URCHIN_STORM_OUTPUT || 'test-results/frontier-storm-diagnostic',
  fixturePath = process.env.URCHIN_STORM_FIXTURE || 'test-results/frontier-storm-shared-save.json',
  startedAt = new Date().toISOString(),
  errors = [];
mkdirSync(output, { recursive: true });
mkdirSync(dirname(fixturePath), { recursive: true });
if (!existsSync(fixturePath)) {
  // Same basic hull, day5, route to Frontier and widest zoom as the coastal
  // fixture. Funds/weather/day are staged; no natural-career claim is made.
  const w = careerWorld(createCareer(171709, { chooseStarter: true }));
  assert(chooseFirstBoat(w, 'basic').ok);
  w.career.cash = COASTS.reduce((sum, coast) => sum + coast.accessCost, 18000);
  for (const coast of COASTS.filter((coast) => coast.accessCost))
    assert(buyAreaAccess(w, coast.id).ok);
  w.career.day = Math.max(...PHYSICAL_AREAS.map((area) => area.openDay));
  for (const area of PHYSICAL_AREAS.filter((area) => area.tier === 1 || area.tier === 2))
    assert(chooseGround(w, area.id).ok);
  w.career.debugConditions = { weather: 'storm', tideHeight: null };
  writeFileSync(fixturePath, encode(w));
}
const saved = readFileSync(fixturePath, 'utf8'),
  snapshotSha256 = createHash('sha256').update(saved).digest('hex'),
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
  }),
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
let result = null,
  failure = null;
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(base);
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.evaluate((saved) => {
    const d = urchinDebug;
    d.three.host.scene.resume();
    const loaded = d.ui.hooks.changeCareer(null, saved);
    if (!loaded.ok) throw new Error(loaded.reason);
    d.ui.begin(true);
    d.ui.open(null);
    d.ui.chartMode = 'vector';
    d.three.host.cameras.main.setZoom(0.4);
    d.resetRenderSamples();
    window.stormReadyAt = performance.now();
  }, saved);
  await page.waitForFunction(
    () =>
      urchinDebug.world.weather.kind === 'storm' &&
      urchinDebug.renderSamples.length >= 120 &&
      performance.now() - window.stormReadyAt >= 3000,
    null,
    { timeout: 60000 },
  );
  const measured = await page.evaluate(async () => {
    const d = urchinDebug,
      r = d.three,
      gl = r.renderer.getContext(),
      extension = gl.getExtension('WEBGL_debug_renderer_info'),
      parts = {
        coast: [r.coast, 'update'],
        vegetation: [r.coast.vegetation, 'update'],
        vessels: [r.vessels, 'update'],
        navigation: [r.navigation, 'update'],
        diverCues: [r.diverCues, 'update'],
        currentArrows: [r.currentArrows, 'update'],
        surfaceDrift: [r.surfaceDrift, 'update'],
        renderer: [r.renderer, 'render'],
      },
      calls = {},
      restore = [];
    for (const [name, [owner, method]] of Object.entries(parts)) {
      if (!owner) continue;
      const original = owner[method];
      calls[name] = [];
      owner[method] = function (...args) {
        const start = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          calls[name].push(performance.now() - start);
        }
      };
      restore.push(() => (owner[method] = original));
    }
    const start = performance.now(),
      startFrame = r.renderer.info.render.frame;
    d.resetRenderSamples();
    try {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const elapsed = performance.now() - start,
        w = d.world;
      return {
        scripts: [...document.scripts].map((script) => script.src).filter(Boolean),
        elapsed,
        frames: r.renderer.info.render.frame - startFrame,
        fps: ((r.renderer.info.render.frame - startFrame) * 1000) / elapsed,
        samples: d.renderSamples,
        calls,
        device: {
          renderer: extension
            ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER),
          version: gl.getParameter(gl.VERSION),
          pixelRatio: r.renderer.getPixelRatio(),
          framebuffer: [r.canvas.width, r.canvas.height],
          quality: r.graphicsLabel,
        },
        scene: {
          terrain: w.terrain.id,
          day: w.career.day,
          minute: w.day.minute,
          boat: w.boat.configuration,
          position: { x: w.boat.x, y: w.boat.y },
          zoom: d.zoom,
          weather: w.weather,
          speechVisible: !document.querySelector('#seaSpeech')?.hidden,
          grass: r.coast.vegetation?.grass.length,
          kelp: r.coast.vegetation?.kelp.length,
          cells: r.coast.vegetation?.cells.length,
          render: { ...r.renderer.info.render },
          memory: { ...r.renderer.info.memory },
        },
      };
    } finally {
      for (const reset of restore) reset();
    }
  });
  const phases = Object.fromEntries(
    Object.entries(measured.calls).map(([name, values]) => {
      values.sort((a, b) => a - b);
      return [
        name,
        {
          count: values.length,
          mean: values.reduce((sum, n) => sum + n, 0) / Math.max(1, values.length),
          p95: values[Math.floor(values.length * 0.95)] || 0,
          max: values.at(-1) || 0,
        },
      ];
    }),
  );
  const { calls, samples, ...metadata } = measured;
  result = { ...metadata, summary: summarizeFrames(samples), phases };
  await page.screenshot({ path: `${output}/frontier-storm.png` });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ base, snapshotSha256, ...result }, null, 2));
} catch (error) {
  failure = error.stack || error.message;
  throw error;
} finally {
  writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(
      {
        base,
        startedAt,
        completedAt: new Date().toISOString(),
        fixturePath,
        snapshotSha256,
        diagnostic:
          'Identical staged Frontier storm save; draw wrappers observe only. No performance acceptance threshold is changed.',
        failure,
        errors,
        result,
      },
      null,
      2,
    ) + '\n',
  );
  await browser.close();
}
