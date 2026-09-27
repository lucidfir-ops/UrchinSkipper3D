import { diverSpec } from './crew.js';
import { FLEET } from './career-data.js';
import { crewProfile } from './crew-roster.js';
import { VESSEL_ART } from './vessel-catalog.js';
import { DEPARTURE_SECONDS } from './departure-transition.js';
import { QUOTA_AREA_IDS, SUB_AREAS } from './quota-areas.js';
import { WILDLIFE, WILDLIFE_SPECIES } from './wildlife.js';
import { WEATHER } from './weather.js';
import { COASTS } from './coasts.js';
const finite = (v, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const assert = (condition, message) => {
  if (!condition) throw new Error('Damaged career save: ' + message);
};
export function validateSnapshot(data) {
  const c = data?.career;
  assert(data?.schema === 1 && c?.version === 1, 'unsupported version');
  assert(
    finite(c.cash) &&
      finite(c.debt, 0) &&
      finite(c.xp, 0) &&
      Number.isInteger(c.day) &&
      (c.day >= 1 || (c.day === 0 && ['briefing', 'active'].includes(c.intro?.status))),
    'career totals',
  );
  if (c.debugConditions !== undefined)
    assert(
      c.debugConditions &&
        ['natural', ...Object.keys(WEATHER)].includes(c.debugConditions.weather) &&
        (c.debugConditions.tideHeight === null || finite(c.debugConditions.tideHeight, -2, 5)),
      'debug condition overrides',
    );
  if (c.coastAccess !== undefined)
    assert(
      Array.isArray(c.coastAccess) &&
        c.coastAccess.includes('home') &&
        c.coastAccess.every((id) => COASTS.some((coast) => coast.id === id)) &&
        new Set(c.coastAccess).size === c.coastAccess.length,
      'coastal access',
    );
  if (c.debugConditions?.godmode !== undefined)
    assert(typeof c.debugConditions.godmode === 'boolean', 'godmode flag');
  if (c.intro && c.intro.status !== 'complete')
    assert(
      c.day === 0 && Number.isInteger(c.intro.step) && c.intro.step >= 0 && c.intro.step <= 9,
      'introduction progress',
    );
  if (c.intro?.scoutSeconds !== undefined)
    assert(finite(c.intro.scoutSeconds, 0, 60), 'introduction hint timer');
  assert(FLEET[c.activeBoat] && c.fleet?.[c.activeBoat], 'active vessel');
  assert(Array.isArray(c.crew) && c.crew.length === 2 && new Set(c.crew).size === 2, 'crew berths');
  for (const id of c.crew)
    assert(crewProfile(c, id) && !crewProfile(c, id).hidden && c.people?.[id], 'unknown crew');
  for (const record of Object.values(c.people)) {
    if (record.medicalHistory !== undefined)
      assert(
        Array.isArray(record.medicalHistory) &&
          record.medicalHistory.every(
            (e) =>
              e &&
              Number.isInteger(e.day) &&
              e.day >= 0 &&
              typeof e.outcome === 'string' &&
              typeof e.cause === 'string' &&
              Number.isInteger(e.availableDay) &&
              e.availableDay >= 0,
          ),
        'medical history',
      );
    const h = record.diveHealth;
    if (h)
      assert(
        h.version === 1 &&
          [
            'load',
            'strain',
            'hazard',
            'clock',
            'bottomMinutes',
            'lastDiveDay',
            'consecutiveDays',
            'dcsCount',
          ].every((k) => finite(h[k], 0)) &&
          finite(h.threshold, 0.01, 2.3) &&
          typeof h.pending === 'boolean',
        'dive exposure',
      );
  }
  for (const [id, v] of Object.entries(c.fleet)) {
    assert(
      FLEET[id] && finite(v.fuel, 0) && finite(v.hullHealth, 0, 1) && finite(v.driveHealth, 0, 1),
      'vessel condition',
    );
    assert(Array.isArray(v.equipment), 'vessel fittings');
    if (v.disabledEquipment !== undefined)
      assert(
        Array.isArray(v.disabledEquipment) &&
          v.disabledEquipment.every((id) => v.equipment.includes(id)),
        'equipment switches',
      );
  }
  assert(
    (['planning', 'working', 'complete'].includes(data.day?.phase) ||
      (data.day?.phase === 'practice' && c.day === 0 && c.intro?.status === 'active')) &&
      finite(data.day.minute, 0),
    'day clock',
  );
  assert(
    finite(data.time, 0) && finite(data.catch, 0) && Array.isArray(data.bags),
    'working totals',
  );
  const b = data.boat;
  if (c.buyerToday)
    assert(
      finite(c.buyerToday.day, 0) &&
        finite(c.buyerToday.minQuality, 0, 1) &&
        finite(c.buyerToday.premium, 0, 1) &&
        (c.buyerToday.target === undefined || finite(c.buyerToday.target, 1)),
      'buyer order',
    );
  if (data.day.dump)
    assert(
      data.day.phase === 'working' &&
        typeof data.day.dump.bagId === 'string' &&
        data.bags.some((bag) => bag.id === data.day.dump.bagId) &&
        finite(data.day.dump.duration, 0.1, 10) &&
        finite(data.day.dump.remaining, 0, data.day.dump.duration),
      'deck operation',
    );
  if (data.day.returnFade !== undefined)
    assert(
      data.day.phase === 'working' &&
        finite(data.day.returnFade, 0, DEPARTURE_SECONDS) &&
        ['north', 'east', 'south', 'west'].includes(data.day.returnExit?.edge) &&
        data.divers?.every((d) => d.state === 'ready'),
      'departure transition',
    );
  assert(
    b &&
      FLEET[b.configuration] &&
      ['x', 'y', 'heading', 'vx', 'vy', 'turn', 'throttle', 'rudder', 'fuel'].every((k) =>
        finite(b[k]),
      ),
    'boat motion',
  );
  assert(b.fuel >= 0 && Math.abs(b.throttle) <= 1 && Math.abs(b.rudder) <= 1, 'helm or fuel');
  assert(Array.isArray(data.divers) && data.divers.length === 2, 'divers');
  if (data.logField !== undefined) {
    assert(
      data.logField.version === 2 &&
        Number.isInteger(data.logField.base) &&
        finite(data.logField.base, 0, 500),
      'log field',
    );
    for (const flag of ['baseAdded', 'night', 'fog'])
      assert(
        data.logField[flag] === undefined || typeof data.logField[flag] === 'boolean',
        'log cohort',
      );
  }
  if (data.rockContacts !== undefined) {
    assert(Array.isArray(data.rockContacts) && data.rockContacts.length <= 100, 'rock contacts');
    for (const r of data.rockContacts) {
      assert(typeof r.id === 'string', 'rock identity');
      for (const flag of ['grace', 'hullTouch', 'driveTouch'])
        assert(r[flag] === undefined || typeof r[flag] === 'boolean', 'rock contact state');
      for (const timer of ['nextHullHit', 'nextDriveHit'])
        assert(r[timer] === undefined || finite(r[timer], 0), 'rock cooldown');
    }
  }
  if (data.traffic) {
    assert(Array.isArray(data.traffic.actors) && data.traffic.actors.length <= 7, 'traffic bounds');
    for (const a of data.traffic.actors)
      assert(
        VESSEL_ART[a.art] &&
          ['taxi', 'tourist', 'dfo', 'rival'].includes(a.kind) &&
          ['x', 'y', 'heading', 'knots', 'width', 'length', 'born', 'waypoint'].every((k) =>
            finite(a[k]),
          ) &&
          a.knots > 0 &&
          a.knots <= 30 &&
          a.width > 0 &&
          a.length > 0 &&
          Array.isArray(a.route) &&
          a.route.length <= 500 &&
          a.route.every((p) => finite(p.x) && finite(p.y)),
        'traffic route',
      );
  }
  if (data.wildlife) {
    assert(
      QUOTA_AREA_IDS.includes(data.wildlife.area) &&
        Number.isInteger(data.wildlife.sectorRevision) &&
        finite(data.wildlife.sectorRevision, 0, 1000000) &&
        Number.isInteger(data.wildlife.serial) &&
        finite(data.wildlife.serial, 0, 1000000) &&
        Number.isInteger(data.wildlife.scheduleSerial) &&
        finite(data.wildlife.scheduleSerial, 0, 1000000) &&
        finite(data.wildlife.accumulator, 0, WILDLIFE.tickSeconds) &&
        Array.isArray(data.wildlife.encounters) &&
        data.wildlife.encounters.length <= WILDLIFE.maxEncounters &&
        finite(data.wildlife.nextSpawnAt, 0),
      'wildlife bounds',
    );
    for (const encounter of data.wildlife.encounters) {
      assert(
        typeof encounter.id === 'string' &&
          WILDLIFE_SPECIES[encounter.species] &&
          ['travelling', 'perched', 'hauled', 'takingOff', 'flying', 'diving'].includes(
            encounter.state,
          ) &&
          (encounter.rockId === null || typeof encounter.rockId === 'string') &&
          (encounter.reactedAt === undefined || finite(encounter.reactedAt, encounter.born)) &&
          ['x', 'y', 'heading', 'speed', 'born', 'expires'].every((key) =>
            finite(encounter[key]),
          ) &&
          encounter.speed >= 0 &&
          encounter.expires >= encounter.born &&
          Array.isArray(encounter.members) &&
          encounter.members.length >= 1 &&
          encounter.members.length <= 8 &&
          encounter.members.every(
            (member) =>
              finite(member.offsetX, -100, 100) &&
              finite(member.offsetY, -100, 100) &&
              finite(member.phase) &&
              typeof member.surfaced === 'boolean',
          ),
        'wildlife encounter',
      );
    }
  }
  for (const d of data.divers) {
    assert(
      d.maxBagSeconds === undefined || [0, 20, 30, 45, 60, 90].includes(d.maxBagSeconds),
      'diver bag time order',
    );
    assert(d.bagWorkSeconds === undefined || finite(d.bagWorkSeconds, 0), 'diver bag clock');
    assert(
      [
        'ready',
        'deploying',
        'searching',
        'harvesting',
        'surfacing',
        'surface',
        'lost',
        'fatality',
      ].includes(d.state),
      'diver state',
    );
    assert(
      finite(d.x) &&
        finite(d.y) &&
        finite(d.bag, 0, 300.001) &&
        finite(d.air, 0, (diverSpec(d).tankAir || 100) + 0.001),
      'diver totals',
    );
  }
  for (const ledger of Object.values(c.stock || {})) {
    assert(Array.isArray(ledger) && ledger.length < 1000, 'stock ledger');
    for (const p of ledger) {
      assert(finite(p.remaining, 0), 'ground stock');
      for (const clump of p.clumps || []) assert(finite(clump.remaining, 0), 'clump stock');
    }
  }
  if (c.quotaAreas !== undefined) {
    const quota = c.quotaAreas,
      areaIds = Object.keys(quota.areas || {}).sort(),
      expectedAreas = (
        quota.version === 1
          ? ['near', 'middle', 'far']
          : quota.version === 2
            ? QUOTA_AREA_IDS.slice(0, 9)
            : [...QUOTA_AREA_IDS]
      ).sort();
    assert(
      [1, 2, 3].includes(quota.version) &&
        Number.isInteger(quota.season) &&
        quota.season >= 1 &&
        Number.isInteger(quota.lastNpcDay) &&
        quota.lastNpcDay >= 0 &&
        JSON.stringify(areaIds) === JSON.stringify(expectedAreas),
      'quota area state',
    );
    for (const areaId of expectedAreas) {
      const subAreas = quota.areas[areaId]?.subAreas;
      assert(
        Array.isArray(subAreas) &&
          subAreas.length === SUB_AREAS.length &&
          subAreas.every((record, index) => record.id === SUB_AREAS[index].id),
        'quota sub-areas',
      );
      for (const record of subAreas) {
        assert(finite(record.health, 0, 1), 'quota health');
        const current = record.current;
        assert(
          current &&
            ['playerCatch', 'npcCatch', 'playerPressure', 'npcPressure', 'npcVisits'].every((key) =>
              finite(current[key], 0),
            ),
          'quota pressure',
        );
        if (record.previous)
          assert(
            Number.isInteger(record.previous.season) &&
              record.previous.season >= 1 &&
              [
                'playerCatch',
                'npcCatch',
                'playerPressure',
                'npcPressure',
                'npcVisits',
                'totalPressure',
                'healthBefore',
                'healthAfter',
              ].every((key) => finite(record.previous[key], 0)),
            'quota history',
          );
      }
    }
  }
}
