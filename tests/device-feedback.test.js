import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  careerWorld,
  saveCareer,
  careerArchives,
  decode,
  nextCareerDay,
} from '../src/career-save.js';
import { createCareer, buyEquipment } from '../src/career-state.js';
import { introTerrain, initializeIntroWorld } from '../src/career-intro.js';
import { bedDepthAt } from '../src/terrain.js';
import { chooseGround } from '../src/day.js';
import { beginDeparture, departureBoat } from '../src/departure-transition.js';
import { defaultHudRect } from '../src/hud-defaults.js';
import { ownedTimepieces, clockFace, instrumentStyle } from '../src/instruments.js';
import { careerActions } from '../src/career-actions.js';

function storage() {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i],
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
  };
}
test('day starts are additive, immutable and load an earlier day without deleting later progress', () => {
  const s = storage(),
    w = careerWorld();
  assert(saveCareer(w, s).ok);
  const first = careerArchives(s, true).find((a) => a.kind === 'Start of day');
  assert(first);
  const original = s.getItem(first.key);
  w.career.cash -= 500;
  saveCareer(w, s);
  assert.equal(s.getItem(first.key), original);
  const next = nextCareerDay(w);
  assert(saveCareer(next, s).ok);
  assert.equal(careerArchives(s, true).length, 2);
  assert.equal(decode(s.getItem(first.key)).career.day, 1);
  assert.equal(decode(s.getItem(first.key)).career.cash, w.career.cash + 500);
});
test('tutorial has navigable open water all around the map, with finite islands and default help', () => {
  const terrain = introTerrain();
  for (let n = 0; n <= terrain.size; n += 2.5)
    for (const [x, y] of [
      [n, 0],
      [n, terrain.size],
      [0, n],
      [terrain.size, n],
    ])
      assert(bedDepthAt(terrain, x, y) > 3, `${x},${y}`);
  assert(terrain.depths.some((d) => d < 0));
  const w = careerWorld(createCareer(94));
  w.career.intro = { status: 'active', step: 0 };
  initializeIntroWorld(w);
  assert(w.career.assists.controlsHelp);
  w.career.assists.controlsHelp = false;
  initializeIntroWorld(w);
  assert(!w.career.assists.controlsHelp, 'a deliberate tutorial override survives reload');
});
test('departure fade preserves a diagonal approach heading on every exit', () => {
  for (const [edge, heading] of [
    ['south', 2.4],
    ['north', 0.6],
    ['east', 1.1],
    ['west', 4.4],
  ]) {
    const w = careerWorld();
    chooseGround(w, 'near');
    const size = w.terrain.size,
      x = edge === 'east' ? size : edge === 'west' ? 0 : size / 2,
      y = edge === 'south' ? size : edge === 'north' ? 0 : size / 2;
    w.day.returnExit.edge = edge;
    Object.assign(w.boat, { x, y, heading, vx: 2, vy: 3 });
    assert(beginDeparture(w));
    w.day.returnFade = 1;
    const shown = departureBoat(w),
      distance = Math.hypot(2, 3);
    assert(Math.abs(shown.x - x - Math.sin(heading) * distance) < 1e-8);
    assert(Math.abs(shown.y - y + Math.cos(heading) * distance) < 1e-8);
    assert.equal(shown.heading, heading);
    assert.equal(w.boat.x, x);
  }
});
test('default touch boat and diver strips use the bottom, away from top toolbar', () => {
  for (const [width, height] of [
    [873, 402],
    [1224, 816],
  ]) {
    for (const id of ['helmPanel', 'diverPanel']) {
      const r = defaultHudRect(id, width, height, true);
      assert.equal(r.top + r.height, height - 4);
    }
  }
});
test('timepieces are real purchases, remain independent of the text clock and default to graphical red digital', () => {
  const w = careerWorld();
  assert.equal(ownedTimepieces(w).length, 1);
  assert(w.career.assists.timepiece && !w.career.assists.clockOverlay);
  const cash = w.career.cash;
  assert(buyEquipment(w, 'clock-brass').ok);
  assert(w.career.cash < cash);
  assert(ownedTimepieces(w).some(([id]) => id === 'clock-brass'));
  assert(!buyEquipment(w, 'clock-brass').ok);
  assert.match(clockFace(600, 'digital'), /digital-clock.*10:00/);
  assert.equal(instrumentStyle('depthInstrumentPanel'), 'graphic');
});
test('logbook offers safe save/load but never a new career', () => {
  const w = careerWorld(),
    ui = {
      screen: 'logbook',
      hooks: { savePoint() {}, exportSave() {}, importSave() {} },
      back() {},
      open() {},
    };
  const actions = careerActions(ui, w);
  assert(actions.some((a) => a.id === 'save'));
  assert(actions.some((a) => a.label.includes('Load saved day')));
  assert(!actions.some((a) => /new career/i.test(a.label)));
});
