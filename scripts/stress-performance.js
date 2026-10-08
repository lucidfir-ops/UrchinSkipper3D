// Worst-case frame cost: night + fog + rain with the Bible's 720 floating logs,
// compared with a calm day, at the designer's phone, tablet and Deck sizes.
// The phone run adds 4x CPU throttling as a rough stand-in for a weak phone.
// Usage (production build served):
//   URCHIN_TEST_URL=http://127.0.0.1:5186/ PLAYWRIGHT_BROWSERS_PATH=.browser-cache \
//     node scripts/stress-performance.js [phone,tablet,deck]
// Writes test-results/stress-performance.json. GPU timings are the Deck's
// (RADV), not a phone GPU; CPU throttling is not a real phone either.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEVICES } from './ui-gallery-devices.js';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5186/';
const only = process.argv[2]?.split(',');
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const report = [];
const scenes = {
  calm: { kind: 'calm', visibility: 500, rain: 0, night: false, minute: 600, logs: 72 },
  storm: { kind: 'fog', visibility: 42, rain: 0.7, night: true, minute: 1290, logs: 720 },
};
try {
  for (const device of DEVICES.filter((d) => !only || only.includes(d.id))) {
    const context = await browser.newContext({
      viewport: device.viewport,
      deviceScaleFactor: device.scale,
      hasTouch: device.touch,
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(new URL('?practice=1', base).href);
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 120000 });
    await page.locator('#keyboardFallback').click({ noWaitAfter: true });
    await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.screen);
    if (device.id === 'phone') {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    for (const [name, scene] of Object.entries(scenes)) {
      const result = await page.evaluate(async (scene) => {
        const d = urchinDebug,
          w = d.world;
        const hold = () => {
          w.day.minute = scene.minute;
          w.weather = {
            ...w.weather,
            kind: scene.kind,
            name: scene.kind,
            visibility: scene.visibility,
            rain: scene.rain,
            night: scene.night,
            wind: 12,
            wave: 0.6,
            lightning: 0,
          };
        };
        hold();
        // Presentation load only: a disposable practice session.
        w.logs = Array.from({ length: scene.logs }, (_, i) => ({
          id: `stress-log-${i}`,
          x: 20 + ((i * 97) % (w.terrain.size - 40)),
          y: 20 + ((i * 53 * 7) % (w.terrain.size - 40)),
          radius: 0.3,
          length: 4 + (i % 5),
          heading: i * 0.37,
          phase: i,
        }));
        const timer = setInterval(hold, 200);
        await new Promise((r) => setTimeout(r, 1500));
        d.resetRenderSamples();
        const start = performance.now();
        let frames = 0,
          stop = false;
        const tick = () => {
          if (stop) return;
          frames++;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        await new Promise((r) => setTimeout(r, 5000));
        stop = true;
        clearInterval(timer);
        const elapsed = performance.now() - start,
          stats = {};
        for (const key of ['frameMs', 'simulationMs', 'drawMs', 'hudMs', 'totalCpuMs']) {
          const v = d.renderSamples.map((s) => s[key] || 0).sort((a, b) => a - b);
          stats[key] = {
            mean: +(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)).toFixed(2),
            p95: +(v[Math.floor(v.length * 0.95)] || 0).toFixed(2),
          };
        }
        return {
          fps: +((1000 * frames) / elapsed).toFixed(1),
          logs: w.logs.length,
          quality: d.three.graphicsLabel,
          calls: d.three.renderer.info.render.calls,
          triangles: d.three.renderer.info.render.triangles,
          stats,
        };
      }, scene);
      report.push({ device: device.id, scene: name, ...result, errors: [...errors] });
      console.log(device.id, name, JSON.stringify(result));
    }
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync('test-results/stress-performance.json', JSON.stringify(report, null, 2));
