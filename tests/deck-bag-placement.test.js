import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FLEET, FLEET_ORDER } from '../src/career-data.js';
import { boatDefinition } from '../src/boats.js';
import { C } from '../src/config.js';
import { FLEET_PROFILES } from '../src/three/fleet-profiles.js';

// Materials draw canvas textures; a no-op 2D context is enough to build the
// hull models headlessly. Only bag placement is inspected here.
globalThis.document ??= {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () =>
      new Proxy(
        {},
        {
          get: (_, key) =>
            key === 'createLinearGradient' || key === 'createRadialGradient'
              ? () => ({ addColorStop() {} })
              : key === 'getImageData'
                ? () => ({ data: new Uint8ClampedArray(4) })
                : () => {},
          set: () => true,
        },
      ),
  }),
};
const { makeVessel, makeMaterials } = await import('../src/three/vessels.js');

// Wheelhouse footprint derived independently from the fleet profile: walls
// plus the rounded roof's 0.15 m overhang and bevel.
function cabinBox(spec, profile) {
  const z = spec.length * (profile.cabinZ ?? -0.125),
    halfLength = (spec.length * profile.cabin) / 2 + 0.18,
    halfWidth = (spec.width * profile.cabinWidth) / 2 + 0.18;
  return { minX: -halfWidth, maxX: halfWidth, minZ: z - halfLength, maxZ: z + halfLength };
}
function circleHitsBox(x, z, r, box) {
  const dx = Math.max(box.minX - x, 0, x - box.maxX),
    dz = Math.max(box.minZ - z, 0, z - box.maxZ);
  return Math.hypot(dx, dz) < r;
}

test('recovered sacks load on open working deck clear of every career wheelhouse', () => {
  const materials = makeMaterials(),
    matrix = new THREE.Matrix4(),
    position = new THREE.Vector3(),
    quaternion = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  assert.equal(FLEET_ORDER.length, 12);
  for (const id of FLEET_ORDER) {
    const spec = { ...C.boat, ...boatDefinition(id).spec, ...FLEET[id] },
      profile = FLEET_PROFILES[id],
      cabin = cabinBox(spec, profile);
    const vessel = makeVessel(spec, boatDefinition(id), materials);
    const load = vessel.userData.catchLoad,
      full = Math.ceil(spec.capacity / C.diver.bagSize);
    for (const count of [1, 4, full, full * 2, 120]) {
      load.update(Array.from({ length: count }), spec);
      assert.equal(load.bodies.count, count, `${id}: ${count} sacks drawn`);
      for (let i = 0; i < count; i++) {
        load.bodies.getMatrixAt(i, matrix);
        matrix.decompose(position, quaternion, scale);
        const r = scale.x,
          where = `${id} sack ${i + 1}/${count} at x=${position.x.toFixed(2)} z=${position.z.toFixed(2)}`;
        assert(!circleHitsBox(position.x, position.z, r, cabin), `${where} overlaps wheelhouse`);
        assert(Math.abs(position.x) + r <= spec.width * 0.4 + 1e-6, `${where} beyond deck side`);
        assert(position.z - r >= -spec.length * 0.3 - 1e-6, `${where} on foredeck/bow`);
        assert(position.z + r <= spec.length * 0.44 + 1e-6, `${where} beyond transom`);
        assert(position.y - scale.y >= 0.88 - 1e-6, `${where} below deck`);
      }
    }
  }
});

test('the aft-cabin landing craft loads forward of its house; aft-deck hulls still load aft', () => {
  const materials = makeMaterials();
  for (const id of FLEET_ORDER) {
    const spec = { ...C.boat, ...boatDefinition(id).spec, ...FLEET[id] },
      vessel = makeVessel(spec, boatDefinition(id), materials),
      load = vessel.userData.catchLoad;
    load.update(Array.from({ length: 6 }), spec);
    const cabinZ = spec.length * FLEET_PROFILES[id].cabinZ,
      forward = load.markers.every((m) => (m.y * spec.length) / 10 < cabinZ);
    assert.equal(forward, cabinZ > 0, `${id} loads on the side of the house with open deck`);
  }
});
