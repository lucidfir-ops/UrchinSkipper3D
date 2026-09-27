const KEY = 'urchin-ui-scale-v1';
export const UI_SCALES = [50, 60, 70, 80, 90, 100, 110, 125, 150];
let scale = 100;
try {
  const saved = Number(globalThis.localStorage?.getItem(KEY));
  if (UI_SCALES.includes(saved)) scale = saved;
} catch {
  /* Browser preferences are optional. */
}
export const uiScale = () => scale;
export function applyUiScale() {
  const factor =
    typeof innerWidth === 'number' && Math.min(innerWidth, innerHeight) < 500 ? 0.8 : 1;
  globalThis.document?.documentElement.style.setProperty('--ui-scale', (scale / 100) * factor);
}
export function setUiScale(value) {
  scale = UI_SCALES.includes(Number(value)) ? Number(value) : 100;
  applyUiScale();
  try {
    globalThis.localStorage?.setItem(KEY, String(scale));
  } catch {
    /* Optional. */
  }
  globalThis.document?.querySelectorAll('[data-ui-scale]').forEach((b) => {
    b.textContent = `UI scale: ${scale}% · change`;
  });
  return scale;
}
export function changeUiScale(direction = 1, wrap = true) {
  const next = UI_SCALES.indexOf(scale) + direction;
  return setUiScale(
    UI_SCALES[
      wrap
        ? (next + UI_SCALES.length) % UI_SCALES.length
        : Math.max(0, Math.min(UI_SCALES.length - 1, next))
    ],
  );
}
