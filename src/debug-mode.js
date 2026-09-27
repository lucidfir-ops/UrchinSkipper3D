import { C } from './config.js';
import { formatClock } from './day.js';
import { environmentMinute, updateEnvironment } from './environment.js';
import { step } from './simulation.js';
import { spawnTraffic } from './traffic.js';
import { updateWeather, WEATHER } from './weather.js';
import { godmode, toggleGodmode } from './godmode.js';

const DEBUG_SCREENS = new Set(['debug-mode', 'debug-time', 'debug-weather', 'debug-tide']);
const TIME_TARGETS = [360, 420, 480, 540, 600, 720, 900, 1080, 1260, 1380];
const TIDE_HEIGHTS = [-2, -1, 0, 1, 2, 3, 4, 5];

export const isDebugScreen = (screen) => DEBUG_SCREENS.has(screen);

export function debugClockMinute(w) {
  return w.day.phase === 'practice' ? ((environmentMinute(w) % 1440) + 1440) % 1440 : w.day.minute;
}

export function debugConditions(w) {
  return (w.career.debugConditions ??= { weather: 'natural', tideHeight: null });
}

function markAssisted(w) {
  w.day.assisted = true;
}

// Debug clock changes move the same simulation that ordinary play moves. They
// are deliberately forward-only: assigning an earlier clock would rewind the
// display while leaving crew, catch, traffic and safety history in the future.
export function advanceDebugTime(w, minutes) {
  if (!['working', 'practice'].includes(w.day.phase))
    return { ok: false, reason: 'Start a working trip before advancing simulation time.' };
  if (!Number.isFinite(minutes) || minutes <= 0)
    return { ok: false, reason: 'Debug time can only move forward.' };
  const start = debugClockMinute(w),
    seconds = minutes / C.day.minutesPerSecond,
    steps = Math.ceil(seconds * 60),
    dt = seconds / steps,
    held = w.career?.testConditions?.freezeClock;
  if (held) w.career.testConditions.freezeClock = false;
  markAssisted(w);
  for (let i = 0; i < steps && !w.emergency?.mandatoryRescue; i++) step(w, {}, dt);
  if (held) w.career.testConditions.freezeClock = true;
  const advanced = debugClockMinute(w) - start;
  return {
    ok: advanced > 0,
    reason: w.emergency?.mandatoryRescue
      ? `Advanced ${Math.max(0, Math.round(advanced))} minutes; stopped at a mandatory emergency.`
      : `Simulation advanced ${Math.round(advanced)} minutes to ${formatClock(debugClockMinute(w))}.`,
  };
}

export function setDebugWeather(w, kind) {
  if (kind !== 'natural' && !WEATHER[kind])
    return { ok: false, reason: 'Unknown weather condition.' };
  debugConditions(w).weather = kind;
  markAssisted(w);
  updateWeather(w);
  return {
    ok: true,
    reason:
      kind === 'natural'
        ? 'Natural forecast restored.'
        : `${WEATHER[kind].name} forced until restored here.`,
  };
}

export function setDebugTide(w, height) {
  if (height !== null && (!Number.isFinite(height) || height < -2 || height > 5))
    return { ok: false, reason: 'Tide height must be between −2 m and +5 m.' };
  debugConditions(w).tideHeight = height;
  markAssisted(w);
  updateEnvironment(w);
  return {
    ok: true,
    reason:
      height === null
        ? 'Natural tide height restored; the independent current was never forced.'
        : `Tide height held at ${height >= 0 ? '+' : '−'}${Math.abs(height)} m; current remains independent.`,
  };
}

function trafficAction(w, kind) {
  const actor = spawnTraffic(w, kind);
  if (actor) {
    markAssisted(w);
    return {
      ok: true,
      reason: `${kind === 'dfo' ? 'DFO patrol' : kind} spawned on a valid route.`,
    };
  }
  return {
    ok: false,
    reason:
      kind === 'rival'
        ? 'No eligible rival is working this area now, or the safe traffic limit/route is unavailable.'
        : 'No valid offscreen water route is available, or the safe traffic limit has been reached.',
  };
}

