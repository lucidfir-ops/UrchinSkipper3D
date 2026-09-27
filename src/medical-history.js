import { diverSpec } from './crew.js';
const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function recordMedical(c, id, outcome, cause, availableDay) {
  if (!c?.people[id]) return;
  const log = (c.people[id].medicalHistory ||= []);
  if (log.some((e) => e.day === c.day && e.outcome === outcome && e.cause === cause)) return;
  log.push({ day: c.day, outcome, cause, availableDay });
}
export function medicalHistoryMarkup(c, id) {
  const r = c.people[id],
    history = r.medicalHistory || [];
  return `<section class="medical-history"><h3>Medical & absence history</h3>${
    history.length
      ? history
          .slice()
          .reverse()
          .map(
            (e) =>
              `<p>Day ${e.day} · <strong>${escape(e.outcome)}</strong><br>${escape(e.cause)} · Eligible day ${e.availableDay}</p>`,
          )
          .join('')
      : '<p>No recorded events. Older saves did not retain absence causes.</p>'
  }</section>`;
}
export function crewStatTable(c, p, record) {
  const base = diverSpec({ crewId: p.id, crewSeed: c.seed, fatigue: 0, experience: 0 }),
    trained = diverSpec({
      crewId: p.id,
      crewSeed: c.seed,
      fatigue: 0,
      experience: record.experience,
    }),
    today = diverSpec({
      crewId: p.id,
      crewSeed: c.seed,
      fatigue: record.fatigue,
      experience: record.experience,
    });
  const rows = [
    ['Holding current', (d) => `${d.holdCurrentKnots.toFixed(2)} kn`],
    ['Swimming', (d) => `${d.searchSpeed.toFixed(2)} m/s`],
    ['Good bag', (d) => `${(30 / d.harvestRate).toFixed(1)} s`],
    ['Working tank', (d) => `${Math.round((d.tankAir - 20) / d.airUse)} s`],
    ['Awareness', (d) => `${d.awareness.toFixed(1)} m`],
  ];
  return `<table class="crew-stats"><caption>Base → level gains → current fatigue (${Math.round(record.fatigue * 100)}%)</caption><thead><tr><th>Ability</th><th>Base</th><th>Trained</th><th>Today</th></tr></thead><tbody>${rows.map(([label, read]) => `<tr><th>${label}</th><td>${read(base)}</td><td>${read(trained)}</td><td>${read(today)}</td></tr>`).join('')}</tbody></table>`;
}
