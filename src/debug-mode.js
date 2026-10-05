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
export function createDebugTimeAdvance(w, minutes) {
  if (!['working', 'practice'].includes(w.day.phase))
    return { error: 'Start a working trip before advancing simulation time.' };
  if (!Number.isFinite(minutes) || minutes <= 0)
    return { error: 'Debug time can only move forward.' };
  const seconds = minutes / C.day.minutesPerSecond,
    steps = Math.ceil(seconds * 60),
    dt = seconds / steps,
    start = debugClockMinute(w),
    held = w.career?.testConditions?.freezeClock;
  let completed = 0,
    stopped = false,
    finished = false;
  if (held) w.career.testConditions.freezeClock = false;
  markAssisted(w);
  return {
    start,
    target: start + minutes,
    get progress() {
      return completed / steps;
    },
    get done() {
      return (
        completed >= steps ||
        stopped ||
        !!w.emergency?.mandatoryRescue ||
        !['working', 'practice'].includes(w.day.phase)
      );
    },
    tick() {
      if (!this.done) {
        step(w, {}, dt);
        completed++;
      }
    },
    stop() {
      stopped = true;
    },
    finish() {
      if (!finished && held) w.career.testConditions.freezeClock = true;
      finished = true;
      const advanced = completed * dt * C.day.minutesPerSecond;
      return {
        ok: completed > 0,
        reason:
          `Advanced ${Math.round(advanced)} minutes to ${formatClock(debugClockMinute(w))}` +
          (w.emergency?.mandatoryRescue
            ? '; stopped at a mandatory emergency.'
            : stopped
              ? '; stopped here.'
              : '.'),
      };
    },
  };
}

// Headless callers can drain the same job. The player-facing path yields between
// short batches, keeping painting, input and the progress clock responsive.
export function advanceDebugTime(w, minutes) {
  const job = createDebugTimeAdvance(w, minutes);
  if (job.error) return { ok: false, reason: job.error };
  try {
    while (!job.done) job.tick();
  } finally {
    job.finish();
  }
  return job.finish();
}

export async function advanceDebugTimeWithFeedback(ui, w, minutes) {
  if (ui.debugAdvancing) return;
  const job = createDebugTimeAdvance(w, minutes);
  if (job.error) {
    ui.menuNotice = job.error;
    ui.signature = null;
    return;
  }
  ui.debugAdvancing = job;
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'time-advance';
  dialog.setAttribute('aria-labelledby', 'timeAdvanceTitle');
  dialog.innerHTML = `<div class="time-advance-dial" aria-hidden="true"><i></i><b></b></div>
    <div class="eyebrow">SIMULATION RUNNING</div><h2 id="timeAdvanceTitle">Advancing time</h2>
    <div class="time-advance-clock"></div><p class="time-advance-route"></p>
    <progress max="1" value="0" aria-label="Time advance progress"></progress>
    <p class="time-advance-detail" role="status" aria-live="polite"></p>
    <p>The boat, crew, tide and weather are moving forward.</p>
    <button type="button">Stop here</button>`;
  const clock = dialog.querySelector('.time-advance-clock'),
    progress = dialog.querySelector('progress'),
    detail = dialog.querySelector('.time-advance-detail'),
    dial = dialog.querySelector('.time-advance-dial');
  dialog.querySelector('.time-advance-route').textContent =
    `${formatClock(job.start)} → ${formatClock(job.target)}`;
  dialog.querySelector('button').onclick = () => job.stop();
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    job.stop();
  });
  const paint = () => {
    clock.textContent = formatClock(debugClockMinute(w));
    progress.value = job.progress;
    const percent = Math.floor(job.progress * 100);
    detail.textContent = `${percent}% complete`;
    dial.style.setProperty('--clock-turn', `${job.progress * minutes * 6}deg`);
  };
  document.body.append(dialog);
  paint();
  dialog.showModal();
  // A full paint before the first simulation batch, even on a slow phone.
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    await frame();
    await frame();
    while (!job.done) {
      const until = performance.now() + 8;
      do {
        job.tick();
      } while (!job.done && performance.now() < until);
      paint();
      await frame();
    }
    ui.menuNotice = job.finish().reason;
  } catch (error) {
    ui.menuNotice = `Time advance stopped: ${error.message}. Progress so far is kept.`;
  } finally {
    job.finish();
    dialog.close();
    dialog.remove();
    ui.debugAdvancing = null;
    ui.input?.suppress?.();
    ui.signature = null;
    ui.hooks.save?.();
    if (previousFocus?.isConnected) previousFocus.focus();
  }
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
  if (ui.debugAdvancing) return true;
  if (!isDebugScreen(ui.screen) || !w.career) return false;
  const choice = debugChoices(ui, w)[ui.index];
  let result;
  if (!choice || /^Back( |$)/.test(choice)) ui.back();
  else if (ui.screen === 'debug-time') {
    const target = TIME_TARGETS[ui.index],
      now = debugClockMinute(w);
    result =
      target > now
        ? void advanceDebugTimeWithFeedback(ui, w, target - now)
        : { ok: false, reason: 'That time has passed. Debug time is forward-only.' };
  } else if (ui.screen === 'debug-weather')
    result = setDebugWeather(w, ['natural', ...Object.keys(WEATHER)][ui.index]);
  else if (ui.screen === 'debug-tide')
    result = setDebugTide(w, ui.index === 0 ? null : TIDE_HEIGHTS[ui.index - 1]);
  else if (choice === 'Skip forward 30 minutes') {
    void advanceDebugTimeWithFeedback(ui, w, 30);
    return true;
  } else if (choice.startsWith('Set time')) ui.open('debug-time');
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
  if (ui.debugAdvancing) return true;
  if (result) ui.menuNotice = result.reason;
  ui.hooks.save?.();
  ui.signature = null;
  return true;
}
