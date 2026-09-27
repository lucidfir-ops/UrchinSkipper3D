import { clamp } from './math.js';

// Game-scale hydrodynamic loads, in hull axes (metres, seconds). A stern
// appendage stabilizes a shaft boat; a leg has less area and a jet has none.
// Forces use water-relative motion, so a boat carried with uniform water has
// no perpetual rudder force. Wind is applied independently by boat.js.
export function waterLoads(spec, forward, lateral, turn, rudder, neutral = 1) {
  const appendage = spec.jetCount ? 0 : spec.vectorDrive ? 0.18 : 1;
  const exposure = spec.environmentResponse ?? 1;
  const bow = spec.length * 0.3;
  const stern = -spec.length * 0.43;
  // Make small amounts of real flow readable at idle. The smooth boost fades
  // in stronger flow and away from neutral; zero relative flow still gives no
  // rudder lift. Do not manufacture force from current over the ground.
  const lightFlow =
    ((spec.neutralRudderLift ?? 1) * forward * Math.exp(-((forward / 0.4) ** 2))) /
    (Math.abs(forward) + 0.035);
  // At passage speed, cutting the engine must not suddenly apply the full
  // low-speed stern/bow couple. Keep a small coasting response and blend back
  // to the established current response as water-relative speed falls.
  const coast = 0.08 + 0.92 * Math.exp(-((Math.max(0, forward) / 1.6) ** 4));
  const rudderFlow = clamp(forward * Math.abs(forward), -9, 9) * coast + lightFlow * neutral;
  const bowSide =
    -lateral *
    (0.8 + Math.abs(forward) * 0.55) *
    exposure *
    coast *
    (spec.jetCount ? 1.6 : spec.vectorDrive ? 1.2 : 1);
  return [
    { fore: bow, side: bowSide },
    // Redistribute the existing lateral hull resistance rather than counting
    // it twice. Rudder lift and rotational appendage drag remain additional.
    { fore: 0, side: -bowSide + lateral * 0.65 * appendage },
    {
      fore: stern,
      side:
        (-lateral - turn * stern) * 0.65 * appendage -
        rudderFlow * Math.sin(rudder * 0.65) * 0.6 * appendage * exposure,
    },
  ];
}
