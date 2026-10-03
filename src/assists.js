import { C } from './config.js';
import { enabledEquipment, workLightRange } from './equipment-controls.js';
import { UI_OPTIONS } from './assist-options.js';
export const ASSISTS = {
  timepiece: 'Timepiece',
  depthInstrument: 'Depth instrument',
  compassGauge: 'Compass',
  hullGauge: 'Hull condition gauge',
  loadGauge: 'Deck load gauge',
  departureGuidance: 'Departure guidance',
  groundDots: 'Ground outlines on the water',
  chartGrounds: 'Ground markings on charts',
  weatherOverlay: 'Weather readout',
  helmOverlay: 'Helm instruments card',
  speedGauge: 'Speed gauge',
  throttleGauge: 'Throttle / rudder gauge',
  fuelGauge: 'Fuel gauge',
  minimap: 'Chart minimap',
  sounder: 'Depth sounder',
  diverCards: 'Diver cards',
  frankOverlay: 'Frank’s lesson text',
  controlsHelp: 'Controls reference',
  feedbackOverlay: 'Recent action messages',
  clockOverlay: 'Clock / offload readout',
  pickingLegend: 'Picking legend',
  diverIndicators: 'Diver indicators',
  diverPortraits: 'Portrait-only diver selector',
  offscreenArrows: 'Off-screen diver arrows',
  exactLoad: 'Exact deck / diver readouts',
  reefClarity: 'Extended reef clarity',
  widePickup: 'Wide pickup tolerance',
  currentOverlay: 'Live current instruments',
  currentArrows: 'Current arrows on the water',
  almanacShortcut: 'Tide & current almanac button',
  actionPrompts: 'Context action prompts',
};
export const REALISTIC_ASSISTS = new Set([
  'timepiece',
  'depthInstrument',
  'speedGauge',
  'throttleGauge',
  'fuelGauge',
  'compassGauge',
  'hullGauge',
  'loadGauge',
  'exactLoad',
  'clockOverlay',
  'helmOverlay',
  'minimap',
  'sounder',
  'chartGrounds',
  'diverPortraits',
  'diverCards',
  'frankOverlay',
  'weatherOverlay',
  'departureGuidance',
  'actionPrompts',
]);
const DEFAULT_OFF_ASSISTS = new Set([
  'loadGauge',
  'minimap',
  'helmOverlay',
  'weatherOverlay',
  'departureGuidance',
  'currentOverlay',
  'almanacShortcut',
  'pickingLegend',
  'clockOverlay',
  'sounder',
  'controlsHelp',
  'compassGauge',
  'hullGauge',
]);
const TUTORIAL_QUIET_ASSISTS = new Set([
  'timepiece',
  'depthInstrument',
  'speedGauge',
  'throttleGauge',
  'fuelGauge',
  'loadGauge',
  'minimap',
  'helmOverlay',
  'weatherOverlay',
  'departureGuidance',
  'currentOverlay',
  'almanacShortcut',
  'pickingLegend',
  'controlsHelp',
  'clockOverlay',
  'sounder',
  'compassGauge',
  'hullGauge',
  'feedbackOverlay',
]);
export const presetLabel = (preset) =>
  ({ easy: 'Easy', realistic: 'Realistic', off: 'All Off', custom: 'Custom' })[preset] || 'Custom';
