import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesize, trafficSound, TRAFFIC_SOUND } from '../src/audio.js';
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
    'traffic',
  ]) {
    const data = synthesize(kind);
    assert(data.length > 1000);
    assert(data.some((v) => Math.abs(v) > 0.02));
    assert(data.every((v) => Number.isFinite(v) && Math.abs(v) <= 1));
    assert.equal(data[0], 0);
    assert(Math.abs(data.at(-1)) < 0.01);
  }
});

test('a nearby fast taxi is heard, louder and higher-pitched approaching than leaving', () => {
  const w = (x, vx, kind = 'taxi') => ({
    boat: { x: 0, y: 0 },
    traffic: { actors: [{ kind, x, y: 0, vx, vy: 0 }] },
  });
  const coming = trafficSound(w(60, -15)),
    going = trafficSound(w(60, 15)),
    close = trafficSound(w(20, -15));
  assert(coming.gain > 0 && coming.gain <= TRAFFIC_SOUND.maxGain);
  assert(coming.rate > going.rate, 'Doppler: approaching sounds higher');
  assert(close.gain > coming.gain, 'louder when closer');
  assert.equal(trafficSound(w(TRAFFIC_SOUND.range + 1, -15)).gain, 0);
  assert(trafficSound(w(60, -5, 'tourist')).gain < coming.gain, 'slow tourist boats are quieter');
  assert.equal(trafficSound(w(60, 0)).gain, 0, 'a stopped rival makes no engine noise');
  assert.equal(trafficSound({ boat: { x: 0, y: 0 } }).gain, 0);
});
