import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultHudRect } from '../src/hud-defaults.js';
import { boatCardFallbacks } from '../src/hud-view.js';
import { presetAssists } from '../src/assists.js';
import { defaultSeaSpeechRect } from '../src/sea-messages.js';

const overlap = (a, b) =>
  a.left < b.left + b.width &&
  a.left + a.width > b.left &&
  a.top < b.top + b.height &&
  a.top + a.height > b.top;

test('desktop instrument shelf and crew/navigation stations keep the working water and keyboard dock clear', () => {
  for (const [width, height, dockTop] of [
    [1280, 800, 646],
    [844, 390, 282],
  ]) {
    const ids = [
      'helmPanel',
      'timepiecePanel',
      'depthInstrumentPanel',
      'throttlePanel',
      'speedPanel',
      'fuelPanel',
      'loadPanel',
      'diverPanel',
      'electronics',
      'navigation',
      'almanacPanel',
      'currentReadout',
      'minimapPanel',
      'message',
      'groundLegend',
    ];
    const windows = ids.map((id) => ({ id, ...defaultHudRect(id, width, height, false) }));
    for (const window of windows) {
      assert(
        window.top + window.height <= dockTop,
        `${width}: ${window.id} covers keyboard controls`,
      );
      assert(
        window.left >= 0 && window.left + window.width <= width,
        `${width}: ${window.id} exceeds viewport`,
      );
      for (const other of windows) {
        if (window.id < other.id)
          assert(!overlap(window, other), `${width}: ${window.id} overlaps ${other.id}`);
      }
    }
  }
});

test('phone tutorial keeps the following boat visible and lesson above measured touch controls', () => {
  const width = 390,
    height = 844,
    controlsTop = 550;
  const rect = (id) => defaultHudRect(id, width, height, true, true, controlsTop);
  const boat = { left: width / 2 - 32, top: height * 0.385 - 60, width: 64, height: 120 };
  for (const id of ['frankAboard', 'help', 'helmPanel', 'minimapPanel', 'loadPanel']) {
    assert(!overlap(rect(id), boat), `${id} covers the tutorial boat`);
    assert(rect(id).top + rect(id).height < controlsTop, `${id} covers touch controls`);
  }
  assert(!overlap(rect('frankAboard'), rect('help')));
  const divers = rect('diverPanel');
  assert.equal(divers.top + divers.height, height - 4);
  assert.equal(divers.height, 60);
});

test('compact keyboard tutorial keeps crew clear of Frank, the boat and the visible keyboard dock', () => {
  const width = 844,
    height = 390,
    crew = defaultHudRect('diverPanel', width, height, false, true),
    frank = defaultHudRect('frankAboard', width, height, false, true),
    original = defaultHudRect('diverPanel', width, height, false),
    boat = { left: 384, top: 128, width: 76, height: 126 },
    dock = { left: 8, top: 282, width: width - 16, height: 108 };
  assert.equal(crew.width, original.width);
  assert.equal(crew.height, original.height);
  for (const [name, rect] of [
    ['Frank', frank],
    ['boat', boat],
    ['keyboard dock', dock],
  ])
    assert(!overlap(crew, rect), `crew overlaps ${name}`);
  assert(crew.left >= 0 && crew.left + crew.width <= width);
});

test('short touch career speech uses the free port gap without moving other speech defaults', () => {
  const rect = { ...defaultSeaSpeechRect(844, 390, true), height: 88 };
  for (const [name, obstacle] of [
    ['boat and nearby float', { left: 350, top: 90, width: 132, height: 162 }],
    ['instrument shelf', { left: 140, top: 6, width: 460, height: 76 }],
    ['port thumb control', { left: 64, top: 188, width: 86, height: 88 }],
  ])
    assert(!overlap(rect, obstacle), `speech overlaps ${name}`);
  assert.deepEqual(defaultSeaSpeechRect(844, 390, false), { left: 182, top: 132, width: 480 });
  assert.deepEqual(defaultSeaSpeechRect(390, 844, true), { left: 10, top: 126, width: 370 });
});

test('chosen tutorial instruments stay clear of Frank and the followed boat at all review sizes', () => {
  for (const [width, height, touch, boatTop, controlsTop] of [
    [1280, 800, false, 300, 646],
    [390, 844, true, 265, 550],
    [844, 390, true, 56, 224],
    [844, 390, false, 100, 272],
  ]) {
    const chosen = ['timepiecePanel', 'clock', 'electronics'],
      shelf = ['timepiecePanel'],
      boat = { left: width / 2 - 38, top: boatTop, width: 76, height: 194 },
      rect = (id) =>
        defaultHudRect(
          id,
          width,
          height,
          touch,
          true,
          controlsTop,
          shelf,
          false,
          false,
          undefined,
          chosen,
        ),
      lesson = rect('frankAboard');
    for (const id of chosen) {
      const panel = rect(id);
      assert(!overlap(panel, lesson), `${width}: ${id} overlaps Frank`);
      assert(!overlap(panel, boat), `${width}: ${id} covers the followed boat`);
      if (!touch && height < 560)
        assert(!overlap(panel, rect('diverPanel')), `${width}: ${id} overlaps the crew station`);
      assert(panel.left >= 0 && panel.left + panel.width <= width);
      assert(panel.top + panel.height < controlsTop);
      for (const other of chosen)
        if (id < other) assert(!overlap(panel, rect(other)), `${width}: ${id}/${other}`);
    }
    assert(!overlap(lesson, boat), `${width}: Frank covers the followed boat`);
    if (width < height) {
      const customizedShelf = defaultHudRect(
        'frankAboard',
        width,
        height,
        touch,
        true,
        controlsTop,
        undefined,
        false,
        false,
        undefined,
        chosen,
      );
      assert.deepEqual(
        customizedShelf,
        lesson,
        'saved shelf geometry does not imply hidden gauges',
      );
    }
  }
});

