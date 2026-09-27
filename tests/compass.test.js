import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compassDirection, CompassDraft } from '../src/compass.js';
test('compass follows continuous analogue bearing while quantizing only the instruction', () => {
  const expected = [
    [0, -1, 1],
    [1, -1, 2],
    [1, 0, 3],
    [1, 1, 4],
    [0, 1, 5],
    [-1, 1, 6],
    [-1, 0, 7],
    [-1, -1, 8],
  ];
  for (const [x, y, direction] of expected)
    assert.equal(compassDirection(x, y).direction, direction);
  const a = compassDirection(0.15, -1),
    b = compassDirection(0.25, -1);
  assert.equal(a.direction, b.direction);
  assert(b.angle > a.angle);
  assert.equal(compassDirection(0.05, 0.1).direction, 0);
  assert.equal(compassDirection(NaN, 1).direction, 0);
});
test('compass draft retains its own diver, supports centre/no preference and never mutates the diver', () => {
  const diver = { id: 1, direction: 5, minQuality: 0.7 },
    draft = new CompassDraft(diver);
  draft.point(1, 0);
  assert.equal(draft.direction, 3);
  draft.changeQuality(1);
  assert.equal(draft.quality, 0.8);
  draft.point(0, 0);
  assert.equal(draft.direction, 0);
  assert.deepEqual(diver, { id: 1, direction: 5, minQuality: 0.7 });
});
