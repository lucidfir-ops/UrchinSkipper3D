import test from 'node:test';
import assert from 'node:assert/strict';
import { drawCoastalDetail, drawKelp } from '../src/coastal-art.js';
import { coastCacheBounds } from '../src/coast-detail-cache.js';
import { drawWaterSurface, waterDetail } from '../src/water-surface.js';
import { createWorld } from '../src/world.js';
import { drawWildlife } from '../src/wildlife-view.js';
const recorder = () => {
  const calls = [];
  return {
    calls,
    graphics: new Proxy(
      {},
      {
        get:
          (_, method) =>
          (...args) => {
            calls.push([method, ...args]);
          },
      },
    ),
  };
};
test('wildlife uses scalable vector calls, simplifies at wide zoom and never changes encounters', () => {
  const w = createWorld();
  w.boat = { x: 100, y: 100 };
  w.wildlife = {
    encounters: [
      {
        species: 'orca',
        x: 105,
        y: 105,
        heading: 0.4,
        born: 2,
        state: 'travelling',
        members: [
          { offsetX: 0, offsetY: 0, phase: 0, surfaced: true },
          { offsetX: 7, offsetY: -4, phase: 2, surfaced: true },
        ],
      },
    ],
  };
  const before = structuredClone(w.wildlife),
    near = recorder(),
    far = recorder(),
    options = { p: 12, rangeX: 100, rangeY: 100, maxDistance: 500 };
  drawWildlife(near.graphics, w, { ...options, zoom: 1 });
  drawWildlife(far.graphics, w, { ...options, zoom: 0.4 });
  assert(near.calls.some(([method]) => method === 'fillPoints'));
  assert(!near.calls.some(([method]) => ['drawImage', 'texture', 'sprite'].includes(method)));
  assert(far.calls.length < near.calls.length);
  assert.deepEqual(w.wildlife, before);
});

test('wide water retains directional whitecaps without subpixel foam and never changes the world', () => {
  const w = createWorld();
  w.environment.wind = { x: 12, y: 6 };
  w.environment.waves = 0.1;
  const before = structuredClone(w),
    near = recorder(),
    far = recorder();
  const bounds = { p: 12, t: 10, minX: 200, minY: 200, maxX: 350, maxY: 350 };
  drawWaterSurface(near.graphics, w, { ...bounds, zoom: 1 });
  drawWaterSurface(far.graphics, w, { ...bounds, zoom: 0.4 });
  assert(far.calls.length < near.calls.length / 2);
  assert(far.calls.some(([method]) => method === 'strokePoints'));
  assert(!far.calls.some(([method]) => method === 'fillCircle'));
  assert(waterDetail(0.4).spacing > waterDetail(1).spacing);
  assert.deepEqual(w, before);
});
test('coast cache stays within one 2048-square texture and covers the wide-view camera between buckets', () => {
  for (const [width, height] of [
    [1024, 640],
    [1280, 800],
    [3840, 2160],
  ]) {
    const w = { boat: { x: 301, y: 299 } },
      a = coastCacheBounds(w, width, height);
    assert(a.width <= 2048 && a.height <= 2048);
    assert(a.left < w.boat.x - width / 9.6 && a.left + a.spanX > w.boat.x + width / 9.6);
    w.boat.x += 5;
    assert.deepEqual(coastCacheBounds(w, width, height), a);
  }
});
test('wide-view decoration has fewer commands without altering coastline or kelp inputs', () => {
  const item = {
      x: 10,
      y: 20,
      radius: 2,
      forest: true,
      n: 0.8,
      points: Array.from({ length: 20 }, (_, i) => ({
        x: 10 + Math.sin(i) * 2,
        y: 20 + Math.cos(i) * 2,
      })),
    },
    bed = { x: 12, y: 22, length: 6, stems: 4, phase: 1 },
    before = structuredClone({ item, bed }),
    near = recorder(),
    far = recorder();
  drawCoastalDetail(near.graphics, item, 12, 1);
  drawCoastalDetail(far.graphics, item, 12, 0.4);
  assert(far.calls.length < near.calls.length / 2);
  const detailed = recorder(),
    simplified = recorder();
  drawKelp(detailed.graphics, bed, { x: 1, y: 0 }, 10, 12, 0.7, 1);
  drawKelp(simplified.graphics, bed, { x: 1, y: 0 }, 10, 12, 0.7, 0.4);
  assert(simplified.calls.length < detailed.calls.length / 2);
  assert(simplified.calls.some(([method]) => method === 'lineBetween'));
  assert.deepEqual({ item, bed }, before);
});
