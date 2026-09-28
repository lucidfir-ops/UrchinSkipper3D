import test from 'node:test';
import assert from 'node:assert/strict';
import { placeSpeech } from '../src/three/cue-placement.js';

const intersects = (a, b) =>
  a.left < b.right && a.left + a.width > b.left && a.top < b.bottom && a.top + a.height > b.top;

test('surface speech finds clear space beside a rail, context card and followed boat', () => {
  const obstacles = [
    { left: 14, top: 14, right: 1266, bottom: 126 },
    { left: 246, top: 134, right: 746, bottom: 310 },
    { left: 598, top: 322, right: 684, bottom: 478 },
    { left: 14, top: 134, right: 238, bottom: 376 },
  ];
  const result = placeSpeech(
    { x: 532, y: 214 },
    { width: 208, height: 32 },
    { width: 1280, height: 800 },
    obstacles,
    { left: 428, top: 106 },
  );
  for (const obstacle of obstacles) assert(!intersects(result, obstacle));
  assert(result.left >= 6 && result.left + result.width <= 1274);
  assert(result.top >= 6 && result.top + result.height <= 794);
});

test('speech stays inside a narrow viewport near its edge', () => {
  const result = placeSpeech(
    { x: 14, y: 170 },
    { width: 208, height: 48 },
    { width: 390, height: 844 },
    [],
    { left: -90, top: 46 },
  );
  assert(result.left >= 6 && result.left + result.width <= 384);
  assert(result.top >= 6 && result.top + result.height <= 838);
});
