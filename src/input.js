import { C } from './config.js';
import { migrateInputProfile } from './input-profiles.js';
import { TOUCH_LABELS } from './touch-controls.js';
import {
  migrateKeyboard,
  keyboardChord,
  editingKey,
  protectKeyboard,
  isShift,
} from './keyboard-controls.js';

// Physical inputs are resolved here; gameplay and menus consume only actions.
export const DEFAULTS = {
  throttleUp: ['KeyW', 'a1-'],
  throttleDown: ['KeyS', 'a1+'],
  fullAhead: ['PageUp', 'b12'],
  fullReverse: ['PageDown', 'b13'],
  neutral: ['KeyX', 'Space', 'b14', 'b15'],
  centerRudder: ['Enter', 'NumpadEnter'],
  left: ['KeyA', 'a2-'],
  right: ['KeyD', 'a2+'],
  zoomIn: ['Equal', 'NumpadAdd', 'b7'],
  zoomOut: ['Minus', 'NumpadSubtract', 'b6'],
  work: ['Digit2', 'b3'],
  recoverDiver: ['Digit1', 'b2'],
  instructions: ['KeyB', 'b1'],
  pause: ['Escape', 'b9'],
  confirm: ['Enter', 'NumpadEnter', 'b0'],
  back: ['Backspace', 'KeyB', 'b1'],
  menuUp: ['ArrowUp', 'b12'],
  menuDown: ['ArrowDown', 'b13'],
  menuLeft: ['ArrowLeft', 'b14'],
  menuRight: ['ArrowRight', 'b15'],
  diagnostics: ['F4', 'b8'],
  debug: ['ShiftLeft', 'ShiftRight', 'F3', 'b5'],
  bindings: ['F2'],
  cycleDiver: ['Tab', 'b4'],
  chart: ['KeyM', 'b10'],
  quickOrders: ['KeyO'],
  assists: ['F6', 'b11'],
  recall: ['Digit3', 'b0'],
  pivotPort: ['KeyQ', 'ArrowUp', 'a3-'],
  pivotStarboard: ['KeyE', 'ArrowDown', 'a3+'],
  thrustPort: ['CapsLock', 'ArrowLeft', 'a0-'],
  thrustStarboard: ['KeyF', 'ArrowRight', 'a0+'],
  boatyard: ['KeyG'],
  almanac: ['KeyT'],
};
export const LABELS = {
  throttleUp: 'Increase throttle',
  throttleDown: 'Decrease throttle',
  fullAhead: 'Full Ahead',
  fullReverse: 'Full Reverse',
  neutral: 'Neutral throttle',
  centerRudder: 'Centre rudder',
  left: 'Increase port rudder',
  right: 'Increase starboard rudder',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  work: 'Take + give bag',
  recoverDiver: 'Recover Diver / deploy',
  instructions: 'Diver instructions',
  pause: 'Pause / close menu',
  confirm: 'Menu select',
  back: 'Menu back / cancel',
  menuUp: 'Menu up',
  menuDown: 'Menu down',
  menuLeft: 'Menu left',
  menuRight: 'Menu right',
  diagnostics: 'Controller diagnostics',
  debug: 'Test reveal: grounds / current / diver',
  bindings: 'Controls / remapping',
  cycleDiver: 'Select next diver',
  chart: 'Chart tools',
  quickOrders: 'Open diver orders',
  assists: 'Difficulty / assists',
  recall: 'Clang hull / recall nearby diver',
  pivotPort: 'Jet turn port',
  pivotStarboard: 'Jet turn starboard',
  thrustPort: 'Bow / docking thrust port',
  thrustStarboard: 'Bow / docking thrust starboard',
  boatyard: 'Prototype boatyard',
  almanac: 'Tide and current almanac',
};
const gameplay = new Set([
  'throttleUp',
  'throttleDown',
  'fullAhead',
  'fullReverse',
  'neutral',
  'centerRudder',
  'left',
  'right',
  'zoomIn',
  'zoomOut',
  'work',
  'recoverDiver',
  'instructions',
  'quickOrders',
  'assists',
  'recall',
  'cycleDiver',
  'pivotPort',
  'pivotStarboard',
  'thrustPort',
  'thrustStarboard',
  'boatyard',
  'almanac',
]);
const menu = new Set(['confirm', 'back', 'menuUp', 'menuDown', 'menuLeft', 'menuRight']);
const overlaps = (a, b) => !((gameplay.has(a) && menu.has(b)) || (menu.has(a) && gameplay.has(b)));
const gamepadCode = (code) => /^(b\d+|a\d+[+-])$/.test(code);
const validCode = (code) =>
  typeof code === 'string' &&
  (gamepadCode(code) ||
    /^(Key[A-Z]|Digit\d|Numpad(\d|Add|Subtract|Enter|Decimal|Multiply|Divide)|Arrow(Up|Down|Left|Right)|F\d{1,2}|Space|Enter|Escape|Backspace|PageUp|PageDown|Home|End|Insert|Delete|Equal|Minus|CapsLock|ShiftLeft|ShiftRight|Tab|Backquote|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(
      code,
    ));
const BUTTONS = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'View ▣',
  'Menu ≡',
  'L3',
  'R3',
  'D-pad Up',
  'D-pad Down',
  'D-pad Left',
  'D-pad Right',
];
// Physical X/Y names reported by the designer's working Steam Input layout.
// This changes names ONLY. b3 still performs work and b2 still boards.
export const PLAYTEST_FACE_NAMES = { b2: 'Y', b3: 'X' };
export function bindingName(code, names = PLAYTEST_FACE_NAMES) {
  if (/^b\d+$/.test(code))
    return names[code] || BUTTONS[Number(code.slice(1))] || `Button ${code.slice(1)}`;
  const axis = /^a(\d+)([+-])$/.exec(code);
  if (axis)
    return ['Left stick', 'Left stick', 'Right stick', 'Right stick'][axis[1]]
      ? `${Number(axis[1]) < 2 ? 'Left' : 'Right'} stick ${Number(axis[1]) % 2 ? (axis[2] === '-' ? 'Up' : 'Down') : axis[2] === '-' ? 'Left' : 'Right'}`
      : `Axis ${axis[1]} ${axis[2]}`;
  const namesByCode = {
    Equal: '+',
    Minus: '−',
    CapsLock: 'Caps Lock',
    ShiftLeft: 'Left Shift',
    ShiftRight: 'Right Shift',
    NumpadAdd: 'Numpad +',
    NumpadSubtract: 'Numpad −',
    NumpadEnter: 'Numpad Enter',
  };
  return (
    namesByCode[code] ||
    code
      .replace(/^Key/, '')
      .replace(/^Digit/, '')
      .replace(/^Arrow/, '')
  );
}
export class Input {
  constructor() {
    this.enabled = true; // Poll from startup: Firefox exposes a pad after a physical press.
    this.connected = false;
    this.pads = [];
    this.buttonPrevious = {};
    this.raw = {};
    this.resolved = {};
    this.keys = new Set();
    this.taps = new Set();
    this.touchSources = new Map();
    this.touchTaps = new Set();
    this.previous = {};
    this.capture = null;
    this.suppressed = false;
    this.aim = { x: 0, y: 0 };
    this.lastDevice = null;
    this.naming = null;
    this.map = structuredClone(DEFAULTS);
    this.faceNames = { ...PLAYTEST_FACE_NAMES };
    try {
      const names = JSON.parse(localStorage.getItem('urchin-face-names'));
      if (
        names &&
        Object.keys(names).every((k) => /^b\d+$/.test(k)) &&
        Object.values(names).every((v) => ['A', 'B', 'X', 'Y'].includes(v))
      )
        this.faceNames = names;
    } catch {
      /* Invalid stored names leave the known default names intact. */
    }
    try {
      let saved = JSON.parse(
        localStorage.getItem('urchin-input-v3') || localStorage.getItem('urchin-input-v2'),
      );
      // Keep unrelated remaps from the previous build and its working raw defaults.
      this.hasLegacyStored =
        !!saved && localStorage.getItem('urchin-legacy-input-present') !== 'false';
      if (saved && localStorage.getItem('urchin-keyboard-version') !== '2') {
        try {
          if (!localStorage.getItem('urchin-input-before-keyboard-20260915'))
            localStorage.setItem('urchin-input-before-keyboard-20260915', JSON.stringify(saved));
        } catch {
          /* A full store must not discard working controls. */
        }
        saved = migrateKeyboard(saved, DEFAULTS, overlaps);
      }
      if (saved?.recovery && !saved.recoverDiver) saved.recoverDiver = saved.recovery;
      if (
        !saved?.assists &&
        saved?.quickOrders?.length === 2 &&
        saved.quickOrders.includes('KeyO') &&
        saved.quickOrders.includes('b11')
      )
        saved.quickOrders = ['KeyO'];
      if (saved)
        for (const action of Object.keys(DEFAULTS)) {
          if (Array.isArray(saved[action]) && saved[action].every(validCode))
            this.map[action] = saved[action];
        }
      // New shortcuts yield to existing custom bindings, never reset a working map.
      if (saved)
        for (const action of [
          'cycleDiver',
          'chart',
          'quickOrders',
          'assists',
          'recall',
          'pivotPort',
          'pivotStarboard',
          'thrustPort',
          'thrustStarboard',
          'boatyard',
          'almanac',
        ])
          if (!saved[action])
            this.map[action] = this.map[action].filter(
              (code) =>
                !Object.keys(saved).some(
                  (other) =>
                    other !== action && this.map[other]?.includes(code) && overlaps(action, other),
                ),
            );
      // Corrupt/conflicting saved maps must never strand the player in a menu.
      if (
        Object.keys(this.map).some((a) =>
          Object.keys(this.map).some(
            (b) => a !== b && overlaps(a, b) && this.map[a].some((c) => this.map[b].includes(c)),
          ),
        )
      )
        this.map = structuredClone(DEFAULTS);
    } catch {
      /* Invalid legacy bindings leave the safe defaults intact. */
    }
    this.legacyMap = structuredClone(this.map);
    this.legacyFaces = { ...this.faceNames };
    this.profiles = {};
    this.profileKey = null;
    try {
      const saved = JSON.parse(localStorage.getItem('urchin-device-profiles-v1'));
      if (saved?.version === 1 && saved.devices && typeof saved.devices === 'object') {
        this.profiles = saved.devices;
        this.legacyOwner = saved.legacyOwner;
      }
    } catch {
      /* Device profiles are optional when storage is unavailable. */
    }
    this.keyboardMode = 'Keyboard';
    this.shiftKeys = new Set();
    this.shiftUsed = false;
    window.addEventListener(
      'keydown',
      (e) => {
        protectKeyboard(e);
        if (isShift(e.code)) {
          if (!e.repeat) {
            if (!this.shiftKeys.size)
              this.shiftUsed = !!(e.altKey || e.ctrlKey || e.metaKey || this.keys.size);
            this.shiftKeys.add(e.code);
          }
          return;
        }
        if (this.shiftKeys.size) this.shiftUsed = true;
        if (keyboardChord(e)) {
          this.keys.clear();
          this.taps.clear();
          this.suppress();
          return;
        }
        if (editingKey(e)) return;
        if (e.repeat) return;
        this.lastDevice = 'keyboard';
        this.keys.add(e.code);
        this.taps.add(e.code);
        if (
          this.capture?.device === 'keyboard' &&
          !this.capture.waitRelease &&
          e.code !== 'Escape' &&
          !this.map.pause.includes(e.code) &&
          !this.map.back.includes(e.code)
        )
          this.assign(e.code);
      },
      { capture: true },
    );
    window.addEventListener(
      'keyup',
      (e) => {
        protectKeyboard(e);
        if (isShift(e.code)) {
          if (
            this.shiftKeys.has(e.code) &&
            !this.shiftUsed &&
            !keyboardChord(e) &&
            !editingKey(e)
          ) {
            this.lastDevice = 'keyboard';
            this.taps.add(e.code);
            if (this.capture?.device === 'keyboard' && !this.capture.waitRelease)
              this.assign(e.code);
          }
          this.shiftKeys.delete(e.code);
        }
        this.keys.delete(e.code);
      },
      { capture: true },
    );
    window.addEventListener('keypress', protectKeyboard, { capture: true });
    window.addEventListener('blur', () => {
      this.shiftKeys.clear();
      this.keys.clear();
      this.taps.clear();
      this.suppress();
    });
    // Register before Phaser loads assets. Firefox can start platform monitoring
    // from these listeners; every frame still reads fresh getGamepads snapshots.
    this.connectionRevision = 0;
    window.addEventListener('gamepadconnected', () => {
      this.connectionRevision++;
      this.deviceError = '';
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      this.connectionRevision++;
      if (e.gamepad?.index === this.activePad?.index) {
        this.buttonPrevious = {};
        this.previous = {};
        this.suppress();
      }
    });
    window.addEventListener('focus', () => {
      this.connectionRevision++;
      this.suppress();
    });
  }
  label(action, device = this.lastDevice || (this.connected ? 'gamepad' : 'keyboard')) {
    if (device === 'touch') return TOUCH_LABELS[action] || LABELS[action] || action;
    const codes = this.map[action].filter((c) => gamepadCode(c) === (device === 'gamepad'));
    return (
      codes
        .map((code) =>
          this.needsMapping && gamepadCode(code) && !this.faceNames[code]
            ? /^b/.test(code)
              ? `Button ${code.slice(1)}`
              : `Axis ${code.slice(1)}`
            : bindingName(code, this.faceNames),
        )
        .join(' / ') || 'Unbound'
    );
  }
  suppress() {
    this.suppressed = true;
    if (this.shiftKeys?.size) this.shiftUsed = true;
    this.taps.clear();
    this.touchSources.clear();
    this.touchTaps.clear();
  }
  setTouch(id, actions, cancel = false) {
    if (!this.touchEnabled) return;
    if (actions) {
      this.touchSources.set(id, actions);
      for (const [action, value] of Object.entries(actions))
        if (value > 0.5) this.touchTaps.add(action);
    } else {
      if (cancel)
        for (const action of Object.keys(this.touchSources.get(id) || {}))
          this.touchTaps.delete(action);
      this.touchSources.delete(id);
    }
  }
  save() {
    this.revision = (this.revision || 0) + 1;
    if (this.profileKey) {
      this.profiles[this.profileKey] = {
        ...this.profiles[this.profileKey],
        map: structuredClone(this.map),
        faceNames: { ...this.faceNames },
      };
    }
    try {
      localStorage.setItem(
        'urchin-device-profiles-v1',
        JSON.stringify({ version: 1, legacyOwner: this.legacyOwner, devices: this.profiles }),
      );
      localStorage.setItem('urchin-input-v3', JSON.stringify(this.legacyMap));
      localStorage.setItem('urchin-keyboard-version', '2');
      localStorage.setItem('urchin-legacy-input-present', String(this.hasLegacyStored));
    } catch {
      /* Remapping still works for this session without storage. */
    }
  }
  profileFor(p) {
    return `${p.id}|${p.mapping ?? 'standard'}|${p.buttons.length}/${p.axes.length}`;
  }
  activateProfile(p) {
    const key = this.profileFor(p);
    if (key === this.profileKey) return;
    if (this.profileKey) this.save();
    let profile = migrateInputProfile(
      this.profiles[key],
      DEFAULTS,
      validCode,
      overlaps,
      (p.mapping ?? 'standard') === 'standard',
    );
    if (!profile) {
      const standard = (p.mapping ?? 'standard') === 'standard',
        legacy = standard && !this.legacyOwner && this.hasLegacyStored;
      const map = structuredClone(legacy ? this.legacyMap : DEFAULTS);
      if (standard && !legacy) {
        map.work = map.work.map((c) => (c === 'b3' ? 'b2' : c));
        map.recoverDiver = map.recoverDiver.map((c) => (c === 'b2' ? 'b3' : c));
      }
      if (!standard)
        for (const action of gameplay) map[action] = map[action].filter((c) => !gamepadCode(c));
      profile = {
        axisRest: standard ? [] : p.axes.map((v) => (Math.abs(v) > 0.95 ? v : 0)),
        map,
        faceNames: legacy
          ? this.legacyFaces
          : standard
            ? { b0: 'A', b1: 'B', b2: 'X', b3: 'Y' }
            : {},
        trusted: standard,
        explicit: [],
        legacy,
      };
      if (legacy) this.legacyOwner = key;
    }
    if ((p.mapping ?? 'standard') === 'standard' && !this.legacyOwner) this.legacyOwner = key;
    // Keyboard bindings remain shared, while every exposed device owns its pad map.
    const keys = this.map;
    this.map = Object.fromEntries(
      Object.keys(DEFAULTS).map((k) => [
        k,
        [...keys[k].filter((c) => !gamepadCode(c)), ...profile.map[k].filter(gamepadCode)],
      ]),
    );
    // Historical guessed X/Y names were not physical verification. Browser-standard
    // button positions name the preserved bindings until the player verifies them.
    if ((p.mapping ?? 'standard') === 'standard' && !profile.namesVerified)
      profile.faceNames = { b0: 'A', b1: 'B', b2: 'X', b3: 'Y' };
    this.faceNames = { ...profile.faceNames };
    this.profileKey = key;
    this.profiles[key] = profile;
    this.needsMapping = !profile.trusted;
    this.save();
  }
  get deviceLabel() {
    if (this.lastDevice === 'touch') return 'Touchscreen';
    if (this.lastDevice === 'keyboard' || !this.connected) return this.keyboardMode;
    const id = this.activePad?.id || '',
      name = /steam|valve/i.test(id)
        ? 'Steam controller'
        : /xbox|xinput|045e/i.test(id)
          ? 'Xbox / Steam Input'
          : 'Gamepad';
    return `${name} · ${this.needsMapping ? 'custom mapping' : this.profiles[this.profileKey]?.legacy ? 'existing layout' : 'standard layout'}`;
  }
  useLayout(legacy = false) {
    const map = structuredClone(legacy ? this.legacyMap : DEFAULTS);
    if (!legacy) {
      map.work = map.work.map((c) => (c === 'b3' ? 'b2' : c));
      map.recoverDiver = map.recoverDiver.map((c) => (c === 'b2' ? 'b3' : c));
    }
    for (const action of Object.keys(DEFAULTS))
      this.map[action] = [
        ...this.map[action].filter((c) => !gamepadCode(c)),
        ...map[action].filter(gamepadCode),
      ];
    this.faceNames = legacy ? { ...this.legacyFaces } : { b0: 'A', b1: 'B', b2: 'X', b3: 'Y' };
    if (this.profileKey) {
      this.profiles[this.profileKey].trusted = true;
      this.profiles[this.profileKey].axisRest = [];
      this.profiles[this.profileKey].legacy = legacy;
    }
    this.needsMapping = false;
    this.save();
    this.suppress();
    this.notice = 'ACTIVE CONTROLLER LAYOUT APPLIED';
  }
  checkRecoveryButtons() {
    this.naming = { recoveryOnly: true, index: 0, names: {}, waitRelease: true, remaining: 30 };
    this.suppress();
  }

