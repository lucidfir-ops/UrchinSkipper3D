import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { step, setInstructions, pinActionTargets } from '../src/simulation.js';
import { recallStatus } from '../src/diver-recall.js';
import { careerWorld, nextCareerDay, encode, decode } from '../src/career-save.js';
import { assignCrew } from '../src/crew.js';
import { C } from '../src/config.js';

function calm() {
  const w = createWorld({ practice: true });
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  w.terrain.depths = w.terrain.depths.slice().fill(30);
  w.logs = [];
  w.debris = [];
  Object.assign(w.boat, { x: 232, y: 238, vx: 0, vy: 0, heading: 0 });
  return w;
}
test('nearby A recall selects physical bubbles, clangs once and waits 2–5 seconds before ascent', () => {
  const w = calm(),
    d = w.diver;
  Object.assign(d, { state: 'harvesting', patch: w.patches[0], x: 228, y: 238 });
  w.selectedDiverId = 1;
  assert(recallStatus(w).available);
  step(w, { recall: true }, 1 / 60);
  const response = d.recallAt - w.time;
  assert(response >= 2 && response <= 5);
  assert.equal(w.effects.filter((e) => e.type === 'recall').length, 1);
  step(w, { recall: true }, 1 / 60);
  assert.equal(w.effects.filter((e) => e.type === 'recall').length, 1);
  while (w.time < d.recallAt - 0.04) step(w, {}, 0.01);
  assert.equal(d.state, 'harvesting');
  for (let i = 0; i < 6 && d.state !== 'surfacing'; i++) step(w, {}, 0.01);
  assert.equal(d.state, 'surfacing');
  assert.equal(d.reason, 'Skipper recalled diver');
  assert.equal(d.timer, C.diver.warningSeconds);
});
test('a pinned recall cannot jump to another diver or reach beyond five metres from the hull', () => {
  const w = calm(),
    d = w.diver;
  Object.assign(d, { state: 'searching', x: 228, y: 238 });
  const command = pinActionTargets(w, { recall: true });
  d.x = 220;
  Object.assign(w.divers[1], { state: 'searching', x: 228, y: 238 });
  step(w, command, 1 / 60);
  assert(w.divers.every((d) => d.recallAt == null));
});
test('whole-patch exhaustion immediately starts ascent even beside another productive patch', () => {
  const w = calm(),
    d = w.diver,
    p = w.patches[0];
  p.remaining = 0.01;
  w.patches.push({ ...p, id: 'neighbour', x: p.x + 1, remaining: 1000 });
  Object.assign(d, { state: 'harvesting', patch: p, x: 228, y: 238 });
  step(w, {}, 1 / 60);
  assert.equal(d.state, 'surfacing');
  assert.equal(d.reason, 'Patch exhausted');
  assert.equal(d.patch, p);
  assert.equal(w.patches.at(-1).remaining, 1000);
});
test('20-unit reserve forces ascent without injury, death or emergency', () => {
  const w = calm(),
    d = w.diver;
  Object.assign(d, { state: 'searching', x: 228, y: 238, air: 20.001 });
  step(w, {}, 1 / 60);
  assert.equal(d.reason, 'Air reserve');
  assert.equal(d.state, 'surfacing');
  assert.equal(d.condition, 'fit');
  assert(!w.emergency);
  assert.equal(d.air, 20);
});
test('scouting defaults are 70 seconds, experienced crew get 15, and individual orders persist across days', () => {
  const w = careerWorld();
  assert.equal(w.diver.searchLimit, 70);
  w.career.crew[0] = 'inez';
  assignCrew(w);
  assert.equal(w.diver.searchLimit, 15);
  assert(setInstructions(w, 0, { direction: 3, minQuality: 0.8, searchLimit: 60 }));
  const resumed = decode(encode(w)),
    next = nextCareerDay(resumed);
  assert.equal(next.diver.searchLimit, 60);
  assert.equal(next.diver.direction, 3);
  assert.equal(next.diver.minQuality, 0.8);
  assert.equal(next.divers[1].searchLimit, 70);
});
