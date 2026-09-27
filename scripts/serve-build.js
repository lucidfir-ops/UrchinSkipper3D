import { createServer } from 'node:http';
import { createReadStream, statSync, readFileSync, realpathSync, readdirSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { resolve, extname, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
const root = realpathSync(resolve('dist'));
if (
  !readFileSync(resolve(root, 'index.html'), 'utf8').includes(
    'name="urchin-skipper-app" content="deck-playtest-3d"',
  )
)
  throw new Error('Build missing. Run npm run build first.');
const port = Number(process.env.URCHIN_PORT || 5184);
const lan = process.argv.includes('--lan');
// Prepare compressed text before advertising readiness; image bytes stay streamed.
const compressed = new Map();
function prepare(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) prepare(path);
    else if (/\.(js|css|html|json|svg)$/.test(entry.name)) {
      const bytes = readFileSync(path);
      compressed.set(path, {
        gzip: gzipSync(bytes),
        br: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }),
      });
    }
  }
}
prepare(root);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = realpathSync(resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)));
    if (!file.startsWith(root + sep) || !statSync(file).isFile())
      throw new Error('Not a build file');
    const stat = statSync(file),
      etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`,
      accepted = (req.headers['accept-encoding'] || '')
        .split(',')
        .map((part) => part.trim())
        .filter((part) => !/;\s*q=0(?:\.0*)?$/.test(part)),
      encoding = compressed.has(file)
        ? ['br', 'gzip'].find((name) => accepted.some((part) => part.split(';')[0] === name))
        : null,
      body = encoding && compressed.get(file)[encoding];
    const headers = {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'X-Urchin-Build': 'production',
      'X-Urchin-Edition': 'three',
      'X-Content-Type-Options': 'nosniff',
      ETag: etag,
      Vary: 'Accept-Encoding',
      'Cache-Control': /\/assets\/[^/]+-[\w-]+\.(js|css)$/.test(pathname)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    if (encoding) headers['Content-Encoding'] = encoding;
    headers['Content-Length'] = body ? body.length : stat.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end();
    else if (body) res.end(body);
    else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Urchin Skipper 3D production build · http://127.0.0.1:${port}`);
  if (lan)
    for (const address of Object.values(networkInterfaces()).flat()) {
      if (!address.internal && address.family === 'IPv4')
        console.log(`Phone / tablet on the same Wi-Fi · http://${address.address}:${port}`);
    }
});
const close = () => {
  server.close();
  server.closeAllConnections();
};
process.on('SIGTERM', close);
process.on('SIGINT', close);
