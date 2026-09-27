import { currentAt } from '../src/environment.js';
import { conditionsAt } from '../src/weather.js';
import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, nextCareerDay, encode, decode } from '../src/career-save.js';
import { createCareer, buyVessel, buyEquipment, hireCrew } from '../src/career-state.js';
import { chooseGround, returnToHarbour } from '../src/day.js';
import { setInstructions, recoveryDuration, step } from '../src/simulation.js';
import { rollBagUndersize, finishInspection, answerPatrol, stepFishery } from '../src/fishery.js';
import { stepBoat } from '../src/boat.js';
import { boatSpec } from '../src/boats.js';
import { bubbleOpacity } from '../src/bubble-visibility.js';
import { crewRoster } from '../src/crew-roster.js';
import { crewSkills } from '../src/crew-skills.js';
import { spawnTraffic, stepTraffic } from '../src/traffic.js';
import { vesselOverlap } from '../src/vessel-contact.js';
import { moveTraffic } from '../src/traffic-motion.js';
import { inspectionDue } from '../src/inspection-schedule.js';
import { FLEET_ORDER, FLEET } from '../src/career-data.js';
import { C } from '../src/config.js';
function world(seed = 125) {
  const w = careerWorld(createCareer(seed));
  w.career.trafficSettings = { rate: 0 };
  chooseGround(w, 'near');
  w.terrain.depths = w.terrain.depths.slice().fill(21);
  w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  w.logs = [];
  Object.assign(w.boat, { x: 250, y: 250, vx: 0, vy: 0, heading: 0, turn: 0, throttle: 0 });
  return w;
}
test('undersize rolls once per bag, around 1%, stays integer and survives reload', () => {
  const w = world(),
    d = w.diver;
  let count = 0;
  for (let n = 0; n < 10000; n++) {
    d.undersizeCount = null;
    const picked = rollBagUndersize(w, d);
    assert([0, 1].includes(picked));
    for (let i = 0; i < 10; i++) assert.equal(rollBagUndersize(w, d), picked);
    count += picked;
  }
  assert(count >= 65 && count <= 135, `${count}/10000`);
  const restored = decode(encode(w));
  assert.equal(rollBagUndersize(restored, restored.diver), d.undersizeCount);
  assert.equal(restored.career.people[d.crewId].bagsPicked, 10000);
});
test('DFO independently finds about 25% of undersize instances, bills the boat once and preserves crew shares', () => {
  const w = world();
  w.catch = 300;
  w.bags = [
    {
      crewId: w.diver.crewId,
      weight: 300,
      quality: 0.9,
      undersizeCount: 10000,
      harvestMinute: w.day.minute,
    },
  ];
  w.day.inspection = { status: 'boarding', seconds: 1 };
  const restored = decode(encode(w)),
    cash = w.career.cash;
  finishInspection(w);
  finishInspection(restored);
  assert(w.day.inspection.found > 2300 && w.day.inspection.found < 2700);
  assert.equal(w.day.inspectionFine, w.day.inspection.found * 1000);
  assert.equal(restored.day.inspectionFine, w.day.inspectionFine);
  assert.equal(w.career.cash, cash, 'paid at offload');
  assert.equal(w.catch, 300);
  const fine = w.day.inspectionFine;
  finishInspection(w);
  assert.equal(w.day.inspectionFine, fine);
  Object.assign(w.boat, { x: 250, y: w.terrain.size + 0.01 });
  const result = returnToHarbour(w);
  assert(result.ok);
  assert.equal(result.career.fine, fine);
  assert.equal(result.career.crewPay, Math.round(result.value * 0.4 * 100) / 100);
});
test('hireable roster has 32 balanced majors and a picking/air/tank diver', () => {
  for (const seed of [1, 1234, 917]) {
    const c = createCareer(seed),
      roster = crewRoster(c),
      counts = {};
    assert.equal(roster.length, 32);
    const assigned = roster.map((d) => crewSkills(d.id, seed));
    for (const s of assigned) {
      counts[s.major] = (counts[s.major] || 0) + 1;
      assert.equal(new Set([s.major, ...s.minors]).size, 3);
    }
    assert.deepEqual(Object.values(counts).sort(), [4, 4, 4, 5, 5, 5, 5]);
    assert(
      assigned.some((s) =>
        ['picking', 'air', 'tank'].every((k) => [s.major, ...s.minors].includes(k)),
      ),
    );
  }
});
test('patrol visits day 3, leaves five clear days, then chooses one day per eight-day block', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const c = createCareer(seed),
      w = { career: c, day: { minute: 840 } },
      visits = [];
    for (c.day = 1; c.day <= 48; c.day++) if (inspectionDue(w)) visits.push(c.day);
    assert.equal(visits[0], 3);
    assert(!visits.some((d) => d >= 4 && d <= 8));
    for (let start = 9; start <= 41; start += 8)
      assert.equal(visits.filter((d) => d >= start && d < start + 8).length, 1);
  }
});
test('boarding costs two extra seconds with a bag and after bag turnaround', () => {
  assert.equal(recoveryDuration({ recoveryAction: 'recoverBag' }), C.recovery.hookSeconds);
  assert.equal(recoveryDuration({ recoveryAction: 'recoverDiver' }), C.recovery.hookSeconds + 2);
  assert.equal(
    recoveryDuration({ recoveryAction: 'recoverDiver', bagHandled: true }),
    C.recovery.boardSeconds + 2,
  );
  assert.equal(recoveryDuration({ recoveryAction: 'recoverDiver', hookSeconds: 2.2 }), 4.2);
});
test('weather bubble fade preserves nearby visibility and combines rain and waves', () => {
  const w = world();
  w.weather = { kind: 'calm', visibility: 1000, wave: 0, rain: 0 };
  assert.equal(bubbleOpacity(w, 80), 1);
  w.weather.wave = 2;
  assert.equal(bubbleOpacity(w, 80), 0.5);
  w.weather.rain = 0.8;
  assert.equal(bubbleOpacity(w, 80), 0.25);
  assert.equal(bubbleOpacity(w, 5), 1);
  w.weather.wave = 0;
  assert.equal(bubbleOpacity(w, 80), 0.5);
  w.weather = { kind: 'fog', visibility: 45, wave: 0, rain: 0 };
  assert.equal(bubbleOpacity(w, 46), 0);
  assert(bubbleOpacity(w, 40) < 0.5);
});
test('twin jet pivot and fitted bow thruster have independent commands and fuel costs', () => {
  const w = careerWorld();
  w.career.cash = 1e6;
  w.career.xp = 12000;
  buyVessel(w, 'twinjet');
  buyEquipment(w, 'bowthruster');
  chooseGround(w, 'near');
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  w.environment = { current: { x: 0, y: 0 }, seaLevel: 0, waves: 0, wind: { x: 0, y: 0 } };
  Object.assign(w.boat, { x: 250, y: 250, vx: 0, vy: 0, heading: 0, throttle: 0, turn: 0 });
  const fuel = w.boat.fuel;
  for (let i = 0; i < 240; i++) stepBoat(w, { pivot: 1 }, 1 / 60);
  assert(w.boat.heading > 1);
  assert.equal(w.boat.thruster, 0);
  assert(Math.hypot(w.boat.x - 250, w.boat.y - 250) < 0.1);
  assert(w.boat.fuel < fuel);
  stepBoat(w, { thruster: -1 }, 1 / 60);
  assert.equal(w.boat.pivot, 0);
  assert.equal(w.boat.thruster, -1);
  stepBoat(w, { fullAhead: true, pivot: 1 }, 1 / 60);
  assert.equal(w.boat.pivot, 0);
  for (const id of FLEET_ORDER.filter((id) => id.endsWith('-sister')))
    assert.notEqual(FLEET[id].travelBurn, FLEET[id.replace('-sister', '')].travelBurn);
});
test('orders persist through offload, new days, reload, replacement and rehire', () => {
  let w = world();
  const id = w.diver.crewId;
  const orders = { direction: 5, minQuality: 0.8, searchLimit: 30, maxBagSeconds: 45 };
  assert(setInstructions(w, w.diver.id, orders));
  Object.assign(w.boat, { x: 250, y: w.terrain.size + 0.01 });
  assert(returnToHarbour(w).ok);
  w = decode(encode(nextCareerDay(w)));
  assert.deepEqual(w.career.people[id].orders, orders);
  assert(hireCrew(w, 'nell', 0).ok);
  assert(hireCrew(w, id, 0).ok);
  assert.deepEqual(Object.fromEntries(Object.keys(orders).map((k) => [k, w.diver[k]])), orders);
  w = nextCareerDay(w);
  assert(chooseGround(w, 'near').ok);
  assert.deepEqual(Object.fromEntries(Object.keys(orders).map((k) => [k, w.diver[k]])), orders);
});
test('DFO stands 100 m clear, requires invitation and docks within ten seconds even in shallow water', () => {
  for (const shallow of [false, true]) {
    const w = world();
    const a = spawnTraffic(w, 'dfo', { start: { x: 380, y: 250 } });
    assert(a);
    w.diver.state = 'surface';
    for (let n = 0; n < 30; n++) {
      w.time += 0.1;
      stepTraffic(w, 0.1);
    }
    assert.equal(w.day.inspection.status, 'calling');
    assert(Math.hypot(a.x - w.boat.x, a.y - w.boat.y) >= 99.5);
    answerPatrol(w);
    assert.equal(w.day.inspection.status, 'calling');
    w.diver.state = 'ready';
    if (shallow) w.terrain.depths = w.terrain.depths.slice().fill(0.1);
    answerPatrol(w);
    for (let n = 0; n < 100 && w.day.inspection.status !== 'boarding'; n++) {
      w.time += 0.1;
      stepTraffic(w, 0.1);
      assert(!vesselOverlap(a, a, w.boat, boatSpec(w), 0), `clipped in ${w.day.inspection.status}`);
    }
    assert.equal(w.day.inspection.status, 'boarding');
    assert(Math.abs(a.heading - w.boat.heading) < 0.01);
    stepFishery(w, 40);
    assert.equal(w.day.inspection.status, 'departing');
    for (let n = 0; n < 20; n++) {
      w.time += 0.1;
      stepTraffic(w, 0.1);
    }
    assert.equal(w.day.inspection.status, 'cleared');
  }
});
test('player cannot cross an NPC hull and old overlaps are separated', () => {
  const w = world(),
    a = spawnTraffic(w, 'taxi', { start: { x: 280, y: 250 } });
  Object.assign(a, { x: 250, y: 235, heading: Math.PI / 2 });
  Object.assign(w.boat, { vy: -12, throttle: 1 });
  for (let n = 0; n < 120; n++) {
    stepBoat(w, {}, 1 / 60);
    assert(!vesselOverlap(w.boat, boatSpec(w), a, a, 0));
  }
  Object.assign(a, { x: w.boat.x, y: w.boat.y });
  stepBoat(w, {}, 1 / 60);
  assert(!vesselOverlap(w.boat, boatSpec(w), a, a, 0));
});
test('taxi exits at its boundary waypoint rather than stopping against the map edge', () => {
  const w = world(),
    a = spawnTraffic(w, 'taxi', { start: { x: 20, y: 250 } });
  Object.assign(a, {
    x: w.terrain.size - 18,
    y: 250,
    heading: Math.PI / 2,
    waypoint: 0,
    route: [{ x: w.terrain.size - 8, y: 250 }],
  });
  assert(moveTraffic(w, a, 0.1));
});
test('real recovery carries exactly one saved bag roll into the deck inventory', () => {
  const w = world(),
    d = w.diver;
  Object.assign(d, {
    state: 'surface',
    x: 246,
    y: 250,
    bag: 300,
    qualitySum: 270,
    undersizeCount: 1,
    bagHandled: false,
  });
  for (let n = 0; n < 360 && w.catch === 0; n++) {
    const flow = w.environment.current;
    w.boat.vx = flow.x;
    w.boat.vy = flow.y;
    // The fixture holds the working side at the diver while real recovery runs.
    w.boat.x = d.x + 4;
    w.boat.y = d.y;
    w.boat.heading = 0;
    step(w, n === 0 ? { work: true } : {}, 1 / 60);
  }
  assert.equal(w.catch, 300);
  assert.equal(w.bags[0].undersizeCount, 1);
  assert.equal(d.state, 'surface');
});

test('sparse Test Mode conditions keep current and weather bearings finite', () => {
  const w = world();
  w.career.sandbox = true;
  w.career.testConditions = { current: 0, weather: 'calm' };
  const c = currentAt(w, w.boat.x, w.boat.y),
    weather = conditionsAt(w);
  assert(Number.isFinite(c.x) && Number.isFinite(c.y));
  assert(Number.isFinite(weather.bearing));
});
