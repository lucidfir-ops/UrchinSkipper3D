import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer } from '../src/career-state.js';
import { careerWorld } from '../src/career-save.js';
import { introLesson } from '../src/career-intro.js';
import { boatSpec } from '../src/boats.js';
import { actionTarget, recoveryStatus } from '../src/diver-recovery.js';
import { step } from '../src/simulation.js';
import { playState } from '../src/presentation.js';
import { updateTutorialSpeech } from '../src/tutorial-speech.js';

function tutorial() {
  const c = createCareer(100, { chooseStarter: true });
  c.day = 0;
  c.intro = { status: 'active', step: 6, markedCatch: true };
  const w = careerWorld(c);
  Object.assign(w.boat, {
    x: 120,
    y: 120,
    heading: 0,
    vx: 0.015,
    vy: 0,
    throttle: 0,
    rudder: 0,
    turn: 0,
  });
  surface(w, w.divers[0], 3);
  return w;
}
function surface(w, d, distance, port = true) {
  Object.assign(d, {
    state: 'surface',
    x: w.boat.x + (port ? -1 : 1) * (boatSpec(w).width / 2 + distance),
    y: w.boat.y,
    bag: 70,
    qualitySum: 56,
    air: 90,
  });
}

test('tutorial names the unavailable float and accurately previews automatic second-diver deployment', () => {
  const w = tutorial();
  surface(w, w.divers[0], 6);
  assert.equal(recoveryStatus(w, undefined, w.divers[0]).reason, 'OUT OF RANGE');
  const before = JSON.stringify(w),
    text = introLesson(w)[1];
  assert.match(text, /Ada is too far away.*port.*\{recoverDiver\} would deploy Milo now/);
  assert.equal(JSON.stringify(w), before, 'guidance is read-only');
  assert.equal(actionTarget(w, 'recoverDiver').id, 1);
  step(w, { recoverDiver: true }, 1 / 60);
  assert.equal(w.divers[0].state, 'surface');
  assert.equal(w.divers[1].state, 'deploying', 'Bible automatic deployment fallback is preserved');
});

test('wrong-side, speed and hull-clearance advice follow the actual rejection reason', () => {
  const w = tutorial(),
    d = w.divers[0];
  surface(w, d, 3, false);
  assert.equal(recoveryStatus(w, undefined, d).reason, 'BRING FLOAT TO PORT SIDE');
  assert.match(introLesson(w)[1], /Ada is not beside the port ladder.*left when facing the bow/);
  surface(w, d, 3);
  w.boat.vy = 1.5;
  assert.equal(recoveryStatus(w, undefined, d).reason, 'SLOW DOWN');
  assert.match(introLesson(w)[1], /Ada is on port.*moving too fast.*Neutral.*deploy Milo/);
  w.boat.vy = 0;
  d.x = w.boat.x - 0.1;
  assert.equal(recoveryStatus(w, undefined, d).reason, 'KEEP FLOAT CLEAR OF THE HULL');
  assert.match(introLesson(w)[1], /Ada is under the hull.*Ease clear/);
});

test('eligible and ongoing recovery advice uses the real target rather than portrait selection', () => {
  const w = tutorial();
  w.selectedDiverId = 1;
  assert.equal(actionTarget(w, 'recoverDiver').id, 0);
  assert.match(introLesson(w)[1], /Ada is alongside on port.*brings them and their catch aboard/);
  assert.doesNotMatch(introLesson(w)[1], /deploy Milo/);
  surface(w, w.divers[1], 1);
  w.selectedDiverId = 0;
  assert.equal(actionTarget(w, 'recoverDiver').id, 1);
  assert.match(introLesson(w)[1], /Milo is alongside/);
  const d = w.divers[1];
  Object.assign(d, { hooking: true, recoveryAction: 'recoverDiver' });
  assert.match(introLesson(w)[1], /Milo is coming aboard.*no further button press/);
  w.boat.vy = 1.5;
  assert.match(introLesson(w)[1], /Milo is on port.*too fast.*Boarding will resume/);
  assert.doesNotMatch(introLesson(w)[1], /would deploy/);
});

test('unseen surfacing and hidden catch do not change tutorial advice', () => {
  const w = tutorial();
  w.career.difficulty = 'realistic';
  w.career.assists.diverIndicators = false;
  const d = w.divers[0];
  Object.assign(d, { state: 'searching', x: 200, y: 200, bag: 0 });
  const underwater = introLesson(w)[1];
  Object.assign(d, { state: 'surface', bag: 300, reason: 'Bag full' });
  assert.equal(introLesson(w)[1], underwater);
  assert.match(underwater, /Follow the bubbles.*would deploy Milo/);
  assert.doesNotMatch(underwater, /Ada|300|full|surfaced|too far/i);
  surface(w, d, 3);
  assert.match(introLesson(w)[1], /Ada/);
});

test('the discovery recovery uses the same command preview and appropriate retry context', () => {
  const w = tutorial();
  w.career.intro.step = 8;
  assert.match(introLesson(w)[1], /Ada is alongside/);
  assert.equal(introLesson(w)[0], 'Bring the discovery home');
  w.divers.forEach((d) => {
    d.state = 'ready';
  });
  assert.match(introLesson(w)[1], /newly found ground/);
  assert.doesNotMatch(introLesson(w)[1], /marked ground/);
});

test('tutorial speech distinguishes real speed rejection from the separate redive reason', () => {
  const w = tutorial(),
    d = w.divers[0],
    ui = { realistic: false, input: { label: () => '1' } };
  w.boat.vy = 1.5;
  const state = playState(w, '', undefined, d);
  assert.equal(state.reason, '', 'existing redive reason contract stays unchanged');
  assert.equal(state.available, false);
  updateTutorialSpeech(ui, w, state, d, '');
  assert.match(ui.seaMessages.get('pickup').text, /Neutral.*match the float/);
  const firstKey = ui.seaMessages.get('pickup').key;
  w.boat.vy = 0;
  surface(w, d, 3, false);
  updateTutorialSpeech(ui, w, playState(w, '', undefined, d), d, '');
  assert.notEqual(ui.seaMessages.get('pickup').key, firstKey);
  assert.match(ui.seaMessages.get('pickup').text, /port ladder/);
});
