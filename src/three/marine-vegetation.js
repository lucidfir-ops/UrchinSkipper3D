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
// One eelgrass blade; bull kelp blades are built by bladeGeometry below.
function grassBlade() {
  const positions = [],
    indices = [],
    phases = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const halfWidth = 0.034 * Math.sin(Math.PI * t) ** 0.5 + 0.004 * (1 - t);
    for (const side of [-1, 0, 1]) {
      phases.push(0);
      positions.push(side * halfWidth, t, t * t * 0.25);
    }
    if (i < 14) {
      const a = i * 3;
      indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.setAttribute('plantBlade', new THREE.Float32BufferAttribute(phases, 1));
  geometry.computeVertexNormals();
  return part(geometry, 2);
}
// October 5 bull kelp (Nereocystis): a long whip-like stipe, one round air
// bulb, and a few long, narrow blades streaming together downstream. The
// stipe is a unit tube (position.y = arclength fraction, xz = cross-section)
// that the vertex shader lays along a closed-form path from tide and current:
// rising from the holdfast, then floating along the surface when it is longer
// than the water is deep. No physics; one shape per variant, instanced.
function stipeGeometry() {
  const rings = 40,
    sides = 5,
    positions = [],
    indices = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings,
      radius = 0.024 + 0.076 * t * t;
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, t, Math.sin(a) * radius);
      if (i < rings) {
        const a0 = i * sides + j,
          a1 = i * sides + ((j + 1) % sides);
        indices.push(a0, a1, a0 + sides, a1, a1 + sides, a0 + sides);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function bladeGeometry(variant) {
  const positions = [],
    indices = [],
    blades = [];
  const count = 4 + variant;
  for (let blade = 0; blade < count; blade++) {
    const start = positions.length / 3,
      spread = count > 1 ? (blade / (count - 1)) * 2 - 1 : 0,
      length = 2.1 + (Math.sin(blade * 2.39996 + variant * 1.7) * 0.5 + 0.5) * 1.5;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12,
        halfWidth = 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) ** 0.7 + 0.006;
      for (const side of [-1, 1]) {
        positions.push(t * length, 0, side * halfWidth);
        blades.push(spread);
      }
      if (i < 12) {
        const a = start + i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.setAttribute('plantBlade', new THREE.Float32BufferAttribute(blades, 1));
  geometry.computeVertexNormals();
  return geometry;
}
function bullKelpGeometry(variant) {
  const bulb = new THREE.SphereGeometry(0.24, 12, 8);
  bulb.scale(1.3, 0.8, 1);
  const sources = [part(stipeGeometry(), 0), part(bulb, 1), part(bladeGeometry(variant), 2)];
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
          // Water depth over the holdfast, stipe length and current extension.
          float D = max(0.0, plantSize.x + uPlantTide);
          float L = plantSize.y;
          float e = clamp(flow.y, 0.0, 1.0);
          float looseness = 1.0 - e;
          float phase = instanceMatrix[3].x*.43 + instanceMatrix[3].z*.21;
          // Current leans the rising stipe; buoyancy keeps it near vertical.
          float lean = .1 + .55*e;
          float cosT = inversesqrt(1.0 + lean*lean);
          float sinT = lean*cosT;
          float R = D/max(cosT, .05);
          float rise = min(L, R);
          // Stipe longer than the water column floats along the surface,
          // streamlined in current and loosely meandering at slack.
          float S = max(0.0, L - R);
          float stretch = .45 + .55*e;
          float amp = .05 + .3*looseness;
          float k = 1.05 - .35*e;
          // Lateral meander of the floating stipe, zero where it surfaces.
          #define KELP_MEANDER(u) (amp*(sin(k*(u) + phase) - sin(phase) + .45*(sin(2.3*k*(u) + phase*1.7) - sin(phase*1.7))))
          vec3 bulbAt = S > 0.0
            ? vec3(rise*sinT + S*stretch, D - .02, KELP_MEANDER(S))
            : vec3(rise*sinT, rise*cosT, 0.0);
          if (plantPart < .5) {
            float s = position.y*L;
            // Rising and floating paths, each extended past the waterline, are
            // blended over a short span so the stipe bends smoothly at the top.
            float u = s - rise;
            // Where the stipe surfaces it follows a quadratic curve from the
            // rising line, through the waterline corner, onto the surface.
            float span = S > 0.0 ? min(min(2.2, .45*rise + .3), S) : 0.0;
            vec3 p;
            if (S <= 0.0 || u <= -span) p = vec3(s*sinT, s*cosT, 0.0);
            else if (u >= span) p = vec3(rise*sinT + u*stretch, D - .02, KELP_MEANDER(u));
            else {
              float q = (u + span)/(2.0*span);
              vec3 a = vec3((rise - span)*sinT, (rise - span)*cosT, 0.0);
              vec3 corner = vec3(rise*sinT, D - .02, 0.0);
              vec3 b = vec3(rise*sinT + span*stretch, D - .02, KELP_MEANDER(span));
              p = mix(mix(a, corner, q), mix(corner, b, q), q);
            }
            p.y = min(p.y, D - .02);
            p.z += sin(uPlantTime*.6 + phase + s*.35)*.05*position.y;
            // The submerged stipe is slimmer; the floating part reads from above.
            float girth = mix(.5, 1.0, S > 0.0 ? smoothstep(-span - .01, span + .01, u) : 0.0);
            transformed = p + vec3(position.x, 0.0, position.z)*girth;
          } else if (plantPart < 1.5) {
            transformed = bulbAt + position;
          } else {
            // A few narrow blades leave the bulb together and trail downstream,
            // fanning slightly only when the current slackens.
            float t = position.x/3.6;
            float ang = plantBlade*(.04 + .14*looseness)
              + sin(uPlantTime*.5 + phase + plantBlade*2.0)*.03*(.3 + looseness);
            float len = position.x*(.72 + .28*e);
            vec3 p = bulbAt + vec3(cos(ang)*len, 0.0, sin(ang)*len + position.z);
            float surface = S > 0.0 ? D - .035 : min(D - .06, bulbAt.y + len*.22);
            p.y = surface - t*t*.14*looseness;
            p.z += sin(position.x*2.4 + phase + uPlantTime*.9)*t*.07*(.35 + looseness);
            transformed = p;
          }
        `) +
          `
          ${grass ? '' : '// Plants settle in their own directions as the current slackens.'}
          float heading = flow.x${grass ? '' : ' + sin(phase*3.7)*.9*(1.0 - clamp(flow.y, 0.0, 1.0))'};
          float c = cos(heading), s = sin(heading);
          transformed.xz = mat2(c,-s,s,c) * transformed.xz;
        `,
      );
    };
    material.customProgramCacheKey = () => (grass ? 'eelgrass-flow-v2' : 'bull-kelp-flow-v4');
    const shapes = grass ? [grassBlade()] : [0, 1, 2].map(bullKelpGeometry);
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
        // Kelp keeps true stipe/blade lengths; grass varies its footprint.
        if (grass) pose.scale.set(0.7 + p.variation * 0.6, 1, 0.7 + p.tint * 0.6);
        else pose.scale.set(1, 1, 1);
        pose.updateMatrix();
        mesh.setMatrixAt(i, pose.matrix);
        color.set(grass ? '#436c25' : '#4a3a10');
        color.lerp(new THREE.Color(grass ? '#779f3d' : '#6f6022'), p.tint);
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
