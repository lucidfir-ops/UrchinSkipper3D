import { CREW } from './career-data.js';
import { seededRandom } from './math.js';
import { RIVAL_ART, NINE_ART } from './vessel-catalog.js';

const cache = new Map(),
  first = [
    'Lena',
    'Tom',
    'Jo',
    'Avery',
    'Casey',
    'Rowan',
    'Alex',
    'Devon',
    'Sage',
    'Ellis',
    'Jamie',
    'Morgan',
    'Quinn',
  ],
  last = [
    'Moss',
    'Vale',
    'Calder',
    'Stone',
    'Reed',
    'Cove',
    'Bell',
    'Fraser',
    'Lake',
    'Brooks',
    'Hill',
    'Ward',
    'Shaw',
  ];
function generated(seed) {
  if (cache.has(seed)) return cache.get(seed);
  const random = seededRandom(seed ^ 0x716ec2),
    art = [...RIVAL_ART];
  for (let i = art.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [art[i], art[j]] = [art[j], art[i]];
  }
  const teams = [],
    people = [];
  for (let i = 0; i < art.length + 1; i++) {
    const hidden = i === art.length,
      id = hidden ? 'shai-hull-wood' : `team-${i}`,
      loyal = hidden || random() < 0.23,
      crew = [`${id}-diver-0`, `${id}-diver-1`];
    teams.push({
      id,
      hidden,
      loyal,
      crew,
      name: hidden ? 'Jessy Bean' : `${first[i]} ${last[(i + 3) % last.length]}`,
      boat: hidden
        ? 'Shy Hull Wood'
        : [
            'Second Wind',
            'Northwesterly',
            'Quiet Water',
            'Silver Wake',
            'Tide Turner',
            'Early Bird',
            'Blue Lantern',
            'Lucky Sound',
            'Morning Star',
            'Copper Cove',
            'Long Reach',
            'Sea Otter',
            'Last Light',
          ][i],
      art: hidden ? NINE_ART[Math.floor(random() * NINE_ART.length)] : art[i],
      home: ['near', 'middle', 'far'][i % 3],
      hull: ['basic', 'thruster', 'sterndrive', 'jet'][Math.floor(random() * 4)],
      speed: 8 + random() * 12,
      turnRate: 0.35 + random() * 0.7,
      target: 1800 + Math.round(random() * 1800),
      bio: loyal
        ? 'A settled, loyal crew. Keeps to familiar ground.'
        : 'An independent crew. Good earnings and safe working conditions matter.',
    });
    for (let n = 0; n < 2; n++)
      people.push({
        id: crew[n],
        portraitTile: i * 2 + n,
        legacyReserve: !hidden && i === 12,
        hidden,
        loyal: loyal || random() < 0.15,
        rank: Math.floor(random() * 3),
        name: hidden
          ? ['Paul', 'Worm'][n]
          : `${first[(i + n + 5) % first.length]} ${last[(i * 3 + n) % last.length]}`,
        colour: ['#648c9c', '#b48650', '#879262', '#609386'][Math.floor(random() * 4)],
        bio: 'Working diver. Reputation follows the crew from boat to boat.',
        searchSpeed: 0.75 + random() * 0.5,
        harvestRate: 0.85 + random() * 0.65,
        airUse: 0.85 + random() * 0.4,
        awareness: 8 + random() * 4,
        holdCurrentKnots: 1.7 + random() * 1.2,
        judgement: 0.78 + random() * 0.21,
        reliability: 0.92 + random() * 0.07,
        initialExperience: Math.floor(random() * 25000),
        diveStyle: ['conservative', 'tables', 'reckless'][Math.floor(random() * 3)],
        specialties: [
          ['picking', 'swimming'],
          ['awareness', 'fatigue'],
          ['air', 'current'],
        ][Math.floor(random() * 3)],
      });
  }
  const result = { teams: teams.filter((t) => t.id !== 'team-12'), people };
  // One seeded opponent diver ignores tables, in addition to Roy. Traits stay hidden.
  const reckless = Math.floor(random() * (people.length - 2));
  people.forEach((p, i) => {
    p.diveStyle = i === reckless ? 'reckless' : p.diveStyle === 'reckless' ? 'tables' : p.diveStyle;
  });
  if (cache.size >= 16) cache.delete(cache.keys().next().value);
  cache.set(seed, result);
  return result;
}
export const crewProfile = (c, id) =>
  CREW.find((p) => p.id === id) ||
  (c ? generated(c.seed).people.find((p) => p.id === id) : undefined);
