import { workLightUniforms, workLightFragment } from './work-light-water.js';
import * as THREE from 'three';
import { bedDepthAt, seaLevel } from '../terrain.js';
import { CoastalLife } from './coastal-life.js';
import { coastalTextures } from './coastal-textures.js';
import { CoastalMist } from './coastal-mist.js';
import { assist, reefRange } from '../assists.js';
import { visibilityRange } from '../assists.js';
import { MarineVegetation } from './marine-vegetation.js';
import { waterColumnMaterials, waterTurbidity, coastalDaylight } from './water-optics.js';

// Presentation alone samples the simulation's original bathymetry. None of these
// decorative objects participates in navigation, collision, or catch discovery.
const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noise(x, z) {
  return (
    (Math.sin(x * 0.129 + Math.sin(z * 0.083) * 2.1) +
      Math.sin(z * 0.197 - x * 0.041) * 0.5 +
      Math.cos(x * 0.403 + z * 0.327) * 0.25) /
    1.75
  );
}
function landRelief(terrain, x, z, depth) {
  // Leave the complete intertidal band and all shore-crossing triangles exact.
  if (depth > -5) return 0;
  const step = terrain.spacing;
  for (const [dx, dz] of [
    [step, 0],
    [-step, 0],
    [0, step],
    [0, -step],
    [step, step],
    [-step, step],
    [step, -step],
    [-step, -step],
  ])
    if (bedDepthAt(terrain, x + dx, z + dz) >= 0) return 0;
  return noise(x * 2.4, z * 2.4) * 0.52 * smooth(5, 8, -depth);
}
function disposeGroup(group) {
  const geometries = new Set(),
    materials = new Set();
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material)
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  group.clear();
}
function rockGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i);
    const cut = 0.9 + 0.12 * Math.sin(x * 12 + z * 8 + y * 4);
    position.setXYZ(i, x * cut, clamp((y + 1) / 2) ** 0.83, z * cut);
  }
  let minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < position.count; i++) {
    minY = Math.min(minY, position.getY(i));
    maxY = Math.max(maxY, position.getY(i));
  }
  for (let i = 0; i < position.count; i++)
    position.setY(i, (position.getY(i) - minY) / (maxY - minY));
  geometry.computeVertexNormals();
  return geometry;
}
function crownGeometry() {
  // Cedar boughs: individual drooping, irregular fans rather than a solid cone.
  const positions = [],
    colors = [],
    uvs = [];
  const random = randomGenerator(78412);
  const triangle = (a, b, c, shade, uv) => {
    positions.push(...a, ...b, ...c);
    uvs.push(...uv);
    for (let i = 0; i < 3; i++) colors.push(shade * 0.62, shade, shade * 0.74);
  };
  for (let tier = 0; tier < 11; tier++) {
    const height = 1.45 + tier * 0.54;
    const radius = (1 - tier / 12) ** 0.85 * 1.6;
    const branches = 5 + (tier % 2);
    for (let branch = 0; branch < branches; branch++) {
      const angle = (branch / branches) * TAU + tier * 1.37 + random() * 0.25;
      const length = radius * (0.8 + random() * 0.4);
      const radial = [Math.cos(angle), Math.sin(angle)];
      const tip = [radial[0] * length, height - 0.15 - length * 0.2, radial[1] * length];
      const left = [
        radial[0] * length * 0.36 - radial[1] * length * 0.38,
        height + 0.05,
        radial[1] * length * 0.36 + radial[0] * length * 0.38,
      ];
      const right = [
        radial[0] * length * 0.36 + radial[1] * length * 0.38,
        height + 0.05,
        radial[1] * length * 0.36 - radial[0] * length * 0.38,
      ];
      const root = [0, height + 0.24, 0];
      const ridge = [radial[0] * length * 0.43, height + 0.34, radial[1] * length * 0.43];
      const shade = 0.75 + random() * 0.25;
      triangle(root, left, ridge, shade, [0.5, 1, 0, 0.58, 0.5, 0.55]);
      triangle(left, tip, ridge, shade * 0.86, [0, 0.58, 0.5, 0, 0.5, 0.55]);
      triangle(tip, right, ridge, shade * 0.93, [0.5, 0, 1, 0.58, 0.5, 0.55]);
      triangle(right, root, ridge, shade * 0.9, [1, 0.58, 0.5, 1, 0.5, 0.55]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}
const waterVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSwell;
  varying vec3 vWorld;
  varying vec2 vWater;
  void main() {
    vec3 p = position;
    p.y += sin(p.x * .13 + p.z * .085 + uTime * .8) * uSwell;
    p.y += sin(p.x * -.22 + p.z * .175 + uTime * 1.1) * uSwell * .35;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vWater = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const waterFragment =
  workLightFragment +
  /* glsl */ `
  uniform sampler2D uDepth;
  uniform sampler2D uRipples;
  uniform float uSize;
  uniform float uDepthStep;
  uniform float uSeaLevel;
  uniform float uTime;
  uniform float uRough;
  uniform vec2 uWind;
  uniform float uDaylight;
  uniform vec3 uSun;
  uniform vec2 uBoat;
  uniform float uReefRange;
  uniform float uRestricted;
  varying vec3 vWorld;
  varying vec2 vWater;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float valueNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float depthAt(vec2 p) {
    if(p.x<0.0||p.y<0.0||p.x>uSize||p.y>uSize) return 50.0;
    return texture2D(uDepth, p/uSize*(1.0-uDepthStep)+uDepthStep*.5).r + uSeaLevel;
  }
  void main() {
    vec2 p = vWater;
    float actualDepth = depthAt(p);
    if(actualDepth < -.025) discard;
    float n = valueNoise(p * .135 + vec2(uTime * .018, -uTime * .025));
    float reveal = 1.0-uRestricted*smoothstep(uReefRange*.55,uReefRange,distance(p,uBoat));
    float depth = mix(25.0,actualDepth,reveal);
    vec2 drift = vec2(uTime*.006,-uTime*.004);
    vec2 warp = vec2(valueNoise(p*.031),valueNoise(p*.047+vec2(83,27)))-.5;
    vec3 microA = texture2D(uRipples, mat2(.91,.415,-.415,.91)*p*.038+drift+warp*.24).rgb;
    vec3 microB = texture2D(uRipples, mat2(.72,-.694,.694,.72)*p*.087-drift*.73+warp*.37).rgb;
    vec2 windNormal = (microA.rg*2.0-1.0)*.72 + (microB.rg*2.0-1.0)*.28;
    float slope = (.19+uRough*.22)*(.55+valueNoise(p*.07)*.65);
    vec3 normal = normalize(vec3(windNormal.x*slope,1.0,windNormal.y*slope));
    float w1 = microA.b*2.0-1.0;
    float w2 = microB.b*2.0-1.0;
    float w3 = windNormal.x;
    vec3 view = normalize(cameraPosition-vWorld);
    float fresnel = pow(1.0-max(dot(normal,view),0.0),4.0);
    vec3 shallow = vec3(.072,.145,.085);
    vec3 shelf = vec3(.023,.082,.059);
    vec3 deep = vec3(.012,.041,.034);
    vec3 color = mix(shallow,shelf,smoothstep(.0,4.5,depth));
    color = mix(color,deep,smoothstep(3.0,16.0,depth));
    color *= .89 + .12 * n;
    vec3 sky = vec3(.37,.45,.43);
    color = mix(color,sky,fresnel*.49);
    vec3 halfVector = normalize(view+uSun);
    float sun = pow(max(dot(normal,halfVector),0.0),260.0);
    float softSun = pow(max(dot(normal,halfVector),0.0),24.0);
    color += vec3(.77,.85,.81) * (sun * .035 + softSun*.004) * uDaylight;
    // Fine broken wind ripples derive from the same animated normals as
    // reflected light. No repeating dot lattice or oversized specular stripe.
    color += vec3(.014,.021,.02) * (w1*.35+w2*.23) * (.45+n*.55);
    float caustic = pow(max(0.0,w2*w3),9.0);
    color += vec3(.12,.18,.1) * caustic * (1.0-smoothstep(.0,5.0,depth))*.18;
    float surfBreak = smoothstep(.44,.64,microA.b+n*.13);
    float shore = (1.0-smoothstep(.05,.72,actualDepth))*surfBreak*(.25+.75*reveal);
    float wash = .5+.5*sin(depth*10.0-uTime*1.1+n*4.0);
    float foam = shore * smoothstep(.56,.87, n*.38+wash*.62) * .62;
    float edge = (1.0-smoothstep(.02,.14,actualDepth))*surfBreak*.13;
    color = mix(color,vec3(.67,.76,.73),clamp(foam+edge,0.0,.8));
    // Broken crests travel downwind; wind sets coverage and size.
    // With zero wind this contribution is exactly zero, even with swell.
    float windSpeed = length(uWind);
    vec2 wind = uWind / max(.001,windSpeed);
    vec2 across = vec2(-wind.y,wind.x);
    float strength = clamp(windSpeed/15.0,0.0,1.0);
    vec2 windUV = vec2(dot(p,across),dot(p,wind)-uTime*(.35+windSpeed*.10));
    vec2 cell = floor(windUV/8.0);
    float seed = hash(cell);
    vec2 local = mod(windUV,8.0)-4.0;
    local -= vec2(hash(cell+19.0),hash(cell+43.0))*2.2-1.1;
    float halfWidth = mix(.45,2.5,strength)*(.7+seed*.45);
    float edgeFade = 1.0-smoothstep(halfWidth*.35,halfWidth,abs(local.x));
    float front = local.y + local.x*local.x*.16;
    float crest = exp(-pow(front/(.09+strength*.16),2.0));
    float broken = .55+.45*valueNoise(windUV*2.4);
    float lifetime = smoothstep(.2,.7,.5+.5*sin(uTime*.7+seed*24.0));
    float coverage = smoothstep(1.0-strength*.7,1.05-strength*.7,seed);
    float whitecaps = crest*edgeFade*broken*lifetime*coverage
      *smoothstep(.2,7.0,windSpeed)*(.16+strength*.30);
    whitecaps *= smoothstep(.25,1.3,actualDepth);
    color = mix(color,vec3(.70,.80,.75),whitecaps);
    color *= .12 + .88*uDaylight;
    color += workLightWater(vWorld, normal, view, uRough, microA.b);
    // Turbid coastal water retains bottom/shadow detail only on very shallow
    // shelves. Deep green is absorption, not a transparent blue floor tint.
    float alpha = mix(.69,.997,smoothstep(.0,5.0,depth));
    alpha = min(.999,alpha+uRough*.055);
    alpha = mix(1.0,alpha,reveal);
    alpha = max(alpha,foam*.95);
    gl_FragColor = vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class CoastalWorld {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Coast · original simulation bathymetry';
    scene.add(this.group);
    this.elapsed = 0;
    this.terrain = null;
    this.bed = new THREE.Group();
    this.group.add(this.bed);
    this.rockObjects = [];
    this.life = new CoastalLife(scene);
    this.textures = coastalTextures();
    this.mist = new CoastalMist(scene, this.textures.ripples);
  }
  setWorld(world) {
    if (this.terrain === world.terrain && this.rocks === world.rocks) return;
    this.clear();
    this.terrain = world.terrain;
    this.rocks = world.rocks;
    this.buildTerrain(world);
    this.buildForest(world);
    this.buildUndergrowth(world);
    this.buildGeology(world);
    this.buildKelp(world);
    this.buildWater(world);
    this.update(world, 0);
  }
  buildTerrain(world) {
    const terrain = world.terrain;
    const segments = Math.min(400, Math.round(terrain.size / terrain.spacing));
    const geometry = new THREE.PlaneGeometry(terrain.size, terrain.size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(terrain.size / 2, 0, terrain.size / 2);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();
    const sand = new THREE.Color('#7d8066'),
      submerged = new THREE.Color('#475e47');
    const wet = new THREE.Color('#4d5651'),
      stone = new THREE.Color('#656c5b');
    const turf = new THREE.Color('#3d5130'),
      upland = new THREE.Color('#354d2e');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        z = position.getZ(i);
      const depth = bedDepthAt(terrain, x, z);
      // The coastline remains exactly on the simulation's zero-depth contour.
      position.setY(i, -depth + landRelief(terrain, x, z, depth));
      const n = noise(x, z),
        grain = noise(x * 2.71, z * 2.71);
      if (depth >= 0) {
        color.copy(sand).lerp(submerged, smooth(2, 17, depth));
        color.multiplyScalar(0.86 + n * 0.12 + grain * 0.065);
      } else {
        const elevation = -depth;
        const steep =
          Math.hypot(
            bedDepthAt(terrain, x + 1.25, z) - bedDepthAt(terrain, x - 1.25, z),
            bedDepthAt(terrain, x, z + 1.25) - bedDepthAt(terrain, x, z - 1.25),
          ) / 2.5;
        color.copy(wet).lerp(stone, smooth(0.25, 2.4, elevation));
        const moss = smooth(0.65, 4.0, elevation) * (1 - smooth(0.7, 1.7, steep));
        color.lerp(turf, moss * (0.82 + n * 0.16)).lerp(upland, smooth(8, 12, elevation) * 0.5);
        const strata = Math.sin(elevation * 3.1 + n * 2.4) * 0.025;
        color.multiplyScalar(0.94 + n * 0.13 + grain * 0.06 + strata);
      }
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: this.textures.stone,
      bumpMap: this.textures.stone,
      bumpScale: 0.18,
      roughness: 0.94,
      metalness: 0.0,
    });
    const normals = geometry.attributes.normal;
    const cell = 24;
    for (let iz = 0; iz < segments; iz += cell)
      for (let ix = 0; ix < segments; ix += cell) {
        const sx = Math.min(cell, segments - ix),
          sz = Math.min(cell, segments - iz);
        const vertices = [],
          shades = [],
          directions = [],
          uv = [],
          indices = [];
        for (let z = 0; z <= sz; z++)
          for (let x = 0; x <= sx; x++) {
            const source = (iz + z) * (segments + 1) + ix + x;
            vertices.push(position.getX(source), position.getY(source), position.getZ(source));
            uv.push(position.getX(source) / 7, position.getZ(source) / 7);
            shades.push(colors[source * 3], colors[source * 3 + 1], colors[source * 3 + 2]);
            directions.push(normals.getX(source), normals.getY(source), normals.getZ(source));
            if (x < sx && z < sz) {
              const a = z * (sx + 1) + x;
              indices.push(a, a + sx + 1, a + 1, a + 1, a + sx + 1, a + sx + 2);
            }
          }
        const tile = new THREE.BufferGeometry();
        tile.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        tile.setAttribute('normal', new THREE.Float32BufferAttribute(directions, 3));
        tile.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
        tile.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        tile.setIndex(indices);
        tile.computeBoundingSphere();
        const mesh = new THREE.Mesh(tile, material);
        mesh.name = 'Rocky shore and seabed';
        mesh.receiveShadow = true;
        this.bed.add(mesh);
      }
    geometry.dispose();
  }
  buildForest(world) {
    const terrain = world.terrain,
      random = randomGenerator(87326);
    const trees = [];
    const step = Math.max(3.2, terrain.size / 165);
    for (let z = 3; z < terrain.size - 3; z += step)
      for (let x = 3; x < terrain.size - 3; x += step) {
        const px = x + (random() - 0.5) * step * 0.95,
          pz = z + (random() - 0.5) * step * 0.95;
        const d = bedDepthAt(terrain, px, pz);
        if (d > -2.7 || trees.length >= 3800 || random() > 0.75 + noise(px * 0.3, pz * 0.3) * 0.22)
          continue;
        const slope =
          Math.hypot(bedDepthAt(terrain, px + 2, pz) - d, bedDepthAt(terrain, px, pz + 2) - d) / 2;
        if (
          slope > 1 ||
          bedDepthAt(terrain, px - 2, pz) > -1 ||
          bedDepthAt(terrain, px, pz - 2) > -1
        )
          continue;
        const s = (0.7 + random() * 0.85) * (0.7 + smooth(2, 9, -d) * 0.35);
        trees.push({
          x: px,
          z: pz,
          y: -d + landRelief(terrain, px, pz, d) - 0.14,
          scale: s,
          turn: random() * TAU,
          tint: random(),
        });
      }
    if (!trees.length) return;
    const crownShape = crownGeometry();
    const trunkShape = new THREE.CylinderGeometry(0.065, 0.19, 6.4, 5);
    const crownMaterial = new THREE.MeshStandardMaterial({
      color: '#4a6a45',
      map: this.textures.foliage,
      alphaTest: 0.19,
      vertexColors: true,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#594d3a', roughness: 1 });
    const cells = new Map();
    // Spatial batches retain dense forest while culling trees outside the view
    // and sun's local shadow volume, including on the larger later coasts.
    for (const tree of trees) {
      const key = `${Math.floor(tree.x / 48)}:${Math.floor(tree.z / 48)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(tree);
    }
    const object = new THREE.Object3D(),
      color = new THREE.Color();
    for (const cell of cells.values()) {
      const crown = new THREE.InstancedMesh(crownShape, crownMaterial, cell.length);
      const trunk = new THREE.InstancedMesh(trunkShape, trunkMaterial, cell.length);
      cell.forEach((tree, i) => {
        object.position.set(tree.x, tree.y, tree.z);
        object.rotation.set((tree.tint - 0.5) * 0.035, tree.turn, (tree.tint - 0.5) * 0.065);
        object.scale.set(tree.scale * 1.24, tree.scale, tree.scale * 1.24);
        object.updateMatrix();
        crown.setMatrixAt(i, object.matrix);
        color.setHSL(0.3 + tree.tint * 0.06, 0.23 + tree.tint * 0.1, 0.53 + tree.tint * 0.28);
        crown.setColorAt(i, color);
        object.position.y += 3.1 * tree.scale;
        object.updateMatrix();
        trunk.setMatrixAt(i, object.matrix);
      });
      crown.name = 'Coastal cedar and fir boughs';
      crown.castShadow = true;
      crown.receiveShadow = true;
      trunk.castShadow = true;
      crown.computeBoundingSphere();
      trunk.computeBoundingSphere();
      this.bed.add(trunk, crown);
    }
  }

  buildUndergrowth(world) {
    const terrain = world.terrain,
      random = randomGenerator(482173),
      cells = new Map();
    const step = Math.max(3, terrain.size / 150);
    for (let z = 3; z < terrain.size - 3; z += step)
      for (let x = 3; x < terrain.size - 3; x += step) {
        const px = x + (random() - 0.5) * step,
          pz = z + (random() - 0.5) * step;
        const d = bedDepthAt(terrain, px, pz);
        if (d > -0.9 || d < -9 || noise(px * 0.8, pz * 0.8) < -0.12 || random() > 0.66) continue;
        const key = `${Math.floor(px / 48)}:${Math.floor(pz / 48)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push({
          x: px,
          z: pz,
          y: -d + landRelief(terrain, px, pz, d) - 0.08,
          scale: 0.45 + random() * 0.8,
          turn: random() * TAU,
          tint: random(),
        });
      }
    const positions = [],
      uvs = [],
      indices = [];
    for (let side = 0; side < 3; side++) {
      const c = Math.cos((side * Math.PI) / 3),
        s = Math.sin((side * Math.PI) / 3),
        base = positions.length / 3;
      positions.push(
        -0.75 * c,
        0,
        -0.75 * s,
        0.75 * c,
        0,
        0.75 * s,
        -0.75 * c,
        1.3,
        -0.75 * s,
        0.75 * c,
        1.3,
        0.75 * s,
      );
      uvs.push(0, 1, 1, 1, 0, 0, 1, 0);
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    shape.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    shape.setIndex(indices);
    shape.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: '#7d8957',
      map: this.textures.foliage,
      alphaTest: 0.3,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const object = new THREE.Object3D(),
      color = new THREE.Color();
    for (const cell of cells.values()) {
      const mesh = new THREE.InstancedMesh(shape, material, cell.length);
      cell.forEach((plant, i) => {
        object.position.set(plant.x, plant.y, plant.z);
        object.rotation.set(0, plant.turn, 0);
        object.scale.setScalar(plant.scale);
        object.updateMatrix();
        mesh.setMatrixAt(i, object.matrix);
        color.setHSL(0.19 + plant.tint * 0.09, 0.28, 0.58 + plant.tint * 0.22);
        mesh.setColorAt(i, color);
      });
      mesh.name = 'Shore ferns and young cedar';
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.bed.add(mesh);
    }
    if (!cells.size) {
      shape.dispose();
      material.dispose();
    }
  }

  buildGeology(world) {
    const terrain = world.terrain,
      random = randomGenerator(78136);
    const decorations = [];
    const step = Math.max(3.3, terrain.size / 150);
    for (let z = 2; z < terrain.size - 2; z += step)
      for (let x = 2; x < terrain.size - 2; x += step) {
        const px = x + random() * step,
          pz = z + random() * step;
        const d = bedDepthAt(terrain, px, pz);
        if (decorations.length > 4700) continue;
        // Shore stones stay on land; submerged cobbles never imply a new hazard.
        if ((d < -0.22 && d > -6.8 && random() < 0.44) || (d > 2.5 && d < 15 && random() < 0.2)) {
          const outcrop = d < -2.5 && noise(px * 0.5, pz * 0.5) > 0.16;
          const size = outcrop
            ? 1.5 + random() * 2.1
            : d < 0
              ? 0.42 + random()
              : 0.2 + random() * 0.6;
          const footprint = size * 1.8;
          if (
            d < 0 &&
            [
              [footprint, 0],
              [-footprint, 0],
              [0, footprint],
              [0, -footprint],
              [footprint * 0.71, footprint * 0.71],
              [-footprint * 0.71, -footprint * 0.71],
            ].some(([dx, dz]) => bedDepthAt(terrain, px + dx, pz + dz) > -0.08)
          )
            continue;
          decorations.push({
            x: px,
            y: -d - (outcrop ? 0.48 : 0.16),
            z: pz,
            sx: size * (1 + random() * 0.7),
            sy: size * (0.3 + random() * 0.5),
            sz: size * (1 + random() * 0.9),
            turn: random() * TAU,
            tint: random(),
          });
        }
      }
    const geom = rockGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: '#858773',
      map: this.textures.stone,
      bumpMap: this.textures.stone,
      bumpScale: 0.12,
      roughness: 0.93,
    });
    const object = new THREE.Object3D(),
      color = new THREE.Color();
    if (decorations.length) {
      const cells = new Map();
      for (const rock of decorations) {
        const key = `${Math.floor(rock.x / 48)}:${Math.floor(rock.z / 48)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(rock);
      }
      for (const cell of cells.values()) {
        const mesh = new THREE.InstancedMesh(geom, material, cell.length);
        cell.forEach((rock, i) => {
          object.position.set(rock.x, rock.y, rock.z);
          object.rotation.set(0, rock.turn, 0);
          object.scale.set(rock.sx, rock.sy, rock.sz);
          object.updateMatrix();
          mesh.setMatrixAt(i, object.matrix);
          color.setHSL(0.12 + rock.tint * 0.05, 0.05 + rock.tint * 0.13, 0.46 + rock.tint * 0.26);
          mesh.setColorAt(i, color);
        });
        mesh.name = 'Intertidal granite and submarine cobbles';
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.computeBoundingSphere();
        this.bed.add(mesh);
      }
    }
    this.rockColumn = waterColumnMaterials(
      { stone: material },
      { visibilityDepth: 7.5, contrast: 2 },
    );
    for (const rock of world.rocks || []) {
      const bottom = bedDepthAt(terrain, rock.x, rock.y);
      const mesh = new THREE.Mesh(geom, this.rockColumn.materials.stone);
      mesh.renderOrder = 2;
      mesh.position.set(rock.x, -bottom - 0.15, rock.y);
      mesh.scale.set(
        rock.radius,
        Math.max(0.3, bottom - rock.topDepth + 0.15),
        rock.radius + (rock.length || 0) / 2,
      );
      mesh.rotation.y = -rock.heading;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.name = `Physical ${rock.kind}`;
      this.bed.add(mesh);
      this.rockObjects.push({ mesh, rock });
    }
    // Geometries are retained even on featureless coasts so disposal is complete.
    if (!decorations.length && !(world.rocks || []).length) {
      geom.dispose();
      material.dispose();
    }
  }
  buildKelp(world) {
    this.vegetation = new MarineVegetation(this.group, world);
    this.kelpPatches = this.vegetation.kelp;
    this.eelgrassPatches = this.vegetation.grass;
  }

  buildWater(world) {
    const terrain = world.terrain;
    const n = Math.round(terrain.size / terrain.spacing) + 1;
    this.depthTexture = new THREE.DataTexture(
      new Float32Array(terrain.depths),
      n,
      n,
      THREE.RedFormat,
      THREE.FloatType,
    );
    this.depthTexture.minFilter = THREE.LinearFilter;
    this.depthTexture.magFilter = THREE.LinearFilter;
    this.depthTexture.wrapS = this.depthTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.depthTexture.needsUpdate = true;
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      workLightUniforms(),
      {
        uDepth: { value: this.depthTexture },
        uRipples: { value: this.textures.ripples },
        uSize: { value: terrain.size },
        uDepthStep: { value: 1 / n },
        uSeaLevel: { value: seaLevel(world) },
        uTime: { value: 0 },
        uSwell: { value: 0.045 },
        uRough: { value: 0.1 },
        uWind: { value: new THREE.Vector2() },
        uDaylight: { value: 1 },
        uSun: { value: new THREE.Vector3(-0.6, 0.85, -0.35).normalize() },
        uBoat: { value: new THREE.Vector2(world.boat.x, world.boat.y) },
        uReefRange: { value: reefRange(world) },
        uRestricted: { value: this.restricted ? 1 : 0 },
      },
    ]);
    uniforms.uDepth.value = this.depthTexture;
    uniforms.uRipples.value = this.textures.ripples;
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader:
        '#include <fog_pars_vertex>\n' +
        waterVertex.replace(
          'gl_Position = projectionMatrix * viewMatrix * world;',
          'vec4 mvPosition = viewMatrix * world; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>',
        ),
      fragmentShader: '#include <fog_pars_fragment>\n' + waterFragment,
      transparent: true,
      depthWrite: false,
      fog: true,
      side: THREE.FrontSide,
    });
    const extent = terrain.size + 900;
    const geometry = new THREE.PlaneGeometry(extent, extent, 144, 144);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(terrain.size / 2, 0, terrain.size / 2);
    this.water = new THREE.Mesh(geometry, material);
    this.water.name = 'Tidal Pacific · depth-aware ocean';
    this.water.renderOrder = 1;
    this.water.frustumCulled = false;
    this.group.add(this.water);
  }
  setVisibility(world, ui) {
    this.restricted = !assist(world, 'reefClarity', ui.realistic, ui.debug);
  }
  update(world, dt = 0, camera) {
    if (this.terrain !== world.terrain || this.rocks !== world.rocks) this.setWorld(world);
    this.elapsed += Math.min(dt, 0.1);
    const tide = seaLevel(world);
    this.bed.position.y = -tide;
    this.vegetation?.update(world, this.elapsed);
    if (this.rockColumn) {
      this.rockColumn.uniforms.uColumnTime.value = this.elapsed;
      this.rockColumn.uniforms.uColumnTurbidity.value = waterTurbidity(world);
      this.rockColumn.uniforms.uColumnLight.value = world.weather?.sunlight ?? 1;
    }
    this.life.update(world, this.elapsed);
    this.mist.update(world, this.elapsed, camera);
    if (this.water) {
      const uniforms = this.water.material.uniforms;
      uniforms.uTime.value = this.elapsed;
      uniforms.uSeaLevel.value = tide;
      uniforms.uRestricted.value = this.restricted ? 1 : 0;
      uniforms.uBoat.value.set(world.boat.x, world.boat.y);
      uniforms.uReefRange.value = reefRange(world);
      const rough = clamp((world.weather?.wave || 0.12) / 2.2);
      uniforms.uRough.value = rough;
      uniforms.uWind.value.set(world.environment.wind?.x || 0, world.environment.wind?.y || 0);
      uniforms.uSwell.value = 0.025 + rough * 0.19;
      const minute = world.day?.minute ?? 600;
      uniforms.uDaylight.value = world.weather?.sunlight ?? coastalDaylight(minute);
      const sun = this.scene.children.find(
        (child) => child.isDirectionalLight && child.intensity > 0.2,
      );
      if (sun) uniforms.uSun.value.copy(sun.position).sub(sun.target.position).normalize();
    }
    for (const { mesh, rock } of this.rockObjects)
      mesh.visible =
        rock.topDepth + tide < 7.5 &&
        Math.hypot(rock.x - world.boat.x, rock.y - world.boat.y) < visibilityRange(world);
    if (camera) this.group.userData.cameraDistance = camera.position.y;
  }
  clear() {
    disposeGroup(this.bed);
    this.rockColumn?.dispose();
    this.rockColumn = null;
    this.vegetation?.dispose();
    this.vegetation = null;
    if (this.water) {
      this.group.remove(this.water);
      this.water.geometry.dispose();
      this.water.material.dispose();
      this.water = null;
    }
    this.depthTexture?.dispose();
    this.depthTexture = null;
    this.rockObjects.length = 0;
  }
  dispose() {
    this.clear();
    this.scene.remove(this.group);
    this.life.dispose();
    this.mist.dispose();
    this.textures.dispose();
  }
}
