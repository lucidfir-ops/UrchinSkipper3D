import { bindingName, LABELS } from './input.js';

const shortActions = {
  throttleUp: 'Throttle up',
  throttleDown: 'Throttle down',
  neutral: 'Neutral',
  centerRudder: 'Centre rudder',
  left: 'Rudder left',
  right: 'Rudder right',
  fullAhead: 'Full ahead',
  fullReverse: 'Full reverse',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  recoverDiver: 'Deploy / board',
  work: 'Take / give bag',
  recall: 'Clang hull',
  pivotPort: 'Jet left',
  pivotStarboard: 'Jet right',
  thrustPort: 'Bow left',
  thrustStarboard: 'Bow right',
  debug: 'Detail levels',
  cycleDiver: 'Next diver',
  pause: 'Menu',
  confirm: 'Select',
  back: 'Back',
  menuUp: 'Menu ↑',
  menuDown: 'Menu ↓',
  menuLeft: 'Menu ←',
  menuRight: 'Menu →',
  instructions: 'Orders',
  quickOrders: 'Orders',
  chart: 'Chart',
  assists: 'Assists',
  almanac: 'Tides',
  boatyard: 'Boats',
  bindings: 'Remap',
  diagnostics: 'Input info',
};
const letters = (text) => [...text].map((c) => `Key${c}`);
export const KEYBOARD_ROWS = [
  ['Escape', ...Array.from({ length: 12 }, (_, n) => `F${n + 1}`)],
  [
    'Backquote',
    ...'1234567890'.split('').map((c) => `Digit${c}`),
    'Minus',
    'Equal',
    ['Backspace', 2],
  ],
  [['Tab', 1.5], ...letters('QWERTYUIOP'), 'BracketLeft', 'BracketRight', ['Backslash', 1.5]],
  [['CapsLock', 1.8], ...letters('ASDFGHJKL'), 'Semicolon', 'Quote', ['Enter', 2.2]],
  [['ShiftLeft', 2.3], ...letters('ZXCVBNM'), 'Comma', 'Period', 'Slash', ['ShiftRight', 2.7]],
  [
    ['ControlLeft', 1.5],
    ['MetaLeft', 1.5],
    ['AltLeft', 1.5],
    ['Space', 6],
    ['AltRight', 1.5],
    ['MetaRight', 1.5],
    ['ControlRight', 1.5],
  ],
  [
    'Insert',
    'Home',
    'PageUp',
    'Delete',
    'End',
    'PageDown',
    'ArrowLeft',
    'ArrowUp',
    'ArrowDown',
    'ArrowRight',
  ],
  [
    ...Array.from({ length: 10 }, (_, n) => `Numpad${n}`),
    'NumpadAdd',
    'NumpadSubtract',
    'NumpadEnter',
  ],
  ['NumpadMultiply', 'NumpadDivide', 'NumpadDecimal'],
];
export const KEYBOARD_CODES = KEYBOARD_ROWS.flat()
  .map((key) => (Array.isArray(key) ? key[0] : key))
  .filter((code) => !/^(Control|Meta|Alt)/.test(code));
const keyNames = {
  Escape: 'Esc',
  Backquote: '`',
  Backspace: 'Backspace',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  CapsLock: 'Caps',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  MetaLeft: 'Super',
  MetaRight: 'Super',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  NumpadAdd: 'Pad +',
  NumpadSubtract: 'Pad −',
  NumpadEnter: 'Pad ↵',
};
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export function keyboardDiagram(input, selectedAction, career) {
  const actionsFor = (code) => Object.keys(input.map).filter((a) => input.map[a].includes(code));
  // The unused numeric pad is condensed; every bound or selected pad key expands.
  const rows = KEYBOARD_ROWS.map((row, index) =>
    index < 7 ? row : row.filter((k) => actionsFor(k).length),
  );
  return `<div class="keyboard-diagram" role="img" aria-label="Keyboard diagram with current control bindings">${rows
    .filter((r) => r.length)
    .map(
      (row) =>
        `<div class="keyboard-row">${row
          .map((item) => {
            const [code, width] = Array.isArray(item) ? item : [item, 1];
            const actions = actionsFor(code);
            const labels = actions
              .filter((a) => !a.startsWith('menu') || actions.length === 1)
              .map((a) =>
                a === 'debug' && !career ? 'Test reveal' : shortActions[a] || LABELS[a],
              );
            return `<div class="keycap ${actions.length ? 'bound' : ''} ${actions.includes(selectedAction) ? 'active' : ''}" data-key="${code}" style="flex:${width}" title="${escape(bindingName(code) + ': ' + (labels.join(' / ') || 'Unbound'))}"><strong>${escape(keyNames[code] || bindingName(code))}</strong><span>${escape(labels.join(' · '))}</span></div>`;
          })
          .join('')}</div>`,
    )
    .join('')}</div>`;
}
