import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  careerWorld,
  nextCareerDay,
  snapshot,
  restore,
  encode,
  decode,
  saveCareer,
  loadCareer,
  SAVE_KEY,
  archiveCareer,
  careerArchives,
} from '../src/career-save.js';
import {
  buyVessel,
  useVessel,
  hireCrew,
  buyEquipment,
  serviceBoat,
  credit,
  departureReady,
  changeDepartureTime,
} from '../src/career-state.js';
import { ECONOMY } from '../src/career-data.js';
import { diverSpec } from '../src/crew.js';
import { boatSpec } from '../src/boats.js';
import { chooseGround, returnToHarbour, requestRescue } from '../src/day.js';
import { step } from '../src/simulation.js';
const finish = (w) => {
  w.boat.x = 300;
  w.boat.y = w.terrain.size + 0.01;
  return returnToHarbour(w);
};
test('career crew behaviour and vessel capabilities differ while preserving prototype defaults', () => {
  const w = careerWorld();
  assert.equal(w.boat.fuel, 480);
  assert.equal(w.divers[0].name, 'Ada Chen');
  assert(hireCrew(w, 'roy', 1).ok);
  assert(diverSpec(w.divers[1]).harvestRate > diverSpec(w.divers[0]).harvestRate);
  assert(diverSpec(w.divers[1]).airUse > diverSpec(w.divers[0]).airUse);
  w.career.cash = 200000;
  w.career.xp = 5000;
  assert(buyVessel(w, 'twinjet').ok);
  assert.equal(boatSpec(w).capacity, 16000);
  assert.equal(boatSpec(w).length, 15.5);
  w.boat.hullHealth = 0.65;
  w.boat.fuel = 230;
  assert(useVessel(w, 'basic').ok);
  assert(useVessel(w, 'twinjet').ok);
  assert.equal(w.boat.hullHealth, 0.65);
  assert.equal(w.boat.fuel, 230);
  assert(buyEquipment(w, 'tank').ok);
  assert.equal(boatSpec(w).fuelCapacity, 1360);
});
test('real offload settles crew, fees, market, records and cash once; refuelling is paid once', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.day.minute = 900;
  w.catch = 900;
  w.bags = [{ weight: 900, quality: 0.9, harvestMinute: 800 }];
  const before = w.career.cash;
  const result = finish(w);
  assert(result.ok);
  assert.equal(w.career.records.days, 1);
  assert(result.career.crewPay > 0);
  assert(result.netValue < result.value);
  assert.equal(w.career.cash, Math.round((before + result.career.cashChange) * 100) / 100);
  const total = w.career.cash;
  assert(!returnToHarbour(w).ok);
  assert.equal(w.career.cash, total);
  const next = nextCareerDay(w);
  assert.equal(next.career.day, 2);
  assert.equal(next.boat.fuel, w.boat.fuel);
  assert.equal(next.career.history.length, 1);
  const cash = next.career.cash,
    quote = (boatSpec(next).fuelCapacity - next.boat.fuel) * ECONOMY.fuelPrice;
  assert(serviceBoat(next, 'fuel').ok);
  assert(Math.abs(next.career.cash - (cash - quote)) < 0.011);
});
test('save restores live patch/clump identities, partial bags, latched helm and independent crew', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  const p = w.patches[0];
  Object.assign(w.diver, {
    state: 'harvesting',
    patch: p,
    clump: p.clumps[0],
    x: p.x,
    y: p.y,
    bag: 87,
    qualitySum: 70,
  });
  w.boat.throttle = 0.24;
  const restored = decode(encode(w));
  assert.equal(restored.diver.patch, restored.patches[0]);
  assert.equal(restored.diver.clump, restored.patches[0].clumps[0]);
  assert.equal(restored.diver.bag, 87);
  assert.equal(restored.boat.throttle, 0.24);
  step(restored, {}, 1 / 60);
  assert(restored.diver.air < 100);
  assert.equal(restored.divers[1].state, 'ready');
});
test('persistent stock survives sector changes and depletion persists across ordinary days', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  const p = w.patches[0];
  p.remaining = 30;
  p.clumps.forEach((c, i) => (c.remaining = i ? 0 : 30));
  const id = p.id;
  snapshot(w);
  chooseGround(w, 'middle');
  chooseGround(w, 'near');
  assert.equal(w.patches.find((p) => p.id === id).remaining, 30);
  w.day.phase = 'complete';
  const next = nextCareerDay(w);
  chooseGround(next, 'near');
  assert.equal(next.patches.find((p) => p.id === id).remaining, 30);
});
test('failed writes preserve a valid save and corrupt primary recovers the last verified backup', () => {
  const values = {},
    storage = { getItem: (k) => values[k] ?? null, setItem: (k, v) => (values[k] = v) };
  const w = careerWorld();
  assert(saveCareer(w, storage).ok);
  w.career.cash = 12345;
  assert(saveCareer(w, storage).ok);
  values[SAVE_KEY] = 'broken';
  const result = loadCareer(storage);
  assert(result.recovered);
  assert.equal(result.world.career.cash, ECONOMY.startCash);
  assert(
    !saveCareer(w, {
      ...storage,
      setItem() {
        throw new Error('quota');
      },
    }).ok,
  );
  assert(loadCareer(storage));
  assert.throws(() => restore({ ...snapshot(w), schema: 999 }));
});
test('injury and vessel loss persist; retirement is not an automatic reset of assets or people', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.divers[0].condition = 'injured';
  w.boat.hullHealth = 0;
  w.boat.sinking = true;
  w.emergency = { mandatoryRescue: true, reason: 'Vessel sinking' };
  const result = requestRescue(w);
  assert(result.ok);
  assert(result.career.insurance > 0);
  const next = nextCareerDay(w);
  assert(next.boat.sinking);
  assert.match(departureReady(next), /Vessel lost/);
  assert.equal(next.divers[0].condition, 'injured');
  assert(!buyVessel(next, 'twinjet').ok);
  assert(credit(next).ok);
  assert(buyVessel(next, 'outboard').ok);
  assert.equal(next.boat.configuration, 'outboard');
  assert.equal(next.divers[0].condition, 'injured');
});
test('crew and boat purchases reject at sea; available crew cannot be hired twice', () => {
  const w = careerWorld();
  assert(hireCrew(w, 'ada', 1).ok);
  assert.equal(new Set(w.career.crew).size, 2);
  chooseGround(w, 'near');
  const before = JSON.stringify(w.career);
  assert(!hireCrew(w, 'roy', 0).ok);
  assert(!buyVessel(w, 'outboard').ok);
  assert(!buyEquipment(w, 'lights').ok);
  assert.equal(JSON.stringify(w.career), before);
});
test('career archives are additive and keep independently restorable copies before a fresh start', () => {
  const values = {},
    storage = {
      get length() {
        return Object.keys(values).length;
      },
      key: (i) => Object.keys(values)[i],
      getItem: (k) => values[k] ?? null,
      setItem: (k, v) => (values[k] = v),
    };
  const w = careerWorld();
  saveCareer(w, storage);
  const first = archiveCareer(storage),
    second = archiveCareer(storage);
  assert.notEqual(first, second);
  assert.equal(careerArchives(storage).length, 2);
  w.career.cash = 42;
  saveCareer(w, storage);
  assert.equal(decode(values[first]).career.cash, ECONOMY.startCash);
  assert.equal(loadCareer(storage).world.career.cash, 42);
});

test('delayed shipping cannot finance a new departure before offload; harbour waiting cannot rewind', () => {
  const w = careerWorld();
  w.day.phase = 'complete';
  w.day.result = { offloadMinute: 1440 + 360, onTime: false };
  const next = nextCareerDay(w);
  assert.equal(next.career.day, 2);
  assert.equal(next.day.minute, 540);
  assert(!changeDepartureTime(next, true).ok);
  assert(changeDepartureTime(next).ok);
  assert.equal(next.day.minute, 570);
  assert(!changeDepartureTime(next, true).ok);
  w.day.result.offloadMinute = 2880 + 360;
  const afterMidnight = nextCareerDay(w);
  assert.equal(afterMidnight.career.day, 3);
  assert.equal(afterMidnight.day.minute, 540);
});
