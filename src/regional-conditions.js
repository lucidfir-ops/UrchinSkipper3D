import { coastTier, coastFor } from './coasts.js';
import { C } from './config.js';

// Home Coast's combined worst headwind/current must leave a loaded starter
// shaft boat enough reverse authority to back into deeper water in Realistic.
export function regionalLimits(id) {
  const home = !id || coastFor(id)?.id === 'home';
  return home
    ? { wind: 8, current: 0.6 / C.knotsPerMps, wave: 0.8 }
    : {
        wind: 30 * (1 + coastTier(id) * 0.32) * (1.12 + coastTier(id) * 0.08),
        current: C.environment.maxCurrent,
        wave: Infinity,
      };
}
export function localWind(wind, id, gust = 1) {
  return Math.min(regionalLimits(id).wind, wind * gust);
}
