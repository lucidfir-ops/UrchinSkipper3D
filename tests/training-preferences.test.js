import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSISTS,
  assist,
  normalizeAssists,
  presetAssists,
  setPreset,
  toggleAssist,
} from '../src/assists.js';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { createCareer } from '../src/career-state.js';
import { createSessionHooks } from '../src/career-session.js';
import { createTrainingCareer, trainingLessons } from '../src/training-replay.js';
import { lesson } from '../src/intro-view.js';
import { Input, DEFAULTS } from '../src/input.js';
import { LayoutEditor } from '../src/layout-editor.js';
import { expeditionActions } from '../src/expedition-actions.js';

const gauges = ['timepiece', 'depthInstrument', 'speedGauge', 'throttleGauge', 'fuelGauge'];
function tutorial() {
  const c = createCareer(17);
  c.day = 0;
  c.intro = { status: 'active', step: 7 };
  return careerWorld(c);
}
function previousPreset(mode, revision) {
  const p = { ...presetAssists(mode), layoutRevision: revision };
  if (mode === 'realistic') p.speedGauge = p.throttleGauge = p.fuelGauge = false;
  if (revision < 3) {
    for (const key of [
      'loadGauge',
      'minimap',
      'helmOverlay',
      'weatherOverlay',
      'departureGuidance',
    ])
      p[key] = mode !== 'off';
    for (const key of ['currentOverlay', 'almanacShortcut', 'pickingLegend'])
      p[key] = mode === 'easy';
  }
  return p;
}

test('tutorial opt-ins reveal only chosen panels and survive save, All Off and Custom restore', () => {
  let w = tutorial();
  for (const key of [...gauges, 'sounder', 'clockOverlay', 'weatherOverlay'])
    assert(!assist(w, key), key);
  assert(assist(w, 'diverCards') && assist(w, 'frankOverlay'));
  assert(w.career.assists.speedGauge, 'the career default stays stored while tutorial masks it');
  toggleAssist(w, 'speedGauge');
  toggleAssist(w, 'sounder');
  assert(assist(w, 'speedGauge') && assist(w, 'sounder'));
  for (const key of [
    'timepiece',
    'depthInstrument',
    'throttleGauge',
    'fuelGauge',
    'clockOverlay',
    'weatherOverlay',
  ])
    assert(!assist(w, key), key);
  const action = expeditionActions({ screen: 'assists' }, w).find(
    (a) => a.id === 'assist-fuelGauge',
  );
  assert.match(action.label, /OFF$/);
  w = decode(encode(w));
  assert(assist(w, 'speedGauge') && assist(w, 'sounder'));
  setPreset(w, 'off');
  for (const key of Object.keys(ASSISTS)) assert(!assist(w, key), key);
  setPreset(w, 'custom');
  assert(assist(w, 'speedGauge') && assist(w, 'sounder'));
  assert(!assist(w, 'fuelGauge'));
  toggleAssist(w, 'speedGauge');
  assert(!assist(w, 'speedGauge') && assist(w, 'sounder'));
});

test('all known untouched legacy presets migrate while altered and Custom choices survive', () => {
  for (const revision of [1, 2, 3]) {
    for (const mode of ['easy', 'realistic', 'off']) {
      const c = { assists: previousPreset(mode, revision) };
      normalizeAssists(c);
      for (const key of Object.keys(ASSISTS))
        assert.equal(c.assists[key], presetAssists(mode)[key], `${revision}/${mode}/${key}`);
      const once = structuredClone(c);
      normalizeAssists(c);
      assert.deepEqual(c, once);
    }
  }
  for (const mode of ['realistic', 'custom']) {
    const c = {
      assists: { ...previousPreset('realistic', 3), preset: mode, sounder: true, timepiece: false },
    };
    const before = structuredClone(c.assists);
    normalizeAssists(c);
    for (const key of Object.keys(ASSISTS))
      assert.equal(c.assists[key], before[key], `${mode}/${key}`);
    assert(c.assists.manual.sounder && c.assists.manual.timepiece);
  }
});

test('restored Realistic slots gain ordinary gauges without gaining hidden assistance', () => {
  const w = careerWorld();
  w.career.difficulty = 'realistic';
  w.career.assistPresets = { realistic: previousPreset('realistic', 3) };
  setPreset(w, 'realistic', { restore: true });
  for (const key of gauges) assert(assist(w, key), key);
  for (const key of [
    'diverIndicators',
    'groundDots',
    'currentArrows',
    'currentOverlay',
    'offscreenArrows',
  ]) {
    assert(!assist(w, key), key);
    assert.equal(toggleAssist(w, key), false);
  }
  toggleAssist(w, 'fuelGauge');
  setPreset(w, 'off');
  setPreset(w, 'realistic', { restore: true });
  assert(!assist(w, 'fuelGauge'), 'a restored deliberate OFF is not refreshed');
  assert(assist(w, 'speedGauge'));
});

test('legacy individual preferences remain available in an isolated training copy', () => {
  const real = careerWorld();
  real.career.assists = { ...previousPreset('easy', 3), preset: 'custom', sounder: true };
  delete real.career.assists.manual;
  const before = encode(real);
  const practice = careerWorld(createTrainingCareer(real.career));
  assert(assist(practice, 'sounder'));
  assert(!assist(practice, 'fuelGauge'));
  toggleAssist(practice, 'clockOverlay');
  assert(assist(practice, 'clockOverlay'));
  assert.equal(encode(real), before, 'training switches never mutate the real career');
});

