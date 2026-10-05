import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { step } from '../src/simulation.js';
import { confirmDeparture, returnAvailable } from '../src/departure-transition.js';
import { choices } from '../src/screen-actions.js';
import { DEFAULTS } from '../src/input.js';

// October 5: crossing the harbour line offers an explicit action; it never
// pauses play and never leaves by itself.
function boundaryWorld(edge = 'south') {
  const w = careerWorld();
  assert(chooseGround(w, 'near').ok);
  const size = w.terrain.size;
  w.day.returnExit.edge = edge;
  Object.assign(w.boat, {
    x: edge === 'west' ? 0 : edge === 'east' ? size : size / 2,
    y: edge === 'north' ? 0 : edge === 'south' ? size : size / 2,
    throttle: 0,
    vx: 0,
    vy: 0,
  });
  return w;
}

test('beyond each designated edge the return is offered, time keeps running and nothing departs unasked', () => {
  for (const edge of ['north', 'south', 'east', 'west']) {
    const w = boundaryWorld(edge);
    assert(returnAvailable(w));
    const minute = w.day.minute;
    for (let i = 0; i < 120; i++) step(w, {}, 1 / 60);
    assert(w.day.minute > minute, 'play is not paused at the line');
    assert.equal(w.day.returnFade, undefined, 'crossing alone never departs');
    assert.equal(w.day.returnPending, undefined);
    assert.equal(w.day.phase, 'working');
    // Current may carry the boat back inside; the skipper chooses from beyond the line.
    Object.assign(w.boat, boundaryWorld(edge).boat);
    assert(returnAvailable(w));
    step(w, { returnHarbour: true }, 1 / 60);
    assert(w.day.returnFade > 0, 'explicit action starts the departure');
  }
});

test('the return is withdrawn inside the sector, on the wrong edge, with crew in the water or during bag work', () => {
  const w = boundaryWorld();
  w.boat.y = w.terrain.size - 5;
  assert(!returnAvailable(w));
  step(w, { returnHarbour: true }, 1 / 60);
  assert.equal(w.day.returnFade, undefined);
  w.boat.y = 0;
  assert(!returnAvailable(w));
  w.boat.y = w.terrain.size;
  w.divers[0].state = 'surface';
  assert(!returnAvailable(w));
  assert(!confirmDeparture(w));
  w.divers[0].state = 'ready';
  w.day.dump = {};
  assert(!returnAvailable(w));
  delete w.day.dump;
  w.day.phase = 'practice';
  assert(!returnAvailable(w));
});

test('a pre-October 5 paused crossing decision loads as ordinary play', () => {
  const w = boundaryWorld();
  w.day.returnPending = true;
  w.day.returnDismissed = true;
  const loaded = decode(encode(w));
  assert.equal(loaded.day.returnPending, undefined);
  assert.equal(loaded.day.returnDismissed, undefined);
  assert(returnAvailable(loaded));
  const minute = loaded.day.minute;
  step(loaded, {}, 1);
  assert(loaded.day.minute > minute);
});

test('keyboard H, the pause menu entry and confirmation settle exactly once', () => {
  assert.deepEqual(DEFAULTS.returnHarbour, ['KeyH']);
  const w = boundaryWorld(),
    ui = { screen: 'pause', revealUrchins: false };
  assert.equal(choices.call(ui, w)[0], 'Return to harbour');
  w.boat.y = w.terrain.size / 2;
  assert(!choices.call(ui, w).includes('Return to harbour'));
  w.boat.y = w.terrain.size;
  assert(confirmDeparture(w));
  assert(!confirmDeparture(w), 'no duplicate departure');
  assert(!returnAvailable(w));
});
