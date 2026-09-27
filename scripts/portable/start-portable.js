import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const server = spawn(
  process.execPath,
  ['scripts/serve-build.js', ...process.argv.slice(2).filter((a) => a === '--lan')],
  { stdio: ['inherit', 'pipe', 'inherit'] },
);
let opened = false;
server.stdout.on('data', (data) => {
  process.stdout.write(data);
  if (opened || !data.toString().includes('http://127.0.0.1:')) return;
  opened = true;
  console.log('Keep this terminal open while playing. Press Ctrl+C here to stop the server.');
  if (process.argv.includes('--no-open')) return;
  const url = `http://127.0.0.1:${process.env.URCHIN_PORT || 5198}/`,
    command =
      process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open',
    args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const browser = spawn(command, args, { stdio: 'ignore' });
  browser.on('error', () => console.log(`Open ${url} in Firefox or Chromium.`));
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.on('exit', (code) => {
  process.exitCode = code || 0;
});
