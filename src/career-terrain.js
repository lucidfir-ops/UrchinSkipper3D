import { addChallengeGround } from './challenge-ground.js';
import { bedDepthAt, depthGradient } from './terrain.js';
import { C } from './config.js';
import { updateEnvironment, currentAt } from './environment.js';
import { roll } from './career-data.js';
import { addHiddenGround } from './hidden-ground.js';
import { addCoastalGround } from './coastal-ground.js';
import { coastTier } from './coasts.js';
import { balanceCoastGround } from './coast-ground-balance.js';
const cache = new WeakMap();
// Author shoreline-following strips on the immutable exported bed. This does
// not alter physics terrain or the established kelp/ground renderer.
export function careerTerrain(definition, version = 3) {
  const base = definition.terrain;
  if (cache.get(base)?.[version]) return cache.get(base)[version];
  const candidates = [],
    patches = [],
    seed = base.provenance.seed,
    view = {
      terrain: base,
      environment: {
        ...structuredClone(C.environment),
        ...structuredClone(definition.environment),
      },
      day: { phase: 'working', minute: 480 },
    };
  for (let y = 30; y < base.size - 30; y += 9)
    for (let x = 30; x < base.size - 30; x += 9) {
      const depth = bedDepthAt(base, x, y),
        g = depthGradient(base, x, y),
        slope = Math.hypot(g.x, g.y);
      if (depth >= 5 && depth <= 17 && slope > 0.06 && slope < 0.65)
        candidates.push({ x, y, depth, score: roll(seed, Math.round(x + y * base.size)) });
    }
  candidates.sort((a, b) => b.score - a.score);
  for (const start of candidates) {
    if (patches.length >= 12) break;
    if (patches.some((p) => Math.hypot(p.x - start.x, p.y - start.y) < 58)) continue;
    let peak = 0;
    for (let minute = 480; minute < 1440; minute += 60) {
      view.day.minute = minute;
      updateEnvironment(view);
      const c = currentAt(view, start.x, start.y);
      peak = Math.max(peak, Math.hypot(c.x, c.y) * C.knotsPerMps);
    }
    if (peak < 0.25 || peak > 3.6) continue;
    const trace = (sign) => {
      let x = start.x,
        y = start.y;
      const path = [];
      for (let i = 0; i < 5; i++) {
        const g = depthGradient(base, x, y),
          n = Math.hypot(g.x, g.y);
        if (n < 0.02) break;
        const error = bedDepthAt(base, x, y) - start.depth;
        x += (-g.y / n) * sign * 6 - (g.x / n) * error * 0.7;
        y += (g.x / n) * sign * 6 - (g.y / n) * error * 0.7;
        if (x < 12 || y < 12 || x > base.size - 12 || y > base.size - 12) break;
        if (bedDepthAt(base, x, y) < 3 || bedDepthAt(base, x, y) > 20) break;
        path.push({ x, y });
      }
      return path;
    };
    const line = [...trace(-1).reverse(), { x: start.x, y: start.y }, ...trace(1)];
    if (line.length < 7) continue;
    const left = [],
      right = [];
    let safe = true;
    line.forEach((p, i) => {
      const a = line[Math.max(0, i - 1)],
        b = line[Math.min(line.length - 1, i + 1)],
        dx = b.x - a.x,
        dy = b.y - a.y,
        n = Math.hypot(dx, dy) || 1,
        width = 4.7 + Math.sin(i * 0.8) * 0.9;
      for (const [edge, sign] of [
        [left, 1],
        [right, -1],
      ]) {
        const q = { x: p.x - (dy / n) * width * sign, y: p.y + (dx / n) * width * sign };
        if (bedDepthAt(base, q.x, q.y) < 2 || bedDepthAt(base, q.x, q.y) > 21.3) safe = false;
        edge.push(q);
      }
    });
    if (!safe) continue;
    const i = patches.length,
      stock = 2000 + Math.round(roll(seed, i + 771) * 1000),
      clumps = line.map((p, j) => ({
        ...p,
        id: `reef-${i}-clump-${j}`,
        radius: 6.4,
        remaining: stock / line.length,
        initialStock: stock / line.length,
      }));
    const landmark = base.landmarks
      .slice()
      .sort(
        (a, b) =>
          Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y),
      )[0];
    patches.push({
      id: `reef-${i + 1}`,
      name: `${landmark.name} ${['shelf', 'edge', 'bend', 'shoulder'][i % 4]}`,
      kind: 'career',
      x: start.x,
      y: start.y,
      radius: 36,
      outline: [...left, ...right.reverse()],
      clumps,
      initialStock: stock,
      remaining: stock,
      quality: [0.9, 0.8, 0.7, 0.8, 0.6][i % 5],
      rate: [10, 12, 7.5, 10, 5][i % 5],
      drop: { x: start.x + 7, y: start.y },
      features: { depth: start.depth },
    });
  }
  if (patches.length < 5) throw new Error('Insufficient safe career ground: ' + definition.id);
  if (version >= 3) addUnchartedShelves(base, patches, definition);
  if (version >= 5) addHiddenGround(base, patches);
  if (version >= 6) addCoastalGround(base, patches);
  if (version >= 4)
    for (const [i, p] of patches.entries()) {
      if (i % 3 !== 1 || !p.clumps) continue;
      p.mixedQuality = true;
      p.clumps.forEach((c, j) => {
        c.quality = Math.max(
          0.6,
          Math.min(0.9, Math.round((p.quality + [-0.1, 0, 0.1][j % 3]) * 10) / 10),
        );
      });
    }
  // Only new physical sectors gain richer initial stock. Established maps and
  // their clump identities/capacities remain byte-for-byte compatible.
  const tier = coastTier(definition.id);
  if (tier)
    for (const p of patches) {
      p.initialStock *= 1 + tier * 0.3;
      p.remaining *= 1 + tier * 0.3;
      if (version < 7) p.quality = Math.min(0.95, p.quality + tier * 0.03);
      for (const clump of p.clumps || []) {
        clump.initialStock *= 1 + tier * 0.3;
        clump.remaining *= 1 + tier * 0.3;
        if (version < 7 && clump.quality != null)
          clump.quality = Math.min(0.95, clump.quality + tier * 0.03);
      }
    }
  if (tier) {
    // Sparse chart marks do not imply scarce catch. Preserve all bed identities.
    for (const [i, p] of patches.entries()) if (i % (tier + 2) !== 0) p.charted = false;
  }
  if (tier >= 3) addChallengeGround(base, patches, version >= 7);
  if (version >= 7) balanceCoastGround(base, patches, tier);
  const terrain = { ...base, patches, careerGroundVersion: version };
  const versions = cache.get(base) || {};
  versions[version] = terrain;
  cache.set(base, versions);
  return terrain;
}
export const terrainFor = (w, def) =>
  w.sectors?.[def.id] ||
  (w.career?.groundVersion >= 2 ? careerTerrain(def, w.career.groundVersion) : def.terrain);

