import { bedDepthAt, depthGradient, clamp } from '../../src/terrain.js';

// Deliberately provisional ecology, not a claim about real fishing grounds.
// Unknown substrate can remain null; the synthetic laboratory supplies a proxy.
export function terrainFeatures(terrain, x, y, environment = {}) {
  const d = bedDepthAt(terrain, x, y),
    g = depthGradient(terrain, x, y),
    h = terrain.spacing * 2;
  const curvature =
    (bedDepthAt(terrain, x + h, y) +
      bedDepthAt(terrain, x - h, y) +
      bedDepthAt(terrain, x, y + h) +
      bedDepthAt(terrain, x, y - h) -
      4 * d) /
    (h * h);
  const slope = Math.hypot(g.x, g.y);
  return {
    depth: d,
    slope,
    curvature,
    shelf: Math.exp(-(((slope - 0.12) / 0.2) ** 2)),
    bowl: clamp(-curvature * 30, 0, 1),
    shoulder: clamp(curvature * 30, 0, 1),
    hardness: environment.hardness ?? null,
    shelter: environment.shelter ?? 0,
    current: environment.current ?? 0,
    channelEdge: environment.channelEdge ?? 0,
    insideBend: environment.insideBend ?? 0,
  };
}
export function habitatSuitability(f, rules = {}) {
  const depthMin = rules.depthMin ?? 3,
    depthMax = rules.depthMax ?? 32;
  if (f.depth < depthMin || f.depth > depthMax) return 0;
  const depth = Math.min(1, (f.depth - depthMin) / 3, (depthMax - f.depth) / 6);
  const hardness = f.hardness ?? 0.5;
  return clamp(
    depth *
      (0.28 +
        0.25 * hardness +
        0.18 * f.shelf +
        0.09 * f.bowl +
        0.08 * f.shoulder +
        0.07 * f.channelEdge +
        0.05 * f.insideBend) *
      (1 - 0.35 * clamp(f.slope - 1, 0, 1)) *
      (0.85 + 0.15 * f.shelter),
    0,
    1,
  );
}
