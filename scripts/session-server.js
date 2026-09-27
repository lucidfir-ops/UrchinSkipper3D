// Private, loopback-only companion for the launcher's dedicated Firefox session.
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { writeFileSync, rmSync } from 'node:fs';
const [sessionFile, gameUrl] = process.argv.slice(2);
const origin = new URL(gameUrl).origin,
  token = randomBytes(32).toString('hex');
const expected = Buffer.from(`Bearer ${token}`);
let exiting = false;
const server = createServer((req, res) => {
  if (req.headers.origin !== origin || req.url !== '/exit') {
    res.writeHead(403);
    res.end();
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Authorization',
    });
    res.end();
    return;
  }
  const actual = Buffer.from(req.headers.authorization || '');
  if (
    req.method !== 'POST' ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    res.writeHead(403);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end('{"exiting":true}');
  if (!exiting) {
    exiting = true;
    setTimeout(() => {
      server.close();
      server.closeAllConnections();
    }, 200);
  }
});
server.listen(0, '127.0.0.1', () => {
  const url = new URL(gameUrl);
  url.hash = new URLSearchParams({
    sessionPort: String(server.address().port),
    sessionToken: token,
  }).toString();
  writeFileSync(sessionFile, url.href + '\n', { mode: 0o600 });
});
const cleanup = () => {
  rmSync(sessionFile, { force: true });
};
process.on('exit', cleanup);
process.on('SIGTERM', () => {
  server.close();
  server.closeAllConnections();
});
process.on('SIGINT', () => {
  server.close();
  server.closeAllConnections();
});
