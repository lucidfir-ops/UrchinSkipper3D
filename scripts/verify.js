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
async function ready() {
  try {
    const response = await fetch(env.URCHIN_TEST_URL);
    return (
      response.headers.get('x-urchin-build') === 'production' &&
      response.headers.get('x-urchin-edition') === 'three'
    );
  } catch {
    return false;
  }
}
const suites = {
  'tutorial-retry': ['scripts/tutorial-retry-review.js'],
  'continuous-weather': ['scripts/continuous-weather-review.js'],
  'ocean-edge': ['scripts/ocean-edge-review.js'],
  'wind-crests': ['scripts/wind-crest-review.js'],
  boundary: ['scripts/boundary-review.js'],
  'surface-drift': ['scripts/surface-drift-review.js'],
  'work-lights': ['scripts/work-lights-review.js'],
  currents: ['scripts/coastal-current-review.js'],
  'lighting-kelp': ['scripts/lighting-kelp-review.js'],
  vegetation: ['scripts/vegetation-review.js'],
  feedback: ['scripts/feedback-2026-review.js'],
  'feedback-water': ['scripts/feedback-2026-review.js', '--environment-only'],
  equipment: ['scripts/equipment-review.js'],
  learning: ['scripts/browser-smoke.js', '--learning-interface-only'],
  operations: ['scripts/browser-smoke.js', '--diver-operations-only'],
  fleet: ['scripts/cohesion-visual-review.js'],
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
    for (let i = 0; i < 100 && !(await ready()); i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    if (!(await ready())) throw new Error('Production server not ready');
    const selected = process.argv
      .find((a) => a.startsWith('--suite='))
      ?.slice(8)
      .split(',');
    if (selected?.some((name) => !Object.hasOwn(suites, name)))
      throw new Error('Unknown suite: ' + selected);
    for (const [name, args] of Object.entries(suites)) {
      if (selected ? !selected.includes(name) : name === 'firefox') continue;
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
  const suffix =
    process.argv.find((a) => a.startsWith('--suite='))?.slice(8) ||
    (process.argv.includes('--unit-only') ? 'unit' : 'full');
  writeFileSync(
    `test-results/verification-${suffix}.json`,
    JSON.stringify(
      { started, ended: new Date().toISOString(), passed: !process.exitCode, results },
      null,
      2,
    ),
  );
}
