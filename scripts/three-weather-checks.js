import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const output = 'test-results/three-weather';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
  ...(process.env.URCHIN_BROWSER_EXECUTABLE
    ? { executablePath: process.env.URCHIN_BROWSER_EXECUTABLE }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
const cases = [
  {
    name: 'day',
    minute: 600,
    kind: 'calm',
    visibility: 500,
    rain: 0,
    night: false,
    sunlight: 0.82,
    darkness: 0,
  },
  {
    name: 'fog',
    minute: 600,
    kind: 'fog',
    visibility: 42,
    rain: 0.08,
    night: false,
    sunlight: 0.18,
    darkness: 0,
  },
  {
    name: 'rain',
    minute: 600,
    kind: 'rain',
    visibility: 180,
    rain: 0.7,
    night: false,
    sunlight: 0.3,
    darkness: 0,
  },
  {
    name: 'night',
    minute: 1260,
    kind: 'calm',
    visibility: 500,
    rain: 0,
    night: true,
    sunlight: 0,
    darkness: 0.82,
  },
];
let device;
const results = [];
try {
  const base = (
    process.env.URCHIN_TEST_URL ||
    process.env.URCHIN_URL ||
    'http://127.0.0.1:5184'
  ).replace(/\/$/, '');
  await page.goto(`${base}/?practice=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.locator('#keyboardFallback').click();
  await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.screen);
  device = await page.evaluate(() => {
    const d = urchinDebug,
      gl = d.three.renderer.getContext();
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      framebuffer: [d.three.canvas.width, d.three.canvas.height],
      pixelRatio: d.three.renderer.getPixelRatio(),
    };
  });
  assert(
    !/swiftshader|llvmpipe|software/i.test(device.renderer),
    `Hardware review required; found ${device.renderer}`,
  );
  await page.evaluate(() => {
    const d = urchinDebug;
    d.three.host.game.loop.sleep();
    d.world.boat.x = 185;
    d.world.boat.y = 152;
    d.world.boat.heading = -0.5;
    d.three.host.cameras.main.setZoom(1.3);
    // Presentation-only fixtures run in a disposable practice session.
    d.world.logs = [
      { id: 'weather-near-log', x: 190, y: 157, radius: 0.3, length: 6, heading: 0.7, phase: 0 },
      { id: 'weather-distant-log', x: 245, y: 152, radius: 0.3, length: 6, heading: 0.7, phase: 0 },
    ];
    d.world.wildlife = {
      encounters: [
        {
          id: 'weather-gulls',
          species: 'seagull',
          x: 245,
          y: 152,
          heading: 0.7,
          state: 'travelling',
          members: [{ offsetX: 0, offsetY: 0, surfaced: true, phase: 0 }],
        },
      ],
    };
    document.querySelectorAll('body > :not(#game):not(script)').forEach((element) => {
      element.style.setProperty('visibility', 'hidden', 'important');
    });
  });
  for (const fixture of cases) {
    const result = await page.evaluate((fixture) => {
      const d = urchinDebug,
        w = d.world,
        r = d.three;
      w.day.minute = fixture.minute;
      w.weather = { ...fixture, wind: 3, wave: 0.12, lightning: 0, bearing: 225 };
      const before = JSON.stringify(w);
      r.draw(w, d.ui, 1 / 60);
      const mist = r.coast.mist;
      const shift = mist.uniforms.uShift.value;
      const top = r.camera.position
        .clone()
        .set(w.boat.x + shift.x, 80, w.boat.y + shift.y)
        .project(r.camera);
      const center = r.project(w.boat.x, w.boat.y, 0);
      return {
        name: fixture.name,
        range: mist.uniforms.uRange.value,
        mist: mist.mesh.visible,
        rain: r.rain.visible,
        centerErrorPixels: Math.hypot(
          ((top.x + 1) * innerWidth) / 2 - center.x,
          ((1 - top.y) * innerHeight) / 2 - center.y,
        ),
        logs: r.coast.life.logs?.count || 0,
        visibleWildlife: [...r.coast.life.animals.values()].filter((object) => object.visible)
          .length,
        sunlight: r.coast.water.material.uniforms.uDaylight.value,
        unchangedSimulation: JSON.stringify(w) === before,
        render: { ...r.renderer.info.render },
      };
    }, fixture);
    assert(result.unchangedSimulation, `${fixture.name}: renderer mutated simulation`);
    assert(result.centerErrorPixels < 0.001, `${fixture.name}: mist clear area is displaced`);
    assert.equal(result.mist, fixture.name !== 'day');
    assert.equal(result.rain, fixture.rain > 0.06);
    assert.equal(result.logs, fixture.name === 'fog' || fixture.name === 'night' ? 1 : 2);
    assert.equal(
      result.visibleWildlife,
      fixture.name === 'fog' || fixture.name === 'night' ? 0 : 1,
    );
    if (fixture.name === 'fog') assert.equal(result.range, 42);
    if (fixture.name === 'night') assert.equal(result.range, 16);
    await page.screenshot({ path: `${output}/${fixture.name}.png` });
    results.push(result);
    console.log(JSON.stringify(result));
  }
  assert.deepEqual(errors, []);
  console.log('Weather presentation checks passed on', device.renderer);
} finally {
  writeFileSync(`${output}/receipt.json`, JSON.stringify({ device, results, errors }, null, 2));
  await browser.close();
}
