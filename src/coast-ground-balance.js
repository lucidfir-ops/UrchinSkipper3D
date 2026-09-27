import { bedDepthAt, depthGradient } from './terrain.js';
import { seededRandom } from './math.js';

export const COAST_QUALITY = [
  [0.6, 0.85],
  [0.65, 0.9],
  [0.7, 0.95],
  [0.8, 1],
  [0.9, 1],
];
export const COAST_MARKS = [13, 5, 4, 3, 2];

// Version 7 fills later maps without moving or replenishing existing reefs.
// Home Coast keeps every footprint and chart mark.
export function balanceCoastGround(base, patches, tier) {
  if (tier) {
    const random = seededRandom(base.provenance.seed ^ 0x925c0a57),
      places = [];
    if (patches.length < 65)
      for (let y = 16; y < base.size - 16; y += 5)
        for (let x = 16; x < base.size - 16; x += 5) {
          const depth = bedDepthAt(base, x, y);
          if (depth < 4 || depth > 20.5) continue;
          const gradient = depthGradient(base, x, y),
            angle = Math.atan2(gradient.x, -gradient.y),
            point = (along, across) => {
              const bend = across + (along / 10) ** 2 * 1.5;
              return {
                x: x + Math.cos(angle) * along - Math.sin(angle) * bend,
                y: y + Math.sin(angle) * along + Math.cos(angle) * bend,
              };
            },
            outline = Array.from({ length: 16 }, (_, i) =>
              point(Math.cos((i * Math.PI) / 8) * 10, Math.sin((i * Math.PI) / 8) * 4.5),
            );
          if (
            outline.some((p) => bedDepthAt(base, p.x, p.y) < 3 || bedDepthAt(base, p.x, p.y) > 21.3)
          )
            continue;
          places.push({ x, y, depth, outline, point, score: random() });
        }
    places.sort((a, b) => b.score - a.score);
    let added = 0;
    for (const p of places) {
      if (patches.length >= 65) break;
      if (patches.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.radius + 13)) continue;
      const id = `hidden-v7-${added++}`,
        stock = Math.round((3500 + p.score * 1500) * (1 + tier * 0.3));
      patches.push({
        id,
        name: `Unmarked offshore reef ${added}`,
        kind: 'career',
        charted: false,
        x: p.x,
        y: p.y,
        radius: 11,
        outline: p.outline,
        initialStock: stock,
        remaining: stock,
        quality: 0.6 + p.score * 0.3,
        rate: 12 + p.score * 6,
        clumps: [-5, 0, 5].map((along, i) => ({
          ...p.point(along, 0),
          id: `${id}-${i}`,
          radius: 4.5,
          initialStock: stock / 3,
          remaining: stock / 3,
        })),
        drop: { x: p.x, y: p.y },
        features: { depth: p.depth },
      });
    }
    if (patches.length < 65)
      throw new Error(`Coast ground balance: ${patches.length}/65 at ${base.id}`);
    const survey = [...patches].sort(
      (a, b) => Number(a.charted === false) - Number(b.charted === false),
    );
    const marks = new Set(survey.slice(0, COAST_MARKS[tier]));
    for (const patch of patches) patch.charted = marks.has(patch);
  }
  const [min, max] = COAST_QUALITY[tier];
  const quality = (value) =>
    Math.round((min + Math.max(0, Math.min(1, (value - 0.6) / 0.3)) * (max - min)) * 100) / 100;
  for (const patch of patches) {
    patch.quality = quality(patch.quality);
    for (const c of patch.clumps || []) if (c.quality != null) c.quality = quality(c.quality);
  }
}
