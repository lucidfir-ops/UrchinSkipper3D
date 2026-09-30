const KEY = 'urchin-time-speed-v2';
export const DEFAULT_TIME_INCREASE = 0;
export const clampTimeIncrease = (value) =>
  Number.isFinite(Number(value))
    ? Math.max(-100, Math.min(100, Number(value)))
    : DEFAULT_TIME_INCREASE;
export function readTimeIncrease() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return clampTimeIncrease(saved);
    // Keep a deliberately saved physical pace while recentering the scale.
    const legacy = localStorage.getItem('urchin-time-speed-v1');
    return legacy !== null && Number.isFinite(Number(legacy))
      ? (Math.max(0, Math.min(100, Number(legacy))) - 100) / 2
      : DEFAULT_TIME_INCREASE;
  } catch {
    return DEFAULT_TIME_INCREASE;
  }
}
let increase = readTimeIncrease();
export const timeIncrease = () => increase;
export const worldTimeScale = () => 2 * (1 + increase / 100);
export function setTimeIncrease(value) {
  increase = clampTimeIncrease(value);
  try {
    localStorage.setItem(KEY, String(increase));
  } catch {
    /* This session remains adjustable when browser storage is unavailable. */
  }
}
