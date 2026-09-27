import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { SECTORS, enterSector } from '../src/sectors.js';
import { coastTier } from '../src/coasts.js';
import { fixedFeatures, nearShore } from '../src/shore-hazards.js';
import { createRocks, stepRocks } from '../src/rock-collision.js';
import { addWeatherLogs, createLogs } from '../src/hazards.js';
import { soundingDepth } from '../src/hazard-depth.js';
import { rockOpacity } from '../src/hazard-view.js';
import { paintChartRocks, rockChartLabel } from '../src/chart-art.js';
import { careerWorld, encode, decode, snapshot, restore } from '../src/career-save.js';
import { introTerrain } from '../src/career-intro.js';
import { step } from '../src/simulation.js';
import { clearWater } from '../src/water-route.js';

function sea() {
  const w = createWorld({ practice: true, boatId: 'sterndrive' });
  w.terrain.depths = w.terrain.depths.slice().fill(10);
  Object.assign(w.environment, {
    current: { x: 0, y: 0 },
    wind: { x: 0, y: 0 },
    waves: 0,
    seaLevel: 0,
  });
  Object.assign(w.boat, { x: 250, y: 250, vx: 0, vy: 0, turn: 0 });
  w.rocks = [
    {
      id: 'test',
      x: 250,
      y: 240,
      kind: 'rock',
      length: 0,
      radius: 1.5,
      heading: 0,
      topDepth: 0.2,
      severity: 1.35,
    },
  ];
  return w;
}

test('each sector has stable shoreline rocks in every 1–5 m seabed band and a visible uncharted subset', () => {
  for (const sector of SECTORS.slice(0, 9)) {
    const terrain = structuredClone(sector.terrain),
      before = JSON.stringify(terrain),
      rocks = fixedFeatures(terrain);
    const tier = coastTier(sector.id),
      perDepth = 8 + tier * 3;
    assert.equal(rocks.length, perDepth * 5);
    assert.equal(JSON.stringify(terrain), before);
    assert.deepEqual(fixedFeatures(structuredClone(terrain)), rocks);
    for (const band of [1, 2, 3, 4, 5])
      assert.equal(rocks.filter((r) => Math.round(r.bed) === band).length, perDepth);
    assert.equal(
      rocks.filter((r) => r.charted).length,
      tier ? Math.ceil(perDepth / (tier + 2)) * 5 : 30,
    );
    assert(rocks.every((r) => r.bed >= 1 && r.bed <= 5 && nearShore(terrain, r.x, r.y)));
    assert(rocks.some((r) => r.kind === 'rock outcrop'));
    assert(rocks.filter((r) => !r.charted).every((r) => r.topDepth < -1 && r.radius >= 1.8));
  }
  assert.deepEqual(fixedFeatures(introTerrain()), []);
});

test('daytime logs favour shore; separate night/fog cohorts are huge, safe and bounded across repeated transitions', () => {
  for (const sector of SECTORS.slice(0, 9)) {
    const w = createWorld();
    enterSector(w, sector.id);
    assert.equal(w.logs.length, 72);
    assert(w.logs.filter((l) => nearShore(w.terrain, l.x, l.y, 60)).length >= 54);
    const original = structuredClone(w.logs);
    Object.assign(w.diver, { state: 'surface', x: 330, y: 270 });
    w.weather = { kind: 'fog', night: false };
    addWeatherLogs(w);
    assert.equal(w.logs.length, 360);
    w.weather.night = true;
    addWeatherLogs(w);
    assert.equal(w.logs.length, 720);
    assert.deepEqual(w.logs.slice(0, 72), original);
    for (const l of w.logs.slice(72)) {
      assert(Math.hypot(l.x - w.boat.x, l.y - w.boat.y) >= 45);
      assert(Math.hypot(l.x - w.diver.x, l.y - w.diver.y) >= 20);
    }
    for (let i = 0; i < 10; i++) {
      w.weather = { kind: i % 2 ? 'fog' : 'calm', night: i % 3 === 0 };
      addWeatherLogs(w);
    }
    assert.equal(w.logs.length, 720);
  }
});

test('weather cohorts and fixed contact cooldowns survive save/reload; legacy saves gain safe daytime timber', () => {
  const w = careerWorld();
  enterSector(w, 'near');
  Object.assign(w.day, { groundId: 'near', phase: 'working', minute: 1200 });
  w.logs = createLogs(w);
  w.weather = { night: true, kind: 'fog' };
  addWeatherLogs(w);
  w.rocks[0].nextHullHit = 20;
  const restored = decode(encode(w));
  restored.weather = w.weather;
  addWeatherLogs(restored);
  assert.deepEqual(restored.logs, w.logs);
  assert.deepEqual(restored.rocks, w.rocks);
  const data = snapshot(w);
  delete data.logField;
  delete data.rockContacts;
  data.logs = [{ id: 'old-log', x: 250, y: 250, heading: 0, length: 6, radius: 0.3 }];
  Object.assign(data.boat, { x: w.rocks[0].x, y: w.rocks[0].y });
  const legacy = restore(data);
  assert(legacy.rocks[0].grace);
  legacy.weather = { kind: 'calm', night: false };
  addWeatherLogs(legacy);
  assert.deepEqual(legacy.logs[0], data.logs[0]);
  assert.equal(legacy.logs.length, 73);
  addWeatherLogs(legacy);
  assert.equal(legacy.logs.length, 73);
});

