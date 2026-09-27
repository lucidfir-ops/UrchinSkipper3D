import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld } from '../src/world.js';
import { careerWorld, saveCareer, loadCareer, SAVE_KEY } from '../src/career-save.js';
import { CoastalWorld } from '../src/three/world.js';

// A shared browser origin must never let the 3D edition replace a 2D career.
test('3D saves and backups preserve an existing 2D career byte for byte', () => {
  const records = new Map([
    ['urchin-career-v1', 'original two-dimensional career'],
    ['urchin-career-v1-backup', 'original verified backup'],
  ]);
  const storage = {
    getItem: (k) => records.get(k) ?? null,
    setItem: (k, v) => records.set(k, v),
    removeItem: (k) => records.delete(k),
    key: (i) => [...records.keys()][i],
    get length() {
      return records.size;
    },
  };
  const world = careerWorld();
  assert.notEqual(SAVE_KEY, 'urchin-career-v1');
  assert.equal(saveCareer(world, storage).ok, true);
  world.boat.fuel -= 3;
  assert.equal(saveCareer(world, storage).ok, true);
  assert.equal(loadCareer(storage).world.boat.fuel, world.boat.fuel);
  assert.equal(records.get('urchin-career-v1'), 'original two-dimensional career');
  assert.equal(records.get('urchin-career-v1-backup'), 'original verified backup');
});

test('3D coast, material generation and animation never write simulation data', () => {
  const world = createWorld({ practice: true }),
    scene = new THREE.Scene();
  world.environment.seaLevel = 1.7;
  const original = JSON.stringify(world);
  const coast = new CoastalWorld(scene);
  coast.setWorld(world);
  const camera = new THREE.OrthographicCamera(-45, 45, 35, -35, 0.1, 1000);
  camera.position.set(200, 240, 255);
  camera.lookAt(200, 0, 155);
  camera.updateMatrixWorld();
  coast.update(world, 0.1, camera);
  assert.equal(JSON.stringify(world), original);
  assert.equal(coast.bed.position.y, -1.7);
  assert.ok(scene.children.length > 0);
  coast.dispose();
  assert.equal(scene.children.length, 0);
});
