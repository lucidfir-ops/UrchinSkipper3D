import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { kelpPatches, eelgrassPatches, kelpExposure } from '../src/three/kelp-patches.js';
import { bedDepthAt } from '../src/terrain.js';
import { introTerrain } from '../src/career-intro.js';
import { MarineVegetation } from '../src/three/marine-vegetation.js';
import { animateDrives } from '../src/three/vessels.js';

function flatTerrain(depth) {
  return {
    size: 180,
    spacing: 30,
    depths: new Float32Array(49).fill(depth),
    provenance: { seed: 417 },
  };
}

test('each fixed habitat respects its depth band and preserves bathymetry/catch fields', () => {
  const terrain = introTerrain(),
    before = terrain.depths.slice();
  for (const [sample, low, high] of [
    [eelgrassPatches, 2, 6],
    [kelpPatches, 4, 10],
  ]) {
    const plants = sample(terrain);
    assert(plants.length > 80);
    assert(
      plants.every((p) => {
        const depth = bedDepthAt(terrain, p.x, p.z);
        return depth >= low && depth <= high && p.y === -depth;
      }),
    );
    assert.deepEqual(sample({ ...terrain, patches: [{ x: 99, y: 24, stock: 1e9 }] }), plants);
    assert.deepEqual(sample(flatTerrain(low - 0.01)), []);
    assert.deepEqual(sample(flatTerrain(high + 0.01)), []);
  }
  assert.deepEqual(terrain.depths, before);
  const grass = eelgrassPatches(flatTerrain(3));
  assert(grass.length > 3000);
  const central = grass.find((p) => p.x > 50 && p.x < 130 && p.z > 50 && p.z < 130);
  const first = grass.filter((p) => p.patch === central.patch);
  assert(
    Math.max(...first.map((p) => p.x)) - Math.min(...first.map((p) => p.x)) > 30,
    'shallow grass forms large meadows',
  );
});

test('falling tide exposes longer surface stems, rising tide submerges shorter canopies', () => {
  const plants = kelpPatches(flatTerrain(7));
  const counts = [-1, 2, 5].map(
    (tide) => plants.filter((p) => kelpExposure(p, tide).top >= 0).length,
  );
  assert(counts[0] > counts[1] && counts[1] > counts[2]);
  for (const p of plants) {
    const low = kelpExposure(p, -1),
      high = kelpExposure(p, 5);
    assert(low.reach > high.reach && low.slack > high.slack);
  }
});

test('rendered vegetation reverses with current, retains slack direction, and never moves its roots', () => {
  const world = {
    terrain: flatTerrain(5),
    environment: { model: 'uniform', current: { x: 1, y: 0 }, seaLevel: 0 },
  };
  const scene = new THREE.Group(),
    plants = new MarineVegetation(scene, world);
  const matrix = new THREE.Matrix4();
  try {
    const roots = plants.kelp.map((p) => [p.x, p.y, p.z]);
    for (const [time, x, y] of [
      [0, 1, 0],
      [1, -1, 0],
      [2, 0, 1],
    ]) {
      world.environment.current = { x, y };
      plants.update(world, time);
      for (const cell of plants.cells) {
        cell.mesh.getMatrixAt(0, matrix);
        const forward = new THREE.Vector3(1, 0, 0).transformDirection(matrix);
        assert(forward.dot(new THREE.Vector3(x, 0, y)) > 0.999);
      }
    }
    world.environment.current = { x: 0, y: 0 };
    world.environment.seaLevel = 3;
    plants.update(world, 3);
    assert.equal(plants.group.position.y, -3);
    assert(plants.kelp.every((p) => p.angle === -Math.PI / 2));
    assert.deepEqual(
      plants.kelp.map((p) => [p.x, p.y, p.z]),
      roots,
    );
  } finally {
    plants.dispose();
  }
  assert.equal(scene.children.length, 0);
});

test('aft thrust turns the bow toward the commanded helm for every steerable drive', () => {
  for (const type of ['outboard', 'leg', 'jet']) {
    const vessel = new THREE.Group(),
      drive = new THREE.Group();
    drive.userData.type = type;
    drive.position.z = 5;
    vessel.userData.drives = [drive];
    for (const helm of [-1, 0, 1]) {
      animateDrives(vessel, helm);
      drive.updateMatrix();
      const thrust = new THREE.Vector3(0, 0, -1).transformDirection(drive.matrix);
      const torque = new THREE.Vector3().crossVectors(drive.position, thrust);
      // Positive sim heading is clockwise; Three's Y rotation is opposite.
      assert(helm === 0 ? torque.y === 0 : torque.y * helm < 0);
    }
  }
});
