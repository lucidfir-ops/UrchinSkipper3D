import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { voyageChecks } from './voyage-checks.js';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('test-results/three', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const errors = [];
browser.on('page', (p) => {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
});
try {
  await voyageChecks(browser);
  assert.deepEqual(errors, []);
} finally {
  writeFileSync('test-results/three/playtest-errors.json', JSON.stringify(errors, null, 2));
  console.log('Errors:', errors);
  await browser.close();
}
