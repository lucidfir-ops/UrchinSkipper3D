import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { createCareer, freshVessel, useVessel } from '../src/career-state.js';
import { boatSpec } from '../src/boats.js';
import { CREW } from '../src/career-data.js';
import {
  presetAssists,
  setPreset,
  toggleInformation,
  toggleAssist,
  normalizeAssists,
  REALISTIC_ASSISTS,
} from '../src/assists.js';
import { expeditionActions } from '../src/expedition-actions.js';
import { migrateInputProfile } from '../src/input-profiles.js';
import { DEFAULTS } from '../src/input.js';
import { portrait } from '../src/crew-portrait.js';

test('Island Tender specification interpolates 25/20/15 knots at empty/half/full load', () => {
  const w = careerWorld();
  w.career.fleet.outboard = freshVessel('outboard');
  useVessel(w, 'outboard');
  for (const [load, knots] of [
    [0, 25],
    [1500, 20],
    [3000, 15],
  ]) {
    w.catch = load;
    assert(Math.abs(boatSpec(w).maxSpeed * 1.943844 - knots) < 1e-9);
  }
});

test('Realistic career never cycles into Easy and preserves its custom information slot', () => {
  const c = createCareer();
  c.difficulty = 'realistic';
  c.assists = presetAssists('realistic');
  const w = careerWorld(c);
  for (const key of REALISTIC_ASSISTS)
    assert.equal(c.assists[key], presetAssists('realistic')[key]);
  toggleAssist(w, 'diverIndicators');
  assert(!c.assists.diverIndicators && c.assists.diverPortraits);
  const custom = structuredClone(c.assists);
  assert.equal(toggleAssist(w, 'groundDots'), false);
  assert.equal(setPreset(w, 'easy'), false);
  toggleInformation(w);
  assert.equal(c.assists.preset, 'off');
  assert(!Object.values(c.assists).includes(true));
  const resumed = decode(encode(w));
  toggleInformation(resumed);
  assert.deepEqual(resumed.career.assists, custom);
  const actions = expeditionActions({ screen: 'assists', back() {} }, resumed);
  assert(!actions.some((a) => a.id === 'easy' || a.id === 'assist-groundDots'));
});

test('legacy Medium becomes Realistic and old Realistic becomes All Off without changing saves in place', () => {
  for (const [old, next] of [
    ['medium', 'realistic'],
    ['realistic', 'off'],
  ]) {
    const c = { assists: { preset: old, groundDots: false, chartGrounds: old === 'medium' } };
    normalizeAssists(c);
    assert.equal(c.assists.preset, next);
    if (next === 'realistic')
      for (const key of REALISTIC_ASSISTS)
        assert.equal(c.assists[key], presetAssists('realistic')[key]);
    const once = structuredClone(c);
    normalizeAssists(c);
    assert.deepEqual(c, once);
  }
});

test('unmodified R3 orders migrates to assists, explicit R3 custom commands retain ownership', () => {
  const valid = () => true,
    overlap = () => true;
  const map = structuredClone(DEFAULTS);
  delete map.assists;
  map.quickOrders = ['KeyO', 'b11'];
  let profile = migrateInputProfile({ map, explicit: [] }, DEFAULTS, valid, overlap, true);
  assert(profile.map.assists.includes('b11'));
  assert(!profile.map.quickOrders.includes('b11'));
  profile = migrateInputProfile({ map, explicit: ['quickOrders'] }, DEFAULTS, valid, overlap, true);
  assert(profile.map.quickOrders.includes('b11'));
  assert(!profile.map.assists.includes('b11'));
  assert.deepEqual(profile.map.work, map.work);
  assert.deepEqual(profile.map.recoverDiver, map.recoverDiver);
});

test('authored diver ability hints stay concise and safe for crew detail markup', () => {
  for (const diver of CREW) {
    assert(diver.bio.length >= 50 && diver.bio.length <= 200, `${diver.name}: ${diver.bio.length}`);
    assert(!/[<>]/.test(diver.bio), `${diver.name} bio must not contain markup`);
    assert.match(diver.portraitSrc, /^\.\/assets\/crew\/[a-z]+\.png$/);
  }
});

test('authored portrait markup uses its stable image while generated divers retain the vector fallback', () => {
  assert.match(portrait(CREW[0]), /assets\/crew\/ada\.png/);
  assert.match(portrait({ name: 'Generated Diver', colour: '#123456' }), /<svg/);
});

test('portrait rendering contains identity only, even when given a live diver', () => {
  const markup = portrait({
    name: 'Ada',
    colour: '#987654',
    state: 'harvesting',
    air: 37,
    bag: 123,
    fatigue: 0.4,
  });
  assert(markup.includes('Ada'));
  assert(!/harvesting|air|bag|fatigue|123/.test(markup));
});
