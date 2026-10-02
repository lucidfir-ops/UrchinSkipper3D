import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  careerWorld,
  snapshot,
  restore,
  encode,
  decode,
  saveCareer,
  loadCareer,
  SAVE_KEY,
} from '../src/career-save.js';
import { encodeSnapshot } from '../src/save-codec.js';
import { chooseGround } from '../src/day.js';
import { step } from '../src/simulation.js';
import { diverMotion, portRecoveryPoint } from '../src/diver-motion.js';

const frame = 1 / 60;
const tick = (w, seconds) => {
  for (let i = 0; i < seconds * 60; i++) step(w, {}, frame);
};
function recoveryFixture(w = careerWorld()) {
  if (w.day.phase === 'planning') chooseGround(w, 'near');
  w.terrain.depths = w.terrain.depths.slice().fill(20);
  w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  w.day.minute = 720;
  w.career.trafficSettings = { rate: 0 };
  w.logs = [];
  w.rocks = [];
  w.debris = [];
  return w;
}

test('a copied snapshot owns nested diver state and cannot change the running recovery or descent', () => {
  const w = careerWorld(),
    d = w.diver;
  d.transit = { kind: 'descent', depth: 12, total: 3, deckStart: { side: -1, aft: 1 } };
  d.escapeRoute = [{ x: 10, y: 20 }];
  d.lastBag = { weight: 120, quality: 0.8 };
  d.localSearch = { x: 10, y: 20, elapsed: 1 };
  const copied = snapshot(w);
  copied.divers[0].transit.deckStart.side = 77;
  copied.divers[0].escapeRoute[0].x = 77;
  copied.divers[0].lastBag.weight = 77;
  copied.divers[0].localSearch.elapsed = 77;
  assert.equal(d.transit.deckStart.side, -1);
  assert.equal(d.escapeRoute[0].x, 10);
  assert.equal(d.lastBag.weight, 120);
  assert.equal(d.localSearch.elapsed, 1);
  assert.equal(
    snapshot(w, false).divers[0].transit,
    d.transit,
    'worker path keeps one postMessage copy',
  );
});

test('malformed operation clocks, berth identities and bag values cannot replace a valid career or backup', () => {
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    w = careerWorld();
  w.bags = [{ weight: 50, quality: 0.8, harvestMinute: 400 }];
  w.catch = 50;
  assert(saveCareer(w, storage).ok);
  w.career.cash += 20;
  assert(saveCareer(w, storage).ok);
  const primary = values.get(SAVE_KEY),
    backup = values.get(SAVE_KEY + '-backup');
  for (const corrupt of [
    (data) => (data.divers[1].id = 0),
    (data) => (data.divers[0].hook = Infinity),
    (data) => (data.divers[0].timer = NaN),
    (data) => (data.divers[0].qualitySum = NaN),
    (data) => (data.divers[0].searchTime = -1),
    (data) => (data.bags[0].quality = NaN),
    (data) => (data.bags[0].weight = -5),
    (data) => (data.bags[0].harvestMinute = Infinity),
  ]) {
    const damaged = snapshot(w);
    corrupt(damaged);
    assert.throws(() => restore(damaged), /Damaged career/);
    values.set(SAVE_KEY, encodeSnapshot(damaged));
    const recovered = loadCareer(storage);
    assert(recovered?.recovered);
    assert.equal(recovered.world.career.cash, w.career.cash - 20);
    assert(saveCareer(w, storage).ok);
    assert.equal(values.get(SAVE_KEY + '-backup'), backup);
    assert.equal(values.get(SAVE_KEY), primary);
  }
  w.diver.hook = NaN;
  assert.equal(saveCareer(w, storage).ok, false);
  assert.equal(values.get(SAVE_KEY), primary);
});

test('reload during bag exchange or ladder boarding finishes once with both berths and catch intact', () => {
  for (const action of ['work', 'recoverDiver']) {
    const w = recoveryFixture();
    Object.assign(w.boat, { x: 232, y: 238, heading: 0, vx: 0, vy: 0, turn: 0 });
    const d = w.diver,
      ladder = portRecoveryPoint(w);
    Object.assign(d, {
      ...ladder,
      state: 'surface',
      bag: 100,
      qualitySum: 80,
      air: 22,
      bagHandled: false,
    });
    step(w, { [action]: true }, frame);
    tick(w, action === 'recoverDiver' ? 4.4 : 2);
    assert.equal(w.catch, 0);
    assert.equal(d.hooking, true);
    if (action === 'recoverDiver') assert.equal(diverMotion(w, d).phase, 'boarding');
    const resumed = recoveryFixture(decode(encode(w)));
    assert.equal(resumed.diver.hook, d.hook);
    assert.equal(resumed.diver.recoveryAction, d.recoveryAction);
    tick(resumed, 5);
    assert.equal(resumed.catch, 100);
    assert.equal(resumed.bags.length, 1);
    assert.equal(resumed.bags[0].quality, 0.8);
    assert.equal(resumed.diver.state, action === 'recoverDiver' ? 'ready' : 'surface');
    assert.equal(resumed.divers[1].state, 'ready');
    assert.equal(resumed.diver.air, action === 'recoverDiver' ? 100 : 22);
    const savedAgain = recoveryFixture(decode(encode(resumed)));
    tick(savedAgain, 5);
    assert.equal(savedAgain.catch, 100);
    assert.equal(savedAgain.bags.length, 1);
  }
});
