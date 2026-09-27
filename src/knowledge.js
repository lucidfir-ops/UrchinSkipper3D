import { diverSpec } from './crew.js';
import { bearing } from './math.js';
import { seaLevel } from './terrain.js';
import { soundingDepth } from './hazard-depth.js';
import { gear } from './assists.js';
import { currentAt } from './environment.js';
// Tools make local measurements; they never alter hidden terrain/productivity.
export function instrumentReadings(w) {
  const b = w.boat,
    readings = { depth: soundingDepth(w, b.x, b.y), radar: [], scanner: [] };
  if (gear(w, 'radar'))
    for (const log of [...(w.logs || []), ...(w.traffic?.actors || [])]) {
      const dx = log.x - b.x,
        dy = log.y - b.y,
        distance = Math.hypot(dx, dy);
      if (distance < 130)
        readings.radar.push({
          distance,
          bearing: bearing(dx, dy),
          kind: 'Surface return',
        });
    }
  if (gear(w, 'scanner'))
    for (const offset of [-0.24, 0, 0.24])
      for (const distance of [12, 24, 36]) {
        const angle = b.heading + offset,
          x = b.x + Math.sin(angle) * distance,
          y = b.y - Math.cos(angle) * distance,
          depth = soundingDepth(w, x, y);
        readings.scanner.push({
          x,
          y,
          distance,
          depth: Math.round(depth * 2) / 2,
          habitat:
            depth >= 3 && depth <= 21.3 ? 'Possible working bottom' : 'Outside working depth',
        });
      }
  return readings;
}
export function recordKnowledge(w) {
  if (!w.career || w.day.phase !== 'working' || w.time < (w.nextObservation || 0)) return;
  w.nextObservation = w.time + 2;
  const c = w.career,
    id = w.day.groundId,
    k = (c.knowledge[id] ??= { depths: {}, grounds: {}, visits: 1 }),
    b = w.boat;
  if (gear(w, 'plotter')) {
    recordTrack(k, b, c.day, w.day.trip?.id || w.day.groundId, w.time);
    const key = `${Math.round(b.x / 6)},${Math.round(b.y / 6)}`;
    k.depths[key] = {
      x: b.x,
      y: b.y,
      bed: Math.round((soundingDepth(w, b.x, b.y) - seaLevel(w)) * 2) / 2,
      day: c.day,
    };
  }
  for (const d of w.divers) recordDiverReport(w, d, { automatic: !!diverSpec(d).autoChart });
  if (gear(w, 'scanner') && gear(w, 'plotter'))
    for (const point of instrumentReadings(w).scanner) {
      k.depths[`${Math.round(point.x / 6)},${Math.round(point.y / 6)}`] = {
        x: point.x,
        y: point.y,
        bed: Math.round((point.depth - (w.environment.seaLevel || 0)) * 2) / 2,
        day: c.day,
      };
    }
  // Scanner and sounder share one bounded ledger, including oversized old saves.
  const keys = Object.keys(k.depths);
  for (let i = 0; i < keys.length - 1200; i++) delete k.depths[keys[i]];
}
// Also called immediately before recovery clears the bag and ground reference.
// A short hauler operation must not fall between periodic observations.
export function recordDiverReport(w, d, { recovered = false, automatic = false } = {}) {
  const observed =
    d.patch || (d.state === 'surface' && w.patches.find((p) => p.id === d.groundSample?.patchId));
  if (
    !w.career ||
    w.day.phase !== 'working' ||
    (d.state !== 'surface' && !(automatic && d.state === 'harvesting')) ||
    d.bagHandled ||
    !observed ||
    (observed.charted === false && d.state !== 'surface') ||
    (!recovered && !automatic && Math.hypot(d.x - w.boat.x, d.y - w.boat.y) >= 12)
  )
    return;
  const c = w.career,
    p = observed,
    k = (c.knowledge[w.day.groundId] ??= { depths: {}, grounds: {}, visits: 1 }),
    previous = k.grounds[p.id];
  k.grounds[p.id] = {
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    outline: p.outline?.map((q) => ({ x: Math.round(q.x / 5) * 5, y: Math.round(q.y / 5) * 5 })),
    condition: d.reason?.includes('exhaust')
      ? 'Worked thin at the last dive'
      : 'Sampled; stock beyond the dive is unknown',
    quality: d.bag
      ? Math.round((d.qualitySum / d.bag) * 100) / 100
      : (d.groundSample?.quality ?? previous?.quality ?? null),
    day: c.day,
    reporter: d.name,
    minute: w.day.minute,
    sampleX: d.x,
    sampleY: d.y,
    tide: w.environment.seaLevel || 0,
    tidePhase: (w.environment.tideRate || 0) >= 0 ? 'rising' : 'falling',
    current: { ...currentAt(w, d.x, d.y) },
    report:
      d.bag >= 299 ? 'A full bag' : d.bag ? 'Partial bag' : d.reason || 'No catch on this dive',
  };
  if (p.charted === false && d.reportedDive !== d.diveCount) {
    d.reportedDive = d.diveCount;
    w.events.push(
      `${d.name.toUpperCase()} · UNMARKED GROUND REPORT: ${k.grounds[p.id].report}; ${Math.round((k.grounds[p.id].quality || 0) * 100)}% sampled quality. No charted boundary.`,
    );
  }
}
export function markPosition(w) {
  if (!w.career || w.day.phase !== 'working')
    return { ok: false, reason: 'Mark a position while working at sea.' };
  const marks = w.career.marks;
  if (marks.length >= 100) return { ok: false, reason: 'Chart holds 100 marks.' };
  marks.push({
    id: marks.length + 1,
    sector: w.day.groundId,
    x: w.boat.x,
    y: w.boat.y,
    day: w.career.day,
    label: `Mark ${marks.length + 1}`,
  });
  return { ok: true, reason: 'Position marked on your chart.' };
}

