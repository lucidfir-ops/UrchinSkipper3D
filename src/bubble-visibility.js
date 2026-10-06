import { visibilityRange } from './assists.js';
import { enabledEquipment } from './equipment-controls.js';
import { clamp } from './math.js';

// October 5 (designer): at night divers work with flashlights or do not dive.
// Their torch lights their own bubbles, so lit bubbles are seen as far as by
// day (weather visibility; fog, rain and waves still apply) rather than only
// inside the boat's work-light range. Reefs and unlit divers keep the night limit.
export function diverLightsOn(w) {
  return !!w.weather?.night && enabledEquipment(w).includes('torch');
}

export function bubbleOpacity(w, distance, lit = false) {
  const range = lit && diverLightsOn(w) ? (w.weather?.visibility ?? 1000) : visibilityRange(w);
  if (distance >= range) return 0;
  const far = clamp((distance - 12) / 48, 0, 1),
    waves = (w.weather?.wave ?? w.environment.waves ?? 0) >= 1.2,
    rain = (w.weather?.rain || 0) >= 0.15,
    weatherFade = (waves ? 1 - far * 0.5 : 1) * (rain ? 1 - far * 0.5 : 1),
    fogFade =
      w.weather?.kind === 'fog' ? clamp((range - distance) / Math.max(1, range * 0.4), 0, 1) : 1;
  return weatherFade * fogFade;
}
