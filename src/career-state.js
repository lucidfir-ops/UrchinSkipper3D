import { recordMedical } from './medical-history.js';
import { dayHighlights } from './day-story.js';
import { earlyPassageStrike, earlyStartNotice } from './early-start.js';
import { insurancePremium, recordInsuranceClaims } from './insurance.js';
import { presetAssists } from './assists.js';
import { advanceBuyer } from './buyer.js';
import { AREA_PROGRESSION, seasonStatus } from './season.js';
import { createQuotaAreaState } from './quota-areas.js';
import { COASTS, coastFor, normalizeCoastAccess } from './coasts.js';
import { ECONOMY, FLEET, CREW, UPGRADES, rankOf, roll, cents } from './career-data.js';
import { boatFamily } from './vessel-catalog.js';
import {
  prepareRosters,
  crewProfile,
  poachRefusal,
  joinPlayerCrew,
  advanceCrewMarket,
} from './crew-roster.js';
import { harbourFleetNews } from './fleet-life.js';
import { weatherPlan } from './weather.js';
import { assignCrew } from './crew.js';
import { C } from './config.js';
import { recoverCrewExposure } from './dive-exposure.js';
import { boatSpec, boatDefinition } from './boats.js';
export const freshVessel = (id) => ({
  id,
  hullHealth: 1,
  driveHealth: 1,
  fuel: FLEET[id].fuelCapacity,
  equipment: [],
  lost: false,
});
export function createCareer(seed = 171709, { chooseStarter = false } = {}) {
  const career = {
    version: 1,
    difficulty: 'easy',
    balanceVersion: 2,
    groundVersion: 7,
    seed,
    starterPending: chooseStarter,
    day: 1,
    cash: ECONOMY.startCash,
    debt: 0,
    xp: 0,
    crew: ['ada', 'milo'],
    people: Object.fromEntries(
      CREW.map((p) => [p.id, { condition: 'fit', fatigue: 0, experience: 0, availableDay: 1 }]),
    ),
    fleet: { basic: freshVessel('basic') },
    activeBoat: 'basic',
    // The guided new-career path earns coastal access; fixtures and unguided legacy
    // careers keep the pre-progression access they already represented.
    areaAccess: chooseStarter ? ['near'] : Object.keys(AREA_PROGRESSION),
    coastAccess: chooseStarter ? ['home'] : COASTS.map((coast) => coast.id),
    licenceThrough: ECONOMY.licenceDays,
    insured: true,
    market: 1,
    knowledge: {},
    marks: [],
    stock: {},
    history: [],
    records: {
      days: 0,
      totalCatch: 0,
      totalRevenue: 0,
      bestLoad: 0,
      bestReturn: 0,
      longestDayMinutes: 0,
      managedFatigue: {},
      incidents: 0,
    },
    news: ['The harbour is quiet. Ada and Milo are ready to work.'],
    lastSettled: null,
    assists: presetAssists('easy'),
  };
  career.quotaAreas = createQuotaAreaState(career);
  prepareRosters(career);
  return career;
}
export const equipment = (w) => w.career?.fleet[w.boat.configuration]?.equipment || [];
export function syncVessel(w) {
  if (!w.career) return;
  const v = w.career.fleet[w.boat.configuration];
  if (v) {
    w.career.activeBoat = w.boat.configuration;
    Object.assign(v, {
      hullHealth: w.boat.hullHealth,
      driveHealth: w.boat.driveHealth,
      fuel: w.boat.fuel,
      lost: !!w.boat.sinking,
    });
  }
}
export function useVessel(w, id) {
  const c = w.career,
    v = c.fleet[id];
  if (w.day.phase !== 'planning' || !v || v.lost)
    return { ok: false, reason: 'Fit a seaworthy owned boat at harbour.' };
  syncVessel(w);
  c.activeBoat = id;
  Object.assign(w.boat, {
    configuration: id,
    hullHealth: v.hullHealth,
    driveHealth: v.driveHealth,
    fuel: v.fuel,
    throttle: 0,
    rudder: 0,
    thruster: 0,
    turn: 0,
    vx: 0,
    vy: 0,
    sinking: false,
    grounded: false,
  });
  return { ok: true };
}
export function hireCrew(w, id, slot) {
  const c = w.career,
    p = crewProfile(c, id),
    r = c.people[id];
  if (w.day.phase !== 'planning') return { ok: false, reason: 'Arrange crew at harbour.' };
  if (!p || ![0, 1].includes(slot)) return { ok: false, reason: 'Choose a crew berth.' };
  const contact = crewContact(c, p);
  if (contact) return { ok: false, reason: contact };
  if (r.condition !== 'fit' || r.availableDay > c.day)
    return {
      ok: false,
      reason:
        r.condition === 'deceased' ? 'Lost at sea.' : `Unavailable until day ${r.availableDay}.`,
    };
  const other = c.crew.indexOf(id);
  const previous = c.crew[slot];
  if (!joinPlayerCrew(c, id)) return { ok: false, reason: poachRefusal(c, id) };
  if (other >= 0 && other !== slot) [c.crew[other], c.crew[slot]] = [c.crew[slot], id];
  else c.crew[slot] = id;
  if (!c.crew.includes(previous) && c.people[previous]?.employer === 'player')
    c.people[previous].employer = null;
  assignCrew(w);
  return { ok: true };
}
export function buyVessel(w, id) {
  const c = w.career,
    def = FLEET[id];
  if (!def || w.day.phase !== 'planning')
    return { ok: false, reason: 'Visit the harbour boatyard.' };
  if (c.fleet[id] && !c.fleet[id].lost) return useVessel(w, id);
  if (rankOf(c) < def.rank) return { ok: false, reason: 'This seller needs more working history.' };
  if (c.cash < def.price)
    return {
      ok: false,
      reason: 'Insufficient cash. Financing is available from Harbour accounts.',
    };
  c.cash = cents(c.cash - def.price);
  c.fleet[id] = freshVessel(id);
  return useVessel(w, id);
}
export function buyEquipment(w, id) {
  const c = w.career,
    item = UPGRADES.find((x) => x.id === id);
  if (w.day.phase !== 'planning' || !item)
    return { ok: false, reason: 'Fit equipment at harbour.' };
  if (item.boats && !item.boats.includes(boatFamily(w.boat.configuration)))
    return {
      ok: false,
      reason: 'This retrofit is for the Harbour Workhorse. Other hulls use their own fittings.',
    };
  if (equipment(w).includes(id)) return { ok: false, reason: 'Already fitted to this boat.' };
  if (rankOf(c) < item.rank)
    return { ok: false, reason: 'Not yet available through your contacts.' };
  if (c.cash < item.price) return { ok: false, reason: 'Insufficient cash.' };
  c.cash = cents(c.cash - item.price);
  equipment(w).push(id);
  if (item.slot === 'timepiece') {
    c.preferences ??= {};
    c.preferences.timepiece = id;
  }
  if (id === 'tank') c.fleet[w.boat.configuration].auxTankLitres = ECONOMY.auxTankLitres;
  return { ok: true };
}
export function buyAreaAccess(w, id) {
  const c = w.career,
    area = coastFor(id);
  if (!area || w.day.phase !== 'planning')
    return { ok: false, reason: 'Area permits are arranged at the harbour office.' };
  normalizeCoastAccess(c);
  if (c.coastAccess.includes(area.id))
    return { ok: false, reason: `${area.name} access is already held.` };
  if (c.cash < area.accessCost)
    return { ok: false, reason: `Insufficient cash for ${area.name} access.` };
  c.cash = cents(c.cash - area.accessCost);
  c.coastAccess.push(area.id);
  return {
    ok: true,
    reason: `${area.name} access granted for all three subareas; seasonal openings are days 1, 3 and 5.`,
  };
}

