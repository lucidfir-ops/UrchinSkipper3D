import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import '../tests/matter-helper.js';
import { createCareer } from '../src/career-state.js';
import { careerWorld, encode, SAVE_KEY } from '../src/career-save.js';

const output = 'test-results/wind-crests-2026-10-02';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const errors = [],
  records = [];

// Read the functions from the live water material, so this exercises the served
// production shader too. A separate native WebGL context avoids touching Three's
// renderer state or importing development-only module URLs into a built game.
function probeCrests() {
  const source = urchinDebug.three.coast.water.material.fragmentShader;
  function shaderFunction(name) {
    const start = source.indexOf(`float ${name}(`);
    if (start < 0) throw new Error(`Live water shader lacks ${name}`);
    let end = source.indexOf('{', start),
      depth = 1;
    while (depth && ++end < source.length) {
      if (source[end] === '{') depth++;
      if (source[end] === '}') depth--;
    }
    if (depth) throw new Error(`Unclosed live shader function ${name}`);
    return source.slice(start, end + 1);
  }
  const canvas = document.createElement('canvas');
  const resolution = 1024,
    metresPerPixel = 0.25;
  canvas.width = canvas.height = resolution;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('Wind shader verification requires WebGL 2');
  const shaders = [],
    program = gl.createProgram();
  try {
    function compile(type, text) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    compile(
      gl.VERTEX_SHADER,
      `#version 300 es
      void main() {
        vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
      }`,
    );
    compile(
      gl.FRAGMENT_SHADER,
      `#version 300 es
      precision highp float;
      uniform vec2 wind;
      uniform float time;
      out vec4 pixel;
      ${['hash', 'valueNoise', 'windCrests'].map(shaderFunction).join('\n')}
      void main() {
        float crest = windCrests(vec2(100.0) + gl_FragCoord.xy * .25, wind, time);
        pixel = vec4(vec3(crest), 1.0);
      }`,
    );
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.viewport(0, 0, resolution, resolution);
    const windUniform = gl.getUniformLocation(program, 'wind');
    const timeUniform = gl.getUniformLocation(program, 'time');
    function sample(x, y, time) {
      gl.uniform2f(windUniform, x, y);
      gl.uniform1f(timeUniform, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const pixels = new Uint8Array(resolution * resolution * 4);
      gl.readPixels(0, 0, resolution, resolution, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Wind shader GPU readback failed');
      return pixels;
    }
    function stats(pixels) {
      let total = 0,
        count = 0,
        max = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        total += pixels[i];
        count += pixels[i] > 2 ? 1 : 0;
        max = Math.max(max, pixels[i]);
      }
      return { total, count, max };
    }
    function correlation(a, b, dx, dy) {
      let ab = 0,
        aa = 0,
        bb = 0;
      for (let y = 16; y < resolution - 16; y++)
        for (let x = 16; x < resolution - 16; x++) {
          const av = a[(y * resolution + x) * 4],
            bv = b[((y + dy) * resolution + x + dx) * 4];
          ab += av * bv;
          aa += av * av;
          bb += bv * bv;
        }
      return ab / Math.sqrt(aa * bb);
    }
    const zero = stats(sample(0, 0, 20));
    const zeroLater = stats(sample(0, 0, 200));
    const moderate = stats(sample(5, 0, 20));
    const strong = stats(sample(15, 0, 20));
    const movement = [];
    for (const [x, y] of [
      [15, 0],
      [-15, 0],
      [0, 15],
      [0, -15],
    ]) {
      // A 15-unit wind transports the pattern 1.85 m/s. Compare the measured
      // 2 m displacement with equal upwind and stationary alternatives. Crest
      // lifetimes may change intensity, so compare correlation, not equality.
      const before = sample(x, y, 20),
        after = sample(x, y, 20 + 2 / 1.85),
        repeat = sample(x, y, 20);
      let pausedPixelsDiffer = 0;
      for (let i = 0; i < before.length; i++) pausedPixelsDiffer += before[i] !== repeat[i] ? 1 : 0;
      movement.push({
        wind: [x, y],
        pausedPixelsDiffer,
        downwind: correlation(before, after, (x / 15) * 8, (y / 15) * 8),
        upwind: correlation(before, after, (-x / 15) * 8, (-y / 15) * 8),
        unshifted: correlation(before, after, 0, 0),
      });
    }
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      source: 'served water material',
      renderer: debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      resolution,
      span: resolution * metresPerPixel,
      zero,
      zeroLater,
      moderate,
      strong,
      movement,
    };
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, data), {
    key: SAVE_KEY,
    data: encode(careerWorld(createCareer(971))),
  });
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.locator('#keyboardFallback').click();
  await page.waitForFunction(() => urchinDebug.ui.started);
  await page.evaluate(() => {
    const d = urchinDebug;
    d.ui.open('chart');
    d.ui.index = 0;
    d.ui.activate(d.world);
  });
  await page.waitForFunction(() => urchinDebug.ui.screen === 'departure');
  await page.evaluate(() => {
    const d = urchinDebug;
    d.ui.index = 0;
    d.ui.activate(d.world);
  });
  await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.ui.blocked);
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world;
    d.three.host.scene.pause();
    document.querySelectorAll('body > *:not(#game)').forEach((e) => (e.style.display = 'none'));
    w.weather = { ...w.weather, visibility: 1000, rain: 0, wave: 0.1, sunlight: 1, night: false };
    w.day.minute = 600;
    w.time = 20;
    w.career.assists.currentArrows = false;
    w.environment.current = { x: 0, y: 0 };
    w.environment.model = 'uniform';
    w.environment.seaLevel = 0;
    Object.assign(w.boat, { x: 250, y: 250, heading: 0, throttle: 0, rudder: 0 });
    d.three.coast.elapsed = 20;
  });
  for (const zoom of [0.3, 1.2])
    for (const wind of [0, 5, 15]) {
      const unchanged = await page.evaluate(
        ({ wind, zoom }) => {
          const d = urchinDebug,
            w = d.world;
          w.environment.wind = { x: wind, y: 0 };
          d.three.host.cameras.main.setZoom(zoom);
          const before = JSON.stringify(w);
          d.three.draw(w, { ...d.ui, started: true, screen: null }, 0);
          return before === JSON.stringify(w);
        },
        { wind, zoom },
      );
      const image = `wind-${wind}-${zoom === 0.3 ? 'wide' : 'close'}.png`;
      records.push({ wind, zoom, image, unchanged });
      assert(unchanged, 'Rendering wind crests preserves the simulation');
      await page.screenshot({ path: `${output}/${image}` });
    }
  const beforeProbe = await page.evaluate(() => JSON.stringify(urchinDebug.world));
  const result = await page.evaluate(probeCrests);
  assert.equal(await page.evaluate(() => JSON.stringify(urchinDebug.world)), beforeProbe);
  records.push(result);
  assert.equal(result.zero.total, 0);
  assert.equal(result.zeroLater.total, 0);
  assert(result.moderate.count > 0);
  assert(result.strong.count > result.moderate.count * 3);
  for (const flow of result.movement) {
    assert.equal(flow.pausedPixelsDiffer, 0);
    assert(flow.downwind > 0.8, JSON.stringify(flow));
    assert(flow.downwind > flow.upwind * 5, JSON.stringify(flow));
    assert(flow.downwind > flow.unshifted * 5, JSON.stringify(flow));
  }
  assert.deepEqual(errors, []);
  console.log('Wind crest screenshots, GPU coverage/movement and simulation non-mutation passed.');
} finally {
  writeFileSync(`${output}/receipt.json`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
