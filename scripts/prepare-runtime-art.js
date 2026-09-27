// Reproducible derivatives only. Never modify designer/source artwork.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { vesselFrame } from '../src/vessel-art.js';
import { VESSEL_ART, VESSEL_VECTOR_ART } from '../src/vessel-catalog.js';

const root = resolve('public'),
  destination = 'assets/fleet-runtime/sep22',
  manifest = {};
mkdirSync(resolve(root, destination), { recursive: true });
const server = createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    return res.end('<!doctype html><title>Artwork preparation</title>');
  }
  try {
    const file = resolve(
      root,
      '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
    );
    if (!file.startsWith(root + '/')) throw Error('Outside artwork root');
    res.setHeader('Content-Type', extname(file) === '.svg' ? 'image/svg+xml' : 'image/png');
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const seen = new Map();
  let total = 0;
  for (const mode of ['raster', 'vector']) {
    for (const id of Object.keys(VESSEL_ART)) {
      const source = mode === 'vector' ? VESSEL_VECTOR_ART[id] || VESSEL_ART[id] : VESSEL_ART[id];
      if (seen.has(source)) {
        manifest[`${mode}:${id}`] = seen.get(source);
        continue;
      }
      const result = await page.evaluate(
        async ({ source, framing }) => {
          const image = new Image();
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(Error(source));
            image.src = source;
          });
          const scratch = document.createElement('canvas');
          scratch.width = image.width;
          scratch.height = image.height;
          const ctx = scratch.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(image, 0, 0);
          const frame = Function(`return (${framing})`)()(
              ctx.getImageData(0, 0, image.width, image.height).data,
              image.width,
              image.height,
            ),
            canvas = document.createElement('canvas');
          canvas.width = Math.min(320, frame.width);
          canvas.height = Math.min(640, frame.height);
          canvas
            .getContext('2d')
            .drawImage(
              image,
              frame.x,
              frame.y,
              frame.width,
              frame.height,
              0,
              0,
              canvas.width,
              canvas.height,
            );
          return {
            frame,
            width: canvas.width,
            height: canvas.height,
            png: canvas.toDataURL('image/png').split(',')[1],
          };
        },
        { source, framing: vesselFrame.toString() },
      );
      const url = `./${destination}/${mode}-${id}.png`,
        file = resolve(root, url),
        original = readFileSync(resolve(root, decodeURIComponent(source)));
      writeFileSync(file, Buffer.from(result.png, 'base64'));
      total += statSync(file).size;
      const entry = {
        url,
        frame: result.frame,
        width: result.width,
        height: result.height,
        original: source,
        sourceSha256: createHash('sha256').update(original).digest('hex'),
      };
      manifest[`${mode}:${id}`] = entry;
      seen.set(source, entry);
    }
  }
  writeFileSync('src/generated/vessel-runtime.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `Prepared ${seen.size} compact vessel assets (${Math.round(total / 1024)} KiB), ${Object.keys(manifest).length} catalogue modes verified.`,
  );
} finally {
  await browser?.close();
  server.close();
  server.closeAllConnections();
}
