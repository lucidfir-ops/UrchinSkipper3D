import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { createCareer } from '../src/career-state.js';
import { chooseGround } from '../src/day.js';
import { recordKnowledge, markPosition, markReport } from '../src/knowledge.js';
import { renderExpedition } from '../src/career-chart.js';
import { updateWildlifeInteractions } from '../src/wildlife.js';
import { inspectionDue } from '../src/inspection-schedule.js';
import { finishInspection, patrolSkipper } from '../src/fishery.js';
import { spawnTraffic } from '../src/traffic.js';

function voyage(seed) {
  const w = careerWorld(createCareer(seed));
  assert(chooseGround(w, 'near').ok);
  return w;
}

function chartMarkup(w) {
  const previousDocument = globalThis.document,
    surface = {},
    choices = {
      children: [],
      append(button) {
        this.children.push(button);
      },
    },
    panel = {
      classList: { add() {} },
      querySelectorAll: () => [],
      querySelector: (selector) => (selector === '.choices' ? choices : surface),
    };
  globalThis.document = {
    createElement: () => ({
      dataset: {},
      classList: { toggle() {} },
      setAttribute() {},
      scrollIntoView() {},
    }),
  };
  try {
    renderExpedition({ screen: 'knowledge', index: 0, chartMode: 'vector', panel }, w, () => '');
    return panel.innerHTML;
  } finally {
    globalThis.document = previousDocument;
  }
}

test('continuous-voyage samples, depth tracks and marks retain their actual dates and the chart ages older reports', () => {
  const w = voyage();
  w.career.fleet.basic.equipment.push('plotter', 'scanner');
  const [oldPatch, freshPatch] = w.patches;
  for (const [patch, minute] of [
    [oldPatch, 600],
    [freshPatch, 6 * 1440 + 600],
  ]) {
    w.day.minute = minute;
    w.time += 3;
    Object.assign(w.boat, { x: patch.x, y: patch.y });
    Object.assign(w.diver, {
      state: 'surface',
      x: patch.x - 4,
      y: patch.y,
      patch,
      bag: 180,
      qualitySum: 144,
    });
    recordKnowledge(w);
    assert(markPosition(w).ok);
  }
  const knowledge = w.career.knowledge.near;
  assert.equal(knowledge.grounds[oldPatch.id].day, 1);
  assert.equal(knowledge.grounds[freshPatch.id].day, 7);
  assert.deepEqual(
    knowledge.tracks.map((track) => track.day),
    [1, 7],
  );
  const location = `${Math.round(w.boat.x / 6)},${Math.round(w.boat.y / 6)}`;
  assert.equal(knowledge.depths[location].day, 7);
  assert.deepEqual(
    w.career.marks.map((mark) => mark.day),
    [1, 7],
  );
  assert(markReport(w, 'near', oldPatch.id).ok);
  assert.equal(
    w.career.marks.at(-1).day,
    1,
    'marking an older sample preserves the observation date',
  );
  const saved = decode(encode(w));
  assert.deepEqual(saved.career.knowledge, w.career.knowledge);
  assert.deepEqual(saved.career.marks, w.career.marks);
  const markup = chartMarkup(saved);
  assert.match(markup, /DAY 7 · 10:00/);
  assert.match(markup, /6 days ago · reported by Ada/);
  assert.match(markup, /Today · reported by Ada/);
  assert.equal(saved.career.day, 1);
});

test('normal patrols follow the same seeded calendar on continuous voyages as on separate working days', () => {
  let continuous = voyage();
  const daily = voyage(),
    seen = [];
  for (let day = 1; day <= 40; day++) {
    daily.career.day = day;
    delete daily.day.inspection;
    daily.day.minute = 840;
    continuous.day.minute = (day - 1) * 1440 + 840;
    const expected = inspectionDue(daily);
    assert.equal(inspectionDue(continuous), expected, `patrol day ${day}`);
    if (expected) {
      seen.push(day);
      for (const w of [daily, continuous]) {
        w.day.inspection = { status: 'boarding', minute: w.day.minute, minutes: 20 };
        finishInspection(w);
        assert(!inspectionDue(w), 'completed inspections do not repeat that day');
      }
      continuous = decode(encode(continuous));
      assert(!inspectionDue(continuous), 'a completed saved inspection cannot reroll');
    }
  }
  assert.equal(seen[0], 3);
  assert(seen.length >= 5);
  assert.equal(continuous.career.day, 1);
});

test('a late-voyage whale strike keeps six subsequent days of patrol attention and does not erase later visits', () => {
  let w = voyage();
  w.day.minute = 6 * 1440 + 600;
  Object.assign(w.boat, { x: 250, y: 250, vx: 2, vy: 0 });
  const member = { offsetX: 0, offsetY: 0, surfaced: true };
  w.wildlife = { encounters: [{ species: 'humpback', x: 250, y: 250, members: [member] }] };
  updateWildlifeInteractions(w);
  updateWildlifeInteractions(w);
  assert.equal(w.day.inspectionFine, 50000);
  assert.equal(w.career.dfoAttentionThrough, 13);
  assert(inspectionDue(w));
  w.wildlife = null;
  for (let day = 7; day <= 13; day++) {
    w.day.minute = (day - 1) * 1440 + 599;
    assert(!inspectionDue(w), 'patrols wait for the morning window');
    w.day.minute++;
    assert(inspectionDue(w), `wildlife patrol on day ${day}`);
    w.day.inspection = { status: 'boarding', minute: w.day.minute, minutes: 20 };
    finishInspection(w);
    assert(!inspectionDue(w));
    w = decode(encode(w));
    assert(!inspectionDue(w));
    assert.equal(w.day.inspectionFine, 50000, 'the strike assessment stays once-only');
  }
  w.day.minute = 13 * 1440 + 600;
  inspectionDue(w);
  assert(!w.career.patrolSchedule.window.startsWith('wildlife-'));
});

test('an inspection spanning midnight retains its officer and consumes only its original patrol day', () => {
  const w = voyage();
  w.career.dfoAttentionThrough = 13;
  w.day.minute = 6 * 1440 + 600;
  assert(inspectionDue(w));
  w.day.inspection = { status: 'boarding', minute: w.day.minute, minutes: 20 };
  const officer = patrolSkipper(w);
  w.day.minute += 1440;
  assert(!inspectionDue(w), 'no second call while the first inspection is active');
  assert.equal(patrolSkipper(w), officer);
  finishInspection(w);
  assert.equal(w.career.patrolSchedule.day, 7);
  assert.equal(w.career.patrolSchedule.completed, true);
  assert(inspectionDue(w), 'the next calendar day still has its own visit');
  assert.equal(w.career.patrolSchedule.day, 8);
  w.day.minute = 7 * 1440 + 841;
  assert(!inspectionDue(w), 'late patrols do not create a missed-window backlog');
});

test('taxi spawn offsets expire with actual onboarding days on an extended voyage', () => {
  const points = [];
  for (const minute of [2 * 1440 + 600, 3 * 1440 + 600]) {
    const w = voyage(1);
    w.day.minute = minute;
    w.terrain.depths = w.terrain.depths.slice().fill(40);
    w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
    Object.assign(w.boat, { x: 400, y: 450 });
    Object.assign(w.diver, { state: 'searching', x: 250, y: 250, patch: null });
    const taxi = spawnTraffic(w, 'taxi');
    assert(taxi?.crossingPoint);
    points.push(taxi.crossingPoint);
  }
  assert.deepEqual(points, [
    { x: 260, y: 250 },
    { x: 250, y: 250 },
  ]);
});
