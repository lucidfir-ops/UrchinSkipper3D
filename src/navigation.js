// Edge crossings are simulation facts. Menus and input devices cannot offload.
export const EDGE_NAMES = { north: 'NORTH', east: 'EAST', south: 'SOUTH', west: 'WEST' };
export const EDGE_BEARINGS = { north: 0, east: 90, south: 180, west: 270 };
export function crossedReturnBoundary(w) {
  const { x, y } = w.boat,
    size = w.terrain.size;
  return (
    { north: y <= 0, east: x >= size, south: y >= size, west: x <= 0 }[w.day.returnExit?.edge] ||
    false
  );
}
export const canExitSector = (w) =>
  !w.day.dump && w.day.phase === 'working' && w.divers.every((d) => d.state === 'ready');
export const canCrossReturnBoundary = (w) =>
  !w.day.dump &&
  w.divers.every((d) => d.state === 'ready') &&
  (w.day.phase === 'working' ||
    (w.career?.intro?.status === 'active' && w.career.intro.step === 9));
export function exitDistance(w) {
  const { x, y } = w.boat,
    size = w.terrain.size;
  return Math.max(
    0,
    { north: y, east: size - x, south: size - y, west: x }[w.day.returnExit?.edge] ?? 0,
  );
}
