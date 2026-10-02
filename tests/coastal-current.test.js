import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { solveCoastalFlow } from '../scripts/world/coastal-flow.js';
import { coastalLayers, sampleCoastalCurrent } from '../src/coastal-current-grid.js';
import { SECTORS } from '../src/sectors.js';
import { createWorld } from '../src/world.js';
import { chooseGround } from '../src/day.js';
import { currentAt, updateEnvironment } from '../src/environment.js';
import { sampleGrid, bedDepthAt, depthAt } from '../src/terrain.js';
import { C } from '../src/config.js';

const magnitude = (v) => Math.hypot(v.x, v.y);
const read = (grid, x, y) => ({
  x: sampleGrid(grid, grid.values, x, y, 2, 0),
  y: sampleGrid(grid, grid.values, x, y, 2, 1),
});
function terrainFrom(depth) {
  const t = { size: 240, spacing: 4, depths: [] };
  for (let y = 0; y <= t.size; y += t.spacing)
    for (let x = 0; x <= t.size; x += t.spacing) t.depths.push(depth(x, y));
  return t;
}
const tIsland = terrainFrom((x, y) =>
  (x >= 60 && x <= 90 && y >= 35 && y <= 210) || (x >= 75 && x <= 180 && y >= 104 && y <= 124)
    ? -8
    : 18,
);

test('actual T shoreline produces reversing lee currents and accelerated shoulders for four inflow bearings', () => {
  for (const flow of [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ]) {
    // No ellipse hints, placed eddies, shelters or channel recipes.
    const field = solveCoastalFlow({ flow, channels: [] }, tIsland);
    let reverse = 0,
      maximum = 0;
    for (let y = 6; y < 240; y += 6)
      for (let x = 6; x < 240; x += 6) {
        const v = read(field, x, y);
        assert(Number.isFinite(magnitude(v)));
        if (bedDepthAt(tIsland, x, y) + 1.15 <= 0.35) assert.equal(magnitude(v), 0);
        else {
          if (v.x * flow.x + v.y * flow.y < -0.03) reverse++;
          maximum = Math.max(maximum, magnitude(v));
        }
      }
    assert(reverse > 25, `${JSON.stringify(flow)} has a useful recirculating area`);
    assert(maximum > 1.3, 'displaced flow accelerates around the shoulders');
    if (flow.y === -1) assert(read(field, 130, 70).y > 0.08, 'north-side lee on northbound flow');
    if (flow.y === 1) assert(read(field, 130, 145).y < -0.08, 'south-side lee on southbound flow');
  }
});

test('removing the obstacle removes recirculation; a submerged ridge still deflects flow', () => {
  const flow = { x: 0, y: -1 };
  const flat = solveCoastalFlow(
    { flow },
    terrainFrom(() => 18),
  );
  assert.equal(flat.wakes.length, 0);
  for (let y = 12; y < 240; y += 24)
    for (let x = 12; x < 240; x += 24) {
      const v = read(flat, x, y);
      assert(Math.abs(v.x) < 0.001 && v.y < -0.9);
    }
  const ridge = terrainFrom(
    (x, y) => 18 - 17 * Math.exp(-(((x - 120) / 70) ** 2 + ((y - 120) / 16) ** 2)),
  );
  const field = solveCoastalFlow({ flow }, ridge, 0);
  assert.equal(field.wakes.length, 0, 'submerged topography is not treated as dry land');
  assert(read(field, 78, 138).x < -0.01);
  assert(read(field, 162, 138).x > 0.01);
});

test('disconnected tidal pools gain no current through a dry rim; overtopping restores circulation', () => {
  const terrain = terrainFrom((x, y) => {
    const radius = Math.hypot(x - 120, y - 120);
    return radius > 36 && radius < 52 ? -1 : 12;
  });
  const dry = solveCoastalFlow({ flow: { x: 0, y: -1 } }, terrain, 0);
  const wet = solveCoastalFlow({ flow: { x: 0, y: -1 } }, terrain, 2);
  assert.equal(magnitude(read(dry, 120, 120)), 0);
  assert(magnitude(read(wet, 120, 120)) > 0.1);
});

test('late-coast live fields preserve dangerous races alongside useful lee water at both strengths and tides', () => {
  for (const id of ['maelstrom-point', 'outer-wall', 'outer-deep']) {
    const w = createWorld();
    chooseGround(w, id);
    for (const strength of [1, -1, 0.35, -0.35])
      for (const level of [0, 1.15, 2.7]) {
        w.environment.currentCurve = { mean: strength };
        updateEnvironment(w);
        w.environment.seaLevel = level;
        let usable = 0,
          danger = 0,
          recirculating = 0,
          water = 0;
        const main =
          id === 'outer-deep'
            ? { x: 0.8, y: -2.6 }
            : id === 'outer-wall'
              ? { x: 0.4, y: -2.8 }
              : { x: 0.1, y: -2.25 };
        for (let y = 12; y < 588; y += 12)
          for (let x = 12; x < 588; x += 12) {
            const v = currentAt(w, x, y),
              speed = magnitude(v) * C.knotsPerMps;
            assert(speed <= 5.00001 && Number.isFinite(speed));
            if (depthAt(w, x, y) <= 0) assert.equal(speed, 0);
            if (depthAt(w, x, y) < 3) continue;
            water++;
            if (speed < 2) usable++;
            if (speed > 4.5) danger++;
            if ((v.x * main.x + v.y * main.y) * strength < -0.03) recirculating++;
          }
        assert(usable / water > 0.04, `${id} ${strength}/${level} has working pockets`);
        assert(recirculating > 5, `${id} has actual local backflow`);
        if (Math.abs(strength) === 1)
          assert(danger / water > 0.15, `${id} retains strong exposed races`);
      }
  }
});

test('fixed-point layers round-trip and blend continuously through tide and spatial cell boundaries', () => {
  const grid = SECTORS.find((s) => s.id === 'outer-wall').terrain.coastalCurrent;
  const layers = coastalLayers(grid);
  assert.strictEqual(coastalLayers(grid), layers, 'decode once per visited map');
  assert.equal(layers[0].length, (grid.size / grid.spacing + 1) ** 2 * 4);
  const a = new Float64Array(4),
    b = new Float64Array(4);
  for (const level of grid.levels) {
    sampleCoastalCurrent(grid, level - 0.0001, 240 - 0.0001, 140, a);
    sampleCoastalCurrent(grid, level + 0.0001, 240 + 0.0001, 140, b);
    assert(a.every((v, i) => Math.abs(v - b[i]) < 0.005));
  }
});

test('all original terrain, fishing grounds and habitat-authoring flow remain unchanged', () => {
  const original = SECTORS.map((s) => {
    const { coastalCurrent: _coastalCurrent, ...terrain } = s.terrain;
    return { ...s, terrain };
  });
  const hash = createHash('sha256').update(JSON.stringify(original)).digest('hex');
  assert.equal(hash, 'bd3be399fe9c48e9a566b8eb6f985216bff5674e4f9fbed0407bbfc02cb3c1a9');
});
