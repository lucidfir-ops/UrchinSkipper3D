import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode, nextCareerDay } from '../src/career-save.js';
import { createCareer, credit, freshVessel, useVessel } from '../src/career-state.js';
import { chooseGround } from '../src/day.js';
import { careerTerrain } from '../src/career-terrain.js';
import { COAST_QUALITY, COAST_MARKS } from '../src/coast-ground-balance.js';
import { SECTORS, enterSector } from '../src/sectors.js';
import { coastTier } from '../src/coasts.js';
import { bedDepthAt } from '../src/terrain.js';
import { careerActions } from '../src/career-actions.js';
import { expeditionActions } from '../src/expedition-actions.js';
import { purchaseActions } from '../src/purchase.js';
import { assist, setPreset, toggleAssist } from '../src/assists.js';
import { moveTraffic } from '../src/traffic-motion.js';
import { spawnTraffic } from '../src/traffic.js';
import { boatSpec } from '../src/boats.js';
import { checkDiverSafety } from '../src/diver-safety.js';
import { surfaceBlood, drawSeaCues } from '../src/sea-cues.js';
import { toggleGodmode, godmode } from '../src/godmode.js';
import { collisionDamage } from '../src/propulsion.js';
import { stepBoat } from '../src/boat.js';
import { vesselOverlap } from '../src/vessel-contact.js';

