import test from 'node:test';
import assert from 'node:assert/strict';
import { RIVAL_ART, TAXI_ART, DFO_ART, NINE_ART } from '../src/vessel-catalog.js';
import { TRAFFIC_PROFILES, trafficProfile } from '../src/three/traffic-profiles.js';

test('every preserved traffic artwork owns a stable explicit 3D presentation profile', () => {
  const catalog = [...RIVAL_ART, ...TAXI_ART, ...DFO_ART, ...NINE_ART];
  assert.deepEqual(Object.keys(TRAFFIC_PROFILES).sort(), [...catalog].sort());
  assert.equal(catalog.length, 25);
  for (const art of catalog) {
    const actor = { art, kind: 'rival', x: 12, y: 28, speed: 8, length: 9, width: 3.2 },
      before = structuredClone(actor),
      { family, profile, reference } = trafficProfile(actor);
    assert(['basic', 'thruster', 'sterndrive', 'outboard', 'jet', 'twinjet'].includes(family), art);
    assert(
      ['alloy', 'timber', 'utility', 'tug', 'landing', 'rib', 'catamaran'].includes(profile.type),
      art,
    );
    assert(profile.cabin > 0.15 && profile.cabin < 0.6, art);
    assert(profile.cabinWidth > 0.4 && profile.cabinWidth <= 0.9, art);
    assert(profile.cabinHeight > 1 && profile.cabinHeight < 4, art);
    assert(/^#[\da-f]{6}$/i.test(profile.trim), art);
    assert(Number.isInteger(profile.motors) && profile.motors >= 0 && profile.motors <= 2, art);
    assert.equal(typeof profile.solar, 'boolean', art);
    assert(reference.length > 20, art);
    assert(Object.isFrozen(profile));
    assert.deepEqual(actor, before, 'presentation never changes the traffic actor');
    assert.equal(
      trafficProfile({ ...actor, kind: 'taxi' }).profile,
      profile,
      'art identity survives differing actor roles',
    );
  }
});

test('recognizable source silhouettes survive role rendering instead of collapsing into a single boat', () => {
  assert.equal(trafficProfile({ art: 'rival-9' }).profile.type, 'catamaran');
  assert.equal(trafficProfile({ art: 'rival-9' }).profile.solar, true);
  assert.equal(trafficProfile({ art: 'rival-6' }).profile.motors, 2);
  assert.equal(trafficProfile({ art: 'rival-4' }).profile.type, 'timber');
  assert.equal(trafficProfile({ art: 'dfo-1' }).profile.openConsole, true);
  assert.equal(trafficProfile({ art: 'nine-07-r3-c1' }).profile.oars, true);
  assert.equal(trafficProfile({ art: 'nine-08-r3-c2' }).profile.sailingRig, true);
  assert.equal(trafficProfile({ art: 'nine-03-r1-c3' }).profile.outriggers, true);
  assert.notEqual(
    trafficProfile({ art: 'taxi-1' }).profile.type,
    trafficProfile({ art: 'taxi-5' }).profile.type,
  );
  assert.equal(trafficProfile({ kind: 'taxi' }), TRAFFIC_PROFILES['taxi-1']);
});
