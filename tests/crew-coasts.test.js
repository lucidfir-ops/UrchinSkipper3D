import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, selectDiver, currentAt } from '../src/world.js';
import { step, setInstructions, actionTarget } from '../src/simulation.js';
import { C } from '../src/config.js';
import { careerWorld, encode, decode, nextCareerDay } from '../src/career-save.js';
import { surfaceMoment, refusalMoment, chatterStyle } from '../src/crew-moments.js';
import { workCrew, diverSpec } from '../src/crew.js';
import { advanceCareer } from '../src/career-state.js';
import { conditionsAt, updateWeather, weatherOutlook } from '../src/weather.js';
import { regionalLimits } from '../src/regional-conditions.js';
import { enterSector } from '../src/sectors.js';
import { updateEnvironment } from '../src/environment.js';
import { stepBoat } from '../src/boat.js';
import { requestRescue, chooseGround } from '../src/day.js';
import { spawnTraffic } from '../src/traffic.js';
import { moveTraffic } from '../src/traffic-motion.js';
import { PHYSICAL_AREAS } from '../src/coasts.js';
import { checkDiverSafety } from '../src/diver-safety.js';

function flat() {
  const w = createWorld({ practice: true });
  w.terrain.depths.fill(25);
  w.debris = [];
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  Object.assign(w.boat, { x: 250, y: 250, vx: 0, vy: 0 });
  w.patches = [
    {
      id: 101,
      x: 240,
      y: 250,
      radius: 60,
      rate: 10,
      quality: 0.8,
      remaining: 10000,
      charted: false,
    },
  ];
  return w;
}
function tick(w, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) step(w, {}, 1 / 60);
}
function surfacePair(w) {
  for (const d of w.divers)
    Object.assign(d, {
      state: 'surface',
      x: 246,
      y: 250 + d.id,
      bag: 300,
      qualitySum: 240,
      air: 70,
      patch: w.patches[0],
    });
}
test('one bag press finishes the nearby diver before the second, independent of selected scout', () => {
  const w = flat();
  surfacePair(w);
  selectDiver(w, 1);
  step(w, { work: true }, 1 / 60);
  tick(w, 3);
  assert.equal(w.catch, 300);
  assert.equal(w.divers[0].state, 'deploying');
  assert.equal(w.divers[0].air, 70);
  assert.equal(w.divers[1].bag, 300);
  assert.equal(w.selectedDiverId, 1);
  step(w, { work: true }, 1 / 60);
  tick(w, 3);
  assert.equal(w.catch, 600);
  assert.equal(w.divers[1].state, 'deploying');
  assert.equal(w.bags.length, 2);
});
test('an active exchange stays pinned when another float becomes closer', () => {
  const w = flat();
  surfacePair(w);
  step(w, { work: true }, 1 / 60);
  w.divers[1].x = 247;
  assert.equal(actionTarget(w, 'work').id, 0);
  assert.equal(actionTarget(w, 'recoverDiver').id, 0);
});
test('a nearby low-air diver answers the bag offer even when another person is selected', () => {
  const w = flat();
  const d = w.divers[0];
  Object.assign(d, { state: 'surface', x: 246, y: 250, bagHandled: true, air: 20 });
  selectDiver(w, 1);
  step(w, { work: true }, 1 / 60);
  assert.match(d.speech.text, /Low air.*fresh tank/);
  assert.equal(d.state, 'surface');
  assert.equal(w.selectedDiverId, 1);
  step(w, { recoverDiver: true }, 1 / 60);
  tick(w, 3);
  assert.equal(d.state, 'ready');
  assert.equal(w.divers[1].state, 'ready');
});
test('automatic exchange keeps the catch and explains empty ground without a second press', () => {
  const w = flat();
  surfacePair(w);
  w.patches[0].remaining = 0;
  step(w, { work: true }, 1 / 60);
  tick(w, 3);
  assert.equal(w.catch, 300);
  assert.equal(w.divers[0].state, 'surface');
  assert.match(w.divers[0].speech.text, /Nothing left/);
  assert.equal(w.divers[1].bag, 300);
});
test('unmarked rejected quality comes from a nearby observation, not distant hidden ground', () => {
  const w = flat(),
    d = w.diver;
  setInstructions(w, d.id, { direction: 0, minQuality: 0.9, searchLimit: 10 });
  Object.assign(d, { state: 'searching', x: 240, y: 250 });
  tick(w, 15.1);
  assert.equal(d.state, 'surface');
  assert.equal(d.bag, 0);
  assert.match(d.speech.text, /80%.*90%/);
  const other = flat();
  other.patches[0].x = 500;
  Object.assign(other.diver, {
    state: 'searching',
    x: 240,
    y: 250,
    minQuality: 0.9,
    searchLimit: 10,
  });
  tick(other, 15.1);
  assert.equal(other.diver.groundSample, undefined);
  assert(!other.diver.speech.text.includes('80%'));
});
test('bag-speed clock begins with picking and surfaces a conserved partial bag with a useful report', () => {
  const w = flat(),
    d = w.diver;
  w.patches[0].rate = 2;
  setInstructions(w, 0, { direction: 0, minQuality: 0, maxBagSeconds: 20 });
  Object.assign(d, {
    state: 'harvesting',
    x: 240,
    y: 250,
    patch: w.patches[0],
    diveTime: 30,
    searchTime: 30,
  });
  tick(w, 25.1);
  assert.equal(d.state, 'surface');
  assert(d.bag >= 40 && d.bag < 41);
  assert(Math.abs(w.patches[0].remaining + d.bag - 10000) < 1e-6);
  assert.match(d.speech.text, /20s bag order/);
  assert(d.lastBagSeconds > 149);
});
test('bag speed orders survive save, day and berth assignment; old orders default to Any', () => {
  const w = careerWorld();
  assert.equal(w.diver.maxBagSeconds, 0);
  assert(setInstructions(w, 0, { direction: 3, minQuality: 0.9, maxBagSeconds: 45 }));
  const saved = decode(encode(w));
  assert.equal(saved.diver.maxBagSeconds, 45);
  const next = nextCareerDay(saved);
  assert.equal(next.diver.maxBagSeconds, 45);
  next.career.crew.reverse();
  const swapped = careerWorld(next.career);
  assert.equal(swapped.divers.find((d) => d.crewId === 'ada').maxBagSeconds, 45);
});
test('unchanged surface reports stay quiet across reload; new quality and direct refusals bypass chatter', () => {
  let w = careerWorld();
  Object.assign(w.diver, { bag: 300, qualitySum: 270, reason: 'Bag full' });
  surfaceMoment(w, w.diver);
  const first = structuredClone(w.diver.speech);
  w.time = 200;
  surfaceMoment(w, w.diver);
  assert.deepEqual(w.diver.speech, first);
  w = decode(encode(w));
  surfaceMoment(w, w.diver);
  assert.deepEqual(w.diver.speech, first);
  w.diver.qualitySum = 210;
  surfaceMoment(w, w.diver);
  assert.match(w.diver.speech.text, /70%/);
  assert(w.diver.speech.until > w.time);
  w.diver.minQuality = 0.9;
  w.diver.qualitySum = 269.4;
  surfaceMoment(w, w.diver);
  assert.match(w.diver.speech.text, /89%.*90%/);
  w.diver.qualitySum = 270 - 1e-9;
  surfaceMoment(w, w.diver);
  assert(
    !w.diver.speech.text.includes('below'),
    'floating-point roundoff does not reject a matching sample',
  );
  w.diver.crewId = 'nell';
  assert.equal(chatterStyle(w.diver), 'quiet');
  refusalMoment(w, w.diver, 'AIR RESERVE');
  assert.match(w.diver.speech.text, /Low air/);
  w.diver.crewId = 'milo';
  assert.equal(chatterStyle(w.diver), 'chatty');
});
test('fatigue is felt during a day and mostly clears overnight, with long-day and night costs retained', () => {
  const w = careerWorld(),
    d = w.diver,
    fresh = diverSpec(d).harvestRate;
  w.weather.night = false;
  for (let i = 0; i < 600; i++) workCrew(w, d, 1);
  assert(d.fatigue > 0.5 && d.fatigue < 0.6);
  assert(diverSpec(d).harvestRate < fresh * 0.8);
  w.career.people[d.crewId].fatigue = d.fatigue;
  advanceCareer(w.career);
  assert.equal(w.career.people[d.crewId].fatigue, 0);
  w.career.people[d.crewId].fatigue = 1;
  advanceCareer(w.career);
  assert(w.career.people[d.crewId].fatigue > 0.3 && w.career.people[d.crewId].fatigue < 0.45);
  const night = careerWorld();
  night.weather.night = true;
  const day = careerWorld();
  day.weather.night = false;
  for (let i = 0; i < 300; i++) workCrew(day, day.diver, 1);
  for (let i = 0; i < 300; i++) workCrew(night, night.diver, 1);
  assert(Math.abs(night.diver.fatigue - day.diver.fatigue * 2) < 1e-6);
});
test('Home Coast live gusts, forecast and currents are bounded while later coasts retain severe storms', () => {
  const w = careerWorld();
  w.career.debugConditions = { weather: 'storm', bearing: 0 };
  const peaks = [];
  for (const area of PHYSICAL_AREAS) {
    enterSector(w, area.id);
    w.day.groundId = area.id;
    w.day.minute = 720;
    updateEnvironment(w);
    updateWeather(w);
    const c = conditionsAt(w),
      limit = regionalLimits(area.id);
    if (!area.tier) {
      assert(c.wind <= limit.wind && c.wave <= limit.wave && c.rain > 0.8);
      for (let i = 0; i < 30; i++) {
        w.time += 1;
        updateWeather(w);
        assert(
          Math.hypot(w.environment.wind.x, w.environment.wind.y) * C.knotsPerMps <=
            limit.wind + 1e-9,
        );
      }
      for (let y = 0; y < w.terrain.size; y += 20)
        for (let x = 0; x < w.terrain.size; x += 20)
          assert(Math.hypot(...Object.values(currentAt(w, x, y))) <= limit.current + 1e-9);
      assert(weatherOutlook(w).periods.every((p) => p.wind <= 8));
    }
    if (area.tier === 4) assert(c.wind > 60 && c.wave > 4);
    peaks.push(c.wind);
  }
  assert(peaks[0] < peaks[3] && peaks[3] < peaks[6] && peaks[6] < peaks[12]);
  const before = JSON.stringify(w);
  weatherOutlook(w, 3, 'near');
  assert.equal(JSON.stringify(w), before);
});
test('loaded starter rudder boat reverses off shore against maximum starter wind and current in Realistic', () => {
  for (const load of [0, 7500]) {
    const w = careerWorld();
    w.career.difficulty = 'realistic';
    w.catch = load;
    w.day.phase = 'practice';
    const n = w.terrain.size / w.terrain.spacing + 1,
      limit = regionalLimits('near');
    w.terrain.depths = w.terrain.depths.map(
      (_, i) => 2 + (Math.floor(i / n) * w.terrain.spacing - 246) * 0.15,
    );
    Object.assign(w.boat, {
      x: 250,
      y: 250,
      heading: 0,
      vx: 0,
      vy: 0,
      throttle: -1,
      grounded: true,
    });
    Object.assign(w.environment, {
      current: { x: 0, y: -limit.current },
      seaLevel: 0,
      waves: limit.wave * 0.045,
      wind: { x: 0, y: -limit.wind / C.knotsPerMps },
    });
    for (let i = 0; i < 3600; i++) {
      w.time += 1 / 60;
      stepBoat(w, {}, 1 / 60);
    }
    assert(w.boat.y > 256);
    assert(!w.boat.grounded);
    assert(w.boat.vy > 0.18);
  }
});
test('falling tide seats a hull until rising water refloats it, or paid rescue ends the trip once', () => {
  const w = flat();
  w.terrain.depths.fill(0.3);
  Object.assign(w.boat, { throttle: -1, grounded: true });
  tick(w, 5);
  assert.equal(w.boat.y, 250);
  assert(w.boat.grounded);
  w.environment.seaLevel = 2;
  tick(w, 3);
  assert(!w.boat.grounded);
  assert(w.boat.y > 250);
  w.environment.seaLevel = 0;
  tick(w, 1);
  assert(w.boat.grounded);
  assert(requestRescue(w).ok);
  assert.equal(w.day.result.costs.rescue, C.prototypeCosts.towHandling);
  assert.equal(w.day.phase, 'complete');
  assert(!requestRescue(w).ok);
});
test('taxi follows a committed straight working pass and exits without orbiting its waypoints', () => {
  const w = careerWorld();
  chooseGround(w, 'near');
  w.terrain.depths.fill(40);
  w.terrain.rocks = [];
  w.rocks = [];
  Object.assign(w.boat, { x: 500, y: 500 });
  w.patches = [{ id: 'pass-test', x: 250, y: 250, rate: 10, quality: 0.8, remaining: 3000 }];
  const a = spawnTraffic(w, 'taxi', { start: { x: 8, y: 250 }, patchId: 'pass-test' });
  assert(a);
  const mid = a.route.findIndex((p) => p.x === 250 && p.y === 250),
    before = a.route[mid - 1],
    after = a.route[mid + 1];
  assert(before && after);
  assert(Math.abs((250 - before.x) * (after.y - 250) - (250 - before.y) * (after.x - 250)) < 1e-6);
  let done = false,
    turns = 0,
    heading = a.heading;
  for (let i = 0; i < 1000 && !done; i++) {
    w.time += 0.1;
    done = moveTraffic(w, a, 0.1);
    turns += Math.abs(a.heading - heading);
    heading = a.heading;
  }
  assert(done);
  assert(turns < Math.PI * 2, String(turns));
});
test('a moving taxi contact injures or kills even after a recent harmless player contact', () => {
  for (const speed of [1, 15]) {
    const w = flat(),
      d = w.diver;
    Object.assign(d, { state: 'surface', x: 250, y: 250 });
    checkDiverSafety(w, { ...w.boat });
    assert.equal(d.condition, 'fit');
    const taxi = {
      id: 'taxi-contact',
      kind: 'taxi',
      x: d.x,
      y: d.y,
      heading: 0,
      vx: 0,
      vy: -speed,
      turn: 0,
      speed,
      throttle: 1,
    };
    checkDiverSafety(
      w,
      { ...taxi },
      { boat: taxi, spec: { length: 9, width: 3.2 }, exposed: true },
    );
    assert.equal(d.condition, speed > 4.8 ? 'deceased' : 'injured');
    assert.equal(w.safety.incidents.at(-1).cause, 'water taxi strike');
    assert(w.emergency);
  }
});
