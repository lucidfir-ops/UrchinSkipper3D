import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { chooseGround, requestRescue, rescueStatus } from '../src/day.js';
import { step, deploymentStatus } from '../src/simulation.js';
import { strikeDrive, collisionDamage } from '../src/propulsion.js';
import { stepLogs } from '../src/hazards.js';
function world(id) {
  const w = createWorld({ practice: true, boatId: id });
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  w.debris = [];
  Object.assign(w.environment, { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 });
  Object.assign(w.boat, { vx: 0, vy: 0 });
  return w;
}
test('a direct drive strike scales by exposed propulsion while jets remain protected', () => {
  const results = {};
  for (const id of ['basic', 'thruster', 'sterndrive', 'outboard', 'jet', 'twinjet']) {
    const w = world(id);
    strikeDrive(w, 3, 'direct drive impact');
    results[id] = w.boat.driveHealth;
    assert.equal(w.boat.hullHealth, 1);
  }
  assert(results.sterndrive < results.outboard && results.outboard < results.basic);
  assert(results.sterndrive > 0.8);
  assert(results.jet > 0.999);
  assert.equal(results.jet, results.twinjet);
});
test('contact damage is deterministic per incident and never rerolled each physics frame', () => {
  const a = world('sterndrive'),
    b = world('sterndrive');
  assert.deepEqual(strikeDrive(a, 2, 'grounding'), strikeDrive(b, 2, 'grounding'));
  const before = a.boat.driveHealth;
  for (let i = 0; i < 180; i++) {
    a.time += 1 / 60;
    strikeDrive(a, 2, 'grounding');
  }
  assert.equal(a.boat.driveHealth, before);
  const gentle = world('sterndrive');
  for (let i = 0; i < 600; i++) {
    gentle.time += 1 / 60;
    strikeDrive(gentle, 0.4, 'gentle contact');
  }
  assert.equal(gentle.boat.driveHealth, 1);
});
test('bow log contact damages hull separately; a stern strike reaches the drive; failure removes power', () => {
  const w = world('sterndrive');
  w.logs = [
    { id: 'test-log', x: 250, y: 245, heading: Math.PI / 2, length: 6, radius: 0.3, severity: 1 },
  ];
  w.boat.vy = -3;
  stepLogs(w, 1 / 60);
  assert(w.boat.hullHealth < 1);
  assert.equal(w.boat.driveHealth, 1);
  assert(w.boat.vy > -3);
  w.logs = [
    { id: 'stern-log', x: 250, y: 255, heading: Math.PI / 2, length: 6, radius: 0.3, severity: 1 },
  ];
  w.boat.vy = -3;
  stepLogs(w, 1 / 60);
  assert(w.boat.driveHealth < 1 && w.boat.driveHealth > 0.8);
  w.boat.driveHealth = 0;
  assert.match(deploymentStatus(w).reason, /PROPULSION FAILED/);
  w.logs = [];
  w.boat.vy = 0;
  w.boat.throttle = 1;
  for (let i = 0; i < 120; i++) step(w, {}, 1 / 60);
  assert(Math.abs(w.boat.speed) < 0.001);
  const ground = world('sterndrive'),
    { size, spacing, depths } = ground.terrain,
    n = size / spacing + 1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) depths[y * n + x] = (y * spacing - 200) * 0.2;
  Object.assign(ground.boat, { y: 216, vy: -3, throttle: 1 });
  for (let i = 0; i < 120 && !ground.boat.grounded; i++) step(ground, {}, 1 / 60);
  assert(ground.boat.grounded);
  assert.equal(ground.boat.hullHealth, 1);
  assert.equal(ground.boat.driveHealth, 1);
});
test('gentle timber yields without damage and obstacle severity controls high-speed hull loss', () => {
  const slow = world('sterndrive');
  slow.boat.vy = -0.4;
  slow.logs = [{ x: 250, y: 245, heading: Math.PI / 2, length: 6, radius: 0.3, severity: 1 }];
  const y = slow.logs[0].y;
  for (let i = 0; i < 90; i++) step(slow, {}, 1 / 60);
  assert.equal(slow.boat.hullHealth, 1);
  assert.equal(slow.boat.driveHealth, 1);
  assert(slow.logs[0].y < y);
  const stick = world('jet'),
    large = world('jet');
  collisionDamage(stick, { speed: 7.7, severity: 0.12, cause: 'stick' });
  collisionDamage(large, { speed: 7.7, severity: 2.4, cause: 'large log' });
  assert(stick.boat.hullHealth > 0.94);
  assert.equal(large.boat.hullHealth, 0);
  assert(large.boat.sinking && large.emergency.mandatoryRescue);
  assert.equal(large.boat.driveHealth, 1);
});
test('rescue accounts for both divers and catch, adds time/costs, and settles only once', () => {
  const w = createWorld({ boatId: 'sterndrive' });
  chooseGround(w, 'middle');
  w.boat.driveHealth = 0;
  w.day.minute = 1020;
  w.catch = 100;
  w.bags = [{ weight: 100, quality: 0.9, harvestMinute: 900 }];
  Object.assign(w.divers[0], { state: 'harvesting', bag: 180, qualitySum: 144, bagHandled: false });
  Object.assign(w.divers[1], { state: 'surface', bag: 300, qualitySum: 270, bagHandled: false });
  assert(rescueStatus(w).available);
  const result = requestRescue(w);
  assert(result.ok);
  assert.equal(result.gross, 580);
  assert.equal(w.day.phase, 'complete');
  assert.equal(result.arrival, 1230);
  assert(!result.onTime);
  assert(w.divers.every((d) => d.state === 'ready' && d.air === 100 && d.bag === 0));
  assert.equal(w.catch, 0);
  assert.equal(result.costs.rescue, 350);
  assert(result.netValue < result.value);
  const serialized = JSON.stringify(w);
  assert(!requestRescue(w).ok);
  assert.equal(JSON.stringify(w), serialized);
  assert(!rescueStatus(world('basic')).available);
});
test('failed propulsion cannot use abstract sector travel to bypass the rescue consequence', () => {
  const w = createWorld({ boatId: 'sterndrive' });
  chooseGround(w, 'near');
  w.boat.driveHealth = 0;
  const before = JSON.stringify(w);
  assert(!chooseGround(w, 'far').ok);
  assert.equal(JSON.stringify(w), before);
});
