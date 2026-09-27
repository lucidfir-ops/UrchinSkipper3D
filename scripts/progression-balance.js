// Deterministic economic sensitivity, not an autopilot or proof of player skill.
// Assumed daily search/pick success feeds real stock, costs, settlement, fatigue,
// injuries, purchases and rollover. Run with: node scripts/progression-balance.js
import '../tests/matter-helper.js';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { careerWorld, nextCareerDay, encode, decode } from '../src/career-save.js';
import {
  createCareer,
  buyAreaAccess,
  buyEquipment,
  buyVessel,
  credit,
  crewContact,
  serviceBoat,
  repairQuote,
  settleCareer,
} from '../src/career-state.js';
import { chooseFirstBoat } from '../src/starter-career.js';
import {
  chooseGround,
  returnToHarbour,
  latestDeparture,
  passageMinutes,
  selectedGround,
} from '../src/day.js';
import { areaOpen } from '../src/season.js';
import { COASTS, coastTier } from '../src/coasts.js';
import { boatSpec } from '../src/boats.js';
import { ECONOMY, CREW, roll } from '../src/career-data.js';
import { takeCatch } from '../src/harvest-ground.js';
import { recordFishingPressure, subAreaYield } from '../src/quota-areas.js';
import { workCrew } from '../src/crew.js';
import { conditionsAt } from '../src/weather.js';
import { C } from '../src/config.js';
import { chooseBuyer, marketOffers } from '../src/buyer.js';