export function presetAssists(preset) {
  return {
    version: 2,
    layoutRevision: 4,
    preset,
    base: preset,
    ...Object.fromEntries(
      Object.keys(ASSISTS).map((k) => [
        k,
        (preset === 'easy' || (preset === 'realistic' && REALISTIC_ASSISTS.has(k))) &&
          k !== 'feedbackOverlay' &&
          !DEFAULT_OFF_ASSISTS.has(k),
      ]),
    ),
  };
}
export function normalizeAssists(c) {
  c.assists ??= presetAssists('easy');
  if (c.assists.version !== 2) {
    const old = c.assists;
    c.assists =
      old.preset === 'medium'
        ? presetAssists('realistic')
        : old.preset === 'realistic'
          ? presetAssists('off')
          : { ...old, version: 2, base: 'easy' };
    // Keep the old custom widget set as the Easy slot, without reviving old labels.
    if (c.savedAssists && c.savedAssists.preset !== 'realistic')
      c.assistPresets = { easy: { ...c.savedAssists, version: 2, base: 'easy' } };
    delete c.savedAssists;
  }
  c.difficulty ??= 'easy';
  // Older tutorials set this flag automatically, even though the lesson
  // renderer hid it. It is not evidence that the player enabled the panel.
  if (c.intro?.status === 'active' && c.intro.helpInitialized)
    for (const saved of [c.assists, ...Object.values(c.assistPresets || {})]) {
      // Cycling presets stored the same automatic flag in inactive slots.
      // Clear it while the tutorial provenance still exists, before completion
      // replaces the practice career. New manual metadata preserves opt-ins.
      if (saved && !saved.manual) saved.controlsHelp = false;
    }
  // Recognize shipped defaults from before the quiet HUD revision as well as
  // revision 3, which omitted three ordinary Realistic instruments. Refresh
  // only a matching preset; changed values and Custom saves are deliberate.
  if (c.assists.layoutRevision !== 4 && ['easy', 'realistic', 'off'].includes(c.assists.preset)) {
    const mode = c.assists.preset,
      previous = presetAssists(mode);
    if (mode === 'realistic')
      previous.speedGauge = previous.throttleGauge = previous.fuelGauge = false;
    if ((c.assists.layoutRevision || 0) < 3)
      for (const key of [
        'loadGauge',
        'minimap',
        'helmOverlay',
        'weatherOverlay',
        'departureGuidance',
        'currentOverlay',
        'almanacShortcut',
        'pickingLegend',
      ])
        previous[key] = mode === 'easy' || (mode === 'realistic' && REALISTIC_ASSISTS.has(key));
    if (
      !Object.keys(c.assists.manual || {}).length &&
      Object.keys(ASSISTS).every(
        (key) => c.assists[key] === undefined || c.assists[key] === previous[key],
      )
    ) {
      Object.assign(c.assists, presetAssists(mode));
    }
  }
  c.assists.layoutRevision = 4;
  const defaults = presetAssists(c.assists.base || c.assists.preset);
  const fallback = c.assists.base === 'easy';
  // Older saves did not record which switches were touched. Preserve the
  // choices identifiable from differences without treating every inherited
  // ON value in a Custom preset as a request to crowd Frank's lesson.
  c.assists.manual ??= Object.fromEntries(
    Object.keys(ASSISTS)
      .filter((key) => typeof c.assists[key] === 'boolean' && c.assists[key] !== defaults[key])
      .map((key) => [key, true]),
  );
  for (const k of Object.keys(ASSISTS))
    c.assists[k] ??=
      k === 'almanacShortcut'
        ? !!c.assists.currentOverlay
        : k === 'chartGrounds'
          ? !!c.assists.groundDots
          : (defaults[k] ?? fallback);
}
export function setPreset(w, preset, { restore = false } = {}) {
  if (!w.career) return;
  normalizeAssists(w.career);
  if (
    !['easy', 'realistic', 'off', 'custom'].includes(preset) ||
    (preset === 'easy' && w.career.difficulty === 'realistic')
  )
    return false;
  const c = w.career,
    current = c.assists;
  c.assistPresets ??= {};
  if (current.preset === 'custom') c.assistPresets.custom = structuredClone(current);
  if (current.base && current.base !== 'off')
    c.assistPresets[current.base] = structuredClone(current);
  c.assists = structuredClone(
    (preset === 'custom' && (c.assistPresets.custom || { ...current, preset: 'custom' })) ||
      (restore && c.assistPresets[preset]) ||
      presetAssists(preset),
  );
  normalizeAssists(c);
  if (c.difficulty === 'realistic')
    for (const key of Object.keys(ASSISTS)) {
      if (!REALISTIC_ASSISTS.has(key) && !Object.hasOwn(UI_OPTIONS, key)) c.assists[key] = false;
    }
  if (Object.values(w.career.assists).some((v) => v === true)) w.day.assisted = true;
  return true;
}
export function toggleInformation(w) {
  normalizeAssists(w.career);
  const modes =
    w.career.difficulty === 'realistic' ? ['realistic', 'off'] : ['easy', 'realistic', 'off'];
  const current = w.career.assists.base || w.career.assists.preset;
  setPreset(w, modes[(modes.indexOf(current) + 1) % modes.length], { restore: true });
}
export function toggleAssist(w, key) {
  normalizeAssists(w.career);
  if (
    !Object.hasOwn(ASSISTS, key) ||
    (w.career.difficulty === 'realistic' &&
      !REALISTIC_ASSISTS.has(key) &&
      !Object.hasOwn(UI_OPTIONS, key))
  )
    return false;
  if (w.career.assists.base === 'off') w.career.assists.base = w.career.difficulty;
  w.career.assists[key] = !assist(w, key);
  w.career.assists.manual[key] = true;
  w.career.assists.preset = 'custom';
  w.career.assistPresets ??= {};
  w.career.assistPresets[w.career.assists.base] = structuredClone(w.career.assists);
  w.career.assistPresets.custom = structuredClone(w.career.assists);
  if (w.career.assists[key]) w.day.assisted = true;
}
export function assist(w, name, realistic = false, reveal = false) {
  // Quiet defaults apply per instrument. A deliberate switch choice survives
  // reload and takes precedence without exposing untouched sibling windows.
  if (
    !reveal &&
    w.career?.intro?.status === 'active' &&
    TUTORIAL_QUIET_ASSISTS.has(name) &&
    !w.career.assists.manual?.[name]
  )
    return false;
  return (
    reveal ||
    (w.career
      ? (w.career.assists[name] ??
        (name === 'chartGrounds'
          ? !!w.career.assists.groundDots
          : w.career.assists.preset === 'easy'))
      : (w.uiOptions?.[name] ?? (!realistic && !DEFAULT_OFF_ASSISTS.has(name))))
  );
}
export function gear(w, id) {
  return enabledEquipment(w).includes(id);
}
export function pickupTolerance(w, realistic = false) {
  const base = assist(w, 'widePickup', realistic)
    ? C.recovery.tolerance
    : C.recovery.realisticTolerance;
  return base * (w.weather?.night && !gear(w, 'lights') ? 0.62 : 1);
}
export function visibilityRange(w) {
  let range = w.weather?.visibility ?? 1000;
  if (w.weather?.night) range = Math.min(range, workLightRange(w));
  return range;
}
export function reefRange(w) {
  return (
    (gear(w, 'glasses') && !w.weather?.night ? 45 : C.visibility.reefRange) *
    Math.min(1, visibilityRange(w) / 80)
  );
}
