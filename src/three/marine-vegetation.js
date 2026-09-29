import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { currentAt } from '../environment.js';
import { seaLevel } from '../terrain.js';
import { kelpPatches, eelgrassPatches } from './kelp-patches.js';
import { waterColumnMaterials, waterTurbidity } from './water-optics.js';

function part(geometry, kind) {
  geometry.deleteAttribute('uv');
  geometry.setAttribute(
    'plantPart',
    new THREE.Float32BufferAttribute(
      new Float32Array(geometry.attributes.position.count).fill(kind),
      1,
    ),
  );
  return geometry;
}
function ribbons({ grass = false, variant = 0 } = {}) {
  const positions = [],
    indices = [];
  const blades = grass ? 1 : 7;
  for (let blade = 0; blade < blades; blade++) {
    const start = positions.length / 3;
    const phase = blade * 2.39996 + variant * 1.7;
    const length = grass ? 1 : 2.8 + (Math.sin(phase * 3) * 0.5 + 0.5) * 2.5;
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const halfWidth = grass
        ? 0.034 * Math.sin(Math.PI * t) ** 0.5 + 0.004 * (1 - t)
        : (0.085 + blade * 0.009) * Math.sin(Math.PI * t) ** 0.65 + 0.012 * (1 - t);
      for (const side of [-1, 0, 1]) {
        if (grass) positions.push(side * halfWidth, t, t * t * 0.25);
        else
          positions.push(
            t * length,
            Math.sin(t * 13 + phase) * t * 0.085 + (1 - Math.abs(side)) * halfWidth * 0.35,
            Math.sin(phase) * t * 1.15 + Math.sin(t * 8 + phase) * t * 0.22 + side * halfWidth,
          );
      }
      if (i < 14) {
        const a = start + i * 3;
        indices.push(
          a,
          a + 1,
          a + 3,
          a + 1,
          a + 4,
          a + 3,
          a + 1,
          a + 2,
          a + 4,
          a + 2,
          a + 5,
          a + 4,
        );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return part(geometry, 2);
}
function bullKelpGeometry(variant) {
  const stipe = new THREE.CylinderGeometry(0.065, 0.025, 1, 5, 14);
  stipe.translate(0, 0.5, 0);
  const bulb = new THREE.SphereGeometry(0.19, 10, 7);
  bulb.scale(1.25, 0.85, 1);
  const sources = [part(stipe, 0), part(bulb, 1), ribbons({ variant })];
  const geometry = mergeGeometries(sources);
  sources.forEach((g) => g.dispose());
  return geometry;
}

export class MarineVegetation {
  constructor(parent, world) {
    this.group = new THREE.Group();
    this.group.name = 'Eelgrass meadows and floating bull kelp';
    parent.add(this.group);
    this.kelp = kelpPatches(world.terrain);
    this.grass = eelgrassPatches(world.terrain);
    this.cells = [];
    this.time = { value: 0 };
    this.tide = { value: seaLevel(world) };
    this.materials = [];
    this.build(this.grass, true);
    this.build(this.kelp, false);
    this.nextFlow = 0;
  }
  build(plants, grass) {
    if (!plants.length) return;
    const base = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: grass ? 0.8 : 0.48,
      side: THREE.DoubleSide,
    });
    const column = waterColumnMaterials({ plant: base });
    base.dispose();
    this.materials.push(column);
    const material = column.materials.plant;
    const compile = material.onBeforeCompile;
    material.onBeforeCompile = (shader) => {
      compile(shader);
      shader.uniforms.uPlantTime = this.time;
      shader.uniforms.uPlantTide = this.tide;
      shader.vertexShader =
        `uniform float uPlantTime;
        uniform float uPlantTide;
        attribute vec2 plantSize;
        attribute float plantPart;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n' +
          (grass
            ? `
          float t = position.y;
          float height = t * plantSize.y;
          float water = max(.1, plantSize.x + uPlantTide - .1);
          transformed.y = min(height, water);
          transformed.x += max(0.0, height-water)*.7;
          transformed.x += t*t*(.35 + plantSize.y*.2);
          transformed.z += sin(uPlantTime*.8 + instanceMatrix[3].x + t*4.0)*t*t*.12;
        `
            : `
          float wetDepth = max(0.0, plantSize.x + uPlantTide);
          float slack = max(0.0, plantSize.y - wetDepth);
          float reach = .7 + slack*.85;
          float top = min(plantSize.y, wetDepth+.035);
          float phase = instanceMatrix[3].x*.43 + instanceMatrix[3].z*.21;
          if (plantPart < .5) {
            float t = position.y;
            transformed.x += reach*t;
            float rise = smoothstep(0.0, min(1.0, wetDepth/plantSize.y+.18), t);
            transformed.y = top*rise;
            transformed.z += sin(t*5.0+phase+uPlantTime*.7)*t*.06;
          } else if (plantPart < 1.5) {
            transformed.x += reach;
            transformed.y += top;
          } else {
            float t = position.x / 5.3;
            transformed.x += reach;
            transformed.y += top - t*t*(.12 + max(0.0, 1.5-slack)*.32);
            transformed.z += sin(position.x*2.6+phase+uPlantTime*.9)*t*.16;
          }
        `),
      );
    };
    material.customProgramCacheKey = () => (grass ? 'eelgrass-v1' : 'bull-kelp-v1');
    const shapes = grass ? [ribbons({ grass: true })] : [0, 1, 2].map(bullKelpGeometry);
    const cells = new Map();
    for (const p of plants) {
      const variant = grass ? 0 : Math.min(2, Math.floor(p.tint * 3));
      const key = `${Math.floor(p.x / 64)}:${Math.floor(p.z / 64)}:${variant}`;
      if (!cells.has(key)) cells.set(key, { variant, plants: [] });
      cells.get(key).plants.push(p);
    }
    const pose = new THREE.Object3D(),
      color = new THREE.Color();
    for (const { variant, plants: cell } of cells.values()) {
      const geometry = shapes[variant].clone();
      geometry.setAttribute(
        'plantSize',
        new THREE.InstancedBufferAttribute(
          new Float32Array(cell.flatMap((p) => [p.depth, p.length])),
          2,
        ),
      );
      const mesh = new THREE.InstancedMesh(geometry, material, cell.length);
      mesh.name = grass
        ? 'Separate eelgrass blades · 2–6 m'
        : 'Bull kelp stipes, floats and ribbons · 4–10 m';
      mesh.renderOrder = 2;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      cell.forEach((p, i) => {
        pose.position.set(p.x, p.y, p.z);
        pose.rotation.y = p.variation * Math.PI * 2;
        pose.scale.set(0.7 + p.variation * 0.6, 1, 0.7 + p.tint * 0.6);
        pose.updateMatrix();
        mesh.setMatrixAt(i, pose.matrix);
        color.set(grass ? '#436c25' : '#61480e');
        color.lerp(new THREE.Color(grass ? '#779f3d' : '#90832a'), p.tint);
        mesh.setColorAt(i, color);
      });
      mesh.computeBoundingSphere();
      mesh.boundingSphere.radius += grass ? 4 : 20;
      this.group.add(mesh);
      this.cells.push({ mesh, plants: cell, grass });
    }
    shapes.forEach((g) => g.dispose());
  }
  update(world, elapsed) {
    this.time.value = elapsed;
    const tide = seaLevel(world);
    this.tide.value = tide;
    this.group.position.y = -tide;
    if (elapsed >= this.nextFlow) {
      this.nextFlow = elapsed + 0.25;
      const pose = new THREE.Object3D();
      for (const { mesh, plants } of this.cells) {
        plants.forEach((p, i) => {
          const flow = currentAt(world, p.x, p.z);
          // Retain the last direction at slack water; no arbitrary snapping.
          if (Math.hypot(flow.x, flow.y) > 0.015) p.angle = -Math.atan2(flow.y, flow.x);
          pose.position.set(p.x, p.y, p.z);
          pose.rotation.y = p.angle ?? p.variation * Math.PI * 2;
          pose.scale.set(0.7 + p.variation * 0.6, 1, 0.7 + p.tint * 0.6);
          pose.updateMatrix();
          mesh.setMatrixAt(i, pose.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    for (const column of this.materials) {
      column.uniforms.uColumnTime.value = elapsed;
      column.uniforms.uColumnTurbidity.value = waterTurbidity(world);
      column.uniforms.uColumnLight.value = world.weather?.sunlight ?? 1;
    }
  }
  dispose() {
    for (const { mesh } of this.cells) mesh.geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.group.removeFromParent();
  }
}
