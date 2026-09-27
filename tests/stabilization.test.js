import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, readSnapshot, saveCareer, SAVE_KEY } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { recordKnowledge } from '../src/knowledge.js';
import { FrameMetrics, summarizeFrames } from '../src/frame-metrics.js';
import { resetSessionView } from '../src/session-state.js';
import { seededRandom } from '../src/math.js';
import { money } from '../src/format.js';
import { checkFrameBudget, FRAME_BUDGETS } from '../scripts/performance-checks.js';
import { chooseRenderer } from '../src/renderer-choice.js';

test('scanner and sounder jointly cap new and oversized depth histories', () => {
  const w = careerWorld();
  w.career.fleet[w.boat.configuration].equipment.push('plotter', 'scanner');
  chooseGround(w, 'near');
  recordKnowledge(w);
  const k = w.career.knowledge.near;
  for (let i = 0; i < 3480; i++) k.depths['old-' + i] = { x: i, y: 0, bed: 10, day: 1 };
  for (let i = 0; i < 500; i++) {
    w.time += 2;
    w.boat.x = 30 + (i % 40) * 12;
    w.boat.y = 30 + Math.floor(i / 40) * 12;
    recordKnowledge(w);
    assert(Object.keys(k.depths).length <= 1200);
  }
  assert(!k.depths['old-0']);
  assert(k.depths[`${Math.round(w.boat.x / 6)},${Math.round(w.boat.y / 6)}`]);
});

test('snapshot validation protects backup without requiring a reconstructed world', () => {
  const w = careerWorld(),
    raw = encode(w),
    data = readSnapshot(raw);
  assert.equal(data.career.day, w.career.day);
  const store = new Map([[SAVE_KEY, raw]]),
    storage = {
      getItem: (key) => store.get(key),
      setItem: (key, value) => store.set(key, value),
    };
  w.career.cash += 10;
  assert(saveCareer(w, storage).ok);
  assert.equal(store.get(SAVE_KEY + '-backup'), raw);
  store.set(SAVE_KEY, 'damaged');
  assert(saveCareer(w, storage).ok);
  assert.equal(store.get(SAVE_KEY + '-backup'), raw);
  assert.throws(() => readSnapshot(raw.replace('checksum', 'broken')));
});

test('world replacement clears transient timers, messages, visuals and frame samples', () => {
  let resets = 0;
  const scene = {
    view: { reset: () => resets++ },
    metrics: { reset: () => resets++ },
    nextPanelCheck: 300,
    nextHud: 200,
    playtest: { messages: ['old'], voyageUntil: 500, importantNotice: 'old' },
  };
  resetSessionView(scene);
  assert.equal(resets, 2);
  assert.equal(scene.nextPanelCheck, 0);
  assert.equal(scene.nextHud, 0);
  assert.deepEqual(scene.playtest.messages, []);
  assert.equal(scene.playtest.importantNotice, null);
});

test('full frame instrumentation includes simulation, HUD and renderer submission and is bounded', () => {
  let now = 0;
  const metrics = new FrameMetrics(() => now);
  for (let i = 0; i < 700; i++) {
    metrics.begin(17);
    now += 2;
    metrics.mark('simulationMs');
    now += 3;
    metrics.mark('hudMs');
    now += 4;
    metrics.finish();
  }
  const result = summarizeFrames(metrics.samples);
  assert.equal(result.frames, 600);
  assert.equal(result.totalCpuMs.p95, 9);
  assert.equal(result.rendererMs.mean, 4);
  assert.equal(result.frameMs.mean, 17);
  metrics.reset();
  assert.equal(metrics.samples.length, 0);
  checkFrameBudget(result, FRAME_BUDGETS.software);
  assert.throws(() =>
    checkFrameBudget({ ...result, frameMs: { mean: 103, p95: 110 } }, FRAME_BUDGETS.software),
  );
});

test('shared random factory preserves old sequence and formatting retains cents choices', () => {
  const random = seededRandom(42);
  let seed = 42;
  for (let i = 0; i < 100; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    assert.equal(random(), seed / 4294967296);
  }
  assert.match(money(123.4), /123/);
  assert.match(money(123.4, 2), /123\.40/);
});

test('renderer fallback affects software emulation, not working hardware WebGL', () => {
  const context = (name) => () => ({
    getContext: () => ({
      getExtension: (key) =>
        key === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 1 } : null,
      getParameter: () => name,
    }),
  });
  assert.equal(chooseRenderer(null, context('ANGLE SwiftShader')), 'canvas');
  assert.equal(chooseRenderer(null, context('AMD Radeon')), 'webgl');
  assert.equal(
    chooseRenderer(null, () => ({ getContext: () => null })),
    'canvas',
  );
  assert.equal(chooseRenderer('webgl', context('SwiftShader')), 'webgl');
});
