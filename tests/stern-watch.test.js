import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { boatSpec } from '../src/boats.js';
import { fromHull } from '../src/collision-geometry.js';
import { sternWatch, STERN_WATCH } from '../src/stern-watch.js';

function scene() {
  const w = careerWorld();
  chooseGround(w, 'near');
  Object.assign(w.boat, { heading: 0.4, throttle: -0.4 });
  const spec = boatSpec(w),
    [out, aboard] = w.divers,
    p = fromHull(w.boat, 0, -spec.length / 2 - 4);
  Object.assign(out, { state: 'surface', x: p.x, y: p.y });
  Object.assign(aboard, { state: 'ready', condition: 'fit' });
  w.events = [];
  return { w, out, aboard, spec };
}

test('a diver aboard shouts once when the boat goes astern toward a surfaced diver', () => {
  const { w, out, aboard } = scene();
  assert.equal(sternWatch(w), out);
  assert.match(w.events.at(-1), new RegExp(`^${aboard.name.toUpperCase()} · .*astern`));
  assert.equal(sternWatch(w), null, 'no repeat inside the cooldown');
  w.time += STERN_WATCH.cooldown + 0.1;
  assert.equal(sternWatch(w), out);
});

test('no shout going ahead, with the diver forward, or with nobody aboard', () => {
  let { w } = scene();
  w.boat.throttle = 0.5;
  assert.equal(sternWatch(w), null);
  ({ w } = scene());
  const ahead = fromHull(w.boat, 0, 10);
  Object.assign(w.divers[0], ahead);
  assert.equal(sternWatch(w), null);
  ({ w } = scene());
  w.divers[1].state = 'searching';
  assert.equal(sternWatch(w), null);
});
