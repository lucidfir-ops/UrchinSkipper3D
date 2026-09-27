// September 15 designer amendment. Only unchanged keyboard defaults migrate;
// saved physical controller codes and custom keyboard actions keep their owners.
export const PREVIOUS_KEYBOARD = {
  throttleUp: ['KeyW', 'ArrowUp'],
  throttleDown: ['KeyS', 'ArrowDown'],
  neutral: ['KeyN'],
  centerRudder: ['KeyK'],
  left: ['KeyJ', 'ArrowLeft'],
  right: ['KeyL', 'ArrowRight'],
  zoomIn: ['Equal'],
  zoomOut: ['Minus'],
  work: ['Space', 'KeyY'],
  recoverDiver: ['KeyX'],
  debug: ['F3'],
  recall: ['KeyR'],
  pivotPort: ['KeyU'],
  pivotStarboard: ['KeyI'],
  thrustPort: ['KeyQ'],
  thrustStarboard: ['KeyE'],
};
export const isGamepadCode = (code) => /^(b\d+|a\d+[+-])$/.test(code);
export function migrateKeyboard(saved, defaults, overlaps) {
  const map = structuredClone(saved);
  const migrating = new Set(
    Object.entries(PREVIOUS_KEYBOARD)
      .filter(([action, old]) => {
        const keys = map[action]?.filter((c) => !isGamepadCode(c));
        return keys?.length === old.length && old.every((c) => keys.includes(c));
      })
      .map(([action]) => action),
  );
  for (const action of migrating) {
    const keys = defaults[action].filter(
      (c) =>
        !isGamepadCode(c) &&
        !Object.entries(map).some(
          ([other, codes]) =>
            !migrating.has(other) &&
            other !== action &&
            overlaps(action, other) &&
            Array.isArray(codes) &&
            codes.includes(c),
        ),
    );
    map[action] = [...keys, ...map[action].filter(isGamepadCode)];
  }
  return map;
}

export const isShift = (code) => /^Shift(Left|Right)$/.test(code);
// Shift + = is the printed + key on common keyboards. Other modified
// shortcuts retain their browser/desktop behavior and never command the boat.
export const keyboardChord = (e) =>
  e.altKey ||
  e.ctrlKey ||
  e.metaKey ||
  (e.shiftKey && !isShift(e.code) && !(e.code === 'Equal' && e.key === '+'));
export const editingKey = (e) =>
  (e.target?.matches?.('input,select,textarea,[contenteditable="true"]') &&
    !/^(Escape|F\d{1,2}|Browser\w+|Launch\w+)$/.test(e.code)) ||
  (e.target?.closest?.('[data-hud-window], [data-resize-window], [data-move-window]') &&
    /^(Arrow(Up|Down|Left|Right)|PageUp|PageDown|Home|End)$/.test(e.code));
export function protectKeyboard(e) {
  if (keyboardChord(e) || /^(Alt|Control|Meta|Shift)(Left|Right)$/.test(e.code) || editingKey(e))
    return;
  e.preventDefault();
}