export function reportAge(report, day) {
  const age = Math.max(0, day - report.day);
  return `${age === 0 ? 'Today' : age === 1 ? '1 day ago' : age + ' days ago'} · ${report.reporter ? 'reported by ' + report.reporter : 'earlier diver report'}${report.tidePhase ? ' · tide ' + report.tidePhase : ''}`;
}
export function markReport(w, sector, reportId) {
  const report = w.career.knowledge[sector]?.grounds?.[reportId];
  if (!report || !Number.isFinite(report.sampleX) || !Number.isFinite(report.sampleY))
    return {
      ok: false,
      reason: 'This older report has no recorded sample position. Mark a fresh drift at sea.',
    };
  if (w.career.marks.length >= 100) return { ok: false, reason: 'Chart holds 100 marks.' };
  const id = Math.max(0, ...w.career.marks.map((m) => m.id)) + 1;
  w.career.marks.push({
    id,
    sector,
    x: report.sampleX,
    y: report.sampleY,
    day: report.day,
    label: `Sample ${id} · ${report.quality === null ? 'empty' : Math.round(report.quality * 100) + '%'}`,
    origin: report.reporter,
    tidePhase: report.tidePhase,
  });
  w.career.navigationMark = id;
  return {
    ok: true,
    reason: 'Sample position marked. This records one dive, not the bed boundary.',
  };
}
export function markBearing(w, mark) {
  if (mark.sector !== w.day.groundId) return 'In another sector';
  return `${Math.round(bearing(mark.x - w.boat.x, mark.y - w.boat.y))
    .toString()
    .padStart(3, '0')}° · ${Math.round(Math.hypot(mark.x - w.boat.x, mark.y - w.boat.y))} m`;
}

export function recordTrack(knowledge, boat, day, trip, time) {
  const tracks = (knowledge.tracks ??= []);
  let track = tracks.at(-1);
  const last = track?.points.at(-1);
  if (
    !track ||
    track.day !== day ||
    track.trip !== trip ||
    (last && (time < last.time || Math.hypot(boat.x - last.x, boat.y - last.y) > 40))
  ) {
    track = { day, trip, points: [] };
    tracks.push(track);
    if (tracks.length > 16) tracks.shift();
  }
  const previous = track.points.at(-1);
  if (!previous || Math.hypot(boat.x - previous.x, boat.y - previous.y) >= 2) {
    track.points.push({ x: boat.x, y: boat.y, time });
    // Simplify old portions, preserving order and both endpoints.
    if (track.points.length > 1200)
      track.points = track.points.filter((_, i, points) => i % 2 === 0 || i === points.length - 1);
  }
}
