import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { chooseGround, groundTrip } from '../src/day.js';
import { areaStatus, seasonStatus } from '../src/season.js';
import { careerDayAt } from '../src/career-calendar.js';
import { createCareer } from '../src/career-state.js';
import { chooseFirstBoat } from '../src/starter-career.js';

test('sector openings follow the actual date offshore without ejecting a boat from its current ground', () => {
  let w = careerWorld(createCareer(17, { chooseStarter: true }));
  assert(chooseFirstBoat(w, 'basic').ok);
  assert(chooseGround(w, 'near').ok);
  const id = w.day.careerTrip.id;
  assert.equal(groundTrip(w, 'middle').closed, true);
  w.day.minute = 2 * 1440 + 600;
  assert.equal(careerDayAt(w), 3);
  assert.equal(groundTrip(w, 'middle').closed, false);
  assert.equal(groundTrip(w, 'middle').ok, true);
  assert.equal(groundTrip(w, 'far').closed, true);
  w.day.minute = 4 * 1440 + 600;
  assert.equal(groundTrip(w, 'far').ok, true);
  w = decode(encode(w));
  assert.equal(groundTrip(w, 'far').ok, true);
  w.day.minute = 9 * 1440 + 600;
  assert.equal(seasonStatus(w.career, careerDayAt(w)).season, 2);
  assert.equal(groundTrip(w, 'middle').closed, true);
  assert.equal(groundTrip(w, 'far').closed, true);
  // A skipper already on closed-season ground retains the approved choice to
  // keep fishing. Only selecting a different destination uses its opening day.
  w.day.groundId = 'far';
  assert.equal(groundTrip(w, 'far').ok, true);
  assert.equal(w.day.phase, 'working');
  assert.equal(w.career.day, 1);
  assert.equal(w.day.careerTrip.id, id);
  assert.equal(
    areaStatus(w.career, 'storm-channel', careerDayAt(w)).access,
    false,
    'calendar advancement cannot grant a coast permit',
  );
});