export const crewRoster = (c) =>
  CREW.concat(
    c
      ? generated(c.seed).people.filter(
          (p) => !p.hidden && (!p.legacyReserve || c.crew.includes(p.id)),
        )
      : [],
  );
export function prepareRosters(c) {
  c.opponents ??= structuredClone(generated(c.seed).teams);
  for (const team of c.opponents) if (team.hidden) team.boat = 'Shy Hull Wood';
  for (const team of c.todayFleet || []) if (team.hidden) team.boat = 'Shy Hull Wood';
  for (const p of generated(c.seed).people) {
    const team = c.opponents.find((t) => t.crew.includes(p.id));
    c.people[p.id] ??= {
      condition: 'fit',
      fatigue: 0,
      experience: p.initialExperience,
      availableDay: 1,
      employer: team?.id || null,
    };
  }
  for (const id of c.crew) {
    if (c.people[id] && c.people[id].employer === undefined) c.people[id].employer = 'player';
  }
}
export function crewEmployer(c, id) {
  return c.opponents?.find((t) => t.id === c.people[id]?.employer);
}
export function crewLoyal(c, id) {
  return !!(
    crewProfile(c, id)?.loyal ||
    crewEmployer(c, id)?.loyal ||
    ['ada', 'nell'].includes(id)
  );
}
export function poachRefusal(c, id) {
  const p = crewProfile(c, id),
    owner = crewEmployer(c, id);
  if (p?.hidden) return 'This diver is not available.';
  if (owner && crewLoyal(c, id)) return `Loyal to ${owner.boat}; not looking for another boat.`;
  return '';
}
export function joinPlayerCrew(c, id) {
  const refusal = poachRefusal(c, id);
  if (refusal) return false;
  for (const team of c.opponents || []) team.crew = team.crew.filter((member) => member !== id);
  c.people[id].employer = 'player';
  return true;
}
export function advanceCrewMarket(c) {
  prepareRosters(c);
  const random = seededRandom(Math.imul(c.seed, 2654435761) ^ (c.day * 7951));
  // Departures happen only between days, after several meaningful poor returns.
  for (const id of c.crew) {
    const r = c.people[id],
      profile = crewProfile(c, id);
    if (crewLoyal(c, id) || r.employer !== 'player' || r.condition !== 'fit' || (r.trips || 0) < 4)
      continue;
    if ((r.earnings || 0) / r.trips >= 80 && (c.records.incidents || 0) < 2) continue;
    if (random() >= 0.18) continue;
    const team =
      c.opponents.find((t) => !t.hidden && !t.loyal && t.crew.length < 2) ||
      c.opponents.find((t) => !t.hidden && !t.loyal);
    if (!team) continue;
    if (team.crew.length >= 2) {
      const replace = team.crew.find((member) => !crewLoyal(c, member));
      if (!replace) continue;
      team.crew = team.crew.filter((member) => member !== replace);
      c.people[replace].employer = null;
    }
    team.crew.push(id);
    r.employer = team.id;
    c.news.push(`${profile.name} has joined ${team.boat}. Hire a replacement before sailing.`);
  }
  for (const team of c.opponents.filter((t) => !t.hidden && !t.loyal)) {
    while (team.crew.length < 2) {
      const available = crewRoster(c).filter(
        (p) =>
          !crewLoyal(c, p.id) &&
          !c.crew.includes(p.id) &&
          !c.people[p.id]?.employer &&
          c.people[p.id]?.condition === 'fit',
      );
      const p = available[Math.floor(random() * available.length)];
      if (!p) break;
      team.crew.push(p.id);
      c.people[p.id].employer = team.id;
    }
  }
}
