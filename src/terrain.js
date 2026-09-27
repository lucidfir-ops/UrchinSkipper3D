// Game-ready regular grids in local metres (x east, y south). Positive depth is
// below the dataset's vertical datum; sea level is added only by depthAt.
import { clamp } from './math.js';
export { clamp } from './math.js';
export function sampleGrid(grid, values, x, y, stride = 1, channel = 0) {
  const n = Math.round(grid.size / grid.spacing) + 1;
  const gx = clamp(x / grid.spacing, 0, n - 1),
    gy = clamp(y / grid.spacing, 0, n - 1);
  const ix = Math.min(n - 2, Math.floor(gx)),
    iy = Math.min(n - 2, Math.floor(gy));
  const tx = gx - ix,
    ty = gy - iy,
    a = (iy * n + ix) * stride + channel;
  return (
    values[a] * (1 - tx) * (1 - ty) +
    values[a + stride] * tx * (1 - ty) +
    values[a + n * stride] * (1 - tx) * ty +
    values[a + (n + 1) * stride] * tx * ty
  );
}
export const bedDepthAt = (terrain, x, y) => sampleGrid(terrain, terrain.depths, x, y);
// Same interpolation/arithmetic as sampleGrid; share the cell lookup across
// channels. Caller-owned storage avoids allocation for hot current queries.
export function sampleGridChannels(grid, values, x, y, out) {
  const n = Math.round(grid.size / grid.spacing) + 1,
    gx = clamp(x / grid.spacing, 0, n - 1),
    gy = clamp(y / grid.spacing, 0, n - 1),
    ix = Math.min(n - 2, Math.floor(gx)),
    iy = Math.min(n - 2, Math.floor(gy)),
    tx = gx - ix,
    ty = gy - iy,
    stride = out.length,
    base = (iy * n + ix) * stride;
  for (let k = 0; k < stride; k++) {
    const a = base + k;
    out[k] =
      values[a] * (1 - tx) * (1 - ty) +
      values[a + stride] * tx * (1 - ty) +
      values[a + n * stride] * (1 - tx) * ty +
      values[a + (n + 1) * stride] * tx * ty;
  }
  return out;
}
export const seaLevel = (w) => w.environment.seaLevel ?? 0;
export const depthAt = (w, x, y) => bedDepthAt(w.terrain, x, y) + seaLevel(w);
export function depthGradient(terrain, x, y, distance = terrain.spacing / 2) {
  return {
    x:
      (bedDepthAt(terrain, x + distance, y) - bedDepthAt(terrain, x - distance, y)) /
      (2 * distance),
    y:
      (bedDepthAt(terrain, x, y + distance) - bedDepthAt(terrain, x, y - distance)) /
      (2 * distance),
  };
}
