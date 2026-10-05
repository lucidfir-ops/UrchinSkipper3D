import { formatClock } from './day.js';
import { boatSpec } from './boats.js';
import { soundingDepth } from './hazard-depth.js';
import { assist, gear } from './assists.js';
import { setMarkup } from './dom-view.js';

const KEY = 'urchin-instrument-style-v1';
let styles = {};
try {
  styles = JSON.parse(localStorage.getItem(KEY) || '{}');
} catch {
  /* Defaults. */
}
export const instrumentStyle = (id) =>
  styles[id] === 'text'
    ? 'text'
    : id === 'minimapPanel' && styles[id] !== 'graphic'
      ? 'chart'
      : 'graphic';
export function setInstrumentStyle(id, style) {
  styles[id] = style;
  try {
    localStorage.setItem(KEY, JSON.stringify(styles));
  } catch {
    /* Session preference. */
  }
}
export function instrumentContent(graphic, text) {
  return `<div class="instrument-graphic">${graphic}</div><div class="instrument-text">${text}</div>`;
}
const clamp = (x) => Math.max(0, Math.min(1, x));
export function instrumentTexture(tile, x = 0, y = 0, width = 140, height = 140) {
  const crops = [
    [36, 28, 440, 430],
    [550, 27, 437, 430],
    [1040, 5, 484, 460],
    [15, 510, 485, 405],
    [530, 525, 476, 383],
    [1065, 496, 430, 443],
  ];
  return `<svg class="instrument-texture" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${crops[tile].join(' ')}" preserveAspectRatio="none"><image href="./assets/instruments/atlas.png" width="1536" height="1024"/></svg>`;
}
export function hullGraphic(health, drive) {
  const colour = health < 0.4 ? '#d55e43' : health < 0.8 ? '#dcaf57' : '#8fc4b5';
  return `<svg class="hull-condition" viewBox="0 0 140 120" role="img" aria-label="Hull ${Math.round(health * 100)}%, drive ${Math.round(drive * 100)}%"><path d="M70 5Q100 28 100 55V101Q70 113 40 101V55Q40 28 70 5Z" fill="${colour}" stroke="#e3dfca" stroke-width="2"/><path d="M52 45H88V65H52Z" fill="#244653"/><path d="M49 76H91M49 85H91M49 94H91" stroke="#476875"/>${Array.from({ length: Math.ceil((1 - health) * 9) }, (_, i) => `<path d="M${42 + (i % 3) * 15} ${34 + Math.floor(i / 3) * 24}l8 7 -6 5 11 7" stroke="#722e25" stroke-width="3" fill="none"/>`).join('')}<text x="70" y="118" text-anchor="middle" fill="#fff2cc" font-size="11">HULL ${Math.round(health * 100)}% · DRIVE ${Math.round(drive * 100)}%</text></svg>`;
}
export function loadGraphic(weight, capacity) {
  const fill = clamp(weight / capacity),
    count = Math.ceil(fill * 15);
  return `<div class="load-crate" role="img" aria-label="Deck load ${Math.round(weight)} of ${capacity} pounds"><span class="gauge-label">DECK LOAD</span><div class="bag-stack">${Array.from({ length: 15 }, (_, i) => `<i class="${i < count ? 'loaded' : ''}"></i>`).join('')}</div><output>${Math.round(weight).toLocaleString()} lb</output><small>${Math.max(0, capacity - weight).toFixed(0)} lb free</small></div>`;
}
export function dial(label, value, fraction, low = '0', high = 'MAX', danger = false) {
  const angle = Math.round(-120 + clamp(fraction) * 240);
  return `<svg class="instrument-dial ${danger ? 'danger' : ''}" viewBox="0 0 140 112" role="img" aria-label="${label}: ${value}"><path class="gauge-ring" d="M29 85 A48 48 0 1 1 111 85"/><path class="gauge-arc" d="M29 85 A48 48 0 1 1 111 85"/>${label === 'FUEL' ? '<path class="gauge-reserve" d="M29 85 A48 48 0 0 1 22 61"/>' : ''}${Array.from({ length: 9 }, (_, i) => `<path class="gauge-tick" d="M70 16V${i % 2 ? 20 : 23}" transform="rotate(${-120 + i * 30} 70 61)"/>`).join('')}<path class="gauge-needle" d="M70 65V26" transform="rotate(${angle} 70 61)"/><circle class="gauge-pin" cx="70" cy="61" r="4"/><text class="gauge-label" x="70" y="42" text-anchor="middle">${label}</text><text x="70" y="98" class="dial-value" text-anchor="middle">${value}</text><text class="gauge-limit" x="21" y="108">${low}</text><text class="gauge-limit" x="119" y="108" text-anchor="end">${high}</text></svg>`;
}
export function compass(label, angle, value) {
  angle = Math.round(angle);
  return `<svg class="instrument-compass" viewBox="0 0 140 112" role="img" aria-label="${label}: ${value}"><circle class="compass-ring" cx="70" cy="55" r="39"/><path class="gauge-tick" d="M70 16V23M70 87V94M31 55H38M102 55H109"/><text class="compass-north" x="70" y="11" text-anchor="middle">N</text><g transform="rotate(${angle} 70 55)"><path class="compass-pointer" d="M70 25L62 64L70 59L78 64Z"/><path class="compass-tail" d="M70 85L64 63L70 66L76 63Z"/></g><text class="compass-reading" x="70" y="110" text-anchor="middle">${label} ${value}</text></svg>`;
}
// Wheelhouse console HELM module: an engine-order telegraph lever beside a
// rudder-angle indicator (port red, starboard green scale), with word + number
// readouts. Values remain the commanded settings.
export function commandGauge(throttle, rudder) {
  const t = Math.max(-1, Math.min(1, throttle || 0)),
    r = Math.max(-1, Math.min(1, rudder || 0)),
    handle = 32 - t * 24,
    percent = (v) => `${Math.round(Math.abs(v) * 100)}%`,
    order =
      Math.abs(t) < 0.01
        ? '<b>STOP</b>'
        : `<b>${t > 0 ? 'AHEAD' : 'ASTERN'}</b> <output>${percent(t)}</output>`,
    side = Math.abs(r) < 0.01 ? 'MID' : `${r < 0 ? 'P' : 'S'}${Math.round(Math.abs(r) * 100)}`,
    angle = (r * 60).toFixed(1),
    tick = (a) =>
      `<path class="rudder-tick" d="M96 8V${a % 60 ? 13 : 16}" transform="rotate(${a} 96 40)"/>`;
  return `<div class="command-instrument console-command" role="img" aria-label="Throttle ${Math.round(t * 100)}% ${t > 0.01 ? 'ahead' : t < -0.01 ? 'astern' : 'neutral'}, rudder ${Math.round(Math.abs(r) * 100)}% ${r > 0.01 ? 'starboard' : r < -0.01 ? 'port' : 'centred'}"><div class="cmd-head">HELM</div><svg class="cmd-graphic" viewBox="0 0 132 60" aria-hidden="true"><text class="cmd-mark" x="2" y="13">AH</text><text class="cmd-mark" x="6" y="36">N</text><text class="cmd-mark" x="2" y="59">AS</text><path class="telegraph-notches" d="M38 8H45M38 20H42M38 32H46M38 44H42M38 56H45"/><rect class="telegraph-slot" x="25" y="5" width="8" height="54" rx="4"/><path class="telegraph-throw ${t < 0 ? 'astern' : 'ahead'}" d="M29 32V${handle.toFixed(1)}"/><rect class="telegraph-handle" x="15" y="${(handle - 5).toFixed(1)}" width="28" height="10" rx="3"/><path class="rudder-port" d="M68.3 24A32 32 0 0 1 96 8"/><path class="rudder-stbd" d="M96 8A32 32 0 0 1 123.7 24"/>${[-60, -30, 0, 30, 60].map(tick).join('')}<text class="cmd-mark port" x="57" y="42">P</text><text class="cmd-mark stbd" x="125" y="42">S</text><path class="rudder-needle" d="M96 43V12" transform="rotate(${angle} 96 40)"/><circle class="rudder-hub" cx="96" cy="40" r="5"/></svg><div class="cmd-readouts"><span class="cmd-throttle${t < -0.01 ? ' astern' : ''}">${order}</span><span class="cmd-rudder"><b>RUDDER</b> <output>${side}</output></span></div></div>`;
}
export const TIMEPIECES = [
  ['digital', 'Red digital clock'],
  ['clock-brass', 'Brass wheel clock'],
  ['clock-urchin', 'Urchin clock'],
  ['clock-tide', 'Tide-face clock'],
];
export const ownedTimepieces = (w) => TIMEPIECES.filter(([id]) => id === 'digital' || gear(w, id));
export function clockFace(minute, style) {
  if (!style || style === 'digital') {
    const [time, day] = formatClock(minute).split(' ');
    return `<div class="digital-clock" aria-label="Ship’s clock ${formatClock(minute)}">${instrumentTexture(4)}<small>SHIP’S TIME${day ? ` · ${day}` : ''}</small><output>${time}</output></div>`;
  }
  const hour = ((minute / 60) % 12) * 30,
    hand = (minute % 60) * 6;
  const colour =
    style === 'clock-brass' ? '#c5a164' : style === 'clock-urchin' ? '#ad75bd' : '#6cbfc6';
  return `<svg class="timepiece-face" viewBox="0 0 140 140" role="img" aria-label="Ship’s clock ${formatClock(minute)}">${instrumentTexture(style === 'clock-urchin' ? 2 : 1, 5, 5, 130, 130)}${Array.from({ length: 12 }, (_, i) => `<path d="M70 12V${style === 'clock-urchin' ? 30 : 20}" transform="rotate(${i * 30} 70 70)" stroke="${colour}" stroke-width="3"/>`).join('')}<text x="70" y="43" text-anchor="middle" fill="${colour}">${style === 'clock-urchin' ? 'URCHIN' : style === 'clock-tide' ? 'TIME & TIDE' : 'SKIPPER'}</text><path d="M70 74V39" stroke="#18252c" stroke-width="5" transform="rotate(${hour} 70 70)"/><path d="M70 76V23" stroke="#253d46" stroke-width="3" transform="rotate(${hand} 70 70)"/><circle cx="70" cy="70" r="5" fill="${colour}"/><text x="70" y="103" text-anchor="middle" fill="#e5ece3">${formatClock(minute)}</text></svg>`;
}
export const STANDALONE_INSTRUMENTS = {
  timepiecePanel: ['timepiece', 'Timepiece'],
  depthInstrumentPanel: ['depthInstrument', 'Depth instrument'],
  compassPanel: ['compassGauge', 'Compass'],
  hullPanel: ['hullGauge', 'Hull condition'],
  loadPanel: ['loadGauge', 'Deck load'],
};
export function renderStandaloneInstruments(ui, w) {
  const playing =
    ui.started && !ui.screen && !ui.ended && !['planning', 'complete'].includes(w.day.phase);
  const spec = boatSpec(w),
    b = w.boat,
    depth = Math.max(0, soundingDepth(w, b.x, b.y)),
    clearance = depth - spec.draft,
    heading = ((((b.heading * 180) / Math.PI) % 360) + 360) % 360,
    chosen = w.career?.preferences?.timepiece,
    face = ownedTimepieces(w).some(([id]) => id === chosen) ? chosen : 'digital';
  for (const [id, [key, label]] of Object.entries(STANDALONE_INSTRUMENTS)) {
    let panel = document.getElementById(id);
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = id;
      panel.className = 'standalone-instrument';
      document.body.append(panel);
    }
    panel.hidden =
      !playing ||
      !assist(w, key, ui.realistic) ||
      (id === 'loadPanel' && !assist(w, 'exactLoad', ui.realistic));
    if (panel.hidden) continue;
    const text =
      id === 'timepiecePanel'
        ? `Ship’s time ${formatClock(w.day.minute)}`
        : id === 'depthInstrumentPanel'
          ? `Depth ${depth.toFixed(1)} m · Keel ${clearance.toFixed(1)} m`
          : id === 'compassPanel'
            ? `Heading ${heading.toFixed(0)}°`
            : id === 'hullPanel'
              ? `Hull ${Math.round(b.hullHealth * 100)}% · Drive ${Math.round(b.driveHealth * 100)}%`
              : `Deck ${Math.round(w.catch)} / ${spec.capacity} lb`;
    const graphic =
      id === 'timepiecePanel'
        ? clockFace(w.day.minute, face)
        : id === 'depthInstrumentPanel'
          ? `<div class="depth-instrument ${clearance < 0.5 ? 'shallow' : ''}">${instrumentTexture(3)}<small>DEPTH<span class="label-long"> · METRES</span><span class="label-short"> m</span></small><output>${depth.toFixed(1)}</output><div class="depth-scale"><i style="width:${clamp(depth / 30) * 100}%"></i></div><small>${clearance <= 0 ? 'KEEL CONTACT' : `KEEL ${clearance.toFixed(1)} m`}</small></div>`
          : id === 'compassPanel'
            ? compass('HDG', heading, `${heading.toFixed(0)}°`)
            : id === 'hullPanel'
              ? hullGraphic(b.hullHealth, b.driveHealth)
              : loadGraphic(w.catch, spec.capacity);
    setMarkup(panel, instrumentContent(graphic, `<strong>${label}</strong><p>${text}</p>`));
  }
}
