import { choiceButton } from './menu-buttons.js';
import { paintVesselPreviews, vesselPreview } from './vessel-art.js';
import { FLEET, UPGRADES, money } from './career-data.js';
import { boatDefinition } from './boats.js';
import { equipmentAvailability, equipmentGroup, equipmentLocation } from './equipment-fit.js';
import { equipmentIcon } from './equipment-view.js';

// Two sibling buttons form one card. Real nested <button> elements lose click
// ownership and accessibility; Buy is an independent, controller-reachable action.
export function renderShopChoices(ui, w, actions) {
  const panel = ui.panel,
    list = panel.querySelector('.choices'),
    toolbar = document.createElement('div'),
    footer = document.createElement('div');
  toolbar.className = 'shop-toolbar';
  footer.className = 'shop-purchase-footer';
  panel.querySelector('.day-heading').after(toolbar);
  panel.querySelector('.day-footer').before(footer);
  list.classList.add('shop-choices');
  if (['starter', 'fleet', 'boatshop'].includes(ui.screen)) list.classList.add('boat-pairs');
  let selectedRow;
  actions.forEach((action, index) => {
    if (action.placement === 'inline') return;
    const button = choiceButton(ui, w, action.label, index, { action });
    // The first-boat screen has one persistent purchase footer; a second large
    // purchase row above two boats only obscures the comparison.
    if (ui.screen === 'starter' && action.id === 'buy-top') return;
    if (ui.screen === 'starter' && action.id === 'difficulty') {
      button.classList.add('starter-difficulty');
      footer.prepend(button);
      return;
    }
    if (action.id === 'your-boat') button.classList.add('your-boat-button');
    if (action.placement === 'top') toolbar.append(button);
    else if (action.placement === 'bottom') footer.append(button);
    else if (action.preview) {
      if (ui.screen === 'outfit') {
        const group = equipmentGroup(UPGRADES.find((i) => i.id === action.equipmentId));
        if (list.dataset.group !== group) {
          const h = document.createElement('h3');
          h.textContent = group;
          list.append(h);
          list.dataset.group = group;
        }
      }
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.classList.toggle('is-preview', !!action.selected);
      button.classList.add('shop-inspect');
      button.setAttribute('aria-pressed', String(!!action.selected));
      if (action.equipmentId) {
        const item = UPGRADES.find((candidate) => candidate.id === action.equipmentId);
        const status = equipmentAvailability(w, item);
        button.classList.add('shop-equipment-card');
        button.setAttribute('aria-label', action.label);
        button.innerHTML = `${equipmentIcon(item)}<span class="shop-equipment-copy"><strong>${item.name}</strong><small>${equipmentLocation(item)} · ${money(item.price)}</small><span class="shop-equipment-state ${status.owned ? 'owned' : status.ok ? 'available' : 'unavailable'}">${status.label}</span></span>`;
      }
      if (action.boatId) {
        const boat = FLEET[action.boatId],
          name = boatDefinition(action.boatId).name;
        button.classList.add('shop-vessel-card');
        button.setAttribute('aria-label', action.label);
        button.innerHTML = `${vesselPreview(action.boatId, name)}<span class="shop-vessel-copy"><strong>${name}</strong><small>${boat.capacity.toLocaleString()} lb deck · ${boat.fuelCapacity} L tank</small><span class="shop-vessel-price">${/ · Owned$/.test(action.label) ? 'Owned' : money(boat.price)}</span><span class="shop-vessel-state">${action.selected ? 'Selected for review' : 'Inspect boat'}</span></span>`;
      }
      row.append(button);
      list.append(row);
      if (action.selected) selectedRow = row;
    } else list.append(button);
  });
  if (!toolbar.children.length) toolbar.hidden = true;
  paintVesselPreviews(list);
  if (selectedRow) {
    if (ui.screen !== 'starter') {
      const index = actions.findIndex((a) => a.placement === 'inline'),
        action = actions[index],
        buy = choiceButton(ui, w, action.label, index, { action });
      buy.classList.add('shop-inline-buy');
      selectedRow.append(buy);
    }
    const detail = document.createElement('article');
    detail.className = 'shop-inline-detail';
    detail.innerHTML = panel.querySelector('.career-detail').innerHTML;
    if (list.classList.contains('boat-pairs')) {
      const rows = [...list.querySelectorAll('.shop-row')],
        index = rows.indexOf(selectedRow);
      // Keep a sister beside her original; expanded copy goes below that pair.
      (rows[index % 2 === 0 ? index + 1 : index] || selectedRow).after(detail);
    } else selectedRow.append(detail);
    paintVesselPreviews(detail);
  }
}
