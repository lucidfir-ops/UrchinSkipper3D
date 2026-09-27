import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, nextCareerDay, snapshot, restore } from '../src/career-save.js';
import { chooseGround, returnToHarbour, passageMinutes, GROUNDS } from '../src/day.js';
import { fuelPlan, departureBriefing, fuelStatus } from '../src/preparation.js';
import { engineState } from '../src/operating-state.js';
import { stepBoat } from '../src/boat.js';
import { boatSpec } from '../src/boats.js';
import {
  buyEquipment,
  buyVessel,
  useVessel,
  sellVessel,
  settleCareer,
} from '../src/career-state.js';
import { calculateOffload } from '../src/offload.js';
import { diverSpec, workCrew } from '../src/crew.js';
import { careerActivate } from '../src/career-actions.js';
import { forecastClock } from '../src/almanac-view.js';
import { neighbour } from '../src/menu-navigation.js';

test('video departure warns about 33 L versus outward, home and reserve; no fuel is silently created', () => {
  const w = careerWorld();
  w.boat.fuel = 33;
  const plan = fuelPlan(w, 'near'),
    brief = departureBriefing(w, 'near');
  assert.equal(plan.outbound, 15);
  assert.equal(plan.home, 15);
  assert.equal(plan.workingMinutes, 0);
  assert(brief.notes.some((n) => n.level === 'danger' && /no fuel reserve/.test(n.text)));
  assert(chooseGround(w, 'near').ok);
  assert.equal(w.boat.fuel, 18);
  assert.equal(fuelStatus(w).text, 'HOME FUEL RESERVE REACHED');
});
test('empty tank retains responsive helm and natural drift, with no commanded engine forces or burn', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  Object.assign(w.environment, {
    model: 'uniform',
    current: { x: 0, y: 0 },
    wind: { x: 0, y: 0 },
    waves: 0,
  });
  Object.assign(w.boat, { x: 250, y: 250, vx: 0.5, vy: -1, fuel: 0, throttle: 0, rudder: 0 });
  const y = w.boat.y;
  stepBoat(w, { fullAhead: true, steer: 1 }, 1 / 60);
  assert.equal(w.boat.throttle, 1);
  assert(w.boat.rudder > 0);
  assert(w.boat.y < y);
  assert(w.boat.vy < 0);
  assert.equal(engineState(w).code, 'fuel');
  assert.match(fuelStatus(w).detail, /rescue/);
  const a = restore(snapshot(w)),
    b = restore(snapshot(w));
  for (const v of [a, b])
    Object.assign(v.environment, {
      model: 'uniform',
      current: { x: 0, y: 0 },
      wind: { x: 0, y: 0 },
      waves: 0,
    });
  a.boat.throttle = 1;
  b.boat.throttle = -1;
  stepBoat(a, {}, 1 / 60);
  stepBoat(b, {}, 1 / 60);
  assert(Math.abs(a.boat.vx - b.boat.vx) < 1e-9);
  assert(Math.abs(a.boat.turn - b.boat.turn) < 1e-9);
});
test('fast-boat return time and fuel both use the quoted passage, including load', () => {
  const w = careerWorld();
  w.career.cash = 100000;
  assert(buyVessel(w, 'outboard').ok);
  assert(chooseGround(w, 'near').ok);
  w.catch = 2000;
  w.bags = [{ weight: 2000, quality: 0.8 }];
  const minutes = passageMinutes(w, GROUNDS[0]),
    fuel = w.boat.fuel,
    clock = w.day.minute;
  w.boat.x = 300;
  w.boat.y = w.terrain.size + 0.01;
  const result = returnToHarbour(w);
  assert(result.ok);
  assert.equal(result.arrival, clock + minutes);
  assert(Math.abs(w.boat.fuel - (fuel - (minutes / 60) * 15)) < 1e-9);
  assert(minutes < 60);
});
test('crew shares follow individual landed value and no catch earns no guaranteed wage', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.catch = 600;
  w.bags = [
    { weight: 400, quality: 0.9, crewId: 'ada' },
    { weight: 200, quality: 0.6, crewId: 'milo' },
  ];
  const result = calculateOffload(w, 900);
  settleCareer(w, result);
  const [a, m] = result.career.shares;
  assert(a.pay > m.pay * 2);
  assert(Math.abs(a.pay - result.catchValues.ada * 0.4) < 0.011);
  assert(Math.abs(a.pay + m.pay - result.value * 0.4) < 0.02);
  const empty = careerWorld();
  chooseGround(empty, 'near');
  const zero = calculateOffload(empty, 900);
  settleCareer(empty, zero);
  assert.equal(zero.career.crewPay, 0);
});
test('new fixed tanks and Workhorse retrofit preserve hull capacity; legacy tanks retain volume and fuel', () => {
  const w = careerWorld();
  w.career.cash = 300000;
  const size = boatSpec(w).capacity;
  assert(buyEquipment(w, 'bowthruster').ok);
  assert.equal(boatSpec(w).capacity, size);
  assert(boatSpec(w).bowThrusterStrength > 0);
  assert(buyEquipment(w, 'tank').ok);
  assert.equal(boatSpec(w).fuelCapacity, 600);
  w.career.xp = 5000;
  buyVessel(w, 'twinjet');
  assert(buyEquipment(w, 'bowthruster').ok);
  buyEquipment(w, 'tank');
  assert.equal(boatSpec(w).fuelCapacity, 1360);
  const old = snapshot(w);
  delete old.career.balanceVersion;
  delete old.career.fleet.twinjet.auxTankLitres;
  old.boat.fuel = 900;
  old.career.fleet.twinjet.fuel = 900;
  const resumed = restore(old);
  assert.equal(boatSpec(resumed).fuelCapacity, 1550);
  assert.equal(resumed.boat.fuel, 900);
  assert.equal(boatSpec(restore(snapshot(resumed))).fuelCapacity, 1550);
  assert(!sellVessel(w, 'twinjet').ok);
  useVessel(w, 'basic');
  assert(sellVessel(w, 'twinjet').ok);
  assert.equal(w.career.soldVessels.length, 1);
  assert(!w.career.fleet.twinjet);
});
test('nominal bags take 45 s; ordinary work recovers overnight and full rest clears an exhausted carryover', () => {
  let w = careerWorld();
  assert.equal(30 / diverSpec(w.diver).harvestRate, 45);
  for (let day = 0; day < 5; day++) {
    w.weather = { night: false };
    for (let second = 0; second < 600; second++) workCrew(w, w.diver, 1);
    assert(w.diver.fatigue > 0.5);
    w.career.people.ada.fatigue = w.diver.fatigue;
    w.day.phase = 'complete';
    w = nextCareerDay(w);
    assert.equal(w.diver.fatigue, 0);
  }
  w.career.people.ada.fatigue = 1;
  w.day.phase = 'complete';
  w = nextCareerDay(w);
  assert(w.diver.fatigue > 0.3);
  w = nextCareerDay(w);
  assert.equal(w.diver.fatigue, 0);
});
test('harbour rest and dock-work choices advance a day with the intended operation', () => {
  const w = careerWorld();
  for (const index of [3, 4]) {
    let options, screen;
    const ui = {
      screen: 'office',
      index,
      hooks: { nextDay: (o) => (options = o), save() {} },
      open: (s) => (screen = s),
    };
    assert(careerActivate(ui, w));
    assert.equal(options, undefined, 'day does not advance before confirmation');
    assert.equal(screen, 'purchase');
    ui.screen = 'purchase';
    ui.index = 1;
    ui.previous = () => {
      ui.screen = 'office';
    };
    assert(careerActivate(ui, w));
    assert.equal(options.dockWork, index === 4);
    assert.equal(screen, 'harbour');
  }
});
test('forecast uses career day labels and directional focus respects rows, columns and Back', () => {
  assert.equal(forecastClock(2 * 1440 + 480, 2 * 1440 + 480, true), 'Day 3 · 08:00');
  assert.equal(forecastClock(3 * 1440 + 60, 2 * 1440 + 480, true), 'Day 4 · 01:00');
  const items = [
    { id: -1, x: 20, y: 10 },
    { id: 0, x: 20, y: 60 },
    { id: 1, x: 120, y: 60 },
    { id: 2, x: 20, y: 110 },
    { id: 3, x: 120, y: 110 },
  ].map((p) => ({ ...p, width: 80, height: 30 }));
  assert.equal(neighbour(items, 0, 'right'), 1);
  assert.equal(neighbour(items, 1, 'down'), 3);
  assert.equal(neighbour(items, 0, 'up'), -1);
  assert.equal(neighbour(items, 3, 'left'), 2);
  assert.equal(neighbour(items, 3, 'down'), -1);
  assert.equal(neighbour(items, -1, 'up'), 2);
});

