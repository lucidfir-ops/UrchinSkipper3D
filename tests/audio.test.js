import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesize } from '../src/audio.js';
test('all original placeholder sounds have bounded finite samples and quiet edges', () => {
  for (const kind of [
    'engine',
    'water',
    'splash',
    'surface',
    'hook',
    'bag',
    'confirm',
    'ground',
    'warning',
    'radio',
  ]) {
    const data = synthesize(kind);
    assert(data.length > 1000);
    assert(data.some((v) => Math.abs(v) > 0.02));
    assert(data.every((v) => Number.isFinite(v) && Math.abs(v) <= 1));
    assert.equal(data[0], 0);
    assert(Math.abs(data.at(-1)) < 0.01);
  }
});
