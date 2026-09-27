const fract = (n) => n - Math.floor(n);
const noise = (n) => fract(Math.sin(n * 78.233 + 19.19) * 43758.5453);

export function lightningState(weather, time) {
  const intensity = Math.max(0, Math.min(1, weather?.lightning || 0));
  if (!intensity) return { flash: 0, strikeId: null, thunder: false };

  const interval = 11 - intensity * 3,
    strikeId = Math.floor(time / interval),
    start = strikeId * interval,
    happens = noise(strikeId + 7) < 0.38 + intensity * 0.52,
    strikeTime = start + 0.8 + noise(strikeId + 29) * (interval - 2),
    elapsed = time - strikeTime,
    first = elapsed >= 0 && elapsed < 0.09 ? 1 - elapsed / 0.09 : 0,
    second = elapsed >= 0.14 && elapsed < 0.27 ? 0.72 * (1 - (elapsed - 0.14) / 0.13) : 0,
    delay = 0.65 + noise(strikeId + 53) * 2.6;

  return {
    flash: happens ? Math.max(first, second) * (0.55 + intensity * 0.45) : 0,
    strikeId: happens ? strikeId : null,
    thunder: happens && elapsed >= delay && elapsed < delay + 0.4,
  };
}
