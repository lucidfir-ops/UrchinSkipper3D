import { boatSpec } from './boats.js';
import { minimumHullDepth } from './hull-contact.js';
// Lane offsets are in world coordinates: west/east along a horizontal edge,
// north/south along a vertical edge. Labels must use those same coordinates.
export function arrivalLanes(definition) {
  const edge = definition.harbourEdge;
  return {
    south: ['South entrance · centre', 'Southwest approach', 'Southeast approach'],
    north: ['North entrance · centre', 'Northwest approach', 'Northeast approach'],
    west: ['West entrance · centre', 'Northwest approach', 'Southwest approach'],
    east: ['East entrance · centre', 'Northeast approach', 'Southeast approach'],
  }[edge];
}
export function arrivalPoint(w, definition, lane = 0) {
  const base = definition.entry;
  if (!lane) return { ...base };
  const horizontal = ['south', 'north'].includes(definition.harbourEdge),
    axis = horizontal ? 'x' : 'y';
  const spec = boatSpec(w),
    size = w.terrain.size,
    desired = base[axis] + (lane === 1 ? -90 : 90);
  for (let distance = 0; distance <= 180; distance += 5)
    for (const sign of [-1, 1]) {
      const point = {
        ...base,
        [axis]: Math.max(spec.length, Math.min(size - spec.length, desired + distance * sign)),
      };
      if (minimumHullDepth(w, point.x, point.y, 0) >= spec.draft + 0.3) return point;
    }
  return { ...base };
}
