// Steam Deck built-in controls in a desktop/web browser.
//
// Outside a "Gamepad" Steam Input template the Deck does not reach the Gamepad
// API at all: Steam's default Desktop layout turns the controls into keys and
// mouse (D-pad and left stick = arrows, A = Enter, B and Start = Escape,
// Y = Space, View = Tab, L1 = Left Ctrl, R1 = Left Alt, back grips = Shift,
// Meta, PageUp, PageDown, left trackpad = mouse wheel, R2/L2 = clicks).
// This layout makes those keys play the boat instead of acting as thrusters
// and browser shortcuts. A real gamepad template keeps working unchanged.
const KEY = 'urchin3d-deck-controls-v1';
export const DECK_MODES = ['auto', 'on', 'off'];
let mode = 'auto';
try {
  const saved = globalThis.localStorage?.getItem(KEY);
  if (DECK_MODES.includes(saved)) mode = saved;
} catch {
  /* Optional preference. */
}

export function looksLikeSteamDeck(nav = globalThis.navigator, scr = globalThis.screen) {
  const ua = nav?.userAgent || '';
  if (!/Linux|X11/.test(ua) || /Android/.test(ua)) return false;
  const pads = (() => {
    try {
      return [...(nav.getGamepads?.() || [])].filter(Boolean);
    } catch {
      return [];
    }
  })();
  if (pads.some((p) => /^28de-|Vendor: 28de/i.test(p.id))) return true;
  const w = scr?.width,
    h = scr?.height;
  return (w === 1280 && h === 800) || (w === 800 && h === 1280);
}

export const deckControlsMode = () => mode;
export const deckControlsActive = () => mode === 'on' || (mode === 'auto' && looksLikeSteamDeck());
export function cycleDeckControls() {
  mode = DECK_MODES[(DECK_MODES.indexOf(mode) + 1) % DECK_MODES.length];
  try {
    globalThis.localStorage?.setItem(KEY, mode);
  } catch {
    /* The live choice still applies this session. */
  }
  return mode;
}
export const deckControlsLabel = () =>
  `Steam Deck controls: ${mode === 'auto' ? `Auto (${deckControlsActive() ? 'on' : 'off'})` : mode === 'on' ? 'On' : 'Off'}`;

// Lone bumper presses arrive as modifier keys; they are buttons here.
export const DECK_BUTTON_KEYS = ['ControlLeft', 'AltLeft'];
const ADD = {
  throttleUp: ['ArrowUp'],
  throttleDown: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  recoverDiver: ['ControlLeft'],
  work: ['AltLeft'],
};
// Mouse wheel and the Deck's left trackpad zoom for every player.
const ALWAYS = { zoomIn: ['WheelUp'], zoomOut: ['WheelDown'] };
// Arrows steer instead of firing thrusters; the Shift back grip must not
// toggle developer tools.
const REMOVE = {
  pivotPort: ['ArrowUp'],
  pivotStarboard: ['ArrowDown'],
  thrustPort: ['ArrowLeft'],
  thrustStarboard: ['ArrowRight'],
  debug: ['ShiftLeft', 'ShiftRight'],
};
export function deckCodes(action, codes, active = deckControlsActive()) {
  if (ALWAYS[action]) codes = [...codes, ...ALWAYS[action]];
  if (!active) return codes;
  const removed = REMOVE[action];
  const kept = removed ? codes.filter((c) => !removed.includes(c)) : codes;
  return ADD[action] ? [...new Set([...kept, ...ADD[action]])] : kept;
}
