import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { createCareer } from '../src/career-state.js';
import { chooseGround } from '../src/day.js';
import { runoffActive, releaseRunoff } from '../src/runoff.js';
import { weatherPlan } from '../src/weather.js';

test('a later voyage-day squall produces runoff after two hours and expires the next morning', () => {
  const w = careerWorld(createCareer(4));
  // This natural forecast is calm on departure day, then has an 80-minute
  // squall on day 2. Its runoff window is day 2 16:59 through day 3 10:19.
  assert(w.career.weatherPlan.every((period) => period.kind === 'calm'));
  const tomorrow = weatherPlan({ ...w.career, day: 2 });
  assert.deepEqual(
    tomorrow.map(({ minute, kind }) => [minute, kind]),
    [
      [0, 'calm'],
      [899, 'squall'],
      [979, 'calm'],
    ],
  );
  const before = JSON.stringify(w.career);
  assert.equal(runoffActive(w.career, 1440 + 1018.99), false);
  assert.equal(runoffActive(w.career, 1440 + 1019), true);
  assert.equal(runoffActive(w.career, 2880 + 619), true);
  assert.equal(runoffActive(w.career, 2880 + 619.01), false);
  assert.equal(JSON.stringify(w.career), before, 'runoff queries never advance the career');
});

test('late-voyage runoff releases physical timber once and the trip cap survives reload and later rain', () => {
  const w = careerWorld(createCareer(4));
  assert(chooseGround(w, 'near').ok);
  w.day.minute = 1440 + 1018;
  const logsBefore = w.logs.length;
  assert.equal(releaseRunoff(w), 0);
  w.day.minute++;
  const count = releaseRunoff(w);
  assert(count > 0);
  assert.equal(w.logs.length, logsBefore + count);
  assert.equal(releaseRunoff(w), 0);
  const restored = decode(encode(w));
  assert.equal(restored.logs.length, w.logs.length);
  assert.equal(releaseRunoff(restored), 0);
  let laterRainDays = 0;
  for (let offset = 2; offset < 12; offset++) {
    restored.day.minute = offset * 1440 + 1100;
    if (runoffActive(restored.career, restored.day.minute)) laterRainDays++;
    assert.equal(releaseRunoff(restored), 0, 'a long trip never multiplies the timber release');
  }
  assert(laterRainDays > 0, 'fixture includes subsequent rainy days');
  assert.equal(restored.logs.length, w.logs.length);
  assert.equal(restored.career.day, 1, 'the voyage retains its departure identity');
});

test('runoff honours saved previous-day weather and does not invent pre-career rain', () => {
  const c = createCareer(4);
  c.weatherPlan = [{ minute: 0, kind: 'calm' }];
  assert.equal(runoffActive(c, 300), false);
  c.day = 5;
  c.previousWeatherPlan = {
    day: 4,
    periods: [
      { minute: 0, kind: 'calm' },
      { minute: 1300, kind: 'rain' },
    ],
  };
  assert.equal(runoffActive(c, 300), true);
  assert.equal(runoffActive(c, 1080), true);
  assert.equal(runoffActive(c, 1080.01), false);
});
