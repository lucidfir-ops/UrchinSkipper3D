import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windLoads, whitecapAt, rainMotion } from '../src/wind-motion.js';
import { careerWorld, snapshot, restore, saveCareer } from '../src/career-save.js';
import { boatSpec } from '../src/boats.js';
import { stepBoat } from '../src/boat.js';
import { checkDiverSafety, closingImpact } from '../src/diver-safety.js';
import { serviceBoat } from '../src/career-state.js';
import { careerActions } from '../src/career-actions.js';
import { chooseGround, groundTrip } from '../src/day.js';
import { recordTrack } from '../src/knowledge.js';
import { SEASON, seasonStatus } from '../src/season.js';
import { recoverGrounds } from '../src/fleet-life.js';
import { SECTORS } from '../src/sectors.js';
import { coastTier } from '../src/coasts.js';
import { careerTerrain } from '../src/career-terrain.js';
import { chartContours } from '../src/chart-contours.js';
function flat(w) {
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  Object.assign(w.environment, {
    model: 'uniform',
    current: { x: 0, y: 0 },
    wind: { x: 0, y: 0 },
    waves: 0,
  });
  Object.assign(w.boat, { x: 250, y: 250, heading: 0, vx: 0, vy: 0, turn: 0 });
  return w;
}
test('wind moves its centre of pressure to the cabin without increasing the total load', () => {
  const w = careerWorld(),
    spec = boatSpec(w),
    wind = { x: 7, y: -3 },
    loads = windLoads(wind, spec);
  assert.equal(loads[1].fore, spec.cabinFore);
  assert(Math.abs(loads[1].x / (loads[0].x + loads[1].x) - 0.8) < 1e-10);
  assert(Math.abs(loads.reduce((n, f) => n + f.x, 0) - wind.x * spec.windage * 1.45) < 1e-10);
  assert.equal(windLoads(wind, spec, false)[1].x, 0);
});
test('strong cabin wind weathercocks at idle and a powered rudder retains steering against it', () => {
  const run = (rudder) => {
    const w = flat(careerWorld());
    w.environment.wind = { x: 15, y: 0 };
    w.boat.throttle = rudder ? 1 : 0;
    w.boat.rudder = rudder;
    for (let i = 0; i < 600; i++) stepBoat(w, {}, 1 / 60);
    return w;
  };
  const idle = run(0),
    helmed = run(-1);
  assert(idle.boat.heading > 0);
  assert(helmed.boat.heading < 0);
  assert(helmed.boat.speed > 1);
});
test('crests advance downwind, lie across it, and rain reverses with the same vector', () => {
  for (const wind of [
    { x: 12, y: 0 },
    { x: -12, y: 0 },
    { x: 0, y: -12 },
    { x: 7, y: 7 },
  ]) {
    const a = whitecapAt(100, 100, 1, wind),
      b = whitecapAt(100, 100, 1.01, wind);
    assert((b.x - a.x) * wind.x + (b.y - a.y) * wind.y > 0);
    assert(Math.abs(a.dx * wind.x + a.dy * wind.y) < 1e-8);
    const rain = rainMotion(wind);
    assert(rain.x * wind.x + rain.y * wind.y > 0);
  }
  assert.equal(whitecapAt(1, 1, 1, { x: 1, y: 0 }).alpha, 0);
});
test('parallel brush is safe; closing high-speed hull and working propeller remain dangerous', () => {
  const w = flat(careerWorld()),
    spec = boatSpec(w);
  const d = w.diver;
  Object.assign(d, { state: 'surface', x: 252.2, y: 250 });
  w.boat.vy = -2;
  assert.equal(closingImpact(w.boat, d, spec, 0, -2), 0);
  checkDiverSafety(w, { ...w.boat });
  assert.equal(d.condition, 'fit');
  Object.assign(d, { state: 'surface', x: 250, y: 245.7, nextSafetyContact: 0 });
  w.boat.vy = -5;
  checkDiverSafety(w, { ...w.boat });
  assert.equal(d.condition, 'deceased');
});
test('a valid licence cannot be billed twice and expired renewal has one charge', () => {
  const w = careerWorld(),
    cash = w.career.cash;
  assert(!serviceBoat(w, 'licence').ok);
  assert.equal(w.career.cash, cash);
  w.career.licenceThrough = 0;
  assert(serviceBoat(w, 'licence').ok);
  const paid = w.career.cash;
  assert(paid < cash);
  assert(!serviceBoat(w, 'licence').ok);
  assert.equal(w.career.cash, paid);
});
test('chart tracks preserve route order, avoid stationary clutter and break at new trips', () => {
  const k = {};
  for (let i = 0; i < 6; i++) recordTrack(k, { x: 10 + i * 3, y: 20 }, 1, 'trip-a', i * 2);
  recordTrack(k, { x: 25, y: 20 }, 1, 'trip-a', 13);
  assert.equal(k.tracks[0].points.length, 6);
  recordTrack(k, { x: 26, y: 20 }, 2, 'trip-b', 0);
  assert.equal(k.tracks.length, 2);
  assert.deepEqual(
    k.tracks[0].points.map((p) => p.x),
    [10, 13, 16, 19, 22, 25],
  );
});
test('season recruitment follows surviving stock only at the boundary and stays capped', () => {
  const c = careerWorld().career;
  c.stock = {
    near: [
      {
        id: 'sample',
        remaining: 100,
        clumps: [
          { remaining: 100, initialStock: 1000 },
          { remaining: 0, initialStock: 1000 },
        ],
      },
    ],
  };
  c.day = 2;
  recoverGrounds(c, 1);
  assert.equal(c.stock.near[0].remaining, 100);
  c.day = SEASON.days + 1;
  recoverGrounds(c, 1);
  assert.equal(c.stock.near[0].clumps[0].remaining, 139);
  assert.equal(c.stock.near[0].clumps[1].remaining, 4);
  assert.equal(c.stock.near[0].remaining, 143);
  assert(c.stock.near[0].kelpCover > 0.9);
  recoverGrounds(c, SEASON.days * 8);
  assert(c.stock.near[0].clumps.every((p) => p.remaining <= 1000));
});
test('nine-day season opens the three visible coastal areas on days 1, 3 and 5', () => {
  const w = careerWorld();
  assert(groundTrip(w, 'near').ok);
  assert(!groundTrip(w, 'middle').ok);
  assert(!groundTrip(w, 'far').ok);
  assert.match(groundTrip(w, 'far').reason, /Area not open.*day 5/);
  assert.equal(seasonStatus(w.career).daysLeft, 9);
  w.career.day = 3;
  assert(groundTrip(w, 'middle').ok);
  assert(!groundTrip(w, 'far').ok);
  w.career.day = 5;
  assert(groundTrip(w, 'far').ok);
  assert.equal(seasonStatus(w.career).daysLeft, 5);
});
test('new hidden shelves retain established reef identities, stock and original sea bed', () => {
  for (const def of SECTORS.slice(0, 9)) {
    const old = careerTerrain(def, 2),
      next = careerTerrain(def, 3);
    assert.deepEqual(next.patches.slice(0, old.patches.length), old.patches);
    assert.equal(next.depths, old.depths);
    assert(next.patches.filter((p) => p.charted === false).length >= 3);
    const volume = next.patches.find((p) => p.id === 'shelf-v3-0');
    assert(volume.remaining >= 5000 && volume.remaining <= 7500 * (1 + coastTier(def.id) * 0.3));
    assert.equal(volume.quality, 0.6 + coastTier(def.id) * 0.03);
    assert(volume.rate > old.patches[0].rate);
  }
});
test('contours interpolate authoritative bathymetry without revealing stock', () => {
  const terrain = {
    size: 60,
    spacing: 6,
    depths: Array.from({ length: 121 }, (_, i) => (i % 11) * 3),
  };
  for (const line of chartContours(terrain))
    for (const [a, b] of line.segments) {
      assert(Math.abs(a.x / 2 - line.depth) < 1e-8);
      assert(Math.abs(b.x / 2 - line.depth) < 1e-8);
    }
});
test('workshop saves cannot write over any real career, including the backup', () => {
  const w = careerWorld();
  w.career.sandbox = true;
  let writes = 0;
  assert(
    saveCareer(w, {
      getItem() {
        throw new Error('must not read');
      },
      setItem() {
        writes++;
      },
    }).ok,
  );
  assert.equal(writes, 0);
});
test('invalid numeric save state is rejected while old fuel quantities restore unchanged', () => {
  const w = careerWorld();
  w.boat.fuel = 33;
  const old = snapshot(w);
  assert.equal(restore(old).boat.fuel, 33);
  for (const corrupt of [
    (d) => (d.boat.vx = NaN),
    (d) => (d.divers[0].bag = -1),
    (d) => (d.career.debt = Infinity),
    (d) => (d.career.crew[0] = 'missing'),
  ]) {
    const data = structuredClone(old);
    corrupt(data);
    assert.throws(() => restore(data), /Damaged career/);
  }
});
test('harbour and office actions have distinct stable IDs with service operations outside the sea menu', () => {
  const w = careerWorld(),
    ui = { screen: 'harbour' };
  const actions = careerActions(ui, w);
  assert.equal(new Set(actions.map((a) => a.id)).size, actions.length);
  assert.equal(actions.filter((a) => a.id === 'workshop').length, 1);
  assert(actions.length <= 9);
  assert(!actions.some((a) => a.id === 'rest'));
  ui.screen = 'office';
  assert(careerActions(ui, w).some((a) => a.id === 'rest'));
  chooseGround(w, 'near');
  assert(!serviceBoat(w, 'fuel').ok);
});

test('scrolling a long menu cannot change its order or trap wrapping navigation around Back', async () => {
  const { menuGeometry, neighbour } = await import('../src/menu-navigation.js');
  const panel = {},
    list = { parentElement: panel, scrollTop: 0, scrollLeft: 0 };
  const button = (id, y, parent) => ({
    hidden: false,
    dataset: { choiceIndex: String(id) },
    parentElement: parent,
    getBoundingClientRect: () => ({
      x: 20,
      y: y - (parent.scrollTop || 0),
      width: 200,
      height: 40,
    }),
  });
  panel.querySelectorAll = () => [
    button(-1, 20, panel),
    ...Array.from({ length: 18 }, (_, i) => button(i, 90 + i * 50, list)),
  ];
  const original = menuGeometry(panel);
  list.scrollTop = 600;
  const scrolled = menuGeometry(panel);
  assert.deepEqual(scrolled, original);
  assert.equal(neighbour(scrolled, -1, 'up'), 17);
  assert.equal(neighbour(scrolled, 17, 'down'), -1);
  assert.equal(neighbour(scrolled, 14, 'up'), 13);
});
