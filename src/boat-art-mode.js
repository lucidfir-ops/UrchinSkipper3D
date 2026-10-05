export const BOAT_ART_MODES = ['raster', 'vector'];
// October 4, 2026: the player-facing catalogue artwork switch was removed now
// that menus show the 3D models. Original raster illustrations remain the
// fixed reference art; the vector mode stays available to fixtures only.
let mode = 'raster';
export const boatArtMode = () => mode;
export const boatArtLabel = () => (mode === 'vector' ? 'Vector' : 'Raster');
export function setBoatArtMode(value) {
  mode = BOAT_ART_MODES.includes(value) ? value : 'raster';
  return mode;
}
export function toggleBoatArtMode() {
  return setBoatArtMode(mode === 'raster' ? 'vector' : 'raster');
}
