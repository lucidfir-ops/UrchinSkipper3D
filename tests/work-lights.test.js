import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { createCareer, buyEquipment, freshVessel, useVessel } from '../src/career-state.js';
import { UPGRADES, RANKS } from '../src/career-data.js';
import { equipmentAvailability, equipmentPreview } from '../src/equipment-fit.js';
import {
  workLightMode,
  workLightsOn,
  workLightStrength,
  setWorkLightMode,
  toggleEquipment,
} from '../src/equipment-controls.js';
import { visibilityRange, pickupTolerance } from '../src/assists.js';
import { careerActions } from '../src/career-actions.js';

function world() {
  const w = careerWorld(createCareer(1072));
  w.career.cash = 50000;
  return w;
}

test('light tiers charge for increasing output and require history plus the previous fitting', () => {
  const w = world(),
    double = UPGRADES.find((item) => item.id === 'lights-double');
  assert.equal(workLightStrength(w), 0);
  assert(buyEquipment(w, 'lights').ok);
  assert.equal(w.career.cash, 48900);
  assert.equal(workLightStrength(w), 1);
  assert.match(equipmentAvailability(w, double).reason, /Working skipper/);
  assert(!buyEquipment(w, 'lights-double').ok);
  w.career.xp = RANKS[1].xp;
  const encoded = encode(w),
    preview = equipmentPreview(w, double);
  assert.equal(encode(w), encoded);
  assert.deepEqual(
    preview.rows.map((row) => row.after),
    ['200 %', '54 m'],
  );
  assert(buyEquipment(w, double.id).ok);
  assert.equal(w.career.cash, 45700);
  assert.equal(workLightStrength(w), 2);
  assert(!buyEquipment(w, 'lights-quad').ok);
  w.career.xp = RANKS[2].xp;
  assert(buyEquipment(w, 'lights-quad').ok);
  assert.equal(w.career.cash, 37200);
  assert.equal(workLightStrength(w), 4);
  assert(!toggleEquipment(w, 'lights-quad').ok);
  assert(!buyEquipment(w, 'lights-quad').ok);
  assert.equal(w.career.cash, 37200);
  w.career.fleet.outboard = freshVessel('outboard');
  assert(useVessel(w, 'outboard').ok);
  assert.match(equipmentAvailability(w, double).reason, /standard|deck and working lights/i);
  assert(!buyEquipment(w, double.id).ok);
  assert.equal(workLightStrength(w), 0);
});

test('OFF, AUTO and ON are explicit actions, work by day and night, persist and belong to the hull', () => {
  let w = world();
  assert(!setWorkLightMode(w, 'on').ok);
  assert(buyEquipment(w, 'lights').ok);
  w.weather.night = false;
  assert.equal(workLightMode(w), 'auto');
  assert(!workLightsOn(w));
  const ui = { screen: 'equipment-controls' };
  let actions = careerActions(ui, w);
  assert.deepEqual(
    actions.slice(0, 3).map((a) => a.id),
    ['switch-lights-off', 'switch-lights-auto', 'switch-lights-on'],
  );
  assert.equal(actions.find((a) => a.pressed).id, 'switch-lights-auto');
  assert(actions.find((a) => a.id === 'switch-lights-on').run().ok);
  assert(workLightsOn(w));
  assert.equal(workLightMode(w), 'on');
  w = decode(encode(w));
  w.weather.night = false;
  assert(workLightsOn(w));
  w.career.fleet.outboard = freshVessel('outboard');
  assert(useVessel(w, 'outboard').ok);
  assert(buyEquipment(w, 'lights').ok);
  assert.equal(workLightMode(w), 'auto');
  assert(useVessel(w, 'basic').ok);
  assert.equal(workLightMode(w), 'on');
  actions = careerActions(ui, w);
  assert(actions.find((a) => a.id === 'switch-lights-off').run().ok);
  assert(!workLightsOn(w));
  w.weather.night = true;
  assert(!workLightsOn(w));
  assert(setWorkLightMode(w, 'auto').ok);
  assert(workLightsOn(w));
  w.weather.night = false;
  assert(!workLightsOn(w));
  assert(!setWorkLightMode(w, 'invalid').ok);
});

test('stronger lights extend clear-weather night sight but never defeat fog or alter pickup geometry', () => {
  const w = world();
  w.career.xp = RANKS[2].xp;
  Object.assign(w.weather, { night: true, visibility: 1000 });
  const unlitPickup = pickupTolerance(w);
  assert.equal(visibilityRange(w), 16);
  assert(buyEquipment(w, 'lights').ok);
  const litPickup = pickupTolerance(w);
  assert(litPickup > unlitPickup);
  assert.equal(visibilityRange(w), 38);
  assert(buyEquipment(w, 'lights-double').ok);
  assert(Math.abs(visibilityRange(w) - 38 * Math.sqrt(2)) < 1e-9);
  assert.equal(pickupTolerance(w), litPickup);
  assert(buyEquipment(w, 'lights-quad').ok);
  assert.equal(visibilityRange(w), 76);
  w.weather.visibility = 21;
  assert.equal(visibilityRange(w), 21);
  assert(setWorkLightMode(w, 'off').ok);
  assert.equal(visibilityRange(w), 16);
  assert.equal(pickupTolerance(w), unlitPickup);
  w.weather.night = false;
  w.weather.visibility = 1000;
  assert.equal(visibilityRange(w), 1000);
});
