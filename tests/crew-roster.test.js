import test from 'node:test';
import assert from 'node:assert/strict';
import { careerWorld, encode, decode, nextCareerDay } from '../src/career-save.js';
import { createCareer, hireCrew } from '../src/career-state.js';
import {
  crewRoster,
  crewProfile,
  crewEmployer,
  crewLoyal,
  advanceCrewMarket,
} from '../src/crew-roster.js';
import { diverSpec } from '../src/crew.js';
import { RIVAL_ART, NINE_ART } from '../src/vessel-catalog.js';

test('seeded opponents use unique rival sprites, varied abilities and one hidden loyal nine-ships team', () => {
  const a = createCareer(101),
    b = createCareer(101),
    c = createCareer(102);
  assert.deepEqual(a.opponents, b.opponents);
  assert.notDeepEqual(a.opponents, c.opponents);
  const visible = a.opponents.filter((t) => !t.hidden);
  assert.equal(visible.length, 12);
  assert.equal(new Set(visible.map((t) => t.art)).size, 12);
  assert(visible.every((t) => RIVAL_ART.includes(t.art)));
  const hidden = a.opponents.find((t) => t.hidden);
  assert(NINE_ART.includes(hidden.art));
  assert(hidden.loyal);
  assert.equal(hidden.name, 'Jessy Bean');
  assert.deepEqual(
    hidden.crew.map((id) => crewProfile(a, id).name),
    ['Paul', 'Worm'],
  );
  assert(!crewRoster(a).some((p) => p.hidden || hidden.crew.includes(p.id)));
  assert(new Set(crewRoster(a).map((p) => p.harvestRate)).size > 8);
});
test('poached divers leave their old team and preserve real abilities, orders and experience through saves', () => {
  const w = careerWorld(),
    c = w.career;
  c.sandbox = true;
  c.testContacts = true;
  const p = crewRoster(c).find((p) => crewEmployer(c, p.id) && !crewLoyal(c, p.id)),
    owner = crewEmployer(c, p.id),
    experience = c.people[p.id].experience;
  assert(hireCrew(w, p.id, 1).ok);
  assert(!owner.crew.includes(p.id));
  assert.equal(c.people[p.id].employer, 'player');
  assert.equal(w.divers[1].experience, experience);
  const spec = diverSpec(w.divers[1]),
    copy = decode(encode(w));
  assert.deepEqual(diverSpec(copy.divers[1]), spec);
  assert.equal(copy.career.people[p.id].employer, 'player');
  const next = nextCareerDay(copy);
  assert.equal(next.divers[1].crewId, p.id);
});
test('loyal and hidden crew cannot be poached, even through Test Mode contact unlock', () => {
  const w = careerWorld();
  w.career.sandbox = true;
  w.career.testContacts = true;
  const team = w.career.opponents.find((t) => t.hidden),
    loyal = crewRoster(w.career).find(
      (p) => crewEmployer(w.career, p.id) && crewLoyal(w.career, p.id),
    );
  assert(!hireCrew(w, team.crew[0], 0).ok);
  assert(!hireCrew(w, loyal.id, 0).ok);
});
test('poor repeated returns can send a non-loyal player diver to a rival, but not the loyal partner', () => {
  let moved = false;
  for (let seed = 1; seed < 60 && !moved; seed++) {
    const c = createCareer(seed);
    c.day = 7;
    for (const id of c.crew) Object.assign(c.people[id], { trips: 5, earnings: 0 });
    advanceCrewMarket(c);
    assert.equal(c.people.ada.employer, 'player');
    moved = c.people.milo.employer !== 'player';
    if (moved) {
      assert(crewEmployer(c, 'milo').crew.includes('milo'));
      assert(c.news.some((n) => n.includes('replacement')));
    }
  }
  assert(moved);
});
