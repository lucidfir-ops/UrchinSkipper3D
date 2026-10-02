import { clamp, sampleGridChannels } from './terrain.js';

const decoded = new WeakMap();
const low = new Float64Array(4),
  high = new Float64Array(4);

// Fixed-point baked data keeps the geography download/parse modest. Decode
// only the visited map; the hot path just interpolates two four-channel cells.
export function coastalLayers(grid) {
  if (!grid.encoding) return grid.layers;
  let layers = decoded.get(grid);
  if (!layers) {
    layers = grid.layers.map((encoded) => {
      const bytes = atob(encoded),
        values = new Float32Array((Math.round(grid.size / grid.spacing) + 1) ** 2 * 4),
        previous = [0, 0, 0, 0];
      let cursor = 0;
      for (let i = 0; i < values.length; i++) {
        let packed = 0,
          shift = 0,
          byte;
        do {
          if (cursor >= bytes.length || shift > 14) throw new Error('Invalid baked current data');
          byte = bytes.charCodeAt(cursor++);
          packed |= (byte & 127) << shift;
          shift += 7;
        } while (byte & 128);
        const channel = i % 4;
        previous[channel] += (packed >>> 1) ^ -(packed & 1);
        values[i] = previous[channel] / 1000;
      }
      if (cursor !== bytes.length) throw new Error('Invalid baked current grid size');
      return values;
    });
    decoded.set(grid, layers);
  }
  return layers;
}

export function sampleCoastalCurrent(grid, level, x, y, out) {
  const heights = grid.levels,
    layers = coastalLayers(grid);
  let upper = 1;
  while (upper < heights.length - 1 && heights[upper] < level) upper++;
  const lower = upper - 1;
  const blend = clamp((level - heights[lower]) / (heights[upper] - heights[lower]), 0, 1);
  sampleGridChannels(grid, layers[lower], x, y, low);
  sampleGridChannels(grid, layers[upper], x, y, high);
  for (let k = 0; k < 4; k++) out[k] = low[k] + (high[k] - low[k]) * blend;
  return out;
}