test('legacy automatic tutorial help stays quiet while explicit help choices survive replay and completion', () => {
  const old = tutorial();
  old.career.assists.layoutRevision = 3;
  old.career.assists.controlsHelp = true;
  delete old.career.assists.manual;
  const restored = decode(encode(old));
  assert(!assist(restored, 'controlsHelp'));
  assert(!restored.career.assists.manual.controlsHelp);
  for (const enabled of [true, false]) {
    const w = careerWorld();
    toggleAssist(w, 'controlsHelp');
    if (!enabled) toggleAssist(w, 'controlsHelp');
    const replay = careerWorld(createTrainingCareer(w.career));
    assert.equal(assist(replay, 'controlsHelp'), enabled);
  }
  for (const skipped of [true, false]) {
    const w = tutorial();
    toggleAssist(w, 'controlsHelp');
    toggleAssist(w, 'sounder');
    setPreset(w, 'off');
    const context = { world: w, persist: () => ({ ok: true }) };
    createSessionHooks({}, context).finishIntro(skipped);
    assert.equal(context.world.career.assists.preset, 'off');
    setPreset(context.world, 'custom');
    assert(assist(context.world, 'controlsHelp') && assist(context.world, 'sounder'));
    assert.equal(context.world.career.day, 1);
    assert.equal(context.world.career.cash, 20000);
    assert.equal(context.world.catch, 0);
  }
});

test('inactive legacy tutorial preset slots lose only automatic help before completion', () => {
  for (const skipped of [true, false]) {
    const c = createCareer(31);
    c.intro = { status: 'active', step: 7, helpInitialized: true };
    c.assists = previousPreset('off', 3);
    c.assistPresets = {
      easy: { ...previousPreset('easy', 3), controlsHelp: true },
      realistic: {
        ...previousPreset('realistic', 3),
        controlsHelp: true,
        manual: { controlsHelp: true },
      },
      custom: {
        ...previousPreset('easy', 3),
        preset: 'custom',
        controlsHelp: true,
        sounder: true,
      },
    };
    const context = { world: careerWorld(c), persist: () => ({ ok: true }) };
    createSessionHooks({}, context).finishIntro(skipped);
    setPreset(context.world, 'easy', { restore: true });
    assert(!assist(context.world, 'controlsHelp'), 'old auto-help is not a deliberate opt-in');
    setPreset(context.world, 'realistic', { restore: true });
    assert(assist(context.world, 'controlsHelp'), 'explicit saved opt-in survives');
    setPreset(context.world, 'custom');
    assert(!assist(context.world, 'controlsHelp'));
    assert(assist(context.world, 'sounder'), 'unrelated legacy Custom choice survives');
  }
});

test('saving an unchanged tutorial layout leaves preferences untouched and showing one row opts in only that row', () => {
  const w = tutorial(),
    before = structuredClone(w.career.assists),
    previousDocument = globalThis.document;
  globalThis.document = { getElementById: () => null };
  try {
    const editor = Object.create(LayoutEditor.prototype);
    Object.assign(editor, {
      syncViewport() {},
      orientationDrafts: new Map(),
      manager: { windows: new Map(), save() {} },
      ui: { hooks: { world: () => w }, back() {} },
      rows: gauges.map((key) => ({
        id: key,
        key,
        allowed: true,
        enabled: assist(w, key),
        presentation: 'graphic',
      })),
    });
    editor.save();
    assert.deepEqual(w.career.assists, before);
    editor.rows.find((row) => row.key === 'fuelGauge').enabled = true;
    editor.save();
    assert(assist(w, 'fuelGauge'));
    for (const key of gauges.filter((key) => key !== 'fuelGauge')) assert(!assist(w, key), key);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('equipment preparation resolves keyboard, remapped gamepad and touch controls without fixed stick assumptions', () => {
  const w = careerWorld(
    createTrainingCareer(createCareer(17), { boatId: 'twinjet', equipment: ['bowthruster'] }),
  );
  const input = Object.create(Input.prototype);
  input.map = structuredClone(DEFAULTS);
  input.map.thrustPort = ['KeyJ', 'b4'];
  input.map.thrustStarboard = ['KeyL', 'b5'];
  input.map.pivotPort = ['KeyU', 'b6'];
  input.map.pivotStarboard = ['KeyI', 'b7'];
  input.faceNames = {};
  for (const device of ['keyboard', 'gamepad', 'touch']) {
    input.lastDevice = device;
    for (const [title, actions] of [
      ['Your Channel Master', ['throttleUp', 'throttleDown', 'left', 'right', 'neutral']],
      ['Bow thruster', ['neutral', 'thrustPort', 'thrustStarboard']],
      ['Twin-jet pivot', ['neutral', 'pivotPort', 'pivotStarboard']],
    ]) {
      w.career.intro.prepIndex = trainingLessons(w).findIndex(([name]) => name === title);
      assert(w.career.intro.prepIndex >= 0, title);
      const text = lesson(w, { input })[1];
      for (const action of actions)
        assert(text.includes(input.label(action)), `${device}/${action}: ${text}`);
      assert.doesNotMatch(text, /\{\w+\}|Unbound|left stick sideways|right stick up\/down/i);
    }
  }
  for (const boatId of ['outboard', 'sterndrive']) {
    const practice = careerWorld(createTrainingCareer(createCareer(17), { boatId }));
    assert.match(trainingLessons(practice)[0][1], /reverse turns follow the thrust direction/);
  }
});
