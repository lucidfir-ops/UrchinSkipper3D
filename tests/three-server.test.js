import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

test('3D launcher rejects a 2D server and distinguishes a production 3D build', async () => {
  let edition = 'two',
    production = true;
  const server = createServer((req, res) => {
    if (production) res.setHeader('X-Urchin-Build', 'production');
    if (edition === 'three') res.setHeader('X-Urchin-Edition', 'three');
    res.end(
      `<meta name="urchin-skipper-app" content="${edition === 'three' ? 'deck-playtest-3d' : 'deck-playtest'}">`,
    );
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const check = (args = []) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/check-server.js', url, ...args], {
        stdio: 'ignore',
      });
      child.once('error', reject);
      child.once('exit', resolve);
    });
  try {
    assert.equal(await check(['--production']), 1, 'An original 2D server must never be reused.');
    edition = 'three';
    assert.equal(await check(['--production']), 0);
    production = false;
    assert.equal(
      await check(['--production']),
      1,
      'A dev server must not be reused as production.',
    );
    assert.equal(await check(), 0);
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
