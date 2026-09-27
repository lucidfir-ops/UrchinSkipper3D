import { renderAssistOptions } from './assist-view.js';
import { appendChoices } from './menu-buttons.js';
import { earlyStartNotice } from './early-start.js';
import { buyerNotice } from './buyer.js';
import { reportAge, markBearing } from './knowledge.js';
import { seasonStatus, areaStatus } from './season.js';
import { selectedSubArea, subAreaDefinition } from './quota-areas.js';
import { coastFor } from './coasts.js';
import { departureBriefing } from './preparation.js';
import { terrainFor } from './career-terrain.js';
import { sectorDefinition } from './sectors.js';
import { groundTrip, formatClock, GROUNDS } from './day.js';
import { sampleCurve } from './environment.js';
import { paintSectorMap, rockChartLabel, sectorChartSvg } from './chart-art.js';
import { fixedFeatures } from './shore-hazards.js';
import { assist, gear } from './assists.js';
import { weatherOutlook, conditionsAt, sevenDayForecast } from './weather.js';
import { bindChartModeToggle, chartMode, chartModeMarkup } from './chart-presentation.js';
export { EXPEDITION_SCREENS, expeditionChoices, expeditionActivate } from './expedition-actions.js';
import { expeditionActions } from './expedition-actions.js';

