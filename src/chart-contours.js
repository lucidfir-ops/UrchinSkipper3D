import { bedDepthAt } from './terrain.js';
const cache = new WeakMap();
export function chartContours(terrain) {
  if (cache.has(terrain)) return cache.get(terrain);
  const result = [],
    spacing = Math.max(6, terrain.spacing);
  for (const depth of [5, 10, 15, 20, 30, 50]) {
    const segments = [];
    for (let y = 0; y < terrain.size - spacing; y += spacing)
      for (let x = 0; x < terrain.size - spacing; x += spacing) {
        const corners = [
          [x, y],
          [x + spacing, y],
          [x + spacing, y + spacing],
          [x, y + spacing],
        ].map(([x, y]) => ({ x, y, depth: bedDepthAt(terrain, x, y) }));
        const crossings = [];
        for (let i = 0; i < 4; i++) {
          const a = corners[i],
            b = corners[(i + 1) % 4];
          if (a.depth < depth === b.depth < depth) continue;
          const t = (depth - a.depth) / (b.depth - a.depth);
          crossings.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
        for (let i = 0; i + 1 < crossings.length; i += 2)
          segments.push([crossings[i], crossings[i + 1]]);
      }
    result.push({ depth, segments });
  }
  cache.set(terrain, result);
  return result;
}
export function paintContours(ctx, terrain, scale, labels = true) {
  ctx.save();
  ctx.lineWidth = 0.65;
  ctx.strokeStyle = '#aed0bf70';
  ctx.fillStyle = '#d3dfc9';
  ctx.font = '9px system-ui';
  for (const contour of chartContours(terrain)) {
    ctx.beginPath();
    for (const [a, b] of contour.segments) {
      ctx.moveTo(a.x * scale, a.y * scale);
      ctx.lineTo(b.x * scale, b.y * scale);
    }
    ctx.stroke();
    const label = contour.segments[Math.floor(contour.segments.length * 0.57)]?.[0];
    if (label)
      if (labels) ctx.fillText(`${contour.depth} m`, label.x * scale + 3, label.y * scale - 3);
  }
  ctx.restore();
}
