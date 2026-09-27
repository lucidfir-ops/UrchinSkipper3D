import { bedDepthAt, clamp } from './terrain.js';

const hash = (x, y) => {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
function noise(x, y) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  let tx = x - ix,
    ty = y - iy;
  tx = tx * tx * (3 - 2 * tx);
  ty = ty * ty * (3 - 2 * ty);
  return (
    (hash(ix, iy) * (1 - tx) + hash(ix + 1, iy) * tx) * (1 - ty) +
    (hash(ix, iy + 1) * (1 - tx) + hash(ix + 1, iy + 1) * tx) * ty
  );
}
const mix = (a, b, t) => a + (b - a) * t;
export const SEA = [20, 59, 68];
// Reusable material data. Depth is cached from the authoritative grid; texture
// noise changes appearance only and never changes depth, collision or habitat.
export class CoastalRaster {
  constructor(terrain, resolution = 1024, prepare = true) {
    this.terrain = terrain;
    this.resolution = resolution;
    this.depths = new Float32Array(resolution * resolution);
    this.material = new Uint8ClampedArray(resolution * resolution * 4);
    this.surface = new Uint8ClampedArray(resolution * resolution);
    if (prepare) this.prepareRows(0, resolution);
  }
  prepareRows(start, end) {
    const { terrain, resolution } = this;
    for (let y = start; y < end; y++)
      for (let x = 0; x < resolution; x++) {
        const wx = ((x + 0.5) * terrain.size) / resolution,
          wy = ((y + 0.5) * terrain.size) / resolution,
          bed = bedDepthAt(terrain, wx, wy),
          i = y * resolution + x,
          j = i * 4;
        this.depths[i] = bed;
        const broad = noise(wx * 0.09, wy * 0.09),
          medium = noise(wx * 0.43, wy * 0.43),
          fine = hash(x, y),
          grain = (medium - 0.5) * 18 + (fine - 0.5) * 10;
        const vein = Math.abs(Math.sin(wx * 0.42 + wy * 0.31 + broad * 9));
        const rock = grain + (vein < 0.1 ? -14 : vein < 0.16 ? 6 : 0),
          height = -bed,
          forest = clamp((height - 3.8) / 3.8, 0, 1);
        // Overhead clustered crowns, shaded consistently in world space.
        const crown = noise(wx * 0.32, wy * 0.32),
          foliage = (crown - 0.5) * 37 + (medium - 0.5) * 13 + (fine - 0.5) * 8;
        const intertidal = height < 2.8;
        this.material[j] = mix((intertidal ? 102 : 123) + rock, 40 + foliage, forest);
        this.material[j + 1] = mix((intertidal ? 107 : 124) + rock, 62 + foliage, forest);
        this.material[j + 2] = mix((intertidal ? 89 : 112) + rock, 49 + foliage * 0.7, forest);
        this.material[j + 3] = 255;
        // Surface variation has no dependence on the deep seabed.
        this.surface[i] = clamp(
          128 +
            (noise(wx * 0.065, wy * 0.065) - 0.5) * 28 +
            (noise(wx * 0.65, wy * 0.32) - 0.5) * 14 +
            (fine - 0.5) * 6,
          0,
          255,
        );
      }
  }
  paint(normal, hidden, tide, start = 0, end = this.depths.length) {
    const a = normal.data,
      h = hidden.data;
    for (let i = start; i < end; i++) {
      const j = i * 4,
        d = this.depths[i] + tide,
        surface = (this.surface[i] - 128) * 0.42;
      if (d < -0.08) {
        const wash = clamp((d + 0.55) / 0.55, 0, 1),
          wet = 1 - wash * 0.18;
        for (let k = 0; k < 3; k++) a[j + k] = h[j + k] = this.material[j + k] * wet;
      } else {
        const shallow = clamp(1 - d / 10, 0, 1),
          bottom = shallow * shallow * 0.29,
          coast = clamp((0.08 - d) / 0.16, 0, 1);
        for (let k = 0; k < 3; k++) {
          const sea = SEA[k] + surface;
          const water = mix(sea + [20, 35, 21][k] * shallow, this.material[j + k], bottom);
          a[j + k] = mix(water, this.material[j + k] * 0.83, coast);
          h[j + k] = mix(sea, this.material[j + k] * 0.83, coast);
        }
      }
      a[j + 3] = h[j + 3] = 255;
    }
  }
}
export function kelpBeds(terrain) {
  const beds = [];
  for (let y = 5; y < terrain.size; y += 6)
    for (let x = 5; x < terrain.size; x += 6) {
      const n = hash(x, y);
      if (n < 0.36) continue;
      const px = x + (hash(x + 3, y) - 0.5) * 4,
        py = y + (hash(x, y + 7) - 0.5) * 4,
        bed = bedDepthAt(terrain, px, py);
      if (bed > -0.7 && bed < 13)
        beds.push({ x: px, y: py, length: 3.5 + n * 4, phase: n * 6.28, stems: n > 0.72 ? 4 : 3 });
    }
  return beds;
}
export function drawKelp(g, bed, flow, time, p, alpha, detail = 1) {
  const stems = Math.max(1, Math.round(bed.stems * detail)),
    sections = detail < 0.55 ? 3 : detail < 1 ? 4 : 7;
  const speed = Math.hypot(flow.x, flow.y),
    base = Math.atan2(flow.y + 0.025, flow.x + 0.035),
    stream = 1 + speed * 0.7;
  for (let stem = 0; stem < stems; stem++) {
    const angle = base + ((stem - (stems - 1) / 2) * 0.32) / stream,
      dx = Math.cos(angle),
      dy = Math.sin(angle),
      sx = -dy,
      sy = dx;
    const length = bed.length * (0.73 + stem * 0.12) * Math.min(1.1, 0.68 + speed * 0.45),
      bend = Math.sin(bed.phase + time * 0.4 + stem) * 0.3;
    let previous = { x: bed.x, y: bed.y };
    for (let k = 1; k <= sections; k++) {
      const f = k / sections,
        side = Math.sin(f * 2.8 + stem) * 0.4 + bend * f * f,
        x = bed.x + dx * f * length + sx * side,
        y = bed.y + dy * f * length + sy * side;
      g.lineStyle((0.065 + 0.02 * (1 - f)) * p, 0x928750, alpha * 0.8);
      g.lineBetween(previous.x * p, previous.y * p, x * p, y * p);
      if (k >= 2) {
        const sign = (k + stem) % 2 ? 1 : -1,
          leaf = 0.65 + (1 - f) * 1.25,
          width = 0.26 + (1 - f) * 0.3;
        const tip = {
          x: x + dx * leaf + sx * sign * leaf * 0.45,
          y: y + dy * leaf + sy * sign * leaf * 0.45,
        };
        const mid = {
          x: (x + tip.x) / 2 + sx * sign * width,
          y: (y + tip.y) / 2 + sy * sign * width,
        };
        g.fillStyle(k % 3 === 0 ? 0x716b37 : 0x505d33, alpha);
        g.fillPoints(
          [
            { x: x * p, y: y * p },
            { x: mid.x * p, y: mid.y * p },
            { x: tip.x * p, y: tip.y * p },
            { x: (mid.x - sx * sign * width * 1.4) * p, y: (mid.y - sy * sign * width * 1.4) * p },
          ],
          true,
        );
        if (detail >= 0.55) {
          g.lineStyle(0.035 * p, 0xb0a36a, alpha * 0.65);
          g.lineBetween(x * p, y * p, tip.x * p, tip.y * p);
        }
      }
      previous = { x, y };
    }
    g.fillStyle(0x9d8d48, alpha * 0.9);
    g.fillCircle(previous.x * p, previous.y * p, 0.14 * p);
  }
}
export function coastalDetails(terrain) {
  const details = [];
  for (let y = 3; y < terrain.size; y += 3.8)
    for (let x = 3; x < terrain.size; x += 3.8) {
      const ix = Math.round(x * 10),
        iy = Math.round(y * 10),
        n = hash(ix, iy);
      if (n < 0.38) continue;
      const px = x + (hash(ix + 1, iy) - 0.5) * 3,
        py = y + (hash(ix, iy + 1) - 0.5) * 3,
        bed = bedDepthAt(terrain, px, py);
      if (bed > 1.5) continue;
      const forest = bed < -5.2,
        radius = forest ? 1.3 + n * 1.8 : 0.4 + n * 1.15,
        points = [];
      for (let i = 0; i < (forest ? 20 : 9); i++) {
        const a = (i * Math.PI * 2) / (forest ? 20 : 9),
          r = radius * (0.7 + hash(ix + i, iy) * 0.3);
        points.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r * (forest ? 1 : 0.7) });
      }
      const maxBed = Math.max(...points.map((point) => bedDepthAt(terrain, point.x, point.y)));
      details.push({ x: px, y: py, bed, maxBed, forest, radius, points, n });
    }
  return details;
}
export function drawCoastalDetail(g, item, p, detail = 1) {
  const points = item.points.map((q) => ({ x: q.x * p, y: q.y * p }));
  // Sub-pixel facets/leaf veins are decoration. Keep every coastal silhouette,
  // actual shoreline and collision mask, but avoid thousands of tiny draw calls.
  if (detail < 0.55) {
    g.fillStyle(item.forest ? (item.n > 0.75 ? 0x405f45 : 0x344f3c) : 0x858d7d, 0.78);
    g.fillPoints(item.forest ? points.filter((_, i) => i % 2 === 0) : points, true);
    g.fillStyle(item.forest ? 0x829060 : 0xc2c2a7, 0.22);
    g.fillCircle(item.x * p, item.y * p, item.radius * p * 0.3);
    return;
  }
  if (item.forest) {
    g.fillStyle(0x132d27, 0.43);
    g.fillPoints(
      points.map((q) => ({ x: q.x + 2, y: q.y + 3 })),
      true,
    );
    g.fillStyle(item.n > 0.75 ? 0x405f45 : 0x344f3c, 0.76);
    g.fillPoints(points, true);
    const center = { x: (item.x - 0.2) * p, y: (item.y - 0.2) * p };
    g.fillStyle(0x657a4e, 0.24);
    for (let i = 0; i < points.length; i += 3)
      g.fillTriangle(
        center.x,
        center.y,
        points[i].x,
        points[i].y,
        points[(i + 1) % points.length].x,
        points[(i + 1) % points.length].y,
      );
    g.fillStyle(0x829060, 0.2);
    g.fillCircle(center.x, center.y, item.radius * p * 0.23);
  } else {
    g.fillStyle(0x333d39, 0.34);
    g.fillPoints(
      points.map((q) => ({ x: q.x + 1.4, y: q.y + 2 })),
      true,
    );
    g.fillStyle(item.n > 0.65 ? 0x969c88 : 0x777f72, 0.8);
    g.fillPoints(points, true);
    const center = { x: (item.x - 0.18) * p, y: (item.y - 0.12) * p };
    g.fillStyle(0xc2c2a7, 0.26);
    g.fillTriangle(center.x, center.y, points[5].x, points[5].y, points[6].x, points[6].y);
    g.fillTriangle(center.x, center.y, points[6].x, points[6].y, points[7].x, points[7].y);
    g.lineStyle(0.6, 0x3c4940, 0.5);
    g.lineBetween(points[1].x, points[1].y, center.x, center.y);
    g.lineBetween(center.x, center.y, points[5].x, points[5].y);
  }
}
