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

test('two nearby diver labels clear top instruments, crew cards and one another', () => {
  const obstacles = [
    { left: 14, top: 14, right: 1034, bottom: 126 },
    { left: 14, top: 134, right: 238, bottom: 376 },
    { left: 1042, top: 14, right: 1266, bottom: 341 },
  ];
  const first = placeSpeech(
    { x: 856, y: 126 },
    { width: 136, height: 25 },
    { width: 1280, height: 800 },
    obstacles,
    { left: 768, top: 75 },
  );
  const firstBox = {
    left: first.left,
    top: first.top,
    right: first.left + first.width,
    bottom: first.top + first.height,
  };
  const second = placeSpeech(
    { x: 867, y: 133 },
    { width: 143, height: 25 },
    { width: 1280, height: 800 },
    [...obstacles, firstBox],
    { left: 815, top: 65 },
  );
  for (const obstacle of obstacles) {
    assert(!intersects(first, obstacle));
    assert(!intersects(second, obstacle));
  }
  assert(!intersects(second, firstBox));
  assert(first.top >= 126 && second.top >= 126);
  assert(Math.abs(first.left - 856) < 150 && Math.abs(second.left - 867) < 150);
});
