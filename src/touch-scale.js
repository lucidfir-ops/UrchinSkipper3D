const KEY = 'urchin-touch-scale-v1';
export const TOUCH_SCALES = Array.from({ length: 21 }, (_, i) => 50 + i * 5);
let scale = 100;
try {
  const saved = Number(globalThis.localStorage?.getItem(KEY));
  if (TOUCH_SCALES.includes(saved)) scale = saved;
} catch {
  /* Optional browser preference. */
}
export const touchScale = () => scale;
export function setTouchScale(value) {
  scale = TOUCH_SCALES.includes(Number(value)) ? Number(value) : 100;
  globalThis.document?.documentElement.style.setProperty('--touch-scale', scale / 100);
  globalThis.document?.body.classList.toggle('large-touch-controls', scale > 110);
  try {
    globalThis.localStorage?.setItem(KEY, String(scale));
  } catch {
    /* Optional. */
  }
  return scale;
}
export function changeTouchScale(direction) {
  return setTouchScale(
    TOUCH_SCALES[
      Math.max(0, Math.min(TOUCH_SCALES.length - 1, TOUCH_SCALES.indexOf(scale) + direction))
    ],
  );
}
