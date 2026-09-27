import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const env = {
  ...process.env,
  URCHIN_TEST_URL: 'http://127.0.0.1:5186/',
  URCHIN_PRODUCTION_TEST: '1',
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
    const selected = process.argv.find((a) => a.startsWith('--suite='))?.slice(8);
    if (selected && !Object.hasOwn(suites, selected)) throw new Error('Unknown suite: ' + selected);
    for (const [name, args] of Object.entries(suites)) {
      if (selected ? selected !== name : name === 'firefox') continue;
      await run(name, process.execPath, args);
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
