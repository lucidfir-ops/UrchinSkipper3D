import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { createCareer } from '../src/career-state.js';
import { chooseGround } from '../src/day.js';
import { step } from '../src/simulation.js';
import { deploymentStatus, rediveStatus } from '../src/diver-recovery.js';
import { conditionsAt, sevenDayForecast, weatherPlan } from '../src/weather.js';
import { scoutHeading } from '../src/diver-search.js';
import { workCrew } from '../src/crew.js';
import { addNightLogs, createLogs } from '../src/hazards.js';
import { SECTORS } from '../src/sectors.js';
import { careerTerrain } from '../src/career-terrain.js';
import { careerActions } from '../src/career-actions.js';
import { spawnTraffic, stepTraffic } from '../src/traffic.js';
import { finishInspection } from '../src/fishery.js';
import { alongsidePoint } from '../src/patrol.js';
import { vesselOverlap } from '../src/vessel-contact.js';
import { boatSpec } from '../src/boats.js';
import { boatDragActions } from '../src/touch-boat.js';
import { setTimeIncrease, worldTimeScale, clampTimeIncrease } from '../src/time-speed.js';
import { pickingName } from '../src/patch-style.js';

function world() {
  const w = careerWorld(createCareer(125));
  w.career.trafficSettings = { rate: 0 };
  chooseGround(w, 'near');
  w.terrain.depths = w.terrain.depths.slice().fill(12);
  w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  Object.assign(w.boat, { x: 250, y: 250, heading: 0, vx: 0, vy: 0, throttle: 0, rudder: 0 });
  w.logs = [];
  w.patches = [];
  return w;
}
test('pace changes scale the complete world with finite 0–100% increase bounds', () => {
  for (const [increase, scale] of [
    [0, 1],
    [25, 1.25],
    [100, 2],
    [-50, 1],
    [200, 2],
  ]) {
    setTimeIncrease(increase);
    assert.equal(worldTimeScale(), scale);
  }
  assert.equal(clampTimeIncrease('bad'), 50);
  setTimeIncrease(25);
});
test('open-water scouting alternates seven-second legs around the ordered course', () => {
  const w = world(),
    d = w.diver;
  Object.assign(d, { x: 200, y: 200, direction: 1, searchTime: 0 });
  const headings = [0, 6.99, 7, 13.99, 14].map((t) => {
    d.searchTime = t;
    return scoutHeading(w, d);
  });
  assert(headings[0] > 0 && headings[2] < 0);
  assert.equal(headings[0], headings[1]);
  assert.equal(headings[2], headings[3]);
  assert.equal(headings[0], headings[4]);
});
test('scouting turns away from both depth limits and holds the turn after crossing back', () => {
  const w = world(),
    d = w.diver,
    n = w.terrain.size / w.terrain.spacing + 1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) w.terrain.depths[y * n + x] = x * w.terrain.spacing * 0.1;
  Object.assign(d, { x: 200, y: 200, direction: 1, searchTime: 1 });
  assert(Math.sin(scoutHeading(w, d)) < 0, '20 m: swim shallower to the west');
  d.x = 199;
  d.searchTime = 2;
  assert(Math.sin(scoutHeading(w, d)) < 0, 'no boundary jitter');
  d.x = 50;
  d.searchTime = 3;
  assert(Math.sin(scoutHeading(w, d)) > 0, '5 m: swim deeper to the east');
});
test('hidden grounds double additively, preserve every v5 reef and favour shoreline cover', () => {
  for (const def of SECTORS.slice(0, 9)) {
    const old = careerTerrain(def, 5),
      next = careerTerrain(def, 6),
      count = old.patches.filter(
        (p) =>
          p.id.startsWith('hidden-') || (p.id.startsWith('shelf-v3-') && p.id !== 'shelf-v3-0'),
      ).length,
      added = next.patches.filter((p) => p.id.startsWith('hidden-v6-'));
    assert.equal(added.length, count);
    assert(added.filter((p) => p.features.shoreline).length >= Math.ceil(count * 0.75));
    assert.deepEqual(next.patches.slice(0, old.patches.length), old.patches);
  }
});
test('a v5 career migrates without replenishing worked stock or moving its diver', () => {
  const w = world();
  w.career.groundVersion = 5;
  w.career.stock.near = [{ id: 'hidden-v5-0', remaining: 123 }];
  // Reload a genuine old layout so captureStock cannot mask the old record.
  w.sectors = {};
  const restored = decode(encode(w));
  assert.equal(restored.career.groundVersion, 7);
  assert.equal(restored.patches.find((p) => p.id === 'hidden-v5-0').remaining, 123);
  assert.equal(restored.diver.x, w.diver.x);
});
test('19:30 starts immediate unlit ascent, blocks new drops, and flashlights permit night diving', () => {
  for (const lit of [false, true]) {
    const w = world(),
      d = w.diver;
    if (lit) w.career.fleet[w.boat.configuration].equipment.push('torch');
    w.day.minute = 1170 - 0.001;
    Object.assign(d, { x: 220, y: 220, state: 'searching', searchTime: 0, air: 100 });
    assert.equal(conditionsAt(w).night, false);
    step(w, {}, 1 / 60);
    assert.equal(w.weather.night, true);
    assert.equal(d.state, lit ? 'searching' : 'surfacing');
    if (!lit) assert.match(d.reason, /flashlight/);
    d.state = 'ready';
    assert.equal(deploymentStatus(w, d).available, lit);
    d.state = 'surface';
    d.bagHandled = true;
    if (!lit) assert.match(rediveStatus(w, d).reason, /FLASHLIGHT/);
  }
});
test('night doubles work fatigue while short workdays build substantially less per hour', () => {
  const a = world(),
    b = world();
  a.diver.fatigue = b.diver.fatigue = 0;
  a.weather = { night: false };
  b.weather = { night: true };
  for (let n = 0; n < 100; n++) {
    workCrew(a, a.diver, 1);
    workCrew(b, b.diver, 1);
  }
  assert(Math.abs(b.diver.fatigue - a.diver.fatigue * 2) < 1e-9);
  const shortRate = a.diver.fatigue / 100;
  a.diver.workedSeconds = 1000;
  const before = a.diver.fatigue;
  for (let n = 0; n < 100; n++) workCrew(a, a.diver, 1);
  assert((a.diver.fatigue - before) / 100 > shortRate * 1.5);
  for (let n = 0; n < 1000; n++) workCrew(a, a.diver, 1);
  assert.equal(a.diver.fatigue, 1, 'exhaustion remains bounded');
});
test('night timber increases the existing field sixfold once and survives reload without multiplying', () => {
  const w = world();
  w.logs = createLogs(w);
  const original = structuredClone(w.logs);
  w.weather = { night: true };
  addNightLogs(w);
  assert.equal(w.logs.length, original.length * 6);
  assert.deepEqual(w.logs.slice(0, original.length), original);
  addNightLogs(w);
  assert.equal(w.logs.length, original.length * 6);
  w.day.minute = 1200;
  const copy = decode(encode(w));
  addNightLogs(copy);
  assert.equal(copy.logs.length, w.logs.length);
});
test('DFO casts off, separates, drives away and exits without any diver deployment', () => {
  const w = world();
  w.patches = w.terrain.patches;
  const actor = spawnTraffic(w, 'dfo', { start: { x: 380, y: 250 } });
  assert(actor);
  Object.assign(actor, alongsidePoint(w, actor), {
    target: 'player',
    phase: 'inspection',
    docking: true,
    heading: 0,
  });
  w.day.inspection = { actorId: actor.id, status: 'boarding', seconds: 0 };
  finishInspection(w);
  assert.equal(w.day.inspection.status, 'departing');
  assert(!deploymentStatus(w).available);
  const copy = decode(encode(w));
  for (const live of [w, copy]) {
    for (let n = 0; n < 20; n++) {
      live.time += 0.1;
      stepTraffic(live, 0.1);
    }
    const patrol = live.traffic.actors.find((a) => a.id === actor.id);
    assert(patrol && patrol.phase === 'leaving' && !patrol.docking);
    assert.equal(live.day.inspection.status, 'cleared');
    assert(!vesselOverlap(live.boat, boatSpec(live), patrol, patrol));
    const start = { x: patrol.x, y: patrol.y };
    for (let n = 0; n < 50; n++) {
      live.time += 0.1;
      stepTraffic(live, 0.1);
    }
    assert(Math.hypot(patrol.x - start.x, patrol.y - start.y) > 15);
    for (let n = 0; n < 1000 && !patrol.done; n++) {
      live.time += 0.1;
      stepTraffic(live, 0.1);
    }
    assert(patrol.done, 'departs the sector without waiting for crew actions');
  }
});
test('forecast covers seven seeded days without altering live time, weather or stock', () => {
  const w = world(),
    before = encode(w),
    forecast = sevenDayForecast(w);
  assert.equal(forecast.length, 7);
  assert.equal(encode(w), before);
  assert.deepEqual(sevenDayForecast(w), forecast);
  for (let i = 1; i < 7; i++) {
    assert.equal(forecast[i].day, w.career.day + i);
    assert(forecast[i].confidence < forecast[i - 1].confidence || forecast[i].confidence === 25);
    assert.equal(
      forecast[i].periods.length,
      weatherPlan({ ...w.career, day: w.career.day + i }).length,
    );
  }
});
test('boat inspection stays in the shop; explicit Buy asks and commits that exact hull', () => {
  const w = world();
  w.day.phase = 'planning';
  w.career.cash = 1e6;
  w.career.xp = 12000;
  const ui = {
      screen: 'boatshop',
      open(screen) {
        this.screen = screen;
      },
      previous() {
        this.screen = 'boatshop';
      },
    },
    cash = w.career.cash;
  careerActions(ui, w)
    .find((a) => a.id === 'buy-twinjet-sister')
    .run();
  assert.equal(ui.screen, 'boatshop');
  careerActions(ui, w)
    .find((a) => a.id === 'buy-inline')
    .run();
  assert.equal(ui.screen, 'purchase');
  assert.equal(w.career.cash, cash);
  careerActions(ui, w)
    .find((a) => a.id === 'cancel-purchase')
    .run();
  assert.equal(w.career.cash, cash);
  careerActions(ui, w)
    .find((a) => a.id === 'buy-jet')
    .run();
  careerActions(ui, w)
    .find((a) => a.id === 'buy-selected')
    .run();
  assert(
    careerActions(ui, w)
      .find((a) => a.id === 'confirm-purchase')
      .run().ok,
  );
  assert.equal(w.boat.configuration, 'jet');
  assert(w.career.cash < cash);
});
test('boat dragging resolves bow, stern, port and starboard for every heading', () => {
  for (const h of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, 0.73]) {
    assert(boatDragActions(Math.sin(h) * 70, -Math.cos(h) * 70, h).throttleUp > 0.99);
    assert(boatDragActions(-Math.sin(h) * 70, Math.cos(h) * 70, h).throttleDown > 0.99);
    assert(boatDragActions(Math.cos(h) * 70, Math.sin(h) * 70, h).right > 0.99);
    assert(boatDragActions(-Math.cos(h) * 70, -Math.sin(h) * 70, h).left > 0.99);
  }
});
test('picking tiers keep their original rates and use the requested speed vocabulary', () => {
  assert.deepEqual(
    [16, 10, 7.5, 5, 0].map((rate) => pickingName({ rate })),
    ['VERY FAST', 'FAST', 'SLOW', 'VERY SLOW', 'EMPTY'],
  );
});
