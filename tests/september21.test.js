import './matter-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { careerWorld, encode, decode, nextCareerDay, snapshot } from '../src/career-save.js';
import { encodeSnapshot } from '../src/save-codec.js';
import { calculateOffload } from '../src/offload.js';
import { changeDepartureTime } from '../src/career-state.js';
import { SECTORS, enterSector } from '../src/sectors.js';
import { careerTerrain } from '../src/career-terrain.js';
import { waterRoute } from '../src/water-route.js';
import { currentAt } from '../src/environment.js';
import { workCrew, crewProgress, diverSpec } from '../src/crew.js';
import { CREW, ECONOMY } from '../src/career-data.js';
import { recordMedical } from '../src/medical-history.js';
import { updateWildlifeInteractions, wildlifeWorkRate } from '../src/wildlife.js';
import { inspectionSchedule } from '../src/inspection-schedule.js';
import { synthesize } from '../src/audio.js';
import { stepBoat } from '../src/boat.js';

test('missed offload lands next 06:00, starts 09:00, blocks early rewind and preserves a fishing day', () => {
  for (const arrival of [1141, 1320, 1500, 1801]) {
    const w = careerWorld();
    w.day.phase = 'complete';
    w.day.minute = arrival;
    w.day.result = calculateOffload(w, arrival);
    const expected = arrival < 1800 ? 1800 : 3240;
    assert.equal(w.day.result.offloadMinute, expected);
    const next = nextCareerDay(w);
    assert.equal(next.day.minute, 540);
    assert(next.day.morningOffload);
    assert.equal(next.career.day, 1 + Math.floor(expected / 1440));
    assert(!changeDepartureTime(next, true).ok);
  }
  const normal = nextCareerDay(careerWorld());
  assert.equal(normal.day.minute, 300);
});

function assertLateDepartureMigration(raw) {
  const original = JSON.parse(JSON.parse(raw).payload),
    w = decode(raw);
  assert.equal(w.day.minute, 540);
  assert(w.day.morningOffload);
  assert.equal(w.career.cash, original.career.cash);
  assert.deepEqual(w.career.records, original.career.records);
  assert.equal(w.boat.configuration, original.boat.configuration);
  assert.deepEqual(decode(encode(w)).career.records, w.career.records);
}

test('synthetic legacy save migrates late departure while preserving boat, cash and catch records', () => {
  // Construct test data from the game defaults; never bundle a player's career.
  const data = snapshot(careerWorld());
  delete data.career.planningVersion;
  data.career.day = 15;
  data.career.cash = 12345;
  data.career.history = [{ onTime: false }];
  data.career.records.days = 14;
  data.day.phase = 'planning';
  data.day.minute = data.day.earliestDeparture = 615;
  delete data.day.morningOffload;
  assertLateDepartureMigration(encodeSnapshot(data));
});

const suppliedSave = [
  'feedback/9-21/urchin-career-day-15-1790032195852.json',
  'feedback/archive of feedback/9-21/urchin-career-day-15-1790032195852.json',
].find((path) => existsSync(path));
test(
  'supplied day-15 save migrates variable late departure while preserving boat, cash and catch records',
  { skip: suppliedSave ? false : 'Optional private career is not included in Git.' },
  () => assertLateDepartureMigration(readFileSync(suppliedSave, 'utf8')),
);

test('all six added grounds have abundant mostly unmarked stock; basin access obeys the physical tide', () => {
  const baseline = careerTerrain(SECTORS[0]).patches.reduce((n, p) => n + p.initialStock, 0);
  for (const s of SECTORS.slice(9)) {
    const t = careerTerrain(s);
    assert(t.patches.reduce((n, p) => n + p.initialStock, 0) >= baseline);
    assert(t.patches.filter((p) => p.charted !== false).length <= 3);
    if (!t.tidalBasin) continue;
    const w = careerWorld();
    w.day.groundId = s.id;
    enterSector(w, s.id);
    const b = t.tidalBasin,
      jet = { draft: 1, radius: 5 },
      shaft = { draft: 2, radius: 5 };
    w.environment.seaLevel = 0;
    assert.equal(waterRoute(w, s.entry, b, jet).length, 0);
    assert.equal(waterRoute(w, b, s.entry, jet).length, 0, 'jets cannot leave at low water');
    const low = currentAt(w, b.x, b.y);
    w.environment.seaLevel = b.jetOnly ? 2 : 2.75;
    assert(waterRoute(w, s.entry, b, jet).length);
    assert.equal(!!waterRoute(w, s.entry, b, shaft).length, !b.jetOnly);
    const high = currentAt(w, b.x, b.y);
    assert(Math.hypot(low.x, low.y) < Math.hypot(high.x, high.y) * 0.1);
    const prize = w.patches.find((p) => p.id.startsWith('challenge-bed-'));
    assert.equal(prize.quality, 1);
    assert.equal(prize.rate, 45);
    assert(prize.remaining >= 6000);
  }
});