export function repairQuote(w) {
  const def = boatDefinition(w.boat.configuration);
  return cents((1 - w.boat.hullHealth) * 18000 + (1 - w.boat.driveHealth) * def.repairCost);
}
export function serviceBoat(w, kind) {
  const c = w.career;
  if (w.day.phase !== 'planning') return { ok: false, reason: 'Service is at harbour.' };
  if (w.boat.sinking) return { ok: false, reason: 'The vessel was lost; acquire a replacement.' };
  let cost = 0;
  if (kind === 'fuel')
    cost = cents(Math.max(0, boatSpec(w).fuelCapacity - w.boat.fuel) * ECONOMY.fuelPrice);
  if (kind === 'repair') cost = repairQuote(w);
  if (kind === 'licence') {
    if (c.licenceThrough >= c.day)
      return { ok: false, reason: `Licence already valid through day ${c.licenceThrough}.` };
    cost = ECONOMY.licenceCost;
  }
  if (c.cash < cost) return { ok: false, reason: 'Insufficient cash for this work.' };
  c.cash = cents(c.cash - cost);
  if (kind === 'fuel') w.boat.fuel = boatSpec(w).fuelCapacity;
  if (kind === 'repair') {
    const hours = Math.ceil(
      (1 - w.boat.driveHealth) * boatDefinition(w.boat.configuration).repairHours,
    );
    Object.assign(w.boat, { hullHealth: 1, driveHealth: 1 });
    c.yardDays = Math.max(c.yardDays || 0, Math.floor(hours / 24));
  }
  if (kind === 'licence') c.licenceThrough = c.day + ECONOMY.licenceDays - 1;
  syncVessel(w);
  return {
    ok: true,
    reason:
      kind === 'repair' && c.yardDays
        ? `Major yard work: ${c.yardDays} lay days. Rest at harbour to complete it.`
        : 'Ready.',
  };
}
export function credit(w, repay = false) {
  const c = w.career;
  if (w.day.phase !== 'planning') return { ok: false, reason: 'Accounts are handled at harbour.' };
  const limit = ECONOMY.creditBase + rankOf(c) * ECONOMY.creditPerRank;
  const amount = repay
    ? Math.min(5000, c.debt, Math.max(0, c.cash))
    : ECONOMY.developmentCredit
      ? 5000
      : Math.min(5000, limit - c.debt);
  if (amount <= 0)
    return { ok: false, reason: repay ? 'Nothing available to repay.' : 'Credit limit reached.' };
  c.debt = cents(c.debt + (repay ? -amount : amount));
  c.cash = cents(c.cash + (repay ? -amount : amount));
  return { ok: true };
}
export function departureReady(w) {
  if (w.day.dump) return 'Finish dumping the bag before travelling.';
  if (!w.career) return '';
  const c = w.career;
  if (c.starterPending) return 'Choose your first boat at the harbour.';
  if (c.yardDays > 0) return `${c.yardDays} yard days remain. Rest at harbour.`;
  if (w.boat.sinking || w.boat.hullHealth <= 0)
    return 'Vessel lost. Acquire a replacement at harbour.';
  if (!w.divers.some((d) => d.condition === 'fit')) return 'Hire at least one fit diver.';
  if (w.boat.hullHealth < 0.2 || w.boat.driveHealth <= 0)
    return 'Repair the boat before departure.';
  if (c.cash < 0) return 'Operating account overdrawn. Arrange financing or dock work.';
  return '';
}
export function startCareerTrip(w) {
  const c = w.career;
  if (!c || w.day.careerTrip) return;
  c.insured = true;
  w.day.careerTrip = {
    id: `${c.seed}:${c.day}:${c.records.days}`,
    insured: c.insured,
    crew: [...c.crew],
    crewConditions: Object.fromEntries(w.divers.map((d) => [d.crewId, d.condition])),
    licenceValid: c.licenceThrough >= c.day,
    startedMinute: w.day.minute,
  };
  w.day.assisted ||=
    c.debugConditions?.godmode === true || Object.values(c.assists).some((v) => v === true);
  if (w.day.minute < 420)
    for (const d of w.divers) d.fatigue = Math.min(1, (d.fatigue || 0) + ECONOMY.earlyFatigue);
  earlyPassageStrike(w);
  if (c.insured) {
    w.day.insurancePaid = insurancePremium(c);
    c.cash = cents(c.cash - w.day.insurancePaid);
  }
}
export function chargeTransit(w, minutes) {
  if (!w.career || w.career.debugConditions?.godmode) return;
  const litres = Math.min(w.boat.fuel, (minutes / 60) * FLEET[w.boat.configuration].travelBurn);
  w.boat.fuel -= litres;
  w.boat.fuelUsed += litres;
  w.costs.fuel += litres * ECONOMY.fuelPrice;
}
export function settleCareer(w, result) {
  const c = w.career;
  if (!c || w.day.phase === 'practice' || !w.day.careerTrip) return;
  const trip = w.day.careerTrip;
  if (c.lastSettled === trip.id) return;
  const active = w.divers.filter((d) => d.crewId && d.condition !== 'unavailable'),
    attributed = result.catchValues || {};
  const assigned = Object.values(attributed).reduce((n, v) => n + v, 0),
    legacy = Math.max(0, result.value - assigned) / Math.max(1, active.length);
  const shares = active.map((d) => {
    const p = crewProfile(c, d.crewId),
      value = (attributed[p.id] || 0) + legacy;
    return {
      id: p.id,
      name: p.name,
      share: ECONOMY.crewShare,
      catchValue: cents(value),
      pay: cents(value * ECONOMY.crewShare),
    };
  });
  for (const share of shares) {
    const record = c.people[share.id];
    record.earnings = cents((record.earnings || 0) + share.pay);
    record.trips = (record.trips || 0) + 1;
  }
  const crewPay = shares.reduce((n, p) => n + p.pay, 0),
    interest = cents(c.debt * ECONOMY.interest),
    insurance =
      result.sunk && trip.insured
        ? cents(FLEET[w.boat.configuration].price * ECONOMY.insuranceCover)
        : 0;
  const cost = cents(
    (w.costs.fuel || 0) +
      (w.costs.rescue || 0) +
      ECONOMY.landingFee +
      crewPay +
      interest +
      (w.day.inspectionFine || 0),
  );
  const net = cents(result.value - cost + insurance);
  c.cash = cents(c.cash + net + (w.costs.fuel || 0));
  c.xp += Math.round(result.landed / 5) + (result.gross > 0 ? 100 : 20);
  c.records.days++;
  c.records.totalCatch += result.gross;
  c.records.totalRevenue += result.value;
  c.records.bestLoad = Math.max(c.records.bestLoad, result.gross);
  c.records.bestReturn = Math.max(c.records.bestReturn, net);
  const workedMinutes = Math.max(0, result.arrival - (trip.startedMinute ?? C.day.startMinute)),
    peakFatigue = Math.max(0, ...w.divers.map((d) => d.fatigue || 0));
  c.records.longestDayMinutes = Math.max(c.records.longestDayMinutes || 0, workedMinutes);
  c.records.managedFatigue ??= {};
  for (const threshold of [360, 480])
    if (workedMinutes >= threshold)
      c.records.managedFatigue[threshold] = Math.min(
        c.records.managedFatigue[threshold] ?? 1,
        peakFatigue,
      );
  c.records.safeDays =
    (c.records.safeDays || 0) +
    (!w.safety?.injuries && !w.safety?.fatalities && !result.sunk ? 1 : 0);
  c.records.incidents +=
    (w.safety?.injuries || 0) + (w.safety?.fatalities || 0) + (result.sunk ? 1 : 0);
  recordInsuranceClaims(w);
  for (const d of w.divers)
    if (d.crewId) {
      const p = c.people[d.crewId];
      // Long returns cost sleep even when the diver is already on deck.
      p.fatigue = Math.min(1, (d.fatigue || 0) + (Math.max(0, result.arrival - 1140) / 60) * 0.025);
      p.experience += (d.workedSeconds || 0) * 10;
      if (d.condition === 'deceased') {
        p.condition = 'deceased';
        p.availableDay = 999999;
      } else if (d.condition === 'injured') {
        p.condition = 'injured';
        p.injuryCause =
          w.safety?.incidents?.find((incident) => incident.diverId === d.id)?.cause ||
          p.injuryCause ||
          'working injury';
        p.availableDay = Math.max(p.availableDay || 0, c.day + 3);
        recordMedical(c, d.crewId, 'Injured', p.injuryCause, p.availableDay);
      }
    }
  for (const crew of result.crew || []) {
    const diver = w.divers.find((d) => d.id === crew.id),
      record = diver?.crewId ? c.people[diver.crewId] : null;
    if (record)
      Object.assign(crew, {
        condition: record.condition,
        availableDay: record.availableDay,
        injuryCause: record.injuryCause || null,
      });
  }
  syncVessel(w);
  c.lastSettled = trip.id;
  result.career = {
    day: c.day,
    shares,
    crewPay,
    landingFee: ECONOMY.landingFee,
    interest,
    insurance,
    premium: w.day.insurancePaid || 0,
    fine: w.day.inspectionFine || 0,
    cash: c.cash,
    debt: c.debt,
    rank: rankOf(c),
    cashChange: cents(net + (w.costs.fuel || 0)),
  };
  result.expenses = cost + (w.day.insurancePaid || 0);
  result.netValue = cents(net - (w.day.insurancePaid || 0));
  result.priceIsPrototype = false;
  result.highlights = dayHighlights(w, result);
  c.history.unshift({
    id: trip.id,
    day: c.day,
    ground: w.day.groundId,
    subAreaId: w.day.subAreaId,
    gross: result.gross,
    net: result.netValue,
    value: result.value,
    onTime: result.onTime,
    sunk: result.sunk,
    crew: result.crew,
    highlights: result.highlights,
  });
  c.history = c.history.slice(0, 60);
}
export function advanceCareer(c, days = 1) {
  c.previousWeatherPlan = { day: c.day, periods: c.weatherPlan || weatherPlan(c) };
  c.day += days;
  recoverCrewExposure(c, (c.day - 1) * 1440 + C.day.startMinute);
  advanceBuyer(c);
  c.weatherPlan = weatherPlan(c);
  c.yardDays = Math.max(0, (c.yardDays || 0) - days);
  c.market = 0.85 + roll(c.seed, c.day) * 0.35;
  c.news = [seasonStatus(c).label + ` · ${seasonStatus(c).daysLeft} days remain in this opening.`];
  for (const [id, r] of Object.entries(c.people)) {
    const p = crewProfile(c, id);
    if (!p) continue;
    r.fatigue = Math.max(0, r.fatigue - ECONOMY.restRecovery * days);
    if (r.condition === 'injured' && r.availableDay <= c.day) {
      r.condition = 'fit';
      recordMedical(
        c,
        id,
        'Returned to duty',
        r.injuryCause || 'Recovered from working injury',
        c.day,
      );
    }
    if (
      r.condition === 'fit' &&
      roll(c.seed + c.day * 717, p.id.length + p.name.length) < (1 - p.reliability) * 0.3
    ) {
      r.availableDay = c.day + 1;
      recordMedical(
        c,
        id,
        'Unfit for work',
        'Reported unwell before departure; one day ashore.',
        r.availableDay,
      );
      if (c.crew.includes(p.id))
        c.news.push(`${p.name}: cannot make the boat today. A replacement is needed.`);
    }
  }
  advanceCrewMarket(c);
  c.news.push(...harbourFleetNews(c));
  if (!c.news.length)
    c.news.push(
      c.day % 5 === 0
        ? 'The mechanic has a pocket watch on the counter. Nobody knows whose it is.'
        : 'Coffee on the wharf. Another working day.',
    );
  if (c.licenceThrough < c.day)
    c.news.unshift('Your area licence has expired. Renew before fishing.');
}

