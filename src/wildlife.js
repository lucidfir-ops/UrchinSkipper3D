import { hullDistance } from './collision-geometry.js';
import { boatSpec } from './boats.js';
import { C } from './config.js';
import { seededRandom } from './math.js';
import { depthAt } from './terrain.js';
import { nearShore } from './shore-hazards.js';
import { coastTier } from './coasts.js';
import { rockVisualBand } from './rock-depth.js';

export const WILDLIFE = Object.freeze({
  maxEncounters: 2,
  tickSeconds: 0.2,
  firstDelay: [35, 95],
  spawnDelay: [75, 210],
  spawnChance: 0.65,
  deepDepth: 20,
  reactionRange: 42,
  touristSight: 280,
});

export const WILDLIFE_SPECIES = Object.freeze({
  goose: { areas: ['near', 'middle', 'far'], members: [5, 9], lifetime: [40, 75], speed: 7 },
  seagull: { areas: ['near', 'middle', 'far'], members: [2, 6], lifetime: [45, 90], speed: 2.4 },
  eagle: {
    areas: ['near', 'middle', 'far'],
    members: [1, 1],
    lifetime: [55, 105],
    speed: 5.5,
    rock: true,
  },
  dolphin: {
    areas: ['middle', 'far'],
    members: [3, 7],
    lifetime: [55, 105],
    speed: 3.6,
    cetacean: true,
  },
  orca: { areas: ['far'], members: [3, 6], lifetime: [70, 125], speed: 2.8, cetacean: true },
  humpback: { areas: ['far'], members: [2, 4], lifetime: [80, 140], speed: 1.8, cetacean: true },
  seal: { areas: ['near', 'middle'], members: [1, 3], lifetime: [45, 95], speed: 1.2, rock: true },
  seaLion: {
    areas: ['near', 'middle'],
    members: [2, 5],
    lifetime: [55, 110],
    speed: 1.8,
    rock: true,
  },
});

const CETACEANS = new Set(['dolphin', 'orca', 'humpback']);
const PINNIPEDS = new Set(['seal', 'seaLion']);
const range = (random, values) => values[0] + random() * (values[1] - values[0]);
const integer = (random, values) => Math.floor(range(random, [values[0], values[1] + 1]));
const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const activeDay = (w) => ['working', 'practice'].includes(w.day.phase);
const wildlifeSeed = (w, serial = 0) =>
  Math.imul(w.career?.seed ?? C.seed, 2654435761) ^
  Math.imul(w.career?.day ?? 0, 7919) ^
  Math.imul(serial + 1, 104729) ^
  Math.imul(w.sectorRevision || 0, 1543);

function schedule(w, state, first = false) {
  const random = seededRandom(wildlifeSeed(w, state.scheduleSerial++));
  const delay = first ? WILDLIFE.firstDelay : WILDLIFE.spawnDelay;
  state.nextSpawnAt = w.time + range(random, delay);
}

export function prepareWildlife(w) {
  if (!activeDay(w) || !w.day.groundId) return null;
  const area = w.day.groundId;
  if (w.wildlife?.area === area && w.wildlife?.sectorRevision === w.sectorRevision)
    return w.wildlife;
  const state = {
    area,
    sectorRevision: w.sectorRevision || 0,
    encounters: [],
    serial: 0,
    scheduleSerial: 0,
    accumulator: 0,
    nextSpawnAt: 0,
  };
  w.wildlife = state;
  schedule(w, state, true);
  return state;
}

export function speciesAllowed(w, species) {
  const spec = WILDLIFE_SPECIES[species];
  const habitat = coastTier(w.day.groundId)
    ? coastTier(w.day.groundId) === 1
      ? 'middle'
      : 'far'
    : w.day.groundId;
  if (!spec || !spec.areas.includes(habitat)) return false;
  const weather = w.weather || {};
  if (['seagull', 'eagle', 'goose'].includes(species))
    return (
      !weather.night &&
      (weather.visibility ?? 500) >= (species === 'eagle' ? 120 : 55) &&
      (weather.wave ?? 0) <= 1.5
    );
  if (PINNIPEDS.has(species))
    return (weather.wave ?? 0) <= 1.4 && (weather.visibility ?? 500) >= 45;
  return (
    (weather.wave ?? 0) <= (species === 'humpback' ? 1.5 : 1.8) && (weather.visibility ?? 500) >= 70
  );
}

