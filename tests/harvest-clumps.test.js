import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, visiblePatch } from '../src/world.js';
import { chooseGround } from '../src/day.js';
import { step } from '../src/simulation.js';
import { nearestClump, takeCatch } from '../src/harvest-ground.js';
function world() {
  const w = createWorld();
  chooseGround(w, 'near');
  Object.assign(w.environment, {
    model: 'uniform',
    current: { x: 0, y: 0 },
    wind: { x: 0, y: 0 },
    waves: 0,
  });
  Object.assign(w.boat, { vx: 0, vy: 0 });
  w.debris = [];
  w.logs = [];
  return w;
}
function tick(w, seconds) {
  for (let i = 0; i < seconds * 60; i++) step(w, {}, 1 / 60);
}
test('each lab area has distributed, independently stocked clumps conserving its 1,000 lb total', () => {
  const w = world();
  for (const p of w.patches.filter((p) => p.rate)) {
    assert.equal(p.clumps.length, 9);
    assert(Math.abs(p.clumps.reduce((s, c) => s + c.remaining, 0) - 1000) < 0.000001);
    assert(p.clumps.every((c) => c.remaining > 80 && c.remaining < 140));
  }
});
test('a productive diver depletes local clumps and walks through an area to fill a good bag', () => {
  const w = world(),
    d = w.diver,
    p = w.patches.find((p) => p.id === 'good');
  step(w, { recoverDiver: true }, 1 / 60);
  let first = null,
    distance = 0,
    last = null;
  const visited = new Set();
  for (let i = 0; i < 70 * 60 && d.state !== 'surfacing'; i++) {
    step(w, {}, 1 / 60);
    if (d.clump) visited.add(d.clump.id);
    if (d.state === 'harvesting' && !first) first = { x: d.x, y: d.y };
    if (first && last) distance += Math.hypot(d.x - last.x, d.y - last.y);
    last = { x: d.x, y: d.y };
  }
  assert.equal(d.reason, 'Bag full');
  assert.equal(Math.round(d.bag), 300);
  assert(visited.size >= 3);
  assert(p.clumps.filter((c) => c.remaining < 0.001).length >= 2);
  assert(distance > 5);
  assert(Math.abs(d.harvestTime - 30) < 0.08);
  assert(d.diveTime < 50, 'travel adds a modest amount to the established 30s picking clock');
  assert(Math.abs(p.remaining - 700) < 0.00001);
  assert(Math.abs(p.clumps.reduce((sum, c) => sum + c.remaining, 0) - p.remaining) < 0.00001);
});
test('two divers sharing a clump cannot duplicate its catch and choose another after exhaustion', () => {
  const w = world(),
    p = w.patches.find((p) => p.id === 'good'),
    c = p.clumps[4],
    stock = p.remaining;
  for (const d of w.divers)
    Object.assign(d, { state: 'harvesting', patch: p, clump: c, x: c.x, y: c.y });
  tick(w, 15);
  const caught = w.divers.reduce((s, d) => s + d.bag, 0);
  assert.equal(c.remaining, 0);
  assert(Math.abs(stock - p.remaining - caught) < 0.000001);
  assert(w.divers.every((d) => d.clump !== c));
  assert(caught > c.initialStock);
});
test('quality instructions still filter clumped ground, including a nearby richer alternative', () => {
  const w = world(),
    p = w.patches.find((p) => p.id === 'poor'),
    d = w.diver;
  Object.assign(d, { state: 'searching', x: p.x, y: p.y, minQuality: 0.9 });
  assert.equal(visiblePatch(w, d), null);
  tick(w, 3);
  assert.equal(d.bag, 0);
  const rich = w.patches.find((p) => p.id === 'good');
  Object.assign(d, { x: rich.x, y: rich.y });
  assert.equal(visiblePatch(w, d), rich);
  tick(w, 1);
  assert(d.bag > 0);
});
test('depleted stock and clumps persist when returning to a sector; new days reset them', () => {
  const w = world(),
    p = w.patches.find((p) => p.id === 'good'),
    c = nearestClump(p, p.x, p.y);
  const taken = takeCatch(p, c, 80);
  chooseGround(w, 'far');
  chooseGround(w, 'near');
  assert.equal(
    w.patches.find((p) => p.id === 'good'),
    p,
  );
  assert.equal(p.remaining, 1000 - taken);
  assert(c.remaining < c.initialStock);
  const fresh = world().patches.find((p) => p.id === 'good');
  assert.equal(fresh.remaining, 1000);
  assert(fresh.clumps.every((c) => c.remaining === c.initialStock));
});
test('a well-placed fast-ground deployment supports three full clumped bags on one 100-unit tank', () => {
  const w = world();
  chooseGround(w, 'near', { patchId: 'q90-fast' });
  Object.assign(w.environment, {
    model: 'uniform',
    current: { x: 0, y: 0 },
    wind: { x: 0, y: 0 },
    waves: 0,
  });
  Object.assign(w.boat, { vx: 0, vy: 0 });
  w.logs = [];
  // Deliberate placement over productive stock avoids an unnecessary initial search.
  const start = w.patches.find((p) => p.id === 'q90-fast').clumps[4];
  Object.assign(w.boat, { x: start.x + 4, y: start.y, heading: 0 });
  const d = w.diver;
  step(w, { recoverDiver: true }, 1 / 60);
  for (let bag = 0; bag < 3; bag++) {
    for (let i = 0; i < 100 * 60 && d.state !== 'surface'; i++) step(w, {}, 1 / 60);
    assert.equal(Math.round(d.bag), 300, `bag ${bag + 1}`);
    const air = d.air;
    Object.assign(w.boat, {
      x: d.x + 4,
      y: d.y,
      heading: 0,
      vx: 0,
      vy: 0,
      throttle: 0,
      rudder: 0,
      turn: 0,
    });
    step(w, { work: true }, 1 / 60);
    tick(w, 3);
    assert.equal(d.air, air);
    assert.equal(Math.round(w.catch), (bag + 1) * 300);
    if (bag < 2) step(w, { work: true }, 1 / 60);
  }
});
test('harvest footprints cover most of each productive outline rather than only its centre', () => {
  const w = world();
  for (const p of w.patches.filter((p) => p.rate)) {
    let inside = 0,
      covered = 0;
    for (let y = p.y - p.radius; y <= p.y + p.radius; y += 1)
      for (let x = p.x - p.radius; x <= p.x + p.radius; x += 1) {
        if (polygonInside(p.outline, x, y)) {
          inside++;
          if (p.clumps.some((c) => Math.hypot(c.x - x, c.y - y) <= c.radius)) covered++;
        }
      }
    assert(covered / inside > 0.8, `${p.id}: ${covered / inside}`);
    assert(Math.max(...p.clumps.map((c) => c.x)) - Math.min(...p.clumps.map((c) => c.x)) > 18);
  }
});
function polygonInside(v, x, y) {
  let yes = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++)
    if (
      v[i].y > y !== v[j].y > y &&
      x < ((v[j].x - v[i].x) * (y - v[i].y)) / (v[j].y - v[i].y) + v[i].x
    )
      yes = !yes;
  return yes;
}
test('partners on one ground claim separate clumps and develop meaningfully different routes', () => {
  const w = world(),
    p = w.patches.find((p) => p.id === 'good');
  for (const d of w.divers) Object.assign(d, { state: 'searching', x: p.x + 11, y: p.y, air: 100 });
  tick(w, 18);
  assert.notEqual(w.divers[0].clump, w.divers[1].clump);
  assert(Math.hypot(w.divers[0].x - w.divers[1].x, w.divers[0].y - w.divers[1].y) > 8);
  assert(w.divers.every((d) => d.bag > 50));
  assert(Math.abs(p.remaining + w.divers.reduce((s, d) => s + d.bag, 0) - 1000) < 0.00001);
});
