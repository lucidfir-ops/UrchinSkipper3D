import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode, snapshot } from '../src/career-save.js';
import { validateSnapshot } from '../src/save-validation.js';
import { chooseGround } from '../src/day.js';
import { enterSector } from '../src/sectors.js';
import {
  WILDLIFE,
  prepareWildlife,
  speciesAllowed,
  spawnWildlife,
  stepWildlife,
} from '../src/wildlife.js';
import { moveTraffic } from '../src/traffic-motion.js';
import { depthAt } from '../src/terrain.js';

function areaWorld(area = 'near') {
  const w = careerWorld();
  chooseGround(w, 'near');
  if (area !== 'near') {
    w.day.groundId = area;
    enterSector(w, area);
  }
  w.weather = {
    night: false,
    visibility: 500,
    wave: 0.2,
    sunlight: 0.8,
  };
  w.environment.current = { x: 0, y: 0 };
  return w;
}
function trafficActor(kind, overrides = {}) {
  return {
    id: `test-${kind}-2`,
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
    ...overrides,
  };
}

test('wildlife scheduling is sparse, deterministic and capped instead of continuously spawning', () => {
  const a = areaWorld(),
    b = areaWorld(),
    firstA = prepareWildlife(a).nextSpawnAt,
    firstB = prepareWildlife(b).nextSpawnAt;
  assert.equal(firstA, firstB);
  assert(firstA >= WILDLIFE.firstDelay[0] && firstA <= WILDLIFE.firstDelay[1]);
  a.time = firstA;
  stepWildlife(a, WILDLIFE.tickSeconds);
  assert(a.wildlife.nextSpawnAt >= a.time + WILDLIFE.spawnDelay[0]);
  assert(a.wildlife.nextSpawnAt <= a.time + WILDLIFE.spawnDelay[1]);
  assert(a.wildlife.encounters.length <= WILDLIFE.maxEncounters);
});

test('species respect area, daylight, visibility and sea-state conditions', () => {
  const near = areaWorld('near');
  assert(speciesAllowed(near, 'seagull'));
  assert(speciesAllowed(near, 'eagle'));
  assert(speciesAllowed(near, 'seal'));
  assert(speciesAllowed(near, 'seaLion'));
  assert(!speciesAllowed(near, 'dolphin'));
  near.weather.night = true;
  assert(!speciesAllowed(near, 'seagull'));
  assert(!speciesAllowed(near, 'eagle'));
  near.weather.night = false;
  near.weather.wave = 1.6;
  assert(!speciesAllowed(near, 'seaLion'));

  const middle = areaWorld('middle');
  assert(speciesAllowed(middle, 'dolphin'));
  assert(!speciesAllowed(middle, 'orca'));
  const far = areaWorld('far');
  assert(speciesAllowed(far, 'dolphin'));
  assert(speciesAllowed(far, 'orca'));
  assert(speciesAllowed(far, 'humpback'));
  assert(!speciesAllowed(far, 'seal'));
});

test('deep-water cetaceans spawn as pods and never accept shallow habitat', () => {
  for (const species of ['dolphin', 'orca', 'humpback']) {
    const w = areaWorld('far');
    w.terrain.depths = w.terrain.depths.slice().fill(30);
    const pod = spawnWildlife(w, species, {
      force: true,
      point: { x: 250, y: 250 },
    });
    assert(pod);
    assert(pod.members.length > 1);
    assert(depthAt(w, pod.x, pod.y) >= WILDLIFE.deepDepth);
    assert(
      pod.members.every(
        (member) =>
          depthAt(w, pod.x + member.offsetX, pod.y + member.offsetY) >= WILDLIFE.deepDepth,
      ),
    );
  }
  const shallow = areaWorld('far');
  shallow.terrain.depths = shallow.terrain.depths.slice().fill(12);
  assert.equal(
    spawnWildlife(shallow, 'orca', {
      force: true,
      point: { x: 250, y: 250 },
    }),
    null,
  );
});