export const STRATEGIES = {
  cautious: {
    target: 1500,
    minutes: 300,
    reserve: 4000,
    patches: 2,
    restEvery: 4,
    maxWave: 0.8,
    upgrades: true,
  },
  competent: {
    target: 3300,
    minutes: 420,
    reserve: 3000,
    patches: 5,
    restEvery: 6,
    maxWave: 1.4,
    upgrades: true,
  },
  aggressive: {
    target: 7000,
    minutes: 540,
    reserve: 1800,
    patches: 9,
    restEvery: 0,
    maxWave: 2.5,
    upgrades: false,
  },
};
export function assessProgression({
  strategy = 'competent',
  seed = 171709,
  boat = 'basic',
  seasons = 3,
  setbacks = true,
  push = true,
  upgradeFirst = false,
  borrow = false,
} = {}) {
  const profile = STRATEGIES[strategy],
    rows = [],
    permits = {},
    purchases = [],
    contacts = {};
  let w = careerWorld(createCareer(seed, { chooseStarter: true }));
  chooseFirstBoat(w, boat);
  if (borrow) credit(w);
  for (let day = 1; day <= seasons * 9; day++) {
    const before = w.career.cash;
    if (
      upgradeFirst &&
      !w.career.fleet.thruster &&
      w.career.cash >= 52000 + profile.reserve &&
      buyVessel(w, 'thruster').ok
    )
      purchases.push({ day, item: 'Coastal Workhorse', cost: 52000 });
    for (const coast of push ? COASTS.slice(1) : []) {
      if (upgradeFirst && coast.id === 'frontier' && !w.career.fleet.thruster) continue;
      if (
        w.career.coastAccess.includes(coast.id) ||
        w.career.cash < coast.accessCost + profile.reserve
      )
        continue;
      const prior = w.career.cash;
      if (buyAreaAccess(w, coast.id).ok) {
        permits[coast.id] = day;
        if (
          buyAreaAccess(w, coast.id).ok ||
          Math.abs(w.career.cash - (prior - coast.accessCost)) > 0.001
        )
          throw new Error('Permit charged more than once');
      }
    }
    if (
      profile.upgrades &&
      w.career.cash > profile.reserve + 1200 &&
      !w.career.fleet[w.boat.configuration].equipment.includes('lights')
    ) {
      if (buyEquipment(w, 'lights').ok) purchases.push({ day, item: 'lights' });
    }
    for (const service of ['fuel', 'repair', 'licence']) serviceBoat(w, service);
    const unavailable = w.divers.some((d) => d.condition !== 'fit'),
      tired = w.divers.some((d) => d.fatigue > (strategy === 'aggressive' ? 0.85 : 0.55));
    if (unavailable || tired || (profile.restEvery && day % profile.restEvery === 0)) {
      rows.push({ day, rest: true, cash: w.career.cash, change: w.career.cash - before });
      w = nextCareerDay(w, { dockWork: unavailable });
      continue;
    }
    const available = COASTS.flatMap((coast) => coast.sectors).filter((id) =>
      areaOpen(w.career, id),
    );
    const usable = available.filter((id) => conditionsAt(w, 780, id).wave <= profile.maxWave);
    const destinations = usable.length ? usable : ['near'];
    const highest = Math.max(...destinations.map(coastTier));
    const pool = destinations.filter((id) => coastTier(id) === highest);
    const id = pool[(day - 1) % pool.length];
    // This fishing strategy now makes the optional buyer decision explicitly.
    // Assume ordinary 60%+ landed catch, without foreknowledge of hidden quality.
    const order = marketOffers(w.career)
      .filter((o) => o.unlocked && o.minQuality <= 0.6)
      .sort(
        (a, b) =>
          Math.min(profile.target, b.target) * b.premium -
          Math.min(profile.target, a.target) * a.premium,
      )[0];
    chooseBuyer(w, order?.id || 'standard');
    const trip = chooseGround(w, id);
    if (!trip.ok) {
      rows.push({ day, rest: true, reason: trip.reason, cash: w.career.cash });
      w = nextCareerDay(w, { dockWork: true });
      continue;
    }
    const workMinutes = Math.max(
        0,
        Math.min(profile.minutes, latestDeparture(w) - w.day.minute - 35),
      ),
      poorCatch = setbacks && day % 9 === 4 ? 0.25 : 1,
      fit = w.divers.filter((d) => d.condition === 'fit'),
      target = Math.min(
        boatSpec(w).capacity,
        profile.target *
          (workMinutes / profile.minutes) *
          poorCatch *
          (0.85 + roll(seed, day + 32) * 0.3),
      );
    // Fixed small sets deliberately expose repeated-ground exhaustion across seasons.
    const patches = w.patches.filter((p) => p.initialStock > 0).slice(0, profile.patches);
    let remaining = target;
    for (const patch of patches)
      for (const clump of patch.clumps || []) {
        if (remaining <= 0) break;
        const amount = takeCatch(
          patch,
          clump,
          remaining * Math.min(1, subAreaYield(w.career, id, w.day.subAreaId)),
        );
        if (!amount) continue;
        const diver = fit[w.bags.length % fit.length];
        w.bags.push({
          weight: amount,
          quality: clump.quality ?? patch.quality,
          harvestMinute: w.day.minute + workMinutes / 2,
          crewId: diver.crewId,
          areaId: id,
          subAreaId: w.day.subAreaId,
        });
        w.catch += amount;
        remaining -= amount;
        recordFishingPressure(w.career, id, w.day.subAreaId, 'player', amount);
      }
    for (let minute = 0; minute < workMinutes; minute++) {
      w.day.minute++;
      for (const diver of fit) workCrew(w, diver, 0.55 / C.day.minutesPerSecond);
    }
    const workFuel = Math.min(
      w.boat.fuel,
      (workMinutes / 60) * boatSpec(w).travelBurn * (0.07 + 0.93 * 0.25),
    );
    w.boat.fuel -= workFuel;
    w.costs.fuel += workFuel * ECONOMY.fuelPrice;
    if (setbacks && day % 12 === 7) {
      w.boat.hullHealth -= 0.06;
      w.boat.driveHealth -= 0.1;
    }
    if (setbacks && day % 15 === 8) {
      w.divers[0].condition = 'injured';
      w.safety = {
        injuries: 1,
        fatalities: 0,
        incidents: [
          { diverId: 0, minute: w.day.minute, outcome: 'injury', cause: 'scenario: boat strike' },
        ],
      };
    }
    const homeFuel = (passageMinutes(w, selectedGround(w)) / 60) * boatSpec(w).travelBurn;
    if (w.boat.fuel < homeFuel) throw new Error('Scenario violated home fuel reserve');
    w.boat.x = w.day.returnExit.edge === 'west' ? -0.01 : w.boat.x;
    w.boat.y = w.day.returnExit.edge === 'south' ? w.terrain.size + 0.01 : w.boat.y;
    const result = returnToHarbour(w);
    if (!result.ok) throw new Error(result.reason);
    const settled = w.career.cash;
    settleCareer(w, result);
    if (settled !== w.career.cash) throw new Error('Settlement replayed');
    for (const person of CREW.filter((p) => p.rank > 0))
      if (!contacts[person.id] && !crewContact(w.career, person)) contacts[person.id] = day;
    rows.push({
      day,
      area: id,
      boat: w.boat.configuration,
      pounds: Math.round(result.gross),
      net: Math.round(result.netValue),
      cash: Math.round(w.career.cash),
      change: Math.round(w.career.cash - before),
      fuel: Math.round(w.costs.fuel),
      crew: Math.round(result.career.crewPay),
      interest: result.career.interest,
      premium: result.career.premium,
      repairDue: repairQuote(w),
      injured: w.safety?.injuries || 0,
    });
    // Reload every trip; both the stock and acquisition records must survive.
    w = decode(encode(w));
    w = nextCareerDay(w);
  }
  return {
    strategy,
    seed,
    boat,
    setbacks,
    push,
    upgradeFirst,
    borrow,
    permits,
    purchases,
    contacts,
    seasons: [1, 2, 3].slice(0, seasons).map((season) => {
      const days = rows.filter((row) => row.day > (season - 1) * 9 && row.day <= season * 9);
      return {
        season,
        cash: days.at(-1).cash,
        pounds: days.reduce((n, row) => n + (row.pounds || 0), 0),
        workingDays: days.filter((row) => !row.rest).length,
      };
    }),
    finalCash: Math.round(w.career.cash),
    finalDebt: w.career.debt,
    rows,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reports = [];
  for (const strategy of Object.keys(STRATEGIES))
    for (const boat of ['basic', 'outboard'])
      for (const seed of [171709, 2026, 77])
        reports.push(assessProgression({ strategy, boat, seed }));
  reports.push(assessProgression({ strategy: 'aggressive', setbacks: false }));
  reports.push(assessProgression({ strategy: 'competent', push: false }));
  reports.push(assessProgression({ strategy: 'aggressive', upgradeFirst: true }));
  reports.push(assessProgression({ strategy: 'competent', borrow: true }));
  mkdirSync('test-results', { recursive: true });
  writeFileSync(
    'test-results/progression-balance.json',
    JSON.stringify(
      {
        method:
          'Economic sensitivity with stated assumed catches; real settlement/stock/fatigue/rollover, no helm or diver AI automation.',
        reports,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      reports.map(({ rows: _rows, ...summary }) => summary),
      null,
      2,
    ),
  );
}
