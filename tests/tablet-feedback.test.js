import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, driftDebris, driftSurface } from '../src/world.js';
import { step, actionTarget, pinActionTargets } from '../src/simulation.js';
import { playState } from '../src/presentation.js';
import { recallStatus } from '../src/diver-recall.js';
import { boatSpec } from '../src/boats.js';
import { presetAssists } from '../src/assists.js';
import { WeatherView } from '../src/weather-view.js';
import { careerWorld } from '../src/career-save.js';

function calm() {
  const w = createWorld({ practice: true });
  w.terrain.depths = w.terrain.depths.slice().fill(20);
  w.environment = { current: { x: 0.2, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  w.debris = [];
  w.logs = [];
  Object.assign(w.boat, { x: 250, y: 250, vx: 0.2, vy: 0, heading: 0 });
  return w;
}
test('deploy uses the only diver aboard while the other portrait remains selected', () => {
  for (const state of ['deploying', 'searching', 'harvesting', 'surfacing', 'surface']) {
    const w = calm();
    Object.assign(w.divers[0], { state, x: 180, y: 180, timer: 10, patch: w.patches[0] });
    assert.equal(actionTarget(w, 'recoverDiver').id, 1);
    assert(playState(w).actions.some((a) => a.text === 'Deploy Diver' && a.diverId === 1));
    step(w, { recoverDiver: true }, 1 / 60);
    assert.equal(w.divers[1].state, 'deploying');
    assert.equal(w.selectedDiverId, 0);
  }
});
test('selection chooses between available divers and skips an unfit selected diver', () => {
  const w = calm();
  w.selectedDiverId = 1;
  assert.equal(actionTarget(w, 'recoverDiver').id, 1);
  w.divers[1].condition = 'injured';
  step(w, { recoverDiver: true }, 1 / 60);
  assert.equal(w.divers[0].state, 'deploying');
  assert.equal(w.divers[1].state, 'ready');
  assert.equal(w.selectedDiverId, 1);
});
test('nearby recovery and pinned commands retain priority over automatic deployment', () => {
  const w = calm();
  Object.assign(w.divers[0], { state: 'surface', x: 246, y: 250, bag: 200 });
  w.selectedDiverId = 1;
  assert.equal(actionTarget(w, 'recoverDiver').id, 0);
  const command = pinActionTargets(w, { recoverDiver: true });
  w.divers[0].x = 180;
  step(w, command, 1 / 60);
  assert.equal(w.divers[1].state, 'ready');
  assert.equal(w.divers[0].state, 'surface');
});
test('automatic deployment keeps safety gates and bag work never deploys an idle crew member', () => {
  const w = calm();
  Object.assign(w.divers[0], { state: 'searching', x: 180, y: 180 });
  step(w, { work: true }, 1 / 60);
  assert.equal(w.divers[1].state, 'ready');
  w.day.crewRest = 20;
  step(w, { recoverDiver: true }, 1 / 60);
  assert.equal(w.divers[1].state, 'ready');
  assert.match(w.message, /CREW BUSY/);
});
test('recall reaches pickup distance from the hull on both axes and rotated boats', () => {
  for (const heading of [0, Math.PI / 2, 1.3]) {
    const w = calm(),
      spec = boatSpec(w),
      d = w.divers[0];
    w.boat.heading = heading;
    for (const [side, fore] of [
      [-spec.width / 2 - 4.99, 0],
      [0, spec.length / 2 + 4.99],
    ]) {
      Object.assign(d, {
        state: 'searching',
        x: w.boat.x + side * Math.cos(heading) + fore * Math.sin(heading),
        y: w.boat.y + side * Math.sin(heading) - fore * Math.cos(heading),
      });
      assert(recallStatus(w).available);
      assert(Math.abs(recallStatus(w).distance - 4.99) < 1e-8);
    }
    d.x += 30;
    assert.equal(recallStatus(w).available, false);
  }
});
test('deck load defaults on in Easy and Realistic and stays off in All Off', () => {
  assert(presetAssists('easy').loadGauge);
  assert(presetAssists('realistic').loadGauge);
  assert.equal(presetAssists('off').loadGauge, false);
});
test('decorative drift retains elapsed movement and wet-path checks at reduced cadence', () => {
  const w = calm();
  w.debris = Array.from({ length: 5 }, () => ({ x: 100, y: 100 }));
  const physical = { x: 100, y: 100 };
  let updates = 0;
  for (let i = 0; i < 120; i++) {
    w.time += 1 / 60;
    const before = w.debris[0].x;
    driftDebris(w, 1 / 60);
    driftSurface(w, physical, 1 / 60);
    if (w.debris[0].x !== before) updates++;
  }
  assert(updates < 30);
  for (const foam of w.debris) assert(Math.abs(foam.x - physical.x) < 0.03);
  w.terrain.depths.fill(-1);
  const before = structuredClone(w.debris);
  w.time += 10;
  driftDebris(w, 10);
  assert.deepEqual(w.debris, before, 'large steps still stop at dry ground');
});

test('weather shading reuses dry frames but redraws rain, visibility, lights and resizing', () => {
  const original = globalThis.document;
  let clears = 0;
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'clearRect'
          ? () => clears++
          : key === 'createRadialGradient'
            ? () => ({ addColorStop() {} })
            : () => {},
    },
  );
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
    querySelector: () => ({ after() {} }),
  };
  try {
    const view = new WeatherView(),
      w = careerWorld();
    w.weather = { kind: 'calm', darkness: 0, rain: 0, visibility: 400 };
    view.draw(w, 864, 1296, 1);
    for (let i = 0; i < 60; i++) {
      w.time += 1 / 60;
      view.draw(w, 864, 1296, 1);
    }
    assert.equal(clears, 1, 'unchanged full-screen weather canvas is retained');
    w.weather.darkness = 0.7;
    view.draw(w, 864, 1296, 1);
    assert.equal(clears, 2);
    w.weather.visibility = 80;
    view.draw(w, 864, 1296, 1);
    view.draw(w, 1296, 864, 1);
    assert.equal(clears, 4);
    w.weather.rain = 0.4;
    view.draw(w, 1296, 864, 1);
    w.time += 1 / 60;
    view.draw(w, 1296, 864, 1);
    assert.equal(clears, 6, 'rain keeps animating');
    w.weather.rain = 0;
    view.draw(w, 1296, 864, 1);
    assert.equal(clears, 7, 'ending rain clears its final streaks');
    w.weather.night = true;
    w.career.fleet[w.boat.configuration].equipment.push('lights');
    view.draw(w, 1296, 864, 1);
    w.boat.heading += 0.2;
    view.draw(w, 1296, 864, 1);
    assert.equal(clears, 9, 'working lights turn with the boat');
  } finally {
    if (original) globalThis.document = original;
    else delete globalThis.document;
  }
});
