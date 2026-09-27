import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { prepareTraffic, spawnTraffic, stepTraffic } from '../src/traffic.js';
import { moveTraffic } from '../src/traffic-motion.js';
import { waterRoute, waterSegment } from '../src/water-route.js';
import { answerPatrol, stepFishery } from '../src/fishery.js';
import { deploymentStatus, rediveStatus } from '../src/diver-recovery.js';
import { advanceFleet } from '../src/fleet-life.js';
import { C } from '../src/config.js';
import { trafficPose } from '../src/traffic-view.js';
function world() {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.terrain.depths = w.terrain.depths.slice().fill(20);
  w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  Object.assign(w.boat, { x: 500, y: 500, vx: 0, vy: 0, turn: 0, throttle: 0 });
  w.career.trafficSettings = { rate: 0 };
  w.day.minute = 650;
  prepareTraffic(w);
  return w;
}
function actor(kind = 'taxi') {
  return {
    id: 'test-1',
    kind,
    art: kind === 'taxi' ? 'taxi-1' : 'nine-03-r1-c3',
    x: 50,
    y: 250,
    heading: Math.PI / 2,
    knots: kind === 'taxi' ? 30 : 5,
    turnRate: 1.1,
    length: 9,
    width: 3.2,
    draft: 2,
    vx: 0,
    vy: 0,
    turn: 0,
    throttle: 1,
    route: [{ x: 450, y: 250 }],
    waypoint: 0,
    born: 0,
    phase: 'transit',
    checked: [],
  };
}
test('scheduled traffic spreads failed itinerary searches across ticks without multiplying spawn attempts', () => {
  const w = world(),
    t = w.terrain,
    n = t.size / t.spacing + 1;
  w.career.trafficSettings.rate = 1;
  w.career.trafficSettings.patchId = w.patches[0].id;
  for (const p of w.patches) {
    p.x = 250;
    p.y = 250;
  }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (Math.hypot(x * t.spacing - 250, y * t.spacing - 250) < 30) t.depths[y * n + x] = -20;
  Object.assign(w.traffic.next, { taxi: 0, tourist: 9999, dfo: 9999, rival: 9999 });
  stepTraffic(w, 1 / 60);
  assert.equal(w.traffic.serial, 1);
  assert.equal(w.traffic.next.taxi, 0, 'A failed first route yields before trying again');
  for (let i = 0; i < 12; i++) {
    w.time += 1 / 60;
    stepTraffic(w, 1 / 60);
  }
  assert.equal(w.traffic.serial, 1, 'One logical spawn retains its seed through all retries');
  assert.equal(w.traffic.actors.length, 0);
  assert(w.traffic.next.taxi > w.time);
});
test('traffic rendering interpolates between bounded ticks without changing simulation or taking the long heading turn', () => {
  const a = {
      x: 10,
      y: 20,
      heading: -Math.PI + 0.1,
      renderFrom: { x: 0, y: 0, heading: Math.PI - 0.1 },
    },
    before = structuredClone(a),
    pose = trafficPose(a, 0.05);
  assert.equal(pose.x, 5);
  assert.equal(pose.y, 10);
  assert(Math.abs(pose.heading - Math.PI) < 1e-9);
  assert.deepEqual(a, before);
});
test('other-boat graph routes around real land and rejects an impassable destination', () => {
  const w = world(),
    t = w.terrain,
    n = t.size / t.spacing + 1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (x * t.spacing > 220 && x * t.spacing < 280 && y * t.spacing > 100 && y * t.spacing < 480)
        t.depths[y * n + x] = -10;
  const start = { x: 100, y: 250 },
    end = { x: 400, y: 250 },
    path = waterRoute(w, start, end);
  assert(path.length > 1);
  let previous = start;
  for (const p of path) {
    assert(waterSegment(t, 0, previous, p));
    previous = p;
  }
  assert.deepEqual(path.at(-1), end);
  assert.deepEqual(waterRoute(w, start, { x: 250, y: 250 }), []);
});
test('spawned taxis cross a patch at 30 knots; tourists use remaining nine-ships art and DFO uses 25', () => {
  const w = world(),
    p = w.patches.find((p) => p.remaining > 0),
    start = { x: 20, y: 250 };
  const taxi = spawnTraffic(w, 'taxi', { start, patchId: p.id }),
    tourist = spawnTraffic(w, 'tourist', { start, patchId: p.id }),
    dfo = spawnTraffic(w, 'dfo', { start, patchId: p.id });
  assert(taxi && tourist && dfo);
  assert.equal(taxi.knots, 30);
  assert.equal(tourist.knots, 5);
  assert.equal(dfo.knots, 25);
  assert(taxi.route.some((q) => q.x === p.x && q.y === p.y));
  assert(dfo.route.some((q) => q.x === p.x && q.y === p.y));
  assert.notEqual(tourist.art, w.career.opponents.find((t) => t.hidden).art);
});
test('taxi ignores underwater bubbles but a surfaced diver strike uses existing fatal collision rules', () => {
  const w = world(),
    a = actor();
  w.traffic.actors = [a];
  Object.assign(w.diver, { state: 'harvesting', x: 100, y: 250 });
  for (let i = 0; i < 60; i++) {
    w.time += 0.1;
    moveTraffic(w, a, 0.1);
  }
  assert(a.x > 120);
  assert.equal(w.diver.condition, 'fit');
  Object.assign(a, { x: 80, y: 250, heading: Math.PI / 2, waypoint: 0 });
  w.diver.state = 'surface';
  for (let i = 0; i < 30 && !w.emergency; i++) {
    w.time += 0.1;
    moveTraffic(w, a, 0.1);
  }
  assert.equal(w.diver.condition, 'deceased');
  assert(w.emergency.mandatoryRescue);
});
test('tourist passes bubbles with clearance and taxi goes around a blocking player hull', () => {
  const w = world(),
    a = actor('tourist');
  w.traffic.actors = [a];
  Object.assign(w.diver, { state: 'harvesting', x: 100, y: 250 });
  let closest = Infinity;
  for (let i = 0; i < 700; i++) {
    w.time += 0.1;
    moveTraffic(w, a, 0.1);
    closest = Math.min(closest, Math.hypot(a.x - 100, a.y - 250));
  }
  assert(closest >= 17);
  assert(a.x > 150, 'tourist makes progress around bubbles');
  w.diver.state = 'ready';
  const taxi = actor();
  w.traffic.actors = [taxi];
  Object.assign(w.boat, { x: 150, y: 250 });
  closest = Infinity;
  for (let i = 0; i < 300; i++) {
    w.time += 0.1;
    moveTraffic(w, taxi, 0.1);
    closest = Math.min(closest, Math.hypot(taxi.x - 150, taxi.y - 250));
  }
  assert(closest > 10);
  assert(taxi.x > 200, 'taxi routes around the blocking hull');
});
test('physical rival picking conserves shared stock and aggregate work cannot double-harvest this sector', () => {
  const w = world(),
    fleet = w.career.todayFleet.find((r) => r.area === 'near' && !r.hidden),
    p = w.patches.find((p) => p.remaining > 0 && p.quality >= 0.6);
  const a = spawnTraffic(w, 'rival', {
    start: { x: 20, y: 250 },
    patchId: p.id,
    fleetId: fleet.id,
  });
  assert(a);
  Object.assign(a, { x: p.x, y: p.y, phase: 'fishing', workSeconds: 0 });
  const before = p.remaining;
  w.time += 1;
  stepTraffic(w, 1);
  assert(fleet.gross > 0);
  assert(Math.abs(before - p.remaining - fleet.gross) < 1e-6);
  advanceFleet(w);
  assert(Math.abs(before - p.remaining - fleet.gross) < 1e-6);
});
test('DFO physically approaches alongside, blocks deploy/redive, boards only by invitation with crew up, and clears clean catch', () => {
  const w = world();
  Object.assign(w.boat, { x: 250, y: 250 });
  w.catch = 300;
  w.bags = [{ weight: 300, undersizeCount: 0, quality: 0.8 }];
  Object.assign(w.diver, { state: 'surface', bagHandled: true, x: 246, y: 250 });
  const a = spawnTraffic(w, 'dfo', { start: { x: 380, y: 250 } });
  assert(a);
  const cash = w.career.cash;
  for (let i = 0; i < 200 && w.day.inspection?.status !== 'calling'; i++) {
    w.time += 0.1;
    stepTraffic(w, 0.1);
  }
  assert.equal(w.day.inspection.status, 'calling');
  assert(Math.hypot(a.x - 250, a.y - 250) > 10, 'Cannot board remotely');
  assert.match(deploymentStatus(w, w.divers[1]).reason, /DFO/);
  assert.match(rediveStatus(w, w.diver).reason, /DFO/);
  w.diver.state = 'ready';
  assert(answerPatrol(w).ok);
  for (let i = 0; i < 1400 && w.day.inspection.status !== 'cleared'; i++) {
    w.time += 0.1;
    w.day.minute += 0.1 * C.day.minutesPerSecond;
    stepTraffic(w, 0.1);
    stepFishery(w, 0.1);
  }
  assert.equal(w.day.inspection.status, 'cleared');
  assert.equal(w.catch, 300);
  assert.equal(w.career.cash, cash);
  assert.equal(w.day.inspectionFine, 0);
});
test('traffic save resumes positions, routes and timers without spawning a duplicate actor', () => {
  const w = world();
  assert(spawnTraffic(w, 'taxi', { start: { x: 20, y: 250 } }));
  const restored = decode(encode(w));
  assert.deepEqual(restored.traffic, w.traffic);
  stepTraffic(restored, 0.1);
  assert.equal(restored.traffic.actors.length, 1);
});
