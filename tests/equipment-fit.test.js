import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCareer,
  buyEquipment,
  freshVessel,
  useVessel,
  chargeTransit,
} from '../src/career-state.js';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { FLEET_ORDER, UPGRADES, RANKS } from '../src/career-data.js';
import { boatSpec } from '../src/boats.js';
import { stepBoat } from '../src/boat.js';
import { equipmentAvailability, equipmentPreview } from '../src/equipment-fit.js';
import { toggleEquipment } from '../src/equipment-controls.js';
import { groundTrip } from '../src/day.js';
import { fuelPlan } from '../src/preparation.js';
import { shopActions } from '../src/shop-actions.js';

function funded() {
  const w = careerWorld(createCareer(971));
  w.career.cash = 1000000;
  return w;
}
test('all compatible fittings coexist on every career hull and persist by boat', () => {
  const w = funded();
  w.career.xp = 12000;
  for (const boat of FLEET_ORDER) {
    w.career.cash = 1000000;
    w.career.fleet[boat] ??= freshVessel(boat);
    assert(useVessel(w, boat).ok);
    for (const item of UPGRADES) assert(buyEquipment(w, item.id).ok, `${boat}: ${item.id}`);
    assert.equal(w.career.fleet[boat].equipment.length, UPGRADES.length);
    const cash = w.career.cash;
    assert(!buyEquipment(w, 'hoist').ok);
    assert.equal(w.career.cash, cash);
  }
  const restored = decode(encode(w));
  for (const boat of FLEET_ORDER)
    assert.deepEqual(restored.career.fleet[boat].equipment, w.career.fleet[boat].equipment);
});
test('bag hauler is accessible on day one; specialist supplier requirements are explicit', () => {
  const w = funded();
  assert(buyEquipment(w, 'hoist').ok);
  const nitrox = UPGRADES.find((item) => item.id === 'nitrox');
  const status = equipmentAvailability(w, nitrox);
  assert(!status.ok);
  assert.match(status.reason, /Coastal skipper.*0 \/ 4,500 experience/);
  const before = encode(w);
  assert(!buyEquipment(w, 'nitrox').ok);
  assert.equal(encode(w), before);
  const buy = shopActions({ screen: 'outfit', equipmentCandidate: 'nitrox' }, w).find(
    (action) => action.id === 'buy-selected',
  );
  assert(buy.disabled);
  w.career.xp = RANKS[2].xp;
  assert(buyEquipment(w, 'nitrox').ok);
});
test('engine and fuel management affect real underway consumption, acceleration and passage quotes consistently', () => {
  const stock = funded(),
    upgraded = funded();
  assert(buyEquipment(upgraded, 'engine').ok);
  assert(buyEquipment(upgraded, 'fuel-system').ok);
  const baseline = boatSpec(stock),
    effective = boatSpec(upgraded);
  assert(Math.abs(effective.maxSpeed / baseline.maxSpeed - 1.15) < 1e-10);
  assert(Math.abs(effective.acceleration / baseline.acceleration - 1.2) < 1e-10);
  assert(Math.abs(effective.travelBurn / baseline.travelBurn - 1.18 * 0.88) < 1e-10);
  for (const key of ['length', 'width', 'mass', 'draft', 'reverseSpeed', 'rudderEffectiveness'])
    assert.equal(effective[key], baseline[key], key);
  for (const w of [stock, upgraded]) {
    w.terrain.depths = w.terrain.depths.slice().fill(30);
    w.debris = [];
    w.environment.current = { x: 0, y: 0 };
    w.environment.wind = { x: 0, y: 0 };
    w.environment.waves = 0;
    Object.assign(w.boat, { x: 250, y: 250, vx: 0, vy: 0, throttle: 1 });
    for (let frame = 0; frame < 60; frame++) stepBoat(w, {}, 1 / 60);
  }
  assert(upgraded.boat.speed > stock.boat.speed * 1.15);
  assert(upgraded.boat.fuelUsed > stock.boat.fuelUsed);
  const route = groundTrip(upgraded, 'middle'),
    plan = fuelPlan(upgraded, 'middle');
  assert(route.minutes < groundTrip(stock, 'middle').minutes);
  assert(Math.abs(plan.outbound - (route.minutes / 60) * effective.travelBurn) < 1e-10);
  const fuel = upgraded.boat.fuel;
  chargeTransit(upgraded, route.minutes);
  assert(Math.abs(fuel - upgraded.boat.fuel - plan.outbound) < 1e-10);
});
test('loaded engine preview is truthful and inspecting never spends or changes equipment', () => {
  const w = funded();
  w.career.fleet.outboard = freshVessel('outboard');
  assert(useVessel(w, 'outboard').ok);
  w.catch = 1500;
  const saved = encode(w),
    item = UPGRADES.find((item) => item.id === 'engine');
  const preview = equipmentPreview(w, item);
  assert.equal(encode(w), saved);
  assert.equal(preview.rows[0].before, '20.0 kn');
  assert.equal(preview.rows[0].after, '23.0 kn');
  assert(buyEquipment(w, 'engine').ok);
  assert.equal(boatSpec(w).maxSpeed, preview.after.maxSpeed);
  assert(!toggleEquipment(w, 'engine').ok);
  const next = decode(encode(w));
  assert.equal(boatSpec(next).maxSpeed, boatSpec(w).maxSpeed);
});
test('fitted and switched-off states cannot be bought twice and fittings remain on their own boat', () => {
  const w = funded();
  assert(buyEquipment(w, 'lights').ok);
  assert(toggleEquipment(w, 'lights').ok);
  const item = UPGRADES.find((item) => item.id === 'lights');
  assert.match(equipmentAvailability(w, item).label, /Installed.*switched off/);
  assert(!buyEquipment(w, 'lights').ok);
  w.career.fleet.outboard = freshVessel('outboard');
  assert(useVessel(w, 'outboard').ok);
  assert(equipmentAvailability(w, item).ok);
  assert.deepEqual(w.career.fleet.outboard.equipment, []);
  assert(useVessel(w, 'basic').ok);
  assert.match(equipmentAvailability(w, item).label, /switched off/);
});
