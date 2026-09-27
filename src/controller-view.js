import { openBindingPicker } from './binding-picker.js';
import { DEFAULTS, LABELS, bindingName } from './input.js';
import { keyboardDiagram, KEYBOARD_CODES } from './keyboard-view.js';
export const BINDING_VIEWS = ['keyboard', 'controller', 'deck'];
export function setBindingView(ui, view) {
  ui.bindingView = view;
  ui.remapDevice = view === 'keyboard' ? 'keyboard' : 'gamepad';
  ui.input.capture = null;
  ui.input.suppress();
  ui.signature = null;
}
// Original vector illustrations; browser-standard positions are references, not
// guesses about a raw Steam Deck device. Capture still records actual input.
export function controllerDiagram(deck = false) {
  const body = deck
    ? 'M30 50Q10 50 10 80V172Q10 202 38 202H462Q490 202 490 172V80Q490 50 462 50Z'
    : 'M122 52Q80 42 67 81L27 193Q19 224 49 232Q72 238 92 206L143 154H357L408 206Q428 237 451 232Q481 224 473 193L433 81Q420 42 378 52Z';
  const lx = deck ? 97 : 136,
    rx = deck ? 450 : 365;
  return `<svg viewBox="0 0 500 270" role="img" aria-label="${deck ? 'Steam Deck' : 'Xbox controller'} control reference"><g fill="#263c48" stroke="#91adb1" stroke-width="2"><path d="${body}"/>${deck ? '<rect x="128" y="67" width="244" height="121" rx="5" fill="#101e2a"/><rect x="51" y="140" width="42" height="42" rx="6"/><rect x="407" y="140" width="42" height="42" rx="6"/>' : ''}<circle cx="${lx}" cy="95" r="22" fill="#142730"/><circle cx="${deck ? 400 : 295}" cy="${deck ? 95 : 159}" r="22" fill="#142730"/><path d="M${deck ? 40 : 190} ${deck ? 88 : 132}h12v12h12v12h-12v12h-12v-12h-12v-12h12Z" fill="#152a36"/>${[
    [0, -22, 'Y'],
    [-22, 0, 'X'],
    [22, 0, 'B'],
    [0, 22, 'A'],
  ]
    .map(
      ([x, y, n]) =>
        `<circle cx="${rx + x}" cy="${95 + y}" r="10" fill="#12232c"/><text x="${rx + x}" y="${99 + y}" text-anchor="middle" fill="#ffe0a3" stroke="none" font-size="12">${n}</text>`,
    )
    .join(
      '',
    )}</g><g stroke="#e6ca95" stroke-width="1" fill="none"><path d="M${lx} 72V24H20M${rx} 66V24H480M${deck ? 46 : 195} ${deck ? 122 : 165}V240H20M${deck ? 400 : 295} ${deck ? 117 : 180}V240H480"/></g><g fill="#ebdfc2" font-family="system-ui" font-size="13"><text x="20" y="17">LT / LB · left stick</text><text x="480" y="17" text-anchor="end">RT / RB · face buttons</text><text x="20" y="259">D-pad</text><text x="480" y="259" text-anchor="end">Right stick · R3</text><text x="250" y="220" text-anchor="middle">${deck ? 'Steam Deck' : 'Xbox controller'}</text></g></svg>`;
}
export function decorateBindings(ui, world) {
  const panel = ui.panel,
    input = ui.input;
  const diagrams = document.createElement('div');
  diagrams.className = 'controller-diagrams';
  const tabs = document.createElement('div');
  tabs.className = 'binding-views';
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Control diagram');
  for (const [view, label] of [
    ['keyboard', 'Keyboard'],
    ['controller', 'Controller'],
    ['deck', 'Steam Deck'],
  ]) {
    const button = document.createElement('button');
    button.textContent = label;
    button.dataset.bindingView = view;
    button.setAttribute('aria-pressed', String(ui.bindingView === view));
    button.onclick = () => {
      setBindingView(ui, view);
      ui.canvas.focus();
    };
    tabs.append(button);
  }
  diagrams.append(tabs);
  const figure = document.createElement('div');
  figure.className = 'binding-figure';
  figure.innerHTML =
    ui.bindingView === 'keyboard'
      ? keyboardDiagram(input, Object.keys(DEFAULTS)[ui.index], !!world.career)
      : controllerDiagram(ui.bindingView === 'deck');
  for (const key of figure.querySelectorAll('[data-key]')) {
    if (!KEYBOARD_CODES.includes(key.dataset.key)) continue;
    key.tabIndex = 0;
    key.setAttribute('role', 'button');
    key.setAttribute('aria-label', `Assign ${bindingName(key.dataset.key)}`);
    key.onclick = () => openBindingPicker(ui, key.dataset.key);
    key.onkeydown = (e) => {
      if (['Enter', ' '].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        openBindingPicker(ui, key.dataset.key);
      }
    };
  }
  diagrams.append(figure);
  const caption = document.createElement('p');
  caption.className = 'binding-caption';
  caption.textContent =
    ui.bindingView === 'keyboard'
      ? 'Hold Caps for bow thrust. Tap Shift alone to cycle detail levels. Arrows also navigate menus; Enter selects. Alt / Ctrl / Super shortcuts stay available.'
      : 'Bindings belong to the active controller. Steam Deck uses Steam’s Gamepad layout; use physical capture for custom layouts. Verify X/Y in Controller setup.';
  diagrams.append(caption);
  panel.querySelector('.menu-body').prepend(diagrams);
  panel.classList.add('bindings-panel');
  for (const [index, action] of Object.keys(DEFAULTS).entries()) {
    const button = panel.querySelector(`[data-choice-index="${index}"]`);
    const row = document.createElement('div');
    row.className = 'binding-row';
    button.before(row);
    row.append(button);
    const select = document.createElement('select');
    select.setAttribute('aria-label', `${LABELS[action]} ${ui.remapDevice} binding`);
    const gamepad = ui.remapDevice === 'gamepad';
    const current = input.map[action].filter((c) => /^(b\d+|a\d+[+-])$/.test(c) === gamepad);
    const codes = gamepad
      ? [
          ...Array.from({ length: input.activePad?.buttons.length || 16 }, (_, i) => `b${i}`),
          ...Array.from({ length: input.activePad?.axes.length || 4 }, (_, i) => [
            `a${i}-`,
            `a${i}+`,
          ]).flat(),
        ]
      : [...new Set([...KEYBOARD_CODES, ...current])];
    for (const [value, label] of [
      [
        '',
        current.length
          ? 'Current: ' + current.map((c) => bindingName(c, input.faceNames)).join(' / ')
          : 'Unbound',
      ],
      ['capture', 'Press an input…'],
      ...codes.map((c) => [c, bindingName(c, input.faceNames) + (gamepad ? ` (${c})` : '')]),
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    select.onchange = () => {
      if (!select.value) return;
      input.beginCapture(action, ui.remapDevice);
      if (select.value !== 'capture') {
        input.assign(select.value);
        if (input.capture) input.capture = null;
      }
      ui.signature = null;
      ui.canvas.focus();
    };
    row.append(select);
  }
}
