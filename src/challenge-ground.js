import { bedDepthAt } from './terrain.js';
// Rich but unmarked habitat. Positions are additive; never relocate old reefs.
export function addChallengeGround(base, patches, richCoast = false) {
  const b = base.tidalBasin;
  const places = [];
  if (b) {
    for (let y = -24; y <= 24; y += 24)
      for (let x = -24; x <= 24; x += 24) places.push({ x: b.x + x, y: b.y + y, vault: true });
  } else if (base.deepGround) {
    for (let y = 45; y < 555; y += 24)
      for (let x = 45; x < 555; x += 24) {
        const depth = bedDepthAt(base, x, y);
        if (
          depth < 18 ||
          depth > 20.5 ||
          patches.some((p) => Math.hypot(p.x - x, p.y - y) < 26) ||
          places.some((p) => Math.hypot(p.x - x, p.y - y) < 32)
        )
          continue;
        if (
          [
            [-10, -8],
            [10, -8],
            [12, 8],
            [-12, 8],
          ].some(([dx, dy]) => {
            const d = bedDepthAt(base, x + dx, y + dy);
            return d < 17 || d > 21.3;
          })
        )
          continue;
        places.push({ x, y });
        if (places.length >= 12) break;
      }
  }
  for (const [i, p] of places.slice(0, 12).entries()) {
    const id = `challenge-bed-${i}`,
      stock = p.vault ? 6000 : 5000;
    patches.push({
      id,
      name: p.vault ? 'Sheltered boulder picking' : 'Deep shoulder picking',
      kind: 'career',
      charted: false,
      ...p,
      radius: 13,
      initialStock: stock,
      remaining: stock,
      quality: 1,
      rate: p.vault ? 45 : 22,
      outline: [
        [-10, -8],
        [10, -8],
        [12, 8],
        [-12, 8],
      ].map(([x, y]) => ({ x: p.x + x, y: p.y + y })),
      clumps: [
        [-5, 0],
        [0, 0],
        [5, 0],
        [0, -5],
        [0, 5],
      ].map(([x, y], n) => ({
        id: `${id}-${n}`,
        x: p.x + x,
        y: p.y + y,
        radius: 7,
        quality: 1,
        initialStock: stock / 5,
        remaining: stock / 5,
      })),
      drop: { x: p.x, y: p.y },
      features: { depth: bedDepthAt(base, p.x, p.y) },
    });
  }
  if (base.deepGround && !richCoast)
    for (const p of patches)
      if (!p.id.startsWith('challenge-bed-') && p.features?.depth < 17) {
        p.quality = Math.min(p.quality, 0.65);
        for (const c of p.clumps || [])
          if (c.quality != null) c.quality = Math.min(c.quality, 0.65);
      }
}
