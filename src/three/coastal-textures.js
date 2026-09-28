import * as THREE from 'three';

// Deterministic, seamless material maps; generated source assets require no
// network resources or external artwork and stay outside simulation data.
function generator(seed) {
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6d2b79f5;
    return (seed >>> 0) / 4294967296;
  };
}
function texture(pixels, size, color = true) {
  const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  return map;
}
export function coastalTextures() {
  const size = 256,
    random = generator(7138492);
  const fields = [];
  for (const count of [8, 16, 32, 64]) {
    const grid = Float32Array.from({ length: count * count }, random);
    fields.push({ count, grid });
  }
  const sample = ({ count, grid }, x, y) => {
    const px = (x / size) * count,
      py = (y / size) * count;
    const ix = Math.floor(px),
      iy = Math.floor(py);
    let tx = px - ix,
      ty = py - iy;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const a = grid[(iy % count) * count + (ix % count)],
      b = grid[(iy % count) * count + ((ix + 1) % count)];
    const c = grid[((iy + 1) % count) * count + (ix % count)],
      d = grid[((iy + 1) % count) * count + ((ix + 1) % count)];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
  const stonePixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const large = sample(fields[0], x, y),
        medium = sample(fields[1], x, y),
        small = sample(fields[2], x, y),
        grain = sample(fields[3], x, y);
      const fissure = Math.max(0, 1 - Math.abs(medium - 0.5) * 35) * 0.23;
      const mica = random() > 0.987 ? 23 : 0;
      const value = Math.max(
        60,
        Math.min(
          245,
          156 +
            large * 37 +
            medium * 23 +
            small * 19 +
            (grain - 0.5) * 46 +
            (random() - 0.5) * 22 -
            fissure * 120 +
            mica,
        ),
      );
      const i = (y * size + x) * 4;
      stonePixels[i] = value;
      stonePixels[i + 1] = value;
      stonePixels[i + 2] = value * 0.98;
      stonePixels[i + 3] = 255;
    }
  const needles = new Uint8Array(size * size * 4);
  const line = (ax, ay, bx, by, width, shade) => {
    const dx = bx - ax,
      dy = by - ay,
      denom = dx * dx + dy * dy;
    for (
      let y = Math.max(0, Math.floor(Math.min(ay, by) - width - 1));
      y <= Math.min(size - 1, Math.ceil(Math.max(ay, by) + width + 1));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(Math.min(ax, bx) - width - 1));
        x <= Math.min(size - 1, Math.ceil(Math.max(ax, bx) + width + 1));
        x++
      ) {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / denom));
        const distance = Math.hypot(x - ax - t * dx, y - ay - t * dy);
        const alpha = Math.round(Math.max(0, Math.min(1, width + 0.7 - distance)) * 255);
        const i = (y * size + x) * 4;
        if (alpha > needles[i + 3]) {
          needles[i] = shade;
          needles[i + 1] = shade;
          needles[i + 2] = shade;
          needles[i + 3] = alpha;
        }
      }
  };
  line(128, 250, 128, 8, 2.7, 190);
  for (let layer = 0; layer < 24; layer++) {
    const y = 18 + layer * 9.5,
      extent = (Math.sin((y / 256) * Math.PI * 0.83) * 0.82 + 0.08) * 112;
    for (const side of [-1, 1]) {
      const endX = 128 + side * extent * (0.84 + random() * 0.24),
        endY = y - 15 - random() * 12;
      line(128, y, endX, endY, 1.4, 185 + random() * 65);
      for (let j = 1; j <= 7; j++) {
        const t = j / 8,
          px = 128 + (endX - 128) * t,
          py = y + (endY - y) * t;
        const length = 8 + (1 - t) * 11 + random() * 5;
        line(px, py, px + side * (2 + random() * 4), py - length, 1.0, 175 + random() * 80);
        line(px, py, px + side * (8 + random() * 5), py + 7, 1.0, 175 + random() * 80);
      }
    }
  }
  const waveFields = [
    [19, 37],
    [43, 59],
    [79, 97],
  ].map(([nx, ny]) => ({ nx, ny, grid: Float32Array.from({ length: nx * ny }, random) }));
  const waveAt = (field, x, y) => {
    const px = (x / size) * field.nx,
      py = (y / size) * field.ny,
      ix = Math.floor(px),
      iy = Math.floor(py);
    let tx = px - ix,
      ty = py - iy;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const at = (dx, dy) => field.grid[((iy + dy) % field.ny) * field.nx + ((ix + dx) % field.nx)];
    return (
      (at(0, 0) * (1 - tx) + at(1, 0) * tx) * (1 - ty) + (at(0, 1) * (1 - tx) + at(1, 1) * tx) * ty
    );
  };
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      heights[y * size + x] =
        waveAt(waveFields[0], x, y) * 0.55 +
        waveAt(waveFields[1], x, y) * 0.3 +
        waveAt(waveFields[2], x, y) * 0.15;
  const ripplePixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const h = (dx, dy) => heights[((y + dy + size) % size) * size + ((x + dx + size) % size)];
      const dx = Math.max(-1, Math.min(1, (h(-1, 0) - h(1, 0)) * 13)),
        dy = Math.max(-1, Math.min(1, (h(0, -1) - h(0, 1)) * 6));
      const i = (y * size + x) * 4;
      ripplePixels[i] = (dx * 0.5 + 0.5) * 255;
      ripplePixels[i + 1] = (dy * 0.5 + 0.5) * 255;
      ripplePixels[i + 2] = h(0, 0) * 255;
      ripplePixels[i + 3] = 255;
    }
  const ripples = texture(ripplePixels, size, false);
  const stone = texture(stonePixels, size);
  const foliage = texture(needles, size);
  foliage.wrapS = foliage.wrapT = THREE.ClampToEdgeWrapping;
  return {
    stone,
    foliage,
    ripples,
    dispose() {
      stone.dispose();
      foliage.dispose();
      ripples.dispose();
    },
  };
}
