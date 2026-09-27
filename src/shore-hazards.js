import { seededRandom } from './math.js';
import { bedDepthAt } from './terrain.js';
import { coastTier } from './coasts.js';

const cache = new WeakMap();
const shoreDirections = Array.from({ length: 16 }, (_, i) => ({
  x: Math.cos((i * Math.PI) / 8),
  y: Math.sin((i * Math.PI) / 8),
}));
export function nearShore(terrain, x, y, range = 50) {
  for (const r of [range / 3, (range * 2) / 3, range])
    for (const direction of shoreDirections) {
      const px = x + direction.x * r,
        py = y + direction.y * r;
      if (
        px >= 0 &&
        py >= 0 &&
        px <= terrain.size &&
        py <= terrain.size &&
        bedDepthAt(terrain, px, py) <= 0
      )
        return true;
    }
  return false;
}

// One deterministic feature catalogue for charts and physical obstacles. Original
// bathymetry, fishing patches and decorative shore stones remain untouched.
export function fixedFeatures(terrain) {
  if (String(terrain.version).startsWith('frank-cove-')) return [];
  if (cache.has(terrain)) return cache.get(terrain);
  const random = seededRandom((terrain.provenance?.seed || 1606) ^ 0x51a0e),
    candidates = [],
    features = [];
  for (let y = 24; y < terrain.size - 24; y += 3)
    for (let x = 24; x < terrain.size - 24; x += 3) {
      const bed = bedDepthAt(terrain, x, y);
      if (bed < 1 || bed > 5 || !nearShore(terrain, x, y)) continue;
      candidates.push({ x, y, bed, score: random() });
    }
  candidates.sort((a, b) => b.score - a.score);
  const tier = coastTier(terrain.id),
    perDepth = Math.max(3, Math.round(terrain.size / 75)) + tier * 3;
  for (let band = 1; band <= 5; band++) {
    let count = 0;
    for (const point of candidates) {
      if (count >= perDepth) break;
      if (
        Math.round(point.bed) !== band ||
        features.some((f) => Math.hypot(f.x - point.x, f.y - point.y) < 17)
      )
        continue;
      const charted = tier ? count % (tier + 2) === 0 : count % 3 !== 2,
        outcrop = (count + band) % 4 === 0;
      features.push({
        id: `shore-${band}-${count}`,
        x: point.x,
        y: point.y,
        bed: point.bed,
        kind: outcrop ? 'rock outcrop' : 'rock',
        charted,
        // Uncharted crowns remain obvious, including when awash on a high tide.
        topDepth: charted ? -0.25 + random() * 0.85 : -1.7,
        radius: charted ? 1.1 + random() * 0.6 : 1.8 + random() * 0.5,
        length: outcrop ? 3 + random() * 2 : 0,
        heading: random() * Math.PI * 2,
        severity: outcrop ? 1.65 : 1.35,
      });
      count++;
    }
  }
  cache.set(terrain, features);
  return features;
}
