import { bedDepthAt } from './terrain.js';
import { seededRandom } from './math.js';

export const patchVisible = (patch, reveal = false) => !!reveal || patch.charted !== false;

// Additive v5 recipe. Existing reef/shelf IDs, catches and authoring data survive.
export function addHiddenGround(base, patches) {
  const marked = patches.filter((p) => patchVisible(p)).length;
  const needed = marked * 2 - patches.filter((p) => !patchVisible(p)).length;
  const random = seededRandom(base.provenance.seed ^ 0x74ac5),
    places = [];
  for (let y = 20; y < base.size - 20; y += 8)
    for (let x = 20; x < base.size - 20; x += 8) {
      const depth = bedDepthAt(base, x, y);
      if (depth < 4 || depth > 20) continue;
      if (patches.some((p) => Math.hypot(x - p.x, y - p.y) < p.radius + 10)) continue;
      if (
        Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          const d = bedDepthAt(base, x + Math.cos(a) * 10, y + Math.sin(a) * 10);
          return d < 3 || d > 21.3;
        }).some(Boolean)
      )
        continue;
      places.push({ x, y, depth, score: random() });
    }
  places.sort((a, b) => b.score - a.score);
  let count = 0;
  for (const p of places) {
    if (count >= needed) break;
    if (patches.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.radius + 10)) continue;
    const id = `hidden-v5-${count++}`,
      stock = 2400 + Math.round(p.score * 2600);
    patches.push({
      id,
      name: `Unmarked reef ${count}`,
      kind: 'career',
      charted: false,
      x: p.x,
      y: p.y,
      radius: 10,
      initialStock: stock,
      remaining: stock,
      quality: [0.6, 0.8, 0.9, 0.7][count % 4],
      rate: [10, 16, 12, 9][count % 4],
      outline: Array.from({ length: 12 }, (_, i) => ({
        x: p.x + Math.cos((i * Math.PI) / 6) * 10,
        y: p.y + Math.sin((i * Math.PI) / 6) * 10,
      })),
      clumps: [
        [0, 0],
        [-4, -4],
        [4, -4],
        [4, 4],
        [-4, 4],
      ].map(([dx, dy], i) => ({
        id: `${id}-clump-${i}`,
        x: p.x + dx,
        y: p.y + dy,
        radius: 5.6,
        initialStock: stock / 5,
        remaining: stock / 5,
      })),
      drop: { x: p.x + 5, y: p.y },
      features: { depth: p.depth },
    });
  }
  if (count !== needed)
    throw new Error(`Hidden reef placement: ${count} of ${needed} safe patches`);
}
