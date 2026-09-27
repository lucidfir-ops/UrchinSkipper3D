import { visibilityRange } from './assists.js';
import { clamp } from './math.js';

export function bubbleOpacity(w, distance) {
  const range = visibilityRange(w);
  if (distance >= range) return 0;
  const far = clamp((distance - 12) / 48, 0, 1),
    waves = (w.weather?.wave ?? w.environment.waves ?? 0) >= 1.2,
    rain = (w.weather?.rain || 0) >= 0.15,
    weatherFade = (waves ? 1 - far * 0.5 : 1) * (rain ? 1 - far * 0.5 : 1),
    fogFade =
      w.weather?.kind === 'fog' ? clamp((range - distance) / Math.max(1, range * 0.4), 0, 1) : 1;
  return weatherFade * fogFade;
}
