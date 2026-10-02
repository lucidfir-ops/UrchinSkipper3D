import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld, driftDebris, driftSurface } from '../src/world.js';
import { SurfaceDrift, surfaceDriftPose } from '../src/three/surface-drift.js';

function water() {
  const w = createWorld({ practice: true });
  w.terrain = { size: 100, spacing: 10, depths: Array(121).fill(10) };
  w.environment = { current: { x: 2, y: 0 }, seaLevel: 0 };
  w.weather = { night: false, visibility: 100 };
  w.day.minute = 750;
  w.boat.x = w.boat.y = 50;
  w.debris = [{ x: 50, y: 50, phase: 1.5 }];
  return w;
}

test('natural current cues follow actual particles, reverse with flow and stay independent of assists and hidden catch', () => {
  const w = water(),
    item = w.debris[0],
    view = new SurfaceDrift();
  const original = JSON.stringify(w.debris);
  view.update(w, 100, 100);
  assert.equal(view.mesh.count, 1);
  const pose = surfaceDriftPose(w, item),
    matrix = new THREE.Matrix4();
  view.mesh.getMatrixAt(0, matrix);
  assert.equal(matrix.elements[12], item.x);
  assert.equal(matrix.elements[14], item.y);
  assert.equal(pose.heading, Math.PI / 2);
  assert.equal(JSON.stringify(w.debris), original, 'rendering never advects simulation particles');
  w.uiOptions = { currentArrows: false, groundDots: false };
  w.patches = [{ x: 50, y: 50, remaining: 1e6, quality: 1 }];
  assert.deepEqual(surfaceDriftPose(w, item), pose);
  w.environment.current.x = -2;
  assert.equal(surfaceDriftPose(w, item).heading, -Math.PI / 2);
  driftDebris(w, 0.5);
  assert.equal(item.x, 49);
  view.update(w, 100, 100);
  view.mesh.getMatrixAt(0, matrix);
  assert.equal(matrix.elements[12], 49);
});

test('surface material disappears on dry ground and beyond fog, fades near visibility limit and darkens at night', () => {
  const w = water(),
    item = w.debris[0];
  const bright = surfaceDriftPose(w, item).opacity;
  item.x = 95;
  w.weather.visibility = 50;
  assert(surfaceDriftPose(w, item).opacity < bright * 0.5);
  item.x = 100;
  assert.equal(surfaceDriftPose(w, item), null);
  item.x = 50;
  w.day.minute = 1320;
  assert(surfaceDriftPose(w, item).opacity < bright * 0.2);
  w.terrain.depths.fill(-1);
  assert.equal(surfaceDriftPose(w, item), null);
});

test('decorative drift replenishes from wet inflow boundaries without wrapping physical surface objects', () => {
  const w = water(),
    physical = { x: 99, y: 50 };
  w.debris[0].x = 99;
  driftSurface(w, physical, 1);
  driftDebris(w, 1);
  assert.equal(physical.x, 100, 'a diver or physical object never wraps across the map');
  assert.equal(w.debris[0].x, 1);
  assert.equal(w.debris[0].y, 50);
  w.environment.current = { x: 0, y: -2 };
  w.time += 1;
  Object.assign(w.debris[0], { x: 30, y: 1 });
  driftDebris(w, 1);
  assert.equal(w.debris[0].y, 99);
  assert.equal(w.debris[0].x, 30);
});

test('replenishment skips dry inflow points and never moves stationary or inland trapped material', () => {
  const w = water();
  for (let y = 0; y < 11; y++) w.terrain.depths[y * 11] = -20;
  w.debris[0].x = 99;
  driftDebris(w, 1);
  assert.equal(w.debris[0].x, 100, 'entire incoming bank is dry, so there is no valid source');
  w.environment.current.x = 0;
  w.time += 1;
  driftDebris(w, 10);
  assert.equal(w.debris[0].x, 100);
  w.terrain.depths.fill(10);
  for (let y = 0; y < 11; y++) w.terrain.depths[y * 11 + 6] = -20;
  w.environment.current.x = 2;
  w.time += 10;
  w.debris[0].x = 45;
  driftDebris(w, 10);
  assert(w.debris[0].x > 45 && w.debris[0].x < 55, 'dry interior barrier retains stranded foam');
});
