import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, decode, encode } from '../src/career-save.js';
import { chooseGround, latestDeparture } from '../src/day.js';
import {
  advanceDebugTime,
  debugActivate,
  debugChoices,
  setDebugTide,
  setDebugWeather,
} from '../src/debug-mode.js';
import { conditionsAt, weatherOutlook } from '../src/weather.js';

function workingWorld() {
  const w = careerWorld();
  assert(chooseGround(w, 'near').ok);
  Object.assign(w.boat, { throttle: 0, rudder: 0, vx: 0, vy: 0, turn: 0 });
  return w;
}

test('Debug mode sits below reveal and exposes the requested live tools', () => {
  const w = workingWorld(),
    ui = { screen: 'debug-mode' },
    choices = debugChoices(ui, w);
  assert.deepEqual(choices.slice(0, 8), [
    'Skip forward 30 minutes',
    `Set time · ${String(Math.floor(w.day.minute / 60)).padStart(2, '0')}:${String(Math.floor(w.day.minute % 60)).padStart(2, '0')}`,
    'Set weather · Natural forecast',
    'Set tide height · Natural tide',
    'Spawn taxi',
    'Spawn rival',
    'Spawn tourist boat',
    'Spawn DFO patrol',
  ]);
});

test('debug time advances the authoritative simulation and deadline warnings together', () => {
  const w = workingWorld();
  w.day.minute = latestDeparture(w) - 5;
  const beforeWorldSeconds = w.time,
    beforeFleet = w.career.todayFleet.map((boat) => boat.minute);
  const result = advanceDebugTime(w, 30);
  assert(result.ok);
  assert(Math.abs(w.day.minute - (latestDeparture(w) + 25)) < 1e-7);
  assert(Math.abs(w.time - (beforeWorldSeconds + 60)) < 1e-7);
  assert(w.day.warnings.includes('leave'));
  assert(w.day.warnings.includes('late'));
  assert(w.career.todayFleet.some((boat, i) => boat.minute >= beforeFleet[i]));
  assert(w.day.assisted);
});

test('forced weather and tide affect live systems, forecasts and validated reloads', () => {
  const w = workingWorld(),
    naturalCurrent = { ...w.environment.current };
  assert(setDebugWeather(w, 'storm').ok);
  assert.equal(conditionsAt(w).kind, 'storm');
  assert.equal(weatherOutlook(w).periods[0].name, 'Rough weather');
  assert(setDebugTide(w, 2.4).ok);
  assert.equal(w.environment.seaLevel, 2.4);
  assert.equal(w.environment.tideRate, 0);
  assert.deepEqual(w.environment.current, naturalCurrent);
  const restored = decode(encode(w));
  assert.equal(restored.career.debugConditions.weather, 'storm');
  assert.equal(restored.environment.seaLevel, 2.4);
  assert.equal(conditionsAt(restored).kind, 'storm');
  setDebugWeather(restored, 'natural');
  setDebugTide(restored, null);
  assert.notEqual(restored.environment.seaLevel, 2.4);
});

test('debug traffic commands use valid routes and repeated spawning respects the actor cap', () => {
  const w = workingWorld();
  for (const rival of w.career.todayFleet) {
    rival.area = 'near';
    rival.begin = 0;
    rival.end = 2000;
    rival.shipDone = false;
  }
  let saves = 0;
  const ui = {
    screen: 'debug-mode',
    index: 4,
    hooks: { save: () => saves++ },
    open(screen) {
      this.screen = screen;
    },
    back() {},
  };
  assert(debugActivate(ui, w));
  assert(w.traffic.actors.some((actor) => actor.kind === 'taxi'));
  ui.index = 5;
  debugActivate(ui, w);
  assert(w.traffic.actors.some((actor) => actor.kind === 'rival'));
  ui.index = 4;
  for (let repeat = 0; repeat < 12; repeat++) debugActivate(ui, w);
  assert(w.traffic.actors.length <= 7);
  assert(saves >= 2);
  assert(w.traffic.actors.every((actor) => actor.route.length > 0));
});

test('set-time choices clearly reject clock rewind', () => {
  const w = workingWorld();
  w.day.minute = 721;
  const choices = debugChoices({ screen: 'debug-time' }, w);
  assert(choices.includes('12:00 · already passed'));
  assert(choices.includes('Advance to 15:00'));
});
