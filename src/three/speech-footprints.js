import * as THREE from 'three';

const corners = (box, visit) => {
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) visit(x, y, z);
};

// The authored ownship envelope is cached once per model, not recursively
// recomputed while a notice is displayed. Its full height and port ladder are
// included. Small child animation is covered conservatively by the local pad.
export class SpeechFootprints {
  constructor() {
    this.boats = new WeakMap();
    this.loads = new WeakMap();
    this.point = new THREE.Vector3();
    this.matrix = new THREE.Matrix4();
    this.projection = new THREE.Matrix4();
  }
  localBoatBounds(group) {
    if (this.boats.has(group)) return this.boats.get(group);
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert(),
      box = new THREE.Box3();
    group.traverse((object) => {
      // Instanced catch sacks have independent, changing transforms. Their
      // load-specific envelope is calculated below when the load changes.
      if (!object.isMesh || object.isInstancedMesh) return;
      object.geometry.computeBoundingBox();
      this.matrix.multiplyMatrices(inverse, object.matrixWorld);
      corners(object.geometry.boundingBox, (x, y, z) => {
        box.expandByPoint(this.point.set(x, y, z).applyMatrix4(this.matrix));
      });
    });
    box.expandByScalar(0.35);
    this.boats.set(group, box);
    return box;
  }
  localLoadBounds(load) {
    const meshes = [load.bodies, load.knots],
      key = `${load.key}/${meshes.map((mesh) => `${mesh.id}:${mesh.count}:${mesh.visible}:${mesh.instanceMatrix.version}`).join('/')}`,
      cached = this.loads.get(load);
    if (cached?.key === key) return cached.box;
    load.group.updateWorldMatrix(true, true);
    const inverse = load.group.matrixWorld.clone().invert(),
      box = new THREE.Box3();
    for (const mesh of meshes) {
      if (!mesh.visible || !mesh.count) continue;
      // Three unions geometry bounds using every live instance transform.
      // This work is bounded by load changes, not the render frame rate.
      mesh.computeBoundingBox();
      this.matrix.multiplyMatrices(inverse, mesh.matrixWorld);
      corners(mesh.boundingBox, (x, y, z) => {
        box.expandByPoint(this.point.set(x, y, z).applyMatrix4(this.matrix));
      });
    }
    this.loads.set(load, { key, box });
    return box;
  }
  bounds(box, matrix, viewport) {
    const rect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    corners(box, (x, y, z) => {
      const p = this.point.set(x, y, z).applyMatrix4(matrix),
        sx = ((p.x + 1) * viewport.width) / 2,
        sy = ((1 - p.y) * viewport.height) / 2;
      rect.left = Math.min(rect.left, sx);
      rect.top = Math.min(rect.top, sy);
      rect.right = Math.max(rect.right, sx);
      rect.bottom = Math.max(rect.bottom, sy);
    });
    return rect;
  }
  visibleBounds(group, viewport) {
    if (!group.visible) return null;
    group.updateWorldMatrix(true, true);
    const rect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    group.traverseVisible((object) => {
      if (!object.geometry) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      this.matrix.multiplyMatrices(this.projection, object.matrixWorld);
      const next = this.bounds(object.geometry.boundingBox, this.matrix, viewport);
      rect.left = Math.min(rect.left, next.left);
      rect.top = Math.min(rect.top, next.top);
      rect.right = Math.max(rect.right, next.right);
      rect.bottom = Math.max(rect.bottom, next.bottom);
    });
    return Number.isFinite(rect.left) ? rect : null;
  }
  read(vessels, world, camera, viewport, cues) {
    const result = [];
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (vessels.boat?.visible) {
      const box = this.localBoatBounds(vessels.boat);
      vessels.boat.updateWorldMatrix(true, false);
      this.matrix.multiplyMatrices(this.projection, vessels.boat.matrixWorld);
      result.push({ kind: 'boat', ...this.bounds(box, this.matrix, viewport) });
      const load = vessels.boat.userData.catchLoad;
      if (load?.group.visible) {
        const loadBox = this.localLoadBounds(load);
        if (!loadBox.isEmpty()) {
          load.group.updateWorldMatrix(true, false);
          this.matrix.multiplyMatrices(this.projection, load.group.matrixWorld);
          result.push({ kind: 'deck-load', ...this.bounds(loadBox, this.matrix, viewport) });
        }
      }
    }
    for (const [index, visual] of vessels.divers.entries()) {
      if (world.divers[index]?.state !== 'surface') continue;
      const rect = this.visibleBounds(visual.group, viewport);
      if (rect) result.push({ kind: 'surface-person', ...rect });
    }
    if (cues?.group.visible && cues.ring.visible) {
      const rect = this.visibleBounds(cues.ring, viewport);
      if (rect) result.push({ kind: 'visible-selection-ring', ...rect });
    }
    return result;
  }
}
