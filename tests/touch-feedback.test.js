import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { createCareer, buyVessel, buyEquipment, changeDepartureTime } from '../src/career-state.js';
import { FLEET, FLEET_ORDER, CREW } from '../src/career-data.js';
import { boatSpec } from '../src/boats.js';
import { crewSkills } from '../src/crew-skills.js';
import { crewProgress, diverSpec } from '../src/crew.js';
import { inspectionSchedule, inspectionDue } from '../src/inspection-schedule.js';
import { chooseGround } from '../src/day.js';
import { step } from '../src/simulation.js';
import {
  diveForecast,
  diveReadiness,
  stepDiveExposure,
  newDiveHealth,
  exposureClock,
} from '../src/dive-exposure.js';
import { pickupWater, swimToPickupWater } from '../src/diver-escape.js';
import { patchVisible } from '../src/hidden-ground.js';
import { visiblePatch } from '../src/world.js';
import { recordDiverReport } from '../src/knowledge.js';
import { isRadioMessage } from '../src/radio-history.js';
import { C } from '../src/config.js';

function world() {
  const w = careerWorld(createCareer(125));
  w.career.trafficSettings = { rate: 0 };
  chooseGround(w, 'near');
  w.terrain.depths = w.terrain.depths.slice().fill(21);
  w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  w.logs = [];
  Object.assign(w.boat, { x: 250, y: 250, vx: 0, vy: 0, heading: 0, turn: 0, throttle: 0 });
  Object.assign(w.diver, { x: 246, y: 250, diveStyle: 'tables' });
  return w;
}
test('all twelve boats can purchase working thrusters; variants trade capacity, tank, speed, draft, handling and durability', () => {
  let more = 0,
    less = 0;
  for (const id of FLEET_ORDER) {
    const w = careerWorld();
    w.career.cash = 1e6;
    w.career.xp = 12000;
    if (id !== w.boat.configuration) assert(buyVessel(w, id).ok);
    const capacity = boatSpec(w).capacity;
    assert(buyEquipment(w, 'bowthruster').ok);
    assert(boatSpec(w).bowThrusterStrength > 0);
    assert.equal(boatSpec(w).capacity, capacity);
    assert(boatSpec(decode(encode(w))).bowThrusterStrength > 0);
    if (id.endsWith('-sister')) {
      const base = id.replace('-sister', '');
      for (const key of ['price', 'capacity', 'fuelCapacity', 'maxSpeed'])
        assert.notEqual(FLEET[id][key], FLEET[base][key]);
      assert.notEqual(boatSpec(w).draft, ['jet', 'twinjet'].includes(base) ? 0.95 : 2);
      assert.notEqual(boatSpec(w).maneuverability, 1);
      assert.notEqual(boatSpec(w).durability, 1);
      if (FLEET[id].capacity > FLEET[base].capacity) more++;
      else less++;
    }
  }
  assert.equal(more, 3);
  assert.equal(less, 3);
});
test('one fast major and two slow minors are deterministic, balanced across starter contacts, and change only three skills', () => {
  for (const seed of [0, 1, 125, 919191]) {
    const counts = Object.fromEntries(
      ['picking', 'air', 'awareness', 'current', 'swimming', 'tank', 'fatigue'].map((s) => [s, 0]),
    );
    for (const p of CREW.filter((p) => p.rank === 0)) {
      const skills = crewSkills(p.id, seed);
      assert.equal(new Set([skills.major, ...skills.minors]).size, 3);
      for (const skill of [skills.major, ...skills.minors]) counts[skill]++;
      assert.deepEqual(skills, crewSkills(p.id, seed));
      const progress = crewProgress(40000, p.id, seed);
      const rates = [
        progress.rateBonus / 0.08,
        progress.airSaving / 0.045,
        progress.awarenessBonus / 1.25,
        progress.currentBonus / 0.18,
        progress.swimBonus / 0.06,
        progress.tankBonus / 0.07,
        progress.fatigueSaving / 0.065,
      ]
        .filter((n) => n > 0)
        .sort();
      assert.equal(rates.length, 3);
      assert(
        Math.abs(rates[0] - 1.2) < 1e-8 &&
          Math.abs(rates[1] - 1.2) < 1e-8 &&
          Math.abs(rates[2] - 4) < 1e-8,
      );
    }
    assert(Object.values(counts).every((n) => n >= 1 && n <= 2));
  }
});
test('inspection dates are stable across a save and a completed visit cannot repeat', () => {
  for (const seed of [1, 2, 3, 99, 23567]) {
    const c = createCareer(seed),
      w = { career: c, day: { minute: 840 } };
    for (c.day = 1; c.day <= 102; c.day++) {
      const schedule = inspectionSchedule(c);
      assert.deepEqual(inspectionSchedule(structuredClone(c)), schedule);
      if (inspectionDue(w)) schedule.completed = true;
      assert(!inspectionDue(w));
    }
  }
});
test('all time above water reduces nitrogen and a rested diver has budget for a full bag at the last depth', () => {
  const w = world(),
    d = w.diver;
  d.lastDiveDepth = 21;
  d.lastPatchRate = 10;
  const h = (w.career.people[d.crewId].diveHealth = newDiveHealth(
    w.career,
    d.crewId,
    exposureClock(w),
  ));
  h.load = 0.94;
  assert(diveReadiness(w, d));
  for (const state of ['ready', 'surface', 'deploying']) {
    d.state = state;
    const before = h.load;
    for (let i = 0; i < 20; i++) {
      w.day.minute += 0.5;
      stepDiveExposure(w, d, 1);
    }
    assert(h.load < before);
  }
  assert(diveForecast(w, d).fullBagReady);
  assert.equal(diveReadiness(w, d), '');
  d.state = 'harvesting';
  const forecast = diveForecast(w, d);
  for (let i = 0; i < Math.floor(forecast.bagMinutes * 2); i++) {
    w.day.minute += 0.5;
    assert.equal(stepDiveExposure(w, d, 1), false, 'budget allows the complete forecast bag');
  }
  const copy = decode(encode(w));
  assert.deepEqual(copy.career.people.ada.diveHealth, h);
  d.state = 'ready';
  w.day.phase = 'planning';
  const load = h.load;
  changeDepartureTime(w, false);
  stepDiveExposure(w, d, 1 / 60);
  assert(h.load < load, 'waiting at harbour clears exposure');
});
test('nitrox is expensive, increases usable dive budget and adds exactly one second to entry', () => {
  const a = world(),
    b = world();
  b.career.cash = 1e6;
  b.career.xp = 12000;
  b.day.phase = 'planning';
  const cash = b.career.cash;
  assert(buyEquipment(b, 'nitrox').ok);
  assert.equal(cash - b.career.cash, 85000);
  b.day.phase = 'working';
  assert(diveForecast(b, b.diver).bottomMinutes > diveForecast(a, a.diver).bottomMinutes * 1.5);
  step(a, { recoverDiver: true }, 1 / 60);
  step(b, { recoverDiver: true }, 1 / 60);
  assert(Math.abs(b.diver.timer - a.diver.timer - 1) < 1e-8);
});
test('every sector has four times as many invisible unmarked patches, divers find them normally, and old stock survives migration', () => {
  for (const id of ['near', 'middle', 'far']) {
    const w = careerWorld();
    w.career.trafficSettings = { rate: 0 };
    w.career.day = id === 'near' ? 1 : id === 'middle' ? 3 : 5;
    chooseGround(w, id);
    const marked = w.patches.filter((p) => patchVisible(p)),
      hidden = w.patches.filter((p) => !patchVisible(p));
    assert.equal(hidden.length, marked.length * 4);
    const p = hidden[0],
      d = w.diver;
    Object.assign(d, {
      x: p.clumps[0].x,
      y: p.clumps[0].y,
      patch: p,
      state: 'harvesting',
      minQuality: 0,
      bag: 30,
      qualitySum: 24,
    });
    assert(visiblePatch(w, d));
    recordDiverReport(w, d, { automatic: true });
    assert(!w.career.knowledge[id]?.grounds[p.id]);
    d.state = 'surface';
    recordDiverReport(w, d, { recovered: true });
    assert(w.career.knowledge[id].grounds[p.id]);
    assert(!patchVisible(p));
    assert(patchVisible(p, true));
    assert(w.events.some((e) => e.includes('UNMARKED GROUND REPORT')));
    const saved = decode(encode(w));
    assert.equal(saved.patches.find((q) => q.id === p.id).remaining, p.remaining);
    assert.equal(
      saved.diver.patch,
      saved.patches.find((q) => q.id === p.id),
    );
  }
});
test('surfaced diver slowly swims out of a shoal into boat-accessible water without crossing dry land', () => {
  const w = world(),
    d = w.diver,
    n = w.terrain.size / w.terrain.spacing + 1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) w.terrain.depths[y * n + x] = x * w.terrain.spacing < 270 ? 1 : 12;
  Object.assign(d, { x: 260, y: 250, state: 'surface' });
  Object.assign(w.boat, { x: 300, y: 250 });
  assert(!pickupWater(w, d));
  for (let i = 0; i < 1200 && !pickupWater(w, d); i++) {
    const x = d.x,
      y = d.y;
    w.time += 0.1;
    swimToPickupWater(w, d, 0.1);
    assert(Math.hypot(d.x - x, d.y - y) <= 0.028001);
  }
  assert(pickupWater(w, d));
});
test('radio history admits radio traffic and excludes local dive/helm feedback', () => {
  for (const text of ['RADIO · Working boats call', 'DFO PATROL · Approaching', 'DFO · Cleared'])
    assert(isRadioMessage(text));
  for (const text of [
    'ADA · DIVER UNDERWATER',
    'ADA · BAG RECOVERED',
    'THROTTLE 20%',
    'ADA · UNMARKED GROUND REPORT',
  ])
    assert(!isRadioMessage(text));
});
test('reduced air use increases a normal career tank duration while the safe reserve stays fixed', () => {
  const spec = diverSpec({ crewId: 'ada', experience: 0, fatigue: 0 });
  assert((C.diver.air - C.diver.reserve) / spec.airUse > 100);
  assert.equal(C.diver.reserve, 20);
});
