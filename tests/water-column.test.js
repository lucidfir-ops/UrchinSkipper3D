import test from 'node:test';
import assert from 'node:assert/strict';
import { submergedContrast, waterTurbidity, coastalDaylight } from '../src/three/water-optics.js';
import { FLEET_PROFILES } from '../src/three/fleet-profiles.js';
import { FLEET } from '../src/career-data.js';

test('remaining offshore for multiple days preserves the next daylight cycle', () => {
  for (const minute of [0, 360, 600, 900, 1200]) {
    assert.equal(coastalDaylight(minute), coastalDaylight(minute + 1440));
    assert.equal(coastalDaylight(minute), coastalDaylight(minute + 4320));
  }
  assert.ok(coastalDaylight(600) > coastalDaylight(1200));
});

test('coastal sight column keeps the top two metres readable and conceals five metres', () => {
  assert.equal(submergedContrast(0), 1);
  assert.ok(submergedContrast(2) > 0.7);
  assert.ok(submergedContrast(3.5) < 0.4);
  assert.equal(submergedContrast(5), 0);
  assert.equal(submergedContrast(20), 0);
  const rough = waterTurbidity({ weather: { wave: 3, rain: 1 } });
  assert.ok(submergedContrast(3, rough) < submergedContrast(3));
});
test('every inherited career hull has an explicit model, including both Channel Master catamarans', () => {
  assert.deepEqual(Object.keys(FLEET_PROFILES).sort(), Object.keys(FLEET).sort());
  assert.equal(FLEET_PROFILES.twinjet.type, 'catamaran');
  assert.equal(FLEET_PROFILES['twinjet-sister'].type, 'catamaran');
  assert.equal(FLEET_PROFILES.outboard.type, 'rib');
  assert.equal(FLEET_PROFILES['basic-sister'].type, 'timber');
});
