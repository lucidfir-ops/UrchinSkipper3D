import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpeechFootprints } from '../src/three/speech-footprints.js';
import { CatchLoad } from '../src/three/catch-load.js';
import {
  placeSeaSpeech,
  rectanglesOverlap,
  speechIsClear,
  SPEECH_TAIL,
  bufferedSpeechFootprints,
} from '../src/speech-layout.js';
import {
  compactPickupSpeech,
  defaultSeaSpeechRect,
  seaMessage,
  updateSeaMessages,
} from '../src/sea-messages.js';

const rect = (left, top, width, height) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const sizes = [480, 320, 240, 180, 140, 120].map((width) => ({
  width,
  // Measured text wrapping belongs to the browser fixture; this long notice
  // models the corresponding taller box rather than a constant-height strip.
  height: 14 + Math.ceil(115 / ((width - 24) / 6)) * 17 + SPEECH_TAIL,
}));
function cameraFor(width, height, zoom) {
  const span = height / (12 * zoom),
    camera = new THREE.OrthographicCamera(
      (-span * width) / height / 2,
      (span * width) / height / 2,
      span / 2,
      -span / 2,
      0.1,
      1000,
    );
  camera.position.set(0, 240, 105);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}
function mesh(parent, dimensions, position) {
  const part = new THREE.Mesh(new THREE.BoxGeometry(...dimensions));
  part.position.set(...position);
  parent.add(part);
  return part;
}
function workboat() {
  const boat = new THREE.Group();
  mesh(boat, [4, 1.5, 10], [0, 0.5, 0]);
  mesh(boat, [3, 3, 4], [0, 2.5, -1.5]);
  // The port ladder extends outside the waterline hull rectangle.
  mesh(boat, [0.8, 2, 1.5], [-2.4, 0.7, 1]);
  const radar = mesh(boat, [2.4, 0.2, 0.2], [0, 4.2, -1.5]);
  return { boat, radar };
}
function independentlyProjectedCorners(group, camera, viewport) {
  const points = [];
  group.updateWorldMatrix(true, true);
  group.traverseVisible((object) => {
    if (!object.isMesh) return;
    object.geometry.computeBoundingBox();
    const { min, max } = object.geometry.boundingBox;
    for (const x of [min.x, max.x])
      for (const y of [min.y, max.y])
        for (const z of [min.z, max.z]) {
          const p = new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld).project(camera);
          points.push([((p.x + 1) * viewport.width) / 2, ((1 - p.y) * viewport.height) / 2]);
        }
  });
  return points;
}

test('cached ownship envelope protects roof and port ladder at eight headings and all supported zoom extremes', () => {
  const { boat, radar } = workboat(),
    footprints = new SpeechFootprints(),
    vessels = { boat, divers: [] };
  let traversals = 0;
  const traverse = boat.traverse.bind(boat);
  boat.traverse = (visitor) => {
    traversals++;
    traverse(visitor);
  };
  const position = boat.position.clone(),
    scale = boat.scale.clone();
  for (const [width, height] of [
    [1280, 800],
    [844, 390],
    [390, 844],
  ])
    for (const zoom of [0.4, 1.1, 2.2])
      for (let heading = 0; heading < 8; heading++) {
        const viewport = { width, height },
          camera = cameraFor(width, height, zoom);
        boat.rotation.y = (heading * Math.PI) / 4;
        radar.rotation.y = heading * 0.31;
        const [footprint] = footprints.read(vessels, { divers: [] }, camera, viewport);
        for (const [x, y] of independentlyProjectedCorners(boat, camera, viewport)) {
          assert(x >= footprint.left - 1e-8 && x <= footprint.right + 1e-8);
          assert(y >= footprint.top - 1e-8 && y <= footprint.bottom + 1e-8);
        }
      }
  assert.equal(traversals, 1, 'boat mesh bounds are cached, not traversed every frame');
  assert.deepEqual(boat.position, position);
  assert.deepEqual(boat.scale, scale);
  const replacement = workboat().boat;
  replacement.scale.set(1.5, 1.4, 1.8);
  const camera = cameraFor(844, 390, 1.1);
  const [next] = footprints.read({ boat: replacement, divers: [] }, { divers: [] }, camera, {
    width: 844,
    height: 390,
  });
  assert(next.right - next.left > 70, 'a replacement model gets its own transformed bounds');
});

