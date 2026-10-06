import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { workLightUniforms, updateWorkLightWater } from '../src/three/work-light-water.js';
import { diverTorchStrength } from '../src/three/diver-torch.js';
import { readTimeIncrease } from '../src/time-speed.js';

test('water lights use the actual moving spot positions, directions and operating intensity', () => {
  const rig = new THREE.Group(),
    uniforms = workLightUniforms();
  rig.position.set(25, 0.15, 70);
  rig.rotation.y = -1.2;
  const lights = [0, 1].map((i) => {
    const light = new THREE.SpotLight('white', 240, 40, 0.7, 0.8, 2);
    light.position.set(-i * 2, 3.5, -2);
    light.target.position.set(-i * 8, 0, -20 + i * 20);
    rig.add(light, light.target);
    return light;
  });
  updateWorkLightWater(uniforms, lights);
  lights.forEach((light, i) => {
    const source = light.getWorldPosition(new THREE.Vector3());
    const direction = light.target.getWorldPosition(new THREE.Vector3()).sub(source).normalize();
    assert(uniforms.uWorkPosition.value[i].distanceTo(source) < 1e-9);
    assert(uniforms.uWorkDirection.value[i].dot(direction) > 0.999999);
  });
  lights.forEach((light) => (light.intensity = 0));
  updateWorkLightWater(uniforms, lights);
  assert.deepEqual(uniforms.uWorkPower.value, [0, 0]);
});

test('diver torches respect equipment, darkness, water absorption and sight distance', () => {
  const world = {
    boat: { configuration: 'test', x: 0, y: 0 },
    environment: { waves: 0 },
    weather: { night: true, visibility: 200, rain: 0, wave: 0 },
    career: { fleet: { test: { equipment: ['torch'], disabledEquipment: [] } } },
  };
  const pose = { x: 3, y: 0, depth: 1, underwater: true };
  const near = diverTorchStrength(world, pose);
  assert(near > 0.7);
  // October 5: a faint glow shows from a diver swimming down to about 10 m.
  const deep = diverTorchStrength(world, { ...pose, depth: 8 });
  assert(deep > 0.05 && deep < near * 0.3, `faint at 8 m (${deep})`);
  assert.equal(diverTorchStrength(world, { ...pose, depth: 10 }), 0);
  // The torch is its own light: seen past the boat's unlit 16 m, out to weather visibility.
  assert(diverTorchStrength(world, { ...pose, x: 100 }) > 0.7);
  assert.equal(diverTorchStrength(world, { ...pose, x: 1000 }), 0);
  assert.equal(diverTorchStrength(world, { ...pose, underwater: false }), 0);
  world.career.fleet.test.disabledEquipment = ['torch'];
  assert.equal(diverTorchStrength(world, pose), 0);
  world.career.fleet.test.disabledEquipment = [];
  world.weather.night = false;
  assert.equal(diverTorchStrength(world, pose), 0);
});

test('new pace defaults to zero adjustment and existing saved physical pace survives migration', () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null };
  try {
    assert.equal(readTimeIncrease(), 0);
    for (const [old, current] of [
      [0, -50],
      [50, -25],
      [100, 0],
    ]) {
      values.set('urchin-time-speed-v1', String(old));
      assert.equal(readTimeIncrease(), current);
    }
    values.set('urchin-time-speed-v2', '25');
    assert.equal(readTimeIncrease(), 25);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
