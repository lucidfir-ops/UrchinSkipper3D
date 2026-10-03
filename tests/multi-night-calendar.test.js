import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, nextCareerDay, encode, decode } from '../src/career-save.js';
import { chooseGround, requestRescue } from '../src/day.js';
import { careerDayAt } from '../src/career-calendar.js';
import {
  applyDiveInjury,
  exposureClock,
  newDiveHealth,
  stepDiveExposure,
} from '../src/dive-exposure.js';
import { checkDiverSafety, taxiSafetyStage } from '../src/diver-safety.js';
import { moveTraffic } from '../src/traffic-motion.js';

function voyage() {
  const w = careerWorld();
  assert(chooseGround(w, 'near').ok);
  w.terrain.depths = w.terrain.depths.slice().fill(20);
  w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  Object.assign(w.boat, { x: 500, y: 500, vx: 0, vy: 0, turn: 0, throttle: 0 });
  return w;
}

function contact(w, kind, speed) {
  const boat = {
    id: 'passing-boat',
    kind,
    x: 250,
    y: 250,
    heading: 0,
    vx: 0,
    vy: -speed,
    turn: 0,
    speed,
    throttle: 1,
  };
  Object.assign(w.diver, { state: 'surface', x: 250, y: 250 });
  checkDiverSafety(w, { ...boat, y: 265 }, { boat, spec: { length: 8, width: 3 }, exposed: false });
}

test('DCS acquired late in a continuous voyage keeps five calendar days of absence through rescue and reload', () => {
  let w = voyage();
  const tripId = w.day.careerTrip.id;
  w.day.minute = 6 * 1440 + 600;
  const record = w.career.people.ada;
  record.diveHealth = newDiveHealth(w.career, 'ada', exposureClock(w));
  record.diveHealth.pending = true;
  w.diver.state = 'surface';
  assert(applyDiveInjury(w, w.diver));
  assert.equal(careerDayAt(w), 7);
  assert.equal(record.availableDay, 12);
  assert.equal(record.medicalHistory.at(-1).day, 7);
  w = decode(encode(w));
  assert(requestRescue(w).ok);
  assert.equal(w.career.day, 1, 'settlement retains the departure date');
  assert.equal(w.career.lastSettled, tripId, 'the original transaction identity is preserved');
  assert.equal(w.career.people.ada.availableDay, 12);
  assert(w.career.people.ada.medicalHistory.every((event) => event.day === 7));
  w = nextCareerDay(decode(encode(w)));
  assert.equal(w.career.day, 8);
  assert.equal(w.diver.condition, 'injured');
  while (w.career.day < 11) w = nextCareerDay(w);
  assert.equal(w.career.people.ada.condition, 'injured');
  w = nextCareerDay(w);
  assert.equal(w.career.day, 12);
  assert.equal(w.career.people.ada.condition, 'fit');
});

test('late-voyage collision absence uses the injury date and carrying the injured diver does not restart it', () => {
  let w = voyage();
  contact(w, 'rival', 0.2);
  w.time += 3;
  w.day.minute = 6 * 1440 + 600;
  contact(w, 'rival', 3);
  assert.equal(w.diver.condition, 'injured');
  assert(requestRescue(w).ok);
  assert.equal(w.career.people.ada.availableDay, 10);
  assert.deepEqual(w.career.people.ada.medicalHistory.at(-1), {
    day: 7,
    outcome: 'Injured',
    cause: 'boat strike',
    availableDay: 10,
  });
  w = nextCareerDay(decode(encode(w)));
  assert.equal(w.career.day, 8);
  assert.equal(w.diver.condition, 'injured');
  // Isolate recovery from the roster's independent seeded one-day sick calls.
  w.career.people.milo.availableDay = w.career.day;
  w.divers[1].condition = 'fit';
  const departure = chooseGround(w, 'near');
  assert(departure.ok, departure.reason);
  w.boat.grounded = true;
  assert(requestRescue(w).ok);
  assert.equal(w.career.people.ada.availableDay, 10, 'no new injury occurred on this voyage');
  assert.equal(
    w.career.people.ada.medicalHistory.filter((event) => event.outcome === 'Injured').length,
    1,
  );
  w = nextCareerDay(w);
  assert.equal(w.career.day, 9);
  assert.equal(w.career.people.ada.condition, 'injured');
  w = nextCareerDay(w);
  assert.equal(w.career.people.ada.condition, 'fit');
});

test('continued diving across midnight records consecutive exposure days without restarting the voyage', () => {
  const w = voyage();
  Object.assign(w.diver, { state: 'harvesting', x: 250, y: 250 });
  for (const [minute, day, consecutive] of [
    [1439.5, 1, 1],
    [1440.5, 2, 2],
    [2880.5, 3, 3],
    [5760.5, 5, 1],
  ]) {
    w.day.minute = minute;
    stepDiveExposure(w, w.diver, 1);
    const h = w.career.people.ada.diveHealth;
    assert.equal(h.lastDiveDay, day);
    assert.equal(h.consecutiveDays, consecutive);
    assert.equal(h.bottomMinutes, 0.5);
    assert.equal(w.career.day, 1);
  }
  assert.deepEqual(decode(encode(w)).career.people.ada.diveHealth, w.career.people.ada.diveHealth);
});

test('taxi contact protection expires at actual day four and season two during a continuous voyage', () => {
  for (const [minute, stage, condition] of [
    [3 * 1440 - 0.5, 'near miss', 'fit'],
    [3 * 1440, 'injury', 'injured'],
    [9 * 1440 - 0.5, 'injury', 'injured'],
    [9 * 1440, 'normal', 'deceased'],
  ]) {
    let w = voyage();
    w.day.minute = minute;
    w = decode(encode(w));
    w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
    assert.equal(taxiSafetyStage(w, { kind: 'taxi' }), stage);
    contact(w, 'taxi', 15);
    assert.equal(w.diver.condition, condition);
    assert.equal(w.career.day, 1);
  }
});

test('taxi routing uses the same actual-day protection as collision consequences', () => {
  const headings = [];
  for (const minute of [3 * 1440 - 0.5, 3 * 1440]) {
    const w = voyage();
    w.day.minute = minute;
    Object.assign(w.diver, { state: 'surface', x: 120, y: 250 });
    const taxi = {
      id: 'test-taxi',
      kind: 'taxi',
      x: 80,
      y: 250,
      heading: Math.PI / 2,
      route: [{ x: 450, y: 250 }],
      routeStart: { x: 80, y: 250 },
      waypoint: 0,
      speed: 15,
      knots: 30,
      length: 9,
      width: 3.2,
      draft: 2,
      turnRate: 1.1,
      turn: 0,
      throttle: 1,
    };
    moveTraffic(w, taxi, 0.1);
    headings.push(taxi.heading);
  }
  assert.notEqual(headings[0], Math.PI / 2, 'day three steers around a surfaced diver');
  assert.equal(headings[1], Math.PI / 2, 'day four retains the committed straight pass');
});
