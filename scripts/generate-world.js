// Offline authoring only. Gameplay loads the committed dataset; it never regenerates it.
import { writeFileSync } from 'node:fs';
const size = 500,
  spacing = 2.5,
  depths = [];
const islands = [
  { x: 140, y: 115, rx: 53, ry: 40 },
  { x: 352, y: 140, rx: 44, ry: 58 },
  { x: 367, y: 370, rx: 63, ry: 47 },
  { x: 105, y: 365, rx: 26, ry: 45 },
];
for (let y = 0; y <= size; y += spacing)
  for (let x = 0; x <= size; x += spacing) {
    const coast = 38 + 14 * Math.sin(y / 49) + 8 * Math.sin(y / 21);
    let shore = x - coast;
    for (const i of islands) {
      const r = Math.hypot((x - i.x) / i.rx, (y - i.y) / i.ry);
      shore = Math.min(shore, (r - 1) * Math.min(i.rx, i.ry));
    }
    let depth = Math.min(50, shore * 0.52);
    for (const r of [
      { x: 287, y: 248, r: 15, top: 0.6 },
      { x: 244, y: 124, r: 10, top: -0.8 },
      { x: 182, y: 330, r: 13, top: 1.1 },
      { x: 335, y: 278, r: 12, top: -1.3 },
    ])
      depth = Math.min(
        depth,
        r.top + Math.max(0, Math.hypot(x - r.x, y - r.y) - r.r * 0.15) * 0.48,
      );
    depths.push(Math.round(Math.max(-12, depth) * 100) / 100);
  }
const patches = [
  {
    id: 'good',
    name: 'Good kelp ground',
    x: 228,
    y: 238,
    radius: 18,
    rate: 10,
    quality: 0.85,
    remaining: 1800,
    drop: { x: 250, y: 250 },
  },
  {
    id: 'poor',
    name: 'Poor thin reef',
    x: 259,
    y: 356,
    radius: 18,
    rate: 5,
    quality: 0.65,
    remaining: 150,
    drop: { x: 277, y: 356 },
  },
  {
    id: 'mediocre',
    name: 'Mediocre ledge',
    x: 410,
    y: 240,
    radius: 19,
    rate: 7.5,
    quality: 0.75,
    remaining: 900,
    drop: { x: 428, y: 247 },
  },
  {
    id: 'empty',
    name: 'Empty sand',
    x: 226,
    y: 294,
    radius: 19,
    rate: 0,
    quality: 0,
    remaining: 0,
    drop: { x: 234, y: 298 },
  },
];
writeFileSync(
  new URL('../src/world-data.json', import.meta.url),
  JSON.stringify({ version: '1.6', size, spacing, depths, patches }) + '\n',
);
