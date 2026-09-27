import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('test-results/three', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
try {
  await page.goto(
    new URL('?practice=1', process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/').href,
  );
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.locator('#keyboardFallback').click({ noWaitAfter: true });
  await page.waitForTimeout(1000);
  const device = await page.evaluate(() => {
    const gl = urchinDebug.three.renderer.getContext(),
      e = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      pixelRatio: urchinDebug.three.renderer.getPixelRatio(),
      framebuffer: [urchinDebug.three.canvas.width, urchinDebug.three.canvas.height],
      screen: urchinDebug.ui.screen,
      started: urchinDebug.ui.started,
    };
  });
  console.log('DEVICE', device);
  async function measure(label) {
    const value = await page.evaluate(async () => {
      const d = urchinDebug;
      d.resetRenderSamples();
      const start = performance.now(),
        frame = d.three.renderer.info.render.frame;
      const intervals = [];
      let last = start,
        stopped = false;
      const tick = (t) => {
        if (stopped) return;
        intervals.push(t - last);
        last = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      await new Promise((r) => setTimeout(r, 4000));
      stopped = true;
      const elapsed = performance.now() - start,
        s = d.renderSamples;
      const fields = {};
      for (const key of ['frameMs', 'inputMs', 'simulationMs', 'drawMs', 'hudMs', 'totalCpuMs']) {
        const v = s.map((a) => a[key] || 0).sort((a, b) => a - b);
        fields[key] = {
          mean: v.reduce((a, b) => a + b, 0) / Math.max(v.length, 1),
          p95: v[Math.floor(v.length * 0.95)] || 0,
        };
      }
      return {
        elapsed,
        renderFrames: d.three.renderer.info.render.frame - frame,
        rafFrames: intervals.length,
        fps: (1000 * intervals.length) / elapsed,
        fields,
        render: d.three.renderer.info.render,
      };
    });
    console.log(label, JSON.stringify(value));
    return { label, ...value };
  }
  const results = [];
  results.push(await measure('native'));
  if (process.argv.includes('--compare')) {
    await page.evaluate(() => {
      const r = urchinDebug.three.renderer;
      r.setPixelRatio(0.5);
      r.setSize(innerWidth, innerHeight);
    });
    results.push(await measure('half-resolution'));
    await page.evaluate(() => {
      urchinDebug.three.renderer.shadowMap.enabled = false;
    });
    results.push(await measure('half-resolution-no-shadows'));
    await page.evaluate(() => urchinDebug.three.host.game.loop.sleep());
    results.push(await measure('no-simulation-render'));
  }
  writeFileSync(
    'test-results/three/performance.json',
    JSON.stringify({ device, results, errors }, null, 2),
  );
  console.log('ERRORS', errors);
  assert.deepEqual(errors, []);
  assert(results[0].renderFrames > 0);
} finally {
  await browser.close();
}
