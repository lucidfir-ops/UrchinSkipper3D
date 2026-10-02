import * as THREE from 'three';
import { debrisCurrent } from '../world.js';
import { depthAt } from '../terrain.js';
import { visibilityRange } from '../assists.js';
import { coastalDaylight } from './water-optics.js';

const capacity = 1400;
const clamp = (value) => Math.max(0, Math.min(1, value));

// Floating weed and broken sea foam belong to the water, not an information
// assist. Read the same advected particles as the simulation; never add a
// second visual current or reveal the hidden fishing ground.
export function surfaceDriftPose(world, item, range = visibilityRange(world)) {
  const distance = Math.hypot(item.x - world.boat.x, item.y - world.boat.y);
  if (distance >= range || depthAt(world, item.x, item.y) <= 0.08) return null;
  const flow = debrisCurrent(world, item),
    speed = Math.hypot(flow.x || 0, flow.y || 0),
    phase = item.phase || 0,
    variation = (Math.sin(phase * 71.7) + 1) / 2,
    weed = variation > 0.72,
    fade = clamp((range - distance) / Math.max(8, range * 0.28)),
    day = coastalDaylight(world.day.minute ?? 600);
  return {
    x: item.x,
    y: item.y,
    heading: speed > 0.015 ? Math.atan2(flow.x, flow.y) : phase,
    width: (weed ? 0.25 : 0.42) + variation * 0.22,
    length: (weed ? 0.7 : 0.8) + variation * 0.6 + Math.min(1.2, speed * 0.38),
    opacity: fade * (weed ? 0.48 : 0.31) * (0.1 + day * 0.9),
    weed,
    phase,
  };
}

export class SurfaceDrift extends THREE.Group {
  constructor() {
    super();
    this.name = 'Current-borne sea foam and weed';
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.opacity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.opacity.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('driftOpacity', this.opacity);
    this.material = new THREE.MeshBasicMaterial({
      color: '#d5ded0',
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nattribute float driftOpacity;\nvarying float vDriftOpacity;\nvarying vec2 vDriftUv;',
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvDriftOpacity = driftOpacity;\nvDriftUv = uv;',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying float vDriftOpacity;\nvarying vec2 vDriftUv;',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
          vec2 q = vDriftUv - .5;
          float a = exp(-dot(q * vec2(6.0, 4.1), q * vec2(6.0, 4.1)));
          vec2 r = q - vec2(.15,.21);
          float b = exp(-dot(r * vec2(12.0, 9.0), r * vec2(12.0, 9.0)));
          vec2 s = q + vec2(.14,.26);
          float c = exp(-dot(s * vec2(10.0, 12.0), s * vec2(10.0, 12.0)));
          float broken = .58 + .42 * sin(vDriftUv.y * 32.0 + vDriftUv.x * 17.0);
          diffuseColor.a *= max(a * broken, max(b,c)) * vDriftOpacity;
          if (diffuseColor.a < .004) discard;`,
      );
    };
    this.material.customProgramCacheKey = () => 'surface-drift-v1';
    this.mesh = new THREE.InstancedMesh(geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.pose = new THREE.Object3D();
    this.color = new THREE.Color();
    this.add(this.mesh);
  }
  update(world, width, height) {
    const range = visibilityRange(world),
      day = coastalDaylight(world.day.minute ?? 600);
    let count = 0;
    for (const item of world.debris) {
      if (
        count >= capacity ||
        Math.abs(item.x - world.boat.x) > width / 2 + 3 ||
        Math.abs(item.y - world.boat.y) > height / 2 + 3
      )
        continue;
      const drift = surfaceDriftPose(world, item, range);
      if (!drift) continue;
      this.pose.position.set(drift.x, 0.11, drift.y);
      this.pose.rotation.set(0, drift.heading, 0);
      this.pose.scale.set(drift.width, 1, drift.length);
      this.pose.updateMatrix();
      this.mesh.setMatrixAt(count, this.pose.matrix);
      this.opacity.setX(count, drift.opacity);
      this.color.set(drift.weed ? '#84916a' : '#e2e6d6');
      this.color.multiplyScalar(0.2 + day * 0.8);
      this.mesh.setColorAt(count++, this.color);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.opacity.needsUpdate = true;
  }
}