test('both physically visible surfaced groups include body, float and lift line without using submerged positions', () => {
  const groups = [new THREE.Group(), new THREE.Group()],
    camera = cameraFor(844, 390, 1.1);
  for (const [index, group] of groups.entries()) {
    mesh(group, [0.7, 1.6, 0.7], [index ? 5 : -5, 0.2, 0]);
    mesh(group, [1, 0.7, 1], [index ? 6 : -6, 0.1, 1]);
    mesh(group, [3, 0.05, 0.05], [index ? 4 : -4, 1.5, 1]);
  }
  const footprints = new SpeechFootprints(),
    vessels = { divers: groups.map((group) => ({ group })) },
    world = { divers: [{ state: 'surface' }, { state: 'surface' }] },
    viewport = { width: 844, height: 390 };
  const both = footprints.read(vessels, world, camera, viewport);
  assert.equal(both.length, 2);
  for (const [index, group] of groups.entries())
    for (const [x, y] of independentlyProjectedCorners(group, camera, viewport)) {
      assert(x >= both[index].left - 1e-8 && x <= both[index].right + 1e-8);
      assert(y >= both[index].top - 1e-8 && y <= both[index].bottom + 1e-8);
    }
  groups[0].visible = false;
  assert.equal(footprints.read(vessels, world, camera, viewport).length, 1);
  world.divers[1].state = 'descending';
  assert.deepEqual(footprints.read(vessels, world, camera, viewport), []);
});

test('real catch sacks protect changing instance transforms, tall layers, pool growth and unloading without a model rebuild', () => {
  const { boat } = workboat(),
    load = new CatchLoad(boat, new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()),
    footprints = new SpeechFootprints(),
    viewport = { width: 844, height: 390 },
    camera = cameraFor(viewport.width, viewport.height, 2.2),
    vessels = { boat, divers: [] },
    world = { divers: [] },
    spec = { width: 4, length: 10 },
    instance = new THREE.Matrix4(),
    bags = (count) => Array.from({ length: count }, () => ({ weight: 30 }));
  boat.userData.catchLoad = load;
  const read = () => footprints.read(vessels, world, camera, viewport),
    checkActualInstances = (footprint) => {
      load.group.updateWorldMatrix(true, true);
      for (const mesh of [load.bodies, load.knots]) {
        mesh.geometry.computeBoundingBox();
        const { min, max } = mesh.geometry.boundingBox;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, instance);
          for (const x of [min.x, max.x])
            for (const y of [min.y, max.y])
              for (const z of [min.z, max.z]) {
                const p = new THREE.Vector3(x, y, z)
                    .applyMatrix4(instance)
                    .applyMatrix4(mesh.matrixWorld)
                    .project(camera),
                  sx = ((p.x + 1) * viewport.width) / 2,
                  sy = ((1 - p.y) * viewport.height) / 2;
                assert(sx >= footprint.left - 1e-7 && sx <= footprint.right + 1e-7);
                assert(sy >= footprint.top - 1e-7 && sy <= footprint.bottom + 1e-7);
              }
        }
      }
    };
  load.update([], spec);
  assert.equal(read().filter((r) => r.kind === 'deck-load').length, 0);
  const originalModel = boat,
    originalPool = load.bodies;
  for (const count of [1, 17, 160]) {
    load.update(bags(count), spec);
    for (const heading of [0, Math.PI / 4, Math.PI / 2]) {
      boat.rotation.y = heading;
      const all = read(),
        footprint = all.find((r) => r.kind === 'deck-load');
      checkActualInstances(footprint);
      if (count === 160 && heading === Math.PI / 2)
        assert(
          footprint.top < all[0].top,
          'high recovered layers extend above the cached fixed vessel',
        );
    }
  }
  assert.equal(vessels.boat, originalModel);
  assert.notEqual(load.bodies, originalPool, 'the real CatchLoad grows its instance pool');
  let recomputed = 0;
  for (const mesh of [load.bodies, load.knots]) {
    const compute = mesh.computeBoundingBox.bind(mesh);
    mesh.computeBoundingBox = () => {
      recomputed++;
      compute();
    };
  }
  for (let frame = 0; frame < 20; frame++) read();
  assert.equal(recomputed, 0, 'unchanged loads do not iterate their instances each frame');
  load.update(bags(2), spec);
  checkActualInstances(read().find((r) => r.kind === 'deck-load'));
  assert.equal(recomputed, 2, 'removing bags refreshes both live instance bounds');
  load.group.visible = false;
  assert.equal(
    read().some((r) => r.kind === 'deck-load'),
    false,
  );
  load.group.visible = true;
  load.update([], spec);
  assert.equal(
    read().some((r) => r.kind === 'deck-load'),
    false,
  );
});

