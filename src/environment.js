import { C } from './config.js';
import { clamp, depthAt, sampleGridChannels } from './terrain.js';
import { regionalLimits } from './regional-conditions.js';

const TAU = Math.PI * 2;
const channels = new Float64Array(7);
// Independent providers: a real station's height and current observations can
// replace either curve without assuming high water means slack current.
export function sampleCurve(curve, minute) {
  if (curve.samples?.length) {
    const points = curve.samples;
    const time = curve.periodMinutes
      ? points[0].minute +
        ((((minute - points[0].minute) % curve.periodMinutes) + curve.periodMinutes) %
          curve.periodMinutes)
      : minute;
    if (time <= points[0].minute) return points[0].value;
    for (let i = 1; i < points.length; i++)
      if (time <= points[i].minute) {
        const a = points[i - 1],
          b = points[i];
        return a.value + ((b.value - a.value) * (time - a.minute)) / (b.minute - a.minute);
      }
    return points.at(-1).value;
  }
  return (
    (curve.mean ?? 0) +
    (curve.components || []).reduce(
      (sum, h) => sum + h.amplitude * Math.cos((TAU * (minute - h.peakMinute)) / h.periodMinutes),
      0,
    )
  );
}
export function environmentMinute(w) {
  return (
    (w.career ? (w.career.day - 1) * 1440 : 0) +
    (w.day.phase === 'practice'
      ? w.day.minute + (w.time - (w.day.practiceTimeStart || 0)) * C.day.minutesPerSecond
      : w.day.minute)
  );
}
export function updateEnvironment(w) {
  const e = w.environment;
  if (e.model !== 'spatial-v1') return;
  const minute = environmentMinute(w);
  const forcedTide = w.career?.debugConditions?.tideHeight;
  e.seaLevel = Number.isFinite(forcedTide) ? forcedTide : sampleCurve(e.tideCurve, minute);
  e.tideRate = Number.isFinite(forcedTide)
    ? 0
    : (sampleCurve(e.tideCurve, minute + 0.5) - sampleCurve(e.tideCurve, minute - 0.5)) * 60;
  e.flow = sampleCurve(e.currentCurve, minute);
  e.residualFlow = 0.22 + 0.38 * (1 + Math.sin((TAU * (minute - 80)) / 530));
  e.minute = minute;
}
export function currentAt(w, x, y) {
  const test = w.career?.sandbox && w.career.testConditions;
  if (test && test.current !== null && Number.isFinite(test.current)) {
    const a = ((test.currentBearing ?? 0) * Math.PI) / 180,
      speed = test.current / C.knotsPerMps;
    return depthAt(w, x, y) > 0
      ? { x: Math.sin(a) * speed, y: -Math.cos(a) * speed }
      : { x: 0, y: 0 };
  }
  const e = w.environment,
    grid = w.terrain.currentField;
  // The uniform provider remains useful for isolated physics/controller fixtures.
  if (e.model !== 'spatial-v1' || !grid) return e.current;
  const depth = depthAt(w, x, y);
  if (depth <= 0) return { x: 0, y: 0 };
  sampleGridChannels(grid, grid.values, x, y, channels);
  const lag = channels[6];
  const flow = lag ? sampleCurve(e.currentCurve, e.minute - lag) : e.flow;
  const flood = Math.max(0, flow),
    ebb = Math.max(0, -flow),
    residual = e.residualFlow;
  // A modest change in cross-section as the tide falls; no CFD or tidal-height
  // derivative is used to invent a current direction.
  const wet = clamp(depth / 0.8, 0, 1),
    squeeze = clamp(1 + ((e.tideCurve.mean || 0) - e.seaLevel) * 0.045, 0.85, 1.15);
  let vx = (channels[0] * flood + channels[2] * ebb + channels[4] * residual) * wet * squeeze;
  let vy = (channels[1] * flood + channels[3] * ebb + channels[5] * residual) * wet * squeeze;
  const basin = w.terrain.tidalBasin;
  if (basin && Math.hypot(x - basin.x, y - basin.y) < basin.radius - 12) {
    // Exposed boulder rims break the race; high water overtops their shoulders.
    const shelter = 0.025 + 0.975 * clamp((e.seaLevel - 0.25) / 1.45, 0, 1);
    vx *= shelter;
    vy *= shelter;
  }
  const speed = Math.hypot(vx, vy),
    // Habitat authoring calls this provider without a live sector ID. Preserve
    // its original deterministic field so existing beds/IDs never relocate.
    limit = w.day?.groundId ? regionalLimits(w.day.groundId).current : C.environment.maxCurrent,
    scale =
      (limit / C.environment.maxCurrent) *
      Math.min(1, C.environment.maxCurrent / Math.max(1e-9, speed));
  // Scale the entire authored field, preserving channels, eddies and slack
  // instead of flattening every faster patch to the starter maximum.
  vx *= scale;
  vy *= scale;
  return { x: vx, y: vy };
}