// Additive recipe: established reef/clump IDs and bathymetry never move in saved careers.
function addUnchartedShelves(base, patches, definition) {
  const places = [];
  for (let y = 24; y < base.size - 24; y += 12)
    for (let x = 24; x < base.size - 24; x += 12) {
      const depth = bedDepthAt(base, x, y),
        g = depthGradient(base, x, y);
      if (depth < 5 || depth > 13 || Math.hypot(g.x, g.y) > 0.38) continue;
      // Working bottom beside a shallower kelp-bearing edge; avoid exposed isolated pinnacles.
      const ring = Array.from({ length: 8 }, (_, i) =>
        bedDepthAt(
          base,
          x + Math.cos((i * Math.PI) / 4) * 18,
          y + Math.sin((i * Math.PI) / 4) * 18,
        ),
      );
      if (!ring.some((d) => d >= 1 && d < 7) || ring.filter((d) => d > 22).length > 3) continue;
      if (patches.some((p) => Math.hypot(p.x - x, p.y - y) < p.radius + 19)) continue;
      if (
        [
          [-14, -13],
          [13, -14],
          [15, 12],
          [-12, 15],
          [-12, -12],
          [12, -12],
          [-12, 12],
          [12, 12],
        ].some(([dx, dy]) => {
          const d = bedDepthAt(base, x + dx, y + dy);
          return d < 3 || d > 18;
        })
      )
        continue;
      const distance = Math.hypot(x - definition.entry.x, y - definition.entry.y);
      places.push({ x, y, depth, distance, score: roll(base.provenance.seed, x * 3 + y * 997) });
    }
  places.sort((a, b) => a.distance - b.distance);
  const selected = [];
  if (places.length) selected.push(places[0]);
  places.sort((a, b) => b.score - a.score);
  for (const p of places) {
    if (selected.length >= 7) break;
    if (selected.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 46)) continue;
    selected.push(p);
  }
  for (const [i, p] of selected.entries()) {
    const stock = i === 0 ? 7500 : 1600 + Math.round(p.score * 1700);
    const id = `shelf-v3-${i}`;
    const clumps = [
      [-6, -6],
      [6, -6],
      [6, 6],
      [-6, 6],
      [0, 0],
    ].map(([dx, dy], j) => ({
      id: `${id}-${j}`,
      x: p.x + dx,
      y: p.y + dy,
      radius: 7.5,
      remaining: stock / 5,
      initialStock: stock / 5,
    }));
    patches.push({
      id,
      name: i === 0 ? 'Entrance picking shelf' : `Sheltered bottom ${i}`,
      kind: 'career',
      x: p.x,
      y: p.y,
      radius: 19,
      outline: [
        [-14, -13],
        [13, -14],
        [15, 12],
        [-12, 15],
      ].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })),
      clumps,
      initialStock: stock,
      remaining: stock,
      quality: i === 0 ? 0.6 : [0.7, 0.8, 0.9][i % 3],
      rate: i === 0 ? 16 : 9,
      charted: i === 0,
      drop: { x: p.x + 7, y: p.y },
      features: {
        depth: p.depth,
        habitat: 'Sheltered bottom beside kelp; current-borne food settles here.',
      },
    });
  }
}
