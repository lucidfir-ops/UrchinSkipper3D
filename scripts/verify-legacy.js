import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const env = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: '.browser-cache',
  URCHIN_TEST_URL: 'http://127.0.0.1:5180/',
  URCHIN_PRODUCTION_TEST: '1',
};
const results = [],
  started = new Date().toISOString();
let server;
async function run(label, command, args, extra = {}) {
  console.log(`\nVERIFY · ${label}`);
  const begin = Date.now();
  const child = spawn(command, args, { stdio: 'inherit', env: { ...env, ...extra } });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  results.push({ label, code, seconds: Math.round((Date.now() - begin) / 1000) });
  if (code !== 0) throw new Error(`${label} failed (${code})`);
}
async function ready() {
  try {
    const r = await fetch(env.URCHIN_TEST_URL);
    return r.headers.get('x-urchin-build') === 'production';
  } catch {
    return false;
  }
}
const suites = {
  september25: ['--september25-only'],
  'september25-firefox': ['--september25-only'],
  'traffic-coasting': ['--traffic-coasting-only'],
  'traffic-coasting-firefox': ['--traffic-coasting-only'],
  'tablet-feedback': ['--tablet-feedback-only'],
  'tablet-feedback-firefox': ['--tablet-feedback-only'],
  'crew-coasts': ['--crew-coasts-only'],
  'crew-coasts-firefox': ['--crew-coasts-only'],
  'working-day': ['--working-day-only'],
  'working-day-firefox': ['--working-day-only'],
  'audio-baseline': ['--audio-baseline-only'],
  'audio-scheduling': ['--audio-scheduling-only'],
  'audio-scheduling-firefox': ['--audio-scheduling-only'],
  september23: ['--september23-only'],
  'september23-firefox': ['--september23-only'],
  september22: ['--september22-only'],
  'september22-firefox': ['--september22-only'],
  'september22-performance': ['--september22-performance-only'],
  'device-feedback': ['--device-feedback-only'],
  'device-feedback-firefox': ['--device-feedback-only'],
  'device-embed': ['--device-embed-only'],
  'device-embed-firefox': ['--device-embed-only'],
  'minimap-layout': ['--minimap-layout-only'],
  'minimap-layout-firefox': ['--minimap-layout-only'],
  'chart-layout': ['--chart-layout-only'],
  'chart-layout-firefox': ['--chart-layout-only'],
  'shore-hazards': ['--shore-hazards-only'],
  'shore-hazards-firefox': ['--shore-hazards-only'],
  's22-latest': ['--s22-latest-only'],
  's22-latest-firefox': ['--s22-latest-only'],
  's22-title': ['--s22-title-only'],
  's22-title-firefox': ['--s22-title-only'],
  'harbour-shops': ['--harbour-shops-only'],
  'harbour-shops-firefox': ['--harbour-shops-only'],
  'hud-windows': ['--hud-windows-only'],
  'hud-windows-firefox': ['--hud-windows-only'],
  'keyboard-feedback': ['--keyboard-feedback-only'],
  'keyboard-feedback-firefox': ['--keyboard-feedback-only'],
  'itch-feedback': ['--itch-feedback-only'],
  'itch-feedback-firefox': ['--itch-feedback-only'],
  september15: ['--september15-only'],
  'september15-firefox': ['--september15-only'],
  'touch-feedback': ['--touch-feedback-only'],
  'touch-feedback-firefox': ['--touch-feedback-only'],
  training: ['--training-only'],
  'training-firefox': ['--training-only'],
  traffic: ['--traffic-only'],
  vessels: ['--vessels-only'],
  v2: ['--v2-only'],
  'v2-firefox': ['--v2-only'],
  performance: ['--performance-only'],
  'performance-firefox': ['--performance-only'],
  september13: ['--september13-only'],
  'september13-firefox': ['--september13-only'],
  september12: ['--september12-only'],
  'september12-firefox': ['--september12-only'],
  iteration: ['--iteration-only'],
  firefox: ['--iteration-only'],
  career: ['--career-only'],
  feedback: ['--feedback-only'],
  overnight: ['--overnight-only'],
  prototype: ['--prototype-only'],
  environment: ['--environment-only'],
  rendered: [],
  controller: null,
};
try {
  if (!process.argv.includes('--browsers-only')) {
    await run('lint', 'npm', ['run', 'lint']);
    await run('format', 'npm', ['run', 'format:check']);
    await run('unit regressions', 'npm', ['test']);
    await run('production build', 'npm', ['run', 'build']);
  }
  if (!process.argv.includes('--unit-only')) {
    if (!(await ready())) {
      server = spawn(process.execPath, ['scripts/serve-build.js'], {
        stdio: 'inherit',
        env: { ...env, URCHIN_PORT: '5180' },
      });
      for (let i = 0; i < 60 && !(await ready()); i++)
        await new Promise((resolve) => setTimeout(resolve, 100));
      if (!(await ready())) throw new Error('Production server not ready');
    }
    const selected = process.argv.find((a) => a.startsWith('--suite='))?.slice(8);
    if (selected && !Object.hasOwn(suites, selected)) throw new Error('Unknown suite: ' + selected);
    for (const [name, args] of Object.entries(suites)) {
      if (selected && name !== selected) continue;
      if (!selected && name === 'audio-baseline') continue; // Comparison only, before an audio change
      if (!selected && ['prototype', 'environment'].includes(name)) continue; // rendered includes both
      await run(
        name,
        process.execPath,
        [args ? 'scripts/browser-smoke.js' : 'scripts/deck-smoke.js', ...(args || [])],
        { URCHIN_TEST_BROWSER: name.includes('firefox') ? 'firefox' : 'chromium' },
      );
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server) server.kill('SIGTERM');
  mkdirSync('test-results', { recursive: true });
  const report = { started, ended: new Date().toISOString(), passed: !process.exitCode, results };
  const suffix =
    process.argv.find((a) => a.startsWith('--suite='))?.slice(8) ||
    (process.argv.includes('--unit-only') ? 'unit' : 'full');
  writeFileSync(`test-results/verification-${suffix}.json`, JSON.stringify(report, null, 2));
}
