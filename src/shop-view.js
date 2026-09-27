import { choiceButton } from './menu-buttons.js';
import { paintVesselPreviews } from './vessel-art.js';
import { UPGRADES } from './career-data.js';

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
  if (['fleet', 'boatshop'].includes(ui.screen)) list.classList.add('boat-pairs');
  let selectedRow;
  actions.forEach((action, index) => {
    if (action.placement === 'inline') return;
    const button = choiceButton(ui, w, action.label, index, { action });
    if (action.id === 'your-boat') button.classList.add('your-boat-button');
    if (action.placement === 'top') toolbar.append(button);
    else if (action.placement === 'bottom') footer.append(button);
    else if (action.preview) {
      if (ui.screen === 'outfit') {
        const group =
          UPGRADES.find((i) => i.id === action.equipmentId)?.slot === 'timepiece'
            ? 'Timepiece'
            : 'Working equipment';
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
      row.append(button);
      list.append(row);
      if (action.selected) selectedRow = row;
    } else list.append(button);
  });
  if (selectedRow) {
    const index = actions.findIndex((a) => a.placement === 'inline'),
      action = actions[index],
      buy = choiceButton(ui, w, action.label, index, { action });
    buy.classList.add('shop-inline-buy');
    selectedRow.append(buy);
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
