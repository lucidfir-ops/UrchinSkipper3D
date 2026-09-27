import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateSectors } from '../scripts/generate-sectors.js';
import { SECTORS } from '../src/sectors.js';
import { bedDepthAt } from '../src/terrain.js';
import { habitatSuitability, terrainFeatures } from '../scripts/world/habitat.js';
import { patchStyle } from '../src/patch-style.js';
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

test('offline sector recipes reproduce the saved data byte-for-byte deterministically', () => {
  assert.equal(hash(generateSectors().sectors), hash(SECTORS));
  assert.equal(new Set(SECTORS.map((s) => hash(s.terrain.depths))).size, 15);
});
test('every sector has a complete independent quality/speed matrix with safe 1000 lb drops', () => {
  for (const s of SECTORS) {
    const t = s.terrain,
      patches = t.patches.filter((p) => p.kind === 'laboratory');
    assert.equal(patches.length, 16);
    assert.equal(new Set(patches.map((p) => `${p.quality}/${p.rate}`)).size, 16);
    for (const quality of [0.9, 0.8, 0.7, 0.6])
      assert.deepEqual(
        patches.filter((p) => p.quality === quality).map((p) => p.rate),
        [15, 10, 7.5, 5],
      );
    for (const p of patches) {
      assert.equal(p.remaining, 1000);
      assert.equal(p.initialStock, 1000);
      assert(bedDepthAt(t, p.drop.x, p.drop.y) > 3);
      assert(p.outline.length >= 16);
    }
    assert(t.depths.some((d) => d < 0) && t.depths.some((d) => d > 40));
    assert(t.provenance.notForNavigation);
    assert.equal(t.provenance.kind, 'synthetic');
    assert.equal(
      t.currentField.values.length,
      (t.currentField.size / t.currentField.spacing + 1) ** 2 * 7,
    );
  }
});
test('synthetic habitat patches retain terrain-derived evidence and can accept unknown substrate', () => {
  const t = SECTORS[0].terrain,
    natural = t.patches.filter((p) => p.kind === 'habitat');
  assert(natural.length >= 3);
  for (const p of natural) {
    assert(p.suitability > 0);
    assert(Number.isFinite(p.features.slope));
    assert(Number.isFinite(p.features.curvature));
  }
  const f = terrainFeatures(t, 300, 350);
  assert.equal(f.hardness, null);
  assert(Number.isFinite(habitatSuitability(f)));
  assert.equal(habitatSuitability({ ...f, depth: -1 }), 0);
});
test('quality changes the second visual dimension without changing the speed colour', () => {
  const styles = [0.9, 0.8, 0.7, 0.6].map((quality) => patchStyle({ quality, rate: 10 }));
  assert.equal(new Set(styles.map((s) => s.color)).size, 1);
  assert.equal(styles[0].dash, 0);
  assert(styles.every((s, i) => !i || s.dots < styles[i - 1].dots));
  assert.equal(
    new Set([15, 10, 7.5, 5].map((rate) => patchStyle({ quality: 0.9, rate }).color)).size,
    4,
  );
});
