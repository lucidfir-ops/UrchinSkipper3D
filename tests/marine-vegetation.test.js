import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { kelpPatches, eelgrassPatches, kelpExposure } from '../src/three/kelp-patches.js';
import { bedDepthAt } from '../src/terrain.js';
import { introTerrain } from '../src/career-intro.js';
import { MarineVegetation } from '../src/three/marine-vegetation.js';
import { kelpMotion } from '../src/three/kelp-motion.js';
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

test('kelp retracts at slack, gathers before reversing, and extends gradually into renewed current', () => {
  const flow = { x: 0.8, y: 0 };
  let m = kelpMotion(flow, 0.3);
  const strong = m.extension;
  for (let i = 0; i < 50; i++) m = kelpMotion({ x: 0, y: 0 }, 0.3, m, 0.1);
  assert(m.extension < strong * 0.02);
  assert.equal(m.angle, 0);
  m = kelpMotion(flow, 0.3);
  const first = kelpMotion({ x: -0.8, y: 0 }, 0.3, m, 0.1);
  assert(Math.abs(first.angle) < 0.05, 'no instantaneous reversal');
  assert(first.extension < strong, 'canopy starts gathering before swinging');
  m = first;
  for (let i = 0; i < 30; i++) m = kelpMotion({ x: -0.8, y: 0 }, 0.3, m, 0.1);
  assert(m.extension < 0.3);
  assert(Math.abs(m.tip) < Math.abs(m.angle), 'trailing blades lag the float');
  for (let i = 0; i < 300; i++) m = kelpMotion({ x: -0.8, y: 0 }, 0.3, m, 0.1);
  assert(Math.cos(m.angle) < -0.999);
  assert(m.extension > 0.8);
});

test('rendered vegetation retains roots and tide exposure while interpolating flow poses', () => {
  const world = {
    terrain: flatTerrain(5),
    environment: { model: 'uniform', current: { x: 1, y: 0 }, seaLevel: 0 },
  };
  const scene = new THREE.Group(),
    plants = new MarineVegetation(scene, world);
  const matrix = new THREE.Matrix4();
  try {
    const roots = plants.kelp.map((p) => [p.x, p.y, p.z]);
    plants.update(world, 0);
    world.environment.current = { x: -1, y: 0 };
    plants.update(world, 0.1);
    assert(plants.kelp.every((p) => Math.abs(p.angle) < 0.05));
    for (let i = 2; i < 400; i++) plants.update(world, i * 0.1);
    for (const cell of plants.cells) {
      cell.mesh.getMatrixAt(0, matrix);
      const p = cell.plants[0];
      assert.deepEqual(
        matrix.elements.slice(12, 15).map((v) => Math.round(v * 100) / 100),
        [p.x, p.y, p.z].map((v) => Math.round(v * 100) / 100),
      );
      assert(Math.cos(cell.mesh.geometry.attributes.plantFlow.getX(0)) < -0.995);
    }
    world.environment.current = { x: 0, y: 0 };
    world.environment.seaLevel = 3;
    plants.update(world, 40);
    assert.equal(plants.group.position.y, -3);
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
