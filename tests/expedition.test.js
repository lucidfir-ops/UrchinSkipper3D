import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode, nextCareerDay } from '../src/career-save.js';
import { SECTORS } from '../src/sectors.js';
import { coastTier } from '../src/coasts.js';
import { careerTerrain } from '../src/career-terrain.js';
import { bedDepthAt } from '../src/terrain.js';
import { chooseGround, groundTrip } from '../src/day.js';
import { buyEquipment, buyVessel } from '../src/career-state.js';
import { conditionsAt, updateWeather, weatherOutlook } from '../src/weather.js';
import { recordKnowledge, markPosition, instrumentReadings } from '../src/knowledge.js';
import { pickupTolerance, setPreset, visibilityRange } from '../src/assists.js';
import { forecast } from '../src/almanac.js';
import { currentAt } from '../src/environment.js';
import { step, recoveryDuration } from '../src/simulation.js';
test('established reefs and new sheltered shelves keep safe working depths and conserved clumps', () => {
  for (const sector of SECTORS) {
    const terrain = careerTerrain(sector);
    const stockScale = 1 + coastTier(sector.id) * 0.3;
    assert(terrain.patches.length >= 8);
    for (const patch of terrain.patches) {
      assert(patch.remaining >= 1600 * stockScale && patch.remaining <= 7500 * stockScale);
      if (patch.id.startsWith('reef-'))
        assert(patch.remaining >= 2000 * stockScale && patch.remaining <= 3000 * stockScale);
      assert(patch.clumps.length >= (patch.id.startsWith('reef-') ? 7 : 5));
      assert(patch.outline.length >= (patch.id.startsWith('reef-') ? 14 : 4));
      for (const p of patch.outline) {
        const depth = bedDepthAt(terrain, p.x, p.y);
        assert(depth >= 2 && depth <= 21.3);
      }
      assert(Math.abs(patch.clumps.reduce((s, c) => s + c.remaining, 0) - patch.remaining) < 1e-8);
    }
  }
  const w = careerWorld();
  chooseGround(w, 'near');
  assert.equal(w.boat.x, SECTORS[0].entry.x);
  assert.equal(w.boat.y, SECTORS[0].entry.y);
});
test('weather forecast does not mutate the trip and night lights restore physical pickup reach', () => {
  const w = careerWorld();
  w.career.weatherPlan = [
    { minute: 0, kind: 'calm', bearing: 210 },
    { minute: 700, kind: 'fog', bearing: 230 },
  ];
  w.day.minute = 300;
  updateWeather(w);
  const base = pickupTolerance(w),
    range = visibilityRange(w);
  assert(conditionsAt(w).night);
  const before = encode(w),
    outlook = weatherOutlook(w);
  assert(outlook.periods.some((p) => p.name === 'Sea fog'));
  assert.equal(encode(w), before);
  assert(buyEquipment(w, 'lights').ok);
  assert(pickupTolerance(w) > base);
  assert(visibilityRange(w) > range);
  w.day.minute = 730;
  updateWeather(w);
  assert.equal(w.weather.visibility, 42);
  assert(w.environment.waves > 0);
  assert(Math.hypot(w.environment.wind.x, w.environment.wind.y) > 0);
});
test('recorded depths, sampled crew reports and marks survive save and new day without exposing stock', () => {
  const w = careerWorld();
  buyEquipment(w, 'plotter');
  w.career.day = 3;
  chooseGround(w, 'middle');
  const p = w.patches[0];
  Object.assign(w.boat, { x: p.x, y: p.y });
  Object.assign(w.diver, {
    state: 'surface',
    x: p.x - 4,
    y: p.y,
    patch: p,
    bag: 180,
    qualitySum: 144,
  });
  recordKnowledge(w);
  assert(markPosition(w).ok);
  const k = w.career.knowledge.middle;
  assert(Object.keys(k.depths).length);
  assert.equal(k.grounds[p.id].quality, 0.8);
  assert(!('remaining' in k.grounds[p.id]));
  Object.assign(w.diver, { bagHandled: true, bag: 0, qualitySum: 0 });
  w.time += 3;
  recordKnowledge(w);
  assert.equal(k.grounds[p.id].quality, 0.8);
  const saved = decode(encode(w));
  assert.deepEqual(saved.career.knowledge, w.career.knowledge);
  w.day.phase = 'complete';
  const next = nextCareerDay(w);
  assert.deepEqual(next.career.marks, w.career.marks);
  assert.deepEqual(next.career.knowledge, w.career.knowledge);
});
test('electronics measure actual surroundings; assists do not alter current or hidden stock', () => {
  const w = careerWorld();
  w.career.cash = 20000;
  w.career.xp = 5000;
  buyEquipment(w, 'scanner');
  buyEquipment(w, 'radar');
  buyEquipment(w, 'hoist');
  chooseGround(w, 'near');
  w.logs = [{ x: w.boat.x + 30, y: w.boat.y, length: 3, radius: 0.2, heading: 0 }];
  const r = instrumentReadings(w);
  assert.equal(r.scanner.length, 9);
  assert.equal(r.radar.length, 1);
  assert.equal(r.radar[0].distance, 30);
  const c = currentAt(w, w.boat.x, w.boat.y),
    stock = w.patches[0].remaining;
  setPreset(w, 'realistic');
  assert.equal(w.career.assists.groundDots, false);
  assert.deepEqual(currentAt(w, w.boat.x, w.boat.y), c);
  assert.equal(w.patches[0].remaining, stock);
  w.logs = [];
  step(w, {}, 1 / 60);
  assert.equal(recoveryDuration(w.diver), 2.2);
});
test('subsequent-day almanac and actual local current use the same continuous tide epoch', () => {
  const w = nextCareerDay(careerWorld());
  w.career.day = 5;
  chooseGround(w, 'far');
  const f = forecast(w, 'far'),
    c = currentAt(w, f.station.x, f.station.y);
  assert.deepEqual(c, f.vector);
  assert(f.minute > 1440);
  const before = w.day.minute;
  forecast(w, 'far', 180);
  assert.equal(w.day.minute, before);
});
test('faster hulls shorten passages, waves lengthen them, local fuel burn follows the working clock', () => {
  const w = careerWorld(),
    base = groundTrip(w, 'far').minutes;
  w.career.cash = 200000;
  w.career.xp = 5000;
  buyVessel(w, 'twinjet');
  assert(groundTrip(w, 'far').minutes < base);
  w.career.weatherPlan = [{ minute: 0, kind: 'storm', bearing: 210 }];
  updateWeather(w);
  const rough = groundTrip(w, 'storm-channel').minutes;
  w.career.weatherPlan = [{ minute: 0, kind: 'calm', bearing: 210 }];
  updateWeather(w);
  assert(rough > groundTrip(w, 'storm-channel').minutes);
  chooseGround(w, 'near');
  const fuel = w.boat.fuel;
  step(w, { fullAhead: true }, 1 / 60);
  assert(w.boat.fuel < fuel);
  assert.equal(w.costs.fuel, w.boat.fuelUsed * 2.15);
});
