import { seededRandom } from './math.js';
import { arrivalPoint } from './arrival.js';
import exported from './generated/sectors.json' with { type: 'json' };
import { careerTerrain } from './career-terrain.js';
import { updateWeather } from './weather.js';
import { C } from './config.js';
import { createLogs } from './hazards.js';
import { createRocks } from './rock-collision.js';
import { depthAt } from './terrain.js';
import { updateEnvironment, currentAt } from './environment.js';

export const SECTORS = exported.sectors;
export const sectorDefinition = (id) => SECTORS.find((s) => s.id === id);
export function populateDebris(w) {
  const random = seededRandom(w.terrain.provenance?.seed ?? C.seed);
  w.debris = [];
  for (let i = 0; i < 900; i++) {
    const x = random() * w.terrain.size,
      y = random() * w.terrain.size;
    if (depthAt(w, x, y) > 0.2) w.debris.push({ x, y, phase: random() * 6.28 });
  }
}
export function materializeSector(w, id) {
  const definition = sectorDefinition(id);
  w.sectors ??= {};
  if (w.sectors[id]) return w.sectors[id];
  const base =
    w.career?.groundVersion >= 2
      ? careerTerrain(definition, w.career.groundVersion)
      : definition.terrain;
  // Bathymetry/current grids are immutable authored data. Only stock, clumps
  // and per-session flags need private copies for offshore accounting.
  const terrain = (w.sectors[id] = { ...base, patches: structuredClone(base.patches) });
  for (const record of w.career?.stock[id] || []) {
    const p = terrain.patches.find((p) => p.id === record.id);
    if (!p) continue;
    p.remaining = record.remaining;
    p.kelpCover = record.kelpCover || 0;
    for (const saved of record.clumps || []) {
      const clump = p.clumps?.find((c) => c.id === saved.id);
      if (clump) clump.remaining = saved.remaining;
    }
  }
  if (w.career) terrain.careerStockApplied = true;
  return terrain;
}
export function enterSector(w, id, patchId = 'good', lane = 0) {
  const definition = sectorDefinition(id);
  if (!definition) throw new Error(`Unknown sector ${id}`);
  w.terrain = materializeSector(w, id);
  w.patches = w.terrain.patches;
  w.environment = { ...structuredClone(C.environment), ...structuredClone(definition.environment) };
  updateEnvironment(w);
  updateWeather(w);
  const patch = w.patches.find((p) => p.id === patchId) || w.patches.find((p) => p.id === 'good');
  const drop = w.career ? arrivalPoint(w, definition, lane) : patch?.drop || definition.entry,
    c = currentAt(w, drop.x, drop.y);
  Object.assign(w.boat, {
    ...drop,
    heading: 0,
    vx: c.x,
    vy: c.y,
    speed: 0,
    throttle: 0,
    rudder: 0,
    turn: 0,
    grounded: false,
  });
  for (const d of w.divers) {
    d.x = w.boat.x;
    d.y = w.boat.y;
  }
  populateDebris(w);
  w.logs = createLogs(w);
  w.rocks = createRocks(w);
  w.sectorRevision = (w.sectorRevision || 0) + 1;
  return patch;
}
