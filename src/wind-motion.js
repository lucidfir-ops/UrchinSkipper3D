import { C } from './config.js';

// Aerodynamic loads and visual motion read the same local simulation wind (m/s).
// Preserve the previous total career load while moving its centre of pressure.
export const WIND_TUNING = Object.freeze({ careerLoad: 1.45, cabinShare: 0.8, crestThreshold: 8 });
export function windLoads(wind, spec, career = true) {
  const scale = spec.windage * (career ? WIND_TUNING.careerLoad : 1);
  const share = career && spec.cabinFore ? WIND_TUNING.cabinShare : 0;
  return [
    { fore: 0, x: wind.x * scale * (1 - share), y: wind.y * scale * (1 - share) },
    { fore: spec.cabinFore || 0, x: wind.x * scale * share, y: wind.y * scale * share },
  ];
}
export function windMotion(wind) {
  const speed = Math.hypot(wind.x, wind.y);
  return {
    speed,
    x: speed ? wind.x / speed : 0,
    y: speed ? wind.y / speed : 1,
    foam: Math.min(1, Math.max(0, (speed * C.knotsPerMps - WIND_TUNING.crestThreshold) / 22)),
  };
}
export function whitecapAt(x, y, time, wind, surfaceWave = null) {
  const m = windMotion(wind),
    surfaceFoam =
      surfaceWave === null ? m.foam : Math.max(0, Math.min(1, (surfaceWave - 0.012) / 0.08)),
    foam = Math.min(m.foam, surfaceFoam);
  const age =
    (((time * (0.13 + m.speed * 0.009) + Math.sin(x * 0.71 + y * 0.43) * 12) % 1) + 1) % 1;
  const travel = age * (4 + m.speed * 0.35);
  return {
    x: x + Math.sin(x * 1.31 + y * 0.79) * 2.8 + m.x * travel,
    y: y + Math.cos(x * 0.69 - y * 1.07) * 2.8 + m.y * travel,
    dx: -m.y,
    dy: m.x,
    alpha: Math.sin(age * Math.PI) ** 2 * foam,
    length: 1.4 + foam * 2.8,
    wind: m,
  };
}
export function rainMotion(wind) {
  const m = windMotion(wind);
  // Top-down rain travels downwind. Calm drops have a small perspective fall.
  return { x: wind.x * 29, y: wind.y * 29 + Math.max(0, 1 - m.speed / 3) * 90 };
}
