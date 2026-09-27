// Offline preprocessing. Runtime imports only the exported game-ready data.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createClumps, addTidalApron } from './world/harvest-clumps.js';
import { RECIPES } from '../world-source/sectors.js';
import { bedDepthAt } from '../src/terrain.js';
import { terrainFeatures, habitatSuitability } from './world/habitat.js';
import { generateCurrentField, authorFlow, shelterAt } from './world/current-field.js';

const round = (v) => Math.round(v * 100) / 100;
import { seededRandom } from '../src/math.js';
export { seededRandom } from '../src/math.js';
export function generateSector(recipe) {
  const { size, spacing } = recipe,
    random = seededRandom(recipe.seed),
    depths = [];
  for (let y = 0; y <= size; y += spacing)
    for (let x = 0; x <= size; x += spacing) {
      let shore = 1000;
      if (recipe.coast === 'west-north')
        shore = Math.min(
          x - (43 + 10 * Math.sin(y / 45) + 7 * Math.sin(y / 19)),
          y - (42 + 12 * Math.sin(x / 53)),
        );
      if (recipe.coast === 'east') shore = 561 + 13 * Math.sin(y / 55) + 6 * Math.sin(y / 22) - x;
      for (const island of recipe.islands) {
        const angle = Math.atan2((y - island.y) / island.ry, (x - island.x) / island.rx);
        const irregular =
          2.3 * Math.sin(angle * 7 + island.x * 0.1) + 1.4 * Math.sin(angle * 13 + island.y * 0.1);
        shore = Math.min(
          shore,
          (Math.hypot((x - island.x) / island.rx, (y - island.y) / island.ry) - 1) *
            Math.min(island.rx, island.ry) +
            irregular,
        );
      }
      // Blend authored cliff faces into the existing beaches. The same exported
      // bed drives chart colours, kelp, depth instruments and hull contact.
      let slope = recipe.shoreSlope;
      for (const cliff of recipe.cliffs || []) {
        const weight = Math.max(0, 1 - Math.hypot(x - cliff.x, y - cliff.y) / cliff.radius);
        slope = Math.max(
          slope,
          recipe.shoreSlope + (cliff.slope - recipe.shoreSlope) * Math.min(1, weight * 3),
        );
      }
      let depth = Math.min(55, shore * slope);
      for (const feature of [...recipe.reefs, ...recipe.shelves]) {
        const distance =
          (Math.hypot((x - feature.x) / feature.rx, (y - feature.y) / feature.ry) - 0.2) *
          Math.min(feature.rx, feature.ry);
        depth = Math.min(depth, feature.top + Math.max(0, distance) * feature.slope);
      }
      if (depth > 3) {
        for (const bowl of recipe.bowls)
          depth +=
            bowl.depth *
            Math.exp(-(((x - bowl.x) / bowl.rx) ** 2 + ((y - bowl.y) / bowl.ry) ** 2) * 2);
        depth += 0.5 * Math.sin(x / 29) * Math.sin(y / 34) * Math.min(1, (depth - 3) / 5);
      }
      if (recipe.tidalBasin) {
        const b = recipe.tidalBasin,
          dx = x - b.x,
          dy = y - b.y,
          angle = Math.atan2(dy, dx),
          r = Math.hypot(dx, dy) - 4 * Math.sin(angle * 11) - 3 * Math.cos(angle * 7);
        if (r < b.radius - 12) depth = b.depth + 0.2 * Math.sin(x / 20) * Math.sin(y / 20);
        else if (r < b.radius + 12) {
          const gate = dy > 0 && Math.abs(dx) < 17;
          depth = gate
            ? b.gateTop
            : -0.7 + (b.rimTop + 0.7) * (0.5 + 0.5 * Math.sin(x / 6) * Math.cos(y / 7));
        }
      }
      depths.push(round(Math.max(-18, depth)));
    }
  const terrain = {
    version: 2,
    id: recipe.id,
    size,
    spacing,
    depths,
    patches: [],
    landmarks: recipe.landmarks,
    ...(recipe.tidalBasin ? { tidalBasin: recipe.tidalBasin } : {}),
    ...(recipe.deep ? { deepGround: true } : {}),
    coordinates: {
      horizontal: 'local-metres',
      x: 'east',
      y: 'south',
      vertical: 'synthetic chart datum',
      positiveDepth: 'down',
      origin: null,
    },
    provenance: {
      kind: 'synthetic',
      seed: recipe.seed,
      recipe: `world-source/sectors.js#${recipe.id}`,
      notForNavigation: true,
      sources: [],
    },
  };
  const safe = (x, y, radius = 22) => {
    if (x < radius + 12 || y < radius + 12 || x > size - radius - 12 || y > size - radius - 12)
      return false;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4)
      if (bedDepthAt(terrain, x + Math.cos(a) * radius, y + Math.sin(a) * radius) < 3.3)
        return false;
    return bedDepthAt(terrain, x, y) > 3.3;
  };
  const separated = (x, y) => terrain.patches.every((p) => Math.hypot(x - p.x, y - p.y) > 51);
  const candidates = [];
  for (let y = 45; y < size - 35; y += 9)
    for (let x = 45; x < size - 35; x += 9) if (safe(x, y)) candidates.push({ x, y });
  function patch(x, y, quality, rate, extra) {
    const radius = 17,
      phase = random() * 6.28,
      outline = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i * Math.PI) / 10,
        r = radius * (0.87 + 0.1 * Math.sin(i * 1.7 + phase) + random() * 0.12);
      outline.push({
        x: round(x + Math.cos(angle) * r * 1.1),
        y: round(y + Math.sin(angle) * r * 0.86),
      });
    }
    const current = authorFlow(recipe, terrain, x, y),
      shelter = shelterAt(recipe, x, y);
    const features = terrainFeatures(terrain, x, y, {
      hardness: 0.65 + 0.2 * Math.sin(x / 110) * Math.sin(y / 75),
      shelter,
      current: Math.hypot(current.x, current.y),
    });
    return {
      x,
      y,
      radius: 19,
      outline,
      rate,
      quality,
      remaining: 1000,
      initialStock: 1000,
      drop: { x: x + 15, y },
      features,
      suitability: round(habitatSuitability(features)),
      ...extra,
    };
  }
  const speeds = [
    { id: 'fast', name: 'Fast', rate: 15 },
    { id: 'good', name: 'Good', rate: 10 },
    { id: 'mediocre', name: 'Mediocre', rate: 7.5 },
    { id: 'slow', name: 'Slow', rate: 5 },
  ];
  for (const [row, quality] of [0.9, 0.8, 0.7, 0.6].entries())
    for (const [column, speed] of speeds.entries()) {
      const target = {
        x: recipe.lab.x + column * recipe.lab.dx,
        y: recipe.lab.y + row * recipe.lab.dy,
      };
      const place = candidates
        .filter((p) => separated(p.x, p.y))
        .sort(
          (a, b) =>
            Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y),
        )[0];
      if (!place) throw new Error(`No safe matrix site: ${recipe.id} ${row}/${column}`);
      const id =
        quality === 0.9 && speed.id === 'good'
          ? 'good'
          : quality === 0.6 && speed.id === 'slow'
            ? 'poor'
            : quality === 0.7 && speed.id === 'mediocre'
              ? 'mediocre'
              : `q${quality * 100}-${speed.id}`;
      terrain.patches.push(
        patch(place.x, place.y, quality, speed.rate, {
          id,
          name: `${quality * 100}% · ${speed.name}`,
          kind: 'laboratory',
          matrix: { row, column },
          speed: speed.id,
        }),
      );
    }
  const natural = candidates
    .map((p) => ({
      ...p,
      score:
        habitatSuitability(terrainFeatures(terrain, p.x, p.y, { hardness: 0.7 })) *
        (0.7 + 0.3 * random()),
    }))
    .sort((a, b) => b.score - a.score);
  for (const place of natural) {
    if (terrain.patches.filter((p) => p.kind === 'habitat').length >= 5) break;
    if (!separated(place.x, place.y)) continue;
    const index = terrain.patches.length - 16,
      quality = [0.7, 0.9, 0.8, 0.6, 0.8][index],
      speed = speeds[index % 4];
    terrain.patches.push(
      patch(place.x, place.y, quality, speed.rate, {
        id: `habitat-${index + 1}`,
        name: `Reef ground ${index + 1}`,
        kind: 'habitat',
        speed: speed.id,
      }),
    );
  }
  const empty = candidates
    .filter((p) => separated(p.x, p.y))
    .sort(
      (a, b) =>
        Math.min(...terrain.patches.map((p) => Math.hypot(b.x - p.x, b.y - p.y))) -
        Math.min(...terrain.patches.map((p) => Math.hypot(a.x - p.x, a.y - p.y))),
    )[0];
  if (empty)
    terrain.patches.push(
      patch(empty.x, empty.y, 0, 0, {
        id: 'empty',
        name: 'Empty control ground',
        kind: 'control',
        remaining: 0,
        initialStock: 0,
        speed: 'empty',
      }),
    );
  addTidalApron(terrain);
  const clumpRandom = seededRandom(recipe.seed + 4711);
  for (const p of terrain.patches) p.clumps = createClumps(p, clumpRandom);
  terrain.currentField = generateCurrentField(recipe, terrain);
  const {
    id,
    name,
    travelMinutes,
    chart,
    harbourEdge,
    entry,
    description,
    character,
    flowLabel,
    environment,
  } = recipe;
  return {
    id,
    name,
    travelMinutes,
    chart,
    harbourEdge,
    entry,
    description,
    character,
    flowLabel,
    environment,
    terrain,
  };
}
export function generateSectors() {
  return {
    schemaVersion: 2,
    disclaimer: 'Synthetic game terrain — not for navigation.',
    sectors: RECIPES.map(generateSector),
  };
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const data = generateSectors();
  mkdirSync(new URL('../src/generated/', import.meta.url), { recursive: true });
  writeFileSync(
    new URL('../src/generated/sectors.json', import.meta.url),
    JSON.stringify(data) + '\n',
  );
  console.log(
    JSON.stringify(
      data.sectors.map((s) => ({
        id: s.id,
        size: s.terrain.size,
        patches: s.terrain.patches.length,
        stock: s.terrain.patches.reduce((a, p) => a + p.remaining, 0),
      })),
    ),
  );
}
