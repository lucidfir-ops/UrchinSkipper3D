import { choiceButton } from './menu-buttons.js';
import { UI_OPTIONS, DIFFICULTY_OPTIONS, OPTION_DETAILS } from './assist-options.js';
import { presetLabel } from './assists.js';

export function renderAssistOptions(ui, w, actions) {
  // Focus updates the explanation in place. Rebuilding here can remove a
  // pointer-pressed switch before Firefox delivers its click on release.
  const signature = JSON.stringify([ui.index, w.career.assists]);
  if (ui.signature === signature) return;
  ui.signature = signature;
  ui.panel.innerHTML = `<div class="day-heading"><h2>UI / difficulty options</h2></div><p>Preset: <strong>${presetLabel(w.career.assists.preset)}</strong> · Hide UI temporarily hides this selected set; Show UI restores it.</p><div class="assist-presets choices"></div><div class="assist-layout"><div class="assist-groups choices"></div><article class="assist-explanation" aria-live="polite"></article></div><div class="day-footer">Arrange UI layout previews every window, including hidden ones. Move, resize and show/hide with keyboard, gamepad or touch; Save keeps your layout. Touchscreen mode also offers in-game ↔, × and corner handles.</div>`;
  const explain = (key) => {
    ui.assistInspection = key;
    const detail = OPTION_DETAILS[key];
    const box = ui.panel.querySelector('.assist-explanation');
    box.replaceChildren();
    const h = document.createElement('h3'),
      p = document.createElement('p');
    h.textContent = detail?.[0] || 'Your information layout';
    p.textContent =
      detail?.[1] ||
      'Select an option for its explanation. UI options control where information appears; difficulty options change the information or assistance available. Changes to a preset become Custom.';
    box.append(h, p);
    if (innerWidth <= 700) ui.panel.querySelector(`[data-option="${key}"]`)?.after(box);
  };
  const groups = ui.panel.querySelector('.assist-groups');
  for (const [title, options] of [
    ['UI options · any difficulty', UI_OPTIONS],
    ['Difficulty assists', DIFFICULTY_OPTIONS],
  ]) {
    const h = document.createElement('h3');
    h.textContent = title;
    groups.append(h);
    for (const key of Object.keys(options)) {
      const index = actions.findIndex((a) => a.id === `assist-${key}`);
      if (index < 0) continue;
      const row = document.createElement('div');
      row.className = 'assist-row';
      row.dataset.option = key;
      const info = document.createElement('button');
      info.className = 'assist-info';
      info.textContent = options[key][0];
      info.onclick = () => explain(key);
      const toggle = choiceButton(ui, w, w.career.assists[key] ? 'ON' : 'OFF', index, {
        action: actions[index],
      });
      toggle.setAttribute('aria-label', options[key][0]);
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', String(w.career.assists[key]));
      toggle.onfocus = () => explain(key);
      row.append(info, toggle);
      groups.append(row);
    }
  }
  actions.forEach((action, index) => {
    if (action.id.startsWith('assist-')) return;
    ui.panel
      .querySelector('.assist-presets')
      .append(choiceButton(ui, w, action.label, index, { action }));
  });
  const selected = actions[ui.index]?.id.replace('assist-', '');
  explain(OPTION_DETAILS[selected] ? selected : ui.assistInspection);
}
