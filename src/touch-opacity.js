const KEY = 'urchin-touch-opacity-v1';
let opacity = 100;
try {
  const saved = globalThis.localStorage?.getItem(KEY);
  if (saved !== null && saved !== undefined && Number.isFinite(Number(saved)))
    opacity = Math.max(0, Math.min(100, Number(saved)));
} catch {
  /* Optional browser preference. */
}
export const touchOpacity = () => opacity;
export function setTouchOpacity(value) {
  opacity = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 100;
  globalThis.document?.documentElement.style.setProperty('--touch-opacity', opacity / 100);
  try {
    globalThis.localStorage?.setItem(KEY, String(opacity));
  } catch {
    /* Still usable for this session. */
  }
  return opacity;
}
