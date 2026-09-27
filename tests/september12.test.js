import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { C } from '../src/config.js';
import { step, recoveryStatus } from '../src/simulation.js';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { FLEET, ECONOMY } from '../src/career-data.js';
import { createCareer, freshVessel, useVessel } from '../src/career-state.js';
import { chooseFirstBoat } from '../src/starter-career.js';
import { arrivalLanes } from '../src/arrival.js';
import { crewProgress, diverSpec } from '../src/crew.js';
import { catchSheetSvg } from '../src/catch-sheet.js';
import { expeditionActions, expeditionActivate } from '../src/expedition-actions.js';
import { frankAdvice } from '../src/frank-advice.js';

function tick(w, seconds, action = {}) {
  step(w, action, 1 / 60);
  for (let i = 1; i < seconds * 60; i++) step(w, {}, 1 / 60);
}
function calm(w = createWorld({ practice: true })) {
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  w.logs = [];
  w.debris = [];
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  Object.assign(w.boat, { x: 232, y: 238, heading: 0, vx: 0, vy: 0, turn: 0 });
  return w;
}
test('board after an exhausted search, move, and deploy: the next dive starts a fresh search', () => {
  const w = calm(),
    d = w.diver,
    patch = w.patches[0];
  Object.assign(d, {
    state: 'searching',
    x: 100,
    y: 100,
    bag: 41,
    qualitySum: 32.8,
    patch,
    localSearch: { x: 100, y: 100, elapsed: C.diver.localSearchSeconds },
  });
  tick(w, C.diver.warningSeconds + 0.1);
  assert.equal(d.state, 'surface');
  assert.equal(d.reason, 'Patch exhausted');
  Object.assign(w.boat, { x: d.x + 4, y: d.y });
  tick(w, 5.1, { recoverDiver: true });
  assert.equal(d.state, 'ready');
  assert.equal(w.catch, 41);
  Object.assign(w.boat, { x: 232, y: 238 });
  tick(w, C.diver.deploySeconds + 1, { recoverDiver: true });
  assert.equal(d.state, 'harvesting');
  assert(d.bag > 0 && d.bag < 30);
  assert.equal(d.localSearch, null);
  assert.equal(w.catch, 41, 'partial deck bags never block a fresh dive or transfer twice');
});
test('bag turnaround and boarding both provide empty bags; only boarding refills the tank', () => {
  for (const action of ['work', 'recoverDiver']) {
    const w = calm(),
      d = w.diver;
    Object.assign(d, { state: 'surface', x: 228, y: 238, bag: 300, qualitySum: 240, air: 55 });
    tick(w, action === 'recoverDiver' ? 5.1 : 3.1, { [action]: true });
    assert.equal(w.catch, 300);
    assert.equal(d.bag, 0);
    assert.equal(d.qualitySum, 0);
    assert.equal(d.air, action === 'work' ? 55 : C.diver.air);
    tick(w, 0.1, { [action]: true });
    assert.equal(d.state, 'deploying');
    assert.equal(d.bag, 0);
    assert.equal(w.catch, 300);
  }
});
test('pickup accepts two-knot matched drift and rejects excessive relative motion or hull overlap', () => {
  const w = calm(),
    d = w.diver;
  Object.assign(d, { state: 'surface', x: 228, y: 238 });
  w.environment.current = { x: 0, y: -2 / C.knotsPerMps };
  w.boat.vy = w.environment.current.y;
  assert(recoveryStatus(w).available);
  w.boat.vx = C.recovery.maxRelativeSpeed + 0.1;
  assert(!recoveryStatus(w).slow);
  w.boat.vx = 0;
  w.boat.turn = 0.3;
  assert(!recoveryStatus(w).slow, 'turning creates motion relative to the alongside float');
  w.boat.turn = 0;
  d.x = w.boat.x - 0.5;
  assert(!recoveryStatus(w).available, 'a float inside the hull is not a valid pickup');
});
test('bag completion records the sampled ground even between periodic chart observations', () => {
  for (const [boat, offset] of [
    ['basic', { x: 4, y: 0 }],
    ['twinjet', { x: 6.05, y: 10.4 }],
  ]) {
    const w = careerWorld();
    w.career.fleet[boat] = freshVessel(boat);
    assert(useVessel(w, boat).ok);
    chooseGround(w, 'near');
    calm(w);
    w.career.weatherPlan = [{ minute: 0, kind: 'calm', bearing: 0 }];
    const p = w.patches[0],
      d = w.diver;
    Object.assign(d, {
      state: 'surface',
      x: w.boat.x - offset.x,
      y: w.boat.y - offset.y,
      patch: p,
      bag: 41,
      qualitySum: 32.8,
    });
    assert(recoveryStatus(w).available, `${boat}: fixture is a legal port pickup`);
    if (boat === 'twinjet')
      Object.assign(d, { hook: 2.99, hooking: true, recoveryAction: 'recoverDiver' });
    w.nextObservation = 1000;
    tick(w, boat === 'twinjet' ? 3.2 : 5.2, { recoverDiver: true });
    assert.equal(d.state, 'ready');
    const report = w.career.knowledge.near?.grounds[p.id];
    assert(
      report,
      `${boat}: recovery must capture the report even outside the passive observation radius`,
    );
    assert.equal(report.quality, 0.8);
    assert.equal(report.report, 'Partial bag');
    assert.equal(decode(encode(w)).career.knowledge.near.grounds[p.id].quality, 0.8);
  }
});
test('a new player chooses exactly one funded starter; save/reload cannot charge twice', () => {
  for (const id of ['basic', 'outboard']) {
    const w = careerWorld(createCareer(171709, { chooseStarter: true }));
    assert(!chooseGround(w, 'near').ok);
    assert(!chooseFirstBoat(w, 'twinjet').ok);
    assert.equal(w.career.cash, 20000);
    const pending = decode(encode(w));
    assert(chooseFirstBoat(pending, id).ok);
    assert.equal(pending.career.cash, 5000);
    assert.deepEqual(Object.keys(pending.career.fleet), [id]);
    assert.equal(pending.boat.configuration, id);
    assert.equal(pending.boat.fuel, FLEET[id].fuelCapacity);
    const saved = decode(encode(pending)),
      before = encode(saved);
    assert(!chooseFirstBoat(saved, id).ok);
    assert.equal(encode(saved), before);
    assert(chooseGround(saved, 'near').ok);
  }
});
test('existing careers and larger old deck loads remain intact under the new boat limits', () => {
  const w = careerWorld();
  w.career.fleet.outboard = freshVessel('outboard');
  assert(useVessel(w, 'outboard').ok);
  w.boat.fuel = 33;
  w.career.cash = 146;
  w.catch = 4200;
  w.bags = [{ weight: 4200, quality: 0.8, harvestMinute: w.day.minute }];
  delete w.career.starterPending;
  const saved = decode(encode(w));
  assert(!chooseFirstBoat(saved, 'outboard').ok);
  assert.equal(saved.career.cash, 146);
  assert.equal(saved.boat.fuel, 33);
  assert.equal(saved.catch, 4200);
  assert.equal(saved.boat.configuration, 'outboard');
  assert(saved.catch > FLEET.outboard.capacity, 'old over-capacity catch must not be deleted');
  assert.equal(FLEET.basic.capacity, 7500);
  assert.equal(FLEET.thruster.travelBurn, 15);
  assert.equal(FLEET.outboard.capacity, 3000);
  assert.equal(FLEET.sterndrive.capacity, 6000);
  assert.equal(FLEET.jet.capacity, 10000);
  assert(Math.abs(FLEET.jet.maxSpeed * C.knotsPerMps - 10) < 0.001);
});
test('arrival choices describe world compass directions on both vertical and horizontal entrances', () => {
  assert.deepEqual(arrivalLanes({ harbourEdge: 'west' }), [
    'West entrance · centre',
    'Northwest approach',
    'Southwest approach',
  ]);
  assert.deepEqual(arrivalLanes({ harbourEdge: 'south' }), [
    'South entrance · centre',
    'Southwest approach',
    'Southeast approach',
  ]);
  for (const edge of ['north', 'south', 'east', 'west'])
    assert(arrivalLanes({ harbourEdge: edge }).every((label) => !/left|right/i.test(label)));
});
test('expedition action IDs drive the selected operation and preserve the working clock during browsing', () => {
  const w = careerWorld();
  const ui = {
    screen: 'departure',
    chartGroundId: 'near',
    index: 0,
    open(screen) {
      this.screen = screen;
    },
    previous() {},
    hooks: { save() {} },
  };
  const before = w.day.minute;
  ui.index = expeditionActions(ui, w).findIndex((a) => a.id === 'arrival');
  assert(expeditionActivate(ui, w));
  assert.equal(ui.arrivalLane, 1);
  assert.equal(w.day.minute, before);
  ui.index = expeditionActions(ui, w).findIndex((a) => a.id === 'sail');
  assert(expeditionActivate(ui, w));
  assert(w.day.careerTrip.insured, 'departure automatically includes cover, without a reminder');
  assert.equal(ui.screen, null);
  assert.equal(w.day.phase, 'working');
  assert(w.day.minute > before);
});
test('crew progress preserves saves and fresh baseline, with exactly three improving skills per diver', () => {
  const w = careerWorld(),
    fresh = diverSpec(w.diver);
  w.career.people.ada.experience = 9000;
  const restored = decode(encode(w));
  assert.equal(crewProgress(restored.career.people.ada.experience).level, 3);
  const experienced = diverSpec({ ...w.diver, experience: 9000 });
  assert(experienced.harvestRate > fresh.harvestRate);
  assert(experienced.airUse < fresh.airUse);
  assert.equal(experienced.awareness, fresh.awareness);
  assert(experienced.tankAir > fresh.tankAir);
  assert.equal(fresh.harvestRate, 30 / ECONOMY.bagSeconds);
  assert.equal(crewProgress(1000000).level, 20);
});
test('the yellow log image contains actual landings and escapes imported text', () => {
  const c = createCareer();
  c.history = [{ day: 2, ground: '<script>bad</script>', gross: 341, net: 28, onTime: true }];
  const svg = catchSheetSvg(c);
  assert(svg.includes('341'));
  assert(svg.includes('YELLOW'));
  assert(!svg.includes('<script>'));
  assert(svg.includes('&lt;script&gt;'));
});
test('Frank changes advice for each hull and recognises a Workhorse thruster retrofit', () => {
  const w = careerWorld();
  const base = frankAdvice(w, (action) => action);
  assert(base.includes('shaft boat'));
  w.career.fleet.basic.equipment.push('bowthruster');
  assert(frankAdvice(w, (action) => action).includes('fitted bow thruster'));
  for (const id of Object.keys(FLEET)) {
    w.boat.configuration = id;
    assert(frankAdvice(w, (action) => action).length > 300);
  }
});
