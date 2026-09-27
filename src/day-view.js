import { money as formatMoney, pounds, percent } from './format.js';
import { appendChoices, choiceButton } from './menu-buttons.js';
import { terrainFor } from './career-terrain.js';
import { assist } from './assists.js';
import { C } from './config.js';
import { GROUNDS, groundTrip, formatClock, allAboard, passageMinutes } from './day.js';
import { sectorDefinition } from './sectors.js';
import { sampleCurve } from './environment.js';
import { regionalChart, paintSectorMap, harbourArt, sectorChartSvg } from './chart-art.js';
import { legendMarkup, patchStyle, pickingName } from './patch-style.js';
import { EDGE_NAMES } from './navigation.js';
import { bindChartModeToggle, chartMode, chartModeMarkup } from './chart-presentation.js';
import { areaStatus } from './season.js';
import { coastFor } from './coasts.js';

const money = (value) => formatMoney(value, 2);
function incidentMarkup(result) {
  const incidents = result.safety?.incidents || [];
  if (!incidents.length)
    return '<div class="rival-results safety-results"><strong>Safety outcome</strong><div>No diver injuries or near misses reported.<span>No medical absence or safety charge.</span></div></div>';
  return `<div class="rival-results safety-results"><strong>Safety and injury outcomes</strong>${incidents
    .map((incident) => {
      const crew = result.crew?.find((person) => person.id === incident.diverId),
        name = crew?.name || 'Diver',
        cause = incident.cause || crew?.injuryCause || 'working incident',
        outcome =
          incident.outcome === 'fatality'
            ? 'Fatality'
            : incident.outcome === 'injury'
              ? 'Injury'
              : 'Near miss',
        availability =
          incident.outcome === 'fatality'
            ? 'Permanent crew loss'
            : incident.outcome === 'injury'
              ? `Unavailable through day ${crew?.availableDay || (result.career?.day || 0) + 3}`
              : 'Fit to work',
        consequence =
          incident.outcome === 'near miss'
            ? 'No medical absence or direct charge.'
            : 'Claim recorded; future insurance premiums may rise.';
      return `<div>${formatClock(incident.minute)} · ${name} · ${outcome}<span>${cause} · ${availability}<br>${consequence}</span></div>`;
    })
    .join('')}</div>`;
}
export function departurePatches(ui, world) {
  const id = ui.chartGroundId || GROUNDS[0].id,
    terrain = terrainFor(world, sectorDefinition(id));
  return terrain.patches.filter((p) => world.career || p.kind === 'laboratory');
}
export function departurePatch(ui, world) {
  const patches = departurePatches(ui, world);
  return (
    patches.find((p) => p.id === ui.chartPatchId) ||
    patches.find((p) => p.id === 'good') ||
    patches[0]
  );
}
export function cycleDeparturePatch(ui, world, direction) {
  const patches = departurePatches(ui, world),
    current = departurePatch(ui, world);
  ui.chartPatchId =
    patches[(patches.indexOf(current) + direction + patches.length) % patches.length].id;
  ui.signature = null;
}
function buttons(ui, world, container, indices = null) {
  const list = document.createElement('div');
  list.className = 'choices';
  container.append(list);
  appendChoices(list, ui, world, ui.choices(world), { indices, currentWorld: true });
  return list;
}
export function renderDayScreen(ui, world, bind) {
  const exact = !ui.realistic || ui.debug,
    screen = ui.screen,
    panel = ui.panel,
    rendition = chartMode(ui);
  const signature = JSON.stringify([
    screen,
    ui.index,
    ui.chartGroundId,
    ui.chartPatchId,
    world.day.minute,
    world.sectorRevision,
    exact,
    ui.menuNotice,
    rendition,
    ui.choices(world),
  ]);
  if (signature === ui.signature) return;
  ui.signature = signature;
  panel.replaceChildren();
  panel.classList.add('day-panel');
  if (screen === 'chart') {
    if (ui.index >= 0 && ui.index < GROUNDS.length) ui.chartHighlight = ui.index;
    const active = GROUNDS[ui.chartHighlight || 0],
      trip = groundTrip(world, active.id);
    panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">${world.day.phase === 'planning' ? 'THE WORKING DAY' : 'COASTAL CHART'} · ${formatClock(world.day.minute)}</div><h2>Where will you work?</h2></div>${chartModeMarkup(ui)}<div class="offload-stamp">HARBOUR OFFLOAD<strong>${formatClock(C.day.deadlineMinute)}</strong></div></div><div class="day-layout"><div class="chart-picture">${regionalChart(
      GROUNDS.map((g) => ({ ...g, travelMinutes: passageMinutes(world, g) })),
      ui.chartHighlight || 0,
      rendition,
    )}<div class="map-caption">Synthetic coast · game data, not for navigation</div></div><div class="route-detail"><div class="eyebrow">${active.character}</div><h3>${active.name}</h3><p>${active.description}</p><div class="travel-strip"><div>Travel<strong>${trip.minutes} min</strong></div><div>Arrive<strong>${formatClock(trip.arrival)}</strong></div><div>Leave by<strong>${formatClock(trip.depart)}</strong></div></div><p class="route-note">${active.flowLabel}<br>Home lies ${EDGE_NAMES[active.harbourEdge].toLowerCase()} of this sector. Cross that boundary to return.</p><div class="chart-choices"></div></div></div><div class="day-footer">${ui.menuNotice || (!allAboard(world) ? 'Bring both divers aboard before changing sectors.' : `${bind('menuUp')} / ${bind('menuDown')} Choose area · ${bind('confirm')} View grounds · ${bind('back')} Back`)}</div>`;
    const utilities = document.createElement('div');
    utilities.className = 'chart-actions';
    for (const [index, label] of [
      [GROUNDS.length, 'Tide & current almanac'],
      [GROUNDS.length + 1, world.career ? 'Harbour boatyard' : 'Visit prototype boatyard'],
    ]) {
      const button = choiceButton(ui, world, label, index);
      utilities.append(button);
    }
    panel
      .querySelector('.day-heading')
      .insertBefore(utilities, panel.querySelector('.offload-stamp'));
    const preview = document.createElement('div');
    preview.className = 'area-preview';
    preview.innerHTML =
      '<canvas width="128" height="128" aria-label="Highlighted fishing area preview"></canvas>';
    panel.querySelector('.day-heading').append(preview);
    const definition = sectorDefinition(active.id);
    preview.title = active.name;
    paintSectorMap(preview.querySelector('canvas'), terrainFor(world, definition), {
      tide: sampleCurve(
        definition.environment.tideCurve,
        trip.arrival + (world.career ? (world.career.day - 1) * 1440 : 0),
      ),
      exact: false,
      showPatches: assist(world, 'groundDots', ui.realistic, ui.debug),
      coastOnly: world.career && !assist(world, 'reefClarity', ui.realistic, ui.debug),
      labels: false,
      exit: definition.harbourEdge,
      compact: true,
      rendition,
    });
    bindChartModeToggle(panel, ui);
    const list = buttons(ui, world, panel.querySelector('.chart-choices'), [
      ...GROUNDS.map((_, i) => i),
      GROUNDS.length + 2,
    ]);
    [...list.children].forEach((button, index) => {
      if (index < GROUNDS.length) {
        const status = world.career ? areaStatus(world.career, GROUNDS[index].id) : null;
        button.innerHTML = `<span class="area-number">${Math.floor(index / 3) + 1}.${(index % 3) + 1}</span><span>${GROUNDS[index].name}<small>${coastFor(GROUNDS[index].id).name} · ${status && !status.open ? status.reason : 'OPEN'} · ${passageMinutes(world, GROUNDS[index])} min home</small></span>`;
      }
    });
    panel.querySelectorAll('[data-ground]').forEach(
      (el) =>
        (el.onclick = () => {
          ui.index = GROUNDS.findIndex((g) => g.id === el.dataset.ground);
          ui.activate(world);
        }),
    );
  } else if (screen === 'departure') {
    const id = ui.chartGroundId || GROUNDS[0].id,
      definition = sectorDefinition(id),
      terrain = world.sectors?.[id] || definition.terrain,
      trip = groundTrip(world, id),
      patch = departurePatch(ui, world);
    const current = world.day.phase === 'working' && world.day.groundId === id;
    const chartOptions = {
      tide: sampleCurve(
        definition.environment.tideCurve,
        trip.arrival + (world.career ? (world.career.day - 1) * 1440 : 0),
      ),
      exact,
      selectedPatch: patch.id,
      exit: definition.harbourEdge,
      boat: current ? world.boat : null,
      divers: current && !ui.realistic ? world.divers : [],
    };
    const chartSurface =
      rendition === 'vector'
        ? sectorChartSvg(terrain, { ...chartOptions, ariaLabel: 'Sector ground vector chart' })
        : '<canvas width="480" height="480" aria-label="Sector ground chart"></canvas>';
    panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">${definition.character} · ${ui.laboratory ? 'ASSISTED LABORATORY' : current ? 'WORKING SECTOR' : 'DEPARTURE PLAN'}</div><h2>${definition.name}</h2></div>${chartModeMarkup(ui)}<div class="offload-stamp">RETURN EXIT<strong>${EDGE_NAMES[definition.harbourEdge]} ${definition.harbourEdge === 'south' ? '↓' : '←'}</strong></div></div><div class="day-layout departure-layout"><div class="sector-picture">${chartSurface}<div class="map-caption">${current ? 'Your boat is the white arrow.' : 'Choose a starting patch on the chart or matrix.'} · ${terrain.size} m across</div></div><div class="route-detail"><div class="travel-strip"><div>Travel<strong>${trip.minutes} min</strong></div><div>Arrive<strong>${formatClock(trip.arrival)}</strong></div><div>Leave by<strong>${formatClock(trip.depart)}</strong></div></div><p>${definition.flowLabel}</p>${legendMarkup(exact)}<div class="lab-matrix" aria-label="Starting ground matrix"></div><div class="ground-detail">${exact ? `${percent(patch.quality)} quality · ${300 / patch.rate}s per 300 lb bag<br>${pounds(patch.remaining)} remaining` : `${pickingName(patch).toLowerCase()} picking · read the quality from outline and texture`}</div><div class="departure-choices"></div></div></div><div class="day-footer">${ui.menuNotice || (ui.laboratory ? 'Practice drops preserve stock, require both divers aboard, and disable the day deadline.' : `${bind('menuLeft')} / ${bind('menuRight')} Starting ground · ${bind('confirm')} Select · Bring both divers aboard, then cross the ${EDGE_NAMES[definition.harbourEdge].toLowerCase()} edge to head home.`)}</div>`;
    const surface = panel.querySelector('.sector-picture > :is(canvas, svg)');
    if (rendition !== 'vector')
      paintSectorMap(surface, terrain, { ...chartOptions, rendition: 'raster' });
    bindChartModeToggle(panel, ui);
    surface.onclick = (e) => {
      const rect = surface.getBoundingClientRect(),
        x = ((e.clientX - rect.left) / rect.width) * terrain.size,
        y = ((e.clientY - rect.top) / rect.height) * terrain.size;
      const nearest = departurePatches(ui, world).sort(
        (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
      )[0];
      ui.chartPatchId = nearest.id;
      ui.signature = null;
    };
    for (const p of departurePatches(ui, world)) {
      const button = document.createElement('button'),
        style = patchStyle(p);
      button.className = `matrix-cell q${style.tier}${p.id === patch.id ? ' chosen' : ''}`;
      button.style.setProperty('--swatch', style.css);
      button.textContent = exact
        ? `${Math.round(p.quality * 100)}% · ${300 / p.rate}s`
        : pickingName(p).toLowerCase();
      button.setAttribute(
        'aria-label',
        exact
          ? `${p.name}, ${300 / p.rate} seconds per bag, ${Math.round(p.remaining)} pounds remaining`
          : `${pickingName(p)} picking, ${['rich', 'good', 'fair', 'lean'][style.tier]} quality`,
      );
      button.onclick = () => {
        ui.chartPatchId = p.id;
        ui.signature = null;
      };
      panel.querySelector('.lab-matrix').append(button);
    }
    buttons(ui, world, panel.querySelector('.departure-choices'));
  } else if (screen === 'summary') {
    const r = world.day.result;
    if (!r) return;
    panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">THE DAY'S CATCH · ${r.assisted ? 'ASSISTED PLAYTEST' : r.career ? 'DAY ' + r.career.day : 'SESSION RESULTS'}</div><h2>Back at harbour.</h2></div><div class="result-status ${r.onTime ? 'on-time' : 'delayed'}">${r.safety?.fatalities ? 'DIVER FATALITY' : r.sunk ? 'VESSEL LOST' : r.rescue ? 'RESCUE / TOW' : r.onTime ? 'ON TIME' : 'DELAYED SHIPPING'}<small>Arrived ${formatClock(r.arrival)}${r.onTime ? '' : ` · ${Math.max(1, Math.ceil(r.arrival - C.day.deadlineMinute))} min late for 19:00`}</small></div></div><div class="day-layout result-layout"><div class="harbour-picture">${harbourArt()}<h3>${r.safety?.fatalities ? 'A diver did not return.' : r.safety?.injuries ? 'Crew ashore. Medical assistance needed.' : r.sunk ? 'Crew rescued. Vessel lost.' : 'Everyone home. Catch accounted for.'}</h3><p>${r.rescue ? `${r.rescue.reason}. Coast Guard assistance and harbour support recovered the surviving crew. Fishing ended; the trip includes a ${r.rescue.delayMinutes}-minute response allowance.` : r.onTime ? 'Your catch made the scheduled offload.' : 'The offload was missed. Your catch ships in the next window, at 06:00 next morning, with more water loss and lower quality. Departure is 09:00; late returns increase crew fatigue.'}</p><div class="shipping-line"><span>AT HARBOUR<strong>${formatClock(r.arrival)}</strong></span><span>→</span><span>OFFLOAD / SHIP<strong>${formatClock(r.offloadMinute)}</strong></span></div>${!r.onTime ? `<p class="delay-note">Shipping delay: ${r.delayHours.toFixed(1)} hours</p>` : ''}${r.highlights?.length ? `<div class="day-highlights"><strong>Your day</strong>${r.highlights.map((line) => `<p>${line}</p>`).join('')}</div>` : ''}${incidentMarkup(r)}${r.rivals ? `<div class="rival-results"><strong>Other landings</strong>${r.rivals.map((s) => `<div>${s.boat}<span>${pounds(s.gross)}</span></div>`).join('')}</div>` : ''}<div class="result-choices"></div></div><div class="landing-receipt"><div class="eyebrow">${r.career ? 'WORKING DAY RETURN' : 'NET SESSION RETURN'}</div><div class="earnings">${money(r.netValue ?? r.value)}</div><div class="receipt-row"><span>Recovered gross catch</span><strong>${pounds(r.gross)}</strong></div><div class="receipt-row"><span>Initial product quality</span><strong>${percent(r.quality)}</strong></div><div class="receipt-row loss"><span>Estimated water loss · ${(r.waterLoss * 100).toFixed(1)}%</span><strong>−${pounds(r.waterLost)}</strong></div><div class="receipt-row payable"><span>Payable / landed weight</span><strong>${pounds(r.landed)}</strong></div><div class="receipt-row"><span>Quality at shipping</span><strong>${percent(r.landedQuality)}</strong></div><div class="receipt-row"><span>Average price / landed lb</span><strong>${money(r.price)}</strong></div>${r.discarded ? `<div class="receipt-row"><span>Catch released / lost at sea</span><strong>${pounds(r.discarded)}</strong></div>` : ''}<div class="receipt-row"><span>Catch sale value${r.buyerPremium ? ` · includes ${money(r.buyerPremium)} quality premium` : ''}</span><strong>${money(r.value)}</strong></div><div class="receipt-row loss"><span>Fuel / operation</span><strong>−${money(r.costs?.fuel || 0)}</strong></div>${r.costs?.repair ? `<div class="receipt-row loss"><span>${r.career ? 'Drive repair quote · unpaid' : 'Estimated drive repair'}</span><strong>${r.career ? '' : '−'}${money(r.costs.repair)}</strong></div>` : ''}${r.costs?.hullRepair ? `<div class="receipt-row loss"><span>${r.career ? 'Hull repair / loss quote · unpaid' : 'Estimated hull repair / loss'}</span><strong>${r.career ? '' : '−'}${money(r.costs.hullRepair)}</strong></div>` : ''}${r.safety?.incidents?.length ? `<div class="receipt-row loss"><span>Crew safety</span><strong>${r.safety.fatalities} fatalities · ${r.safety.injuries} injured</strong></div>` : ''}${r.costs?.rescue ? `<div class="receipt-row loss"><span>Tow / yard handling</span><strong>−${money(r.costs.rescue)}</strong></div>` : ''}${r.career ? `<div class="receipt-row loss"><span>Crew catch shares</span><strong>−${money(r.career.crewPay)}</strong></div><div class="receipt-row loss"><span>Landing / interest / insurance</span><strong>−${money(r.career.landingFee + r.career.interest + r.career.premium)}</strong></div>${r.career.fine ? `<div class="receipt-row loss"><span>Inspection assessment</span><strong>−${money(r.career.fine)}</strong></div>` : ''}${r.career.insurance ? `<div class="receipt-row"><span>Insurance settlement</span><strong>${money(r.career.insurance)}</strong></div>` : ''}<div class="receipt-row payable"><span>Operating cash</span><strong>${money(r.career.cash)}</strong></div>` : ''}<p class="receipt-footnote">${r.career ? 'Career return in CAD · Fuel paid at bunkering' : 'Prototype prices in CAD · Session results'}<br>No early-offload bonus. Catch age and shipping delays reduce payable weight and quality.</p></div></div><div class="day-footer">${bind('confirm')} Select · ${bind('menuUp')} / ${bind('menuDown')} Navigate</div>`;
    buttons(ui, world, panel.querySelector('.result-choices'));
  }
}
