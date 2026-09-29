import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { createCareer } from '../src/career-state.js';
import { checkDiverSafety, taxiSafetyStage } from '../src/diver-safety.js';
import { SEASON } from '../src/season.js';
import { introTerrain } from '../src/career-intro.js';
import { kelpPatches } from '../src/three/kelp-patches.js';
import { currentGrid } from '../src/three/current-field.js';
import { animateDrives } from '../src/three/vessels.js';
import * as THREE from 'three';

function taxiContact(day, underwater = false, kind = 'taxi') {
  const w = createWorld({ practice: true });
  w.career = createCareer();
  w.career.day = day;
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  w.environment.model = 'uniform';
  w.environment.current = { x: 0, y: 0 };
  Object.assign(w.diver, { state: underwater ? 'harvesting' : 'surface', x: 250, y: 250 });
  const boat = {
    id: 'passing-taxi',
    kind,
    x: 250,
    y: 250,
    heading: 0,
    vx: 0,
    vy: -15,
    turn: 0,
    speed: 15,
    throttle: 1,
  };
  checkDiverSafety(w, { ...boat, y: 265 }, { boat, spec: { length: 8, width: 3 }, exposed: false });
  return w;
}
test('taxi onboarding uses cumulative career days and never resets protection in season two', () => {
  for (const day of [1, 2, 3]) {
    const w = taxiContact(day);
    assert.equal(w.diver.condition, 'fit');
    assert.equal(w.safety.incidents[0].outcome, 'near miss');
    assert.equal(w.safety.incidents[0].cause, 'water taxi near miss');
    assert(!w.emergency);
  }
  for (const day of [4, SEASON.days]) {
    const w = taxiContact(day);
    assert.equal(w.diver.condition, 'injured');
    assert.equal(w.safety.fatalities, 0);
    assert.equal(w.emergency.mandatoryRescue, false);
  }
  for (const day of [SEASON.days + 1, SEASON.days * 2 + 1]) {
    assert.equal(taxiContact(day).diver.condition, 'deceased');
  }
  assert.equal(taxiContact(1, false, 'rival').diver.condition, 'deceased');
  assert(!taxiContact(1, true).safety);
  assert.equal(taxiSafetyStage({}, { kind: 'taxi' }), 'normal');
});
test('kelp is reproducible habitat with an eastern training stand and no dependency on catch', () => {
  const terrain = introTerrain();
  const plants = kelpPatches(terrain);
  assert(plants.length > 80);
  assert(plants.some((p) => Math.hypot(p.x - 171, p.z - 66) < 16));
  assert.deepEqual(kelpPatches({ ...terrain, patches: [] }), plants);
  assert(plants.every((p) => Number.isFinite(p.length) && p.length > 0 && p.y < 0));
});
test('current arrows retain world positions as the boat moves and cover a zoomed-out view', () => {
  const a = currentGrid(200, 200, 420, 300),
    b = currentGrid(207, 201, 420, 300);
  const common = a.filter((p) => b.some((q) => q.x === p.x && q.y === p.y));
  assert(common.length > a.length * 0.8);
  assert(a.every((p) => p.x % p.spacing === 0 && p.y % p.spacing === 0));
  const far = currentGrid(500, 500, 1500, 1100);
  assert(far.length > 60 && far.length < 1024);
  assert(Math.max(...far.map((p) => p.x)) - Math.min(...far.map((p) => p.x)) > 1300);
});
test('all steering drive groups turn together; propeller animation stops in neutral', () => {
  const vessel = new THREE.Group();
  vessel.userData.drives = [new THREE.Group(), new THREE.Group()];
  for (const d of vessel.userData.drives) d.userData.propeller = new THREE.Group();
  animateDrives(vessel, 1, 0.5, 1);
  assert.equal(vessel.userData.drives[0].rotation.y, 0.58);
  assert.equal(vessel.userData.drives[1].rotation.y, 0.58);
  const spin = vessel.userData.drives[0].userData.propeller.rotation.z;
  animateDrives(vessel, -1, 0, 1);
  assert.equal(vessel.userData.drives[0].rotation.y, -0.58);
  assert.equal(vessel.userData.drives[0].userData.propeller.rotation.z, spin);
});
