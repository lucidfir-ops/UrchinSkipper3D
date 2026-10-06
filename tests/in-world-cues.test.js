import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FLEET } from '../src/career-data.js';
import { boatDefinition } from '../src/boats.js';
import { fuelStutter, FUEL_STUTTER } from '../src/fuel-cues.js';

// Materials draw canvas textures; a no-op 2D context builds hulls headlessly.
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
const { DeckLoadCues, deckLoadState, LOAD_CUES } = await import('../src/three/deck-load-cues.js');
const { DiverBoil, BUBBLE_LOOK } = await import('../src/three/diver-boil.js');

const id = Object.keys(FLEET)[0],
  spec = { ...FLEET[id], ...boatDefinition(id).spec, capacity: 1500 };
const world = (bags, extra = {}) => ({
  bags: Array.from({ length: bags }, (_, n) => ({ id: `b${n}`, weight: 300 })),
  catch: Math.min(spec.capacity, bags * 300),
  boat: { hullHealth: 1 },
  weather: { sunlight: 1 },
  ...extra,
});

test('October 5: the deck ghost marks exactly the sacks still to come and vanishes at capacity', () => {
  assert.deepEqual(
    [0, 2, 5].map((n) => deckLoadState(world(n), spec).slots),
    [5, 5, 5],
    'a 1,500 lb deck holds five full sacks whatever is aboard',
  );
  const partial = deckLoadState({ ...world(1), catch: 120 }, spec);
  assert.equal(partial.slots, 1 + Math.ceil((1500 - 120) / 300), 'part bags leave room by weight');
  const full = deckLoadState(world(5), spec);
  assert.equal(full.full, true);
  assert.equal(full.slots, full.bags, 'no ghost slots once full');
  assert.equal(deckLoadState(world(4), spec).full, false);
});

test('a laden hull settles, trims by the stern and pushes a wider wake; a damaged hull lists', () => {
  const empty = deckLoadState(world(0), spec),
    full = deckLoadState(world(5), spec);
  assert.equal(empty.squat, 0);
  assert.equal(full.squat, LOAD_CUES.fullSquat);
  assert.equal(full.trim, LOAD_CUES.fullTrim);
  assert(full.wake > empty.wake);
  assert.equal(empty.list, 0);
  const damaged = deckLoadState(world(0, { boat: { hullHealth: 0.2 } }), spec);
  assert(damaged.list > 0.05 && damaged.squat > 0, 'below the oil-sheen threshold the hull lists');
  assert.equal(deckLoadState(world(0, { boat: { hullHealth: 0.8 } }), spec).list, 0);
});

test('cues draw ghosts, light the lamp only when full, pulse on a landed sack and move only the drawn hull', () => {
  const vessel = makeVessel(spec, boatDefinition(id), makeMaterials()),
    cues = new DeckLoadCues(vessel, vessel.userData.catchLoad.geometry);
  cues.update(world(2), spec, 1 / 60);
  assert.equal(cues.ghosts.count, 3);
  assert.equal(cues.halo.visible, false);
  cues.update(world(3), spec, 1 / 60);
  assert(cues.pulse > 0.9, 'a new sack starts the pulse');
  for (let i = 0; i < 120; i++) cues.update(world(3), spec, 1 / 60);
  assert.equal(cues.pulse, 0, 'and it fades');
  for (let i = 0; i < 600; i++) cues.update(world(5), spec, 1 / 60);
  assert.equal(cues.ghosts.count, 0);
  assert.equal(cues.halo.visible, true, 'deck-full lamp');
  vessel.position.set(10, 0.02, 20);
  vessel.rotation.set(0, 0.7, 0);
  cues.apply(vessel, 0);
  assert(vessel.position.y < -LOAD_CUES.fullSquat + 0.05, 'hull settles');
  assert.equal(vessel.position.x, 10, 'plan position untouched');
  assert.equal(vessel.position.z, 20);
  const stern = new THREE.Vector3(0, 0, spec.length / 2).applyQuaternion(vessel.quaternion),
    bow = new THREE.Vector3(0, 0, -spec.length / 2).applyQuaternion(vessel.quaternion);
  assert(stern.y < bow.y, 'stern-down trim whatever the heading');
  cues.dispose();
});

