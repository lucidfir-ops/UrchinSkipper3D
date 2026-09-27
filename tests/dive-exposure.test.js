import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, nextCareerDay, encode, decode, snapshot } from '../src/career-save.js';
import { createCareer, hireCrew, settleCareer } from '../src/career-state.js';
import { chooseGround } from '../src/day.js';
import { step } from '../src/simulation.js';
import {
  stepDiveExposure,
  diveReadiness,
  newDiveHealth,
  exposureClock,
  applyDiveInjury,
} from '../src/dive-exposure.js';
import { deploymentStatus, rediveStatus } from '../src/diver-recovery.js';
import { validateSnapshot } from '../src/save-validation.js';

function world(style = 'tables', depth = 21) {
  const w = careerWorld(createCareer(31415));
  chooseGround(w, 'near');
  w.terrain.depths = w.terrain.depths.slice().fill(depth);
  w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  w.career.trafficSettings = { rate: 0 };
  w.logs = [];
  Object.assign(w.diver, { diveStyle: style, state: 'harvesting', x: 200, y: 200 });
  return w;
}
function expose(w, minutes, surface = false) {
  w.diver.state = surface ? 'surface' : 'harvesting';
  let stopped = false;
  for (let i = 0; i < minutes * 2; i++) {
    w.day.minute += 0.5;
    const requested = stepDiveExposure(w, w.diver, 1);
    stopped = stopped || requested;
  }
  return stopped;
}
test('fictional shallow budget permits most of a day; conservative divers stop earlier at depth', () => {
  const shallow = world('conservative', 6);
  assert.equal(expose(shallow, 540), false);
  const timeToBreak = (style) => {
    const w = world(style);
    for (let minutes = 0; minutes < 100; minutes++) if (expose(w, 1)) return minutes + 1;
    return Infinity;
  };
  assert(timeToBreak('conservative') < timeToBreak('tables'));
  assert.equal(timeToBreak('reckless'), Infinity);
});
test('a table break is an actual ascent and neither fresh tanks nor bag-only redive clear exposure', () => {
  const w = world('conservative'),
    d = w.diver;
  expose(w, 84);
  d.patch = w.patches[0];
  d.x = d.patch.x;
  d.y = d.patch.y;
  d.air = 100;
  step(w, {}, 1 / 60);
  assert.equal(d.state, 'surfacing');
  assert.match(d.reason, /table break/);
  d.state = 'ready';
  assert.match(deploymentStatus(w, d).reason, /TABLE BREAK/);
  d.state = 'surface';
  d.bagHandled = true;
  // Pure readiness is independent of nearby-ground eligibility.
  assert(diveReadiness(w, d));
  assert(!rediveStatus(w, d).available);
  expose(w, 80, true);
  assert.equal(diveReadiness(w, d), '');
});
test('exposure survives reload, bag/tank changes, re-hiring and overnight; rest reduces slower strain', () => {
  const w = world();
  expose(w, 30);
  w.diver.state = 'ready';
  const h = structuredClone(w.career.people.ada.diveHealth),
    resumed = decode(encode(w));
  assert.deepEqual(resumed.career.people.ada.diveHealth, h);
  resumed.day.phase = 'planning';
  assert(hireCrew(resumed, 'nell', 0).ok);
  assert(hireCrew(resumed, 'ada', 0).ok);
  assert.deepEqual(resumed.career.people.ada.diveHealth, h);
  const next = nextCareerDay(resumed),
    rested = nextCareerDay(next);
  assert(next.career.people.ada.diveHealth.strain > 0);
  assert(next.career.people.ada.diveHealth.strain < h.strain);
  assert(rested.career.people.ada.diveHealth.strain < next.career.people.ada.diveHealth.strain);
  next.day.phase = 'working';
  next.diver.state = 'harvesting';
  stepDiveExposure(next, next.diver, 1);
  assert.equal(next.career.people.ada.diveHealth.consecutiveDays, 2);
});
test('repeated deep days increase residual strain and hazard without save-based random rerolls', () => {
  let w = world('reckless', 18);
  const strains = [],
    hazards = [];
  for (let day = 0; day < 3; day++) {
    expose(w, 165);
    const h = w.career.people.ada.diveHealth;
    strains.push(h.strain);
    hazards.push(h.hazard);
    w.diver.state = 'ready';
    w.day.phase = 'planning';
    w = nextCareerDay(decode(encode(w)));
    w.terrain.depths = w.terrain.depths.slice().fill(18);
    w.diver.diveStyle = 'reckless';
  }
  assert(strains[2] > strains[1] && strains[1] > strains[0]);
  assert(hazards[2] > hazards[1] && hazards[1] > hazards[0]);
});
test('reckless deep exposure causes one persistent DCS injury on surfacing, not an air accident', () => {
  const w = world('reckless', 28),
    d = w.diver;
  expose(w, 180);
  const h = w.career.people.ada.diveHealth;
  assert(h.pending);
  assert.equal(d.condition, 'fit');
  assert.equal(d.air, 100);
  const resumed = decode(encode(w));
  resumed.diver.state = 'surface';
  assert(applyDiveInjury(resumed, resumed.diver));
  assert.equal(applyDiveInjury(resumed, resumed.diver), false);
  assert.equal(resumed.safety.injuries, 1);
  assert.equal(resumed.career.people.ada.availableDay, 6);
  assert.equal(resumed.emergency.mandatoryRescue, false);
  const result = { value: 0, landed: 0, gross: 0, onTime: true, crew: [] };
  settleCareer(resumed, result);
  assert.equal(resumed.career.people.ada.availableDay, 6);
  assert.equal(decode(encode(resumed)).diver.condition, 'injured');
});
test('old saves initialize safely; invalid health is rejected by cheap snapshot validation', () => {
  const w = world();
  assert.equal(w.career.people.ada.diveHealth, undefined);
  stepDiveExposure(w, w.diver, 1);
  const data = snapshot(w);
  data.career.people.ada.diveHealth.load = NaN;
  assert.throws(() => validateSnapshot(data), /dive exposure/);
  const clean = newDiveHealth(w.career, 'ada', exposureClock(w));
  assert(clean.threshold > 0 && Number.isFinite(clean.threshold));
});
