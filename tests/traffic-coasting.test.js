import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { createCareer, freshVessel, useVessel } from '../src/career-state.js';
import { chooseGround } from '../src/day.js';
import { enterSector } from '../src/sectors.js';
import { updateEnvironment } from '../src/environment.js';
import { boatSpec } from '../src/boats.js';
import { stepBoat } from '../src/boat.js';
import { checkDiverSafety } from '../src/diver-safety.js';
import { fromHull } from '../src/collision-geometry.js';
import { prepareTraffic, spawnTraffic, stepTraffic } from '../src/traffic.js';
import { moveTraffic } from '../src/traffic-motion.js';
import { rivalDayPlan, trafficHull } from '../src/rival-plan.js';
import { clearWater, waterSegment } from '../src/water-route.js';

function sea(seed = 171709, area = 'near') {
  const w = careerWorld(createCareer(seed));
  assert(chooseGround(w, 'near').ok);
  w.day.groundId = area;
  w.day.minute = 700;
  enterSector(w, area);
  w.career.trafficSettings = { rate: 0 };
  return w;
}

test('full ahead to neutral at full helm keeps a small coasting arc for empty and loaded boats', () => {
  for (const id of ['basic', 'thruster', 'sterndrive'])
    for (const load of [0, 0.8])
      for (const sign of [-1, 1]) {
        const w = sea();
        w.career.fleet[id] = freshVessel(id);
        useVessel(w, id);
        w.catch = boatSpec(w).capacity * load;
        w.terrain.depths = w.terrain.depths.slice().fill(40);
        w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
        Object.assign(w.boat, {
          x: 250,
          y: 350,
          heading: 0,
          vx: 0,
          vy: -boatSpec(w).maxSpeed,
          throttle: 1,
          rudder: sign,
          turn: sign * 0.03,
        });
        let peak = 0;
        for (let n = 0; n < 300; n++) {
          w.time += 1 / 60;
          stepBoat(w, { neutral: true }, 1 / 60);
          peak = Math.max(peak, Math.abs(w.boat.turn));
        }
        const degrees = (w.boat.heading * sign * 180) / Math.PI;
        assert(degrees > 1 && degrees < 12, JSON.stringify({ id, load, sign, degrees }));
        assert(peak < 0.065);
        assert(Math.hypot(w.boat.vx, w.boat.vy) > 0.3, 'Neutral retains stopping momentum');
      }
});

test('a slow swept bow nudge clears sideways without attaching the diver to forward hull movement', () => {
  for (const heading of [0, 0.7, Math.PI / 2]) {
    const w = sea(),
      b = w.boat,
      d = w.divers[0],
      spec = boatSpec(w);
    w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
    Object.assign(b, {
      x: 250,
      y: 250,
      heading,
      vx: Math.sin(heading),
      vy: -Math.cos(heading),
      turn: 0,
      throttle: 0,
    });
    Object.assign(d, fromHull(b, 0, spec.length / 2 + 0.2), { state: 'surface' });
    const start = { x: d.x, y: d.y };
    for (let n = 0; n < 40; n++) {
      const before = { ...b };
      b.x += b.vx * 0.1;
      b.y += b.vy * 0.1;
      w.time += 0.1;
      checkDiverSafety(w, before);
    }
    assert.equal(d.condition, 'fit');
    assert(
      Math.abs((d.x - start.x) * Math.sin(heading) - (d.y - start.y) * Math.cos(heading)) < 1e-8,
    );
    assert.equal(d.state, 'surface');
  }
});

test('daily rival limits, occasional nearby work and rare mystery visits are deterministic', () => {
  const c = createCareer(171709);
  let near = 0,
    mystery = 0,
    two = 0;
  for (let day = 1; day <= 1000; day++) {
    c.day = day;
    const plan = rivalDayPlan(c);
    assert.deepEqual(plan, rivalDayPlan(structuredClone(c)));
    near += plan.nearby;
    mystery += plan.mystery;
    two += plan.limit === 2;
  }
  assert(near > 350 && near < 450, String(near));
  assert(mystery > 8 && mystery < 35, String(mystery));
  assert(two > 430 && two < 570);
});