function knowledgeChartOptions(w, id, ui, minute = w.day.minute) {
  const def = sectorDefinition(id),
    terrain = terrainFor(w, def),
    tide = sampleCurve(def.environment.tideCurve, minute + (w.career.day - 1) * 1440),
    current = w.day.groundId === id;
  const reports = assist(w, 'chartGrounds', ui.realistic, ui.debug)
    ? Object.values(w.career.knowledge[id]?.grounds || {}).filter(
        (p) =>
          ui.revealUrchins ||
          ui.debug ||
          terrain.patches.find((q) => q.id === p.id)?.charted !== false,
      )
    : [];
  return {
    tide,
    exact: false,
    showPatches: ui.revealUrchins || assist(w, 'chartGrounds', ui.realistic, ui.debug),
    coastOnly: !assist(w, 'reefClarity', ui.realistic, ui.debug),
    boat: current ? w.boat : null,
    divers: current && assist(w, 'diverIndicators', ui.realistic) ? w.divers : [],
    exit: def.harbourEdge,
    labels: false,
    selectedPatch: ui.mapSelection,
    revealUrchins: ui.revealUrchins || ui.debug,
    tracks: w.career.knowledge[id]?.tracks || [],
    reports,
    marks: (w.career.marks || []).filter((mark) => mark.sector === id),
  };
}
function paintKnowledge(canvas, w, id, ui, minute = w.day.minute) {
  const terrain = terrainFor(w, sectorDefinition(id));
  paintSectorMap(canvas, terrain, {
    ...knowledgeChartOptions(w, id, ui, minute),
    rendition: 'raster',
  });
}
export function renderExpedition(ui, w, bind) {
  if (ui.screen === 'assists') return renderAssistOptions(ui, w, expeditionActions(ui, w));
  const id = ui.chartGroundId || w.day.groundId || 'near',
    def = sectorDefinition(id),
    trip = groundTrip(w, id),
    access = areaStatus(w.career, id),
    subArea = {
      ...subAreaDefinition(id, selectedSubArea(w.career, id)),
      label: `${coastFor(id).name} / ${sectorDefinition(id).name}`,
    },
    actions = expeditionActions(ui, w),
    choices = actions.map((a) => a.label);
  const signature = JSON.stringify([
    ui.screen,
    ui.index,
    ui.arrivalLane,
    id,
    w.day.minute,
    w.career.assists,
    w.career.preferences,
    ui.mapSelection,
    w.nextObservation,
    ui.menuNotice,
    w.career.navigationMark,
    w.career.marks.length,
    chartMode(ui),
  ]);
  if (ui.signature === signature) return;
  ui.signature = signature;
  ui.panel.classList.add('day-panel');
  let title = def.name,
    detail,
    map = ['departure', 'knowledge'].includes(ui.screen);
  if (map) {
    const k = w.career.knowledge[id],
      reports = Object.values(k?.grounds || {});
    detail = `<div class="travel-strip"><div>Arrive<strong>${formatClock(trip.arrival)}</strong></div><div>Leave by<strong>${formatClock(trip.depart)}</strong></div></div><p>${def.flowLabel}</p><p>Return across the <strong>${def.harbourEdge}</strong> edge. Arrival is at the entrance; find a safe drop using the sounder, kelp and shoreline.</p><p>${gear(w, 'plotter') ? 'Thin red lines show your recorded chartplotter track. The sounder keeps local depth readable.' : 'Standard sounder: local depth only. A plotter can keep your depth tracks.'}</p><div class="knowledge-reports">${reports.map((p) => `<p>${reportAge(p, w.career.day)} · ${p.name}<br>${p.report} · ${p.condition || 'Old observation'}${p.quality === null ? '' : ` · ${Math.round(p.quality * 100)}% sampled quality`}</p>`).join('') || '<p>No diver reports here yet. Bring a working diver alongside to learn more.</p>'}</div>`;
    const marks = (w.career.marks || []).filter((m) => m.sector === id);
    if (ui.screen === 'knowledge')
      detail += `<h3>Your marks</h3>${marks.map((m) => `<p>${w.career.navigationMark === m.id ? '★ ' : ''}${m.label} · day ${m.day}<br>${markBearing(w, m)}</p>`).join('') || '<p>Mark a position or one of your recent samples below.</p>'}`;
    if (ui.screen === 'departure') {
      const brief = departureBriefing(w, id),
        f = brief.fuel;
      detail = `<div class="travel-strip"><div>Arrive<strong>${formatClock(trip.arrival)}</strong></div><div>Leave by<strong>${formatClock(trip.depart)}</strong></div></div><h3>${access.open ? 'Area open' : access.reason} · ${seasonStatus(w.career).daysLeft} days left in season</h3><p><strong>${subArea.label} · ${subArea.difficulty}</strong><br>${subArea.hazards}<br>Ground potential ${Math.round(subArea.yield * 100)}% · price tier ${Math.round(subArea.price * 100)}%</p><p class="buyer-notice">Buyer: ${buyerNotice(w.career)}</p><h3>Fuel for the working day</h3><p>${w.boat.fuel.toFixed(1)} L aboard · outward ${f.outbound.toFixed(1)} L · home ${f.home.toFixed(1)} L<br>Reserve ${f.reserve.toFixed(1)} L · ~${f.workingMinutes >= 120 ? (f.workingMinutes / 60).toFixed(1) + ' h' : Math.floor(f.workingMinutes) + ' min'} local fuel endurance</p><div class="departure-warnings">${
        brief.notes
          .filter((n) => brief.guided || n.level === 'danger' || n.level === 'stop' || n.clock)
          .map((n) => `<p class="${n.level}">${n.text}</p>`)
          .join('') || '<p>Passage and return reserve covered.</p>'
      }</div><p>${def.description || ''}</p><p>${def.flowLabel}<br>Home across the ${def.harbourEdge} edge. Approach choices follow that entrance. Local work assumes intermittent throttle.</p>${brief.guided ? '<p>Frank: “Keep fuel for home. Sound the reef edge before the first drop.”</p>' : ''}`;
    }
  } else if (ui.screen === 'conditions') {
    title = 'Weather for the next seven days.';
    const outlook = weatherOutlook(w, 0, id);
    detail = `<h3>${def.name} outlook · ${outlook.confidence}% confidence</h3><p>${outlook.periods.map((p) => `${p.minute ? `Around ${formatClock(p.minute)}` : 'Morning'} · ${p.name} · ~${p.wind} kn wind<br>${p.visibility}`).join('</p><p>')}</p><p>${GROUNDS.map(
      (g) => {
        const local = conditionsAt(w, w.day.minute, g.id);
        return `${g.name}: ${local.wind.toFixed(0)} kn wind / ${local.wave.toFixed(1)} m sea`;
      },
    ).join(
      '<br>',
    )}</p><p>Frank: “Home Coast gets weak storms. Later coasts have worse conditions; check the forecast before you fish. The fifth coast can get vicious.” Wind and tide are separate. Exposed water builds more sea. The timing is an estimate; watch for changes.</p><p>Departure ${formatClock(w.day.minute)} · Offload 19:00<br>${earlyStartNotice(w)} Waiting back to 07:00 avoids that early-start cost. Darkness limits sight and unlit pickup range. Work lights, radar and a known route give you more choices.</p>`;
    detail += `<h3>Seven-day coastal forecast</h3><table class="week-forecast"><thead><tr><th>Day</th><th>Outlook</th><th>Wind</th><th>Confidence</th></tr></thead><tbody>${sevenDayForecast(
      w,
      id,
    )
      .map(
        (day, i) =>
          `<tr><th>${i ? `Day ${day.day}` : 'Today'}</th><td>${day.periods.map((p) => `${p.minute ? `~${formatClock(p.minute)}` : 'Morning'}: ${p.name}`).join('<br>')}</td><td>${Math.min(...day.periods.map((p) => p.wind))}–${Math.max(...day.periods.map((p) => p.wind))} kn</td><td>${day.confidence}%</td></tr>`,
      )
      .join(
        '',
      )}</tbody></table><p>Further days are less certain. Improved forecasts increase confidence; check again before sailing. Synthetic game weather.</p>`;
  } else {
    title = 'Choose what the skipper knows.';
    detail = `<h3>${w.career.assists.preset === 'off' ? 'ALL OFF' : w.career.assists.preset.toUpperCase()} information</h3><p>Realistic includes exact deck/diver readouts, clock/offload, helm instruments and chart ground markings. All Off disables every widget. Turn off Diver indicators and enable Portrait-only diver selector for identity and selection without telemetry.</p><p>RB cycles ${w.career.difficulty === 'realistic' ? 'Realistic → All Off' : 'Easy → Realistic → All Off'}. Custom choices are remembered separately for each information mode. R3 opens this menu. ${w.career.difficulty === 'realistic' ? 'This career excludes Easy-only environmental and underwater aids.' : 'Each widget is independently configurable.'}</p><p>Information does not change crew skill, current, prices or hidden ground stock.</p>`;
  }
  if (ui.screen === 'conditions') {
    const split = detail.indexOf('<h3>Seven-day');
    detail = `<div class="forecast-detail"><section>${detail.slice(0, split)}</section><section>${detail.slice(split)}</section></div>`;
  }
  const vector = chartMode(ui) === 'vector',
    chartPixels = 480,
    chartSurface = !map
      ? ''
      : vector
        ? sectorChartSvg(terrainFor(w, def), {
            ...knowledgeChartOptions(w, id, ui, trip.arrival),
            ariaLabel: 'Persistent working vector chart',
          })
        : `<canvas width="${chartPixels}" height="${chartPixels}" aria-label="Persistent working chart"></canvas>`;
  ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">DAY ${w.career.day} · ${formatClock(w.day.minute)}</div><h2>${title}</h2></div>${map ? chartModeMarkup(ui) : ''}</div><div class="day-layout expedition-layout">${map ? `<div class="sector-picture">${chartSurface}<div class="map-caption">Pink ×: charted rocks/outcrops; numbers give clearance over tops at chart datum (add tide). Some visible rocks and drifting logs are uncharted. Red: your track · blue: depth contours · amber: past diver reports.</div></div>` : ''}<article class="career-detail"><div class="expedition-copy">${detail}</div><div class="choices expedition-choices"></div></article></div><div class="day-footer">${ui.menuNotice || `${bind('menuUp')} / ${bind('menuDown')} Navigate · ${bind('confirm')} Select · Right stick scrolls detail · ${bind('back')} Back`}</div>`;
  if (map) {
    bindChartModeToggle(ui.panel, ui);
    const surface = ui.panel.querySelector('.sector-picture > :is(canvas, svg)');
    if (!vector) paintKnowledge(surface, w, id, ui, trip.arrival);
    surface.onclick = (e) => {
      const r = surface.getBoundingClientRect(),
        terrain = terrainFor(w, def),
        x = ((e.clientX - r.left) / r.width) * terrain.size,
        y = ((e.clientY - r.top) / r.height) * terrain.size;
      const known = w.career.knowledge[id]?.grounds || {};
      const patch =
        (ui.revealUrchins || assist(w, 'chartGrounds', ui.realistic, ui.debug)) &&
        terrain.patches
          .filter((p) => ui.revealUrchins || ui.debug || p.charted !== false)
          .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      ui.menuNotice =
        patch && Math.hypot(patch.x - x, patch.y - y) <= patch.radius + 8
          ? `${patch.name}: colour = picking rate; dashes = quality. ${known[patch.id] ? 'Amber = previous diver report; stock may have changed.' : 'Charted ground; visit to sample.'}`
          : 'Blue lines are depth contours in metres, not fishing boundaries. Amber rings are approximate past diver reports. Red lines are your plotter track.';
      const rock = fixedFeatures(terrain).find(
        (r) => r.charted && Math.hypot(r.x - x, r.y - y) < 9,
      );
      if (rock)
        ui.menuNotice = `${rock.kind}: ${rockChartLabel(rock)} at chart datum; tide changes clearance. Surrounding seabed ${rock.bed.toFixed(1)} m. Other visible hazards may be uncharted.`;
      ui.mapSelection = rock ? null : patch?.id;
      ui.signature = null;
    };
  }
  const list = ui.panel.querySelector('.choices');
  appendChoices(list, ui, w, choices, { actions });
  list.children[ui.index]?.scrollIntoView({ block: 'nearest' });
}
