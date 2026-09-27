import { summarizeFrames } from './frame-metrics.js';
// Opt-in, bounded, local only. Record changes rather than every frame/input poll.
const KEY = 'urchin-troubleshooting-v1';
let enabled = false,
  entries = [],
  lastInput = '',
  lastSample = 0;
let lastPerformance = 0;
export function samplePerformanceLog(scene) {
  if (!enabled || performance.now() - lastPerformance < 5000) return;
  lastPerformance = performance.now();
  const summary = summarizeFrames(scene.metrics.samples.slice(-180));
  const rounded = Object.fromEntries(
    Object.entries(summary).map(([key, value]) => [
      key,
      typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Math.round(v * 10) / 10]))
        : value,
    ]),
  );
  logEvent('performance', {
    ...rounded,
    renderer: scene.game.renderer.type === 1 ? 'canvas' : 'webgl',
    viewport: `${innerWidth}x${innerHeight}`,
    pixelRatio: devicePixelRatio,
    screen: scene.playtest.screen || 'water',
    audio: scene.audio.manager.context?.state || 'unavailable',
    audioSampleRate: scene.audio.manager.context?.sampleRate,
    audioBaseLatency: scene.audio.manager.context?.baseLatency,
  });
}
try {
  enabled = localStorage.getItem(KEY + '-enabled') === 'on';
  entries = JSON.parse(localStorage.getItem(KEY) || '[]').slice(-250);
} catch {
  /* Storage may be blocked by the embed. */
}
export const loggingEnabled = () => enabled;
export function logEvent(type, detail) {
  if (!enabled && !['error', 'rejection', 'graphics', 'asset-error'].includes(type)) return;
  entries.push({ time: new Date().toISOString(), type, detail });
  if (entries.length > 250) entries.shift();
}
function flush() {
  if (!enabled) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* Still downloadable. */
  }
}
export function toggleLogging() {
  enabled = !enabled;
  try {
    localStorage.setItem(KEY + '-enabled', enabled ? 'on' : 'off');
  } catch {
    /* Session only. */
  }
  logEvent('logging', 'Enabled; saves and personal data are not included.');
  flush();
}
export function sampleLog(ui, w) {
  if (!enabled || performance.now() - lastSample < 500) return;
  lastSample = performance.now();
  const detail = JSON.stringify({
    screen: ui.screen || (ui.started ? 'water' : 'title'),
    day: w.career?.day,
    phase: w.day.phase,
    device: ui.input.lastDevice,
    actions: Object.entries(ui.input.raw)
      .filter(([, v]) => v > 0.5)
      .map(([k]) => k),
    viewport: `${innerWidth}x${innerHeight}`,
  });
  if (detail !== lastInput) {
    logEvent('state/input', detail);
    lastInput = detail;
  }
}
export function downloadLog() {
  flush();
  const url = URL.createObjectURL(
    new Blob(
      [
        `Urchin Skipper TEMP · SEP 25 · COASTS & SAFETY\n${navigator.userAgent}\n` +
          entries
            .map(
              (e) =>
                `${e.time} ${e.type}: ${typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)}`,
            )
            .join('\n'),
      ],
      { type: 'text/plain' },
    ),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `urchin-troubleshooting-${Date.now()}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    logEvent('error', `${e.message} ${e.filename}:${e.lineno}`);
    flush();
  });
  window.addEventListener('unhandledrejection', (e) => {
    logEvent('rejection', String(e.reason?.stack || e.reason));
    flush();
  });
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });
  document.addEventListener(
    'webglcontextlost',
    () => {
      logEvent('graphics', 'WebGL context lost');
      flush();
    },
    true,
  );
  setInterval(flush, 5000);
  logEvent('launch', 'Page loaded');
}

export function troubleshootingSnapshot() {
  return {
    build: 'TEMP · SEP 25 · COASTS & SAFETY',
    userAgent: globalThis.navigator?.userAgent || 'unavailable',
    viewport: typeof innerWidth === 'number' ? { width: innerWidth, height: innerHeight } : null,
    enabled,
    entries: structuredClone(entries),
  };
}