test('boat card keeps readings available when a skipper hides independent instruments', () => {
  const world = { career: { assists: presetAssists('easy') } };
  assert.deepEqual(boatCardFallbacks(world, false), {
    speed: false,
    depth: false,
    fuel: false,
    load: false,
    condition: true,
    commands: false,
  });
  world.career.assists.speedGauge = false;
  world.career.assists.fuelGauge = false;
  world.career.assists.depthInstrument = false;
  world.career.assists.loadGauge = false;
  assert(boatCardFallbacks(world, false).speed);
  assert(boatCardFallbacks(world, false).fuel);
  assert(boatCardFallbacks(world, false).depth);
  // October 5: deck load is shown on the boat; the gauge is its only readout.
  assert.equal(boatCardFallbacks(world, false).load, false);
  world.career.assists.sounder = true;
  world.career.assists.exactLoad = false;
  assert.equal(boatCardFallbacks(world, false).depth, false);
  assert.equal(boatCardFallbacks(world, false).load, false);
  world.career.assists = presetAssists('realistic');
  for (const key of ['timepiece', 'depthInstrument', 'speedGauge', 'throttleGauge', 'fuelGauge'])
    assert(world.career.assists[key], `Realistic default: ${key}`);
  assert.equal(boatCardFallbacks(world, true).speed, false);
  assert.equal(boatCardFallbacks(world, true).fuel, false);
  assert.equal(boatCardFallbacks(world, true).commands, false);
  world.career.assists.speedGauge = false;
  world.career.assists.fuelGauge = false;
  world.career.assists.throttleGauge = false;
  assert(boatCardFallbacks(world, true).speed);
  assert(boatCardFallbacks(world, true).fuel);
  assert(boatCardFallbacks(world, true).commands);
});

test('unsaved Realistic shelf packs its enabled gauges without resizing them', () => {
  const visible = ['timepiecePanel', 'depthInstrumentPanel', 'loadPanel'];
  const rect = (id, shelf) => defaultHudRect(id, 1280, 800, false, false, undefined, shelf);
  const load = rect('loadPanel', visible),
    depth = rect('depthInstrumentPanel', visible);
  assert.equal(load.width, rect('loadPanel').width);
  assert.equal(load.left, depth.left + depth.width + 8);
  assert.equal(rect('electronics', visible).left, load.left + load.width + 8);
});

test('portrait ground key and navigation stay clear of each other and the work prompt', () => {
  const rect = (id) => defaultHudRect(id, 390, 844, true, false, 550);
  const ids = ['groundLegend', 'navigation', 'message', 'helmPanel'];
  assert(rect('groundLegend').height >= 124);
  for (const id of ids)
    for (const other of ids)
      if (id < other) assert(!overlap(rect(id), rect(other)), `${id} overlaps ${other}`);
});

test('active recovery defaults leave the followed boat and helm controls clear', () => {
  for (const { width, height, touch, boatY, controlsTop } of [
    { width: 1280, height: 800, touch: false, boatY: 400, controlsTop: 646 },
    { width: 844, height: 390, touch: false, boatY: 195, controlsTop: 282 },
    { width: 390, height: 844, touch: true, boatY: 392, controlsTop: 550 },
    { width: 844, height: 390, touch: true, boatY: 156, controlsTop: 224 },
  ]) {
    const message = defaultHudRect(
      'message',
      width,
      height,
      touch,
      false,
      controlsTop,
      undefined,
      true,
    );
    const boat = { left: width / 2 - 28, top: boatY - 61, width: 56, height: 122 };
    assert(!overlap(message, boat), `${width}: recovery prompt covers the boat`);
    assert(message.top + message.height < controlsTop, `${width}: recovery prompt covers controls`);
    assert(message.left >= 0 && message.left + message.width <= width);
  }
});

test('simple portrait recovery prompt leaves both sides of the boat visible', () => {
  const message = defaultHudRect('message', 390, 844, true, false, 550, undefined, true, true);
  assert.equal(message.height, 82);
  assert(message.top >= 454);
  assert(message.top + message.height < 550);
  for (const left of [132, 238])
    assert(!overlap(message, { left, top: 382, width: 20, height: 20 }));
});

test('desktop recovery context leaves a distant observed float clear within its middle band', () => {
  const message = defaultHudRect(
    'message',
    1280,
    800,
    false,
    false,
    undefined,
    undefined,
    true,
    false,
    { x: 532, y: 214 },
  );
  assert(!overlap(message, { left: 522, top: 204, width: 20, height: 20 }));
  assert(message.width >= 300);
  assert(message.left >= 246 && message.left + message.width <= 1042);
  assert(message.top + message.height < 330);
});
