import { C } from './config.js';
import { enabledEquipment } from './equipment-controls.js';
import { roll, rankOf } from './career-data.js';
import { coastTier } from './coasts.js';
import { localWind, regionalLimits } from './regional-conditions.js';
import { careerDayAt } from './career-calendar.js';
export const WEATHER = {
  calm: { name: 'Light Winds', wind: 3, wave: 0.12, visibility: 500, rain: 0, lightning: 0 },
  // Precipitation is not a proxy for wind: steady coastal rain can arrive in calm air.
  rain: { name: 'Coastal rain', wind: 2, wave: 0.12, visibility: 180, rain: 0.65, lightning: 0 },
  fog: { name: 'Sea fog', wind: 4, wave: 0.12, visibility: 42, rain: 0.08, lightning: 0 },
  squall: { name: 'Passing squall', wind: 23, wave: 1.6, visibility: 100, rain: 1, lightning: 0.9 },
  storm: {
    name: 'Rough weather',
    wind: 30,
    wave: 2.2,
    visibility: 140,
    rain: 0.85,
    lightning: 0.55,
  },
};
export function weatherPlan(c) {
  const r = roll(c.seed, c.day + 817),
    kind = r < 0.34 ? 'calm' : r < 0.59 ? 'rain' : r < 0.8 ? 'fog' : r < 0.95 ? 'squall' : 'storm';
  const start = 700 + Math.floor(roll(c.seed, c.day + 981) * 300),
    duration = kind === 'squall' ? 80 : 210;
  return [
    { minute: 0, kind: 'calm', bearing: 210 },
    { minute: start, kind, bearing: 170 + Math.floor(roll(c.seed, c.day + 717) * 120) },
    { minute: start + duration, kind: kind === 'storm' ? 'rain' : 'calm', bearing: 230 },
  ];
}
const dailyPlans = new WeakMap();
export function weatherPlanForDay(c, day = c.day) {
  // Keep authored/saved conditions for their real date. Looking ahead must not
  // overwrite the departure-day plan or invent changes to an existing save.
  if (day === c.day && c.weatherPlan) return c.weatherPlan;
  if (day === c.previousWeatherPlan?.day) return c.previousWeatherPlan.periods;
  let cache = dailyPlans.get(c);
  if (!cache || cache.seed !== c.seed) {
    cache = { seed: c.seed, plans: new Map() };
    dailyPlans.set(c, cache);
  }
  if (!cache.plans.has(day)) {
    cache.plans.set(day, weatherPlan({ seed: c.seed, day }));
    if (cache.plans.size > 10) cache.plans.delete(cache.plans.keys().next().value);
  }
  return cache.plans.get(day);
}
export function conditionsAt(w, minute = w.day.minute, id = w.day.groundId) {
  const c = w.career;
  if (!c) return null;
  const test =
    c.debugConditions?.weather && c.debugConditions.weather !== 'natural'
      ? c.debugConditions
      : c.sandbox && c.testConditions;
  const day = careerDayAt(w, minute),
    localMinute = Math.max(0, minute - (day - c.day) * 1440),
    forced = test && test.weather !== 'natural' && WEATHER[test.weather],
    plan = forced
      ? [{ minute: 0, kind: test.weather, bearing: test.bearing ?? 225 }]
      : weatherPlanForDay(c, day),
    at = Math.max(
      0,
      plan.findLastIndex((p) => p.minute <= localMinute),
    ),
    segment = plan[at],
    midnightBlend = at === 0 && !forced && day > 1,
    prev = midnightBlend ? weatherPlanForDay(c, day - 1).at(-1) : plan[Math.max(0, at - 1)],
    mix = Math.max(0, Math.min(1, (localMinute - segment.minute) / 20));
  const a = WEATHER[prev.kind],
    b = WEATHER[segment.kind],
    blend = (key) => a[key] + (b[key] - a[key]) * mix;
  const night = localMinute < 360 || localMinute >= 1170,
    dusk = !night && (localMinute < 410 || localMinute > 1110),
    exposure = id === 'near' ? 0.58 : id === 'middle' ? 0.82 : 1,
    surfaceExposure = id === 'near' ? 0.18 : id === 'middle' ? 0.58 : 1,
    tier = coastTier(id),
    windFactor = 1 + tier * 0.32,
    rain = blend('rain'),
    wave = Math.min(
      regionalLimits(id).wave * (0.55 + 0.45 * surfaceExposure),
      (0.04 + surfaceExposure * 0.08 + blend('wave') * surfaceExposure ** 2) * (1 + tier * 0.25) +
        tier * 0.12,
    ),
    sunArc = Math.max(0, Math.sin(((localMinute - 360) / 810) * Math.PI)),
    sunlight = sunArc * Math.max(0.08, 1 - rain * 0.58 - (segment.kind === 'fog' ? 0.72 : 0)),
    // Carry direction through midnight along with wind strength. Later-coast
    // variation also joins yesterday's last phase instead of resetting abruptly.
    bearing = midnightBlend
      ? prev.bearing +
        (((segment.bearing - prev.bearing + 540) % 360) - 180) * mix +
        tier * 14 * (Math.sin(1440 / 19) * (1 - mix) + Math.sin(localMinute / 19) * mix)
      : segment.bearing + tier * 14 * Math.sin(localMinute / 19);
  return {
    kind: segment.kind,
    name:
      tier === 0 && ['storm', 'squall'].includes(segment.kind)
        ? 'Sheltered ' + (segment.kind === 'storm' ? 'storm' : 'squall')
        : b.name,
    wind: localWind(blend('wind') * windFactor, id) * (0.55 + 0.45 * exposure),
    exposure,
    bearing,
    wave,
    visibility: blend('visibility'),
    rain,
    lightning: blend('lightning'),
    sunlight,
    sunAngle: ((localMinute - 360) / 810) * Math.PI,
    night,
    darkness: night ? 0.82 : dusk ? 0.32 : 0,
  };
}
export function updateWeather(w) {
  if (!w.career) return;
  const c = conditionsAt(w);
  w.weather = c;
  const radians = (c.bearing * Math.PI) / 180,
    gust = 1 + Math.sin(w.time * 0.71) * (0.12 + coastTier(w.day.groundId) * 0.08),
    wind = localWind(c.wind, w.day.groundId, gust);
  w.environment.wind = {
    x: (Math.sin(radians) * wind) / C.knotsPerMps,
    y: (-Math.cos(radians) * wind) / C.knotsPerMps,
  };
  w.environment.waves = c.wave * 0.045;
  if (w.day.phase === 'working' && w.day.lastWeather !== c.kind) {
    if (w.day.lastWeather)
      w.events.push(`WEATHER · ${c.name.toUpperCase()} · WATCH THE WATER / RETURN WINDOW`);
    w.day.lastWeather = c.kind;
  }
}
export function weatherOutlook(w, offset = 0, id = w.day.groundId) {
  const c = w.career,
    day = careerDayAt(w) + offset,
    gear = enabledEquipment(w),
    confidence = Math.max(25, (gear.includes('forecast') ? 85 : 60 + rankOf(c) * 5) - offset * 6);
  const error =
      (roll(c.seed, day + 653) - 0.5) * ((gear.includes('forecast') ? 20 : 70) + offset * 20),
    forced = c.debugConditions?.weather,
    plan =
      !offset && forced && forced !== 'natural' && WEATHER[forced]
        ? [{ minute: 0, kind: forced, bearing: c.debugConditions.bearing ?? 225 }]
        : weatherPlanForDay(c, day);
  return {
    confidence,
    periods: plan.map((p, i) => ({
      minute: i ? Math.round((p.minute + error) / 30) * 30 : 0,
      name: WEATHER[p.kind].name,
      wind: Math.round(
        localWind(WEATHER[p.kind].wind * (1 + coastTier(id) * 0.32), id) *
          (id === 'near' ? 0.811 : id === 'middle' ? 0.919 : 1),
      ),
      visibility: WEATHER[p.kind].visibility < 60 ? 'Poor visibility' : 'Visibility variable',
    })),
  };
}
export function sevenDayForecast(w, id = w.day.groundId) {
  return Array.from({ length: 7 }, (_, offset) => ({
    day: careerDayAt(w) + offset,
    ...weatherOutlook(w, offset, id),
  }));
}
