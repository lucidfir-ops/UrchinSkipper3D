import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const output = process.env.URCHIN_EDGE_OUTPUT || 'test-results/ocean-edge-2026-10-02';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const errors = [],
  records = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.locator('#keyboardFallback').click();
  await page.getByRole('button', { name: 'Come aboard · learn with Frank', exact: true }).click();
  await page.waitForFunction(() => !urchinDebug.ui.screen);
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world;
    d.three.host.game.loop.sleep();
    d.three.host.cameras.main.setZoom(0.24);
    w.boat.x = 180;
    w.boat.y = 220;
    w.environment.wind = { x: 0, y: 0 };
    w.day.minute = 600;
    w.weather = { ...w.weather, night: false, visibility: 1000, sunlight: 1, rain: 0, wave: 0.1 };
    w.career.assists.currentArrows = false;
    d.three.coast.elapsed = 10;
  });
  for (const [name, tide, zoom, x, y] of [
    ['wide-low', -1, 0.24, 120, 120],
    ['wide-mean', 1.15, 0.24, 120, 120],
    ['wide-high', 5, 0.24, 120, 120],
    ['east-low', -1, 0.7, 225, 193],
    ['south-mean', 1.15, 0.5, 180, 225],
  ]) {
    records.push(
      await page.evaluate(
        ({ name, tide, zoom, x, y }) => {
          const d = urchinDebug,
            w = d.world,
            r = d.three;
          w.environment.seaLevel = tide;
          w.boat.x = x;
          w.boat.y = y;
          r.host.cameras.main.setZoom(zoom);
          const before = JSON.stringify(w);
          r.draw(w, d.ui, 0);
          const gl = r.renderer.getContext(),
            ext = gl.getExtension('WEBGL_debug_renderer_info');
          return {
            name,
            tide,
            unchanged: before === JSON.stringify(w),
            renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
            render: { ...r.renderer.info.render },
          };
        },
        { name, tide, zoom, x, y },
      ),
    );
    assert(records.at(-1).unchanged, 'presentation must preserve simulation');
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('Tutorial ocean edge captures and non-mutation checks passed.');
} finally {
  writeFileSync(`${output}/receipt.json`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
