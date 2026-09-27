import { createCareer, freshVessel } from './career-state.js';
import { FLEET, rankOf } from './career-data.js';
import { updateWeather, WEATHER } from './weather.js';
import { updateEnvironment } from './environment.js';
import { formatClock } from './day.js';
import { trafficSettings } from './traffic-settings.js';

// A new fishery, crew and chart history; only available hull choices carry over.
export function createTestCareer(source, seed = Date.now() >>> 0) {
  const c = createCareer(seed);
  c.sandbox = true;
  c.cash = 100000;
  c.xp = source?.xp || 0;
  c.fleet = Object.fromEntries(
    Object.keys(FLEET)
      .filter((id) => FLEET[id].rank <= rankOf(source || c) || source?.fleet[id])
      .map((id) => [id, freshVessel(id)]),
  );
  c.activeBoat = c.fleet[source?.activeBoat] ? source.activeBoat : 'basic';
  c.preferences = { arrivals: {} };
  c.testConditions = {
    weather: 'natural',
    bearing: 225,
    current: null,
    currentBearing: 0,
    freezeClock: false,
  };
  return c;
}
export function testConditionActions(w) {
  if (!w.career?.sandbox) return [];
  const c = (w.career.testConditions ??= {
    weather: 'natural',
    bearing: 225,
    current: null,
    currentBearing: 0,
    freezeClock: false,
  });
  const cycle = (values, value) => values[(values.indexOf(value) + 1) % values.length];
  const change = (id, label, run) => ({
    id,
    label,
    run: () => {
      run();
      w.day.assisted = true;
      updateEnvironment(w);
      updateWeather(w);
    },
  });
  return [
    change('test-traffic', `Other boats: ${trafficSettings(w).rate}× encounter rate`, () => {
      w.career.trafficSettings ??= {};
      w.career.trafficSettings.rate = cycle([0, 0.5, 1, 2], trafficSettings(w).rate);
    }),
    change(
      'test-traffic-route',
      `Traffic route: ${trafficSettings(w).patchId || 'random patch'}`,
      () => {
        w.career.trafficSettings ??= {};
        w.career.trafficSettings.patchId = cycle(
          [null, ...w.patches.filter((p) => p.remaining > 0).map((p) => p.id)],
          trafficSettings(w).patchId,
        );
      },
    ),
    change(
      'test-inspection-time',
      `DFO stop: ${trafficSettings(w).inspectionMinutes} game minutes`,
      () => {
        w.career.trafficSettings ??= {};
        w.career.trafficSettings.inspectionMinutes = cycle(
          [5, 10, 18, 30],
          trafficSettings(w).inspectionMinutes,
        );
      },
    ),
    change(
      'test-weather',
      `Weather: ${c.weather === 'natural' ? 'Forecast' : WEATHER[c.weather].name}`,
      () => {
        c.weather = cycle(['natural', ...Object.keys(WEATHER)], c.weather);
      },
    ),
    change('test-wind', `Wind direction: ${c.bearing}°`, () => {
      c.bearing = (c.bearing + 45) % 360;
    }),
    change(
      'test-current',
      `Current: ${c.current === null ? 'Natural tide' : c.current + ' kn'}`,
      () => {
        c.current = cycle([null, 0, 1, 2, 3, 4, 5], c.current);
      },
    ),
    change('test-flow-direction', `Current direction: ${c.currentBearing}°`, () => {
      c.currentBearing = (c.currentBearing + 45) % 360;
    }),
    change('test-time', `Time: ${formatClock(w.day.minute)} · advance 1 hour`, () => {
      w.day.minute = (w.day.minute + 60) % 1440;
      w.day.warnings = [];
    }),
    change('test-clock', `Clock: ${c.freezeClock ? 'HELD' : 'RUNNING'}`, () => {
      c.freezeClock = !c.freezeClock;
    }),
    change('test-natural', 'Restore natural conditions', () => {
      Object.assign(c, { weather: 'natural', current: null, freezeClock: false });
    }),
  ];
}
