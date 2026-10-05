import { choiceButton } from './menu-buttons.js';
import { formatClock } from './day.js';
import { presetLabel } from './assists.js';

const SETTINGS = [
  {
    title: 'Your interface',
    note: 'Information and instruments, arranged your way.',
    items: [
      ['assists', 'Information & difficulty', 'Choose what your skipper can see.'],
      ['layout', 'Arrange instruments', 'Position and size every window.'],
      ['ui-scale', 'UI scale', 'Adjust the size of menus and text.'],
      ['gameplay-speed', 'Gameplay speed', 'Set the pace of your working day.'],
    ],
  },
  {
    title: 'Controls',
    note: 'At home with a controller, keyboard or touch.',
    items: [
      ['bindings', 'Controls & remapping', 'View diagrams and change bindings.'],
      ['controller', 'Controller setup', 'Identify and configure your device.'],
      ['deck-controls', null, 'Play with the built-in Deck controls in a web browser.'],
      ['touch-options', 'Touchscreen options', 'Controls, opacity and touch layout.'],
      ['fullscreen', null, 'Use the whole screen.'],
    ],
  },
  {
    title: 'Picture & sound',
    note: 'Make the coast look and sound right.',
    items: [
      ['menu-theme', null, 'Night is easier on the eyes; Day is bright chart paper.'],
      ['graphics', null, 'Select to cycle rendering quality.'],
      ['volume', 'Sound volume', 'Drag or use ← / → to adjust. 0% mutes sound.'],
    ],
  },
  {
    title: 'Session & support',
    note: 'Optional tools for this device.',
    items: [
      ['logging', null, 'Keep a local record to help diagnose issues.'],
      ['download-log', 'Download troubleshooting log', 'Save the local record to a file.'],
      ['exit', 'Exit game', 'Review before ending your session.'],
    ],
  },
];

export function menuFooter(ui, bind, note = '') {
  const footer = document.createElement('div');
  footer.className = 'day-footer menu-footer';
  const status = document.createElement('span');
  status.textContent = ui.menuNotice || ui.saveNotice || note;
  const keys = document.createElement('span');
  keys.className = 'menu-legend';
  keys.textContent = ui.input.touchEnabled
    ? 'Tap to choose · Swipe to scroll'
    : `${bind('confirm')} Select  ·  ${bind('back')} Back`;
  footer.append(status, keys);
  return footer;
}

function volumeRow(ui, action, index, description) {
  const wrapper = document.createElement('div');
  wrapper.className = 'menu-volume';
  const value = Math.round((ui.hooks.audio?.volume ?? 0.35) * 100);
  wrapper.innerHTML = `<label for="soundVolume"><strong>Sound volume</strong><output id="soundVolumeValue" for="soundVolume">${value ? `${value}%` : 'Muted'}</output></label><input id="soundVolume" type="range" min="0" max="100" step="1" value="${value}" aria-label="Sound volume"/><small>${description}</small>`;
  const slider = wrapper.querySelector('input');
  slider.dataset.choiceIndex = String(index);
  slider.dataset.action = action.id;
  slider.onfocus = slider.onpointerdown = () => {
    ui.index = index;
  };
  slider.oninput = () => {
    ui.hooks.audio?.setVolume(Number(slider.value) / 100);
    wrapper.querySelector('output').textContent = Number(slider.value)
      ? `${slider.value}%`
      : 'Muted';
  };
  return wrapper;
}

function row(ui, world, action, index, title, description) {
  if (action.id === 'volume') return volumeRow(ui, action, index, description);
  const button = choiceButton(ui, world, action.label, index, { action });
  button.classList.add('menu-row');
  const label = title || action.label.replace(/^⛶ /, '');
  button.setAttribute('aria-label', label);
  const copy = document.createElement('span');
  copy.className = 'menu-row-copy';
  const name = document.createElement('strong');
  name.textContent = label;
  const hint = document.createElement('small');
  hint.textContent = description;
  copy.append(name, hint);
  const arrow = document.createElement('span');
  arrow.className = 'menu-row-arrow';
  arrow.textContent = ['graphics', 'boat-art', 'menu-theme'].includes(action.id)
    ? '↻'
    : action.id === 'download-log'
      ? '↓'
      : action.id === 'logging'
        ? ''
        : '›';
  if (action.id === 'logging') {
    const checked = /: ON$/.test(action.label);
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', String(checked));
    arrow.classList.add('menu-row-switch');
  }
  arrow.setAttribute('aria-hidden', 'true');
  button.replaceChildren(copy, arrow);
  return button;
}