export function debugChoices(ui, w) {
  if (!isDebugScreen(ui.screen) || !w.career) return null;
  const forced = debugConditions(w);
  if (ui.screen === 'debug-time') {
    const now = debugClockMinute(w);
    return TIME_TARGETS.map((minute) =>
      minute > now
        ? `Advance to ${formatClock(minute)}`
        : `${formatClock(minute)} · already passed`,
    ).concat('Back / Close');
  }
  if (ui.screen === 'debug-weather')
    return ['natural', ...Object.keys(WEATHER)]
      .map(
        (kind) =>
          `${kind === forced.weather ? '✓ ' : ''}${kind === 'natural' ? 'Natural forecast' : WEATHER[kind].name}`,
      )
      .concat('Back / Close');
  if (ui.screen === 'debug-tide')
    return [
      `${forced.tideHeight === null ? '✓ ' : ''}Natural tide`,
      ...TIDE_HEIGHTS.map(
        (height) =>
          `${forced.tideHeight === height ? '✓ ' : ''}Hold ${height >= 0 ? '+' : '−'}${Math.abs(height)} m`,
      ),
      'Back / Close',
    ];
  return [
    'Skip forward 30 minutes',
    `Set time · ${formatClock(debugClockMinute(w))}`,
    `Set weather · ${forced.weather === 'natural' ? 'Natural forecast' : WEATHER[forced.weather].name}`,
    `Set tide height · ${forced.tideHeight === null ? 'Natural tide' : `${forced.tideHeight >= 0 ? '+' : '−'}${Math.abs(forced.tideHeight)} m`}`,
    'Spawn taxi',
    'Spawn rival',
    'Spawn tourist boat',
    'Spawn DFO patrol',
    'Restore natural weather and tide',
    `Godmode: ${godmode(w) ? 'ON' : 'OFF'} · invulnerability & free fuel`,
    ...(w.career.sandbox ? ['More isolated training tools', 'Developer conditions'] : []),
    'Back / Close',
  ];
}

export function debugActivate(ui, w) {
  if (!isDebugScreen(ui.screen) || !w.career) return false;
  const choice = debugChoices(ui, w)[ui.index];
  let result;
  if (!choice || /^Back( |$)/.test(choice)) ui.back();
  else if (ui.screen === 'debug-time') {
    const target = TIME_TARGETS[ui.index],
      now = debugClockMinute(w);
    result =
      target > now
        ? advanceDebugTime(w, target - now)
        : { ok: false, reason: 'That time has passed. Debug time is forward-only.' };
  } else if (ui.screen === 'debug-weather')
    result = setDebugWeather(w, ['natural', ...Object.keys(WEATHER)][ui.index]);
  else if (ui.screen === 'debug-tide')
    result = setDebugTide(w, ui.index === 0 ? null : TIDE_HEIGHTS[ui.index - 1]);
  else if (choice === 'Skip forward 30 minutes') result = advanceDebugTime(w, 30);
  else if (choice.startsWith('Set time')) ui.open('debug-time');
  else if (choice.startsWith('Set weather')) ui.open('debug-weather');
  else if (choice.startsWith('Set tide height')) ui.open('debug-tide');
  else if (choice.startsWith('Godmode:')) result = toggleGodmode(w);
  else if (choice === 'Restore natural weather and tide') {
    setDebugWeather(w, 'natural');
    result = setDebugTide(w, null);
    result.reason = 'Natural forecast and tide restored.';
  } else if (choice === 'More isolated training tools') ui.open('training');
  else if (choice === 'Developer conditions') ui.open('workshop');
  else if (choice.startsWith('Spawn '))
    result = trafficAction(
      w,
      choice.includes('taxi')
        ? 'taxi'
        : choice.includes('rival')
          ? 'rival'
          : choice.includes('tourist')
            ? 'tourist'
            : 'dfo',
    );
  if (result) ui.menuNotice = result.reason;
  ui.hooks.save?.();
  ui.signature = null;
  return true;
}
