import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { introTerrain } from '../src/career-intro.js';
import { bedDepthAt } from '../src/terrain.js';
import { oceanApron } from '../src/three/ocean-edge.js';

test('decorative seabed joins the survey boundary without entering or changing playable terrain', () => {
  const terrain = introTerrain();
  const before = JSON.stringify(terrain);
  const segments = terrain.size / terrain.spacing;
  const surface = new THREE.PlaneGeometry(terrain.size, terrain.size, segments, segments);
  surface.rotateX(-Math.PI / 2);
  surface.translate(terrain.size / 2, 0, terrain.size / 2);
  const positions = surface.attributes.position;
  const edges = new Map();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    positions.setY(i, -bedDepthAt(terrain, x, z));
    if (x === 0 || z === 0 || x === terrain.size || z === terrain.size)
      edges.set(`${x},${z}`, positions.getY(i));
  }
  const originalPositions = positions.array.slice();
  const material = new THREE.MeshStandardMaterial();
  const apron = oceanApron(terrain, surface, new Float32Array(positions.count * 3), material);
  const exterior = apron.geometry.attributes.position;
  const joined = new Set();
  for (let i = 0; i < exterior.count; i++) {
    const x = exterior.getX(i),
      y = exterior.getY(i),
      z = exterior.getZ(i);
    assert(
      x <= 0 || z <= 0 || x >= terrain.size || z >= terrain.size,
      'decorative seabed cannot replace any playable survey vertex',
    );
    const key = `${x},${z}`;
    if (edges.has(key)) {
      assert.equal(y, edges.get(key), 'join must have the exact existing seabed height');
      joined.add(key);
    }
    assert(Number.isFinite(x + y + z));
  }
  assert.equal(joined.size, edges.size, 'entire surveyed perimeter must be joined');
  assert.deepEqual(positions.array, originalPositions);
  assert.equal(JSON.stringify(terrain), before);
  apron.geometry.dispose();
  material.dispose();
  surface.dispose();
});
