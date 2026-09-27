// Pure shared arithmetic. Coordinate bearings use x east, y south, north = 0°.
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const bearing = (x, y) => ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
