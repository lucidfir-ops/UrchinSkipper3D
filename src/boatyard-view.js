import { vesselPreview, paintVesselPreviews } from './vessel-art.js';
import { appendChoices } from './menu-buttons.js';
import { BOATS, boatDefinition, boatSwapStatus } from './boats.js';

export function renderBoatyard(ui, w, bind) {
  const def = BOATS[Math.min(ui.index, BOATS.length - 1)],
    active = boatDefinition(w.boat.configuration),
    status = boatSwapStatus(w, def.id);
  const signature = JSON.stringify([ui.index, w.boat.configuration, ui.menuNotice, status.reason]);
  if (signature === ui.signature) return;
  ui.signature = signature;
  ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">PROTOTYPE BOATYARD · ${w.day.phase === 'planning' ? 'HARBOUR' : 'INSPECT BOATS'}</div><h2>Find your way of handling.</h2></div><div class="offload-stamp">CURRENT BOAT<strong>${active.drive}</strong></div></div><div class="yard-layout"><div class="yard-choices choices"></div><div class="yard-plan">${vesselPreview(def.id, def.name)}</div><div class="yard-detail"><div class="eyebrow">${def.tag}</div><h3>${def.name}</h3><p>${def.description}</p><div class="yard-stats">${[
    ['Maneuverability', def.handling],
    ['Shallow access', def.shallow],
    ['Drive protection', def.protection],
  ]
    .map(
      ([label, value]) =>
        `<div><span>${label}</span><meter min="0" max="5" value="${value}">${value}/5</meter></div>`,
    )
    .join(
      '',
    )}</div><div class="yard-numbers"><span>Minimum depth<strong>${(def.spec.draft ?? 2).toFixed(1)} m</strong></span><span>Operating cost<strong>${def.cost.toFixed(2)}×</strong></span><span>Drive replacement<strong>${def.repairHours} h</strong></span></div><p class="yard-controls">${def.controls.replace(/\{(\w+)\}/g, (_, action) => bind(action))}</p><p class="yard-note">Shared 10 m hull / 5,000 lb deck. Fit your boat before departure. Start a new day to change boats; inspection is available at sea. Repair times and costs are prototype comparisons.</p></div></div><div class="day-footer">${ui.menuNotice || status.reason || `${bind('menuUp')} / ${bind('menuDown')} Inspect boats · ${bind('confirm')} Fit highlighted boat · ${bind('back')} Back`}</div>`;
  paintVesselPreviews(ui.panel);
  appendChoices(
    ui.panel.querySelector('.yard-choices'),
    ui,
    w,
    ui
      .choices(w)
      .map((label, i) => (i < BOATS.length && BOATS[i].id === active.id ? '✓ ' : '') + label),
  );
}