export function changeDepartureTime(w, early = false) {
  if (w.day.phase !== 'planning') return { ok: false, reason: 'Choose departure time at harbour.' };
  const earliest = w.day.earliestDeparture || 300;
  if (early && earliest > 300)
    return {
      ok: false,
      reason: w.day.morningOffload
        ? 'Morning offload at 06:00; departure cannot be earlier than 09:00.'
        : 'The morning is already committed. Rest and fish the following day.',
    };
  if (!early && w.day.minute >= 1080)
    return {
      ok: false,
      reason: 'Too late for an ordinary departure. Sleep and plan the next day.',
    };
  w.day.minute = early ? 300 : w.day.minute + 30;
  if (!early) w.day.earliestDeparture = w.day.minute;
  return {
    ok: true,
    ...(early
      ? {
          reason: earlyStartNotice(w),
        }
      : {}),
  };
}

export function vesselSaleQuote(w, id) {
  const v = w.career?.fleet[id];
  if (!v || v.lost) return 0;
  const hull = FLEET[id].price * (0.6 * v.hullHealth + 0.4 * v.driveHealth),
    fittings = v.equipment.reduce(
      (sum, id) => sum + (UPGRADES.find((x) => x.id === id)?.price || 0),
      0,
    );
  return cents((hull + fittings) * ECONOMY.resaleFraction + v.fuel * ECONOMY.fuelPrice * 0.5);
}
export function sellVessel(w, id) {
  if (w.day.phase !== 'planning' || id === w.career.activeBoat)
    return { ok: false, reason: 'Fit another boat before selling this one.' };
  const quote = vesselSaleQuote(w, id);
  if (!quote) return { ok: false, reason: 'No seaworthy owned boat to sell.' };
  w.career.soldVessels ??= [];
  w.career.soldVessels.push({
    ...structuredClone(w.career.fleet[id]),
    day: w.career.day,
    sale: quote,
  });
  delete w.career.fleet[id];
  w.career.cash = cents(w.career.cash + quote);
  return { ok: true, reason: 'Vessel sold; ownership history retained.' };
}

