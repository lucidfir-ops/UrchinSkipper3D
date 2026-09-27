import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode, nextCareerDay, saveCareer } from '../src/career-save.js';
import { createCareer, freshVessel, useVessel, advanceCareer } from '../src/career-state.js';
import { createTestCareer, testConditionActions } from '../src/test-mode.js';
import { setPreset, toggleInformation, toggleAssist, assist } from '../src/assists.js';
import { expeditionActions } from '../src/expedition-actions.js';
import { chooseGround } from '../src/day.js';
import { setInstructions, step } from '../src/simulation.js';
import { diverSpec, workCrew } from '../src/crew.js';
import { chooseHarvestClump, availableGroundDistance } from '../src/harvest-ground.js';
import { worthwhile, createWorld } from '../src/world.js';
import { recordDiverReport } from '../src/knowledge.js';
import { buyerNotice } from '../src/buyer.js';
import { calculateOffload } from '../src/offload.js';
import { currentAt } from '../src/environment.js';
import { conditionsAt } from '../src/weather.js';
import { coastalRivers, releaseRunoff, runoffActive } from '../src/runoff.js';
import { earlyPassageStrike } from '../src/early-start.js';
import { boatSpec } from '../src/boats.js';
import { C } from '../src/config.js';

test('custom information survives the three-mode RB cycle and save/reload', () => {
  const w = careerWorld();
  toggleAssist(w, 'weatherOverlay');
  toggleAssist(w, 'widePickup');
  const custom = structuredClone(w.career.assists);
  toggleInformation(w);
  assert.equal(w.career.assists.preset, 'realistic');
  assert(w.career.assists.exactLoad);
  toggleInformation(w);
  assert(Object.values(w.career.assists).every((v) => v !== true));
  const restored = decode(encode(w));
  toggleInformation(restored);
  assert.deepEqual(restored.career.assists, custom);
  setPreset(restored, 'realistic');
  assert(assist(restored, 'chartGrounds'));
  assert(!assist(restored, 'groundDots'));
  assert(assist(restored, 'weatherOverlay'), 'weather is now a standard UI option');
  assert(restored.day.assisted);
  toggleInformation(restored);
  toggleInformation(restored);
  toggleInformation(restored);
  assert.equal(restored.career.assists.preset, 'realistic');
});
test('arrival approach is saved separately for each area, independent of menu history', () => {
  const w = careerWorld(),
    ui = { screen: 'departure', chartGroundId: 'near', arrivalLane: 0, open() {}, back() {} };
  expeditionActions(ui, w)
    .find((a) => a.id === 'arrival')
    .run();
  ui.arrivalLane = 0;
  const restored = decode(encode(w));
  assert.equal(restored.career.preferences.arrivals.near, 1);
  ui.chartGroundId = 'far';
  assert.match(expeditionActions(ui, restored).find((a) => a.id === 'arrival').label, /centre/);
  assert.equal(restored.career.preferences.arrivals.near, 1);
});
test('Test Mode starts with fresh charts, people and stocks and cannot write either career save', () => {
  const w = careerWorld();
  w.career.knowledge.near = { tracks: [{ points: [{ x: 20, y: 30 }] }] };
  w.career.stock.near = [{ id: 'reef-1', remaining: 4 }];
  w.career.people.ada.fatigue = 0.7;
  const before = structuredClone(w.career),
    test = careerWorld(createTestCareer(w.career, 99));
  assert.deepEqual(test.career.knowledge, {});
  assert.deepEqual(test.career.marks, []);
  assert.equal(test.career.people.ada.fatigue, 0);
  assert.equal(test.career.day, 1);
  assert.deepEqual(w.career, before);
  assert(
    saveCareer(test, {
      setItem() {
        throw Error('must not write');
      },
    }).ok,
  );
  testConditionActions(test)
    .find((a) => a.id === 'test-current')
    .run();
  assert.deepEqual(currentAt(test, 250, 250), { x: 0, y: -0 });
  test.career.testConditions.weather = 'storm';
  test.career.testConditions.bearing = 90;
  assert.equal(conditionsAt(test).bearing, 90);
  assert(conditionsAt(test).rain > 0.8);
});
test('timed no-preference search surfaces with air remaining and never retraces a closed circle', () => {
  const w = createWorld({ practice: true });
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  w.logs = [];
  const d = w.diver;
  Object.assign(d, { x: 110, y: 220, state: 'searching', diveCount: 1 });
  assert(setInstructions(w, d.id, { direction: 0, minQuality: 0.9, searchLimit: 10 }));
  w.patches = [];
  const points = [];
  for (let i = 0; i < 11 * 60; i++) {
    step(w, {}, 1 / 60);
    if (i % 60 === 0) points.push({ x: d.x, y: d.y });
  }
  assert.equal(d.reason, 'Search time limit reached');
  assert(d.air > 80);
  assert(Math.hypot(points[9].x - points[0].x, points[9].y - points[0].y) > 5);
  const restored = careerWorld();
  assert(!setInstructions(restored, 0, { direction: 0, minQuality: 0.8, searchLimit: -5 }));
});
test('crew level bonuses follow specialties and improved tanks survive saves', () => {
  const base = (id) => diverSpec({ crewId: id, experience: 0, fatigue: 0 });
  const veteran = (id) => diverSpec({ crewId: id, experience: 40000, fatigue: 0 });
  for (const id of ['ada', 'milo', 'nell', 'roy', 'inez', 'robinson', 'murphy', 'dave']) {
    const first = base(id),
      last = veteran(id);
    const keys = [
      'harvestRate',
      'airUse',
      'awareness',
      'searchSpeed',
      'holdCurrentKnots',
      'tankAir',
      'fatigueSaving',
    ];
    assert.equal(keys.filter((key) => first[key] !== last[key]).length, 3);
  }
  const w = careerWorld();
  w.career.crew[0] = 'robinson';
  w.career.people.robinson.experience = 40000;
  Object.assign(w.diver, {
    crewId: 'robinson',
    experience: 40000,
    air: veteran('robinson').tankAir,
  });
  assert.equal(decode(encode(w)).diver.air, veteran('robinson').tankAir);
  const fatigueId = ['ada', 'milo', 'nell', 'roy', 'inez', 'robinson', 'murphy', 'dave'].find(
    (id) => veteran(id).fatigueSaving > 0,
  );
  const a = { crewId: fatigueId, experience: 40000, fatigue: 0 },
    b = { crewId: fatigueId, experience: 0, fatigue: 0 };
  workCrew(w, a, 10);
  workCrew(w, b, 10);
  assert(a.fatigue < b.fatigue);
});
test('mixed-quality ground obeys the diver threshold at clump selection and harvesting', () => {
  const p = {
    x: 100,
    y: 100,
    quality: 0.7,
    rate: 10,
    remaining: 600,
    clumps: [
      { id: 'low', x: 100, y: 100, radius: 2, quality: 0.6, remaining: 300 },
      { id: 'high', x: 107, y: 100, radius: 2, quality: 0.9, remaining: 300 },
    ],
  };
  const d = { id: 0, x: 100, y: 100, minQuality: 0.8, direction: 0 };
  const w = { divers: [d] };
  assert(worthwhile(p, d));
  assert.equal(chooseHarvestClump(w, p, d).id, 'high');
  assert.equal(availableGroundDistance(p, 100, 100, 0.8), 5);
  d.minQuality = 0;
  assert.equal(chooseHarvestClump(w, p, d).id, 'low');
  const career = careerWorld();
  chooseGround(career, 'near');
  assert(career.patches.some((p) => p.mixedQuality));
  const old = createCareer();
  old.groundVersion = 3;
  const upgraded = nextCareerDay(careerWorld(old));
  assert.equal(upgraded.career.groundVersion, 7);
});
test('awareness crew chart an actual worked patch remotely; other crew still report at recovery', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  const p = w.patches[0],
    d = w.diver;
  Object.assign(d, {
    crewId: ['ada', 'milo', 'nell', 'roy'].find(
      (crewId) => diverSpec({ crewId, crewSeed: w.career.seed }).autoChart,
    ),
    state: 'harvesting',
    patch: p,
    x: p.x,
    y: p.y,
    bag: 10,
    qualitySum: 8,
  });
  recordDiverReport(w, d, { automatic: diverSpec(d).autoChart });
  assert(w.career.knowledge.near.grounds[p.id]);
  delete w.career.knowledge.near.grounds[p.id];
  d.crewId = ['ada', 'milo', 'nell', 'roy'].find(
    (crewId) => !diverSpec({ crewId, crewSeed: w.career.seed }).autoChart,
  );
  recordDiverReport(w, d, { automatic: diverSpec(d).autoChart });
  assert(!w.career.knowledge.near.grounds[p.id]);
});
test('legacy announced buyer demand survives once and pays only qualifying lots an additive premium', () => {
  const w = careerWorld();
  assert.match(buyerNotice(w.career), /Tomorrow/);
  w.career.buyerNext = { day: w.career.day + 1, minQuality: 0.8, premium: 0.2 };
  const tomorrow = structuredClone(w.career.buyerNext);
  advanceCareer(w.career);
  assert.deepEqual(w.career.buyerToday, tomorrow);
  assert.equal(w.career.buyerNext, null);
  w.career.buyerToday = { day: w.career.day, minQuality: 0.8, premium: 0.2 };
  w.day.minute = 1100;
  w.catch = 600;
  w.bags = [
    { weight: 300, quality: 0.9, harvestMinute: 1100 },
    { weight: 300, quality: 0.6, harvestMinute: 1100 },
  ];
  const quote = calculateOffload(w, 1140);
  assert(quote.buyerPremium > 0);
  assert(quote.buyerAccepted > 0 && quote.buyerAccepted < 300);
  const bonus = quote.buyerPremium;
  w.career.buyerToday = null;
  assert(Math.abs(quote.value - calculateOffload(w, 1140).value - bonus) < 0.02);
  assert.equal(calculateOffload(w, 1141).lateMinutes, 1);
  assert.equal(calculateOffload(createWorld(), 1140).buyerPremium, 0);
  advanceCareer(w.career);
  assert.equal(w.career.buyerToday, null);
});
test('rain runoff waits two hours, carries into the following day, and releases real timber only once', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.career.weatherPlan = [
    { minute: 0, kind: 'calm' },
    { minute: 500, kind: 'storm' },
    { minute: 700, kind: 'calm' },
  ];
  assert(!runoffActive(w.career, 619));
  assert(runoffActive(w.career, 620));
  assert(coastalRivers(w.terrain).length > 0);
  w.day.minute = 630;
  const count = releaseRunoff(w);
  assert(count > 0);
  assert.equal(releaseRunoff(w), 0);
  const restored = decode(encode(w));
  assert.equal(releaseRunoff(restored), 0);
  assert.equal(restored.logs.length, w.logs.length);
  advanceCareer(w.career);
  assert(runoffActive(w.career, 300));
});
test('early passage strike is explicit, once-only, and exempts protected shafts and jets', () => {
  for (const id of ['basic', 'thruster', 'jet', 'twinjet']) {
    const w = careerWorld();
    w.career.fleet[id] = freshVessel(id);
    useVessel(w, id);
    w.day.minute = 300;
    assert(!earlyPassageStrike(w));
    assert.equal(w.boat.driveHealth, 1);
  }
  let hit;
  for (let seed = 0; seed < 2000 && !hit; seed++) {
    const w = careerWorld(createCareer(seed));
    w.career.fleet.outboard = freshVessel('outboard');
    useVessel(w, 'outboard');
    w.day.minute = 300;
    if (earlyPassageStrike(w)) hit = w;
  }
  assert(hit);
  const hp = hit.boat.driveHealth;
  assert(!earlyPassageStrike(hit));
  assert.equal(hit.boat.driveHealth, hp);
});
test('career hull lengths increase with carrying capacity while the Workhorse helm stays unchanged', () => {
  const w = careerWorld();
  let previous = 0;
  for (const id of ['outboard', 'sterndrive', 'basic', 'thruster', 'jet', 'twinjet']) {
    w.career.fleet[id] = freshVessel(id);
    useVessel(w, id);
    assert(boatSpec(w).length > previous);
    previous = boatSpec(w).length;
  }
  useVessel(w, 'basic');
  assert.equal(boatSpec(w).rudderRate, C.boat.rudderRate);
});

