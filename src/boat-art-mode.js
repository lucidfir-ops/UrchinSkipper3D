const KEY = 'urchin-boat-art-v1';
export const BOAT_ART_MODES = ['raster', 'vector'];
let mode = 'raster';
try {
  const saved = globalThis.localStorage?.getItem(KEY);
  if (BOAT_ART_MODES.includes(saved)) mode = saved;
} catch {
  /* This visual preference is optional in private browsing. */
}
export const boatArtMode = () => mode;
export const boatArtLabel = () => (mode === 'vector' ? 'Vector' : 'Raster');
export function setBoatArtMode(value) {
  mode = BOAT_ART_MODES.includes(value) ? value : 'raster';
  try {
    globalThis.localStorage?.setItem(KEY, mode);
  } catch {
    /* The live preference still works for this session. */
  }
  return mode;
}
export function toggleBoatArtMode() {
  return setBoatArtMode(mode === 'raster' ? 'vector' : 'raster');
}
