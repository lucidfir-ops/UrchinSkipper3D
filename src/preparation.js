import { earlyStartNotice } from './early-start.js';
import { conditionsAt } from './weather.js';
import { boatSpec } from './boats.js';
import { GROUNDS, groundTrip, passageMinutes } from './day.js';
import { assist, gear } from './assists.js';
import { engineState } from './operating-state.js';
export const PREPARATION = {
  reserveMinutes: 15,
  workingThrottle: 0.45,
  workAllowanceMinutes: 60,
  lowTankFraction: 0.1,
};
export function fuelPlan(w, id = w.day.groundId || 'near') {
  const spec = boatSpec(w),
    ground = GROUNDS.find((g) => g.id === id) || GROUNDS[0],
    route = groundTrip(w, ground.id);
  const rate = spec.travelBurn || 22,
    homeMinutes = passageMinutes(w, ground),
    outboundMinutes = w.day.phase === 'planning' || w.day.groundId !== id ? route.minutes : 0;
  const outbound = (outboundMinutes / 60) * rate,
    home = (homeMinutes / 60) * rate,
    reserve = (PREPARATION.reserveMinutes / 60) * rate;
  const workRate = rate * (0.07 + 0.93 * PREPARATION.workingThrottle),
    afterTravel = w.boat.fuel - outbound - home;
  return {
    outboundMinutes,
    homeMinutes,
    outbound,
    home,
    reserve,
    required: outbound + home + reserve,
    arrivalFuel: w.boat.fuel - outbound,
    workingMinutes: Math.max(0, ((afterTravel - reserve) / workRate) * 60),
    workingAllowance: (workRate * PREPARATION.workAllowanceMinutes) / 60,
    shortfall: Math.max(0, outbound + home + reserve - w.boat.fuel),
    canGetHome: afterTravel >= 0,
  };
}
export function departureBriefing(w, id) {
  const route = groundTrip(w, id),
    fuel = fuelPlan(w, id),
    notes = [],
    weather = w.career ? conditionsAt(w, route.arrival, id) : w.weather;
  if (!route.ok) notes.push({ level: 'stop', text: route.reason });
  if (!fuel.canGetHome)
    notes.push({
      level: 'danger',
      text: 'Not enough fuel for the outward and home passages. Refuel before sailing.',
    });
  else if (fuel.shortfall > 0)
    notes.push({
      level: 'danger',
      text: 'Home passage leaves no fuel reserve. Refuel before sailing.',
    });
  else if (fuel.workingMinutes < PREPARATION.workAllowanceMinutes)
    notes.push({
      level: 'warn',
      text: `Only about ${Math.floor(fuel.workingMinutes)} minutes of local work before the home reserve.`,
    });
  if (w.career) {
    notes.push({
      level: 'normal',
      clock: true,
      text: w.day.morningOffload
        ? 'Morning offload 06:00 → ready to depart 09:00. No 05:00 option today. Harbour menus pause the clock.'
        : 'Harbour menus pause the clock. Wake the crew at 05:00 (+6% fatigue), or let them sleep until 07:00.',
    });
    if (w.day.minute < 420) notes.push({ level: 'danger', text: earlyStartNotice(w) });
    const crew = w.divers.filter((d) => d.condition !== 'fit');
    if (crew.length)
      notes.push({
        level: 'warn',
        text: crew.map((d) => `${d.name}: ${d.condition}`).join(' · ') + ' · review your crew',
      });
    if (w.divers.some((d) => (d.fatigue || 0) > 0.4))
      notes.push({ level: 'warn', text: 'Crew are tired. A shorter day or a rest day will help.' });
    if (w.career.licenceThrough < w.career.day)
      notes.push({ level: 'danger', text: 'Area licence expired. Renew at the harbour office.' });
  }
  if (w.boat.driveHealth < 0.8 || w.boat.hullHealth < 0.8)
    notes.push({
      level: 'warn',
      text: 'Boat damage: review repairs before committing to this passage.',
    });
  if (route.arrival >= route.depart)
    notes.push({
      level: 'danger',
      text: 'This departure leaves no fishing time before the homebound offload deadline.',
    });
  if (weather?.wave > boatSpec(w).waveTolerance)
    notes.push({
      level: 'warn',
      text: 'Sea conditions exceed this boat’s comfortable working range.',
    });
  if (weather?.night && !gear(w, 'lights'))
    notes.push({
      level: 'warn',
      text: 'Unlit night departure: visibility and the recovery area are limited.',
    });
  return {
    route,
    fuel,
    notes,
    guided: assist(w, 'departureGuidance'),
    timeAvailable: Math.max(0, route.depart - route.arrival),
  };
}
export function fuelStatus(w) {
  const engine = engineState(w),
    plan = fuelPlan(w),
    litres = w.boat.fuel;
  if (!engine.powered) return { level: 'danger', text: engine.label, detail: engine.action, plan };
  if (w.day.phase === 'working' && litres < plan.home)
    return {
      level: 'danger',
      text: 'FUEL BELOW HOME PASSAGE',
      detail: 'Recover the crew. Radio for a tow if you cannot make harbour.',
      plan,
    };
  if (w.day.phase === 'working' && litres < plan.home + plan.reserve)
    return {
      level: 'warn',
      text: 'HOME FUEL RESERVE REACHED',
      detail: 'Recover the crew and head home.',
      plan,
    };
  if (litres < boatSpec(w).fuelCapacity * PREPARATION.lowTankFraction)
    return { level: 'warn', text: 'LOW FUEL', detail: 'Check range before continuing.', plan };
  return {
    level: 'normal',
    text: 'Fuel aboard',
    detail:
      w.day.phase === 'working' ? `Home reserve ${Math.ceil(plan.home + plan.reserve)} L` : '',
    plan,
  };
}
export function updateFuelWarnings(w) {
  if (!w.career || w.day.phase !== 'working') return;
  const status = fuelStatus(w),
    key = status.text;
  if (key !== w.day.lastFuelStatus) {
    if (status.level !== 'normal') w.events.push(`${key} · ${status.detail}`);
    w.day.lastFuelStatus = key;
  }
}