test('a high-quality order harvests only the qualifying portion and conserves every pound', () => {
  const w = createWorld({ practice: true });
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  const p = {
    id: 'mixed',
    x: 228,
    y: 238,
    radius: 20,
    quality: 0.7,
    rate: 10,
    remaining: 600,
    clumps: [
      { id: 'high', x: 228, y: 238, radius: 3, quality: 0.9, remaining: 300 },
      { id: 'low', x: 235, y: 238, radius: 3, quality: 0.6, remaining: 300 },
    ],
  };
  w.patches = [p];
  Object.assign(w.boat, { x: 232, y: 238, vx: 0, vy: 0 });
  Object.assign(w.diver, {
    x: 228,
    y: 238,
    state: 'harvesting',
    minQuality: 0.8,
    patch: p,
    clump: p.clumps[0],
  });
  for (let i = 0; i < 60; i++) step(w, {}, 1 / 60);
  assert(w.diver.bag > 9);
  assert(Math.abs(w.diver.qualitySum / w.diver.bag - 0.9) < 1e-9);
  assert.equal(p.clumps[1].remaining, 300);
  assert(Math.abs(w.diver.bag + p.remaining - 600) < 1e-8);
});

test('old custom assists gain visible legacy instruments without resetting chosen assists', () => {
  const c = createCareer();
  c.assists.preset = 'custom';
  c.assists.currentOverlay = false;
  c.assists.groundDots = false;
  delete c.assists.version;
  delete c.assists.chartGrounds;
  const w = careerWorld(c);
  assert(assist(w, 'helmOverlay'));
  assert(assist(w, 'timepiece'));
  assert(!assist(w, 'clockOverlay'));
  assert(!assist(w, 'currentOverlay'));
  assert(!assist(w, 'chartGrounds'));
});
