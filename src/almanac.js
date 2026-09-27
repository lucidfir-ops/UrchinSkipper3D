import { sampleCurve, environmentMinute, updateEnvironment, currentAt } from './environment.js';
import { sectorDefinition } from './sectors.js';
import { terrainFor } from './career-terrain.js';
import { C } from './config.js';

function tideExtrema(curve, start, end) {
  const extrema = [];
  for (let minute = start + 2; minute < end - 2; minute += 2) {
    const before = sampleCurve(curve, minute - 2),
      height = sampleCurve(curve, minute),
      after = sampleCurve(curve, minute + 2);
    if (height >= before && height > after) extrema.push({ minute, height, kind: 'High' });
    if (height <= before && height < after) extrema.push({ minute, height, kind: 'Low' });
  }
  return extrema;
}
export function forecast(w, id, offset = 0) {
  const def = sectorDefinition(id),
    terrain = terrainFor(w, def);
  const now = environmentMinute(w),
    minute = now + offset,
    environment = { ...structuredClone(C.environment), ...structuredClone(def.environment) };
  const view = {
    terrain,
    environment,
    day: { phase: 'working', minute, groundId: id },
    time: w.time,
  };
  updateEnvironment(view);
  const station = terrain.tideStation || {
    x: terrain.size * 0.51,
    y: terrain.size * 0.52,
    name: 'Main-channel reference',
  };
  const vector = currentAt(view, station.x, station.y);
  return {
    definition: def,
    terrain,
    now,
    minute,
    height: environment.seaLevel,
    rate: environment.tideRate,
    flow: environment.flow,
    vector,
    station,
    extrema: tideExtrema(environment.tideCurve, minute, minute + 780),
    environment,
  };
}
export function forecastSeries(w, id) {
  const def = sectorDefinition(id),
    now = environmentMinute(w),
    start = Math.floor(now / 60) * 60,
    end = start + 720,
    samples = [];
  for (let minute = start; minute <= end; minute += 10)
    samples.push({
      minute,
      height: sampleCurve(def.environment.tideCurve, minute),
      flow: sampleCurve(def.environment.currentCurve, minute),
    });
  return { start, end, samples };
}

// Coarse planning estimates, intentionally less precise than the live debug grid.
export function estimatedCurrents(f) {
  const arrows = [],
    step = f.terrain.size / 7,
    view = { terrain: f.terrain, environment: f.environment, day: { groundId: f.definition.id } };
  for (let y = step; y < f.terrain.size - step / 2; y += step)
    for (let x = step; x < f.terrain.size - step / 2; x += step) {
      const v = currentAt(view, x, y),
        speed = Math.hypot(v.x, v.y);
      if (speed < 0.07) continue;
      const angle = (Math.round(Math.atan2(v.y, v.x) / (Math.PI / 8)) * Math.PI) / 8;
      arrows.push({ x, y, angle, strength: speed < 0.3 ? 1 : speed < 0.8 ? 2 : 3 });
    }
  return arrows;
}
