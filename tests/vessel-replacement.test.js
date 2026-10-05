import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, nextCareerDay, encode, decode } from '../src/career-save.js';
import {
  createCareer,
  buyVessel,
  useVessel,
  departureReady,
  serviceBoat,
} from '../src/career-state.js';
import { chooseFirstBoat } from '../src/starter-career.js';
import { chooseGround, requestRescue } from '../src/day.js';
import { FLEET, ECONOMY } from '../src/career-data.js';

function afterLoss(id) {
  const w = careerWorld(createCareer(171709, { chooseStarter: true }));
  assert(chooseFirstBoat(w, id).ok);
  assert.equal(w.career.cash, 5000);
  assert(chooseGround(w, 'near').ok);
  // Stage catastrophic damage, then use the real rescue, insurance and next-day path.
  Object.assign(w.boat, { hullHealth: 0, driveHealth: 0.4, fuel: 37, sinking: true });
  w.emergency = { mandatoryRescue: true, reason: 'Vessel sinking' };
  const rescue = requestRescue(w);
  assert(rescue.ok);
  assert.equal(rescue.career.insurance, FLEET[id].price * ECONOMY.insuranceCover);
  const next = nextCareerDay(decode(encode(w)));
  assert.match(departureReady(next), /Vessel lost/);
  return next;
}

for (const id of ['basic', 'outboard'])
  test(`${id}: replacing the active wreck buys a fresh seaworthy vessel through rescue, reload and departure`, () => {
    const w = afterLoss(id),
      cash = w.career.cash;
    assert(buyVessel(w, id).ok);
    assert.equal(w.career.cash, cash - FLEET[id].price);
    assert.equal(w.boat.hullHealth, 1);
    assert.equal(w.boat.driveHealth, 1);
    assert.equal(w.boat.fuel, FLEET[id].fuelCapacity);
    assert.equal(w.boat.sinking, false);
    assert.equal(w.career.fleet[id].lost, false);
    assert.equal(departureReady(w), '');

    const restored = decode(encode(w)),
      paidCash = restored.career.cash;
    assert.deepEqual(restored.career.fleet[id], w.career.fleet[id]);
    assert.equal(restored.boat.hullHealth, 1);
    assert.equal(restored.boat.driveHealth, 1);
    assert.equal(restored.boat.fuel, FLEET[id].fuelCapacity);
    assert(buyVessel(restored, id).ok, 'Repeated purchase selects the now-owned vessel');
    assert.equal(restored.career.cash, paidCash, 'The replacement is charged only once');
    assert(chooseGround(restored, 'near').ok, 'The replacement can actually sail');
    assert.equal(restored.day.phase, 'working');
    assert.equal(restored.day.insurancePaid, ECONOMY.insuranceDaily);
  });

test('a different replacement keeps the old wreck recorded and repeated owned selection never refills or repairs', () => {
  const w = afterLoss('basic'),
    old = structuredClone(w.career.fleet.basic),
    cash = w.career.cash;
  assert(buyVessel(w, 'outboard').ok);
  assert.equal(w.career.cash, cash - FLEET.outboard.price);
  assert.deepEqual(w.career.fleet.basic, old);
  assert.equal(w.boat.hullHealth, 1);
  assert.equal(w.boat.driveHealth, 1);
  assert.equal(w.boat.fuel, FLEET.outboard.fuelCapacity);
  Object.assign(w.boat, { hullHealth: 0.83, driveHealth: 0.72, fuel: 123 });
  assert(buyVessel(w, 'outboard').ok);
  assert.equal(w.career.cash, cash - FLEET.outboard.price);
  assert.equal(w.boat.hullHealth, 0.83);
  assert.equal(w.boat.driveHealth, 0.72);
  assert.equal(w.boat.fuel, 123);
  assert.equal(departureReady(w), '');
  assert(!useVessel(w, 'basic').ok, 'A different purchase does not revive the old wreck');
});

test('switching owned vessels retains their separate fuel, damage and paid repair state', () => {
  const w = careerWorld();
  Object.assign(w.boat, { hullHealth: 0.84, driveHealth: 0.77, fuel: 123 });
  assert(buyVessel(w, 'outboard').ok);
  Object.assign(w.boat, { hullHealth: 0.92, driveHealth: 0.89, fuel: 234 });
  assert(useVessel(w, 'basic').ok);
  assert.equal(w.boat.hullHealth, 0.84);
  assert.equal(w.boat.driveHealth, 0.77);
  assert.equal(w.boat.fuel, 123);
  assert(serviceBoat(w, 'repair').ok);
  const cash = w.career.cash;
  assert(useVessel(w, 'outboard').ok);
  assert.equal(w.boat.hullHealth, 0.92);
  assert.equal(w.boat.driveHealth, 0.89);
  assert.equal(w.boat.fuel, 234);
  assert(useVessel(w, 'basic').ok);
  assert.equal(w.boat.hullHealth, 1);
  assert.equal(w.boat.driveHealth, 1);
  assert.equal(w.boat.fuel, 123, 'Repairs do not refuel the vessel');
  assert.equal(w.career.cash, cash, 'Switching owned boats does not charge again');
});
