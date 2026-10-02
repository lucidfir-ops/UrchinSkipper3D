import { DiverTorch } from './diver-torch.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boatDefinition, boatSpec } from '../boats.js';
import { workLightsOn, workLightStrength, enabledEquipment } from '../equipment-controls.js';
import { surfaceBlood } from '../sea-cues.js';
import { bubbleOpacity } from '../bubble-visibility.js';
import { currentAt } from '../environment.js';
import { visibilityRange } from '../assists.js';
import { departureBoat } from '../departure-transition.js';
import { trafficPose } from '../traffic-view.js';
import { alongsidePoint } from '../patrol.js';
import { CatchLoad, catchNetTexture } from './catch-load.js';
import { fleetProfile } from './fleet-profiles.js';
import { trafficProfile } from './traffic-profiles.js';
import { waterColumnMaterials, waterTurbidity, submergedContrast } from './water-optics.js';
import { diverMotion } from '../diver-motion.js';

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
export function makeMaterials() {
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
    tank: standard('#dedfcd', 0.52, 0.22),
    diveTrim: standard('#d3c54c', 0.72),
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
function hullOutline(width, length, y = 0, factor = 1, form = 'alloy') {
  const controls = (
    form === 'landing'
      ? [
          [0, -0.5],
          [0.4, -0.5],
          [0.48, -0.42],
          [0.5, -0.2],
          [0.5, 0.3],
          [0.48, 0.46],
          [0.38, 0.49],
          [-0.38, 0.49],
          [-0.48, 0.46],
          [-0.5, 0.3],
          [-0.5, -0.2],
          [-0.48, -0.42],
          [-0.4, -0.5],
        ]
      : form === 'tug'
        ? [
            [0, -0.5],
            [0.3, -0.46],
            [0.45, -0.34],
            [0.5, -0.15],
            [0.5, 0.3],
            [0.46, 0.46],
            [0.36, 0.49],
            [-0.36, 0.49],
            [-0.46, 0.46],
            [-0.5, 0.3],
            [-0.5, -0.15],
            [-0.45, -0.34],
            [-0.3, -0.46],
          ]
        : [
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
          ]
  ).map(([x, z]) => new THREE.Vector3(x * width * factor, y, z * length * factor));
  return new THREE.CatmullRomCurve3(controls, true, 'centripetal').getPoints(72).slice(0, -1);
}
function hullSurface(width, length, levels, form) {
  const vertices = [],
    indices = [],
    uv = [];
  const count = 72;
  for (let j = 0; j < levels.length; j++) {
    const [height, factor] = levels[j];
    const points = hullOutline(width, length, height, factor, form);
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
function deckShape(width, length, scale = 1, form) {
  const points = hullOutline(width, length, 0, scale, form);
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
  group.userData.limbs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(),
      arm = new THREE.Group();
    leg.userData.dynamic = arm.userData.dynamic = true;
    leg.position.set(side * 0.15, 0.66, 0);
    arm.position.set(side * 0.28, 1.12, 0);
    // Safety-yellow shoulder panels retain a small, plausible silhouette in
    // the first metres of green water without enlarging the person or glowing.
    sphere(arm, materials.diveTrim, 0.12, side * 0.025, -0.015, 0, [0.85, 0.65, 1]);
    rod(leg, materials.suit, [0, 0, 0], [side * 0.03, -0.5, 0.045], 0.105);
    box(leg, materials.rubber, 0.17, 0.1, 0.43, side * 0.03, -0.55, -0.11, 0.035);
    rod(arm, materials.suit, [0, 0, 0], [side * 0.08, -0.39, -0.11], 0.085);
    group.add(leg, arm);
    group.userData.limbs.push({ leg, arm, side });
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
  const body = makeDiver(materials, true);
  body.traverse((o) => {
    if (o.isMesh) {
      o.renderOrder = 2;
      o.castShadow = false;
    }
  });
  group.add(body);
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
  const liftBag = sphere(group, materials.catchNet, 0.38, 0.58, -0.38, 0, [1, 0.9, 1]);
  liftBag.renderOrder = 2;
  liftBag.castShadow = false;
  const liftLine = cylinder(group, materials.rope, 0.016, 1, 0.58, 0.05, 0);
  liftLine.renderOrder = 2;
  liftLine.castShadow = false;
  liftBag.visible = liftLine.visible = false;
  group.visible = false;
  return {
    group,
    swimmer,
    float,
    body,
    liftBag,
    liftLine,
    ropeEnd: new THREE.Vector3(),
    ropeDirection: new THREE.Vector3(),
  };
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

function canopy(parent, materials, width, length, height, z) {
  const geometry = new THREE.PlaneGeometry(width, length, 8, 2);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++)
    position.setY(i, height + Math.cos((position.getX(i) / width) * Math.PI) * 0.28);
  geometry.computeVertexNormals();
  mesh(parent, geometry, materials, 0, 0, z);
}

function addTrafficDetails(group, spec, materials, profile, accent) {
  const { width, length } = spec;
  if (profile.canopy) {
    canopy(group, accent, width * 0.72, length * 0.24, 2.02, length * 0.28);
    for (const side of [-1, 1])
      for (const z of [length * 0.18, length * 0.38])
        rod(
          group,
          materials.metal,
          [side * width * 0.35, 0.95, z],
          [side * width * 0.35, 2.05, z],
          0.035,
        );
  }
  if (profile.landingPad) {
    box(group, materials.teal, width * 0.71, 0.035, length * 0.25, 0, 0.97, length * 0.3, 0.04);
    ring(group, materials.rope, width * 0.29, 0.025, 0, 1.0, length * 0.3);
    for (const x of [-0.22, 0.22])
      box(group, materials.roof, 0.08, 0.017, 0.55, x, 1.025, length * 0.3);
    box(group, materials.roof, 0.46, 0.017, 0.08, 0, 1.025, length * 0.3);
  }
  if (profile.sailingRig) {
    rod(group, materials.metal, [0, 0.95, -length * 0.08], [0, 7.2, -length * 0.08], 0.045);
    rod(group, materials.metal, [0, 3, -length * 0.08], [0, 3, length * 0.24], 0.035);
    for (const side of [-1, 1])
      rod(
        group,
        materials.rope,
        [side * width * 0.43, 1, length * 0.12],
        [0, 6.9, -length * 0.08],
        0.015,
      );
    rod(group, materials.rope, [0, 7.1, -length * 0.08], [0, 1.15, -length * 0.45], 0.016);
    // Furled blue sail keeps the original mast and rig readable from above.
    box(group, accent, 0.2, 0.22, length * 0.3, 0, 3.05, length * 0.08, 0.055);
  }
  if (profile.outriggers) {
    for (const side of [-1, 1]) {
      sphere(group, materials.metal, 0.8, side * width * 0.48, 0.5, length * 0.2, [0.4, 0.7, 2.9]);
      box(group, accent, 0.24, 0.12, length * 0.27, side * width * 0.49, 0.98, length * 0.2, 0.04);
    }
    cylinder(group, materials.mask, 0.3, 0.14, 0, 1.02, length * 0.3);
  }
  if (profile.machinery) {
    for (const x of [-width * 0.27, width * 0.27]) {
      cylinder(group, materials.darkMetal, 0.23, 1.2, x, 1.52, length * 0.23);
      ring(group, accent, 0.24, 0.06, x, 2.14, length * 0.23);
    }
    ring(group, accent, width * 0.24, 0.095, 0, 3.94, -length * 0.15);
    sphere(group, materials.darkMetal, 0.4, 0, 3.88, -length * 0.15, [1, 0.5, 1]);
  }
}

function makeOpenVessel(spec, definition, materials, profile) {
  const { width, length } = spec,
    group = new THREE.Group(),
    accent = materials.blue.clone();
  accent.color.set(profile.trim);
  group.userData.ownedMaterial = accent;
  group.userData.profile = { id: definition.id, ...profile };
  mesh(
    group,
    hullSurface(width, length, [
      [-0.8, 0.57],
      [-0.1, 0.9],
      [0.6, 1],
      [1.03, 0.94],
    ]),
    profile.oars ? materials.rope : materials.darkMetal,
  );
  const deck = mesh(
    group,
    new THREE.ShapeGeometry(deckShape(width, length, 0.91), 36),
    profile.oars ? materials.rope : materials.deck,
    0,
    0.88,
    0,
  );
  deck.rotation.x = -Math.PI / 2;
  tube(
    group,
    profile.oars ? accent : materials.rubber,
    hullOutline(width, length, 1.02, 0.94).map((p) => [p.x, p.y, p.z]),
    profile.oars ? 0.07 : width * 0.085,
    true,
  );
  if (profile.oars) {
    for (const z of [-length * 0.27, length * 0.31])
      canopy(group, accent, width * 0.85, length * 0.22, 2.05, z);
    for (const side of [-1, 1])
      for (let i = 0; i < 9; i++) {
        const z = length * (-0.2 + i * 0.052);
        rod(
          group,
          materials.rope,
          [side * width * 0.37, 1, z],
          [side * width * 0.78, 0.45, z + length * 0.06],
          0.035,
        );
        box(
          group,
          materials.rope,
          0.34,
          0.055,
          0.11,
          side * width * 0.76,
          0.47,
          z + length * 0.06,
          0.02,
        );
        rod(group, accent, [side * width * 0.38, 0.9, z], [side * width * 0.38, 1.3, z], 0.025);
      }
    for (const end of [-1, 1]) {
      rod(
        group,
        materials.rope,
        [0, 0.9, end * length * 0.46],
        [0, 1.75, end * length * 0.49],
        0.09,
      );
      ring(group, materials.rope, 0.18, 0.045, 0, 1.8, end * length * 0.47).rotation.x = 0;
    }
  } else {
    box(group, materials.roof, width * 0.35, 0.77, length * 0.18, 0, 1.22, -length * 0.12, 0.11);
    box(group, materials.glass, width * 0.34, 0.45, 0.06, 0, 1.83, -length * 0.2, 0.045);
    for (const side of [-1, 1]) {
      box(
        group,
        materials.darkMetal,
        0.55,
        0.58,
        0.65,
        side * width * 0.19,
        0.62,
        length * 0.52,
        0.12,
      );
      box(group, materials.metal, 0.13, 0.7, 0.18, side * width * 0.19, -0.01, length * 0.54, 0.03);
      for (const z of [length * 0.06, length * 0.24])
        box(group, materials.rubber, 0.42, 0.4, 0.48, side * width * 0.19, 1.07, z, 0.07);
    }
    rod(
      group,
      materials.metal,
      [-width * 0.32, 0.9, length * 0.37],
      [-width * 0.32, 2.0, length * 0.37],
      0.04,
    );
    rod(
      group,
      materials.metal,
      [-width * 0.32, 2.0, length * 0.37],
      [width * 0.32, 2.0, length * 0.37],
      0.04,
    );
    rod(
      group,
      materials.metal,
      [width * 0.32, 2.0, length * 0.37],
      [width * 0.32, 0.9, length * 0.37],
      0.04,
    );
  }
  group.userData.radar = new THREE.Group();
  group.add(group.userData.radar);
  group.userData.deckCrew = [];
  group.userData.catchBins = [];
  group.userData.catchLoad = new CatchLoad(group, materials.catchNet, materials.rope);
  mergeStatic(group);
  return group;
}

function propeller(parent, m, x, y, z) {
  const hub = new THREE.Group();
  hub.userData.dynamic = true;
  hub.position.set(x, y, z);
  parent.add(hub);
  sphere(hub, m.metal, 0.09, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    const angle = (i * TAU) / 3;
    const blade = box(
      hub,
      m.metal,
      0.12,
      0.3,
      0.035,
      Math.sin(angle) * 0.15,
      Math.cos(angle) * 0.15,
      0,
      0.02,
    );
    blade.rotation.z = -angle;
  }
  return hub;
}
export function animateDrives(vessel, rudder = 0, throttle = 0, dt = 0) {
  for (const drive of vessel.userData.drives || []) {
    // Bow is -Z. Starboard helm sends the stern thrust to port (-X),
    // so the aft end of an outboard/leg/nozzle swings to starboard (+X).
    drive.rotation.y = Math.max(-1, Math.min(1, rudder)) * 0.58;
    if (drive.userData.propeller) drive.userData.propeller.rotation.z += throttle * dt * 34;
  }
}
function addCareerDetails(group, spec, m, p, accent) {
  const w = spec.width,
    l = spec.length,
    { cabinZ, cabinTop } = group.userData.stations;
  const detail = p.detail;
  group.userData.detail = detail;
  // Small objects describe life aboard without inventing fitted upgrade powers.
  // The mug and deck brush sit against the house, clear of the working ladder.
  const houseEdge = Math.min(l * 0.26, cabinZ + (l * p.cabin) / 2 + 0.12);
  cylinder(group, m.roof, 0.065, 0.14, w * 0.23, 1.2, houseEdge);
  ring(group, m.metal, 0.045, 0.012, w * 0.23 + 0.07, 1.2, houseEdge).rotation.x = 0;
  rod(group, m.rope, [w * 0.42, 1, l * 0.16], [w * 0.42, 1.3, l * 0.34], 0.02);
  box(group, m.rope, 0.19, 0.06, 0.11, w * 0.42, 1.31, l * 0.34);
  if (['yellow-crane', 'silver-crane', 'crane-platform'].includes(detail)) {
    const metal = detail === 'silver-crane' ? m.metal : accent;
    const x = -w * 0.36,
      z = l * (detail === 'crane-platform' ? 0.11 : 0.25);
    const base = [x, 1.65, z],
      elbow = [x, 2.65, z - l * 0.09],
      tip = [x, 2.25, z + l * 0.12];
    cylinder(group, metal, 0.23, 0.9, x, 1.35, z);
    box(group, metal, 0.48, 0.4, 0.48, x, 1.95, z, 0.04);
    for (const [a, b] of [
      [base, elbow],
      [elbow, tip],
    ]) {
      const p = new THREE.Vector3(...a),
        q = new THREE.Vector3(...b),
        delta = q.clone().sub(p);
      const boom = box(group, metal, 0.26, delta.length(), 0.3, 0, 0, 0, 0.035);
      boom.position.copy(p.add(q).multiplyScalar(0.5));
      boom.quaternion.setFromUnitVectors(UP, delta.normalize());
    }
    sphere(group, m.darkMetal, 0.16, ...elbow);
    rod(group, m.metal, [x + 0.15, 1.65, z + 0.15], [x + 0.15, 2.55, z - l * 0.065], 0.065);
    rod(group, m.rubber, tip, [tip[0], 1.6, tip[2]], 0.025);
    ring(group, m.darkMetal, 0.1, 0.025, tip[0], 1.55, tip[2]).rotation.x = Math.PI / 2;
    tube(
      group,
      m.rubber,
      [
        [x - 0.17, 1.6, z],
        [x - 0.19, 2.75, z - l * 0.09],
        [x - 0.17, 2.32, z + l * 0.12],
      ],
      0.035,
    );
    for (const side of [-1, 1])
      box(group, accent, 0.18, 0.08, l * 0.52, side * w * 0.46, 1.1, l * 0.14, 0.02);
  }
  if (detail === 'yellow-crane') {
    for (let i = 0; i < 4; i++) {
      cylinder(group, m.blue, 0.16, 0.86, w * 0.34, 1.35, l * (0.15 + i * 0.065));
      cylinder(group, m.metal, 0.07, 0.13, w * 0.34, 1.85, l * (0.15 + i * 0.065));
    }
    for (const side of [-1, 1]) {
      box(group, m.rope, w * 0.22, 0.42, 0.58, side * w * 0.28, 1.13, l * 0.4, 0.04);
      box(group, m.darkMetal, w * 0.2, 0.025, 0.52, side * w * 0.28, 1.36, l * 0.4);
    }
  }
  if (detail === 'crane-platform') {
    for (let i = 0; i < 2; i++)
      box(group, m.paint, w * 0.2, 0.5, l * 0.095, w * 0.32, 1.16, l * (0.14 + i * 0.12), 0.035);
    box(group, m.rubber, w * 0.56, 0.028, l * 0.13, 0, 0.92, l * 0.37);
    for (let i = -5; i <= 5; i++)
      box(group, m.metal, 0.016, 0.012, l * 0.125, i * w * 0.05, 0.941, l * 0.37);
    for (let i = -3; i <= 3; i++)
      box(group, m.metal, w * 0.55, 0.012, 0.016, 0, 0.944, l * (0.37 + i * 0.02));
  }
  if (detail === 'timber-cockpit') {
    box(group, m.paint, w * 0.54, 0.38, 0.45, 0, 1.13, l * 0.4, 0.09);
    box(group, m.tank, w * 0.54, 0.17, 0.47, 0, 1.4, l * 0.4, 0.055);
    cylinder(group, m.metal, 0.05, 0.45, 0, 1.12, l * 0.25);
    box(group, m.rope, w * 0.29, 0.06, l * 0.1, 0, 1.4, l * 0.25, 0.035);
    for (const side of [-1, 1])
      box(group, m.rope, 0.14, 0.05, l * 0.55, side * w * 0.43, 1.11, l * 0.06);
  }
  if (detail === 'tow-winch') {
    const hazard = m.orange.clone();
    hazard.color.set('#ebc33b');
    group.userData.extraMaterials.push(hazard);
    const z = l * 0.29;
    cylinder(group, m.darkMetal, 0.29, w * 0.38, 0, 1.4, z).rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      cylinder(group, accent, 0.37, 0.06, side * w * 0.21, 1.4, z).rotation.z = Math.PI / 2;
      rod(group, m.metal, [side * w * 0.21, 0.93, z], [side * w * 0.21, 1.4, z], 0.07);
    }
    for (let i = -3; i <= 3; i++)
      ring(group, m.rope, 0.295, 0.025, i * 0.07, 1.4, z).rotation.z = Math.PI / 2;
    for (let i = -4; i <= 4; i++)
      box(
        group,
        i % 2 ? m.rubber : hazard,
        0.23,
        0.21,
        0.045,
        i * 0.23,
        0.88,
        l * 0.496,
      ).rotation.z = -0.4;
  }
  if (detail === 'bow-ramp') {
    box(group, accent, w * 0.79, 0.13, l * 0.11, 0, 1.01, -l * 0.44, 0.025);
    for (let i = -4; i <= 4; i++)
      box(group, m.metal, 0.035, 0.023, l * 0.105, i * w * 0.077, 1.09, -l * 0.44);
    for (const side of [-1, 1])
      rod(
        group,
        m.darkMetal,
        [side * w * 0.42, 1.02, -l * 0.31],
        [side * w * 0.42, 1.4, -l * 0.49],
        0.03,
      );
  }
  if (detail === 'aft-lockers') {
    for (const side of [-1, 1]) {
      box(group, m.paint, w * 0.19, 0.46, l * 0.14, side * w * 0.3, 1.13, l * 0.34, 0.06);
      box(group, m.metal, 0.1, 0.035, 0.045, side * w * 0.3, 1.38, l * 0.32);
    }
    cylinder(group, m.orange, 0.15, w * 0.46, 0, 1.09, houseEdge + 0.2).rotation.z = Math.PI / 2;
  }
  if (detail === 'folded-boom') {
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const tire = ring(
          group,
          m.rubber,
          0.25,
          0.085,
          side * w * (0.28 + i * 0.06),
          0.96,
          -l * (0.36 - i * 0.045),
        );
        tire.rotation.x = 0.5;
      }
    box(group, m.paint, w * 0.26, 0.42, l * 0.12, 0, 1.12, l * 0.17, 0.05);
    box(group, m.paint, 0.22, 0.23, l * 0.25, w * 0.28, 1.43, l * 0.26, 0.025).rotation.x = -0.13;
    rod(group, m.metal, [w * 0.28, 0.95, l * 0.36], [w * 0.28, 1.45, l * 0.36], 0.09);
    tube(
      group,
      m.orange,
      [
        [-w * 0.18, 1, -l * 0.34],
        [0, 1.04, -l * 0.4],
        [w * 0.18, 1, -l * 0.34],
      ],
      0.04,
    );
  }
  if (['crane-platform', 'twin-step'].includes(detail)) {
    box(group, m.metal, w * 0.45, 0.07, 0.58, 0, 0.5, l * 0.52, 0.025);
    for (let i = -4; i <= 4; i++)
      box(group, m.darkMetal, 0.03, 0.012, 0.52, i * w * 0.047, 0.542, l * 0.52);
  }
  if (detail === 'net-foredeck') {
    for (let x = -w * 0.3; x <= w * 0.3; x += 0.17)
      rod(group, m.rope, [x, 0.91, -l * 0.43], [x, 0.91, -l * 0.29], 0.012);
    for (let z = -l * 0.43; z <= -l * 0.29; z += 0.17)
      rod(group, m.rope, [-w * 0.3, 0.91, z], [w * 0.3, 0.91, z], 0.012);
    ring(group, m.roof, w * 0.16, 0.025, 0, 0.967, l * 0.29);
    cylinder(group, m.darkMetal, 0.16, 0.45, 0, cabinTop + 0.25, cabinZ - 0.4).rotation.z =
      Math.PI / 2;
    for (const x of [-0.24, 0.24])
      cylinder(group, m.metal, 0.23, 0.045, x, cabinTop + 0.25, cabinZ - 0.4).rotation.z =
        Math.PI / 2;
  }
  if (detail === 'workhorse' || detail === 'rib') {
    cylinder(group, m.roof, 0.24, 0.13, 0.3, cabinTop + 0.18, cabinZ + 0.26);
    sphere(group, m.roof, 0.24, 0.3, cabinTop + 0.24, cabinZ + 0.26, [1, 0.65, 1]);
  }
}

export function makeVessel(spec, definition, materials, role = 'player') {
  const group = new THREE.Group(),
    length = spec.length || 10,
    width = spec.width || 4;
  const profile = definition.profile || fleetProfile(definition.id, role);
  if (profile.oars || profile.openConsole)
    return makeOpenVessel(spec, definition, materials, profile);
  group.userData.profile = { id: definition.id, ...profile };
  const catamaran = profile.type === 'catamaran';
  const small = definition.id.startsWith('outboard');
  const premium = definition.id.startsWith('twinjet');
  const accent = materials.blue.clone();
  accent.color.set(profile.trim);
  group.userData.ownedMaterial = accent;
  group.userData.extraMaterials = [];
  const tintMaterial = (base, color) => {
    if (!color) return base;
    const material = base.clone();
    material.color.set(color);
    group.userData.extraMaterials.push(material);
    return material;
  };
  const hullPaint = tintMaterial(materials.hull, profile.hullColor),
    cabinPaint = tintMaterial(materials.paint, profile.cabinColor);
  const deckY = 0.88,
    cabinZ = length * (profile.cabinZ ?? -0.125);
  const cabinLength = length * profile.cabin;
  const cabinWidth = width * profile.cabinWidth,
    cabinTop = deckY + profile.cabinHeight;
  group.userData.stations = { deckY, cabinTop, cabinZ, cabinLength, cabinWidth };
  const hullGroup = new THREE.Group();
  group.add(hullGroup);
  mesh(
    hullGroup,
    hullSurface(
      width,
      length,
      [
        [-1.25, 0.52],
        [-0.6, 0.8],
        [-0.1, 0.94],
        [0.65, 1],
        [1.02, 0.99],
      ],
      profile.type,
    ),
    hullPaint,
  );
  mesh(
    hullGroup,
    hullSurface(
      width,
      length,
      [
        [-0.65, 0.8],
        [-0.13, 0.94],
        [0.075, 0.965],
      ],
      profile.type,
    ),
    materials.bottom,
  );
  mesh(
    hullGroup,
    hullSurface(
      width * 1.003,
      length * 1.003,
      [
        [0.35, 0.978],
        [0.57, 0.994],
      ],
      profile.type,
    ),
    accent,
  );
  const deck = mesh(
    hullGroup,
    new THREE.ShapeGeometry(deckShape(width, length, 0.965, profile.type), 36),
    materials.deck,
    0,
    deckY,
    0,
  );
  deck.rotation.x = -Math.PI / 2;
  tube(
    hullGroup,
    materials.metal,
    hullOutline(width, length, 1.05, 0.986, profile.type).map((p) => [p.x, p.y, p.z]),
    0.065,
    true,
  );
  tube(
    hullGroup,
    materials.rubber,
    hullOutline(width, length, 0.67, 1.005, profile.type).map((p) => [p.x, p.y, p.z]),
    profile.type === 'tug' ? 0.21 : 0.066,
    true,
  );
  if (catamaran) {
    hullGroup.scale.x = 0.29;
    hullGroup.position.x = -width * 0.345;
    const secondHull = hullGroup.clone();
    secondHull.position.x = width * 0.345;
    group.add(secondHull);
    box(group, hullPaint, width * 0.7, 0.26, length * 0.7, 0, deckY - 0.17, length * 0.075, 0.08);
    box(
      group,
      materials.deck,
      width * 0.68,
      0.035,
      length * 0.68,
      0,
      deckY + 0.01,
      length * 0.075,
      0.04,
    );
  }
  if (profile.type === 'timber' || profile.timberDeck) {
    const timber = materials.deck.clone();
    group.userData.extraMaterials.push(timber);
    timber.color.set('#8a6849');
    const woodDeck = mesh(
      group,
      new THREE.ShapeGeometry(deckShape(width, length, 0.94), 36),
      timber,
      0,
      deckY + 0.035,
      0,
    );
    woodDeck.rotation.x = -Math.PI / 2;
    for (let x = -width * 0.38; x <= width * 0.38; x += 0.12) {
      const fraction = Math.abs(x) / (width * 0.5);
      box(
        group,
        materials.darkMetal,
        0.009,
        0.008,
        length * (0.73 - fraction * 0.17),
        x,
        deckY + 0.057,
        length * 0.04,
      );
    }
  }
  if (profile.type === 'rib' || profile.type === 'tug') {
    tube(
      group,
      profile.type === 'rib' ? accent : materials.rubber,
      hullOutline(width * 0.94, length * 0.98, 0.78, 0.98).map((p) => [p.x, p.y, p.z]),
      width * (profile.type === 'rib' ? 0.105 : 0.06),
      true,
    );
  }
  // Thin welded bulwarks, with scuppers along the large working deck.
  for (const side of [-1, 1]) {
    box(
      group,
      hullPaint,
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
    cabinPaint,
    cabinWidth,
    cabinTop - deckY,
    cabinLength,
    0,
    (deckY + cabinTop) / 2,
    cabinZ,
    0.13,
  );
  windows(group, materials, cabinWidth, cabinZ, cabinLength, cabinTop);
  if (definition.id !== 'basic') {
    for (const side of [-1, 1]) {
      box(
        group,
        accent,
        0.075,
        0.18,
        cabinLength,
        side * (cabinWidth / 2 + 0.025),
        cabinTop - 0.08,
        cabinZ,
        0.018,
      );
      box(
        group,
        accent,
        0.11,
        0.06,
        length * 0.52,
        side * width * 0.473,
        1.078,
        length * 0.16,
        0.018,
      );
    }
    box(
      group,
      accent,
      cabinWidth,
      0.16,
      0.07,
      0,
      cabinTop - 0.07,
      cabinZ + cabinLength * 0.5 + 0.025,
      0.018,
    );
  }

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
  // Family-specific workboat structures, drawn from the retained fleet art.
  // They never alter the shared deck-load or collision geometry.
  if (profile.type === 'tug') {
    for (const side of [-1, 1]) {
      cylinder(
        group,
        materials.darkMetal,
        0.16,
        1.35,
        side * width * 0.31,
        cabinTop - 0.32,
        cabinZ + cabinLength * 0.4,
      );
      cylinder(
        group,
        accent,
        0.185,
        0.18,
        side * width * 0.31,
        cabinTop + 0.23,
        cabinZ + cabinLength * 0.4,
      );
    }
    box(
      group,
      accent,
      cabinWidth + 0.15,
      0.08,
      0.27,
      0,
      cabinTop + 0.16,
      cabinZ - cabinLength * 0.5,
      0.035,
    );
  }
  if (definition.id === 'jet') {
    for (const side of [-1, 1]) {
      rod(
        group,
        materials.metal,
        [side * width * 0.43, 0.95, length * 0.4],
        [side * width * 0.43, 2.0, length * 0.4],
        0.055,
      );
    }
    rod(
      group,
      materials.metal,
      [-width * 0.43, 2.0, length * 0.4],
      [width * 0.43, 2.0, length * 0.4],
      0.065,
    );
    box(
      group,
      materials.roof,
      0.48,
      0.1,
      0.4,
      -cabinWidth * 0.23,
      cabinTop + 0.13,
      cabinZ - 0.3,
      0.035,
    );
  }
  if (profile.type === 'landing') {
    box(group, accent, width * 0.7, 0.09, 0.18, 0, 1.05, -length * 0.46, 0.025);
    for (const x of [-width * 0.33, width * 0.33])
      rod(group, materials.darkMetal, [x, 1.08, -length * 0.45], [x, 1.28, -length * 0.31], 0.025);
    box(
      group,
      materials.darkMetal,
      cabinWidth + 0.12,
      0.09,
      0.42,
      0,
      cabinTop + 0.13,
      cabinZ - cabinLength * 0.45,
      0.025,
    );
  }
  if (profile.type === 'utility') {
    for (const side of [-1, 1]) {
      box(
        group,
        materials.metal,
        0.055,
        0.055,
        cabinLength * 0.75,
        side * cabinWidth * 0.28,
        cabinTop + 0.18,
        cabinZ,
        0.012,
      );
      box(
        group,
        accent,
        0.065,
        0.2,
        0.15,
        side * cabinWidth * 0.28,
        cabinTop + 0.12,
        cabinZ + cabinLength * 0.3,
        0.012,
      );
    }
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
  for (const offset of catamaran ? [-width * 0.345, width * 0.345] : [0]) {
    const bowRail = hullOutline(
      catamaran ? width * 0.29 : width,
      length,
      1.65,
      0.925,
      profile.type,
    ).filter((p) => p.z < -length * 0.15);
    tube(
      group,
      materials.metal,
      bowRail.map((p) => [p.x + offset, p.y, p.z]),
      0.034,
    );
    for (let i = 0; i < bowRail.length; i += 8)
      rod(
        group,
        materials.metal,
        [bowRail[i].x + offset, 1, bowRail[i].z],
        [bowRail[i].x + offset, 1.65, bowRail[i].z],
        0.028,
      );
  }
  const bowZ = -length * 0.375,
    anchorX = catamaran ? -width * 0.345 : 0;
  box(group, materials.metal, 0.19, 0.12, 0.7, anchorX, 1.03, -length * 0.46, 0.025);
  rod(
    group,
    materials.darkMetal,
    [anchorX, 0.97, -length * 0.37],
    [anchorX, 1.11, -length * 0.498],
    0.035,
  );
  cylinder(group, materials.metal, 0.14, 0.19, anchorX, 1.14, bowZ);
  rod(group, materials.metal, [anchorX - 0.25, 1.2, bowZ], [anchorX + 0.25, 1.2, bowZ], 0.1);
  coil(group, materials.rope, anchorX - width * 0.04, 0.96, bowZ + 0.26, width * 0.06);
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
  const rackZ = Math.min(length * 0.15, cabinZ + cabinLength / 2 + 0.48);
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
  const ladderX = -width * 0.51,
    ladderZ = length * 0.08;
  for (const z of [ladderZ - 0.23, ladderZ + 0.23])
    rod(group, materials.metal, [ladderX + 0.09, 1.24, z], [ladderX - 0.14, -0.55, z], 0.034);
  for (let i = 0; i < 5; i++)
    rod(
      group,
      materials.metal,
      [ladderX - 0.1, 1.02 - i * 0.31, ladderZ - 0.23],
      [ladderX - 0.1, 1.02 - i * 0.31, ladderZ + 0.23],
      0.033,
    );
  box(group, accent, 0.16, 0.05, 0.7, ladderX + 0.14, 1.085, ladderZ, 0.025);
  group.userData.drives = [];
  const driveAt = (x, type) => {
    const drive = new THREE.Group();
    drive.userData.dynamic = true;
    drive.userData.type = type;
    drive.position.set(x, 0, length * 0.51);
    group.add(drive);
    group.userData.drives.push(drive);
    return drive;
  };
  if (small) {
    for (const x of profile.motors === 2 ? [-width * 0.2, width * 0.2] : [0]) {
      const motor = driveAt(x, 'outboard');
      box(motor, materials.rubber, 0.64, 0.82, 0.79, 0, 0.64, 0.12, 0.16);
      box(motor, materials.metal, 0.19, 0.85, 0.25, 0, -0.08, 0.18, 0.045);
      box(motor, materials.rubber, 0.57, 0.07, 0.68, 0, 1.06, 0.12, 0.025);
      box(motor, materials.metal, 0.42, 0.045, 0.4, 0, -0.44, 0.19);
      motor.userData.propeller = propeller(motor, materials, 0, -0.5, 0.3);
    }
  } else if (definition.id.includes('jet')) {
    for (const x of premium ? [-width * 0.345, width * 0.345] : [0]) {
      const nozzle = driveAt(x, 'jet');
      cylinder(nozzle, materials.darkMetal, 0.22, 0.34, 0, -0.03, 0).rotation.x = Math.PI / 2;
      box(nozzle, materials.metal, 0.47, 0.35, 0.08, 0, 0.03, 0.2, 0.055);
    }
  } else if (definition.id.startsWith('sterndrive')) {
    const leg = driveAt(0, 'leg');
    box(leg, materials.darkMetal, 0.35, 0.63, 0.34, 0, 0.05, 0.02, 0.045);
    cylinder(leg, materials.metal, 0.16, 0.42, 0, -0.26, 0.3).rotation.x = Math.PI / 2;
    leg.userData.propeller = propeller(leg, materials, 0, -0.26, 0.52);
  }
  if (profile.solar) {
    box(group, materials.metal, width * 0.68, 0.08, length * 0.12, 0, 1.65, length * 0.43, 0.035);
    for (const side of [-1, 1]) {
      box(
        group,
        materials.glass,
        width * 0.3,
        0.035,
        length * 0.105,
        side * width * 0.16,
        1.705,
        length * 0.43,
        0.01,
      );
      rod(
        group,
        materials.metal,
        [side * width * 0.3, deckY, length * 0.43],
        [side * width * 0.3, 1.6, length * 0.43],
        0.03,
      );
    }
  }
  addCareerDetails(group, spec, materials, profile, accent);
  addTrafficDetails(group, spec, materials, profile, accent);
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
  bins[0].position.set(catamaran ? width * 0.345 : width * 0.12, deckY, -length * 0.36);
  bins[0].scale.setScalar(0.6);
  group.userData.catchLoad = new CatchLoad(group, materials.catchNet, materials.rope);
  mergeStatic(group);
  return group;
}

export function addFittings(vessel, spec, materials, installed) {
  const { length, width } = spec,
    { cabinTop, cabinZ, cabinLength } = vessel.userData.stations;
  const fittings = new THREE.Group();
  fittings.name = 'Installed working systems';
  fittings.userData.dynamic = true;
  vessel.add(fittings);
  vessel.userData.fittings = {};
  for (const id of installed.filter((id) => !['lights-double', 'lights-quad'].includes(id))) {
    const station = new THREE.Group();
    station.name = `Installed · ${id}`;
    vessel.userData.fittings[id] = station;
    fittings.add(station);
    if (id === 'hoist') {
      const x = -width * 0.38,
        z = length * 0.1;
      box(station, materials.blue, 0.38, 0.43, 0.5, x + 0.2, 1.27, z, 0.04);
      cylinder(station, materials.metal, 0.14, 0.38, x - 0.11, 1.45, z).rotation.z = Math.PI / 2;
      tube(
        station,
        materials.rubber,
        [
          [x + 0.2, 1.2, z],
          [x + 0.28, 1.07, z + 0.2],
          [x, 1.03, z + 0.4],
          [x, 1.8, z],
        ],
        0.025,
      );
    } else if (id === 'engine') {
      box(station, materials.darkMetal, width * 0.32, 0.15, 0.66, 0, 0.99, length * 0.27, 0.04);
      for (let i = 0; i < 7; i++)
        box(
          station,
          materials.metal,
          width * 0.27,
          0.025,
          0.027,
          0,
          1.08,
          length * 0.27 - 0.24 + i * 0.08,
        );
      for (const side of [-1, 1])
        cylinder(
          station,
          materials.metal,
          0.075,
          0.24,
          side * width * 0.31,
          0.7,
          length * 0.49,
        ).rotation.x = Math.PI / 2;
    } else if (id === 'fuel-system') {
      box(station, materials.roof, 0.36, 0.28, 0.27, width * 0.32, 1.14, length * 0.28, 0.035);
      for (const dz of [-0.08, 0.08])
        cylinder(station, materials.orange, 0.07, 0.23, width * 0.32, 1.41, length * 0.28 + dz);
    } else if (id === 'tank') {
      box(station, materials.metal, 0.52, 0.62, 1.03, width * 0.32, 1.22, length * 0.38, 0.065);
      for (const z of [0.34, 0.42])
        box(station, materials.darkMetal, 0.54, 0.64, 0.05, width * 0.32, 1.23, length * z);
      cylinder(station, materials.orange, 0.05, 0.07, width * 0.32, 1.57, length * 0.37);
    } else if (id === 'nitrox') {
      for (let i = 0; i < 2; i++) {
        cylinder(
          station,
          materials.tank,
          0.14,
          0.78,
          width * 0.31,
          1.3,
          length * (0.15 + i * 0.045),
        );
        cylinder(
          station,
          materials.green,
          0.145,
          0.14,
          width * 0.31,
          1.51,
          length * (0.15 + i * 0.045),
        );
      }
    } else if (id === 'lights') {
      const output = installed.includes('lights-quad')
        ? 4
        : installed.includes('lights-double')
          ? 2
          : 1;
      for (const upgrade of ['lights-double', 'lights-quad'])
        if (installed.includes(upgrade)) vessel.userData.fittings[upgrade] = station;
      vessel.userData.workLampPositions = [
        new THREE.Vector3(0, cabinTop + 0.38, cabinZ - cabinLength * 0.5 - 0.12),
        new THREE.Vector3(-width * 0.34, cabinTop + 0.38, cabinZ + cabinLength * 0.25),
      ];
      const targets = [
        new THREE.Vector3(0, -0.3, -length * 0.5 - 17),
        new THREE.Vector3(-width * 0.5 - 7, -0.6, length * 0.15),
      ];
      vessel.userData.workLenses = [];
      vessel.userData.workLampPositions.forEach((position, i) => {
        rod(station, materials.metal, [position.x, cabinTop, position.z], position.toArray(), 0.03);
        const fixture = new THREE.Group();
        fixture.userData.dynamic = true;
        fixture.position.copy(position);
        fixture.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          targets[i].clone().sub(position).normalize(),
        );
        station.add(fixture);
        const columns = output > 1 ? 2 : 1,
          rows = output > 2 ? 2 : 1;
        box(fixture, materials.darkMetal, 0.34 * columns, 0.22 * rows, 0.2, 0, 0, 0, 0.025);
        for (let panel = 0; panel < output; panel++) {
          const lens = box(
            fixture,
            materials.lamp,
            0.28,
            0.16,
            0.02,
            ((panel % columns) - (columns - 1) / 2) * 0.32,
            (Math.floor(panel / columns) - (rows - 1) / 2) * 0.21,
            -0.11,
            0.012,
          );
          lens.castShadow = false;
          vessel.userData.workLenses.push(lens);
        }
      });
    } else if (['plotter', 'scanner', 'forecast'].includes(id)) {
      const x = (['plotter', 'scanner', 'forecast'].indexOf(id) - 1) * 0.32;
      box(
        station,
        materials.darkMetal,
        0.28,
        0.25,
        0.1,
        x,
        1.74,
        cabinZ + cabinLength * 0.5 + 0.15,
        0.025,
      );
      box(
        station,
        materials.teal,
        0.23,
        0.18,
        0.013,
        x,
        1.75,
        cabinZ + cabinLength * 0.5 + 0.207,
        0.01,
      );
    } else if (id === 'stabilizer') {
      for (const side of [-1, 1])
        rod(
          station,
          materials.metal,
          [side * width * 0.42, 1.07, length * 0.32],
          [side * width * 0.47, 2.35, length * 0.13],
          0.06,
        );
    } else if (id === 'bowthruster') {
      for (const side of [-1, 1])
        ring(
          station,
          materials.darkMetal,
          0.16,
          0.045,
          side * width * 0.31,
          0.15,
          -length * 0.31,
        ).rotation.z = Math.PI / 2;
    }
  }
  for (const station of fittings.children) {
    mergeStatic(station);
    station.userData.dynamic = true;
  }
  mergeStatic(fittings);
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
    this.particleColor = new THREE.Color();
    for (let i = 0; i < this.size; i++) this.mesh.setColorAt(i, this.particleColor);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }
  emit(x, z, size, vx, vz, life, spread = 0, bubble = false, torch = false) {
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
      torch,
      flowTime: 0,
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
    // Current is measured per simulation second. Pausing or changing the
    // world pace must not leave bubbles moving in a different water mass
    // from the diver and physical foam. Expansion/fading remains visual time.
    const flowDt = world
      ? this.flowWorld === world
        ? Math.max(0, world.time - this.flowWorldTime)
        : 0
      : dt;
    this.flowWorld = world;
    this.flowWorldTime = world?.time;
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
        // Foam and exhaled bubbles travel with the same local water as the
        // hull and divers. Cache the field at 10 Hz; decorative wash still
        // spreads relative to that moving water.
        p.flowTime -= flowDt;
        if (world && p.flowTime <= 0) {
          const flow = currentAt(world, p.x, p.z);
          p.flowX = flow.x;
          p.flowZ = flow.y;
          p.flowTime = 0.1;
        }
        p.x += p.vx * dt + (world ? p.flowX || 0 : 0) * flowDt;
        p.z += p.vz * dt + (world ? p.flowZ || 0 : 0) * flowDt;
        const age = p.maxLife - p.life,
          fade = Math.min(1, p.life / 1.5);
        const size = (p.size + age * p.spread) * Math.sqrt(fade);
        scratchObject.position.set(p.x, surfaceY + 0.075 + i * 0.00003, p.z);
        scratchObject.rotation.set(0, p.spin, 0);
        scratchObject.scale.set(size, 1, size * 0.7);
      }
      scratchObject.updateMatrix();
      this.mesh.setMatrixAt(i, scratchObject.matrix);
      const glowing = p.torch && world?.weather?.night && enabledEquipment(world).includes('torch');
      this.particleColor.set(glowing ? '#c4ffe3' : '#ffffff');
      this.particleColor.multiplyScalar(world?.weather?.night ? (glowing ? 1.3 : 0.4) : 1);
      this.mesh.setColorAt(i, this.particleColor);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.opacities.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
  reset() {
    for (const p of this.particles) p.life = 0;
    this.flowWorld = null;
    this.flowWorldTime = undefined;
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
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({
          color: ['#656578', '#946c93', '#6a9385', '#557d91'][i],
          map: this.siltTexture,
          transparent: true,
          opacity: 0.13,
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
export function disposeGroup(group) {
  const geometries = new Set();
  group.traverse((object) => {
    if (object.geometry && !SHARED.has(object.geometry)) geometries.add(object.geometry);
    if (object.isInstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const entry of group.userData.fadeMaterials || []) entry.material.dispose();
  group.userData.ownedMaterial?.dispose();
  for (const material of group.userData.extraMaterials || []) material.dispose();
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
    this.column = waterColumnMaterials(this.materials);
    this.boat = null;
    this.identity = '';
    this.traffic = new Map();
    this.divers = [];
    this.diverTorches = [new DiverTorch(scene), new DiverTorch(scene)];
    this.elapsed = 0;
    this.wakeAccumulator = 0;
    this.wakes = new WakeField(scene);
    this.surfaceCues = new SurfaceCues(scene);
    this.lightRig = new THREE.Group();
    this.workSpots = [];
    for (const [x, z, tx, tz, angle] of [
      [0, -2, 0, -18, 0.55],
      [-1.1, 0, -8, 1, 0.8],
    ]) {
      const light = new THREE.SpotLight('#fff3db', 0, 40, angle, 0.7, 2);
      light.position.set(x, 3.2, z);
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.0002;
      light.shadow.normalBias = 0.025;
      light.target.position.set(tx, 0, tz);
      this.lightRig.add(light, light.target);
      this.workSpots.push(light);
    }
    scene.add(this.lightRig);
    this.rivalDivers = new Map();
    for (let i = 0; i < 2; i++) {
      const visual = makeSurfaceDiver(this.column.materials, i);
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
    const installed = world.career?.fleet[boat.configuration]?.equipment || [];
    const identity = `${boat.configuration}:${spec.length}:${spec.width}:${installed.join(',')}`;
    if (!this.boat || this.identity !== identity) {
      if (this.boat) disposeGroup(this.boat);
      this.boat = makeVessel(spec, boatDefinition(boat.configuration), this.materials);
      addFittings(this.boat, spec, this.materials, installed);
      prepareDepartureFade(this.boat);
      this.scene.add(this.boat);
      this.identity = identity;
    }
    const surfaceY = this.surfaceY || 0;
    const wave = Math.min(1, world.environment?.waveHeight ?? world.environment?.waves ?? 0.3);
    this.position(this.boat, boat, surfaceY, wave);
    setDepartureAlpha(this.boat, boat.alpha);
    this.boat.userData.radar.rotation.y = this.elapsed * 1.1;
    animateDrives(this.boat, boat.rudder, boat.throttle, dt);
    this.column.uniforms.uColumnTime.value = this.elapsed;
    this.column.uniforms.uColumnTurbidity.value = waterTurbidity(world);
    this.column.uniforms.uColumnLight.value = world.weather?.sunlight ?? 1;
    this.boat.userData.radar.visible = installed.includes('radar');
    for (let i = 0; i < 2; i++) {
      const d = world.divers[i],
        crew = this.boat.userData.deckCrew[i],
        visual = this.divers[i];
      crew.visible = !!d && d.state === 'ready';
      crew.rotation.x = Math.sin(this.elapsed * 0.7 + i) * 0.022;
      if (!d) {
        visual.group.visible = false;
        this.diverTorches[i].group.visible = false;
        continue;
      }
      const pose = diverMotion(world, d);
      this.diverTorches[i].update(world, pose);
      crew.visible = pose.phase === 'aboard';
      visual.group.userData.motion = pose;
      visual.group.visible =
        pose.phase !== 'aboard' &&
        !['fatality', 'dead', 'lost'].includes(d.state) &&
        Math.hypot(pose.x - boat.x, pose.y - boat.y) <= range &&
        (pose.depth < 5 || pose.aboard);
      if (!visual.group.visible) continue;
      visual.group.position.set(pose.x, surfaceY, pose.y);
      visual.group.rotation.y = -pose.heading;
      visual.swimmer.visible = false;
      visual.body.visible = true;
      visual.body.position.set(
        0,
        pose.height +
          (!pose.underwater && !pose.aboard ? Math.sin(this.elapsed * 1.8 + i) * 0.04 : 0),
        0,
      );
      visual.body.rotation.x = pose.pitch;
      visual.float.visible = d.state === 'surface' && pose.phase !== 'boarding';
      visual.float.position.x = 0.58;
      // The net sack comes out of the sea before boarding finishes. Its
      // progress reads the existing hook timer; accounting stays in simulation.
      const lifting = d.state === 'surface' && !d.bagHandled && d.bag > 0;
      visual.liftBag.visible = visual.liftLine.visible = lifting;
      if (lifting) {
        const t = Math.min(1, (d.hook || 0) / (d.hookSeconds || 3));
        const lift = t * t * (3 - 2 * t);
        const deckX =
          boat.x -
          Math.cos(boat.heading) * spec.width * 0.29 -
          Math.sin(boat.heading) * spec.length * 0.16;
        const deckZ =
          boat.y -
          Math.sin(boat.heading) * spec.width * 0.29 +
          Math.cos(boat.heading) * spec.length * 0.16;
        const x = d.x + Math.cos(pose.heading) * 0.58;
        const z = d.y + Math.sin(pose.heading) * 0.58;
        const dx = x + (deckX - x) * lift - pose.x;
        const dz = z + (deckZ - z) * lift - pose.y;
        const bag = visual.liftBag;
        bag.position.set(
          dx * Math.cos(pose.heading) + dz * Math.sin(pose.heading),
          -0.38 + lift * 1.63 + Math.sin(lift * Math.PI) * 1.25,
          -dx * Math.sin(pose.heading) + dz * Math.cos(pose.heading),
        );
        bag.scale.setScalar(0.38 * Math.max(0.55, Math.cbrt(d.bag / 300)));
        const anchorX =
          boat.x -
          Math.cos(boat.heading) * spec.width * 0.38 -
          Math.sin(boat.heading) * spec.length * 0.1 -
          pose.x;
        const anchorZ =
          boat.y -
          Math.sin(boat.heading) * spec.width * 0.38 +
          Math.cos(boat.heading) * spec.length * 0.1 -
          pose.y;
        visual.ropeEnd.set(
          t > 0
            ? anchorX * Math.cos(pose.heading) + anchorZ * Math.sin(pose.heading)
            : bag.position.x,
          t > 0 ? 1.6 : 0.08,
          t > 0
            ? -anchorX * Math.sin(pose.heading) + anchorZ * Math.cos(pose.heading)
            : bag.position.z,
        );
        visual.liftLine.position.copy(bag.position).add(visual.ropeEnd).multiplyScalar(0.5);
        visual.ropeDirection.copy(visual.ropeEnd).sub(bag.position);
        visual.liftLine.scale.set(0.016, Math.max(0.04, visual.ropeDirection.length()), 0.016);
        visual.liftLine.quaternion.setFromUnitVectors(UP, visual.ropeDirection.normalize());
      }
      for (const { leg, arm, side } of visual.body.userData.limbs) {
        const cycle = Math.sin(this.elapsed * (pose.phase === 'boarding' ? 16 : 5) + side * 1.57);
        leg.rotation.x =
          cycle *
          (pose.phase === 'boarding' || pose.phase === 'stowing'
            ? 0.35
            : pose.underwater
              ? 0.16
              : 0.07);
        arm.rotation.x =
          pose.phase === 'boarding'
            ? -1.9 + cycle * 0.3
            : pose.phase === 'preparing'
              ? -0.65
              : -0.25;
      }
      visual.group.userData.contrast = submergedContrast(pose.depth, waterTurbidity(world));
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
        const appearance = trafficProfile(actor),
          id = appearance.family;
        visual = makeVessel(
          { length: actor.length, width: actor.width },
          {
            ...boatDefinition(id),
            profile: appearance.profile,
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
          marker.body.visible = false;
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
          ['descending', 'searching', 'working', 'ascending'].includes(
            diverMotion(world, d).phase,
          ) &&
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
              !!world.weather?.night && enabledEquipment(world).includes('torch'),
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
    this.lightRig.position.copy(this.boat.position);
    this.lightRig.quaternion.copy(this.boat.quaternion);
    const positions = this.boat.userData.workLampPositions;
    this.workSpots[0].position.copy(
      positions?.[0] || new THREE.Vector3(0, 3.2, -spec.length * 0.24),
    );
    this.workSpots[1].position.copy(
      positions?.[1] || new THREE.Vector3(-spec.width * 0.48, 2.8, spec.length * 0.1),
    );
    this.workSpots[0].target.position.set(0, -0.3, -spec.length * 0.5 - 17);
    this.workSpots[1].target.position.set(-spec.width * 0.5 - 7, -0.6, spec.length * 0.15);
    for (const lens of this.boat.userData.workLenses || []) lens.visible = lights;
    this.workSpots.forEach((light) => {
      const output = workLightStrength(world);
      light.intensity = lights ? 240 * output * boat.alpha : 0;
      light.distance = 40 * Math.sqrt(output || 1);
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
    for (const torch of this.diverTorches) torch.group.visible = false;
  }
  dispose() {
    this.reset();
    this.wakes.dispose();
    this.surfaceCues.dispose();
    disposeGroup(this.lightRig);
    for (const light of this.workSpots) light.dispose();
    this.column.dispose();
    for (const torch of this.diverTorches) torch.dispose();
    for (const d of this.divers) disposeGroup(d.group);
    const textures = new Set();
    for (const material of Object.values(this.materials)) {
      if (material.map) textures.add(material.map);
      material.dispose();
    }
    for (const texture of textures) texture.dispose();
  }
}
