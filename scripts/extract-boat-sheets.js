import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDir = join(root, 'assets/assets');
// Extract candidates for review; never overwrite the canonical fleet originals.
const outputDir = join(root, 'assets/generated-review/boat-sheet-individuals');
const sheets = [
  ['Nine Ships Reference Sheet.png', 'nine-ships', 3, 3],
  ['Top-Down Boat Design Asset Sheet.png', 'design-asset', 4, 4],
  ['Top-Down Boat Design Collection.png', 'design-collection', 3, 3],
  ['Top-Down Workboat Blueprint Grid.png', 'workboat-blueprint', 3, 3],
];

mkdirSync(dirname(outputDir), { recursive: true });
mkdirSync(outputDir);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const manifest = {
  generatedBy: 'scripts/extract-boat-sheets.js',
  canvas: { width: 1024, height: 1536, format: 'RGBA PNG', orientation: 'bow up' },
  note: 'Exact grid artwork extracted non-destructively. Pale background removal is edge-connected so enclosed white boat paint is retained.',
  boats: [],
};

for (const [source, prefix, columns, rows] of sheets) {
  const sourceUrl = `data:image/png;base64,${readFileSync(join(sourceDir, source)).toString('base64')}`;
  const images = await page.evaluate(
    async ({ sourceUrl, columns, rows }) => {
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();
      const outputs = [];

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const x0 = Math.round((image.width * column) / columns);
          const y0 = Math.round((image.height * row) / rows);
          const x1 = Math.round((image.width * (column + 1)) / columns);
          const y1 = Math.round((image.height * (row + 1)) / rows);
          const width = x1 - x0;
          const height = y1 - y0;
          const cell = document.createElement('canvas');
          cell.width = width;
          cell.height = height;
          const cellContext = cell.getContext('2d');
          cellContext.drawImage(image, x0, y0, width, height, 0, 0, width, height);

          // Remove only neutral, pale pixels connected to the cell boundary.
          // White-painted parts enclosed by the boat outline remain opaque.
          const pixels = cellContext.getImageData(0, 0, width, height);
          const seen = new Uint8Array(width * height);
          const queue = new Int32Array(width * height);
          let head = 0;
          let tail = 0;
          const paleBackground = (index) => {
            const offset = index * 4;
            const red = pixels.data[offset];
            const green = pixels.data[offset + 1];
            const blue = pixels.data[offset + 2];
            return (
              Math.min(red, green, blue) >= 208 &&
              Math.max(red, green, blue) - Math.min(red, green, blue) <= 30
            );
          };
          const enqueue = (index) => {
            if (seen[index] || !paleBackground(index)) return;
            seen[index] = 1;
            queue[tail++] = index;
          };
          for (let x = 0; x < width; x++) {
            enqueue(x);
            enqueue((height - 1) * width + x);
          }
          for (let y = 0; y < height; y++) {
            enqueue(y * width);
            enqueue(y * width + width - 1);
          }
          while (head < tail) {
            const index = queue[head++];
            const x = index % width;
            const y = Math.floor(index / width);
            pixels.data[index * 4 + 3] = 0;
            if (x > 0) enqueue(index - 1);
            if (x + 1 < width) enqueue(index + 1);
            if (y > 0) enqueue(index - width);
            if (y + 1 < height) enqueue(index + width);
          }
          cellContext.putImageData(pixels, 0, 0);

          const output = document.createElement('canvas');
          output.width = 1024;
          output.height = 1536;
          const context = output.getContext('2d');
          const scale = Math.min(1004 / height, 1516 / width);
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.translate(512, 768);
          context.rotate(-Math.PI / 2);
          context.scale(scale, scale);
          context.drawImage(cell, -width / 2, -height / 2);
          outputs.push(output.toDataURL('image/png'));
        }
      }
      return outputs;
    },
    { sourceUrl, columns, rows },
  );

  for (let index = 0; index < images.length; index++) {
    const row = Math.floor(index / columns) + 1;
    const column = (index % columns) + 1;
    const filename = `${prefix}-${String(index + 1).padStart(2, '0')}-r${row}-c${column}.png`;
    writeFileSync(join(outputDir, filename), Buffer.from(images[index].split(',')[1], 'base64'));
    manifest.boats.push({ filename, source, row, column });
  }
}

await browser.close();
writeFileSync(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Created 43 individual 1024×1536 RGBA boat images in ${outputDir}`);
