import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  careerWorld,
  encode,
  decode,
  snapshot,
  restore,
  nextCareerDay,
} from '../src/career-save.js';
import { createCareer, freshVessel, useVessel, settleCareer } from '../src/career-state.js';
import { FLEET } from '../src/career-data.js';
import { stepBoat } from '../src/boat.js';
import { boatSpec } from '../src/boats.js';
import { deckMarkers } from '../src/presentation.js';
import { startDump, stepDeckWork } from '../src/deck-work.js';
import { recoveryStatus } from '../src/diver-recovery.js';
import { chooseBuyer, marketOffers } from '../src/buyer.js';
import { calculateOffload } from '../src/offload.js';
import { chooseGround } from '../src/day.js';
import { toggleEquipment, workLightsOn } from '../src/equipment-controls.js';
import { gear, pickupTolerance } from '../src/assists.js';
import { recordDiverReport, markReport, reportAge } from '../src/knowledge.js';
import { surfaceMoment } from '../src/crew-moments.js';
import { rivalHabit } from '../src/rival-habits.js';
import { spawnTraffic, stepTraffic } from '../src/traffic.js';
import { DEFAULT_TIME_INCREASE } from '../src/time-speed.js';

function flat(id = 'basic') {
  const w = careerWorld();
  w.career.fleet[id] = freshVessel(id);
  useVessel(w, id);
  w.terrain.depths = w.terrain.depths.slice().fill(40);
  Object.assign(w.environment, { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 });
  Object.assign(w.boat, { x: 250, y: 250, heading: 0 });
  return w;
}
function drift(w, seconds = 10) {
  for (let i = 0; i < seconds * 60; i++) {
    w.time += 1 / 60;
    stepBoat(w, {}, 1 / 60);
  }
  return w.boat;
}
test('neutral into current drifts astern; rudder turns shaft > leg > jet, with opposite helm signs', () => {
  const results = {};
  for (const id of ['basic', 'sterndrive', 'jet']) {
    const straight = flat(id);
    straight.environment.current.y = 2;
    drift(straight);
    assert.equal(straight.boat.heading, 0);
    assert(straight.boat.y > 255);
    for (const rudder of [-1, 1]) {
      const w = flat(id);
      w.environment.current.y = 2;
      w.boat.rudder = rudder;
      drift(w);
      results[id] = Math.abs(w.boat.heading);
      assert(Math.sign(w.boat.heading) === Math.sign(rudder) || id === 'jet');
    }
  }
  assert(results.basic > 0.25);
  assert(results.sterndrive > 0.02 && results.sterndrive < results.basic / 3);
  assert.equal(results.jet, 0);
});
test('a perturbation in current turns leg and jet hulls broadside faster; matching water has no phantom force', () => {
  const changes = {};
  for (const id of ['basic', 'sterndrive', 'jet']) {
    const w = flat(id);
    w.environment.current.y = 2;
    w.boat.heading = 0.4;
    drift(w);
    changes[id] = w.boat.heading - 0.4;
    const carried = flat(id);
    carried.environment.current.y = carried.boat.vy = 2;
    carried.boat.rudder = 1;
    drift(carried);
    assert(Math.abs(carried.boat.heading) < 1e-8);
  }
  assert(
    changes.jet > changes.sterndrive && changes.sterndrive > changes.basic,
    JSON.stringify(changes),
  );
});
test('large hulls retain stopping momentum and receive more environmental load; cargo adds inertia', () => {
  const small = flat('outboard'),
    big = flat('twinjet'),
    loaded = flat('twinjet');
  loaded.catch = FLEET.twinjet.capacity;
  for (const w of [small, big, loaded]) {
    w.boat.vy = -3;
    drift(w, 5);
  }
  assert(Math.abs(big.boat.vy) > Math.abs(small.boat.vy));
  assert(Math.abs(loaded.boat.vy) > Math.abs(big.boat.vy));
  assert(boatSpec(big).windage > boatSpec(small).windage);
  const left = flat(),
    right = flat();
  left.environment.current.y = right.environment.current.y = 2;
  left.environment.wind.x = -4;
  right.environment.wind.x = 4;
  drift(left);
  drift(right);
  assert(left.boat.heading < 0 && right.boat.heading > 0);
});
test('every hull has fixed-size layered red-bag positions wholly inside its working deck', () => {
  for (const spec of Object.values(FLEET)) {
    const count = Math.ceil(spec.capacity / 300),
      markers = deckMarkers(Array.from({ length: count }), spec);
    assert.deepEqual(markers.slice(0, 3), deckMarkers(Array.from({ length: 3 }), spec));
    assert(markers.every((m) => m.radius === 0.64));
    for (const m of markers) {
      assert(Math.abs((m.x * spec.width) / 4) + m.radius < spec.width / 2);
      assert((m.y * spec.length) / 10 + m.radius < spec.length / 2);
    }
    assert(
      markers.some((m) => m.layer > 0),
      `${spec.capacity} lb hull layers its load`,
    );
  }
});
test('a timed dump reserves the deck, survives reload, removes exactly one bag and never restores bed stock', () => {
  let w = careerWorld();
  chooseGround(w, 'near');
  const stock = w.patches[0].remaining;
  w.bags = [
    { id: 'a', weight: 300, quality: 0.61, haulSeconds: 2.2 },
    { id: 'b', weight: 180, quality: 0.95 },
  ];
  w.catch = 480;
  assert(startDump(w, 0).ok);
  assert(!startDump(w, 1).ok);
  assert.match(recoveryStatus(w).reason, /DECK BUSY/);
  stepDeckWork(w, 1);
  w = decode(encode(w));
  stepDeckWork(w, 1.19);
  assert.equal(w.catch, 480);
  stepDeckWork(w, 0.01);
  assert.equal(w.catch, 180);
  stepDeckWork(w, 10);
  assert.equal(w.discarded, 300);
  assert.equal(w.bags[0].id, 'b');
  assert.equal(w.patches[0].remaining, stock);
});
test('buyer contacts unlock from sales and safe returns, orders lock at sea and survive reload', () => {
  let w = careerWorld();
  assert(!chooseBuyer(w, 'premium').ok);
  Object.assign(w.career.records, { totalRevenue: 8000, safeDays: 3 });
  assert(chooseBuyer(w, 'premium').ok);
  const order = structuredClone(w.career.buyerToday);
  assert.deepEqual(marketOffers(w.career), marketOffers(w.career));
  chooseGround(w, 'near');
  w = decode(encode(w));
  assert.deepEqual(w.career.buyerToday, order);
  assert(!chooseBuyer(w, 'standard').ok);
});
test('buyer premium caps at demand, excess remains payable, stale/poor lots miss premium, settlement is once-only', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.career.buyerToday = {
    day: w.career.day,
    target: 350,
    minQuality: 0.9,
    premium: 0.4,
    name: 'Test buyer',
  };
  w.bags = [
    { weight: 300, quality: 1, harvestMinute: 600, crewId: 'ada' },
    { weight: 300, quality: 1, harvestMinute: 600, crewId: 'milo' },
    { weight: 300, quality: 0.6, harvestMinute: 600, crewId: 'ada' },
  ];
  w.catch = 900;
  w.day.minute = 600;
  const quote = calculateOffload(w, 610);
  assert.equal(quote.buyerAccepted, 350);
  assert(quote.landed > 350 && quote.buyerPremium > 0);
  const stale = calculateOffload(w, 3500);
  assert(stale.buyerAccepted < quote.buyerAccepted);
  settleCareer(w, quote);
  const cash = w.career.cash;
  settleCareer(w, quote);
  assert.equal(w.career.cash, cash);
  assert(quote.highlights.some((s) => s.includes('Test buyer')));
});
test('equipment switches preserve ownership, are per hull, persist and restore night pickup limits', () => {
  let w = flat();
  w.career.fleet.basic.equipment = ['lights', 'hoist', 'bowthruster'];
  w.weather.night = false;
  assert(!workLightsOn(w));
  w.weather.night = true;
  assert(workLightsOn(w));
  const range = pickupTolerance(w);
  assert(toggleEquipment(w, 'lights').ok);
  assert(!workLightsOn(w));
  assert(pickupTolerance(w) < range);
  assert(toggleEquipment(w, 'bowthruster').ok);
  assert.equal(boatSpec(w).bowThrusterStrength, 0);
  w = decode(encode(w));
  assert(w.career.fleet.basic.equipment.includes('lights'));
  assert(!gear(w, 'lights'));
  assert(toggleEquipment(w, 'lights').ok);
  assert(gear(w, 'lights'));
});
test('saved trip hull wins over a stale harbour selection through reload and next day', () => {
  const w = flat('outboard'),
    data = snapshot(w);
  data.career.activeBoat = 'basic';
  const copy = restore(data);
  assert.equal(copy.boat.configuration, 'outboard');
  assert.equal(copy.career.activeBoat, 'outboard');
  assert.equal(nextCareerDay(copy).boat.configuration, 'outboard');
});
test('a report records its witness, age and actual sample point; personal marks never reveal bed outlines', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  const d = w.divers[0],
    patch = w.patches.find((p) => p.charted === false);
  Object.assign(d, {
    state: 'surface',
    patch,
    bag: 300,
    qualitySum: 273,
    x: patch.x + 3,
    y: patch.y + 2,
  });
  recordDiverReport(w, d, { recovered: true });
  const report = w.career.knowledge.near.grounds[patch.id];
  assert.match(reportAge(report, w.career.day + 2), /2 days ago.*Ada/);
  assert(markReport(w, 'near', patch.id).ok);
  const mark = w.career.marks.at(-1);
  assert.equal(mark.x, d.x);
  assert.equal(mark.y, d.y);
  assert.equal(mark.outline, undefined);
  assert.equal(decode(encode(w)).career.navigationMark, mark.id);
});
test('surface opinions report new sampled information despite chatter cooldown and preserve memory through reload', () => {
  const w = careerWorld(),
    d = w.divers[0];
  d.bag = 300;
  d.qualitySum = 285;
  surfaceMoment(w, d);
  assert.equal(d.speech.icon, '👍');
  assert(d.speech.text);
  w.time += 20;
  d.qualitySum = 150;
  surfaceMoment(w, d);
  assert.equal(d.speech.icon, '👎');
  assert.match(d.speech.text, /50%/);
  assert.equal(decode(encode(w)).divers[0].nextBanterAt, d.nextBanterAt);
});
test('selfish rival identity is persistent; ordinary routes increasingly cross working beds without changing event cadence', () => {
  const w = careerWorld(createCareer(171709));
  chooseGround(w, 'near');
  assert.equal(rivalHabit({ id: 'team-1' }), 'encroaching');
  assert.equal(rivalHabit({ id: 'team-0' }), 'independent');
  assert.equal(w.career.opponents.find((r) => r.hidden).boat, 'Shy Hull Wood');
  w.terrain.depths = w.terrain.depths.slice().fill(40);
  w.day.minute = 650;
  const p = w.patches.find((p) => p.quality >= 0.6 && p.remaining > 0);
  Object.assign(w.divers[0], { state: 'harvesting', patch: p, x: p.x, y: p.y });
  let crosses = 0;
  for (let i = 0; i < 16; i++) {
    if (w.traffic) w.traffic.actors = [];
    const taxi = spawnTraffic(w, 'taxi', { start: { x: 20, y: 250 } });
    if (taxi?.crossingPoint?.x === p.x && taxi?.crossingPoint?.y === p.y) crosses++;
  }
  assert.equal(
    crosses,
    16,
    'September 25: prioritize committed bubble passes when safely routable',
  );
  const fleet = w.career.todayFleet.find((f) => !f.hidden);
  Object.assign(fleet, { area: 'near', begin: 0, end: 1100, shipDone: false });
  w.traffic.actors = [];
  const actor = spawnTraffic(w, 'rival', {
    start: { x: 20, y: 250 },
    fleetId: fleet.id,
    patchId: p.id,
  });
  assert(actor);
  actor.phase = 'fishing';
  actor.workSeconds = 0;
  const stock = p.remaining;
  w.career.trafficSettings = { rate: 0 };
  stepTraffic(w, 1);
  assert(p.remaining < stock && fleet.gross > 0);
});
test('new browser day pace defaults to plus fifty percent', () =>
  assert.equal(DEFAULT_TIME_INCREASE, 50));
