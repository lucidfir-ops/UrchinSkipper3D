import { COASTS, PHYSICAL_AREAS, coastFor, normalizeCoastAccess } from './coasts.js';
// Tunable fictional working calendar. Day numbers remain monotonic for saves/injuries.
export const SEASON = Object.freeze({
  days: 9,
  openingDays: 9,
  // Nine-day seasons turn over much faster than the former calendar, so surviving
  // stock grows cautiously at each boundary instead of doubling.
  survivorGrowth: 1.35,
  recolonization: 0.004,
});

export const AREA_PROGRESSION = Object.freeze(
  Object.fromEntries(
    PHYSICAL_AREAS.map((area) => [area.id, { ...area, accessCost: coastFor(area.id).accessCost }]),
  ),
);

const AREAS = Object.keys(AREA_PROGRESSION);
export function hasAreaAccess(c, id) {
  if (!c || !AREAS.includes(id)) return true;
  normalizeCoastAccess(c);
  return c.coastAccess.includes(coastFor(id).id);
}
export function seasonStatus(c) {
  const day = ((c.day - 1) % SEASON.days) + 1;
  const open = AREAS.filter((id) => day >= AREA_PROGRESSION[id].openDay);
  const next = AREAS.map((id) => ({ id, ...AREA_PROGRESSION[id] })).find(
    (area) => area.openDay > day,
  );
  return {
    season: Math.floor((c.day - 1) / SEASON.days) + 1,
    day,
    length: SEASON.days,
    daysLeft: SEASON.days - day + 1,
    open,
    label: next
      ? `Season day ${day} · ${next.name} opens day ${next.openDay} · coast permits also required`
      : 'All fifteen subareas seasonally open · coast permits also required',
  };
}
export function areaCalendarOpen(c, id) {
  return !c || !AREAS.includes(id) || seasonStatus(c).open.includes(id);
}
export function areaStatus(c, id) {
  const definition = AREA_PROGRESSION[id];
  if (!c || !definition)
    return { open: true, calendarOpen: true, access: true, definition: null, reason: '' };
  const calendarOpen = areaCalendarOpen(c, id),
    access = hasAreaAccess(c, id);
  return {
    open: calendarOpen && access,
    calendarOpen,
    access,
    definition,
    reason: !calendarOpen
      ? `Area not open — opens season day ${definition.openDay}${access ? '' : ` · ${coastFor(id).name} permit $${definition.accessCost.toLocaleString()}`}`
      : !access
        ? `Area not open — ${coastFor(id).name} permit $${definition.accessCost.toLocaleString()}`
        : '',
  };
}
export function areaOpen(c, id) {
  return areaStatus(c, id).open;
}
export { COASTS };
