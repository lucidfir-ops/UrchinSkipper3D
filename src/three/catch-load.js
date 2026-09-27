import * as THREE from 'three';
import { deckMarkers } from '../presentation.js';

export function catchNetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#511c2b';
  ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++)
    for (let column = 0; column < 16; column++) {
      const x = column * 17 + (row % 2) * 8,
        y = row * 17;
      ctx.fillStyle = ['#271e27', '#3c2231', '#713443'][(row + column) % 3];
      ctx.beginPath();
      ctx.arc(x, y, 6 + (column % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.strokeStyle = '#be3746';
  ctx.lineWidth = 2.7;
  for (let n = -256; n < 512; n += 16) {
    ctx.beginPath();
    ctx.moveTo(n, 0);
    ctx.lineTo(n + 256, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(n, 0);
    ctx.lineTo(n - 256, 256);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,151,139,.35)';
  ctx.lineWidth = 0.7;
  for (let n = -256; n < 512; n += 16) {
    ctx.beginPath();
    ctx.moveTo(n + 1, 0);
    ctx.lineTo(n + 257, 256);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// One red net sack per original recovered bag, at the definitive deckMarkers
// positions. A growing instance pool keeps large layered loads inexpensive.
export class CatchLoad {
  constructor(parent, material, cordMaterial) {
    this.group = new THREE.Group();
    this.group.userData.dynamic = true;
    this.geometry = new THREE.SphereGeometry(1, 20, 12);
    const vertices = this.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i),
        y = vertices.getY(i),
        z = vertices.getZ(i);
      const gather = y > 0.4 ? 1 - (y - 0.4) * 1.12 : 1;
      const folds = 1 + Math.sin(Math.atan2(z, x) * 8) * Math.max(0, y) * 0.055;
      vertices.setXYZ(i, x * gather * folds, y, z * gather * folds);
    }
    this.geometry.computeVertexNormals();
    this.knotGeometry = new THREE.SphereGeometry(1, 8, 6);
    this.material = material;
    this.cordMaterial = cordMaterial;
    this.capacity = 0;
    this.key = '';
    this.markers = [];
    this.transform = new THREE.Object3D();
    parent.add(this.group);
    this.grow(64);
  }
  grow(capacity) {
    const bodyMaterial = this.bodies?.material || this.material;
    const knotMaterial = this.knots?.material || this.cordMaterial;
    for (const mesh of [this.bodies, this.knots])
      if (mesh) {
        mesh.removeFromParent();
        mesh.dispose();
      }
    this.capacity = capacity;
    this.bodies = new THREE.InstancedMesh(this.geometry, bodyMaterial, capacity);
    this.knots = new THREE.InstancedMesh(this.knotGeometry, knotMaterial, capacity);
    for (const mesh of [this.bodies, this.knots]) {
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
    }
  }
  update(bags, spec) {
    const key = `${bags.length}:${spec.width}:${spec.length}`;
    if (this.key === key) return;
    this.key = key;
    if (bags.length > this.capacity) this.grow(2 ** Math.ceil(Math.log2(bags.length)));
    this.markers = deckMarkers(bags, spec);
    this.bodies.count = this.knots.count = this.markers.length;
    this.markers.forEach((mark, i) => {
      const x = (mark.x * spec.width) / 4,
        z = (mark.y * spec.length) / 10;
      const y = 0.88 + mark.radius * 0.64 + mark.layer * 0.67;
      this.transform.position.set(x, y, z);
      this.transform.rotation.set(0, (i * 2.399) % (Math.PI * 2), 0);
      this.transform.scale.set(mark.radius, mark.radius * 0.64, mark.radius);
      this.transform.updateMatrix();
      this.bodies.setMatrixAt(i, this.transform.matrix);
      this.transform.position.set(x + 0.045, y + mark.radius * 0.64, z - 0.04);
      this.transform.scale.set(0.075, 0.11, 0.07);
      this.transform.updateMatrix();
      this.knots.setMatrixAt(i, this.transform.matrix);
    });
    this.bodies.instanceMatrix.needsUpdate = this.knots.instanceMatrix.needsUpdate = true;
  }
}
