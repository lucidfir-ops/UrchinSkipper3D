import { bedDepthAt } from '../terrain.js';
import { seededRandom } from '../math.js';

// Fixed, chart-datum habitat. Neither distribution reads hidden catch fields;
// tides change the water column above these roots, never relocate the plants.
function habitat(terrain, { min, max, seed, radius, density, limit }) {
  const random = seededRandom((terrain.provenance?.seed || 79824) ^ seed);
  const plants = [],
    centers = [];
  const lesson = String(terrain.version).startsWith('frank-cove-');
  const goal = lesson ? 8 : Math.min(limit, Math.max(12, terrain.size / 28));
  const candidates = lesson
    ? [
        { x: 171, z: 66 },
        { x: 77, z: 67 },
      ]
    : [];
  for (let i = 0; i < 7000 && centers.length < goal; i++) {
    const { x, z } = candidates[i] || { x: random() * terrain.size, z: random() * terrain.size };
    const depth = bedDepthAt(terrain, x, z);
    if (depth < min || depth > max || centers.some((c) => Math.hypot(c.x - x, c.z - z) < radius))
      continue;
    centers.push({ x, z, radius: radius * (0.8 + random() * 0.55), angle: random() * Math.PI });
  }
  for (const [patch, center] of centers.entries()) {
    const count = Math.round(center.radius ** 2 * density);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2,
        // Ragged meadow edges with open seams inside the patch.
        radius = Math.sqrt(random()) * center.radius * (0.85 + Math.sin(angle * 3 + patch) * 0.15),
        u = Math.cos(angle) * radius,
        v = Math.sin(angle) * radius * 0.7;
      const x = center.x + u * Math.cos(center.angle) - v * Math.sin(center.angle),
        z = center.z + u * Math.sin(center.angle) + v * Math.cos(center.angle);
      if (x < 0 || z < 0 || x > terrain.size || z > terrain.size) continue;
      const depth = bedDepthAt(terrain, x, z);
      if (depth < min || depth > max) continue;
      plants.push({ x, z, y: -depth, depth, patch, tint: random(), variation: random() });
    }
  }
  return plants;
}

export function kelpPatches(terrain) {
  return habitat(terrain, {
    min: 4,
    max: 10,
    seed: 0x9f26,
    radius: 19,
    density: 0.24,
    limit: 40,
    // October 5: stipes grow to reach the surface at ordinary high water
    // (coastal tides run about −0.5 to +2.8 m), so high tide shows bulbs and
    // blades and low tide leaves 2.6–6 m of stipe floating on the surface.
  }).map((p) => ({ ...p, length: p.depth + 2.2 + p.variation * 3.5 }));
}

export function eelgrassPatches(terrain) {
  return habitat(terrain, {
    min: 2,
    max: 6,
    seed: 0xee16,
    radius: 32,
    density: 4.8,
    limit: 28,
  }).map((p) => ({ ...p, length: 0.7 + p.variation * 1.65 }));
}

// A buoyant canopy follows the surface until its finite stipe is stretched.
// Falling tide leaves more stem and blades afloat; rising tide submerges the
// shorter plants first. The holdfast remains fixed on the original seabed.
export function kelpExposure(plant, tide) {
  const depth = Math.max(0, plant.depth + tide);
  const slack = Math.max(0, plant.length - depth);
  return { depth, slack, top: Math.min(0.035, plant.length - depth), reach: 0.7 + slack * 0.85 };
}