export function renderSettings(ui, world, actions, bind) {
  ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">PREFERENCES · SAVED ON THIS DEVICE</div><h2>Settings</h2><p class="menu-introduction">Your instruments. Your controls. Your pace.</p></div></div><div class="menu-dashboard settings-dashboard choices"></div>`;
  const dashboard = ui.panel.querySelector('.menu-dashboard');
  for (const group of SETTINGS) {
    const section = document.createElement('section');
    section.className = 'menu-group';
    const heading = document.createElement('h3');
    heading.textContent = group.title;
    const note = document.createElement('p');
    note.className = 'menu-group-note';
    note.textContent = group.note;
    section.append(heading, note);
    for (const [id, label, description] of group.items) {
      const index = actions.findIndex((action) => action.id === id);
      if (index < 0) continue;
      section.append(row(ui, world, actions[index], index, label, description));
    }
    dashboard.append(section);
  }
  ui.panel.append(menuFooter(ui, bind, 'Changes apply immediately.'));
}

function pauseGroup(label) {
  if (/^Resume|^Harbour office|^Offload receipt|^Start a new day/.test(label)) return 'resume';
  if (/^REVEAL|^Debug|^Test |^Restart|^Ground laboratory|^Controller Diagnostics/.test(label))
    return 'Testing tools';
  if (/^Return to|^Exit/.test(label)) return 'Session';
  if (
    /^Settings|^Arrange|^UI \/|^Touchscreen|^⛶|^Controls|^Controller setup|^Information:|^Sound volume|^Action feedback/.test(
      label,
    )
  )
    return 'Preferences';
  return 'Aboard';
}

const PAUSE_HINTS = {
  Settings: 'Interface, controls, picture and sound',
  'Skipper Stuff': 'Radio, divers, charts and weather',
  'Deck catch': 'Inspect the bags aboard',
  'Equipment switches': 'Manage your fitted equipment',
  'Arrange UI layout': 'Move and resize your instruments',
  'UI / difficulty options': 'Choose your information and assistance',
  'Touchscreen Options': 'Touch controls, scale and opacity',
  'Return to Title Screen': 'Save your place and return to the coast',
  'Debug mode': 'Live conditions and development tools',
};

export function renderPause(ui, world, bind) {
  const choices = ui.choices(world),
    compact = matchMedia('(max-width: 700px)').matches,
    signature = JSON.stringify(['pause-workspace', choices, ui.menuNotice, ui.index, compact]);
  if (ui.signature === signature) return;
  ui.signature = signature;
  const mode = world.career ? presetLabel(world.career.difficulty) : 'Practice';
  ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">${mode.toUpperCase()} · ${formatClock(world.day.minute)} · TIME PAUSED</div><h2>At the helm</h2></div></div><div class="pause-primary choices"></div><div class="menu-dashboard pause-dashboard choices"></div>`;
  const dashboard = ui.panel.querySelector('.pause-dashboard'),
    sections = new Map();
  for (const name of ['Aboard', 'Preferences', 'Session', 'Testing tools']) {
    const section = document.createElement('section');
    section.className = `menu-group menu-group-${name.split(' ')[0].toLowerCase()}`;
    const heading = document.createElement('h3');
    heading.textContent = name;
    section.append(heading);
    sections.set(name, section);
  }
  choices.forEach((label, index) => {
    if (/^Back( |$)/.test(label)) return;
    const group = pauseGroup(label);
    const button = row(
      ui,
      world,
      { label },
      index,
      label === 'Skipper Stuff' ? 'Skipper’s desk' : null,
      PAUSE_HINTS[label] || '',
    );
    if (group === 'resume') {
      button.classList.add('menu-primary');
      ui.panel.querySelector('.pause-primary').append(button);
    } else sections.get(group).append(button);
  });
  // Keep short working/session groups together instead of making each wait for
  // the taller preferences column. Secondary tools remain below preferences.
  if (compact) {
    // DOM order follows the single-column view, including native Tab traversal.
    for (const section of sections.values())
      if (section.children.length > 1) dashboard.append(section);
  } else {
    for (const names of [
      ['Aboard', 'Session'],
      ['Preferences', 'Testing tools'],
    ]) {
      const column = document.createElement('div');
      column.className = 'pause-column';
      for (const name of names) {
        const section = sections.get(name);
        if (section.children.length > 1) column.append(section);
      }
      if (column.children.length) dashboard.append(column);
    }
  }
  ui.panel.append(menuFooter(ui, bind, 'Menus pause the working day.'));
}

