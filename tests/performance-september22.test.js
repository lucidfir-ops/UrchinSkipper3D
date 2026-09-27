import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleGrid, sampleGridChannels } from '../src/terrain.js';
import { CoastalRaster } from '../src/coastal-art.js';
import { SECTORS, materializeSector } from '../src/sectors.js';
import { careerWorld, snapshot, readSnapshot, saveCareer, SAVE_KEY } from '../src/career-save.js';
import { BackgroundSave } from '../src/background-save.js';
import { encodeSnapshot } from '../src/save-codec.js';
import { SpatialBins } from '../src/spatial-bins.js';

test('shared current cell interpolation exactly matches seven scalar channels including edges', () => {
  const grid = { size: 40, spacing: 10 },
    values = Array.from({ length: 25 * 7 }, (_, i) => Math.sin(i) * 10),
    out = new Float64Array(7);
  for (const [x, y] of [
    [-1, -2],
    [0, 0],
    [40, 40],
    [50, 30],
    [13.78, 25.7],
    [39.99, 0.1],
  ]) {
    sampleGridChannels(grid, values, x, y, out);
    for (let k = 0; k < 7; k++) assert.equal(out[k], sampleGrid(grid, values, x, y, 7, k));
  }
});
test('yielded terrain preparation and buffer reuse produce the same pixels as synchronous painting', () => {
  const terrain = SECTORS[0].terrain,
    full = new CoastalRaster(terrain, 32),
    chunked = new CoastalRaster(terrain, 32, false);
  for (let row = 0; row < 32; row += 4) chunked.prepareRows(row, row + 4);
  const a = { data: new Uint8ClampedArray(4096) },
    b = { data: new Uint8ClampedArray(4096) },
    c = { data: new Uint8ClampedArray(4096) },
    d = { data: new Uint8ClampedArray(4096) };
  for (const tide of [-2, 0, 1.65, 4]) {
    full.paint(a, b, tide);
    for (let i = 0; i < 1024; i += 128) chunked.paint(c, d, tide, i, i + 128);
    assert.deepEqual(a, c);
    assert.deepEqual(b, d);
  }
});
test('terrain grids share storage while careers retain independent stock and clumps', () => {
  const a = careerWorld(),
    b = careerWorld(),
    x = materializeSector(a, 'near'),
    y = materializeSector(b, 'near');
  assert.equal(x.depths, y.depths);
  assert.notEqual(x.patches, y.patches);
  const before = y.patches[0].remaining;
  x.patches[0].remaining = 0;
  assert.equal(y.patches[0].remaining, before);
  const clump = x.patches.find((p) => p.clumps?.length)?.clumps[0];
  if (clump) assert(!y.patches.some((p) => p.clumps?.includes(clump)));
});
test('spatial broad phase keeps exact boundary outcomes and sees newly added logs', () => {
  const bins = new SpatialBins(6),
    points = Array.from({ length: 500 }, (_, i) => ({
      x: Math.sin(i) * 100,
      y: Math.cos(i * 0.2) * 100,
    }));
  for (const point of points) bins.add(point);
  for (let i = -100; i <= 100; i += 3.3) {
    const hit = (p) => Math.hypot(p.x - i, p.y + i / 2) < 3;
    assert.equal(bins.some(i, -i / 2, 3, hit), points.some(hit));
  }
  bins.add({ x: -6, y: 6 });
  assert(bins.some(-6, 6, 0, () => true));
});
const storage = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
    key: (i) => [...map.keys()][i],
    get length() {
      return map.size;
    },
  };
};
test('background saves capture one consistent snapshot and cannot overwrite a newer manual save', async () => {
  const instances = [];
  const original = globalThis.Worker;
  globalThis.Worker = class {
    constructor() {
      instances.push(this);
    }
    postMessage(value) {
      this.job = structuredClone(value);
    }
    reply() {
      this.onmessage({ data: { id: this.job.id, encoded: encodeSnapshot(this.job.snapshot) } });
    }
  };
  try {
    const saver = new BackgroundSave(),
      w = careerWorld(),
      s = storage();
    const promise = saver.save(w, s),
      cash = w.career.cash;
    w.career.cash += 10;
    instances[0].reply();
    assert((await promise).ok);
    assert.equal(readSnapshot(s.getItem(SAVE_KEY)).career.cash, cash);
    const obsolete = saver.save(w, s);
    saver.cancel();
    w.career.cash += 10;
    assert(saveCareer(w, s).ok);
    instances[0].reply();
    assert((await obsolete).superseded);
    assert.equal(readSnapshot(s.getItem(SAVE_KEY)).career.cash, cash + 20);
    s.setItem(SAVE_KEY, 'damaged external write');
    const backup = s.getItem(SAVE_KEY + '-backup');
    assert(saveCareer(w, s).ok);
    assert.equal(s.getItem(SAVE_KEY + '-backup'), backup);
    const valid = s.getItem(SAVE_KEY);
    w.career.cash = NaN;
    assert.equal(saveCareer(w, s).ok, false);
    assert.equal((await saver.save(w, s)).ok, false);
    assert.equal(s.getItem(SAVE_KEY), valid, 'Invalid live state cannot replace verified saves');
    w.career.cash = cash + 20;
    assert.deepEqual(
      readSnapshot(encodeSnapshot(snapshot(w))),
      JSON.parse(JSON.stringify(snapshot(w))),
    );
  } finally {
    if (original) globalThis.Worker = original;
    else delete globalThis.Worker;
  }
});
