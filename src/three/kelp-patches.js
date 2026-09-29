import { bedDepthAt } from '../terrain.js';
import { seededRandom } from '../math.js';

// Habitat-only stands. Their presence never reads/reveals hidden catch fields.
export function kelpPatches(terrain) {
  const random = seededRandom((terrain.provenance?.seed || 79824) ^ 0x9f26);
  const plants = [],
    centers = [];
  const lesson = String(terrain.version).startsWith('frank-cove-');
  if (lesson) centers.push({ x: 171, z: 66, radius: 17 }, { x: 77, z: 67, radius: 10 });
  const goal = lesson ? 7 : Math.min(48, Math.max(12, terrain.size / 24));
  for (let i = 0; i < 5000 && centers.length < goal; i++) {
    const x = random() * terrain.size,
      z = random() * terrain.size;
    const depth = bedDepthAt(terrain, x, z);
    if (depth < 2.5 || depth > 14 || centers.some((c) => Math.hypot(c.x - x, c.z - z) < 30))
      continue;
    centers.push({ x, z, radius: 8 + random() * 13 });
  }
  for (const center of centers) {
    const count = Math.round(center.radius * 3.5);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2,
        radius = Math.sqrt(random()) * center.radius;
      const x = center.x + Math.cos(angle) * radius,
        z = center.z + Math.sin(angle) * radius * 0.68;
      const depth = bedDepthAt(terrain, x, z);
      if (depth < 1.6 || depth > 16) continue;
      // Tall fronds reach the datum surface. Rising tide covers the canopy;
      // falling tide exposes its draped blades. Holdfasts remain on the bed.
      plants.push({
        x,
        z,
        y: -depth,
        length: Math.max(1, depth + 0.2 - random() * 1.1),
        tint: random(),
      });
    }
  }
  return plants;
}