function rockPoint(w, species, random, requestedRock) {
  const rocks = requestedRock ? [requestedRock] : w.rocks || [];
  const suitable = rocks.filter((rock) => {
    const band = rockVisualBand(w, rock);
    if (!['exposed', 'shallow'].includes(band)) return false;
    if (species === 'seaLion' && (band !== 'exposed' || rock.radius < 1.7)) return false;
    return species !== 'eagle' || rock.charted || band === 'exposed';
  });
  if (!suitable.length) return null;
  const rock = suitable[Math.floor(random() * suitable.length)],
    angle = random() * Math.PI * 2,
    distance = species === 'seaLion' ? rock.radius * 0.35 : rock.radius + 0.5;
  return {
    x: rock.x + Math.cos(angle) * distance,
    y: rock.y + Math.sin(angle) * distance,
    rockId: rock.id,
  };
}

function habitatPoint(w, species, random) {
  const spec = WILDLIFE_SPECIES[species],
    margin = 18;
  if (spec.rock) return rockPoint(w, species, random);
  for (let attempt = 0; attempt < 240; attempt++) {
    const x = margin + random() * (w.terrain.size - margin * 2),
      y = margin + random() * (w.terrain.size - margin * 2),
      depth = depthAt(w, x, y);
    if (spec.cetacean && depth >= WILDLIFE.deepDepth) return { x, y };
    if (species === 'goose' && depth > 0.3) return { x, y };
    if (species === 'seagull' && depth > 0.3 && nearShore(w.terrain, x, y, 90)) return { x, y };
  }
  return null;
}

function makeMembers(species, count, random) {
  const cetacean = CETACEANS.has(species),
    spread = species === 'humpback' ? 18 : cetacean ? 10 : species === 'seagull' ? 5 : 2.2;
  return Array.from({ length: count }, (_, index) => ({
    offsetX:
      species === 'goose'
        ? (index % 2 ? -1 : 1) * Math.ceil(index / 2) * 4
        : index
          ? (random() - 0.5) * spread * 2
          : 0,
    offsetY:
      species === 'goose' ? Math.ceil(index / 2) * 3 : index ? (random() - 0.5) * spread * 2 : 0,
    phase: random() * 24,
    surfaced: !cetacean,
  }));
}

function fitMembersToDeepWater(w, point, members) {
  for (const member of members) {
    for (let attempt = 0; attempt < 8; attempt++) {
      if (depthAt(w, point.x + member.offsetX, point.y + member.offsetY) >= WILDLIFE.deepDepth)
        break;
      member.offsetX *= 0.5;
      member.offsetY *= 0.5;
    }
    if (depthAt(w, point.x + member.offsetX, point.y + member.offsetY) < WILDLIFE.deepDepth) {
      member.offsetX = 0;
      member.offsetY = 0;
    }
  }
  return members;
}

export function spawnWildlife(w, species, options = {}) {
  const state = prepareWildlife(w),
    spec = WILDLIFE_SPECIES[species];
  if (!state || !spec || state.encounters.length >= WILDLIFE.maxEncounters) return null;
  if (!options.force && !speciesAllowed(w, species)) return null;
  const random = seededRandom(wildlifeSeed(w, ++state.serial)),
    point =
      options.point ||
      (options.rock
        ? rockPoint(w, species, random, options.rock)
        : habitatPoint(w, species, random));
  if (!point) return null;
  if (spec.cetacean && depthAt(w, point.x, point.y) < WILDLIFE.deepDepth) return null;
  const count = options.count ?? integer(random, spec.members),
    members = makeMembers(species, count, random),
    born = w.time;
  if (spec.cetacean) fitMembersToDeepWater(w, point, members);
  const encounter = {
    id: `wildlife-${state.area}-${state.serial}`,
    species,
    x: point.x,
    y: point.y,
    heading: options.heading ?? random() * Math.PI * 2,
    speed: spec.speed,
    born,
    expires: born + (options.lifetime ?? range(random, spec.lifetime)),
    state: spec.rock ? (species === 'eagle' ? 'perched' : 'hauled') : 'travelling',
    rockId: point.rockId || options.rock?.id || null,
    members,
  };
  state.encounters.push(encounter);
  if (options.announce !== false)
    w.events.push(
      CETACEANS.has(species)
        ? `WILDLIFE · ${species === 'humpback' ? 'HUMPBACKS' : species.toUpperCase() + 'S'} SIGHTED IN DEEP WATER`
        : `WILDLIFE · ${species === 'seaLion' ? 'SEA LIONS' : species.toUpperCase() + (species === 'eagle' ? '' : 'S')} NEARBY`,
    );
  return encounter;
}

