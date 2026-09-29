import * as THREE from 'three';
import { currentAt } from '../environment.js';
import { depthAt } from '../terrain.js';

// Sample a lattice fixed to chart coordinates. Panning/following only changes
// which samples are in view; it never moves a sample with the boat.
export function currentGrid(x, y, width, height) {
  const bounds = {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
  };
  const spacing = 24 * 2 ** Math.max(0, Math.ceil(Math.log2((bounds.right - bounds.left) / 600)));
  const points = [];
  for (let z = Math.floor(bounds.top / spacing) * spacing; z <= bounds.bottom; z += spacing)
    for (let x = Math.floor(bounds.left / spacing) * spacing; x <= bounds.right; x += spacing)
      points.push({ x, y: z, spacing });
  return points;
}
export class CurrentField extends THREE.Group {
  constructor() {
    super();
    const shape = new THREE.Shape();
    shape.moveTo(0, -1);
    shape.lineTo(-0.36, -0.28);
    shape.lineTo(-0.11, -0.36);
    shape.lineTo(-0.11, 1);
    shape.lineTo(0.11, 1);
    shape.lineTo(0.11, -0.36);
    shape.lineTo(0.36, -0.28);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(Math.PI / 2);
    this.arrows = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: '#a9d2bd',
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      1600,
    );
    this.arrows.frustumCulled = false;
    this.arrows.renderOrder = 2;
    this.arrows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.add(this.arrows);
    this.pose = new THREE.Object3D();
  }
  update(world, width, height) {
    if (!this.visible) return;
    const centre = world.boat;
    const points = currentGrid(centre.x, centre.y, width, height);
    let count = 0;
    for (const p of points) {
      if (
        count >= 1600 ||
        p.x < 0 ||
        p.y < 0 ||
        p.x > world.terrain.size ||
        p.y > world.terrain.size ||
        depthAt(world, p.x, p.y) < 0.3
      )
        continue;
      const flow = currentAt(world, p.x, p.y),
        speed = Math.hypot(flow.x, flow.y);
      if (speed < 0.035) continue;
      this.pose.position.set(p.x, 0.2, p.y);
      this.pose.rotation.set(0, -Math.atan2(flow.x, -flow.y), 0);
      const size = Math.min(p.spacing * 0.28, (2 + speed * 3) * (p.spacing / 24));
      this.pose.scale.setScalar(size);
      this.pose.updateMatrix();
      this.arrows.setMatrixAt(count++, this.pose.matrix);
    }
    this.arrows.count = count;
    this.arrows.instanceMatrix.needsUpdate = true;
    this.userData.samples = points;
  }
}
