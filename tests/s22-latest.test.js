import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, saveCareer } from '../src/career-save.js';
import { createSessionHooks } from '../src/career-session.js';
import {
  ARCADE_SHOWCASES,
  createTrainingCareer,
  trainingLessons,
  trainingPreparation,
  syncTrainingLight,
} from '../src/training-replay.js';
import { advanceIntro, INTRO_STEPS } from '../src/career-intro.js';
import { setPreset, toggleAssist, normalizeAssists } from '../src/assists.js';
import { boatDefinition } from '../src/boats.js';
import { FLEET } from '../src/career-data.js';
import { canCrossReturnBoundary } from '../src/navigation.js';
import { WEATHER } from '../src/weather.js';
import { freshVessel, useVessel } from '../src/career-state.js';
import { UI_SCALES } from '../src/ui-scale.js';

test('training copies current equipment, rehearses night, then restores the exact working career', () => {
  const real = careerWorld();
  real.career.fleet.twinjet = freshVessel('twinjet');
  useVessel(real, 'twinjet');
  real.career.fleet.twinjet.equipment = ['bowthruster', 'plotter', 'lights', 'torch', 'nitrox'];
  real.career.fleet.twinjet.fuel = 0;
  const before = encode(real),
    context = { world: real, persist: () => ({ ok: true }) };
  const hooks = createSessionHooks({ playtest: { debug: false } }, context);
  assert(hooks.trainingReplay().ok);
  const practice = context.world;
  assert.equal(practice.boat.configuration, 'twinjet');
  assert(practice.boat.fuel > 0, 'an empty real tank cannot strand the tutorial');
  assert.deepEqual(practice.career.fleet.twinjet.equipment, real.career.fleet.twinjet.equipment);
  assert(trainingPreparation(practice)[0].includes(boatDefinition('twinjet').name));
  assert(trainingLessons(practice).some(([title]) => title === 'Twin-jet pivot'));
  practice.boat.throttle = 1;
  assert.equal(advanceIntro(practice), false, 'front-loaded lessons precede the basic loop');
  practice.career.intro.prepIndex = trainingLessons(practice).findIndex(
    ([title]) => title === 'Working at night',
  );
  syncTrainingLight(practice);
  assert.equal(practice.day.minute, 1200);
  assert(practice.weather.night);
  practice.career.intro.prepIndex++;
  syncTrainingLight(practice);
  assert.equal(practice.day.minute, 600);
  assert(advanceIntro(practice));
  assert.equal(practice.career.intro.step, 1);
  practice.career.cash = -300;
  practice.patches[0].remaining = 0;
  saveCareer(practice, {
    setItem() {
      throw Error('Practice must never write a save');
    },
  });
  assert(hooks.sandbox(false).ok);
  assert.equal(context.world, real);
  assert.equal(encode(real), before);
});

test('unfitted boats only get relevant preparation; training works from an All Off career', () => {
  const w = careerWorld();
  setPreset(w, 'off');
  const copy = careerWorld(createTrainingCareer(w.career));
  assert(copy.career.assists.frankOverlay);
  assert.equal(trainingLessons(copy).length, 1);
  assert.equal(w.career.assists.frankOverlay, false);
});

test('Custom restores chosen toggles, realistic allows UI but excludes hidden aids, old saves gain cards', () => {
  const w = careerWorld();
  toggleAssist(w, 'clockOverlay');
  const custom = structuredClone(w.career.assists);
  setPreset(w, 'off');
  setPreset(w, 'custom');
  assert.deepEqual(w.career.assists, custom);
  w.career.difficulty = 'realistic';
  setPreset(w, 'realistic');
  assert.equal(w.career.assists.diverIndicators, false);
  assert(w.career.assists.diverPortraits);
  assert.equal(toggleAssist(w, 'groundDots'), false);
  toggleAssist(w, 'weatherOverlay');
  assert.equal(w.career.assists.weatherOverlay, false);
  delete w.career.assists.diverCards;
  normalizeAssists(w.career);
  assert(w.career.assists.diverCards);
  assert(UI_SCALES.includes(50));
});

test('tutorial return completes only through the configured south edge with crew aboard', () => {
  const w = careerWorld();
  w.career.day = 0;
  w.career.intro = { status: 'active', step: 9 };
  const intro = careerWorld(w.career);
  assert.deepEqual(intro.day.returnExit, { edge: 'south', bearing: 180, label: 'SOUTH' });
  assert.match(INTRO_STEPS[9][1], /SOUTH edge/);
  assert(intro.rocks.length >= 2);
  assert(intro.logs.some((log) => log.id === 'lesson-log'));
  const marked = intro.patches.find((patch) => patch.id === 'lesson-marked'),
    hidden = intro.patches.find((patch) => patch.id === 'lesson-hidden');
  assert(hidden.rate > marked.rate);
  assert(hidden.quality > marked.quality);

  intro.boat.x = 0;
  assert.equal(canCrossReturnBoundary(intro), true);
  assert.equal(advanceIntro(intro), false, 'the west edge cannot finish a south-edge lesson');
  intro.boat.x = intro.terrain.size / 2;
  intro.boat.y = intro.terrain.size;
  intro.divers[0].state = 'diving';
  assert.equal(canCrossReturnBoundary(intro), false);
  assert.equal(advanceIntro(intro), false, 'crew must be aboard');
  intro.divers[0].state = 'ready';
  assert.equal(advanceIntro(intro), true);
  assert.equal(intro.career.intro.step, 9);
  assert.equal(intro.career.intro.departed, true);
});

test('arcade showcases unlock every boat, equipment, later-area, and speed-run lessons', () => {
  const sourceWorld = careerWorld();
  sourceWorld.career.cash = 0;
  sourceWorld.career.xp = 0;
  const before = structuredClone(sourceWorld.career);
  const boatIds = ARCADE_SHOWCASES.filter((item) => item.scenario === 'boat').map(
    (item) => item.boatId,
  );
  assert.deepEqual(boatIds, Object.keys(FLEET));
  assert(ARCADE_SHOWCASES.some((item) => item.scenario === 'options'));
  assert(ARCADE_SHOWCASES.some((item) => item.scenario === 'risk-reward'));
  assert(ARCADE_SHOWCASES.some((item) => item.scenario === 'speed-run'));

  for (const showcase of ARCADE_SHOWCASES) {
    const practice = careerWorld(createTrainingCareer(sourceWorld.career, showcase));
    assert.equal(practice.boat.configuration, showcase.boatId || sourceWorld.career.activeBoat);
    assert(trainingLessons(practice).length > 0);
    if (showcase.scenario === 'options')
      assert.equal(practice.career.fleet[practice.boat.configuration].equipment.length, 15);
    if (showcase.scenario === 'risk-reward')
      assert.match(
        trainingLessons(practice).find(([title]) => title === 'Later-area risk and reward')[1],
        /\$12,000.*\$30,000.*fewer rivals/s,
      );
    if (showcase.scenario === 'speed-run')
      assert.match(
        trainingLessons(practice).find(([title]) => title === 'Speed-run strategy')[1],
        /expert ambition.*\$42,000.*several seasons.*retain depletion/s,
      );
  }
  assert.deepEqual(sourceWorld.career, before, 'showcases cannot purchase or mutate career assets');
  assert.equal(WEATHER.calm.name, 'Light Winds');
});