function nearestThreat(w, encounter) {
  const threats = [w.boat, ...(w.traffic?.actors || [])];
  return threats.reduce(
    (nearest, actor) => Math.min(nearest, Math.hypot(encounter.x - actor.x, encounter.y - actor.y)),
    Infinity,
  );
}

function setSurfacing(w, encounter) {
  const cetacean = CETACEANS.has(encounter.species);
  for (const member of encounter.members) {
    if (cetacean) {
      const cycle = encounter.species === 'humpback' ? 22 : 14;
      member.surfaced =
        (w.time - encounter.born + member.phase) % cycle <
        (encounter.species === 'humpback' ? 7 : 5);
    } else if (encounter.species === 'seaLion' && encounter.state === 'diving') {
      member.surfaced = w.time - encounter.reactedAt < 1.4;
    } else member.surfaced = true;
  }
}

function moveEncounter(w, encounter, dt) {
  const spec = WILDLIFE_SPECIES[encounter.species],
    threat = nearestThreat(w, encounter);
  if (
    encounter.species === 'seaLion' &&
    encounter.state === 'hauled' &&
    threat < WILDLIFE.reactionRange
  ) {
    encounter.state = 'diving';
    encounter.reactedAt = w.time;
    encounter.heading = Math.atan2(encounter.x - w.boat.x, w.boat.y - encounter.y);
  }
  if (
    encounter.species === 'eagle' &&
    encounter.state === 'perched' &&
    threat < WILDLIFE.reactionRange
  ) {
    encounter.state = 'takingOff';
    encounter.reactedAt = w.time;
    encounter.heading = Math.atan2(encounter.x - w.boat.x, w.boat.y - encounter.y);
  }
  if (encounter.state === 'takingOff' && w.time - encounter.reactedAt > 1.2)
    encounter.state = 'flying';
  const moving =
    spec.cetacean ||
    encounter.species === 'seagull' ||
    encounter.species === 'goose' ||
    encounter.state === 'flying' ||
    encounter.state === 'takingOff' ||
    encounter.state === 'diving';
  if (!moving) {
    setSurfacing(w, encounter);
    return;
  }
  const speed =
    encounter.state === 'diving'
      ? spec.speed * 1.4
      : encounter.state === 'takingOff'
        ? spec.speed * 0.55
        : spec.speed;
  if (encounter.species === 'seagull')
    encounter.heading += Math.sin(w.time * 0.35 + encounter.members[0].phase) * dt * 0.12;
  const nx = encounter.x + Math.sin(encounter.heading) * speed * dt,
    ny = encounter.y - Math.cos(encounter.heading) * speed * dt,
    inBounds = nx > 8 && ny > 8 && nx < w.terrain.size - 8 && ny < w.terrain.size - 8,
    deepEnough =
      !spec.cetacean ||
      encounter.members.every(
        (member) => depthAt(w, nx + member.offsetX, ny + member.offsetY) >= WILDLIFE.deepDepth,
      );
  if (inBounds && deepEnough) {
    encounter.x = nx;
    encounter.y = ny;
  } else encounter.heading += Math.PI * (0.65 + (encounter.id.length % 3) * 0.08);
  setSurfacing(w, encounter);
}

function restoreTourist(actor) {
  if (!actor.wildlifeRoute) return;
  actor.route = actor.wildlifeRoute.route;
  actor.waypoint = Math.min(actor.wildlifeRoute.waypoint, Math.max(0, actor.route.length - 1));
  delete actor.wildlifeRoute;
  delete actor.followingWildlife;
  delete actor.followRefresh;
}

function updateTourists(w, encounters) {
  const pods = encounters.filter(
    (encounter) =>
      CETACEANS.has(encounter.species) && encounter.members.some((member) => member.surfaced),
  );
  for (const actor of w.traffic?.actors || []) {
    if (actor.kind !== 'tourist') continue;
    let target = pods.find((pod) => pod.id === actor.followingWildlife);
    if (!target) {
      restoreTourist(actor);
      if (!actor.wildlifeCurious) continue;
      target = pods
        .filter((pod) => pointDistance(actor, pod) <= WILDLIFE.touristSight)
        .sort((a, b) => pointDistance(actor, a) - pointDistance(actor, b))[0];
      if (!target) continue;
      actor.wildlifeRoute = { route: actor.route, waypoint: actor.waypoint };
      actor.followingWildlife = target.id;
    }
    if (
      pointDistance(actor, target) > WILDLIFE.touristSight * 1.45 ||
      target.expires - w.time < 3
    ) {
      restoreTourist(actor);
      continue;
    }
    if (w.time < (actor.followRefresh || 0)) continue;
    const side = actor.id.charCodeAt(actor.id.length - 1) % 2 ? 1 : -1,
      follow = {
        x: target.x - Math.sin(target.heading) * 28 + Math.cos(target.heading) * 16 * side,
        y: target.y + Math.cos(target.heading) * 28 + Math.sin(target.heading) * 16 * side,
      },
      onward = actor.wildlifeRoute.route.slice(actor.wildlifeRoute.waypoint);
    actor.route = [follow, ...onward];
    actor.waypoint = 0;
    actor.followRefresh = w.time + 4;
  }
}

