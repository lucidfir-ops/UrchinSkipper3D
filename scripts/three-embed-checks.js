import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';
const root = resolve('dist'),
  prefix = '/uploads/urchin3d/',
  missing = [],
  errors = [];
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/play') {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<html><body style="margin:0"><iframe name="game" title="Urchin Skipper 3D" allow="fullscreen; autoplay; gamepad" allowfullscreen src="${prefix}index.html" style="border:0;width:100vw;height:100vh"></iframe></body></html>`,
    );
    return;
  }
  if (path === '/favicon.ico') {
    res.writeHead(204).end();
    return;
  }
  try {
    const file = resolve(root, decodeURIComponent(path.slice(prefix.length)));
    if (!path.startsWith(prefix) || !file.startsWith(root + sep) || !statSync(file).isFile())
      throw new Error('not game asset');
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch {
    missing.push(path);
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/play`);
  const frame = page.frame('game');
  await frame.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  assert.equal(await frame.evaluate(() => urchinDebug.renderer), 'three-webgl');
  await frame.locator('#keyboardFallback').click({ noWaitAfter: true });
  await frame
    .getByRole('button', { name: 'Come aboard · learn with Frank', exact: true })
    .waitFor();
  mkdirSync('test-results/three', { recursive: true });
  await page.screenshot({ path: 'test-results/three/embedded-intro.png' });
  assert.deepEqual(missing, []);
  assert.deepEqual(errors, []);
  console.log(
    'Nested production URL and iframe introduction pass; no missing assets or page errors.',
  );
} finally {
  mkdirSync('test-results/three', { recursive: true });
  writeFileSync('test-results/three/embed.json', JSON.stringify({ missing, errors }, null, 2));
  await browser.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