export function crewContact(c, p) {
  const refusal = poachRefusal(c, p.id);
  if (refusal) return refusal;
  if (c.sandbox && c.testContacts) return '';
  const recentIncidents = c.history
    .slice(0, 6)
    .reduce(
      (n, trip) => n + (trip.crew || []).filter((d) => d.condition && d.condition !== 'fit').length,
      0,
    );
  if (p.rank && recentIncidents >= 2)
    return 'Bring the crew home safely for a few working days; recent injuries make this diver reluctant.';
  if (rankOf(c) < p.rank) return 'Build your working reputation for this contact.';
  if (p.rank) {
    const paid = Object.values(c.people).reduce((n, r) => n + (r.earnings || 0), 0),
      trips = Object.values(c.people).reduce((n, r) => n + (r.trips || 0), 0),
      average = paid / Math.max(1, trips),
      required = ECONOMY.contactEarnings[p.rank],
      goal = ECONOMY.contactGoals[p.rank],
      fatigue = c.records.managedFatigue?.[goal.longestDayMinutes],
      missing = [];
    if (average < required) missing.push(`$${required} average crew return`);
    if ((c.records.totalCatch || 0) < goal.totalCatch)
      missing.push(`${goal.totalCatch.toLocaleString()} lb total catch`);
    if ((c.records.bestLoad || 0) < goal.bestLoad)
      missing.push(`${goal.bestLoad.toLocaleString()} lb in one day`);
    if ((c.records.bestReturn || 0) < goal.bestReturn)
      missing.push(`$${goal.bestReturn.toLocaleString()} best net day`);
    if ((c.records.totalRevenue || 0) < goal.totalRevenue)
      missing.push(`$${goal.totalRevenue.toLocaleString()} total sales`);
    if ((c.records.safeDays || 0) < goal.safeDays) missing.push(`${goal.safeDays} safe days`);
    if ((c.records.longestDayMinutes || 0) < goal.longestDayMinutes)
      missing.push(`${Math.round(goal.longestDayMinutes / 60)}-hour working day`);
    else if (fatigue == null || fatigue > goal.maximumLongDayFatigue)
      missing.push(
        `${Math.round(goal.longestDayMinutes / 60)}-hour day at ${Math.round(goal.maximumLongDayFatigue * 100)}% fatigue or less`,
      );
    if (missing.length)
      return `This diver wants stronger operating records: ${missing.join('; ')}. Current average crew return $${Math.round(average)}.`;
  }
  return '';
}
