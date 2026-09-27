const KEY = 'urchin-time-speed-v1';
export const DEFAULT_TIME_INCREASE = 50;
export const clampTimeIncrease = (value) =>
  Number.isFinite(Number(value))
    ? Math.max(0, Math.min(100, Number(value)))
    : DEFAULT_TIME_INCREASE;
export function readTimeIncrease() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === null ? DEFAULT_TIME_INCREASE : clampTimeIncrease(saved);
  } catch {
    return DEFAULT_TIME_INCREASE;
  }
}
let increase = readTimeIncrease();
export const timeIncrease = () => increase;
export const worldTimeScale = () => 1 + increase / 100;
export function setTimeIncrease(value) {
  increase = clampTimeIncrease(value);
  try {
    localStorage.setItem(KEY, String(increase));
  } catch {
    /* This session remains adjustable when browser storage is unavailable. */
  }
}
