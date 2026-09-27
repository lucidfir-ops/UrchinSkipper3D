import { ECONOMY } from './career-data.js';

export function insuranceClaims(c) {
  return (
    c.insuranceClaims ??
    (c.history || []).reduce(
      (n, trip) =>
        n +
        (trip.crew || []).reduce(
          (sum, d) => sum + (d.condition === 'deceased' ? 3 : d.condition === 'injured' ? 1 : 0),
          0,
        ),
      0,
    )
  );
}
export const insurancePremium = (c) => ECONOMY.insuranceDaily + insuranceClaims(c) * 25;

// Called inside the existing saved trip-ID settlement guard. Includes DCS.
export function recordInsuranceClaims(w) {
  const changed = (d) =>
    (w.day.careerTrip?.crewConditions?.[d.crewId] ||
      w.career.people[d.crewId]?.condition ||
      'fit') === 'fit';
  const injuries = Math.max(
    w.safety?.injuries || 0,
    w.divers.filter((d) => d.condition === 'injured' && changed(d)).length,
  );
  const fatalities = Math.max(
    w.safety?.fatalities || 0,
    w.divers.filter((d) => d.condition === 'deceased' && changed(d)).length,
  );
  w.career.insuranceClaims = insuranceClaims(w.career) + injuries + fatalities * 3;
}