test('level 20 specialists outperform level 5, while sustained fatigue reduces real working abilities', () => {
  assert.equal(crewProgress(1e6).level, 20);
  assert.equal(crewProgress(1e6).next, null);
  const current = CREW.find((p) => crewProgress(1e6, p.id, 1).currentBonus > 3);
  assert(current);
  const d = { crewId: current.id, crewSeed: 1, experience: 1e6, fatigue: 0 };
  assert(diverSpec(d).holdCurrentKnots > 5);
  const w = careerWorld();
  w.weather = { night: false };
  w.diver.fatigue = 0;
  const fresh = diverSpec(w.diver);
  workCrew(w, w.diver, 600);
  assert(w.diver.fatigue > 0.3);
  assert(diverSpec(w.diver).harvestRate < fresh.harvestRate * 0.86);
  const carry = w.diver.fatigue - ECONOMY.restRecovery;
  assert(carry < 0.08, 'ordinary daytime work mostly recovers overnight');
  recordMedical(w.career, 'ada', 'Unfit for work', 'Test absence cause', w.career.day + 1);
  assert.equal(decode(encode(w)).career.people.ada.medicalHistory[0].cause, 'Test absence cause');
});

test('surfaced whale collision fines once, persists in saves and increases DFO attention; submerged whale is safe', () => {
  const w = careerWorld();
  Object.assign(w.boat, { x: 250, y: 250, vx: 2, vy: 0 });
  const member = { offsetX: 0, offsetY: 0, surfaced: false };
  w.wildlife = { encounters: [{ species: 'humpback', x: 250, y: 250, members: [member] }] };
  updateWildlifeInteractions(w);
  assert.equal(w.day.inspectionFine, undefined);
  member.surfaced = true;
  updateWildlifeInteractions(w);
  assert.equal(w.day.inspectionFine, 50000);
  updateWildlifeInteractions(w);
  assert.equal(w.day.inspectionFine, 50000);
  assert.equal(inspectionSchedule(w.career).day, w.career.day);
  w.wildlife = null;
  assert.equal(decode(encode(w)).career.wildlifeStrikes, 1);
  w.time = 0;
  w.wildlife = { encounters: [{ id: 'four', species: 'seaLion', x: w.diver.x, y: w.diver.y }] };
  w.diver.state = 'harvesting';
  updateWildlifeInteractions(w);
  assert.equal(wildlifeWorkRate(w, w.diver), 0.55);
  w.time = 10;
  assert.equal(wildlifeWorkRate(w, w.diver), 1);
});

test('gear loops differ audibly in waveform and surface whistle has finite, quiet edges', () => {
  const sounds = ['neutral', 'forward', 'reverse', 'whistle'].map((s) => synthesize(s));
  for (const sound of sounds) {
    assert(sound.every(Number.isFinite));
    assert.equal(sound[0], 0);
    assert(Math.abs(sound.at(-1)) < 0.01);
  }
  for (const [a, b] of [
    [0, 1],
    [1, 2],
    [0, 2],
  ])
    assert(sounds[a].some((v, i) => Math.abs(v - sounds[b][i]) > 0.07));
  const whistle = sounds[3];
  let crosses = 0;
  for (let i = 1; i < whistle.length; i++) if (whistle[i] > 0 && whistle[i - 1] <= 0) crosses++;
  assert(crosses / 1.2 > 1800 && crosses / 1.2 < 1900, 'thin high whistle');
});

test('Easy can reverse off a windward grounding while Realistic retains engine-versus-wind physics', () => {
  const run = (difficulty) => {
    const w = careerWorld();
    w.career.difficulty = difficulty;
    w.day.phase = 'practice';
    w.boat.heading = 0;
    const count = w.terrain.size / w.terrain.spacing + 1;
    w.terrain.depths = w.terrain.depths.map(
      (_, i) => 2 + (Math.floor(i / count) * w.terrain.spacing - 246) * 0.15,
    );
    Object.assign(w.boat, { x: 250, y: 250, vx: 0, vy: 0, throttle: -1, grounded: true });
    Object.assign(w.environment, {
      current: { x: 0, y: 0 },
      seaLevel: 0,
      waves: 0,
      wind: { x: 0, y: -40 },
    });
    // This isolated physics fixture has no financial career systems.
    for (let i = 0; i < 180; i++) stepBoat(w, {}, 1 / 60);
    return w.boat.y;
  };
  assert(run('easy') > run('realistic') + 0.2);
});
