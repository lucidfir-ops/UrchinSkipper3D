import { appendChoices } from './menu-buttons.js';
import { bearing } from './math.js';
import { environmentMinute } from './environment.js';
import { GROUNDS, formatClock, latestDeparture } from './day.js';
import { forecast, forecastSeries, estimatedCurrents } from './almanac.js';
import { paintSectorMap } from './chart-art.js';
import { boatSpec } from './boats.js';
import { C } from './config.js';

export function forecastClock(minute, now, career = false) {
  const label = formatClock(((minute % 1440) + 1440) % 1440),
    day = Math.floor(minute / 1440);
  return career
    ? `Day ${day + 1} · ${label}`
    : `${day > Math.floor(now / 1440) ? 'Tomorrow · ' : ''}${label}`;
}
function curves(data, selected) {
  const left = 46,
    right = 605,
    width = right - left,
    scaleX = (m) => left + ((m - data.start) / (data.end - data.start)) * width;
  const low = Math.min(-0.5, ...data.samples.map((s) => s.height)),
    high = Math.max(3, ...data.samples.map((s) => s.height));
  const y = (h) => 133 - ((h - low) / (high - low)) * 98,
    flowY = (f) => 207 - f * 30;
  const line = (key, toY) =>
    data.samples
      .map((s, i) => `${i ? 'L' : 'M'}${scaleX(s.minute).toFixed(1)} ${toY(s[key]).toFixed(1)}`)
      .join(' ');
  return `<svg class="tide-curves" viewBox="0 0 630 263" role="img" aria-label="Independent tide height and main-channel current forecast for the next twelve hours"><rect x="46" y="27" width="559" height="111" rx="4" fill="#163d4899"/><rect x="46" y="171" width="559" height="71" rx="4" fill="#163d4855"/>${Array.from(
    { length: 7 },
    (_, i) => {
      const x = left + (i * width) / 6;
      return `<path d="M${x} 27V243" stroke="#91b9ac" opacity=".15"/><text x="${x}" y="259" fill="#bed1c7" font-size="14" text-anchor="middle">${formatClock((data.start + i * 120) % 1440)}</text>`;
    },
  ).join(
    '',
  )}<text x="46" y="16" fill="#b9dacf" font-size="14">TIDE HEIGHT · METRES ABOVE GAME DATUM</text><text x="46" y="160" fill="#c5cfb7" font-size="14">MAIN-CHANNEL FLOW · FLOOD ↑ / EBB ↓</text><path d="M46 207H605" stroke="#b0c4b0" opacity=".3" stroke-dasharray="4 4"/><text x="38" y="${y(high) + 4}" fill="#b7c9bf" font-size="14" text-anchor="end">${high.toFixed(1)}</text><text x="38" y="${y(low) + 4}" fill="#b7c9bf" font-size="14" text-anchor="end">${low.toFixed(1)}</text><path d="${line('height', y)}" fill="none" stroke="#98d7c3" stroke-width="3"/><path d="${line('flow', flowY)}" fill="none" stroke="#e5c280" stroke-width="2.5"/><path d="M${scaleX(selected.minute)} 25V242" stroke="#f3e5b8" stroke-width="1.5" stroke-dasharray="5 4"/><circle cx="${scaleX(selected.minute)}" cy="${y(selected.height)}" r="5" fill="#f8e2b3"/></svg>`;
}
export function renderAlmanac(ui, w, bind) {
  const id = ui.almanacGroundId || w.day.groundId || GROUNDS[0].id,
    offset = ui.forecastOffset || 0,
    exact = !ui.realistic || ui.debug;
  const signature = JSON.stringify([
    id,
    offset,
    ui.index,
    exact,
    Math.floor(environmentMinute(w)),
    ui.menuNotice,
  ]);
  if (signature === ui.signature) return;
  ui.signature = signature;
  const f = forecast(w, id, offset),
    series = forecastSeries(w, id);
  const nextHigh = f.extrema.find((t) => t.kind === 'High'),
    nextLow = f.extrema.find((t) => t.kind === 'Low');
  ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">SKIPPER'S ALMANAC · ${f.definition.name.toUpperCase()}</div><h2>Work with the water.</h2></div><div class="offload-stamp">FORECAST FOR<strong>${forecastClock(f.minute, f.now, !!w.career)}</strong></div></div><div class="almanac-layout"><div class="almanac-curves">${curves(series, f)}<div class="tide-readings"><span>Height<strong>${f.height.toFixed(2)} m</strong><small>${Math.abs(f.rate) < 0.08 ? 'near stand' : f.rate > 0 ? 'rising' : 'falling'} · ${Math.abs(f.rate).toFixed(2)} m / hour</small></span><span>Next high<strong>${nextHigh ? (Math.floor(nextHigh.minute / 1440) === Math.floor(f.now / 1440) ? formatClock(nextHigh.minute % 1440) : forecastClock(nextHigh.minute, f.now, !!w.career)) : '—'}</strong><small>${nextHigh ? nextHigh.height.toFixed(2) + ' m' : ''}</small></span><span>Next low<strong>${nextLow ? (Math.floor(nextLow.minute / 1440) === Math.floor(f.now / 1440) ? formatClock(nextLow.minute % 1440) : forecastClock(nextLow.minute, f.now, !!w.career)) : '—'}</strong><small>${nextLow ? nextLow.height.toFixed(2) + ' m' : ''}</small></span></div><div class="forecast-controls"><label for="forecastTime">Look ahead <strong>${offset ? `+${Math.floor(offset / 60)}h ${offset % 60}m` : 'Now'}</strong></label><div class="forecast-scrubber"><kbd class="trigger-badge">${bind('zoomOut')}</kbd><input id="forecastTime" type="range" min="0" max="660" step="30" value="${offset}" aria-label="Forecast time, minutes ahead"/><kbd class="trigger-badge">${bind('zoomIn')}</kbd></div></div><p class="almanac-note">The tide curve predicts water height. The separate current curve shows the main-channel tendency; slack and reversal do not coincide exactly with high and low water. Islands, narrows and eddies change the flow locally.</p><div class="almanac-choices choices"></div></div><div class="almanac-map"><canvas width="360" height="360" aria-label="Predicted shoreline and tidal passage chart"></canvas><div class="map-caption">${exact ? 'Blue: submerged · Sand: drying/intertidal · Amber: too shallow for this boat' : 'Predicted exposed shore · Known tidal landmarks'}<br>Arrows: estimated direction / strength.<br>Preview leaves the working clock unchanged.</div><div class="tidal-sites">${(f.terrain.tidalSites || []).map((site) => `<span>${site.name}</span>`).join('')}</div><p>${exact ? `Reference flow ${(Math.hypot(f.vector.x, f.vector.y) * C.knotsPerMps).toFixed(1)} kn · ${Math.round(bearing(f.vector.x, f.vector.y))}°` : `Main channel: ${Math.abs(f.flow) < 0.15 ? 'near slack' : f.flow > 0 ? 'flood tendency' : 'ebb tendency'}`}${w.day.phase === 'working' ? `<br>Home departure target ${formatClock(latestDeparture(w))}` : ''}</p></div></div><div class="day-footer">${bind('zoomOut')} / ${bind('zoomIn')} Forecast ±30 min · ${bind('menuUp')} / ${bind('menuDown')} Options · ${bind('confirm')} Select · ${bind('back')} Back. Synthetic forecasts / game data — not for navigation.</div>`;
  paintSectorMap(ui.panel.querySelector('canvas'), f.terrain, {
    tide: f.height,
    exact: false,
    labels: false,
    exit: f.definition.harbourEdge,
    boat: w.day.groundId === id ? w.boat : null,
    showPatches: false,
    coastOnly: !!w.career && !exact,
    draft: exact ? boatSpec(w).draft : null,
    tidalSites: true,
    currents: estimatedCurrents(f),
  });
  ui.panel.querySelector('input').oninput = (e) => {
    ui.forecastOffset = Number(e.target.value);
    ui.signature = null;
  };
  appendChoices(ui.panel.querySelector('.almanac-choices'), ui, w, ui.choices(w));
}