test('compact speech clears the full bow and tail, crew cards, gauges and keyboard controls', () => {
  const viewport = { width: 844, height: 390 },
    protectedRects = [rect(385, 116, 74, 140), rect(450, 177, 37, 31)],
    occupied = [
      rect(190, 8, 536, 90),
      rect(8, 104, 176, 132),
      rect(8, 282, 176, 108),
      rect(307, 282, 220, 108),
      rect(660, 282, 176, 108),
    ],
    preferred = defaultSeaSpeechRect(viewport.width, viewport.height),
    old = rect(preferred.left, preferred.top, preferred.width, 46 + SPEECH_TAIL);
  assert(!speechIsClear(old, protectedRects), 'the old centre-only check missed the bow');
  const placed = placeSeaSpeech(viewport, sizes, preferred, protectedRects, occupied);
  assert(placed.clear);
  assert(speechIsClear(placed, protectedRects));
  for (const other of occupied) assert(!rectanglesOverlap(placed, other));
  assert(placed.left >= 8 && placed.right <= 836 && placed.top >= 8 && placed.bottom <= 382);
});

test('available edge slots stay clear across changing projected size and heading, including touch portrait', () => {
  const { boat } = workboat(),
    footprints = new SpeechFootprints();
  for (const [width, height, touch] of [
    [1280, 800, false],
    [844, 390, false],
    [390, 844, true],
    [844, 390, true],
  ])
    for (const zoom of [0.4, 1.1, 2.2])
      for (let heading = 0; heading < 8; heading++) {
        const viewport = { width, height },
          preferred = defaultSeaSpeechRect(width, height, touch);
        boat.rotation.y = (heading * Math.PI) / 4;
        const protectedRects = footprints.read(
          { boat, divers: [] },
          { divers: [] },
          cameraFor(width, height, zoom),
          viewport,
        );
        const placed = placeSeaSpeech(
          viewport,
          sizes.filter((s) => s.width <= preferred.width),
          preferred,
          protectedRects,
        );
        assert(placed.clear, `${width}x${height} / zoom ${zoom} / heading ${heading}`);
        assert(speechIsClear(placed, protectedRects));
      }
});

test('closest phone catamaran keeps Ahead and Centre rudder clear using a concise semantic notice only when needed', () => {
  const viewport = { width: 390, height: 844 },
    preferred = defaultSeaSpeechRect(390, 844, true),
    controls = [
      rect(156, 4, 72, 44),
      rect(234, 4, 72, 44),
      rect(312, 8, 72, 44),
      rect(4, 550, 382, 44),
      rect(4, 598, 382, 44),
      rect(61, 650, 80, 74),
      rect(250, 650, 84, 74),
      rect(28, 730, 140, 44),
      rect(250, 730, 80, 44),
    ],
    occupied = [rect(4, 51, 382, 71), rect(4, 780, 382, 60)],
    text = 'Ada · Float to port',
    variants = [
      ...sizes
        .filter((s) => s.width <= 370)
        .map((s) => ({ ...s, text: 'Full recovery and catch status' })),
      { width: 90, height: 175.875 + SPEECH_TAIL, text: 'Full recovery and catch status' },
      { width: 140, height: 30.2 + SPEECH_TAIL, text, compact: true },
    ];
  // Real independently captured mesh bounds. The former120px notice sat at
  // y650 and painted over the Ahead/Centre rudder labels despite hull clearance.
  for (const hull of [rect(120, 150, 149, 449), rect(-8, 157, 404, 429)]) {
    const placed = placeSeaSpeech(viewport, variants, preferred, [hull, ...controls], occupied);
    assert(placed.clear);
    assert.equal(placed.text, text);
    assert.equal(placed.compact, true);
    for (const other of [...controls, ...occupied]) assert(!rectanglesOverlap(placed, other));
  }
  const ordinary = placeSeaSpeech(
    viewport,
    variants,
    preferred,
    [rect(160, 300, 70, 110), ...controls],
    occupied,
  );
  assert(!ordinary.compact, 'full information remains preferred when a clear normal slot exists');
  assert.equal(compactPickupSpeech('Ada', 'BRING FLOAT TO PORT SIDE'), text);
  assert.equal(
    compactPickupSpeech('Milo', 'KEEP FLOAT CLEAR OF THE HULL'),
    'Milo · Clear the hull',
  );
  assert.equal(compactPickupSpeech('Milo', 'OUT OF RANGE'), 'Milo · Come closer');
  assert.equal(compactPickupSpeech('Ada', 'SLOW DOWN'), 'Ada · Slow down');
  assert.equal(
    compactPickupSpeech('Ada', 'SLOW DOWN', 'Low air'),
    '',
    'unique surfaced warnings retain their full wording',
  );
  assert.equal(
    compactPickupSpeech('Ada', 'unknown special warning'),
    '',
    'unknown warnings are never abbreviated',
  );
});

