import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { kelpMotion } from './kelp-motion.js';
import { currentAt } from '../environment.js';
import { seaLevel } from '../terrain.js';
import { kelpPatches, eelgrassPatches } from './kelp-patches.js';
import { waterColumnMaterials, waterTurbidity } from './water-optics.js';

function part(geometry, kind) {
  geometry.deleteAttribute('uv');
  if (!geometry.hasAttribute('plantBlade'))
    geometry.setAttribute(
      'plantBlade',
      new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count), 1),
    );
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
    indices = [],
    phases = [];
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
        phases.push(phase);
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
  geometry.setAttribute('plantBlade', new THREE.Float32BufferAttribute(phases, 1));
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
    this.flowBlend = { value: 1 };
    this.lastFlow = null;
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
      shader.uniforms.uFlowBlend = this.flowBlend;
      shader.vertexShader =
        `uniform float uPlantTime;
        uniform float uPlantTide;
        uniform float uFlowBlend;
        attribute vec3 plantFlow;
        attribute vec3 previousFlow;
        attribute vec2 plantSize;
        attribute float plantBlade;
        attribute float plantPart;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvec3 flow = mix(previousFlow, plantFlow, uFlowBlend);\n' +
          (grass
            ? `
          float t = position.y;
          float height = t * plantSize.y;
          float water = max(.1, plantSize.x + uPlantTide - .1);
          transformed.y = min(height, water);
          transformed.x += max(0.0, height-water)*.7;
          transformed.x += t*t*(.12 + plantSize.y*.3)*(.22+.78*flow.y);
          transformed.z += sin(uPlantTime*.8 + instanceMatrix[3].x + t*4.0)*t*t*.12;
        `
            : `
          float wetDepth = max(0.0, plantSize.x + uPlantTide);
          float slack = max(0.0, plantSize.y - wetDepth);
          float reach = (.35 + slack*.85)*(.42+.58*flow.y);
          float top = min(sqrt(max(.01, plantSize.y*plantSize.y-reach*reach)), wetDepth+.035);
          float phase = instanceMatrix[3].x*.43 + instanceMatrix[3].z*.21;
          if (plantPart < .5) {
            float t = position.y;
            transformed.x += reach*t*t;
            float rise = smoothstep(0.0, min(1.0, wetDepth/plantSize.y+.18), t);
            transformed.y = top*rise;
            transformed.z += sin(t*5.0+phase+uPlantTime*.7)*t*.06;
          } else if (plantPart < 1.5) {
            transformed.x += reach;
            transformed.y += top;
          } else {
            float t = position.x / 5.3;
            float looseness = 1.0-flow.y;
            // Ribbons keep their length: slack gathers in broad folds instead
            // of a rigid half-turn. The tips follow later than the bulb.
            float curl = looseness*(3.1+sin(phase+plantBlade)*1.1);
            float handed = sin(phase+plantBlade*.7) < 0.0 ? -1.0 : 1.0;
            float bend = (flow.z-flow.x)*t + handed*curl*t;
            // Integrate a curved blade, retaining its arclength instead of
            // squeezing a sine wave into an accordion at slack water.
            float sinc = abs(bend)<.001 ? 1.0 : sin(bend)/bend;
            float arc = abs(bend)<.001 ? 0.0 : (1.0-cos(bend))/bend;
            transformed.x = reach + position.x*sinc;
            transformed.z = position.z + position.x*arc;
            transformed.y += top - t*t*(.12 + max(0.0, 1.5-slack)*.32)
              - sin(t*3.0+phase+plantBlade)*t*looseness*.10;
            transformed.z += sin(position.x*2.6+phase+uPlantTime*.9)*t*.16;
          }
        `) +
          `
          float c = cos(flow.x), s = sin(flow.x);
          transformed.xz = mat2(c,-s,s,c) * transformed.xz;
        `,
      );
    };
    material.customProgramCacheKey = () => (grass ? 'eelgrass-flow-v2' : 'bull-kelp-flow-v2');
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
      const motions = new Float32Array(cell.length * 3);
      for (const name of ['plantFlow', 'previousFlow']) {
        geometry.setAttribute(
          name,
          new THREE.InstancedBufferAttribute(motions.slice(), 3).setUsage(THREE.DynamicDrawUsage),
        );
      }
      const mesh = new THREE.InstancedMesh(geometry, material, cell.length);
      mesh.name = grass
        ? 'Separate eelgrass blades · 2–6 m'
        : 'Bull kelp stipes, floats and ribbons · 4–10 m';
      mesh.renderOrder = 2;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      cell.forEach((p, i) => {
        pose.position.set(p.x, p.y, p.z);
        pose.rotation.y = 0;
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
      const initial = this.lastFlow === null;
      const dt = initial ? 0 : Math.min(0.25, elapsed - this.lastFlow);
      this.lastFlow = elapsed;
      this.nextFlow = elapsed + 0.1;
      for (const { mesh, plants } of this.cells) {
        const next = mesh.geometry.attributes.plantFlow;
        const previous = mesh.geometry.attributes.previousFlow;
        previous.array.set(next.array);
        plants.forEach((p, i) => {
          p.motion = kelpMotion(currentAt(world, p.x, p.z), p.variation, p.motion, dt);
          p.angle = p.motion.angle;
          next.setXYZ(i, p.motion.angle, p.motion.extension, p.motion.tip);
        });
        if (initial) previous.array.set(next.array);
        previous.needsUpdate = next.needsUpdate = true;
      }
    }
    // Interpolate sampled poses in the vertex shader for smooth motion even
    // though local current is only sampled ten times per second.
    this.flowBlend.value = Math.min(1, Math.max(0, (elapsed - this.lastFlow) / 0.1));
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