export function surfacedWildlifePoints(w) {
  const points = [];
  for (const encounter of w.wildlife?.encounters || []) {
    if (!CETACEANS.has(encounter.species) && !PINNIPEDS.has(encounter.species)) continue;
    const radius = encounter.species === 'humpback' ? 24 : encounter.species === 'orca' ? 18 : 12;
    for (const member of encounter.members)
      if (member.surfaced)
        points.push({
          x: encounter.x + member.offsetX,
          y: encounter.y + member.offsetY,
          radius,
        });
  }
  return points;
}

export function stepWildlife(w, dt) {
  const state = prepareWildlife(w);
  if (!state) return;
  state.accumulator += dt;
  while (state.accumulator >= WILDLIFE.tickSeconds) {
    state.accumulator -= WILDLIFE.tickSeconds;
    if (w.time >= state.nextSpawnAt) {
      const random = seededRandom(wildlifeSeed(w, state.scheduleSerial + state.serial + 17));
      if (random() < WILDLIFE.spawnChance && state.encounters.length < WILDLIFE.maxEncounters) {
        const candidates = Object.keys(WILDLIFE_SPECIES).filter((species) =>
          speciesAllowed(w, species),
        );
        if (candidates.length)
          spawnWildlife(w, candidates[Math.floor(random() * candidates.length)], {
            announce: true,
          });
      }
      schedule(w, state);
    }
    for (const encounter of state.encounters) moveEncounter(w, encounter, WILDLIFE.tickSeconds);
    state.encounters = state.encounters.filter(
      (encounter) =>
        w.time < encounter.expires &&
        encounter.x >= 0 &&
        encounter.y >= 0 &&
        encounter.x <= w.terrain.size &&
        encounter.y <= w.terrain.size,
    );
    updateWildlifeInteractions(w);
    updateTourists(w, state.encounters);
  }
}

export function updateWildlifeInteractions(w) {
  const spec = boatSpec(w);
  for (const encounter of w.wildlife?.encounters || []) {
    if (['orca', 'humpback'].includes(encounter.species))
      for (const member of encounter.members) {
        if (!member.surfaced || member.struck) continue;
        const x = encounter.x + member.offsetX,
          y = encounter.y + member.offsetY,
          radius = encounter.species === 'humpback' ? 2.1 : 1.4;
        if (hullDistance(w.boat, x, y, spec) > radius || Math.hypot(w.boat.vx, w.boat.vy) < 0.4)
          continue;
        member.struck = true;
        const fine = encounter.species === 'humpback' ? 50000 : 35000;
        w.day.inspectionFine = (w.day.inspectionFine || 0) + fine;
        if (w.career) {
          w.career.wildlifeStrikes = (w.career.wildlifeStrikes || 0) + 1;
          w.career.dfoAttentionThrough = Math.max(
            w.career.dfoAttentionThrough || 0,
            w.career.day + 6,
          );
          w.career.news.unshift(
            `Whale strike: $${fine.toLocaleString()} fine; increased DFO attention for six days.`,
          );
        }
        w.events.push(`WHALE STRIKE · $${fine.toLocaleString()} FINE · DFO WILL BE WATCHING`);
        w.effects.push({ type: 'warning', x, y });
        if (!w.career?.debugConditions?.godmode)
          w.boat.hullHealth = Math.max(0.05, w.boat.hullHealth - 0.12);
      }
    if (encounter.species === 'seaLion')
      for (const d of w.divers) {
        if (
          !['searching', 'harvesting'].includes(d.state) ||
          Math.hypot(d.x - encounter.x, d.y - encounter.y) > 45
        )
          continue;
        // Predictable windows avoid per-frame random injury; harassment only slows work.
        if ((Math.floor(w.time / 18) + encounter.id.length) % 4 === 0) {
          if (w.time >= (d.seaLionUntil || 0))
            w.events.push(`${d.name}: sea lions pestering me — slower picking here.`);
          d.seaLionUntil = w.time + 8;
        }
      }
  }
}
export const wildlifeWorkRate = (w, d) => (w.time < (d.seaLionUntil || 0) ? 0.55 : 1);
