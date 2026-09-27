import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { checkDiverSafety } from '../src/diver-safety.js';
import { requestRescue } from '../src/day.js';
import { step, rediveStatus, recoveryStatus } from '../src/simulation.js';
function world() {
  const w = createWorld({ practice: true });
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  Object.assign(w.environment, { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 });
  Object.assign(w.boat, { vx: 0, vy: 0 });
  Object.assign(w.diver, { state: 'surface', x: 246, y: 250, bag: 300, qualitySum: 270 });
  return w;
}
test('one bag exchange redescends with the same tank; boarding instead supplies a fresh tank', () => {
  for (const action of ['work', 'recoverDiver']) {
    const w = world(),
      d = w.diver;
    d.air = 60;
    step(w, { [action]: true }, 1 / 60);
    for (let i = 0; i < (action === 'work' ? 180 : 300); i++) step(w, {}, 1 / 60);
    assert.equal(w.catch, 300);
    assert.equal(d.state, action === 'work' ? 'deploying' : 'ready');
    assert.equal(d.air, action === 'work' ? 60 : 100);
  }
});
test('port-side drift matching is safe while a slow hull contact nudges clear without injury', () => {
  const w = world();
  checkDiverSafety(w, { ...w.boat });
  assert(!w.safety);
  w.diver.x = 250;
  w.boat.vy = -0.3;
  checkDiverSafety(w, { ...w.boat });
  assert.equal(w.diver.condition, 'fit');
  assert(Math.abs(w.diver.x - w.boat.x) > 2.2);
  assert.equal(w.safety.incidents[0].outcome, 'near miss');
});
test('moderate contact injures a surfaced diver, permits boarding and prevents redive', () => {
  const w = world();
  w.diver.x = 250;
  w.boat.vy = -3;
  checkDiverSafety(w, { ...w.boat });
  assert.equal(w.diver.condition, 'injured');
  assert(!w.emergency.mandatoryRescue);
  w.diver.bagHandled = true;
  assert(!rediveStatus(w, w.diver).available);
  w.boat.vy = 0;
  w.diver.x = 246;
  assert(recoveryStatus(w).available);
  const result = requestRescue(w);
  assert(result.ok);
  assert.equal(result.crew[0].condition, 'injured');
  assert.equal(w.diver.state, 'ready');
});
test('swept high-speed surface collision records fatality without resurrection or duplicate catch at rescue', () => {
  const w = world();
  w.boat.vy = -5;
  w.diver.x = 250;
  w.diver.y = 252;
  checkDiverSafety(w, { x: 250, y: 264, heading: 0 });
  assert.equal(w.diver.condition, 'deceased');
  assert(w.emergency.mandatoryRescue);
  assert.equal(w.discarded, 300);
  const result = requestRescue(w);
  assert(result.ok);
  assert.equal(result.safety.fatalities, 1);
  assert.equal(result.gross, 0);
  assert.equal(w.diver.condition, 'deceased');
  assert.equal(result.crew[1].condition, 'fit');
  assert(!requestRescue(w).ok);
});
test('underwater divers and their bubble markers are not surface collision targets', () => {
  const w = world();
  w.diver.state = 'harvesting';
  w.diver.x = 250;
  w.boat.vy = -7;
  checkDiverSafety(w, { ...w.boat });
  assert(!w.safety);
  assert.equal(w.diver.condition, 'fit');
});
