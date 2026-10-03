import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer } from '../src/career-state.js';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import {
  conditionsAt,
  updateWeather,
  weatherPlanForDay,
  weatherOutlook,
  sevenDayForecast,
} from '../src/weather.js';

function voyage() {
  const w = careerWorld(createCareer(17));
  assert(chooseGround(w, 'near').ok);
  return w;
}

test('later voyage days use the same seeded weather as that calendar date at harbour', () => {
  const w = voyage();
  const original = encode(w);
  for (const day of [2, 3, 7, 12]) {
    const plan = weatherPlanForDay(w.career, day);
    const daily = {
      ...w,
      career: {
        ...w.career,
        day,
        weatherPlan: plan,
        previousWeatherPlan: { day: day - 1, periods: weatherPlanForDay(w.career, day - 1) },
      },
    };
    for (const minute of [0, 10, 20, 360, plan[1].minute, plan[1].minute + 30, 1439])
      for (const id of ['near', 'outer-wall'])
        assert.deepEqual(
          conditionsAt(w, (day - 1) * 1440 + minute, id),
          conditionsAt(daily, minute, id),
          `calendar day ${day}, minute ${minute}, ${id}`,
        );
  }
  assert.equal(encode(w), original, 'forecast queries cannot change the live career');
  assert.equal(conditionsAt(w, 1440 + weatherPlanForDay(w.career, 2)[1].minute + 30).kind, 'rain');
});

test('midnight changes weather gradually and a later storm survives reload and drives live wind', () => {
  const w = voyage();
  w.career.weatherPlan = [{ minute: 0, kind: 'rain', bearing: 230 }];
  const before = conditionsAt(w, 1439.99);
  const midnight = conditionsAt(w, 1440);
  assert.equal(midnight.rain, before.rain);
  assert.equal(midnight.visibility, before.visibility);
  for (const coast of ['near', 'outer-wall']) {
    const bearingBefore = conditionsAt(w, 1439.999, coast).bearing;
    const bearingAfter = conditionsAt(w, 1440, coast).bearing;
    assert(
      Math.abs(bearingAfter - bearingBefore) < 0.01,
      'wind direction joins continuously at midnight',
    );
  }
  assert(conditionsAt(w, 1450).rain > 0);
  assert(conditionsAt(w, 1450).rain < midnight.rain);
  assert.equal(conditionsAt(w, 1460).rain, 0);
  const tripId = w.day.careerTrip.id;
  w.day.minute = 6 * 1440 + weatherPlanForDay(w.career, 7)[1].minute + 30;
  updateWeather(w);
  assert.equal(w.weather.kind, 'squall');
  assert.equal(w.weather.rain, 1);
  const saved = decode(encode(w));
  updateWeather(saved);
  assert.deepEqual(saved.weather, w.weather);
  assert.deepEqual(saved.environment.wind, w.environment.wind);
  assert.equal(saved.career.day, 1);
  assert.equal(saved.day.careerTrip.id, tripId);
});

test('seven-day outlook starts at the actual voyage date and keeps forecast uncertainty and saved plans', () => {
  const w = voyage();
  const stored = structuredClone(w.career.weatherPlan);
  w.day.minute = 6 * 1440 + 600;
  const before = encode(w),
    forecast = sevenDayForecast(w);
  assert.deepEqual(
    forecast.map((day) => day.day),
    [7, 8, 9, 10, 11, 12, 13],
  );
  assert(forecast[0].periods.some((p) => p.name === 'Passing squall'));
  assert(forecast.at(-1).confidence < forecast[0].confidence);
  const daily = {
    ...w,
    day: { ...w.day, minute: 600 },
    career: { ...w.career, day: 7, weatherPlan: weatherPlanForDay(w.career, 7) },
  };
  assert.deepEqual(sevenDayForecast(daily), forecast);
  for (let day = 30; day < 55; day++) weatherPlanForDay(w.career, day);
  assert.deepEqual(sevenDayForecast(w), forecast, 'bounded cache eviction cannot reroll weather');
  assert.deepEqual(w.career.weatherPlan, stored);
  assert.equal(encode(w), before);
});

test('forced debug and training weather remains explicit across midnight without replacing natural plans', () => {
  const w = voyage();
  const original = structuredClone(w.career.weatherPlan);
  w.career.debugConditions = { weather: 'storm', bearing: 123 };
  for (const minute of [1439, 1440, 1450, 10080]) {
    w.day.minute = minute;
    assert.equal(conditionsAt(w).kind, 'storm');
    assert.equal(conditionsAt(w).rain, 0.85);
    assert.equal(weatherOutlook(w).periods[0].name, 'Rough weather');
  }
  delete w.career.debugConditions;
  w.day.minute = 1440 + weatherPlanForDay(w.career, 2)[1].minute + 30;
  assert.equal(conditionsAt(w).kind, 'rain');
  w.career.sandbox = true;
  w.career.testConditions = { weather: 'fog', bearing: 45 };
  assert.equal(conditionsAt(w).kind, 'fog');
  assert.deepEqual(w.career.weatherPlan, original);
});
