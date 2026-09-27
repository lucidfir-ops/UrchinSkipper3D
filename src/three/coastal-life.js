import * as THREE from 'three';
import { bedDepthAt, seaLevel } from '../terrain.js';
import { visibilityRange } from '../assists.js';

const cetaceans = new Set(['dolphin', 'orca', 'humpback']);
const birds = new Set(['eagle', 'seagull', 'goose']);
function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}
function fin(points, material, parent) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.computeVertexNormals();
  return mesh(geometry, material, parent);
}
function material(color, roughness = 0.54) {
  return new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide });
}
function destroy(group) {
  const geometries = new Set(),
    materials = new Set();
  group.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  group.clear();
}
function animal(species) {
  const root = new THREE.Group();
  root.name = `Wildlife · ${species}`;
  if (birds.has(species)) {
    const eagle = species === 'eagle',
      goose = species === 'goose';
    const feathers = material(eagle ? '#443c31' : goose ? '#8a8980' : '#e3e4d9', 0.84);
    const white = material(eagle || goose ? '#e9e5d8' : '#eeeeea', 0.82);
    const body = mesh(new THREE.SphereGeometry(1, 10, 8), feathers, root, 0, 0, 0.04);
    body.scale.set(0.16, 0.18, eagle ? 0.53 : 0.4);
    const head = mesh(new THREE.SphereGeometry(0.13, 8, 6), white, root, 0, 0.1, -0.4);
    if (goose) head.position.z = -0.68;
    const beak = mesh(
      new THREE.ConeGeometry(0.065, 0.24, 5),
      material('#b99252'),
      root,
      0,
      0.09,
      head.position.z - 0.19,
    );
    beak.rotation.x = -Math.PI / 2;
    const wings = [];
    for (const side of [-1, 1]) {
      const span = eagle ? 1.15 : goose ? 1.05 : 0.83;
      const wing = fin(
        [
          [side * 0.08, 0.02, -0.17],
          [side * span * 0.55, -0.01, -0.15],
          [side * span, -0.08, 0.28],
          [side * 0.08, 0.02, -0.17],
          [side * span, -0.08, 0.28],
          [side * span * 0.39, 0.02, 0.27],
        ],
        feathers,
        root,
      );
      wings.push({ mesh: wing, side });
    }
    fin(
      [
        [-0.12, 0.0, 0.33],
        [0.12, 0.0, 0.33],
        [-0.17, 0.02, 0.68],
        [0.12, 0.0, 0.33],
        [0.17, 0.02, 0.68],
        [-0.17, 0.02, 0.68],
      ],
      feathers,
      root,
    );
    root.userData.wings = wings;
    return root;
  }
  if (cetaceans.has(species)) {
    const orca = species === 'orca',
      humpback = species === 'humpback';
    const length = humpback ? 10 : orca ? 6.5 : 3.2;
    const width = humpback ? 2.8 : orca ? 1.9 : 0.85;
    const skin = material(orca ? '#1b282b' : humpback ? '#455257' : '#5a767a', 0.34);
    const sections = [
      [0, 0],
      [0.09, 0.5],
      [0.23, 0.93],
      [0.4, 1],
      [0.58, 0.8],
      [0.76, 0.49],
      [0.92, 0.16],
      [1, 0.075],
    ];
    const geometry = new THREE.LatheGeometry(
      sections.map(([t, r]) => new THREE.Vector2((r * width) / 2, (t - 0.5) * length)),
      16,
    );
    geometry.rotateX(Math.PI / 2);
    const body = mesh(geometry, skin, root, 0, -0.12, 0);
    body.scale.y = 0.68;
    fin(
      [
        [0, 0.2, -length * 0.08],
        [0, orca ? 1.35 : width * 0.48, length * 0.03],
        [0, 0.15, length * 0.19],
      ],
      skin,
      root,
    );
    for (const side of [-1, 1]) {
      fin(
        [
          [side * width * 0.35, -0.08, -length * 0.11],
          [side * width * (humpback ? 1.02 : 0.85), -0.17, length * 0.12],
          [side * width * 0.24, -0.14, length * 0.12],
        ],
        skin,
        root,
      );
      fin(
        [
          [0, -0.04, length * 0.42],
          [side * width * 0.75, 0.01, length * 0.53],
          [side * width * 0.55, 0.06, length * 0.6],
          [0, -0.04, length * 0.42],
          [side * width * 0.55, 0.06, length * 0.6],
          [0, -0.04, length * 0.5],
        ],
        skin,
        root,
      );
    }
    if (orca)
      for (const side of [-1, 1]) {
        const patch = mesh(
          new THREE.SphereGeometry(1, 10, 7),
          material('#e5e9db'),
          root,
          side * width * 0.38,
          0.16,
          -length * 0.23,
        );
        patch.scale.set(0.06, 0.19, 0.33);
        patch.rotation.z = -side * 0.5;
      }
    root.userData.length = length;
    return root;
  }
  const seaLion = species === 'seaLion';
  const skin = material(seaLion ? '#6a5140' : '#64716d', 0.42);
  const body = mesh(new THREE.SphereGeometry(1, 12, 9), skin, root, 0, 0.13, 0.15);
  body.scale.set(seaLion ? 0.48 : 0.36, 0.35, seaLion ? 1.05 : 0.8);
  const neck = mesh(new THREE.SphereGeometry(1, 10, 7), skin, root, 0, 0.35, -0.65);
  neck.scale.set(0.29, seaLion ? 0.5 : 0.28, 0.35);
  const muzzle = mesh(new THREE.SphereGeometry(1, 8, 6), skin, root, 0, 0.44, -0.96);
  muzzle.scale.set(0.2, 0.16, 0.24);
  for (const side of [-1, 1])
    fin(
      [
        [side * 0.2, 0.13, -0.1],
        [side * 0.83, -0.02, 0.27],
        [side * 0.45, 0.0, 0.65],
      ],
      skin,
      root,
    );
  fin(
    [
      [-0.16, 0.04, 0.85],
      [-0.4, 0.03, 1.2],
      [0.2, 0.06, 1.05],
      [0.16, 0.04, 0.85],
      [0.4, 0.03, 1.2],
      [-0.2, 0.06, 1.05],
    ],
    skin,
    root,
  );
  return root;
}

