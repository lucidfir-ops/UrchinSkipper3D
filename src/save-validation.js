import { diverSpec } from './crew.js';
import { FLEET } from './career-data.js';
import { crewProfile } from './crew-roster.js';
import { VESSEL_ART } from './vessel-catalog.js';
import { DEPARTURE_SECONDS } from './departure-transition.js';
import { QUOTA_AREA_IDS, SUB_AREAS } from './quota-areas.js';
import { WILDLIFE, WILDLIFE_SPECIES } from './wildlife.js';
import { WEATHER } from './weather.js';
import { COASTS } from './coasts.js';
import { careerDayAt } from './career-calendar.js';
import { SEASON } from './season.js';
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
    if (v.workLightMode !== undefined)
      assert(['off', 'auto', 'on'].includes(v.workLightMode), 'work light mode');
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
  // A completed voyage may already have advanced the fleet through its booked
  // offload/overnight interval while preparing the next harbour world.
  const calendarDay = Math.max(
    careerDayAt({ career: c, day: data.day }),
    data.day.phase === 'complete'
      ? c.day + Math.max(1, Math.floor((data.day.result?.offloadMinute || data.day.minute) / 1440))
      : 0,
  );
  if (c.fleetDay !== undefined)
    assert(
      Number.isInteger(c.fleetDay) && c.fleetDay >= 0 && c.fleetDay <= calendarDay,
      'rival calendar',
    );
  if (c.groundRecoverySeason !== undefined)
    assert(
      Number.isInteger(c.groundRecoverySeason) &&
        c.groundRecoverySeason >= 1 &&
        c.groundRecoverySeason <= Math.max(1, Math.floor((calendarDay - 1) / SEASON.days) + 1),
      'ground recovery calendar',
    );
  if (c.todayFleet !== undefined)
    assert(
      Array.isArray(c.todayFleet) &&
        c.todayFleet.length <= 100 &&
        c.todayFleet.every(
          (r) =>
            r &&
            typeof r.id === 'string' &&
            (r.day === undefined || (Number.isInteger(r.day) && r.day === c.fleetDay)) &&
            ['gross', 'qualitySum', 'goal', 'minute', 'begin', 'end'].every((key) =>
              finite(r[key], 0),
            ) &&
            r.end > r.begin,
        ),
      'rival daily ledger',
    );
  for (const actor of data.traffic?.actors || [])
    if (actor.fleetDay !== undefined)
      assert(
        Number.isInteger(actor.fleetDay) && actor.fleetDay >= 0 && actor.fleetDay <= calendarDay,
        'rival vessel calendar',
      );
  assert(
    finite(data.time, 0) && finite(data.catch, 0) && Array.isArray(data.bags),
    'working totals',
  );
  for (const bag of data.bags) {
    assert(bag && finite(bag.weight, 0) && finite(bag.quality, 0, 1.000001), 'bag totals');
    for (const key of ['harvestMinute', 'recoveredMinute', 'haulSeconds'])
      assert(bag[key] === undefined || finite(bag[key], 0), 'bag history');
  }
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
  for (const key of ['returnPending', 'returnDismissed', 'returnConfirmed'])
    if (data.day[key] !== undefined) assert(typeof data.day[key] === 'boolean', 'return decision');
  if (data.day.returnPending)
    assert(
      ['working', 'practice'].includes(data.day.phase) &&
        data.day.returnFade === undefined &&
        ['north', 'east', 'south', 'west'].includes(data.day.returnExit?.edge) &&
        data.divers?.every((d) => d.state === 'ready'),
      'pending harbour return',
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
  assert(
    data.divers.every((d, index) => d?.id === index),
    'diver berth identities',
  );
  assert(
    data.selectedDiverId === undefined || [0, 1].includes(data.selectedDiverId),
    'selected diver',
  );
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
    assert(finite(d.qualitySum, 0), 'diver quality total');
    for (const key of ['hook', 'diveTime', 'searchTime', 'harvestTime'])
      assert(d[key] === undefined || finite(d[key], 0), 'diver operation clock');
    assert(d.timer === undefined || finite(d.timer, -1), 'diver transition clock');
    assert(
      d.deckWalkStarted == null || finite(d.deckWalkStarted, 0, data.time + 0.001),
      'diver deck arrival',
    );
    if (d.transit != null) {
      const transit = d.transit;
      assert(
        ['descent', 'ascent'].includes(transit.kind) &&
          finite(transit.depth, 0, 1000) &&
          finite(transit.total, 0.01, 120) &&
          finite(d.timer, -1, transit.total + 0.001),
        'diver water-column transit',
      );
      if (transit.kind === 'descent')
        assert(
          typeof transit.fromDeck === 'boolean' &&
            finite(transit.prepareSeconds, 0, transit.total) &&
            finite(transit.entrySeconds, 0, transit.total) &&
            transit.prepareSeconds + transit.entrySeconds <= transit.total &&
            finite(transit.heading),
          'diver entry sequence',
        );
      if (transit.deckStart != null)
        assert(
          finite(transit.deckStart.side, -100, 100) && finite(transit.deckStart.aft, -100, 100),
          'diver deck departure',
        );
    }
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
