import * as THREE from 'three';
import { bedDepthAt } from '../terrain.js';

// Only the decorative ocean beyond the original survey uses this continuation.
// The water shader and apron share the same 80 m falloff to deep water.
const extent = 80;
export const oceanDepthFragment = /* glsl */ `
  float depthAt(vec2 p) {
    vec2 edge = clamp(p,vec2(0.0),vec2(uSize));
    float surveyed = texture2D(uDepth, edge/uSize*(1.0-uDepthStep)+uDepthStep*.5).r;
    float offshore = smoothstep(0.0,${extent.toFixed(1)},distance(p,edge));
    return mix(surveyed,50.0,offshore) + uSeaLevel;
  }
`;

export function oceanApron(terrain, surface, colors, material) {
  const segments = surface.parameters.widthSegments;
  const stride = segments + 1;
  const perimeter = [];
  for (let i = 0; i < segments; i++) perimeter.push(i);
  for (let i = 0; i < segments; i++) perimeter.push(i * stride + segments);
  for (let i = 0; i < segments; i++) perimeter.push(segments * stride + segments - i);
  for (let i = 0; i < segments; i++) perimeter.push((segments - i) * stride);
  const vertices = [],
    shades = [],
    uv = [],
    indices = [];
  const position = surface.attributes.position;
  const rings = [0, 2, 6, 14, 28, 50, extent];
  const submerged = new THREE.Color('#475e47');
  const color = new THREE.Color();
  for (const [ring, offset] of rings.entries()) {
    const scale = 1 + (offset * 2) / terrain.size;
    for (const [i, source] of perimeter.entries()) {
      const x = (position.getX(source) - terrain.size / 2) * scale + terrain.size / 2;
      const z = (position.getZ(source) - terrain.size / 2) * scale + terrain.size / 2;
      const edgeX = Math.max(0, Math.min(terrain.size, x));
      const edgeZ = Math.max(0, Math.min(terrain.size, z));
      const t = Math.min(1, Math.hypot(x - edgeX, z - edgeZ) / extent);
      const blend = t * t * (3 - 2 * t);
      const depth = bedDepthAt(terrain, edgeX, edgeZ);
      const y = ring === 0 ? position.getY(source) : -(depth + (50 - depth) * blend);
      vertices.push(x, y, z);
      color
        .fromArray(colors, source * 3)
        .lerp(submerged, blend)
        .toArray(shades, shades.length);
      uv.push(x / 7, z / 7);
      if (ring < rings.length - 1) {
        const a = ring * perimeter.length + i;
        const b = ring * perimeter.length + ((i + 1) % perimeter.length);
        const c = a + perimeter.length,
          d = b + perimeter.length;
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Decorative seabed beyond sector';
  mesh.receiveShadow = true;
  return mesh;
}
