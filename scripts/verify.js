import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const env = {
  ...process.env,
  URCHIN_TEST_URL: 'http://127.0.0.1:5186/',
  URCHIN_PRODUCTION_TEST: '1',
  URCHIN_HARDWARE: '1',
};
const results = [],
  started = new Date().toISOString();
const probeTimeoutMs = 750,
  startupTimeoutMs = 10000;
let server;
async function run(label, command, args) {
  console.log(`\nVERIFY · ${label}`);
  const begin = Date.now();
  const child = spawn(command, args, { stdio: 'inherit', env });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  results.push({ label, code, seconds: Math.round((Date.now() - begin) / 1000) });
  if (code !== 0) throw new Error(`${label} failed (${code})`);
}
async function ready(timeoutMs = probeTimeoutMs) {
  let response;
  try {
    // A listener can accept a connection without ever sending headers. Bound
    // each probe separately, including the preflight port-occupancy check.
    response = await fetch(env.URCHIN_TEST_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(Math.max(1, Math.ceil(timeoutMs))),
    });
    return (
      response.headers.get('x-urchin-build') === 'production' &&
      response.headers.get('x-urchin-edition') === 'three'
    );
  } catch {
    return false;
  } finally {
    // HEAD normally has no body. Release one explicitly if a fetch adapter or
    // unusual server supplies it; readiness never needs to consume page bytes.
    if (response?.body) await response.body.cancel().catch(() => {});
  }
}
const suites = {
  'vessel-replacement': ['scripts/vessel-replacement-review.js'],
  'save-storage': ['scripts/save-storage-review.js'],
  'save-storage-firefox': ['scripts/save-storage-review.js', '--firefox'],
  'chart-layout': ['scripts/browser-smoke.js', '--chart-layout-only'],
  'coastal-progression': ['scripts/browser-smoke.js', '--coastal-progression-only'],
  'training-preferences': ['scripts/training-preferences-review.js'],
  'keyboard-reading': ['scripts/keyboard-reading-review.js'],
  'keyboard-reading-firefox': ['scripts/keyboard-reading-review.js', '--firefox'],
  'shoal-recovery': ['scripts/shoal-recovery-review.js'],
  'tutorial-retry': ['scripts/tutorial-retry-review.js'],
  'continuous-weather': ['scripts/continuous-weather-review.js'],
  'ocean-edge': ['scripts/ocean-edge-review.js'],
  'wind-crests': ['scripts/wind-crest-review.js'],
  boundary: ['scripts/boundary-review.js'],
  'context-loss': ['scripts/context-loss-review.js'],
  'menu-theme': ['scripts/menu-theme-audit.js', 'night,day', 'phone,tablet,deck', '--strict'],
  'context-loss-firefox': ['scripts/context-loss-review.js', '--firefox'],
  'surface-drift': ['scripts/surface-drift-review.js'],
  'work-lights': ['scripts/work-lights-review.js'],
  currents: ['scripts/coastal-current-review.js'],
  'lighting-kelp': ['scripts/lighting-kelp-review.js'],
  vegetation: ['scripts/vegetation-review.js'],
  'bull-kelp': ['scripts/bull-kelp-review.js'],
  feedback: ['scripts/feedback-2026-review.js'],
  'feedback-water': ['scripts/feedback-2026-review.js', '--environment-only'],
  equipment: ['scripts/equipment-review.js'],
  learning: ['scripts/browser-smoke.js', '--learning-interface-only'],
  operations: ['scripts/browser-smoke.js', '--diver-operations-only'],
  fleet: ['scripts/cohesion-visual-review.js'],
  'deck-load': ['scripts/deck-load-review.js'],
  'traffic-fleet': ['scripts/traffic-fleet-review.js'],
  interface: ['scripts/interface-review.js'],
  menus: ['scripts/menu-adversarial-review.js'],
  accessibility: ['scripts/ui-accessibility-checks.js'],
  'mobile-career': ['scripts/mobile-career-review.js'],
  'hud-context': ['scripts/hud-context-review.js'],
  visual: ['scripts/three-smoke.js'],
  input: ['scripts/three-input-checks.js'],
  touch: ['scripts/three-touch-review.js'],
  vessels: ['scripts/three-vessel-checks.js'],
  weather: ['scripts/three-weather-checks.js'],
  voyage: ['scripts/three-playtest.js'],
  embed: ['scripts/three-embed-checks.js'],
  performance: ['scripts/three-performance-checks.js'],
  firefox: ['scripts/three-input-checks.js', '--firefox'],
};
try {
  if (!process.argv.includes('--browsers-only')) {
    await run('lint', 'npm', ['run', 'lint']);
    await run('format', 'npm', ['run', 'format:check']);
    await run('unit regressions', 'npm', ['test']);
    await run('production build', 'npm', ['run', 'build']);
  }
  if (!process.argv.includes('--unit-only')) {
    if (await ready())
      throw new Error('Verification port 5186 already occupied; stop that server first.');
    server = spawn(process.execPath, ['scripts/serve-build.js'], {
      stdio: 'inherit',
      env: { ...env, URCHIN_PORT: '5186' },
    });
    let serverError;
    server.once('error', (error) => (serverError = error));
    const deadline = performance.now() + startupTimeoutMs;
    for (;;) {
      if (serverError) throw new Error('Production server failed to start: ' + serverError.message);
      if (server.exitCode !== null || server.signalCode)
        throw new Error(
          `Production server exited before readiness (${server.signalCode || server.exitCode}); check verification port 5186.`,
        );
      const remaining = deadline - performance.now();
      if (remaining <= 0)
        throw new Error(`Production server not ready within ${startupTimeoutMs / 1000} seconds.`);
      if (await ready(Math.min(probeTimeoutMs, remaining))) break;
      const delay = Math.min(100, deadline - performance.now());
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const selected = process.argv
      .find((a) => a.startsWith('--suite='))
      ?.slice(8)
      .split(',');
    if (selected?.some((name) => !Object.hasOwn(suites, name)))
      throw new Error('Unknown suite: ' + selected);
    for (const [name, args] of Object.entries(suites)) {
      if (selected ? !selected.includes(name) : name.endsWith('firefox')) continue;
      // Browser suites use isolated contexts. Keep their failure status while
      // collecting the rest of the matrix instead of hiding later defects.
      try {
        await run(name, process.execPath, args);
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
      }
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server) server.kill('SIGTERM');
  mkdirSync('test-results', { recursive: true });
  let suffix =
    process.argv.find((a) => a.startsWith('--suite='))?.slice(8) ||
    (process.argv.includes('--unit-only') ? 'unit' : 'full');
  // Long suite lists exceed file-name limits; the receipt lists every suite.
  if (suffix.length > 120) suffix = `${suffix.split(',').length}-suites-${started.slice(0, 10)}`;
  writeFileSync(
    `test-results/verification-${suffix}.json`,
    JSON.stringify(
      { started, ended: new Date().toISOString(), passed: !process.exitCode, results },
      null,
      2,
    ),
  );
}