export class CoastalLife {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Physical driftwood and living wildlife';
    scene.add(this.group);
    this.animals = new Map();
    this.logs = null;
    this.logCapacity = 0;
    this.object = new THREE.Object3D();
  }
  buildLogs(capacity) {
    if (this.logGroup) {
      this.group.remove(this.logGroup);
      destroy(this.logGroup);
    }
    this.logGroup = new THREE.Group();
    this.group.add(this.logGroup);
    this.logCapacity = capacity;
    const bark = material('#615342', 0.9),
      cut = material('#998568', 0.88);
    const shape = new THREE.CylinderGeometry(0.87, 1, 1, 10);
    shape.rotateX(Math.PI / 2);
    this.logs = new THREE.InstancedMesh(shape, [bark, cut, cut], capacity);
    this.logs.name = 'Collision timber · real simulation positions';
    this.logs.castShadow = true;
    this.logs.receiveShadow = true;
    this.logs.frustumCulled = false;
    this.logGroup.add(this.logs);
    this.branches = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.45, 0.85, 1, 6),
      bark,
      capacity,
    );
    this.branches.frustumCulled = false;
    this.logGroup.add(this.branches);
  }
  update(world, elapsed) {
    const range = visibilityRange(world);
    const logs = (world.logs || []).filter(
      (log) => Math.hypot(log.x - world.boat.x, log.y - world.boat.y) <= range,
    );
    if (logs.length > this.logCapacity) this.buildLogs(Math.max(72, logs.length + 32));
    if (this.logs) {
      this.logs.count = logs.length;
      this.branches.count = 0;
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i],
          o = this.object;
        const bob = Math.sin(elapsed * 0.7 + (log.phase || 0)) * 0.025;
        o.position.set(log.x, -log.radius * 0.3 + bob, log.y);
        o.rotation.set(Math.sin(elapsed * 0.51 + i) * 0.013, -log.heading, 0);
        o.scale.set(log.radius, log.radius, log.length);
        o.updateMatrix();
        this.logs.setMatrixAt(i, o.matrix);
        if (log.radius > 0.2 && i % 3 === 0) {
          o.position.x += Math.sin(log.heading) * log.length * 0.2;
          o.position.z -= Math.cos(log.heading) * log.length * 0.2;
          o.position.y += log.radius * 0.52;
          o.rotation.set(0.48, -log.heading, -0.55);
          o.scale.set(log.radius * 0.3, log.radius * 1.2, log.radius * 0.3);
          o.updateMatrix();
          this.branches.setMatrixAt(this.branches.count++, o.matrix);
        }
      }
      this.logs.instanceMatrix.needsUpdate = true;
      this.branches.instanceMatrix.needsUpdate = true;
    }
    const active = new Set();
    for (const encounter of world.wildlife?.encounters || []) {
      for (let i = 0; i < encounter.members.length; i++) {
        const member = encounter.members[i];
        const key = `${encounter.id}:${i}`;
        active.add(key);
        let model = this.animals.get(key);
        if (!model) {
          model = animal(encounter.species);
          this.animals.set(key, model);
          this.group.add(model);
        }
        model.visible = !cetaceans.has(encounter.species) || member.surfaced;
        if (encounter.state === 'diving' && !member.surfaced) model.visible = false;
        if (Math.hypot(encounter.x - world.boat.x, encounter.y - world.boat.y) > range)
          model.visible = false;
        const x = encounter.x + member.offsetX,
          z = encounter.y + member.offsetY;
        let height = 0.08;
        if (birds.has(encounter.species)) {
          const perched = encounter.state === 'perched';
          const rock = perched && world.rocks?.find((r) => r.id === encounter.rockId);
          height = perched
            ? Math.max(
                0.15,
                rock
                  ? -rock.topDepth - seaLevel(world)
                  : -bedDepthAt(world.terrain, x, z) - seaLevel(world),
              ) + 0.3
            : 8 + Math.sin(elapsed * 0.25 + member.phase) * 1.3;
          for (const wing of model.userData.wings)
            wing.mesh.rotation.z = perched
              ? wing.side * -1.25
              : wing.side *
                (Math.sin(elapsed * (encounter.species === 'goose' ? 4 : 2.5) + member.phase) *
                  0.3 +
                  0.05);
        } else if (encounter.state === 'hauled') {
          const rock = world.rocks?.find((r) => r.id === encounter.rockId);
          height = Math.max(0.15, rock ? -rock.topDepth - seaLevel(world) : 0.15);
        } else height += Math.sin(elapsed * 0.85 + member.phase) * 0.06;
        model.position.set(x, height, z);
        model.rotation.y = -encounter.heading;
      }
    }
    for (const [key, model] of this.animals)
      if (!active.has(key)) {
        this.group.remove(model);
        destroy(model);
        this.animals.delete(key);
      }
  }
  dispose() {
    destroy(this.group);
    this.scene.remove(this.group);
    this.animals.clear();
  }
}