test('career recovery ignores repeated presses while range safety still pauses progress', async () => {
  const { step } = await import('../src/simulation.js');
  const w = careerWorld();
  chooseGround(w, 'near');
  w.logs = [];
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  Object.assign(w.environment, {
    model: 'uniform',
    current: { x: 0, y: 0 },
    wind: { x: 0, y: 0 },
    waves: 0,
  });
  Object.assign(w.boat, { x: 250, y: 250, vx: 0, vy: 0, throttle: 0 });
  Object.assign(w.diver, {
    state: 'surface',
    x: 246,
    y: 250,
    bag: 150,
    qualitySum: 120,
    bagHandled: false,
  });
  step(w, { recoverDiver: true }, 1 / 60);
  const first = w.diver.hook;
  step(w, { recoverDiver: true }, 1 / 60);
  assert(w.diver.hook > first);
  assert(w.diver.hooking);
  w.diver.x = 210;
  const progress = w.diver.hook;
  step(w, {}, 1 / 60);
  assert.equal(w.diver.hook, progress);
  assert.match(w.diver.recoveryPause, /RANGE/);
});
test('alternative entrances stay on the harbour approach and clear the full hull', async () => {
  const { minimumHullDepth } = await import('../src/hull-contact.js');
  const { SECTORS } = await import('../src/sectors.js');
  for (const ground of SECTORS)
    for (const lane of [1, 2]) {
      const w = careerWorld();
      w.career.day = 5;
      assert(chooseGround(w, ground.id, { arrivalLane: lane }).ok);
      assert(minimumHullDepth(w) >= boatSpec(w).draft + 0.3);
      const horizontal = ['south', 'north'].includes(ground.harbourEdge);
      assert.equal(w.boat[horizontal ? 'y' : 'x'], ground.entry[horizontal ? 'y' : 'x']);
    }
});
test('local wind exposure changes conditions; cabin wind load creates yaw even in neutral', async () => {
  const { conditionsAt } = await import('../src/weather.js');
  const w = careerWorld();
  w.career.weatherPlan = [{ minute: 0, kind: 'storm', bearing: 90 }];
  w.day.minute = 900;
  assert(conditionsAt(w, 900, 'far').wind > conditionsAt(w, 900, 'near').wind);
  assert(conditionsAt(w, 900, 'far').wave > conditionsAt(w, 900, 'near').wave);
  w.day.phase = 'working';
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  Object.assign(w.environment, {
    model: 'uniform',
    current: { x: 0, y: 0 },
    wind: { x: 8, y: 0 },
    waves: 0,
  });
  Object.assign(w.boat, {
    x: 250,
    y: 250,
    heading: 0,
    vx: 0,
    vy: 0,
    turn: 0,
    throttle: 0,
    rudder: 0,
  });
  stepBoat(w, {}, 1 / 60);
  assert(w.boat.vx > 0);
  assert(w.boat.turn > 0);
});
test('experienced contacts consider actual earnings and safe days, not rank alone', async () => {
  const { crewContact, hireCrew } = await import('../src/career-state.js');
  const { nextCareerDay } = await import('../src/career-save.js');
  const { crewProfile } = await import('../src/crew-roster.js');
  const w = careerWorld();
  w.career.xp = 5000;
  assert(!hireCrew(w, 'dave', 0).ok);
  const requirements = crewContact(w.career, crewProfile(w.career, 'dave'));
  for (const progress of [
    '15,000 lb total catch',
    '2,800 lb in one day',
    '$6,500 best net day',
    '$30,000 total sales',
    '6 safe days',
    '8-hour working day',
  ])
    assert.match(requirements, new RegExp(progress.replace(/[$,]/g, '\\$&')));
  Object.assign(w.career.records, {
    safeDays: 6,
    totalCatch: 15000,
    bestLoad: 2800,
    bestReturn: 6500,
    totalRevenue: 30000,
    longestDayMinutes: 480,
    managedFatigue: { 480: 0.6 },
  });
  w.career.people.ada.earnings = 2000;
  w.career.people.ada.trips = 4;
  assert(hireCrew(w, 'dave', 0).ok);
  w.career.day = 9;
  const nextSeason = nextCareerDay(w);
  assert.deepEqual(nextSeason.career.records, w.career.records);
});

test('an ordinary working voyage survives the retuned crew, fuel, hull and weather model', async () => {
  const { careerVoyage } = await import('../scripts/voyage-pilot.js');
  const w = careerWorld();
  chooseGround(w, 'near');
  const result = await careerVoyage(w);
  console.log('Natural working voyage:', JSON.stringify(result));
  assert(result.hull >= 0.99, 'ordinary voyage must return without material hull damage');
  assert(result.crew.every((c) => c === 'fit'));
  assert(w.day.result.onTime);
  assert(w.day.result.gross > 0);
  assert(w.day.result.netValue > 0);
});