test('sea lions dive and perched eagles take off when boats approach their rock', () => {
  const w = areaWorld(),
    rock =
      w.rocks.find(
        (candidate) =>
          candidate.topDepth + w.environment.seaLevel <= -0.1 && candidate.radius >= 1.7,
      ) || w.rocks[0];
  assert(rock);
  const seaLions = spawnWildlife(w, 'seaLion', { force: true, rock, count: 3 }),
    eagle = spawnWildlife(w, 'eagle', { force: true, rock, count: 1 });
  assert(seaLions && eagle);
  Object.assign(w.boat, { x: rock.x, y: rock.y });
  stepWildlife(w, WILDLIFE.tickSeconds);
  assert.equal(seaLions.state, 'diving');
  assert.equal(eagle.state, 'takingOff');
  w.time += 1.4;
  stepWildlife(w, WILDLIFE.tickSeconds);
  assert.equal(eagle.state, 'flying');
});

test('curious tourist boats may follow visible cetaceans and then resume their route', () => {
  const w = areaWorld('far');
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  const tourist = trafficActor('tourist', {
      x: 180,
      y: 250,
      wildlifeCurious: true,
    }),
    indifferent = trafficActor('tourist', {
      id: 'test-tourist-3',
      x: 185,
      y: 250,
      wildlifeCurious: false,
    });
  w.traffic = {
    area: 'far',
    actors: [tourist, indifferent],
    serial: 0,
    accumulator: 0,
    next: {},
  };
  const originalRoute = tourist.route;
  const pod = spawnWildlife(w, 'dolphin', {
    force: true,
    point: { x: 230, y: 250 },
    count: 4,
    lifetime: 30,
  });
  for (const member of pod.members) member.phase = 0;
  stepWildlife(w, WILDLIFE.tickSeconds);
  assert.equal(tourist.followingWildlife, pod.id);
  assert.equal(indifferent.followingWildlife, undefined);
  assert.notEqual(tourist.route, originalRoute);
  assert(tourist.route.length > originalRoute.length);
  pod.expires = w.time;
  w.time += WILDLIFE.tickSeconds;
  stepWildlife(w, WILDLIFE.tickSeconds);
  assert.equal(tourist.followingWildlife, undefined);
  assert.deepEqual(tourist.route, originalRoute);
});

test('taxis avoid surfaced wildlife while retaining their normal route progress', () => {
  const w = areaWorld('far');
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  Object.assign(w.boat, { x: 500, y: 500 });
  const taxi = trafficActor('taxi');
  w.traffic = { area: 'far', actors: [taxi], serial: 0, accumulator: 0, next: {} };
  const pod = spawnWildlife(w, 'dolphin', {
    force: true,
    point: { x: 120, y: 250 },
    count: 3,
    lifetime: 60,
  });
  for (const member of pod.members) {
    member.offsetX = member.offsetY = member.phase = 0;
    member.surfaced = true;
  }
  let closest = Infinity;
  for (let i = 0; i < 100; i++) {
    w.time += 0.1;
    moveTraffic(w, taxi, 0.1);
    closest = Math.min(closest, Math.hypot(taxi.x - pod.x, taxi.y - pod.y));
  }
  assert(closest >= 12);
  assert(taxi.x > 120, 'taxi makes progress around the surfaced pod');
});

test('damaged wildlife scheduler and encounter state are rejected instead of freezing after reload', () => {
  const w = areaWorld(),
    valid = snapshot(w);
  prepareWildlife(w);
  const data = snapshot(w);
  validateSnapshot(data);
  for (const key of ['serial', 'scheduleSerial', 'accumulator', 'sectorRevision']) {
    const damaged = structuredClone(data);
    damaged.wildlife[key] = 'bad';
    assert.throws(() => validateSnapshot(damaged), /Damaged career save: wildlife bounds/);
  }
  const rock =
    w.rocks.find(
      (candidate) => candidate.topDepth + w.environment.seaLevel <= -0.1 && candidate.radius >= 1.7,
    ) || w.rocks[0];
  spawnWildlife(w, 'eagle', { force: true, rock });
  const damagedEncounter = snapshot(w);
  damagedEncounter.wildlife.encounters[0].state = 'stuck';
  assert.throws(
    () => validateSnapshot(damagedEncounter),
    /Damaged career save: wildlife encounter/,
  );
  assert.equal(valid.wildlife, undefined);
});

test('wildlife encounters and timers survive a validated save round trip', () => {
  const w = areaWorld('far');
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  spawnWildlife(w, 'humpback', {
    force: true,
    point: { x: 250, y: 250 },
    count: 3,
  });
  const restored = decode(encode(w));
  assert.deepEqual(restored.wildlife, w.wildlife);
});