  nameButtons() {
    this.naming = { index: 0, names: {}, waitRelease: true, remaining: 30 };
    this.suppress();
  }
  cancelNaming() {
    this.naming = null;
    this.suppress();
  }
  reset(device) {
    if (device === 'keyboard') {
      for (const action of Object.keys(DEFAULTS)) {
        const keys = DEFAULTS[action].filter((c) => !gamepadCode(c));
        this.map[action] = [...keys, ...this.map[action].filter(gamepadCode)];
        this.legacyMap[action] = [...keys, ...this.legacyMap[action].filter(gamepadCode)];
      }
      this.capture = null;
      this.save();
      this.suppress();
      this.notice = 'KEYBOARD CONTROLS RESET TO DEFAULTS';
      return;
    }
    if (device === 'gamepad') {
      this.useLayout(!!this.profiles[this.profileKey]?.legacy);
      return;
    }
    const legacy = this.profileKey ? !!this.profiles[this.profileKey].legacy : true;
    this.map = structuredClone(DEFAULTS);
    for (const action of Object.keys(DEFAULTS))
      this.legacyMap[action] = [
        ...DEFAULTS[action].filter((c) => !gamepadCode(c)),
        ...this.legacyMap[action].filter(gamepadCode),
      ];
    this.capture = null;
    this.useLayout(legacy);
    this.notice = 'ACTIVE DEVICE CONTROLS RESET TO DEFAULTS';
  }
  beginCapture(action, device = 'gamepad') {
    this.capture = { action, device, waitRelease: true, remaining: C.input.captureSeconds };
    this.notice = '';
  }
  assign(code) {
    if (!this.capture || !validCode(code)) return false;
    const { action, device } = this.capture;
    const optionalShortcuts = [
      'quickOrders',
      'assists',
      'recall',
      'pivotPort',
      'pivotStarboard',
    ].filter(
      (other) => action !== other && !this.profiles[this.profileKey]?.explicit?.includes(other),
    );
    const conflict = Object.keys(this.map).find(
      (other) =>
        other !== action &&
        !optionalShortcuts.includes(other) &&
        overlaps(action, other) &&
        this.map[other].includes(code),
    );
    if (conflict) {
      this.notice = `${bindingName(code, this.faceNames)} already controls ${LABELS[conflict]}. Choose another input.`;
      this.capture.waitRelease = true;
      return false;
    }
    for (const other of optionalShortcuts)
      this.map[other] = this.map[other].filter((c) => c !== code);
    this.map[action] = this.map[action]
      .filter((c) => gamepadCode(c) !== (device === 'gamepad'))
      .concat(code);
    if (device === 'gamepad' && this.profileKey) {
      const p = this.profiles[this.profileKey];
      p.explicit = [...new Set([...(p.explicit || []), action])];
    }
    if (device === 'keyboard')
      for (const k of Object.keys(DEFAULTS))
        this.legacyMap[k] = [
          ...this.map[k].filter((c) => !gamepadCode(c)),
          ...this.legacyMap[k].filter(gamepadCode),
        ];
    this.capture = null;
    this.save();
    this.suppress();
    this.notice = `${LABELS[action]} → ${bindingName(code, this.faceNames)} · APPLIED`;
    return true;
  }
  poll(dt = 1 / 60) {
    this.wasCapturing = !!this.capture;
    let pads = [];
    try {
      if (this.enabled)
        pads = [...navigator.getGamepads()].filter((p) => p && p.connected !== false);
      this.deviceError = '';
    } catch (error) {
      this.deviceError = error.message;
    }
    this.pads = pads;
    this.connected = pads.length > 0;
    // Follow the most recently used pad, so a stale USB/virtual pad cannot hold
    // the release gate or fight a newly connected Bluetooth controller.
    this.padSnapshots ||= new Map();
    const keyOf = (p, index) => `${p.index ?? index}:${p.id}`;
    const liveKeys = new Set(pads.map(keyOf));
    for (const key of this.padSnapshots.keys())
      if (!liveKeys.has(key)) this.padSnapshots.delete(key);
    let active =
      pads.find((p, n) => keyOf(p, n) === this.activePadKey) ||
      pads.find((p) => p.mapping === 'standard') ||
      pads[0];
    pads.forEach((p, n) => {
      const key = keyOf(p, n),
        previous = this.padSnapshots.get(key),
        values = [...p.buttons.map((b) => b.value), ...p.axes];
      if (previous && values.some((v, k) => Math.abs(v - previous[k]) > 0.15 && Math.abs(v) > 0.5))
        active = p;
      this.padSnapshots.set(key, values);
    });
    const nextKey = active ? keyOf(active, pads.indexOf(active)) : null;
    if (nextKey !== this.activePadKey) {
      this.buttonPrevious = {};
      this.previous = {};
    }
    this.activePadKey = nextKey;
    this.activePad = active;
    if (active) this.activateProfile(active);
    pads = active ? [active] : [];
    const buttons = {},
      edges = [];
    pads.forEach((p, index) =>
      p.buttons.forEach((b, i) => {
        const key = `pad${index}/b${i}`;
        buttons[key] = b.value > 0.5;
        if (buttons[key] && !this.buttonPrevious[key]) edges.push(key);
      }),
    );
    if (edges.length) this.lastButtons = edges.join(' ');
    this.buttonPrevious = buttons;
    const rests = this.profiles[this.profileKey]?.axisRest || [];
    const axes = (active?.axes || []).map((v, n) => {
      const rest = rests[n] || 0,
        delta = v - rest;
      return Math.max(-1, Math.min(1, delta / (delta < 0 ? 1 + rest : 1 - rest || 1)));
    });
    const value = (code) => {
      if (/^b\d+$/.test(code))
        return Math.max(0, ...pads.map((p) => p.buttons[Number(code.slice(1))]?.value || 0));
      const axis = /^a(\d+)([+-])$/.exec(code);
      if (axis)
        return Math.max(
          0,
          ...pads.map((p) => {
            const v = (axes[Number(axis[1])] || 0) * (axis[2] === '+' ? 1 : -1);
            return v > C.input.deadZone
              ? Math.min(1, (v - C.input.deadZone) / (1 - C.input.deadZone))
              : 0;
          }),
        );
      return this.keys.has(code) || this.taps.has(code) ? 1 : 0;
    };
    const raw = {},
      pressed = {};
    for (const [action, codes] of Object.entries(this.map)) {
      const permitted = codes.filter(
        (c) =>
          !gamepadCode(c) ||
          !this.needsMapping ||
          !gameplay.has(action) ||
          this.profiles[this.profileKey]?.explicit?.includes(action),
      );
      raw[action] = Math.max(
        0,
        ...permitted.map(value),
        ...(this.touchEnabled ? [...this.touchSources.values()].map((v) => v[action] || 0) : []),
        this.touchEnabled && this.touchTaps.has(action) ? 1 : 0,
      );
      pressed[action] = raw[action] > 0.5 && !(this.previous[action] > 0.5);
    }
    const released =
      this.keys.size === 0 &&
      this.touchSources.size === 0 &&
      pads.every(
        (p) =>
          p.buttons.every((b) => b.value < 0.3) &&
          axes.every((a) => Math.abs(a) <= C.input.deadZone),
      );
    const keyboardX =
      (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0) -
      (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0);
    const keyboardY =
      (this.keys.has('ArrowDown') || this.keys.has('KeyS') ? 1 : 0) -
      (this.keys.has('ArrowUp') || this.keys.has('KeyW') ? 1 : 0);
    this.aim = {
      x: keyboardX || (this.needsMapping ? 0 : axes[0] || 0),
      y: keyboardY || (this.needsMapping ? 0 : axes[1] || 0),
    };
    if (
      edges.length ||
      active?.axes.some(
        (v, n) => Math.abs(v) > 0.5 && Math.abs(v - (this.lastAxes?.[n] || 0)) > 0.1,
      )
    )
      this.lastDevice = 'gamepad';
    this.lastAxes = active?.axes.slice() || [];
    const nav =
      Math.max(Math.abs(this.aim.x), Math.abs(this.aim.y)) > 0.55
        ? Math.abs(this.aim.x) > Math.abs(this.aim.y)
          ? this.aim.x > 0
            ? 'right'
            : 'left'
          : this.aim.y > 0
            ? 'down'
            : 'up'
        : '';
    this.navWait = (this.navWait || 0) - dt;
    const navPulse = nav && (nav !== this.lastNav || this.navWait <= 0) ? nav : 0;
    if (navPulse) this.navWait = nav !== this.lastNav ? 0.4 : 0.16;
    this.lastNav = nav;
    if (this.naming) {
      const naming = this.naming;
      naming.remaining -= dt;
      if (this.keys.has('Escape') || this.taps.has('Escape') || naming.remaining <= 0) {
        this.cancelNaming();
        this.notice = 'BUTTON NAMING CANCELLED';
      } else if (naming.waitRelease) {
        if (released) naming.waitRelease = false;
      } else {
        const index = active?.buttons.findIndex((b) => b.value > 0.7) ?? -1,
          code = `b${index}`;
        if (index >= 0 && !naming.names[code]) {
          naming.names[code] = (naming.recoveryOnly ? ['X', 'Y'] : ['A', 'B', 'X', 'Y'])[
            naming.index++
          ];
          naming.waitRelease = true;
          if (naming.recoveryOnly && naming.index === 2) {
            const pair = Object.entries(naming.names),
              conflict = pair.some(([code]) =>
                Object.keys(this.map).some(
                  (k) =>
                    gameplay.has(k) &&
                    !['work', 'recoverDiver'].includes(k) &&
                    this.map[k].includes(code),
                ),
              );
            if (conflict) {
              this.cancelNaming();
              this.notice = 'FACE BUTTON CONFLICT — USE REMAPPING TO RESOLVE IT';
            } else {
              for (const [code, label] of pair) {
                const action = label === 'X' ? 'work' : 'recoverDiver';
                this.map[action] = [...this.map[action].filter((c) => !gamepadCode(c)), code];
              }
              this.faceNames = { ...this.faceNames, ...naming.names };
              if (this.profileKey) this.profiles[this.profileKey].namesVerified = true;
              if (this.profileKey)
                this.profiles[this.profileKey].explicit = [
                  ...new Set([
                    ...(this.profiles[this.profileKey].explicit || []),
                    'work',
                    'recoverDiver',
                  ]),
                ];
              this.save();
              this.cancelNaming();
              this.notice = 'PHYSICAL X = BAG / SEND DOWN · PHYSICAL Y = DEPLOY / BOARD — VERIFIED';
            }
          } else if (!naming.recoveryOnly && naming.index === 4) {
            this.faceNames = naming.names;
            if (this.profileKey) this.profiles[this.profileKey].namesVerified = true;
            try {
              localStorage.setItem('urchin-face-names', JSON.stringify(this.faceNames));
            } catch {
              /* Keep verified names in memory if storage is unavailable. */
            }
            this.save();
            this.cancelNaming();
            this.notice = 'BUTTON NAMES SAVED — GAMEPLAY BINDINGS UNCHANGED';
          }
        }
      }
    }
    if (this.capture) {
      this.capture.remaining -= dt;
      if (this.taps.has('Escape') || pressed.pause || pressed.back || this.capture.remaining <= 0) {
        this.notice =
          this.capture.remaining <= 0
            ? 'REBIND TIMED OUT — controls unchanged'
            : 'REBIND CANCELLED';
        this.capture = null;
        this.suppress();
      } else if (this.capture.waitRelease) {
        if (released) this.capture.waitRelease = false;
      } else if (this.capture.device === 'gamepad')
        for (const p of pads) {
          const button = p.buttons.findIndex((b) => b.value > 0.7),
            axis = axes.findIndex((a) => Math.abs(a) > 0.7);
          if (button >= 0) {
            this.assign(`b${button}`);
            break;
          }
          if (axis >= 0) {
            this.assign(`a${axis}${axes[axis] > 0 ? '+' : '-'}`);
            break;
          }
        }
    }
    const instructionsReleased = (this.previous.instructions || 0) > 0.5 && raw.instructions <= 0.5;
    const keyboardEscape = this.taps.has('Escape');
    this.taps.clear();
    this.touchTaps.clear();
    this.previous = raw;
    this.raw = raw;
    const suppress = this.suppressed || this.wasCapturing;
    if (this.suppressed && released) this.suppressed = false;
    this.resolved =
      suppress || this.naming
        ? { throttle: 0, steer: 0, zoom: 0 }
        : {
            ...pressed,
            keyboardEscape,
            throttle: raw.throttleUp - raw.throttleDown,
            steer: raw.right - raw.left,
            thruster: raw.thrustStarboard - raw.thrustPort,
            pivot: raw.pivotStarboard - raw.pivotPort,
            zoom: raw.zoomIn - raw.zoomOut,
          };
    // A diagonal left-stick command changes throttle OR docking thrust, never both.
    // Small hysteresis prevents an almost-diagonal thumb position chattering modes.
    const throttle = Math.abs(this.resolved.throttle || 0),
      thrust = Math.abs(this.resolved.thruster || 0);
    if (!throttle && !thrust) this.helmAxis = null;
    else {
      const dominant = throttle >= thrust ? 'throttle' : 'thruster';
      if (
        !this.helmAxis ||
        !Math.abs(this.resolved[this.helmAxis] || 0) ||
        Math.abs(this.resolved[dominant] || 0) > Math.abs(this.resolved[this.helmAxis] || 0) * 1.25
      )
        this.helmAxis = dominant;
      this.resolved[this.helmAxis === 'throttle' ? 'thruster' : 'throttle'] = 0;
    }
    Object.assign(this.resolved, {
      aimX: this.aim.x,
      aimY: this.aim.y,
      detailScroll: suppress || this.needsMapping ? 0 : axes[3] || 0,
      instructionsHeld: raw.instructions > 0.5,
      instructionsReleased,
      navDirection: suppress ? '' : navPulse,
      navPulse: suppress ? 0 : navPulse === 'down' ? 1 : navPulse === 'up' ? -1 : 0,
    });
    return this.resolved;
  }
}