export function restoreMenuScroll(panel, positions) {
  for (const { selector, top, left } of positions || []) {
    const element = panel.querySelector(selector);
    if (element) {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
  }
}

const READING_PANES = [
  ['.expedition-copy', 'expedition-copy', 'Forecast and chart details'],
  ['.career-detail', 'career-detail', 'Selected item details'],
  ['.yard-detail', 'yard-detail', 'Boat details'],
  ['.landing-receipt', 'landing-receipt', 'Landing receipt'],
  ['.almanac-curves', 'almanac-curves', 'Tide and current forecast'],
  ['.almanac-layout', 'almanac-curves', 'Tide, current and chart details'],
  ['.almanac-map', 'almanac-map', 'Tidal chart and notes'],
  ['.frank-lesson', 'frank-lesson', 'Skipper’s notes'],
  ['.radio-history', 'radio-history', 'Radio history'],
  ['.orders-help', 'orders', 'Diver search orders'],
  ['.orders-layout', 'orders', 'Diver search orders'],
  ['.intro-copy', 'intro-copy', 'Training notes'],
  ['.assist-explanation', 'assist-explanation', 'Information and difficulty guidance'],
  ['.controller-diagrams', 'controller-diagrams', 'Controller diagrams'],
  ['.binding-figure', 'binding-figure', 'Control diagram'],
];

export function decorateMenuReading(panel, enabled = true) {
  const readers = new Set();
  for (const [selector, key, label] of READING_PANES) {
    const pane = panel.querySelector(selector);
    if (!pane) continue;
    // Compact Orders scrolls its whole layout; desktop scrolls only its help.
    // Expanded touch text and overflow:hidden layout wrappers are not readers.
    const style = getComputedStyle(pane),
      readable = enabled && !readers.has(key) && /^(auto|scroll)$/.test(style.overflowY);
    if (readable) {
      readers.add(key);
      pane.dataset.menuReading = key;
      pane.tabIndex = 0;
      pane.setAttribute('role', 'region');
      pane.setAttribute(
        'aria-label',
        key === 'expedition-copy' && panel.dataset.screen === 'conditions'
          ? 'Forecast details'
          : label,
      );
      pane.setAttribute(
        'aria-description',
        'Use arrow keys, Page Up, Page Down, Home or End to scroll. Tab moves to controls.',
      );
    } else if (pane.dataset.menuReading) {
      delete pane.dataset.menuReading;
      for (const attribute of ['tabindex', 'role', 'aria-label', 'aria-description'])
        pane.removeAttribute(attribute);
    }
  }
}

export function captureMenuReadingFocus(panel) {
  const active = panel.ownerDocument.activeElement;
  return panel.contains(active) ? active.dataset.menuReading : undefined;
}

export function restoreMenuReadingFocus(panel, key) {
  if (!key) return;
  const pane = Array.from(panel.querySelectorAll('[data-menu-reading]')).find(
    (candidate) => candidate.dataset.menuReading === key,
  );
  if (pane && pane !== panel.ownerDocument.activeElement) pane.focus({ preventScroll: true });
}

export function captureMenuScroll(panel) {
  return [
    '.career-choices',
    '.career-detail',
    '.menu-dashboard',
    '.menu-body .choices',
    '.intro-copy',
    '.touch-option-groups',
    '.assist-groups',
    '.assist-explanation',
    '.layout-controls-card',
    '.layout-elements-card',
    '.controller-diagrams',
    '.binding-figure',
    '.expedition-copy',
    '.expedition-choices',
    '.yard-detail',
    '.yard-choices',
    '.almanac-curves',
    '.almanac-layout',
    '.almanac-map',
    '.landing-receipt',
    '.radio-history',
    '.orders-help',
    '.orders-layout',
    '.frank-lesson',
  ].flatMap((selector) => {
    const element = panel.querySelector?.(selector);
    return element ? [{ selector, top: element.scrollTop, left: element.scrollLeft }] : [];
  });
}