test('loaded compact outboard prefers readable full or concise speech over the captured nine-line strip', () => {
  const viewport = { width: 844, height: 390 },
    protectedRects = [
      rect(323.106, 58.397, 196.329, 235.024),
      rect(344.597, -19.257, 88.103, 270.907),
      rect(438.864, 218.918, 40.265, 38.15),
      rect(510.687, 169.032, 38.638, 41.953),
      rect(8, 282, 176, 108),
      rect(309, 282, 226, 108),
      rect(660, 282, 176, 108),
    ],
    occupied = [rect(8, 104, 176, 132), rect(190, 8, 536, 90)],
    full = 'Ada Chen · RECOVERY UNAVAILABLE — BRING FLOAT TO PORT SIDE · Bag full ·30lb in bag',
    dimensions = [
      { width: 96, height: 143.5 + SPEECH_TAIL, text: full },
      { width: 240, height: 62.563 + SPEECH_TAIL, text: full },
      { width: 140, height: 30.1875 + SPEECH_TAIL, text: 'Ada · Float to port', compact: true },
    ];
  const placed = placeSeaSpeech(
    viewport,
    dimensions,
    defaultSeaSpeechRect(844, 390),
    protectedRects,
    occupied,
  );
  assert(placed.clear);
  assert(
    placed.height <= 100,
    'an already-eligible routine message is readable within its brief lifetime',
  );
  for (const other of occupied) assert(!rectanglesOverlap(placed, other));
  const warning = placeSeaSpeech(
    viewport,
    [dimensions[0]],
    defaultSeaSpeechRect(844, 390),
    protectedRects,
    occupied,
  );
  assert.equal(
    warning.text,
    full,
    'without an eligible concise alternative, complete wording remains available',
  );
});

test('an impossible footprint keeps the notice visible and reports remaining overlap honestly', () => {
  const placed = placeSeaSpeech(
    { width: 390, height: 390 },
    sizes,
    { left: 10, top: 126, width: 370 },
    [rect(0, 0, 390, 390)],
  );
  assert(placed && placed.width > 0 && placed.height > 0);
  assert.equal(placed.clear, false);
});

test('subpixel vessel drift keeps mandatory clearance without searching again every frame', () => {
  const viewport = { width: 844, height: 390 },
    preferred = defaultSeaSpeechRect(844, 390),
    dimensions = [{ width: 180, height: 83.75 }],
    controls = [rect(0, 282, 844, 108)],
    occupied = [rect(8, 104, 176, 132), rect(190, 8, 536, 90)];
  let placed,
    searches = 0;
  for (let frame = 0; frame < 120; frame++) {
    const worldBounds = [rect(219, -40, 404 + frame * 0.05, 429)];
    if (!placed || !speechIsClear(placed, worldBounds)) {
      placed = placeSeaSpeech(
        viewport,
        dimensions,
        preferred,
        [...bufferedSpeechFootprints(worldBounds), ...controls],
        occupied,
      );
      searches++;
    }
    assert(
      speechIsClear(placed, [...worldBounds, ...controls]),
      'all frames retain at least8px clearance',
    );
  }
  assert.equal(searches, 2, 'six pixels of continuous drift should consume the4px buffer once');
});

test('brief notices preserve custom Frank anchoring and expiry, and discard placement after hiding', (t) => {
  const panel = { style: {}, offsetHeight: 46, hidden: false },
    frank = { hidden: false, getBoundingClientRect: () => rect(61, 220, 280, 140) };
  for (const [key, value] of Object.entries({
    innerWidth: 844,
    innerHeight: 390,
    document: { getElementById: (id) => (id === 'seaSpeech' ? panel : frank) },
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() =>
      descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key],
    );
  }
  const ui = { started: true, seaSpeechPlacement: { key: 'previous' } };
  let textWrites = 0,
    text = '';
  Object.defineProperty(panel, 'textContent', {
    get: () => text,
    set: (value) => {
      textWrites++;
      text = value;
    },
  });
  seaMessage(ui, 'pickup', 'ready', 'Ada is at the port ladder.');
  const until = ui.seaMessages.get('pickup').until;
  seaMessage(ui, 'pickup', 'ready', 'Ada is at the port ladder.');
  assert.equal(ui.seaMessages.get('pickup').until, until);
  updateSeaMessages(ui, () => {
    throw new Error('custom Frank must retain its anchor');
  });
  assert.equal(panel.style.left, '201px');
  assert.equal(panel.style.top, '168px');
  assert.equal(panel.style.width, '280px');
  updateSeaMessages(ui);
  assert.equal(textWrites, 1, 'unchanged speech does not replace its text node each render');
  ui.seaMessages.get('pickup').until = performance.now() - 1;
  updateSeaMessages(ui);
  assert.equal(panel.hidden, true);
  assert.equal(ui.seaSpeechPlacement, null);
});
