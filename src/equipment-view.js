import { UPGRADES, money } from './career-data.js';
import { boatDefinition, boatSpec } from './boats.js';
import {
  EQUIPMENT_STATIONS,
  equipmentAvailability,
  equipmentBenefit,
  equipmentLocation,
  equipmentOperatingState,
  equipmentPreview,
  equipmentStation,
} from './equipment-fit.js';

const symbols = {
  engine: '<path d="M6 10h13v12H6zM9 6h7v4M3 14h3m13-1h4v8h-4M10 13v6m5-6v6"/>',
  'fuel-system': '<path d="M6 8h12v17H6zM8 11h8v5H8zM18 13h4v8a2 2 0 0 0 4 0V11l-3-4M4 25h16"/>',
  hoist: '<path d="M7 25V8h15M4 25h9M8 9l9 12M22 8v10a4 4 0 1 1-4 4"/>',
  bowthruster: '<path d="M16 4l6 10v12H10V14zM3 19h26M3 19l4-4m-4 4l4 4m22-4l-4-4m4 4l-4 4"/>',
  lights: '<path d="M7 5v23M7 10h10v8H7m12-8l8-5m-8 9h10m-10 4l8 5"/>',
  tank: '<path d="M7 9h18v17H7zM12 5h8v4M11 15h10m-10 5h10"/>',
  nitrox:
    '<rect x="6" y="8" width="8" height="19" rx="3"/><rect x="18" y="8" width="8" height="19" rx="3"/><path d="M10 8V4m12 4V4M7 18h6m6 0h6"/>',
  torch: '<path d="M6 23l11-11 5 5-11 11zM16 8l8 8M22 4l-2 5m7 1l-5 2M9 20l4 4"/>',
  stabilizer: '<path d="M10 7h12v19H10zM10 15L3 22v4h7m12-11l7 7v4h-7"/>',
  default:
    '<rect x="4" y="6" width="24" height="18" rx="2"/><path d="M8 19l5-6 5 3 6-6M12 28h8m-4-4v4"/>',
};
export function equipmentIcon(item) {
  return `<svg class="equipment-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${symbols[item.id] || symbols.default}</svg>`;
}
export function fittingPreview(w, item) {
  const owned = !item || w.career.fleet[w.boat.configuration].equipment.includes(item.id);
  return `<figure class="fitting-preview"><canvas width="720" height="440" data-fitting-preview="${item?.id || ''}" data-preview-boat="${w.boat.configuration}" tabindex="0" role="img" aria-label="${boatDefinition(w.boat.configuration).name} in 3D${item ? ` with ${item.name} highlighted` : ' with installed equipment'}. Drag or use left and right arrows to turn the model."></canvas><figcaption class="fitting-preview-caption"><b>${owned ? 'YOUR INSTALLED BOAT' : 'FITTING PREVIEW'}</b> · ${item ? 'Red marks this fitting' : 'Current equipment'}<span>Drag to turn · keyboard ← →</span></figcaption></figure>`;
}
function stationItems(w, station) {
  const fitted = w.career.fleet[w.boat.configuration].equipment;
  return UPGRADES.filter(
    (item) => fitted.includes(item.id) && equipmentStation(item)?.id === station.id,
  );
}
function stationDiagram(w, candidate) {
  const selected = equipmentStation(candidate)?.id;
  return `<svg class="equipment-map" viewBox="0 0 200 260" role="img" aria-label="Boat installation plan; bow at top, port recovery on the left. Highlight marks the selected fitting location."><defs><pattern id="equipment-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#99c1b318"/></pattern></defs><rect width="200" height="260" rx="10" fill="url(#equipment-grid)"/><text x="100" y="15" text-anchor="middle">BOW · FRONT</text><path d="M100 26Q155 65 151 109V222Q100 242 49 222V109Q45 65 100 26Z" fill="#163d3d" stroke="#83afa5" stroke-width="1.5"/><path d="M63 133h74v82H63z" fill="#345044"/><rect x="66" y="75" width="68" height="60" rx="5" fill="#263b3b" stroke="#83afa5"/><path d="M71 82h58v16H71zM44 151v34m-6-29h11m-11 12h11m-11 12h11M89 222v16m22-16v16" stroke="#c5d8c7" fill="none"/><text x="13" y="133" transform="rotate(-90 13 133)" text-anchor="middle">PORT · LEFT</text>${EQUIPMENT_STATIONS.map(
    (station, index) => {
      const active = selected === station.id;
      const fitted = stationItems(w, station).length > 0;
      const x = station.x * 2,
        y = station.y * 2.3 + 18;
      return `<g class="equipment-map-station ${active ? 'preview' : fitted ? 'fitted' : ''}"><circle cx="${x}" cy="${y}" r="${active ? 11 : 8}"/><text x="${x}" y="${y + 3.5}" text-anchor="middle">${index + 1}</text></g>`;
    },
  ).join('')}<text x="100" y="254" text-anchor="middle">STERN · REAR</text></svg>`;
}
export function equipmentPlan(w) {
  const vessel = w.career.fleet[w.boat.configuration];
  return `<section class="equipment-installations"><h3>Installed aboard</h3><p>Every compatible fitting can be installed together. Numbers locate equipment on the boat; they are not a limit.</p><div class="equipment-plan-layout">${stationDiagram(w)}<div class="equipment-station-list">${EQUIPMENT_STATIONS.map(
    (station, index) => {
      const items = stationItems(w, station);
      const standard =
        station.id === 'console'
          ? 'Standard sounder, compass and digital clock'
          : station.id === 'drive'
            ? boatDefinition(w.boat.configuration).drive
            : station.id === 'working deck'
              ? 'Ladder and manual bag handling'
              : station.id === 'dive gear'
                ? 'Two sets of SCUBA gear'
                : station.id === 'bow' &&
                    boatDefinition(w.boat.configuration).spec.bowThrusterStrength
                  ? 'Factory bow thruster'
                  : '';
      if (!items.length && !standard) return '';
      return `<section class="equipment-station"><h4><b>${index + 1}</b>${station.name}</h4>${standard ? `<small>${standard}</small>` : ''}${items.map((item) => `<p><strong>${item.name}</strong><span>${equipmentOperatingState(w, item)}</span></p>`).join('')}</section>`;
    },
  ).join(
    '',
  )}</div></div><p class="equipment-ownership">${vessel.equipment.length} purchased fittings / clock faces on this boat. Purchases include fitting and stay with this vessel when you change boats.</p></section>`;
}
export function equipmentShopIntro(w) {
  const spec = boatSpec(w);
  return `<div class="equipment-shop-intro"><h3>Outfit ${boatDefinition(w.boat.configuration).name}</h3><p>Start with a job: quicker bag handling, easier positioning, more range or better information. Select a fitting to see where it goes and what changes.</p>${fittingPreview(w)}<div class="career-numbers"><span>Current load speed<strong>${(spec.maxSpeed * 1.943844).toFixed(1)} kn</strong></span><span>Passage fuel<strong>${spec.travelBurn.toFixed(1)} L/h</strong></span></div>${equipmentPlan(w)}</div>`;
}
export function equipmentDetail(w, item) {
  const status = equipmentAvailability(w, item),
    preview = equipmentPreview(w, item);
  const station = equipmentStation(item),
    number = EQUIPMENT_STATIONS.indexOf(station) + 1;
  const others = stationItems(w, station).filter((fitting) => fitting.id !== item.id);
  return `<section class="equipment-detail"><div class="equipment-detail-title">${equipmentIcon(item)}<div><small>${equipmentLocation(item)}</small><h3>${item.name}</h3></div></div><p class="equipment-status ${status.owned ? 'owned' : status.ok ? 'available' : 'unavailable'}">${status.label}</p><p class="equipment-benefit">${equipmentBenefit(item)}</p>${fittingPreview(w, item)}<p>${item.detail}</p>${preview.rows.length ? `<table class="equipment-comparison"><thead><tr><th>Capability</th><th>Now</th><th>${status.owned ? 'Enabled' : 'After fitting'}</th></tr></thead><tbody>${preview.rows.map((row) => `<tr><th>${row.label}</th><td>${row.before}</td><td>${row.after}</td></tr>`).join('')}</tbody></table>` : ''}<div class="equipment-placement">${stationDiagram(w, item)}<div><h4><b>${number}</b>${station.name}</h4><p>${station.explanation}.</p><p>${status.owned ? 'This fitting belongs to this boat.' : 'Installed here when you confirm the purchase.'}</p>${others.length ? `<small>Shares this area with: ${others.map((fitting) => fitting.name).join(', ')}. All stay fitted.</small>` : '<small>Compatible fittings share their working area. No equipment limit.</small>'}</div></div><p>${status.reason}</p>${!status.owned ? `<p class="equipment-price"><strong>${money(item.price)} fitted</strong> · ${w.career.cash >= item.price ? `${money(w.career.cash - item.price)} remains` : `${money(item.price - w.career.cash)} more needed`}</p>` : '<p>Use Your boat → Equipment switches for operating gear. Permanent systems stay installed. Clock faces are chosen in Arrange UI.</p>'}</section>`;
}
export function equipmentPurchaseDetail(w, item) {
  const rows = equipmentPreview(w, item).rows;
  return `<strong>Fit to ${boatDefinition(w.boat.configuration).name}</strong><br>${equipmentLocation(item)} · ${money(item.price)} including installation.<br>${rows.map((row) => `${row.label}: ${row.before} → ${row.after}`).join('<br>')}<br>${item.detail}<br><br>Other fitted equipment stays installed. Cash after fitting: ${money(w.career.cash - item.price)}.`;
}
