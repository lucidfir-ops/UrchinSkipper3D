import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartMode, minimapViewport, stepChartZoom } from '../src/chart-presentation.js';
import { sectorChartSvg } from '../src/chart-art.js';
import { introTerrain } from '../src/career-intro.js';

test('chart rendition defaults to raster and accepts explicit vector mode', () => {
  assert.equal(chartMode({}), 'raster');
  assert.equal(chartMode({ chartMode: 'raster' }), 'raster');
  assert.equal(chartMode({ chartMode: 'vector' }), 'vector');
  assert.equal(chartMode({ chartMode: 'unknown' }), 'raster');
});

test('chart minimap zoom steps are bounded and viewport follows the boat', () => {
  assert.equal(stepChartZoom(undefined, 1), 2);
  assert.equal(stepChartZoom(2, 1), 4);
  assert.equal(stepChartZoom(4, 1), 4);
  assert.equal(stepChartZoom(1, -1), 1);

  assert.deepEqual(minimapViewport(240, 120, 120, 1), {
    x: 0,
    y: 0,
    size: 240,
    zoom: 1,
  });
  assert.deepEqual(minimapViewport(240, 120, 120, 2), {
    x: 60,
    y: 60,
    size: 120,
    zoom: 2,
  });
  assert.deepEqual(minimapViewport(240, 5, 235, 4), {
    x: 0,
    y: 180,
    size: 60,
    zoom: 4,
  });
});

test('vector local chart uses scalable geometry aligned to world-metres overlays', () => {
  const terrain = introTerrain(),
    svg = sectorChartSvg(terrain, {
      boat: { x: 113, y: 164, heading: Math.PI / 2 },
      exit: 'south',
      rocks: [{ x: 137, y: 119, charted: true, topDepth: 0.2 }],
      marks: [{ x: 171, y: 69, label: 'Fresh shelf' }],
      tracks: [
        {
          points: [
            { x: 100, y: 100 },
            { x: 113, y: 164 },
          ],
        },
      ],
    });
  assert.match(svg, /^<svg[^>]+viewBox="0 0 240 240"/);
  assert(!svg.includes('<canvas'));
  assert.match(svg, /translate\(113 164\) rotate\(90\)/);
  assert.match(svg, /M30 237H210/);
  assert.match(svg, /Fresh shelf/);
  assert.match(svg, /M100\.00 100\.00L113\.00 164\.00/);
  assert.match(svg, /data-chart-terrain/);
  assert.equal(
    svg.split(`h-${terrain.spacing + 0.08}Z`).length - 1,
    (terrain.size / terrain.spacing) ** 2,
  );
  assert(
    (svg.match(/<path /g) || []).length < 2000,
    'batch vector cells and contours, not one DOM node per cell/segment',
  );
});
