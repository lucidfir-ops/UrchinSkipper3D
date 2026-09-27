import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boatDefinition, boatSpec } from '../boats.js';
import { workLightsOn } from '../equipment-controls.js';
import { surfaceBlood } from '../sea-cues.js';
import { bubbleOpacity } from '../bubble-visibility.js';
import { visibilityRange } from '../assists.js';
import { departureBoat } from '../departure-transition.js';
import { trafficPose } from '../traffic-view.js';
import { alongsidePoint } from '../patrol.js';
import { CatchLoad, catchNetTexture } from './catch-load.js';

// Presentation only. The existing 2D simulation remains the sole authority for
// position, heading, hull contacts, load, crew states and recovery eligibility.
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_SPHERE = new THREE.SphereGeometry(1, 12, 8);
const UNIT_CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 12);
const SHARED = new Set([UNIT_BOX, UNIT_SPHERE, UNIT_CYLINDER]);
const scratchObject = new THREE.Object3D();

function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}
function box(parent, material, w, h, l, x, y, z, radius = 0) {
  const geometry = radius
    ? new RoundedBoxGeometry(w, h, l, 2, Math.min(radius, w / 3, h / 3, l / 3))
    : UNIT_BOX;
  const item = mesh(parent, geometry, material, x, y, z);
  if (!radius) item.scale.set(w, h, l);
  return item;
}
function sphere(parent, material, radius, x, y, z, scale = null) {
  const item = mesh(parent, UNIT_SPHERE, material, x, y, z);
  item.scale.setScalar(radius);
  if (scale) item.scale.multiply(new THREE.Vector3(...scale));
  return item;
}
function cylinder(parent, material, radius, height, x, y, z) {
  const item = mesh(parent, UNIT_CYLINDER, material, x, y, z);
  item.scale.set(radius, height, radius);
  return item;
}
function rod(parent, material, a, b, radius = 0.035) {
  const p = new THREE.Vector3(...a),
    q = new THREE.Vector3(...b);
  const item = cylinder(parent, material, radius, p.distanceTo(q), 0, 0, 0);
  item.position.copy(p.add(q).multiplyScalar(0.5));
  item.quaternion.setFromUnitVectors(
    UP,
    new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize(),
  );
  return item;
}
function tube(parent, material, points, radius = 0.035, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    closed,
    'centripetal',
  );
  return mesh(
    parent,
    new THREE.TubeGeometry(curve, Math.max(12, points.length * 4), radius, 5, closed),
    material,
  );
}
function ring(parent, material, major, minor, x, y, z) {
  const item = mesh(parent, new THREE.TorusGeometry(major, minor, 8, 28), material, x, y, z);
  item.rotation.x = -Math.PI / 2;
  return item;
}
function labelTexture(text, color = '#183333', background = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, 512, 128);
  }
  context.font = '600 36px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(text.toUpperCase(), 256, 68, 480);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function surfaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#dcded6';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 8719;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(54,64,58,${random() * 0.12})`;
    ctx.fillRect(random() * 256, random() * 256, random() * 2.2, 0.6 + random());
  }
  for (let y = 0; y < 256; y += 10)
    for (let x = 0; x < 256; x += 10) {
      ctx.strokeStyle = 'rgba(255,255,249,0.24)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 4);
      ctx.lineTo(x + 4, y + 1);
      ctx.stroke();
    }
  for (let i = 0; i < 22; i++) {
    const x = random() * 256,
      y = random() * 256,
      radius = 2 + random() * 13;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(91,87,65,0.12)');
    gradient.addColorStop(1, 'rgba(91,87,65,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function makeMaterials() {
  const deckMap = surfaceTexture(),
    netMap = catchNetTexture();
  const standard = (color, roughness = 0.65, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    paint: standard('#e6e6d6', 0.57, 0.18),
    roof: new THREE.MeshStandardMaterial({
      color: '#f3f0df',
      roughness: 0.7,
      metalness: 0.06,
      map: deckMap,
    }),
    hull: standard('#d5dfd7', 0.42, 0.3),
    bottom: standard('#243e3f', 0.7, 0.05),
    blue: standard('#24444e', 0.5, 0.25),
    deck: new THREE.MeshStandardMaterial({
      color: '#879899',
      roughness: 0.92,
      metalness: 0.2,
      map: deckMap,
      bumpMap: deckMap,
      bumpScale: 0.022,
    }),
    metal: standard('#a9b6b0', 0.36, 0.7),
    darkMetal: standard('#4a6263', 0.55, 0.55),
    rubber: standard('#1b292b', 0.92),
    rope: standard('#bba279', 0.95),
    orange: standard('#e97937', 0.47),
    teal: standard('#518782', 0.77),
    glass: new THREE.MeshStandardMaterial({
      color: '#17383f',
      metalness: 0.32,
      roughness: 0.17,
      envMapIntensity: 1.4,
    }),
    red: new THREE.MeshStandardMaterial({
      color: '#ad3c32',
      emissive: '#ff4220',
      emissiveIntensity: 0.45,
    }),
    green: new THREE.MeshStandardMaterial({
      color: '#37745b',
      emissive: '#3bfc93',
      emissiveIntensity: 0.3,
    }),
    lamp: new THREE.MeshStandardMaterial({
      color: '#fff4d0',
      emissive: '#ffdc9a',
      emissiveIntensity: 0.45,
    }),
    suit: standard('#17282b', 0.86),
    tank: standard('#b9c8bc', 0.4, 0.6),
    mask: standard('#538b91', 0.1, 0.42),
    catchNet: new THREE.MeshStandardMaterial({
      color: '#e66f77',
      map: netMap,
      bumpMap: netMap,
      bumpScale: 0.02,
      roughness: 0.94,
    }),
  };
}
function hullOutline(width, length, y = 0, factor = 1) {
  const controls = [
    [0, -0.5],
    [0.19, -0.415],
    [0.365, -0.27],
    [0.475, -0.07],
    [0.5, 0.28],
    [0.485, 0.43],
    [0.38, 0.49],
    [-0.38, 0.49],
    [-0.485, 0.43],
    [-0.5, 0.28],
    [-0.475, -0.07],
    [-0.365, -0.27],
    [-0.19, -0.415],
  ].map(([x, z]) => new THREE.Vector3(x * width * factor, y, z * length * factor));
  return new THREE.CatmullRomCurve3(controls, true, 'centripetal').getPoints(72).slice(0, -1);
}
function hullSurface(width, length, levels) {
  const vertices = [],
    indices = [],
    uv = [];
  const count = 72;
  for (let j = 0; j < levels.length; j++) {
    const [height, factor] = levels[j];
    const points = hullOutline(width, length, height, factor);
    for (let i = 0; i < count; i++) {
      const p = points[i];
      vertices.push(p.x, p.y, p.z);
      uv.push(i / count, j / (levels.length - 1));
    }
  }
  for (let j = 0; j < levels.length - 1; j++)
    for (let i = 0; i < count; i++) {
      const a = j * count + i,
        b = j * count + ((i + 1) % count),
        c = b + count,
        d = a + count;
      indices.push(a, d, b, b, d, c);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function deckShape(width, length, scale = 1) {
  const points = hullOutline(width, length, 0, scale);
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.z)));
  return shape;
}
function mergeStatic(root) {
  // Hundreds of individual fittings become a handful of material batches.
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();
  const materialGroups = new Map(),
    originals = [],
    disposed = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    for (let p = object; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const geometry = object.geometry
      .clone()
      .applyMatrix4(rootInverse.clone().multiply(object.matrixWorld));
    if (!geometry.getAttribute('uv'))
      geometry.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2),
      );
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
    if (nonIndexed !== geometry) geometry.dispose();
    if (!materialGroups.has(object.material)) materialGroups.set(object.material, []);
    materialGroups.get(object.material).push(nonIndexed);
    originals.push(object);
  });
  for (const object of originals) {
    object.removeFromParent();
    if (!SHARED.has(object.geometry) && !disposed.has(object.geometry)) {
      object.geometry.dispose();
      disposed.add(object.geometry);
    }
  }
  for (const [material, geometries] of materialGroups) {
    const geometry = mergeGeometries(geometries);
    for (const source of geometries) source.dispose();
    if (geometry) mesh(root, geometry, material);
  }
}
function makeDiver(materials, deck = false) {
  const group = new THREE.Group();
  const torso = sphere(group, materials.suit, 0.31, 0, 0.88, 0, [0.82, 1.35, 0.66]);
  sphere(group, materials.suit, 0.205, 0, 1.44, -0.035);
  box(group, materials.mask, 0.29, 0.1, 0.055, 0, 1.45, -0.211, 0.025);
  for (const side of [-1, 1]) {
    rod(group, materials.suit, [side * 0.15, 0.66, 0], [side * 0.18, 0.16, 0.045], 0.105);
    rod(group, materials.suit, [side * 0.28, 1.12, 0], [side * 0.36, 0.73, -0.11], 0.085);
    box(group, materials.rubber, 0.17, 0.1, 0.43, side * 0.18, 0.11, -0.11, 0.035);
  }
  cylinder(group, materials.tank, 0.16, 0.59, 0, 0.96, 0.26);
  for (const y of [0.8, 1.12]) ring(group, materials.rubber, 0.162, 0.025, 0, y, 0.26);
  rod(group, materials.rubber, [0.08, 1.25, 0.25], [0.15, 1.32, -0.16], 0.025);
  box(group, materials.orange, 0.48, 0.08, 0.29, 0, 0.7, 0, 0.025);
  // Harness webbing and subdued drysuit panels keep the crew human at close zoom.
  for (const side of [-1, 1]) {
    rod(group, materials.rubber, [side * 0.15, 1.17, -0.18], [side * 0.17, 0.76, -0.21], 0.033);
    sphere(group, materials.darkMetal, 0.1, side * 0.2, 0.43, -0.045, [0.75, 1.25, 0.35]);
    cylinder(group, materials.darkMetal, 0.107, 0.045, side * 0.18, 0.23, 0.04);
    sphere(group, materials.suit, 0.1, side * 0.36, 0.7, -0.13, [0.77, 1, 0.67]);
  }
  box(group, materials.metal, 0.08, 0.07, 0.04, 0.035, 0.72, -0.2, 0.01);
  if (!deck) {
    group.rotation.x = -0.65;
    torso.scale.y *= 0.85;
  }
  mergeStatic(group);
  return group;
}
function makeSurfaceDiver(materials, id = 0) {
  const group = new THREE.Group(),
    swimmer = new THREE.Group();
  // At the surface only a hooded head and shoulders break the water. Reusing
  // the upright deck model here made its silver tank look like a standing body.
  sphere(swimmer, materials.suit, 0.205, 0, 0.19, 0, [1, 0.93, 1]);
  sphere(swimmer, materials.suit, 0.3, 0, 0.015, 0.16, [1.08, 0.26, 0.66]);
  box(swimmer, materials.mask, 0.27, 0.085, 0.038, 0, 0.215, -0.19, 0.018);
  sphere(swimmer, materials.rubber, 0.06, 0, 0.115, -0.17);
  tube(
    swimmer,
    materials.rubber,
    [
      [0.04, 0.115, -0.17],
      [0.21, 0.09, -0.04],
      [0.22, -0.015, 0.23],
    ],
    0.02,
  );
  mergeStatic(swimmer);
  swimmer.position.set(-0.56, 0, 0.02);
  group.add(swimmer);
  const float = new THREE.Group();
  sphere(float, materials.orange, 0.42, 0, 0.04, 0, [1, 0.54, 1]);
  ring(float, materials.roof, 0.29, 0.033, 0, 0.235, 0);
  rod(float, materials.darkMetal, [0, 0.16, 0], [0, 0.96, 0], 0.018);
  box(float, materials.orange, 0.33, 0.22, 0.018, 0.15, 0.81, 0);
  for (let stripe = 0; stripe <= Math.min(1, id); stripe++)
    box(float, materials.roof, 0.023, 0.19, 0.024, 0.08 + stripe * 0.12, 0.81, -0.015);
  tube(
    float,
    materials.rope,
    [
      [0, 0.02, 0],
      [-0.18, -0.02, 0.18],
      [-0.36, 0, 0.19],
      [-0.44, 0.1, 0.13],
    ],
    0.023,
  );
  group.add(float);
  group.visible = false;
  return { group, swimmer, float };
}
function coil(parent, material, x, y, z, size = 0.3) {
  for (let i = 0; i < 4; i++) ring(parent, material, size - i * 0.045, 0.026, x, y + i * 0.009, z);
  tube(
    parent,
    material,
    [
      [x + size, y, z],
      [x + size + 0.11, y, z + 0.16],
      [x + size + 0.13, y, z + 0.42],
    ],
    0.027,
  );
}
function cleat(parent, materials, x, y, z) {
  box(parent, materials.metal, 0.13, 0.05, 0.27, x, y, z, 0.02);
  cylinder(parent, materials.metal, 0.045, 0.16, x, y + 0.08, z);
  box(parent, materials.metal, 0.3, 0.06, 0.075, x, y + 0.16, z, 0.025);
}
function windows(parent, materials, width, cabinZ, cabinLength, cabinTop) {
  const front = cabinZ - cabinLength / 2,
    rear = cabinZ + cabinLength / 2;
  // Gasket, stainless trim, deep glass and individual windshield wipers.
  for (let i = -1; i <= 1; i++) {
    const x = i * width * 0.3;
    const frame = box(
      parent,
      materials.rubber,
      width * 0.277,
      0.78,
      0.08,
      x,
      cabinTop - 0.63,
      front + 0.015,
      0.06,
    );
    frame.rotation.x = -0.12;
    const glass = box(
      parent,
      materials.glass,
      width * 0.245,
      0.68,
      0.09,
      x,
      cabinTop - 0.62,
      front - 0.035,
      0.05,
    );
    glass.rotation.x = -0.12;
    rod(
      parent,
      materials.metal,
      [x - 0.12, cabinTop - 0.93, front - 0.105],
      [x + 0.08, cabinTop - 0.54, front - 0.055],
      0.014,
    );
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const z = cabinZ - cabinLength * 0.2 + i * cabinLength * 0.36;
      box(
        parent,
        materials.rubber,
        0.068,
        0.79,
        cabinLength * 0.29,
        side * (width / 2 + 0.011),
        cabinTop - 0.62,
        z,
        0.035,
      );
      box(
        parent,
        materials.glass,
        0.075,
        0.66,
        cabinLength * 0.256,
        side * (width / 2 + 0.024),
        cabinTop - 0.61,
        z,
        0.025,
      );
    }
    box(
      parent,
      materials.metal,
      0.06,
      0.85,
      0.065,
      side * (width / 2 + 0.09),
      cabinTop - 1.3,
      rear - 0.33,
      0.025,
    );
  }
  box(parent, materials.metal, 0.69, 1.65, 0.07, -0.1, cabinTop - 1.0, rear + 0.022, 0.07);
  box(parent, materials.paint, 0.59, 1.53, 0.075, -0.1, cabinTop - 1.0, rear + 0.065, 0.05);
  box(parent, materials.glass, 0.42, 0.57, 0.025, -0.1, cabinTop - 0.64, rear + 0.11, 0.04);
  box(parent, materials.darkMetal, 0.13, 0.045, 0.04, 0.08, cabinTop - 1.12, rear + 0.14, 0.015);
}

function makeVessel(spec, definition, materials, role = 'player') {
  const group = new THREE.Group(),
    length = spec.length || 10,
    width = spec.width || 4;
  const small = definition.id.startsWith('outboard');
  const premium = definition.id.startsWith('twinjet');
  const taxi = role === 'taxi',
    authority = role === 'dfo';
  const accent = materials.blue.clone();
  accent.color.set(authority ? '#b73c32' : taxi ? '#d9a447' : definition.accent || '#456c67');
  group.userData.ownedMaterial = accent;
  const deckY = 0.88,
    cabinZ = -length * 0.125;
  const cabinLength = length * (taxi ? 0.53 : small ? 0.28 : 0.35);
  const cabinWidth = width * 0.69,
    cabinTop = deckY + (small ? 1.85 : premium ? 2.65 : 2.18);
  mesh(
    group,
    hullSurface(width, length, [
      [-1.25, 0.52],
      [-0.6, 0.8],
      [-0.1, 0.94],
      [0.65, 1],
      [1.02, 0.99],
    ]),
    materials.hull,
  );
  mesh(
    group,
    hullSurface(width, length, [
      [-0.65, 0.8],
      [-0.13, 0.94],
      [0.075, 0.965],
    ]),
    materials.bottom,
  );
  mesh(
    group,
    hullSurface(width * 1.003, length * 1.003, [
      [0.35, 0.978],
      [0.57, 0.994],
    ]),
    accent,
  );
  const deck = mesh(
    group,
    new THREE.ShapeGeometry(deckShape(width, length, 0.965), 36),
    materials.deck,
    0,
    deckY,
    0,
  );
  deck.rotation.x = -Math.PI / 2;
  tube(
    group,
    materials.metal,
    hullOutline(width, length, 1.05, 0.986).map((p) => [p.x, p.y, p.z]),
    0.065,
    true,
  );
  tube(
    group,
    materials.rubber,
    hullOutline(width, length, 0.67, 1.005).map((p) => [p.x, p.y, p.z]),
    0.066,
    true,
  );
  // Thin welded bulwarks, with scuppers along the large working deck.
  for (const side of [-1, 1]) {
    box(
      group,
      materials.hull,
      0.09,
      0.37,
      length * 0.53,
      side * width * 0.477,
      0.88,
      length * 0.15,
      0.025,
    );
    for (let i = 0; i < 4; i++)
      box(
        group,
        materials.darkMetal,
        0.095,
        0.065,
        0.18,
        side * width * 0.49,
        0.72,
        length * (0.09 + i * 0.09),
        0.01,
      );
  }
  // A slight rake and softly bevelled wheelhouse prevent the slab-sided toy look.
  box(
    group,
    materials.paint,
    cabinWidth,
    cabinTop - deckY,
    cabinLength,
    0,
    (deckY + cabinTop) / 2,
    cabinZ,
    0.13,
  );
  windows(group, materials, cabinWidth, cabinZ, cabinLength, cabinTop);
  // Broad roof corners are rounded in plan as on the original aluminium cabin.
  const roofShape = new THREE.Shape(),
    rw = cabinWidth + 0.25,
    rl = cabinLength + 0.3,
    rr = 0.23;
  const x0 = -rw / 2,
    x1 = rw / 2,
    z0 = -rl / 2,
    z1 = rl / 2;
  roofShape.moveTo(x0 + rr, z0);
  roofShape.lineTo(x1 - rr, z0);
  roofShape.quadraticCurveTo(x1, z0, x1, z0 + rr);
  roofShape.lineTo(x1, z1 - rr);
  roofShape.quadraticCurveTo(x1, z1, x1 - rr, z1);
  roofShape.lineTo(x0 + rr, z1);
  roofShape.quadraticCurveTo(x0, z1, x0, z1 - rr);
  roofShape.lineTo(x0, z0 + rr);
  roofShape.quadraticCurveTo(x0, z0, x0 + rr, z0);
  const roofGeometry = new THREE.ExtrudeGeometry(roofShape, {
    depth: 0.115,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.027,
    bevelSegments: 2,
    curveSegments: 6,
  });
  const roof = mesh(group, roofGeometry, materials.roof, 0, cabinTop + 0.02, cabinZ);
  roof.rotation.x = -Math.PI / 2;
  // Roof hatch and handrails follow the supplied working-vessel reference.
  box(
    group,
    materials.metal,
    cabinWidth * 0.31,
    0.065,
    0.57,
    0.12,
    cabinTop + 0.185,
    cabinZ + cabinLength * 0.21,
    0.045,
  );
  box(
    group,
    materials.glass,
    cabinWidth * 0.26,
    0.035,
    0.48,
    0.12,
    cabinTop + 0.225,
    cabinZ + cabinLength * 0.21,
    0.025,
  );
  for (const side of [-1, 1]) {
    const x = side * cabinWidth * 0.4;
    rod(
      group,
      materials.metal,
      [x, cabinTop + 0.15, cabinZ - 0.78],
      [x, cabinTop + 0.33, cabinZ - 0.78],
      0.025,
    );
    rod(
      group,
      materials.metal,
      [x, cabinTop + 0.15, cabinZ + 0.62],
      [x, cabinTop + 0.33, cabinZ + 0.62],
      0.025,
    );
    rod(
      group,
      materials.metal,
      [x, cabinTop + 0.33, cabinZ - 0.78],
      [x, cabinTop + 0.33, cabinZ + 0.62],
      0.025,
    );
  }
  const mastZ = cabinZ - cabinLength * 0.19;
  cylinder(group, materials.metal, 0.06, 1.5, 0, cabinTop + 0.86, mastZ);
  rod(
    group,
    materials.metal,
    [-0.66, cabinTop + 1.05, mastZ],
    [0.66, cabinTop + 1.05, mastZ],
    0.045,
  );
  for (const side of [-1, 1]) {
    cylinder(group, materials.metal, 0.014, 1.22, side * 0.6, cabinTop + 1.46, mastZ);
    cylinder(group, materials.rubber, 0.029, 0.21, side * 0.6, cabinTop + 1.0, mastZ);
    cylinder(
      group,
      side < 0 ? materials.red : materials.green,
      0.095,
      0.12,
      side * (cabinWidth / 2 + 0.11),
      cabinTop + 0.05,
      cabinZ - 0.3,
    );
  }
  cylinder(group, materials.roof, 0.18, 0.18, 0.43, cabinTop + 0.26, cabinZ + 0.31);
  const radar = new THREE.Group();
  radar.position.set(0, cabinTop + 1.26, mastZ);
  radar.userData.dynamic = true;
  box(radar, materials.roof, 1.26, 0.15, 0.19, 0, 0, 0, 0.055);
  cylinder(group, materials.metal, 0.1, 0.2, 0, cabinTop + 1.18, mastZ);
  group.add(radar);
  group.userData.radar = radar;
  box(
    group,
    materials.darkMetal,
    0.26,
    0.2,
    0.15,
    -0.65,
    cabinTop + 0.13,
    cabinZ + cabinLength / 2 + 0.1,
    0.03,
  );
  box(
    group,
    materials.lamp,
    0.18,
    0.11,
    0.04,
    -0.65,
    cabinTop + 0.12,
    cabinZ + cabinLength / 2 + 0.2,
    0.02,
  );
  // Exhaust with cap and realistic slight soot-darkened tip.
  cylinder(
    group,
    materials.darkMetal,
    0.075,
    1.1,
    cabinWidth / 2 + 0.1,
    cabinTop - 0.18,
    cabinZ + 0.46,
  );
  cylinder(
    group,
    materials.rubber,
    0.086,
    0.09,
    cabinWidth / 2 + 0.1,
    cabinTop + 0.4,
    cabinZ + 0.46,
  );
  // Bow pulpit follows the hull rather than approximating it with a rectangle.
  const bowRail = hullOutline(width, length, 1.65, 0.925).filter((p) => p.z < -length * 0.15);
  tube(
    group,
    materials.metal,
    bowRail.map((p) => [p.x, p.y, p.z]),
    0.034,
  );
  for (let i = 0; i < bowRail.length; i += 8)
    rod(
      group,
      materials.metal,
      [bowRail[i].x, 1, bowRail[i].z],
      [bowRail[i].x, 1.65, bowRail[i].z],
      0.028,
    );
  const bowZ = -length * 0.375;
  box(group, materials.metal, 0.19, 0.12, 0.7, 0, 1.03, -length * 0.46, 0.025);
  rod(group, materials.darkMetal, [0, 0.97, -length * 0.37], [0, 1.11, -length * 0.498], 0.035);
  cylinder(group, materials.metal, 0.14, 0.19, 0, 1.14, bowZ);
  rod(group, materials.metal, [-0.25, 1.2, bowZ], [0.25, 1.2, bowZ], 0.1);
  coil(group, materials.rope, -width * 0.17, 0.96, bowZ + 0.26, width * 0.076);
  for (const side of [-1, 1]) {
    cleat(group, materials, side * width * 0.37, 1.09, length * 0.42);
    cleat(group, materials, side * width * 0.3, 1.09, -length * 0.33);
    for (const fz of [-0.19, 0.12, 0.36]) {
      const x = side * width * 0.502,
        z = length * fz;
      const fender = cylinder(group, materials.rubber, 0.14, 0.67, x, 0.7, z);
      fender.rotation.z = side * 0.11;
      sphere(group, materials.rubber, 0.14, x, 1.03, z, [1, 0.5, 1]);
      sphere(group, materials.rubber, 0.14, x, 0.37, z, [1, 0.5, 1]);
      rod(group, materials.rope, [side * width * 0.472, 1.24, z], [x, 0.94, z], 0.016);
    }
    // Waist-high aft safety rails leave the recovery point clear on port.
    const railZ = length * 0.31;
    rod(
      group,
      materials.metal,
      [side * width * 0.46, 1.1, railZ],
      [side * width * 0.46, 1.55, railZ],
      0.027,
    );
    rod(
      group,
      materials.metal,
      [side * width * 0.46, 1.1, length * 0.43],
      [side * width * 0.46, 1.55, length * 0.43],
      0.027,
    );
    rod(
      group,
      materials.metal,
      [side * width * 0.46, 1.55, railZ],
      [side * width * 0.46, 1.55, length * 0.43],
      0.031,
    );
  }
  for (let i = 0; i < 2; i++) {
    const z = length * (0.17 + i * 0.21);
    box(group, materials.darkMetal, width * 0.47, 0.045, length * 0.145, 0, 0.918, z, 0.04);
    box(group, materials.deck, width * 0.45, 0.05, length * 0.136, 0, 0.946, z, 0.04);
    for (const side of [-1, 1])
      box(group, materials.metal, 0.09, 0.025, 0.15, side * width * 0.19, 0.98, z, 0.014);
  }
  // Drainage slots, hatch hinges, fasteners and welded rail feet are physical
  // details; they cast scale cues without adding collision geometry.
  for (const side of [-1, 1]) {
    for (const z of [length * 0.17, length * 0.36]) {
      const x = side * width * 0.372;
      box(group, materials.darkMetal, 0.16, 0.013, 0.58, x, 0.902, z, 0.018);
      for (let j = 0; j < 8; j++)
        box(group, materials.metal, 0.14, 0.019, 0.021, x, 0.917, z - 0.25 + j * 0.07);
    }
    for (const z of [length * 0.31, length * 0.43]) {
      box(group, materials.metal, 0.115, 0.032, 0.13, side * width * 0.46, 1.105, z, 0.014);
      for (const off of [-0.035, 0.035])
        cylinder(group, materials.darkMetal, 0.012, 0.014, side * width * 0.46 + off, 1.129, z);
    }
    for (const z of [length * 0.17, length * 0.38]) {
      cylinder(
        group,
        materials.metal,
        0.021,
        0.16,
        side * width * 0.15,
        0.988,
        z - length * 0.066,
      ).rotation.z = Math.PI / 2;
    }
  }
  // Cylinder rack, two available berths, recovery davit and coiled lines.
  const rackZ = cabinZ + cabinLength / 2 + 0.48;
  for (let i = 0; i < 3; i++) {
    const x = width * 0.3,
      z = rackZ + i * 0.32;
    cylinder(group, materials.tank, 0.115, 0.65, x, 1.22, z);
    sphere(group, materials.tank, 0.112, x, 1.54, z, [1, 0.5, 1]);
    cylinder(group, materials.darkMetal, 0.035, 0.1, x, 1.63, z);
    ring(group, materials.rubber, 0.118, 0.018, x, 1.05, z);
    ring(group, materials.rubber, 0.118, 0.018, x, 1.4, z);
  }
  const dx = -width * 0.38,
    dz = length * 0.1;
  cylinder(group, materials.metal, 0.08, 1.55, dx, 1.68, dz);
  rod(group, materials.metal, [dx, 2.44, dz], [dx - 0.6, 2.6, dz + 0.1], 0.06);
  rod(group, materials.metal, [dx, 1.92, dz], [dx - 0.46, 2.55, dz + 0.08], 0.038);
  rod(group, materials.rope, [dx - 0.6, 2.57, dz + 0.1], [dx - 0.6, 1.26, dz + 0.1], 0.018);
  ring(group, materials.darkMetal, 0.085, 0.02, dx - 0.6, 1.23, dz + 0.1).rotation.x = 0;
  cylinder(group, materials.darkMetal, 0.21, 0.31, dx, 1.3, dz).rotation.z = Math.PI / 2;
  coil(group, materials.rope, -width * 0.27, 0.96, length * 0.31, 0.25);
  // Lifebuoy aft, realistic boarding ladder, and compact outboard/jet packages.
  const lifeRing = ring(
    group,
    materials.orange,
    0.28,
    0.073,
    width * 0.21,
    1.55,
    cabinZ + cabinLength / 2 + 0.14,
  );
  lifeRing.rotation.x = 0;
  for (const x of [-width * 0.27, -width * 0.27 + 0.36])
    rod(group, materials.metal, [x, 1.07, length * 0.493], [x, -0.42, length * 0.54], 0.029);
  for (let i = 0; i < 4; i++)
    rod(
      group,
      materials.metal,
      [-width * 0.27, 0.9 - i * 0.32, length * 0.51],
      [-width * 0.27 + 0.36, 0.9 - i * 0.32, length * 0.51],
      0.026,
    );
  if (small) {
    box(group, materials.darkMetal, 0.57, 0.76, 0.7, 0.25, 0.57, length * 0.52, 0.13);
    box(group, materials.metal, 0.19, 0.8, 0.25, 0.25, -0.08, length * 0.54, 0.045);
    box(group, accent, 0.48, 0.065, 0.58, 0.25, 0.96, length * 0.52, 0.025);
  } else if (definition.id.includes('jet')) {
    for (const x of premium ? [-0.65, 0.65] : [0]) {
      cylinder(group, materials.darkMetal, 0.22, 0.34, x, -0.03, length * 0.51).rotation.x =
        Math.PI / 2;
      box(group, materials.metal, 0.47, 0.35, 0.08, x, 0.03, length * 0.53, 0.055);
    }
  }
  const nameMap = labelTexture(definition.name || 'Urchin Skipper');
  const nameMaterial = new THREE.MeshStandardMaterial({
    map: nameMap,
    transparent: true,
    roughness: 0.8,
    depthWrite: false,
  });
  mesh(group, new THREE.PlaneGeometry(width * 0.72, 0.52), nameMaterial, 0, 0.71, length * 0.498);
  group.userData.nameMaterial = nameMaterial;
  group.userData.deckCrew = [];
  for (let i = 0; i < 2; i++) {
    const diver = makeDiver(materials, true);
    diver.userData.dynamic = true;
    diver.position.set((i ? 1 : -1) * width * 0.4, deckY + 0.02, length * 0.06);
    diver.rotation.y = i ? -0.35 : 0.24;
    group.add(diver);
    group.userData.deckCrew.push(diver);
  }
  const catchGroup = new THREE.Group();
  catchGroup.userData.dynamic = true;
  const bins = [];
  for (let i = 0; i < 6; i++) {
    const bin = new THREE.Group();
    box(bin, i % 2 ? materials.teal : materials.orange, 0.66, 0.4, 0.57, 0, 0.2, 0, 0.045);
    box(bin, materials.darkMetal, 0.59, 0.035, 0.49, 0, 0.414, 0, 0.03);
    bin.position.set(
      ((i % 2) - 0.5) * 0.74,
      deckY + Math.floor(i / 4) * 0.42,
      length * 0.36 - (Math.floor(i / 2) % 2) * 0.65,
    );
    mergeStatic(bin);
    catchGroup.add(bin);
    bins.push(bin);
  }
  group.add(catchGroup);
  group.userData.catchBins = bins;
  // One compact equipment crate stays on the foredeck. Catch is represented
  // exclusively by the recovered red sacks, never by a percentage of crates.
  bins.forEach((bin, i) => {
    bin.visible = i === 0;
  });
  bins[0].position.set(width * 0.12, deckY, -length * 0.36);
  bins[0].scale.setScalar(0.6);
  group.userData.catchLoad = new CatchLoad(group, materials.catchNet, materials.rope);
  mergeStatic(group);
  return group;
}

function foamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  let seed = 619;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < 55; i++) {
    const x = rand() * 56 + 4,
      y = rand() * 56 + 4,
      d = Math.hypot(x - 32, y - 32) / 32;
    if (d > 1) continue;
    ctx.fillStyle = `rgba(241,255,245,${(1 - d) * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + rand() * 6, 0.4 + rand() * 2, rand() * TAU, 0, TAU);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
class WakeField {
  constructor(scene) {
    this.size = 420;
    this.index = 0;
    this.spawnTime = 0;
    this.particles = Array.from({ length: this.size }, () => ({ life: 0 }));
    this.texture = foamTexture();
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      color: '#e9fff7',
    });
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.geometry.rotateX(-Math.PI / 2);
    this.opacities = new THREE.InstancedBufferAttribute(new Float32Array(this.size), 1);
    this.opacities.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('instanceOpacity', this.opacities);
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nattribute float instanceOpacity;\nvarying float vParticleOpacity;',
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvParticleOpacity = instanceOpacity;',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying float vParticleOpacity;',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.a *= vParticleOpacity;',
      );
    };
    this.material.customProgramCacheKey = () => 'vessel-foam-opacity-v1';
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.size);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }
  emit(x, z, size, vx, vz, life, spread = 0, bubble = false) {
    const p = this.particles[this.index++ % this.size];
    Object.assign(p, {
      x,
      z,
      size,
      vx,
      vz,
      life,
      maxLife: life,
      spread,
      bubble,
      spin: this.index * 2.39996,
    });
  }
  boat(actor, width, length, dt) {
    const speed = Math.abs(actor.speed ?? Math.hypot(actor.vx || 0, actor.vy || 0));
    if (speed < 0.3) return;
    const forwardX = Math.sin(actor.heading),
      forwardZ = -Math.cos(actor.heading);
    const lateralX = Math.cos(actor.heading),
      lateralZ = Math.sin(actor.heading);
    const sternX = actor.x - forwardX * length * 0.46,
      sternZ = actor.y - forwardZ * length * 0.46;
    const energy = Math.min(1, speed / 5);
    for (const side of [-1, 1]) {
      const lane = side * width * 0.3;
      this.emit(
        sternX + lateralX * lane,
        sternZ + lateralZ * lane,
        width * (0.5 + energy * 0.25),
        lateralX * side * 0.19 - forwardX * 0.1,
        lateralZ * side * 0.19 - forwardZ * 0.1,
        5.5,
        0.3,
      );
      // The thin outward bow curls remain tied to actual motion.
      this.emit(
        actor.x + forwardX * length * 0.22 + lateralX * side * width * 0.44,
        actor.y + forwardZ * length * 0.22 + lateralZ * side * width * 0.44,
        width * 0.21,
        lateralX * side * 0.36 - forwardX * 0.22,
        lateralZ * side * 0.36 - forwardZ * 0.22,
        2.0,
        0.15,
      );
    }
  }
  poweredWash(actor, spec) {
    if ((actor.fuel ?? 1) <= 0 || (actor.driveHealth ?? 1) <= 0) return;
    const fx = Math.sin(actor.heading),
      fz = -Math.cos(actor.heading);
    const lx = Math.cos(actor.heading),
      lz = Math.sin(actor.heading);
    const sternX = actor.x - fx * spec.length * 0.49,
      sternZ = actor.y - fz * spec.length * 0.49;
    if (spec.bowThrusterStrength && Math.abs(actor.thruster || 0) > 0.05) {
      const side = -Math.sign(actor.thruster),
        lateral = side * spec.width * 0.42;
      this.emit(
        actor.x + fx * spec.length * 0.3 + lx * lateral,
        actor.y + fz * spec.length * 0.3 + lz * lateral,
        0.55 + Math.abs(actor.thruster) * 0.6,
        lx * side * 0.9,
        lz * side * 0.9,
        2.3,
        0.35,
      );
    }
    if (spec.jetCount && Math.abs(actor.pivot || 0) > 0.05) {
      const side = Math.sign(actor.pivot);
      for (const lane of spec.jetCount === 2 ? [-1, 1] : [0]) {
        const lateral = lane * spec.width * 0.22;
        const vx = spec.jetCount === 2 ? fx * side * lane : lx * side;
        const vz = spec.jetCount === 2 ? fz * side * lane : lz * side;
        this.emit(
          sternX + lx * lateral,
          sternZ + lz * lateral,
          0.6 + Math.abs(actor.pivot) * 0.45,
          vx * 1.1,
          vz * 1.1,
          2.8,
          0.4,
        );
      }
    } else if (Math.abs(actor.throttle || 0) > 0.05) {
      const direction = -Math.sign(actor.throttle),
        power = Math.abs(actor.throttle);
      this.emit(
        sternX,
        sternZ,
        spec.width * (0.25 + power * 0.35),
        fx * direction * (0.4 + power),
        fz * direction * (0.4 + power),
        2.6,
        0.3,
      );
    }
  }
  update(dt, surfaceY = 0, world = null) {
    const range = world ? visibilityRange(world) : Infinity;
    for (let i = 0; i < this.size; i++) {
      const p = this.particles[i];
      p.life -= dt;
      const distance = world ? Math.hypot(p.x - world.boat.x, p.z - world.boat.y) : 0;
      const visibility =
        world && p.bubble ? bubbleOpacity(world, distance) : distance < range ? 1 : 0;
      this.opacities.setX(i, p.life > 0 ? visibility * Math.min(1, p.life / 1.2) : 0);
      if (p.life <= 0) {
        scratchObject.scale.setScalar(0);
      } else {
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        const age = p.maxLife - p.life,
          fade = Math.min(1, p.life / 1.5);
        const size = (p.size + age * p.spread) * Math.sqrt(fade);
        scratchObject.position.set(p.x, surfaceY + 0.075 + i * 0.00003, p.z);
        scratchObject.rotation.set(0, p.spin, 0);
        scratchObject.scale.set(size, 1, size * 0.7);
      }
      scratchObject.updateMatrix();
      this.mesh.setMatrixAt(i, scratchObject.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.opacities.needsUpdate = true;
  }
  reset() {
    for (const p of this.particles) p.life = 0;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
function radialTexture(color, irregular = true) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 62);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.36, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  if (irregular) {
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * TAU,
        radius = 55 * (1 + Math.sin(angle * 3) * 0.08 + Math.cos(angle * 5) * 0.06);
      const x = 64 + Math.cos(angle) * radius,
        y = 64 + Math.sin(angle) * radius;
      if (!i) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
class SurfaceCues {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.bloodTexture = radialTexture('#ae1420');
    this.siltTexture = radialTexture('#aa9d72');
    this.pools = [];
    for (let i = 0; i < 4; i++) {
      const material = new THREE.MeshBasicMaterial({
        map: this.bloodTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const pool = mesh(this.group, new THREE.PlaneGeometry(1, 1), material);
      pool.rotation.x = -Math.PI / 2;
      pool.castShadow = pool.receiveShadow = false;
      pool.renderOrder = 2;
      this.pools.push(pool);
    }
    this.silt = mesh(
      this.group,
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: this.siltTexture,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    this.silt.rotation.x = -Math.PI / 2;
    this.silt.castShadow = false;
    this.silt.receiveShadow = false;
    this.silt.renderOrder = 1;
    this.sheen = [];
    for (let i = 0; i < 4; i++) {
      const sheen = mesh(
        this.group,
        new THREE.RingGeometry(0.8, 1, 40),
        new THREE.MeshBasicMaterial({
          color: ['#656578', '#946c93', '#6a9385', '#557d91'][i],
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
        }),
      );
      sheen.rotation.x = -Math.PI / 2;
      sheen.castShadow = sheen.receiveShadow = false;
      sheen.renderOrder = 2;
      this.sheen.push(sheen);
    }
  }
  update(world, spec, surfaceY) {
    const pools = surfaceBlood(world);
    this.pools.forEach((mesh, i) => {
      const p = pools[i];
      mesh.visible = !!p;
      if (!p) return;
      mesh.position.set(p.x, surfaceY + 0.085, p.y);
      mesh.scale.set(p.radius * 2.6, p.radius * 1.95, 1);
      mesh.material.opacity = p.alpha;
    });
    const b = world.boat,
      sin = Math.sin(b.heading),
      cos = Math.cos(b.heading);
    this.silt.visible = !!b.grounded;
    this.silt.position.set(
      b.x - sin * spec.length * 0.2,
      surfaceY + 0.025,
      b.y + cos * spec.length * 0.2,
    );
    const pulse = 0.5 + 0.5 * Math.sin(world.time * 0.6);
    this.silt.scale.set(spec.width + 4 + pulse * 4, spec.width + 3 + pulse * 3, 1);
    this.silt.material.opacity = 0.12 + pulse * 0.1;
    this.sheen.forEach((mesh, i) => {
      mesh.visible = b.hullHealth < 0.65 || b.driveHealth < 0.5;
      const behind = spec.length * 0.5 + i * 1.8;
      mesh.position.set(b.x - sin * behind, surfaceY + 0.04, b.y + cos * behind);
      mesh.scale.set(1.5 + i * 0.5, 0.6 + i * 0.15, 1);
      mesh.rotation.z = b.heading + Math.sin(world.time * 0.2 + i) * 0.25;
    });
  }
  reset() {
    this.group.traverse((o) => {
      if (o.isMesh) o.visible = false;
    });
  }
  dispose() {
    this.group.traverse((o) => {
      if (o.material) o.material.dispose();
    });
    disposeGroup(this.group);
    this.bloodTexture.dispose();
    this.siltTexture.dispose();
  }
}
function prepareDepartureFade(group) {
  const clones = new Map();
  group.traverse((object) => {
    if (!object.isMesh) return;
    if (!clones.has(object.material)) clones.set(object.material, object.material.clone());
    object.material = clones.get(object.material);
  });
  group.userData.fadeMaterials = [...clones.values()].map((material) => ({
    material,
    opacity: material.opacity,
    transparent: material.transparent,
  }));
}
function setDepartureAlpha(group, alpha) {
  group.visible = alpha > 0.001;
  group.userData.alpha = alpha;
  for (const entry of group.userData.fadeMaterials || []) {
    const transparent = entry.transparent || alpha < 0.999;
    if (entry.material.transparent !== transparent) {
      entry.material.transparent = transparent;
      entry.material.needsUpdate = true;
    }
    entry.material.opacity = entry.opacity * alpha;
  }
}
function disposeGroup(group) {
  const geometries = new Set();
  group.traverse((object) => {
    if (object.geometry && !SHARED.has(object.geometry)) geometries.add(object.geometry);
    if (object.isInstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const entry of group.userData.fadeMaterials || []) entry.material.dispose();
  group.userData.ownedMaterial?.dispose();
  if (group.userData.nameMaterial) {
    group.userData.nameMaterial.map.dispose();
    group.userData.nameMaterial.dispose();
  }
  group.removeFromParent();
}

export class VesselView {
  constructor(scene) {
    this.scene = scene;
    this.materials = makeMaterials();
    this.boat = null;
    this.identity = '';
    this.traffic = new Map();
    this.divers = [];
    this.elapsed = 0;
    this.wakeAccumulator = 0;
    this.wakes = new WakeField(scene);
    this.surfaceCues = new SurfaceCues(scene);
    this.lightRig = new THREE.Group();
    const lightTexture = radialTexture('#ffedba', false);
    this.lightTexture = lightTexture;
    this.lightPatches = [];
    for (const [x, z, width, length] of [
      [0, -13, 12, 26],
      [-7, 1, 16, 12],
    ]) {
      const material = new THREE.MeshBasicMaterial({
        color: '#ffe5ad',
        map: lightTexture,
        transparent: true,
        opacity: 0.23,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const plane = mesh(
        this.lightRig,
        new THREE.PlaneGeometry(width, length),
        material,
        x,
        0.11,
        z,
      );
      plane.rotation.x = -Math.PI / 2;
      plane.castShadow = false;
      plane.receiveShadow = false;
      plane.renderOrder = 4;
      this.lightPatches.push(plane);
    }
    this.workSpots = [];
    for (const [x, z, tx, tz, angle] of [
      [0, -2, 0, -18, 0.55],
      [-1.1, 0, -8, 1, 0.8],
    ]) {
      const light = new THREE.SpotLight('#ffe9b2', 0, 40, angle, 0.9, 1.3);
      light.position.set(x, 3.2, z);
      light.target.position.set(tx, 0, tz);
      this.lightRig.add(light, light.target);
      this.workSpots.push(light);
    }
    scene.add(this.lightRig);
    this.rivalDivers = new Map();
    for (let i = 0; i < 2; i++) {
      const visual = makeSurfaceDiver(this.materials, i);
      scene.add(visual.group);
      this.divers.push(visual);
    }
  }
  update(world, dt = 1 / 60) {
    dt = Math.min(0.1, Math.max(0, dt));
    this.elapsed += dt;
    const boat = departureBoat(world),
      spec = boatSpec(world),
      range = visibilityRange(world);
    const identity = `${boat.configuration}:${spec.length}:${spec.width}`;
    if (!this.boat || this.identity !== identity) {
      if (this.boat) disposeGroup(this.boat);
      this.boat = makeVessel(spec, boatDefinition(boat.configuration), this.materials);
      prepareDepartureFade(this.boat);
      this.scene.add(this.boat);
      this.identity = identity;
    }
    const surfaceY = this.surfaceY || 0;
    const wave = Math.min(1, world.environment?.waveHeight ?? world.environment?.waves ?? 0.3);
    this.position(this.boat, boat, surfaceY, wave);
    setDepartureAlpha(this.boat, boat.alpha);
    this.boat.userData.radar.rotation.y = this.elapsed * 1.1;
    for (let i = 0; i < 2; i++) {
      const d = world.divers[i],
        crew = this.boat.userData.deckCrew[i],
        visual = this.divers[i];
      crew.visible = !!d && d.state === 'ready';
      crew.rotation.x = Math.sin(this.elapsed * 0.7 + i) * 0.022;
      visual.group.visible =
        !!d && Math.hypot(d.x - boat.x, d.y - boat.y) <= range && d.state === 'surface';
      if (visual.group.visible) {
        visual.group.position.set(d.x, surfaceY + Math.sin(this.elapsed * 1.8 + i) * 0.065, d.y);
        visual.group.rotation.y = d.direction || 0;
        visual.float.visible = d.state === 'surface';
        visual.swimmer.rotation.z = Math.sin(this.elapsed * 1.5 + i) * 0.035;
      }
    }
    this.boat.userData.catchLoad.update(world.bags || [], spec);
    this.markers = this.boat.userData.catchLoad.markers;
    const active = new Set(),
      activeRivalDivers = new Set();
    for (const actor of world.traffic?.actors || []) {
      if (actor.done || !Number.isFinite(actor.x)) continue;
      active.add(actor.id);
      let visual = this.traffic.get(actor.id);
      if (!visual) {
        const id = actor.kind === 'taxi' ? 'outboard' : actor.kind === 'dfo' ? 'twinjet' : 'basic';
        visual = makeVessel(
          { length: actor.length, width: actor.width },
          {
            ...boatDefinition(id),
            name:
              actor.name ||
              (actor.kind === 'taxi'
                ? 'Coastal Express'
                : actor.kind === 'dfo'
                  ? 'Fisheries Patrol'
                  : 'Pacific Runner'),
          },
          this.materials,
          actor.kind,
        );
        visual.userData.deckCrew.forEach((c) => {
          c.visible = false;
        });
        visual.userData.catchBins.forEach((c) => {
          c.visible = false;
        });
        this.scene.add(visual);
        this.traffic.set(actor.id, visual);
      }
      const pose =
        ['inspection', 'departing'].includes(actor.phase) &&
        actor.target === 'player' &&
        ['boarding', 'departing'].includes(world.day.inspection?.status)
          ? { ...alongsidePoint(world, actor), heading: world.boat.heading }
          : trafficPose(actor, world.traffic.accumulator);
      this.position(visual, pose, surfaceY, wave);
      visual.visible = Math.hypot(actor.x - world.boat.x, actor.y - world.boat.y) <= range;
      visual.userData.radar.rotation.y = this.elapsed * 0.8;
      visual.userData.catchLoad.update(
        Array.from({ length: Math.min(18, Math.max(0, actor.deckBags || 0)) }),
        {
          length: actor.length,
          width: actor.width,
        },
      );
      for (const [index, diver] of (actor.divers || []).entries()) {
        const key = `${actor.id}:${index}`;
        activeRivalDivers.add(key);
        let marker = this.rivalDivers.get(key);
        if (!marker) {
          marker = makeSurfaceDiver(this.materials, index);
          this.scene.add(marker.group);
          this.rivalDivers.set(key, marker);
        }
        marker.group.visible =
          !diver.underwater && Math.hypot(diver.x - world.boat.x, diver.y - world.boat.y) <= range;
        marker.group.position.set(
          diver.x,
          surfaceY + Math.sin(this.elapsed * 1.8 + index) * 0.06,
          diver.y,
        );
        marker.group.rotation.y = actor.heading;
      }
    }
    for (const [id, visual] of this.traffic)
      if (!active.has(id)) {
        disposeGroup(visual);
        this.traffic.delete(id);
      }
    for (const [id, marker] of this.rivalDivers)
      if (!activeRivalDivers.has(id)) {
        disposeGroup(marker.group);
        this.rivalDivers.delete(id);
      }
    this.wakeAccumulator += dt;
    if (this.wakeAccumulator > 0.12) {
      if (boat.alpha > 0.01) {
        this.wakes.boat(boat, spec.width, spec.length, this.wakeAccumulator);
        this.wakes.poweredWash(boat, spec);
      }
      for (const actor of world.traffic?.actors || [])
        this.wakes.boat(actor, actor.width || 3, actor.length || 9, this.wakeAccumulator);
      for (let i = 0; i < world.divers.length; i++) {
        const d = world.divers[i];
        if (
          ['deploying', 'searching', 'harvesting', 'surfacing'].includes(d.state) &&
          bubbleOpacity(world, Math.hypot(d.x - boat.x, d.y - boat.y)) > 0
        ) {
          const surfacing = d.state === 'surfacing',
            radius = surfacing ? 2.4 : 0.5;
          for (let j = 0; j < (surfacing ? 5 : 2); j++) {
            const angle = this.elapsed * 7 + i * 3 + j * 2.4;
            this.wakes.emit(
              d.x + Math.cos(angle) * radius,
              d.y + Math.sin(angle) * radius,
              0.7,
              Math.cos(angle) * 0.06,
              Math.sin(angle) * 0.06,
              1.8,
              0.16,
              true,
            );
          }
        }
      }
      for (const actor of world.traffic?.actors || [])
        for (const [i, d] of (actor.divers || []).entries()) {
          if (!d.underwater || bubbleOpacity(world, Math.hypot(d.x - boat.x, d.y - boat.y)) <= 0)
            continue;
          const angle = this.elapsed * 5 + i * 3;
          this.wakes.emit(
            d.x + Math.cos(angle) * 0.5,
            d.y + Math.sin(angle) * 0.5,
            0.75,
            0.03,
            0.02,
            1.8,
            0.16,
            true,
          );
        }
      this.wakeAccumulator = 0;
    }
    this.wakes.update(dt, surfaceY, world);
    this.surfaceCues.update(world, spec, surfaceY);
    const lights = workLightsOn(world) && boat.alpha > 0.01;
    this.lightRig.position.set(boat.x, surfaceY, boat.y);
    this.lightRig.rotation.y = -boat.heading;
    for (const patch of this.lightPatches) patch.visible = lights;
    this.workSpots.forEach((light) => {
      light.intensity = lights ? 80 * boat.alpha : 0;
    });
  }
  effect(event, world) {
    if (!event || !world) return;
    const x = event.x ?? world.boat.x,
      z = event.y ?? world.boat.y;
    if (['splash', 'surface', 'impact', 'grounding', 'overflow'].includes(event.type)) {
      const count = event.type === 'impact' ? 18 : 10;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * TAU;
        this.wakes.emit(
          x + Math.cos(angle) * 0.25,
          z + Math.sin(angle) * 0.25,
          0.8,
          Math.cos(angle) * 0.5,
          Math.sin(angle) * 0.5,
          2.3,
          0.3,
        );
      }
    }
  }
  position(visual, actor, surfaceY, wave) {
    const phase = actor.x * 0.017 + actor.y * 0.009;
    const bob = Math.sin(this.elapsed * 1.5 + phase) * (0.035 + wave * 0.055);
    visual.position.set(actor.x, surfaceY + bob, actor.y);
    visual.rotation.set(
      Math.sin(this.elapsed * 1.27 + phase) * (0.004 + wave * 0.009),
      -actor.heading,
      Math.sin(this.elapsed * 1.72 + phase) * (0.006 + wave * 0.012),
    );
  }
  reset() {
    if (this.boat) {
      disposeGroup(this.boat);
      this.boat = null;
    }
    for (const visual of this.traffic.values()) disposeGroup(visual);
    this.traffic.clear();
    for (const marker of this.rivalDivers.values()) disposeGroup(marker.group);
    this.rivalDivers.clear();
    this.wakes.reset();
    this.surfaceCues.reset();
    this.identity = '';
    for (const d of this.divers) d.group.visible = false;
  }
  dispose() {
    this.reset();
    this.wakes.dispose();
    this.surfaceCues.dispose();
    for (const patch of this.lightPatches) patch.material.dispose();
    disposeGroup(this.lightRig);
    this.lightTexture.dispose();
    for (const d of this.divers) disposeGroup(d.group);
    const textures = new Set();
    for (const material of Object.values(this.materials)) {
      if (material.map) textures.add(material.map);
      material.dispose();
    }
    for (const texture of textures) texture.dispose();
  }
}