test('charts draw only the chosen fixed hazards with top-clearance labels, even when other chart aids are off', () => {
  const terrain = SECTORS[0].terrain,
    labels = [];
  const ctx = new Proxy(
    {},
    {
      get: (target, key) =>
        key === 'fillText'
          ? (label) => labels.push(label)
          : key === 'measureText'
            ? () => ({ width: 25 })
            : () => {},
      set: () => true,
    },
  );
  paintChartRocks(ctx, terrain, 0.8);
  assert.deepEqual(
    labels,
    fixedFeatures(terrain)
      .filter((r) => r.charted)
      .map(rockChartLabel),
  );
  labels.length = 0;
  paintChartRocks(ctx, terrain, 0.3, true);
  assert.equal(labels.length, 0);
});

test('uncharted crowns stay conspicuous at high tide; visibility stops at the weather limit', () => {
  const w = sea(),
    rock = { ...w.rocks[0], charted: false, topDepth: -1.7 };
  w.environment.seaLevel = 2.75;
  w.weather = { kind: 'fog', visibility: 42 };
  assert.equal(rockOpacity(w, rock), 1);
  assert(rockOpacity(w, { ...rock, charted: true, topDepth: 0.6 }) < 0.6);
  assert.equal(rockOpacity(w, { ...rock, x: w.boat.x + 43 }), 0);
  w.weather.night = true;
  assert(rockOpacity(w, rock) > 0.9);
  assert.equal(rockOpacity(w, { ...rock, x: w.boat.x + 20 }), 0);
});

test('fixed rocks stop a swept high-speed bow strike, damage hull only and never move', () => {
  const w = sea(),
    before = { ...w.boat },
    rock = { ...w.rocks[0] };
  w.boat.y = 225;
  w.boat.vy = -3;
  stepRocks(w, before);
  assert(w.boat.y > 245 && w.boat.y < 250);
  assert(w.boat.hullHealth < 1);
  assert.equal(w.boat.driveHealth, 1);
  assert.equal(w.boat.vy, 0);
  assert.equal(w.rocks[0].x, rock.x);
  assert.equal(w.rocks[0].y, rock.y);
  const health = w.boat.hullHealth;
  for (let i = 0; i < 60; i++) step(w, { fullAhead: true }, 1 / 60);
  assert.equal(w.boat.hullHealth, health);
  const y = w.boat.y;
  for (let i = 0; i < 60; i++) step(w, { fullReverse: true }, 1 / 60);
  assert(w.boat.y > y);
});

test('stern rock strikes reach exposed propulsion; tide clearance and slow contacts avoid damage', () => {
  const stern = sea();
  stern.rocks[0].y = 260;
  const before = { ...stern.boat };
  stern.boat.y = 255;
  stern.boat.vy = 3;
  stepRocks(stern, before);
  assert(stern.boat.driveHealth < 1);
  const high = sea(),
    highBefore = { ...high.boat };
  high.environment.seaLevel = 3;
  high.boat.y = 230;
  high.boat.vy = -3;
  stepRocks(high, highBefore);
  assert.equal(high.boat.y, 230);
  assert.equal(high.boat.hullHealth, 1);
  const slow = sea(),
    slowBefore = { ...slow.boat };
  slow.boat.y = 243;
  slow.boat.vy = -0.4;
  stepRocks(slow, slowBefore);
  assert.equal(slow.boat.hullHealth, 1);
  assert(slow.boat.y > 245);
});

test('a migrated overlap can sail clear before that fixed rock becomes hittable', () => {
  const w = createWorld();
  enterSector(w, 'near');
  Object.assign(w.boat, { x: w.rocks[0].x, y: w.rocks[0].y });
  w.rocks = createRocks(w);
  assert(w.rocks[0].grace);
  stepRocks(w);
  assert.equal(w.boat.hullHealth, 1);
  w.boat.x += 25;
  stepRocks(w);
  assert(!w.rocks[0].grace);
});

test('local soundings see rock tops only beneath the probe and include tide', () => {
  const w = sea(),
    rock = w.rocks[0];
  w.environment.seaLevel = 1.2;
  assert.equal(soundingDepth(w, rock.x, rock.y), 1.4);
  assert.equal(soundingDepth(w, rock.x + 4, rock.y), 11.2);
});

test('boats can reverse clear of a pre-existing rock overlap', () => {
  const w = sea();
  w.boat.y = 245;
  const before = { ...w.boat };
  w.boat.y = 245.2;
  w.boat.vy = 0.4;
  stepRocks(w, before);
  assert.equal(w.boat.y, 245.2);
  assert.equal(w.boat.hullHealth, 1);
});

test('traffic water routes include fixed-rock clearance and allow enough tide over charted tops', () => {
  const terrain = SECTORS[0].terrain,
    rock = fixedFeatures(terrain).find((r) => r.charted && r.bed > 4);
  assert(!clearWater(terrain, 0, rock, { draft: 1, radius: 0.5 }));
  assert(clearWater(terrain, 3, rock, { draft: 1, radius: 0.5 }));
});
