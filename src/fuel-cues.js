// October 5 (feedback/10-5): low fuel is heard as well as read. Once the home
// reserve is reached the engine misfires now and then; below the fuel needed
// for the home passage it coughs more often. Returns an engine gain/pitch
// multiplier for simulation time `time` (seconds), 1 when running cleanly.
export const FUEL_STUTTER = {
  warn: { period: 6.5, depth: 0.55 },
  danger: { period: 3.2, depth: 0.75 },
  misfireSeconds: 0.42,
};

export function fuelStutter(level, time) {
  const cue = FUEL_STUTTER[level];
  if (!cue || !Number.isFinite(time)) return 1;
  const cycle = Math.floor(time / cue.period),
    // A stable per-cycle offset keeps the misfires irregular, not metronomic.
    jitter = (Math.sin(cycle * 12.9898) * 43758.5453) % 1,
    start = Math.abs(jitter) * (cue.period - FUEL_STUTTER.misfireSeconds),
    t = time - cycle * cue.period - start;
  if (t < 0 || t > FUEL_STUTTER.misfireSeconds) return 1;
  // Two quick catches: dip, partial recovery, dip, recover.
  const phase = t / FUEL_STUTTER.misfireSeconds,
    dips = Math.abs(Math.sin(phase * Math.PI * 2));
  return 1 - cue.depth * dips;
}
