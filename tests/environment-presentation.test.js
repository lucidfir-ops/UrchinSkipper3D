import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld } from '../src/career-save.js';
import { createWorld } from '../src/world.js';
import { conditionsAt } from '../src/weather.js';
import { rockCanHit, rockVisualBand } from '../src/rock-depth.js';
import { rockOpacity } from '../src/hazard-view.js';
import { drawHazards } from '../src/hazard-view.js';
import { stepRocks } from '../src/rock-collision.js';
import { lightningState } from '../src/weather-effects.js';
import { synthesize } from '../src/audio.js';

function testRock() {
  return {
    id: 'datum-check',
    x: 250,
    y: 240,
    kind: 'rock',
    length: 0,
    radius: 1.5,
    heading: 0,
    topDepth: 0.2,
    severity: 1.35,
    charted: true,
  };
}

test('rock presentation, soundings and collision use one positive-down water-depth datum', () => {
  const w = createWorld({ practice: true, boatId: 'sterndrive' }),
    rock = testRock();
  w.terrain.depths = w.terrain.depths.slice().fill(10);
  Object.assign(w.environment, {
    current: { x: 0, y: 0 },
    wind: { x: 0, y: 0 },
    waves: 0,
    seaLevel: 2.2,
  });
  Object.assign(w.boat, { x: 250, y: 225, vx: 0, vy: -3, turn: 0 });
  w.rocks = [rock];

  assert(Math.abs(rock.topDepth + w.environment.seaLevel - 2.4) < 1e-10);
  assert.equal(rockVisualBand(w, rock), 'deep');
  assert(rockOpacity(w, rock) > 0.5);
  const before = { ...w.boat };
  stepRocks(w, before);
  assert.equal(w.boat.hullHealth, 1);

  w.environment.seaLevel = 0;
  assert.equal(rockVisualBand(w, { ...rock, topDepth: 5.00001 }), 'hidden');
  assert.equal(rockVisualBand(w, { ...rock, topDepth: 5 }), 'deep');
  assert.equal(rockVisualBand(w, { ...rock, topDepth: 2 }), 'deep');
  assert.equal(rockVisualBand(w, { ...rock, topDepth: 1.9 }), 'shallow');
  assert.equal(rockVisualBand(w, { ...rock, topDepth: 0.1 }), 'shallow');
  assert.equal(rockVisualBand(w, { ...rock, topDepth: 0 }), 'exposed');
  assert(!rockCanHit({ ...rock, topDepth: 2 }, 0, 3));
  assert(rockCanHit({ ...rock, topDepth: 1.9 }, 0, 3));

  w.environment.seaLevel = 4.81;
  assert.equal(rockVisualBand(w, rock), 'hidden');
  assert.equal(rockOpacity(w, rock), 0);
  assert(!rockCanHit(rock, 1.8, 3));
  assert(rockCanHit({ ...rock, topDepth: -0.2 }, 0, 0.01));
});

test('rock vector colours and surface foam follow the shared depth bands', () => {
  const w = createWorld({ practice: true }),
    rock = testRock(),
    calls = [],
    graphics = {
      fillStyle(colour) {
        calls.push(['fill', colour]);
      },
      fillPoints() {},
      lineStyle(_width, colour) {
        calls.push(['line', colour]);
      },
      lineBetween() {},
      fillCircle() {},
      strokePoints() {},
    };
  Object.assign(w.boat, { x: rock.x, y: rock.y });
  w.environment.seaLevel = 0;
  const colours = (topDepth) => {
    calls.length = 0;
    w.rocks = [{ ...rock, topDepth }];
    drawHazards(graphics, w, { p: 1, zoom: 1, rangeX: 100, rangeY: 100 });
    return calls;
  };
  assert(colours(2.4).some(([kind, colour]) => kind === 'fill' && colour === 0x176c86));
  assert(!calls.some(([kind, colour]) => kind === 'line' && colour === 0xffffff));
  assert(colours(1.2).some(([kind, colour]) => kind === 'fill' && colour === 0x7a9b86));
  assert(calls.some(([kind, colour]) => kind === 'line' && colour === 0xf3cc82));
  assert(!calls.some(([kind, colour]) => kind === 'line' && colour === 0xffffff));
  assert(colours(0).some(([kind, colour]) => kind === 'fill' && colour === 0x9e8d70));
  assert(calls.some(([kind, colour]) => kind === 'line' && colour === 0xffffff));
  assert.equal(colours(5.01).length, 0);
});

test('rain, wind and surface exposure remain independent environmental dimensions', () => {
  const w = careerWorld();
  w.day.minute = 900;
  w.career.weatherPlan = [{ minute: 0, kind: 'rain', bearing: 180 }];
  const shelteredRain = conditionsAt(w, 900, 'near'),
    exposedRain = conditionsAt(w, 900, 'far');
  assert(shelteredRain.rain > 0.5);
  assert(shelteredRain.wind < 2);
  assert(exposedRain.wave > shelteredRain.wave);

  w.career.weatherPlan = [{ minute: 0, kind: 'storm', bearing: 180 }];
  const shelteredStorm = conditionsAt(w, 900, 'near'),
    exposedStorm = conditionsAt(w, 900, 'far');
  assert(shelteredStorm.wave < 0.3);
  assert(
    shelteredStorm.wind > 6 && shelteredStorm.wind <= 8,
    'starter storm stays windy but workable',
  );
  assert.equal(exposedStorm.wave, 0.8);
  assert(conditionsAt(w, 900, 'storm-channel').wave > 2);
  assert(exposedStorm.wind > shelteredStorm.wind);
  const partialExposure = conditionsAt(w, 900, 'middle');
  assert(partialExposure.wave > shelteredStorm.wave && partialExposure.wave < exposedStorm.wave);

  w.career.weatherPlan = [{ minute: 0, kind: 'calm', bearing: 180 }];
  const exposedCalm = conditionsAt(w, 900, 'far');
  assert(exposedCalm.wave > 0.2);
  assert(exposedCalm.sunlight > 0.5);
});

test('electrical weather has deterministic visible flashes, delayed thunder and procedural audio', () => {
  let flash = false,
    thunder = false;
  for (let time = 0; time < 180; time += 0.02) {
    const state = lightningState({ lightning: 1 }, time);
    flash ||= state.flash > 0;
    thunder ||= state.thunder;
  }
  assert(flash);
  assert(thunder);
  const audio = synthesize('thunder', 4000);
  assert(audio.some((sample) => Math.abs(sample) > 0.01));
});
