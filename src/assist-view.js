import { choiceButton } from './menu-buttons.js';
import { UI_OPTIONS, DIFFICULTY_OPTIONS, OPTION_DETAILS } from './assist-options.js';
import { assist, presetLabel } from './assists.js';
import { setText } from './dom-view.js';

const GROUPS = [
  [
    'Instruments',
    'Independent gauges and text readouts.',
    [
      'timepiece',
      'depthInstrument',
      'compassGauge',
      'hullGauge',
      'loadGauge',
      'speedGauge',
      'throttleGauge',
      'fuelGauge',
      'helmOverlay',
      'sounder',
      'clockOverlay',
    ],
  ],
  [
    'Navigation',
    'Your chart, conditions and route home.',
    ['minimap', 'almanacShortcut', 'weatherOverlay', 'departureGuidance'],
  ],
  [
    'Crew & feedback',
    'Keep the people and prompts you need in view.',
    [
      'diverCards',
      'diverPortraits',
      'actionPrompts',
      'controlsHelp',
      'feedbackOverlay',
      'frankOverlay',
    ],
  ],
  [
    'Difficulty assists',
    'Available assistance is limited by your career difficulty.',
    Object.keys(DIFFICULTY_OPTIONS),
  ],
];

function explain(ui, key) {
  ui.assistInspection = key;
  const detail = OPTION_DETAILS[key];
  setText(
    ui.panel.querySelector('.assist-explanation h3'),
    detail?.[0] || 'Your information layout',
  );
  setText(
    ui.panel.querySelector('.assist-explanation p'),
    detail?.[1] ||
      'Select an option to read about it. Ordinary instruments are available in either career difficulty. Assistance respects your career’s information limits.',
  );
}

export function renderAssistOptions(ui, w, actions) {
  // A pressed switch and its focused explanation must survive each render.
  // Only a different set of available actions requires mounting a new view.
  const structure = actions.map((action) => action.id).join('|');
  if (ui.panel.querySelector('.assist-layout')?.dataset.structure !== structure) {
    ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">INFORMATION & DIFFICULTY</div><h2>Your view from the helm.</h2><p class="menu-introduction">Choose the instruments and assistance you want aboard.</p></div><div class="assist-status">Information preset <strong></strong><small></small></div></div><div class="assist-presets choices" aria-label="Information presets"></div><div class="assist-tools choices" aria-label="Window layout"></div><div class="assist-layout"><div class="assist-groups choices"></div><article class="assist-explanation" aria-live="polite"><div class="eyebrow">ABOUT THIS OPTION</div><h3></h3><p></p><small>Changes apply immediately. Hide / Show information temporarily masks your chosen windows.</small></article></div>`;
    ui.panel.querySelector('.assist-layout').dataset.structure = structure;
    const groups = ui.panel.querySelector('.assist-groups');
    for (const [title, note, keys] of GROUPS) {
      const available = keys.filter((key) =>
        actions.some((action) => action.id === `assist-${key}`),
      );
      if (!available.length) continue;
      const section = document.createElement('section');
      section.className = 'assist-section';
      const heading = document.createElement('h3');
      heading.textContent = title;
      const description = document.createElement('p');
      description.className = 'assist-section-note';
      description.textContent = note;
      section.append(heading, description);
      for (const key of available) {
        const option = UI_OPTIONS[key] || DIFFICULTY_OPTIONS[key];
        const index = actions.findIndex((action) => action.id === `assist-${key}`);
        const row = document.createElement('div');
        row.className = 'assist-row';
        row.dataset.option = key;
        const info = document.createElement('button');
        info.className = 'assist-info';
        info.textContent = option[0];
        info.setAttribute('aria-label', `About ${option[0]}`);
        info.setAttribute('aria-expanded', 'false');
        info.setAttribute('aria-controls', `assist-about-${key}`);
        const detail = document.createElement('p');
        detail.className = 'assist-row-description';
        detail.id = `assist-about-${key}`;
        detail.textContent = option[1];
        detail.hidden = true;
        info.onclick = () => {
          explain(ui, key);
          detail.hidden = !detail.hidden;
          info.setAttribute('aria-expanded', String(!detail.hidden));
        };
        info.onfocus = () => explain(ui, key);
        const toggle = choiceButton(ui, w, '', index, { action: actions[index] });
        toggle.classList.add('assist-toggle');
        toggle.setAttribute('aria-label', option[0]);
        toggle.setAttribute('role', 'switch');
        toggle.onfocus = () => explain(ui, key);
        row.append(info, toggle, detail);
        section.append(row);
      }
      groups.append(section);
    }
    actions.forEach((action, index) => {
      if (action.id.startsWith('assist-')) return;
      const preset = ['easy', 'realistic', 'off', 'custom'].includes(action.id);
      ui.panel
        .querySelector(preset ? '.assist-presets' : '.assist-tools')
        .append(choiceButton(ui, w, action.label, index, { action }));
    });
    ui.assistLastIndex = null;
    explain(ui, ui.assistInspection);
  }
  setText(ui.panel.querySelector('.assist-status strong'), presetLabel(w.career.assists.preset));
  setText(
    ui.panel.querySelector('.assist-status small'),
    `${presetLabel(w.career.difficulty)} career · unchanged`,
  );
  for (const action of actions) {
    const button = ui.panel.querySelector(`[data-action="${action.id}"]`);
    if (!button) continue;
    if (action.id.startsWith('assist-')) {
      const checked = !!assist(w, action.id.slice(7), ui.realistic);
      setText(button, checked ? 'ON' : 'OFF');
      button.setAttribute('aria-checked', String(checked));
    } else if (['easy', 'realistic', 'off', 'custom'].includes(action.id)) {
      const active = action.id === w.career.assists.preset;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
  if (ui.assistLastIndex !== ui.index) {
    const key = actions[ui.index]?.id.replace('assist-', '');
    if (OPTION_DETAILS[key]) explain(ui, key);
    ui.assistLastIndex = ui.index;
  }
}
