import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { presetAssists, normalizeAssists, toggleAssist, setPreset } from '../src/assists.js';
import { fitWindow } from '../src/layout-geometry.js';
import { WINDOWS, WINDOW_OPTIONS } from '../src/hud-windows.js';
import { UI_OPTIONS } from '../src/assist-options.js';

test('legacy UI preferences survive new independent minimap/sounder defaults and save round trips', () => {
  const w = careerWorld();
  w.career.assists = { ...presetAssists('realistic'), helmOverlay: false, diverCards: false };
  delete w.career.assists.minimap;
  delete w.career.assists.sounder;
  normalizeAssists(w.career);
  assert(w.career.assists.minimap && w.career.assists.depthInstrument && !w.career.assists.sounder);
  toggleAssist(w, 'sounder');
  assert(!w.career.assists.helmOverlay && !w.career.assists.diverCards);
  w.career.difficulty = 'realistic';
  toggleAssist(w, 'minimap');
  assert(!w.career.assists.minimap && w.career.assists.sounder);
  const loaded = decode(encode(w));
  assert.deepEqual(loaded.career.assists, w.career.assists);
  setPreset(loaded, 'off');
  assert(!loaded.career.assists.minimap && !loaded.career.assists.sounder);
  setPreset(loaded, 'custom');
  assert(!loaded.career.assists.minimap && loaded.career.assists.sounder);
});

test('layout fits within the viewport and permits the bottom strip on touch', () => {
  for (const [width, height] of [
    [1728, 1117],
    [780, 360],
    [360, 780],
  ]) {
    for (const touch of [false, true]) {
      const floor = height - 4;
      for (const rect of [
        { left: -400, top: -10, width: 200, height: 80 },
        { left: 1800, top: 900, width: 3000, height: 2000 },
        { left: 100, top: 100, width: -20, height: 0 },
      ]) {
        const fitted = fitWindow(rect, width, height, touch);
        assert(fitted.left >= 4 && fitted.top >= 4);
        assert(fitted.left + fitted.width <= width - 4);
        assert(fitted.top + fitted.height <= floor);
        assert(fitted.width >= 64 && fitted.height >= 36);
      }
    }
  }
});

test('minimap and sounder remain independently selectable in both UI options and layout windows', () => {
  for (const [panel, option] of [
    ['minimapPanel', 'minimap'],
    ['sounderPanel', 'sounder'],
  ]) {
    assert.equal(WINDOW_OPTIONS[panel], option);
    assert(Object.hasOwn(WINDOWS, panel));
    assert(Object.hasOwn(UI_OPTIONS, option));
  }
});
