import { bedDepthAt, depthGradient } from './terrain.js';
import { seededRandom } from './math.js';

// Additive v6: preserve all v5 patch IDs/positions and place 26 more grounds.
// Three quarters of the addition follows bottom within 90 m of the shoreline.
export function addCoastalGround(base, patches) {
  const count = patches.filter((p) => p.charted === false).length,
    shoreTarget = Math.ceil(count * 0.75),
    random = seededRandom(base.provenance.seed ^ 0x6c0a57),
    places = [];
  for (let y = 18; y < base.size - 18; y += 6)
    for (let x = 18; x < base.size - 18; x += 6) {
      const depth = bedDepthAt(base, x, y);
      if (depth < 5 || depth > 19) continue;
      if (patches.some((p) => Math.hypot(x - p.x, y - p.y) < p.radius + 15)) continue;
      const g = depthGradient(base, x, y),
        angle = Math.atan2(g.x, -g.y),
        point = (along, across) => ({
          x: x + Math.cos(angle) * along - Math.sin(angle) * across,
          y: y + Math.sin(angle) * along + Math.cos(angle) * across,
        }),
        outline = Array.from({ length: 16 }, (_, i) =>
          point(14 * Math.cos((i * Math.PI) / 8), 6 * Math.sin((i * Math.PI) / 8)),
        );
      if (
        outline.some((p) => {
          const d = bedDepthAt(base, p.x, p.y);
          return d < 3 || d > 21.3;
        })
      )
        continue;
      const shore = [30, 60, 90].some((r) =>
        Array.from(
          { length: 16 },
          (_, i) =>
            bedDepthAt(
              base,
              x + r * Math.cos((i * Math.PI) / 8),
              y + r * Math.sin((i * Math.PI) / 8),
            ) <= 0,
        ).some(Boolean),
      );
      places.push({ x, y, depth, shore, outline, point, score: random() });
    }
  places.sort((a, b) => b.score - a.score);
  let added = 0;
  for (const coastal of [true, false]) {
    const target = coastal ? shoreTarget : count;
    for (const p of coastal
      ? places
      : [...places].sort((a, b) => Number(a.shore) - Number(b.shore) || b.score - a.score)) {
      if (added >= target) break;
      if (
        (coastal && !p.shore) ||
        patches.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.radius + 15)
      )
        continue;
      const id = `hidden-v6-${added}`,
        stock = 2400 + Math.round(p.score * 2600);
      patches.push({
        id,
        name: `Unmarked ${coastal ? 'coastal edge' : 'shelf'} ${added + 1}`,
        kind: 'career',
        charted: false,
        x: p.x,
        y: p.y,
        radius: 14,
        outline: p.outline,
        initialStock: stock,
        remaining: stock,
        quality: [0.6, 0.8, 0.9, 0.7][added % 4],
        rate: [10, 16, 12, 9][added % 4],
        clumps: [-8, -4, 0, 4, 8].map((along, i) => ({
          ...p.point(along, 0),
          id: `${id}-clump-${i}`,
          radius: 5.6,
          initialStock: stock / 5,
          remaining: stock / 5,
        })),
        drop: p.point(0, 5),
        features: { depth: p.depth, shoreline: p.shore },
      });
      added++;
    }
    if (added < target)
      throw new Error(`Coastal ground placement: ${added}/${target}, shoreline=${coastal}`);
  }
}
