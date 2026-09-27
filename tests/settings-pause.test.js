import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { presetAssists } from '../src/assists.js';
import { setPreset } from '../src/assists.js';
import { touchOptionsActions } from '../src/touch-options.js';
import { careerActions } from '../src/career-actions.js';
import { createCareer } from '../src/career-state.js';
import { careerWorld } from '../src/career-save.js';
import { choices } from '../src/screen-actions.js';
import { expeditionActions } from '../src/expedition-actions.js';

function menuSetup(screen = 'settings') {
  const w = careerWorld(createCareer(91));
  const ui = {
    screen,
    index: 0,
    revealUrchins: false,
    input: { touchEnabled: false },
    touch: { setEnabled() {} },
    hooks: {
      world: () => w,
      audio: { volume: 0.35, setVolume() {} },
      save() {},
    },
    open() {},
    back() {},
    exit() {},
  };
  return { ui, w };
}

test('actual-game Easy UI starts with Controls Help off', () => {
  assert.equal(presetAssists('easy').controlsHelp, false);
});

test('new and reset Easy careers hide Controls Help while deliberate choices persist', () => {
  const fresh = careerWorld(createCareer(92));
  assert.equal(fresh.career.assists.controlsHelp, false);

  fresh.career.assists.controlsHelp = false;
  setPreset(fresh, 'easy');
  assert.equal(fresh.career.assists.controlsHelp, false);

  const legacy = createCareer(93);
  legacy.assists = { version: 1, preset: 'easy' };
  assert.equal(careerWorld(legacy).career.assists.controlsHelp, false);

  const customized = createCareer(94);
  customized.assists = { version: 2, preset: 'custom', base: 'easy', controlsHelp: false };
  assert.equal(careerWorld(customized).career.assists.controlsHelp, false);
});

test('Settings organization and scale submenus match the navigation contract', () => {
  const { ui, w } = menuSetup();
  const settings = careerActions(ui, w);
  assert.deepEqual(
    settings.slice(0, 7).map((action) => [action.id, action.label]),
    [
      ['layout', 'Arrange UI layout'],
      ['assists', 'UI / difficulty options'],
      ['controller', 'Controller setup'],
      ['bindings', 'Controller Remapping'],
      ['ui-scale', 'UI Scale'],
      ['touch-options', 'Touchscreen Options'],
      ['gameplay-speed', 'Gameplay Speed'],
    ],
  );
  assert(
    !settings.some((action) =>
      ['help', 'workshop', 'fit-screen', 'touchscreen', 'touch-scale'].includes(action.id),
    ),
  );
  assert(choices.call({ ...ui, screen: 'pause' }, w).includes('Touchscreen Options'));

  ui.screen = 'ui-scale';
  assert.deepEqual(
    careerActions(ui, w).map((action) => action.id),
    ['ui-smaller', 'ui-larger', 'ui-reset', 'back'],
  );
  ui.screen = 'touch-options';
  assert.deepEqual(
    touchOptionsActions(ui).map((action) => action.id),
    [
      'touchscreen',
      'tiny-touch',
      'touch-smaller',
      'touch-larger',
      'touch-fainter',
      'touch-solid',
      'touch-reset',
      'touch-adjust',
      'touch-hud',
      'back',
    ],
  );
  ui.screen = 'gameplay-speed';
  assert.deepEqual(
    careerActions(ui, w).map((action) => action.id),
    ['time-slower', 'time-faster', 'back'],
  );
});

test('career pause puts Debug directly below reveal and keeps skipper references in Skipper Stuff', () => {
  const { ui, w } = menuSetup('pause');
  w.day.phase = 'working';
  const pause = choices.call(ui, w);
  assert.equal(pause[2], 'Debug mode');
  assert.equal(pause[3], 'Arrange UI layout');
  assert.equal(pause.at(-1), 'Return to Title Screen');
  assert(pause.includes('Skipper Stuff'));
  for (const removed of [
    'Return to harbour · route guidance',
    'Radio history',
    'Diver instructions',
    'Chart knowledge',
    'Weather outlook',
    'Coastal chart',
  ])
    assert(!pause.includes(removed), removed);

  ui.screen = 'skipper-stuff';
  assert.deepEqual(choices.call(ui, w), [
    'Radio',
    'Diver',
    'Local Chart',
    'Weather',
    'Coastal Chart',
    'Back / Close',
  ]);
});

test('departure menus consistently call the knowledge screen Local Chart', () => {
  const { ui, w } = menuSetup('departure');
  ui.chartGroundId = 'near';
  assert.equal(
    expeditionActions(ui, w).find((action) => action.id === 'knowledge').label,
    'Local Chart',
  );
});