function uiFor(w, screen) {
  return {
    screen,
    index: 0,
    history: [],
    hooks: { world: () => w, nextDay: () => w.career.day++ },
    input: { suppress() {} },
    open(s) {
      this.history.push(this.screen);
      this.screen = s;
      this.index = 0;
    },
    previous() {
      this.screen = this.history.pop();
    },
    back() {
      this.previous();
    },
  };
}
function sea() {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.terrain = { ...w.terrain, depths: w.terrain.depths.slice().fill(40) };
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0, seaLevel: 0 };
  Object.assign(w.boat, { x: 300, y: 300, heading: 0, vx: 0, vy: 0, turn: 0 });
  return w;
}
test('all maps retain existing ground, have 65 beds and meet quality ranges at clump level', () => {
  for (const def of SECTORS) {
    const tier = coastTier(def.id),
      old = careerTerrain(def, 6),
      next = careerTerrain(def, 7),
      [low, high] = COAST_QUALITY[tier];
    assert.equal(next.patches.length, 65, def.id);
    assert.equal(next.patches.filter((p) => p.charted !== false).length, COAST_MARKS[tier]);
    for (const p of old.patches) {
      const q = next.patches.find((q) => q.id === p.id);
      for (const key of ['x', 'y', 'radius', 'outline', 'remaining', 'initialStock'])
        assert.deepEqual(q[key], p[key], `${def.id}/${p.id}/${key}`);
      assert.deepEqual(
        q.clumps.map((c) => [c.id, c.x, c.y, c.remaining]),
        p.clumps.map((c) => [c.id, c.x, c.y, c.remaining]),
      );
      if (!tier) assert.equal(q.charted, p.charted);
    }
    const qualities = next.patches.flatMap((p) => [
      p.quality,
      ...p.clumps.map((c) => c.quality ?? p.quality),
    ]);
    assert(
      qualities.every((q) => q >= low && q <= high),
      def.id,
    );
    assert.equal(Math.min(...qualities), low);
    assert.equal(Math.max(...qualities), high);
    for (const p of next.patches.filter((p) => p.id.startsWith('hidden-v7')))
      for (const q of [p, ...p.outline])
        assert(bedDepthAt(next, q.x, q.y) >= 3 && bedDepthAt(next, q.x, q.y) <= 21.3);
  }
});
test('old depleted offshore stock and observations survive additive migration and repeated reload', () => {
  const w = careerWorld();
  w.day.groundId = 'outer-deep';
  enterSector(w, 'outer-deep');
  const p = w.patches[0];
  p.remaining -= p.clumps[0].remaining;
  p.clumps[0].remaining = 0;
  w.career.groundVersion = 6;
  const report = { day: 4, quality: 0.65, name: p.name };
  w.career.knowledge['outer-deep'] = { grounds: { [p.id]: report }, depths: [], tracks: [] };
  const next = decode(encode(decode(encode(w))));
  assert.equal(next.career.groundVersion, 7);
  assert.equal(next.patches[0].remaining, p.remaining);
  assert.equal(next.patches[0].clumps[0].remaining, 0);
  assert.deepEqual(next.career.knowledge['outer-deep'].grounds[p.id], report);
});
test('unfit departure and rest default to Cancel without advancing or charging', () => {
  const w = careerWorld(),
    ui = uiFor(w, 'departure'),
    day = w.career.day,
    cash = w.career.cash;
  w.divers[0].condition = 'unavailable';
  expeditionActions(ui, w)
    .find((a) => a.id === 'sail')
    .run();
  assert.equal(ui.screen, 'purchase');
  assert.equal(ui.index, 0);
  assert.match(ui.pendingPurchase.detail, new RegExp(w.divers[0].name));
  purchaseActions(ui)[0].run();
  assert.equal(w.day.phase, 'planning');
  assert.equal(w.career.cash, cash);
  expeditionActions(ui, w)
    .find((a) => a.id === 'sail')
    .run();
  purchaseActions(ui)[1].run();
  assert.equal(w.day.phase, 'working');
  const h = careerWorld(),
    menu = uiFor(h, 'departure');
  expeditionActions(menu, h)
    .find((a) => a.id === 'sleep')
    .run();
  purchaseActions(menu)[0].run();
  assert.equal(h.career.day, day);
  menu.screen = 'office';
  careerActions(menu, h)
    .find((a) => a.id === 'rest')
    .run();
  assert.equal(h.career.day, day);
  purchaseActions(menu)[1].run();
  assert.equal(h.career.day, day + 1);
});
test('permit purchase displays a receipt and Frank warning, and cannot charge twice', () => {
  const w = careerWorld(createCareer(17, { chooseStarter: true }));
  w.career.cash = 100000;
  const ui = uiFor(w, 'accounts');
  careerActions(ui, w)
    .find((a) => a.id === 'area-maelstrom')
    .run();
  assert.match(ui.pendingPurchase.detail, /Upgrade.*stronger.*boat/);
  purchaseActions(ui)[1].run();
  assert.equal(ui.screen, 'coast-access');
  assert.equal(ui.permitCoastId, 'maelstrom');
  assert.equal(w.career.cash, 40000);
  ui.screen = 'accounts';
  careerActions(ui, w)
    .find((a) => a.id === 'area-maelstrom')
    .run();
  assert.equal(w.career.cash, 40000);
});
test('development loans repeat in $5,000 chunks with ordinary debt and repayment accounting', () => {
  const w = careerWorld(),
    cash = w.career.cash,
    debt = w.career.debt;
  for (let n = 0; n < 25; n++) assert(credit(w).ok);
  assert.equal(w.career.cash, cash + 125000);
  assert.equal(w.career.debt, debt + 125000);
  assert(credit(w, true).ok);
  assert.equal(decode(encode(w)).career.debt, debt + 120000);
});
test('water arrows follow mode independently of dashboard across coasts and reloads', () => {
  let w = careerWorld();
  for (const def of SECTORS) {
    w.day.groundId = def.id;
    enterSector(w, def.id);
    setPreset(w, 'easy');
    toggleAssist(w, 'currentOverlay');
    assert(assist(w, 'currentArrows'));
    assert(!assist(w, 'currentOverlay'));
    setPreset(w, 'realistic');
    assert(!assist(w, 'currentArrows'));
  }
  setPreset(w, 'easy');
  toggleAssist(w, 'currentOverlay');
  w = decode(encode(w));
  assert(assist(w, 'currentArrows'));
  assert(!assist(w, 'currentOverlay'));
});
test('taxi curves past player without stop-start and completes its committed passage', () => {
  for (const offset of [-8, 0, 8]) {
    const w = sea(),
      a = {
        id: 'test-taxi',
        kind: 'taxi',
        x: 80,
        y: 300 + offset,
        heading: Math.PI / 2,
        route: [{ x: 590, y: 300 + offset }],
        routeStart: { x: 80, y: 300 + offset },
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
    w.traffic = { actors: [a] };
    let done = false,
      min = Infinity,
      deflection = 0;
    for (let n = 0; n < 800 && !done; n++) {
      w.time += 0.1;
      done = moveTraffic(w, a, 0.1);
      if (!done) min = Math.min(min, a.speed);
      deflection = Math.max(deflection, Math.abs(a.y - 300 - offset));
      assert(!vesselOverlap(a, a, w.boat, boatSpec(w)));
    }
    assert(done);
    assert(min > 6, `offset ${offset}: speed ${min}`);
    assert(deflection > 15);
  }
});
test('taxi aims at undiscovered bubbles once at spawn, without homing afterward', () => {
  const w = sea();
  Object.assign(w.boat, { x: 400, y: 450 });
  Object.assign(w.divers[0], { x: 300, y: 300, state: 'searching', patch: null });
  const a = spawnTraffic(w, 'taxi');
  assert(a?.crossingPoint);
  assert.deepEqual(a.crossingPoint, { x: 300, y: 300 });
  const route = structuredClone(a.route);
  w.divers[0].x += 100;
  for (let n = 0; n < 20; n++) {
    w.time += 0.1;
    moveTraffic(w, a, 0.1);
  }
  assert.deepEqual(a.route, route);
});
test('fatal surface strikes from every boat leave saved blood; underwater markers cannot be hit', () => {
  for (const kind of ['player', 'taxi', 'rival']) {
    const w = sea(),
      d = w.divers[0],
      b = { ...w.boat, id: 'striker', kind, speed: 10, vx: 0, vy: -10, throttle: 1 };
    Object.assign(d, { x: 300, y: 295, state: 'surface' });
    if (kind === 'player') Object.assign(w.boat, b);
    checkDiverSafety(
      w,
      { x: 300, y: 310, heading: 0 },
      kind === 'player' ? {} : { boat: b, spec: boatSpec(w), exposed: true },
    );
    assert.equal(d.state, 'fatality');
    assert.equal(surfaceBlood(w).length, 1);
    assert(surfaceBlood(w)[0].radius >= 5);
    assert.equal(surfaceBlood(decode(encode(w))).length, 1);
  }
  const w = sea();
  Object.assign(w.divers[0], { x: 300, y: 295, state: 'searching' });
  Object.assign(w.boat, { speed: 10, vy: -10 });
  checkDiverSafety(w, { x: 300, y: 310, heading: 0 });
  assert.equal(w.divers[0].state, 'searching');
  assert.equal(surfaceBlood(w).length, 0);
});
test('surface cues render observed conditions without modifying simulation state', () => {
  const w = sea(),
    calls = {};
  Object.assign(w.boat, { grounded: true, hullHealth: 0.4, driveHealth: 0.4, speed: 5 });
  w.environment.waves = 0.7;
  const before = JSON.stringify({ boat: w.boat, environment: w.environment, time: w.time });
  const graphics = Object.fromEntries(
    ['fillStyle', 'fillEllipse', 'lineStyle', 'strokeEllipse', 'lineBetween'].map((key) => [
      key,
      () => (calls[key] = (calls[key] || 0) + 1),
    ]),
  );
  drawSeaCues(graphics, w, 10);
  assert.equal(calls.fillEllipse, 5);
  assert.equal(calls.strokeEllipse, 4);
  assert.equal(calls.lineBetween, 2);
  assert.equal(JSON.stringify({ boat: w.boat, environment: w.environment, time: w.time }), before);
});
test('godmode prevents new damage, fuel use and fatalities, saves and restores ordinary consequences when off', () => {
  let w = sea();
  assert(!godmode(w));
  toggleGodmode(w);
  collisionDamage(w, { speed: 30, severity: 10, propulsion: true });
  assert.equal(w.boat.hullHealth, 1);
  assert.equal(w.boat.driveHealth, 1);
  const fuel = w.boat.fuel;
  for (let i = 0; i < 60; i++) stepBoat(w, { fullAhead: true }, 1 / 60);
  assert.equal(w.boat.fuel, fuel);
  Object.assign(w.boat, { x: 300, y: 300, heading: 0, vx: 0, vy: -10, speed: 10, turn: 0 });
  Object.assign(w.divers[0], { x: 300, y: 295, state: 'surface' });
  checkDiverSafety(w, { x: 300, y: 310, heading: 0 });
  assert.equal(w.divers[0].condition, 'fit');
  assert.equal(surfaceBlood(w).length, 0);
  w = decode(encode(w));
  assert(godmode(w));
  const atHarbour = careerWorld(structuredClone(w.career));
  setPreset(atHarbour, 'off');
  const tomorrow = nextCareerDay(atHarbour);
  assert(godmode(tomorrow));
  assert(chooseGround(tomorrow, 'near').ok);
  assert(tomorrow.day.assisted, 'Persistent Godmode marks later trips even with information off');
  toggleGodmode(w);
  collisionDamage(w, { speed: 8, propulsion: true });
  assert(w.boat.hullHealth < 1);
  w.time += 3;
  Object.assign(w.divers[0], { x: 300, y: 295, state: 'surface' });
  checkDiverSafety(w, { x: 300, y: 310, heading: 0 });
  assert.equal(w.divers[0].state, 'fatality');
});
test('factory and retrofit thrusters share reduced force without changing twin-jet pivot', () => {
  const w = careerWorld();
  w.career.fleet.twinjet = freshVessel('twinjet');
  useVessel(w, 'twinjet');
  const pivot = boatSpec(w).pivotRate;
  w.career.fleet.twinjet.equipment.push('bowthruster');
  assert.equal(boatSpec(w).bowThrusterStrength, 1.05);
  assert.equal(boatSpec(w).pivotRate, pivot);
  w.career.fleet.thruster = freshVessel('thruster');
  useVessel(w, 'thruster');
  assert.equal(boatSpec(w).bowThrusterStrength, 1.05);
});