test('natural rivals prefer marked beds, stop, remove shared stock and leave through safe water on multiple coasts', () => {
  for (const seed of [1606, 171709, 2509])
    for (const area of ['near', 'middle', 'far', 'storm-channel', 'frontier-reach']) {
      const w = sea(seed, area),
        fleet = w.career.todayFleet.find((f) => !f.hidden);
      Object.assign(fleet, { area, begin: 0, end: 1120, gross: 0, qualitySum: 0, goal: 900 });
      const actor = spawnTraffic(w, 'rival', { fleetId: fleet.id });
      assert(actor, `${seed}/${area} spawn`);
      const patch = w.patches.find((p) => p.id === actor.patchId),
        before = patch.remaining;
      assert.notEqual(patch.charted, false);
      let fished = false;
      for (let n = 0; n < 5000 && !actor.done; n++) {
        w.time += 0.1;
        w.day.minute += 0.05;
        updateEnvironment(w);
        stepTraffic(w, 0.1);
        assert(
          clearWater(w.terrain, w.environment.seaLevel || 0, actor, trafficHull(actor)),
          `${seed}/${area} shoreline`,
        );
        if (actor.phase === 'fishing') {
          fished = true;
          assert.equal(actor.speed, 0);
        }
      }
      assert(
        fished && actor.done && fleet.gross > 800,
        JSON.stringify({
          seed,
          area,
          phase: actor.phase,
          gross: fleet.gross,
          stuck: actor.stuckSeconds,
        }),
      );
      assert(Math.abs(before - patch.remaining - fleet.gross) < 1e-6);
    }
});

test('one or two ordinary rival visits per day survive reload and re-entering the sector', () => {
  let w = sea();
  for (const f of w.career.todayFleet) Object.assign(f, { area: 'near', begin: 0, end: 1120 });
  const plan = rivalDayPlan(w.career);
  let count = 0;
  for (let n = 0; n < 24; n++) {
    const actor = spawnTraffic(w, 'rival');
    if (actor) {
      count++;
      if (!plan.nearby) {
        const p = w.patches.find((p) => p.id === actor.patchId);
        assert(Math.hypot(p.x - w.boat.x, p.y - w.boat.y) >= 140);
      }
    }
    w.traffic.actors = [];
    w = decode(encode(w));
    w.traffic = null;
    prepareTraffic(w);
  }
  assert.equal(count, plan.limit);
});

test('taxi long hauls do not require a fishing patch and keep the course chosen at spawn', () => {
  for (const area of ['near', 'middle', 'far']) {
    const w = sea(1606, area);
    w.patches = [];
    let successes = 0;
    for (let n = 0; n < 8; n++) {
      w.traffic = null;
      const actor = spawnTraffic(w, 'taxi');
      if (!actor) continue;
      const route = structuredClone(actor.route),
        end = route.at(-1);
      assert(Math.hypot(end.x - actor.x, end.y - actor.y) > w.terrain.size * 0.6);
      let previous = { ...actor };
      for (const p of route) {
        assert(
          waterSegment(w.terrain, w.environment.seaLevel || 0, previous, p, trafficHull(actor)),
        );
        previous = p;
      }
      let done = false;
      for (let tick = 0; tick < 1800 && !done; tick++) {
        w.time += 0.1;
        done = moveTraffic(w, actor, 0.1);
        assert(clearWater(w.terrain, w.environment.seaLevel || 0, actor, trafficHull(actor)));
      }
      assert(done, `${area} taxi leaves`);
      assert.deepEqual(actor.route, route);
      successes++;
    }
    assert(successes >= 6, `${area}: ${successes}`);
  }
});

test('a saved rival chasing an old bed-centre route resumes toward a safe berth and fishes', () => {
  let w = sea();
  const fleet = w.career.todayFleet.find((f) => !f.hidden);
  Object.assign(fleet, { area: 'near', begin: 0, end: 1120, goal: 2000 });
  const actor = spawnTraffic(w, 'rival', { fleetId: fleet.id }),
    patch = w.patches.find((p) => p.id === actor.patchId);
  delete actor.navigationVersion;
  delete fleet.shipSeen;
  actor.route = [{ x: patch.x, y: patch.y }];
  w = decode(encode(w));
  const restored = w.traffic.actors[0];
  w.time += 0.1;
  stepTraffic(w, 0.1);
  assert.notDeepEqual(restored.route.at(-1), { x: patch.x, y: patch.y });
  assert(w.career.todayFleet.find((f) => f.id === restored.fleetId).shipSeen);
  for (let n = 0; n < 3000 && restored.phase !== 'fishing'; n++) {
    w.time += 0.1;
    stepTraffic(w, 0.1);
  }
  assert.equal(restored.phase, 'fishing');
  assert(clearWater(w.terrain, w.environment.seaLevel || 0, restored, trafficHull(restored)));
});