test('working bubbles upwell; the ascent warning is a filled boil that grows, not a ring', () => {
  const scene = { add() {} },
    boil = new DiverBoil(scene, 0),
    frame = (phase, progress = 0, opacity = 1) =>
      boil.update({
        x: 0,
        z: 0,
        surfaceY: 0,
        phase,
        progress,
        opacity,
        light: 1,
        glow: false,
        time: 0,
        dt: 1 / 60,
      });
  for (let i = 0; i < 300; i++) frame('working');
  assert(boil.work > 0.95 && boil.boil === 0 && boil.mesh.visible);
  const sizes = [];
  for (const progress of [0, 0.5, 1]) {
    for (let i = 0; i < 120; i++) frame('ascending', progress);
    sizes.push(boil.boil);
  }
  assert(sizes[0] > 0.2 && sizes[0] < sizes[1] && sizes[1] < sizes[2], `boil grows ${sizes}`);
  for (let i = 0; i < 600; i++) frame('waiting');
  assert.equal(boil.boil, 0);
  for (let i = 0; i < 10; i++) frame('working', 0, 0);
  assert.equal(boil.mesh.visible, false, 'hidden where bubbles are not visible');
  const shader = boil.material.fragmentShader;
  assert.match(shader, /float disc = smoothstep\(extent/, 'the boil is a filled disc');
  boil.dispose();
  const source = readFileSync('src/three/vessels.js', 'utf8');
  assert.doesNotMatch(source, /radius = surfacing \? 2\.4/, 'no fixed-radius ascent ring');
});

test('low fuel coughs now and then; a clean tank never does', () => {
  for (let t = 0; t < 60; t += 0.05) assert.equal(fuelStutter('normal', t), 1);
  const dips = (level) => {
    let count = 0,
      low = false;
    for (let t = 0; t < 120; t += 0.02) {
      const value = fuelStutter(level, t);
      assert(value <= 1 && value >= 1 - FUEL_STUTTER[level].depth - 1e-9);
      if (value < 0.7 && !low) count++;
      low = value < 0.7;
    }
    return count;
  };
  const warn = dips('warn'),
    danger = dips('danger');
  assert(warn > 0, 'misfires at the home reserve');
  assert(danger > warn, 'more often below the home passage');
});

test('October 5 second notes: divers only whistle; no recorded voices ship', () => {
  assert.equal(existsSync('public/assets/voices'), false);
  assert.equal(existsSync('src/diver-calls.js'), false);
  assert.match(readFileSync('src/main.js', 'utf8'), /surface: 'whistle'/);
});

test('October 5 v2: the ghost is the rest of a full deck in 3D sacks, second layer included, and all of it flashes', () => {
  const big = { ...spec, capacity: 7500 },
    vessel = makeVessel(big, boatDefinition(id), makeMaterials()),
    cues = new DeckLoadCues(vessel, vessel.userData.catchLoad.geometry),
    load = (bags) => ({ ...world(bags), catch: bags * 300 });
  cues.update(load(3), big, 1 / 60);
  assert.equal(cues.ghosts.count, 22, '25 sacks make a full 7,500 lb deck');
  const heights = new Set(),
    m = new THREE.Matrix4(),
    p = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    k = new THREE.Vector3();
  for (let i = 0; i < cues.ghosts.count; i++) {
    cues.ghosts.getMatrixAt(i, m);
    m.decompose(p, q, k);
    heights.add(p.y.toFixed(2));
    assert.equal(k.x.toFixed(3), '0.640', 'ghosts are real sack size, not shrunken rings');
    assert.equal(
      cues.fades.getX(i),
      p.y > 1.5 ? 0 : 1,
      'upper layers are marked for their own tint',
    );
  }
  assert.equal(heights.size, 2, 'a second layer stacks above the first');
  assert.equal(cues.ghosts.visible, false, 'hidden between landings');
  const rest = cues.ghostMaterial.uniforms.uOpacity.value;
  cues.update(load(4), big, 1 / 60);
  const peak = cues.ghostMaterial.uniforms.uOpacity.value;
  assert(
    peak > 0.5 && cues.ghosts.visible,
    `the whole ghost flashes on a landed sack (${rest} → ${peak})`,
  );
  assert.equal(cues.ghosts.count, 21);
  assert.equal(vessel.getObjectByName('Landed sack flash'), undefined, 'no single-sack highlight');
  for (let i = 0; i < 200; i++) cues.update(load(4), big, 1 / 60);
  assert.equal(cues.ghostMaterial.uniforms.uOpacity.value, 0);
  assert.equal(cues.ghosts.visible, false, 'and fades away again');
  assert.match(cues.ghostMaterial.fragmentShader, /shade/, 'lit as a volume');
  cues.dispose();
});

test('October 5 v2: diver bubbles are half as opaque and a quarter smaller in area', () => {
  assert.equal(BUBBLE_LOOK.opacity, 0.5);
  assert.equal((BUBBLE_LOOK.scale ** 2).toFixed(2), '0.75');
  const boil = new DiverBoil({ add() {} }, 0);
  boil.update({
    x: 0,
    z: 0,
    surfaceY: 0,
    phase: 'working',
    progress: 0,
    opacity: 1,
    light: 1,
    glow: false,
    time: 0,
    dt: 1 / 60,
  });
  const u = boil.material.uniforms;
  assert.equal(u.uWorkOpacity.value * u.uOpacity.value, 0.5);
  assert.equal(u.uBoilOpacity.value, 0.5);
  assert.equal(boil.mesh.scale.x, BUBBLE_LOOK.scale);
  boil.dispose();
});

test('October 5: at night a torch-lit ascent boil is bright and seen as far as by day; reefs and unlit divers keep the night limit', async () => {
  const { bubbleOpacity } = await import('../src/bubble-visibility.js');
  const { reefRange } = await import('../src/assists.js');
  const night = (equipment) => ({
    boat: { configuration: 'test', x: 0, y: 0 },
    environment: { waves: 0 },
    weather: { night: true, visibility: 300, rain: 0, wave: 0 },
    career: { fleet: { test: { equipment, disabledEquipment: [], lightMode: 'off' } } },
  });
  const lit = night(['torch']),
    dark = night([]);
  assert.equal(bubbleOpacity(lit, 100, true), 1, 'torch-lit bubbles at 100 m');
  assert.equal(bubbleOpacity(lit, 350, true), 0, 'still bounded by weather visibility');
  assert.equal(bubbleOpacity(dark, 100, true), 0, 'no torch: the boat light limit holds');
  assert.equal(bubbleOpacity(lit, 100), 0, 'unlit sources keep the limit');
  assert(reefRange(lit) === reefRange(dark) && reefRange(lit) < 8, 'torches do not reveal reefs');
  const boil = new DiverBoil({ add() {} }, 0),
    frame = (phase, glow) =>
      boil.update({
        x: 0,
        z: 0,
        surfaceY: 0,
        phase,
        progress: 1,
        opacity: 1,
        light: 0.4,
        glow,
        time: 0,
        dt: 1 / 60,
      });
  for (let i = 0; i < 240; i++) frame('ascending', true);
  const u = boil.material.uniforms;
  assert.equal(u.uBoilOpacity.value, 1, 'lit ascent at full strength');
  assert(u.uLight.value > 0.9, 'and lit by the torch');
  assert.equal(u.uWorkOpacity.value, 0.5, 'working bubbles stay faint');
  for (let i = 0; i < 240; i++) frame('ascending', false);
  assert.equal(u.uBoilOpacity.value, 0.5);
  assert.equal(u.uLight.value, 0.4, 'an unlit ascent at night stays dark');
  boil.dispose();
});

test('October 5 v2: a Settings switch that is ON keeps its text at night', () => {
  const css = readFileSync('src/ui-night.css', 'utf8');
  assert.match(css, /\[role='switch'\]\[aria-checked='true'\]:not\(\.selected, \.menu-row\)/);
});
