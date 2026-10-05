import { logEvent } from './troubleshooting-log.js';
import { VESSEL_ART, VESSEL_VECTOR_ART } from './vessel-catalog.js';
import { boatArtMode } from './boat-art-mode.js';
import { loadImage } from './loading.js';
import runtimeArt from './generated/vessel-runtime.json' with { type: 'json' };
import { paintFleetPreviews } from './three/fitting-preview.js';

// Runtime framing only: original PNGs remain byte-for-byte intact. Row gaps
// separate the neighbouring sheet fragment present above the Island Tender.
export function vesselFrame(data, width, height) {
  const bands = [];
  let start = null,
    last = 0;
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 48) count++;
    if (count > 8) {
      start ??= y;
      last = y;
    } else if (start !== null && y - last > 8) {
      bands.push([start, last + 1]);
      start = null;
    }
  }
  if (start !== null) bands.push([start, last + 1]);
  const [top, bottom] = bands.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0] || [0, height];
  let left = width,
    right = 0;
  for (let y = top; y < bottom; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 48) {
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
      }
  return right > left
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : { x: 0, y: 0, width, height };
}
const cache = new Map();
const ready = new Map();
export function vesselArtSource(id, mode = boatArtMode()) {
  return mode === 'vector' && VESSEL_VECTOR_ART[id] ? VESSEL_VECTOR_ART[id] : VESSEL_ART[id];
}
export function vesselCanvas(id, mode = boatArtMode()) {
  const prepared = runtimeArt[`${mode}:${id}`],
    sourceUrl = prepared?.url || vesselArtSource(id, mode),
    cacheKey = sourceUrl,
    readyKey = `${mode}:${id}`;
  if (!sourceUrl) return Promise.reject(new Error('Unknown vessel artwork: ' + id));
  if (!cache.has(cacheKey))
    cache.set(
      cacheKey,
      (async () => {
        const source = await loadImage(sourceUrl);
        if (prepared) {
          const canvas = document.createElement('canvas');
          canvas.width = prepared.width;
          canvas.height = prepared.height;
          canvas.getContext('2d').drawImage(source, 0, 0);
          canvas.frame = prepared.frame;
          return canvas;
        }
        const scratch = document.createElement('canvas');
        scratch.width = source.width;
        scratch.height = source.height;
        const ctx = scratch.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0);
        const frame = vesselFrame(
          ctx.getImageData(0, 0, source.width, source.height).data,
          source.width,
          source.height,
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(320, frame.width);
        canvas.height = Math.min(640, frame.height);
        canvas
          .getContext('2d')
          .drawImage(
            source,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        canvas.frame = frame;
        scratch.width = scratch.height = 1;
        return canvas; // Cache the small canvas, not the decoded full-resolution sheet.
      })(),
    );
  return cache
    .get(cacheKey)
    .then((canvas) => {
      ready.set(readyKey, canvas);
      return canvas;
    })
    .catch((error) => {
      cache.delete(cacheKey);
      logEvent('asset-error', String(error));
      throw error;
    });
}
export async function prepareVesselArt(progress = () => {}) {
  const entries = Object.keys(runtimeArt);
  let cursor = 0,
    complete = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < entries.length) {
        const [mode, id] = entries[cursor++].split(':');
        await vesselCanvas(id, mode);
        progress(`Preparing boat artwork… ${++complete}/${entries.length}`);
      }
    }),
  );
}
// October 5: the large boat-selection preview turns like the Chandlery's
// (drag, or ← / → when focused). Card thumbnails stay still so a tap selects.
export function vesselPreview(id, name, { rotatable = false } = {}) {
  return rotatable
    ? `<figure class="vessel-preview vessel-model vessel-rotatable"><canvas width="720" height="440" data-vessel="${id}" data-rotatable="true" tabindex="0" role="img" aria-label="${name}, 3D boat model. Drag or use the arrow keys to turn it."></canvas><figcaption>${name}<span>Drag to turn · ← →</span></figcaption></figure>`
    : `<figure class="vessel-preview vessel-model"><canvas width="720" height="440" data-vessel="${id}" role="img" aria-label="${name}, 3D boat model"></canvas><figcaption>${name}</figcaption></figure>`;
}
export function paintVesselPreviews(panel) {
  paintFleetPreviews(panel);
}
export class VesselSprites {
  constructor(scene) {
    this.scene = scene;
    this.pending = new Map();
    this.failed = new Map();
  }
  install(key, canvas) {
    if (this.scene.textures.exists(key)) return key;
    // Give Phaser its own canvas. Cached preview pixels must not become a
    // renderer-owned surface that can be cleared/reused or destroyed with a
    // texture. Explicit refresh uploads the completed pixels on WebGL too.
    const texture = this.scene.textures.createCanvas(key, canvas.width, canvas.height);
    texture.context.drawImage(canvas, 0, 0);
    texture.refresh();
    return key;
  }
  texture(id, mode = boatArtMode()) {
    const key = `vessel-${mode}-${id}`;
    if (this.scene.textures.exists(key)) return key;
    const pendingKey = `${mode}:${id}`;
    if (ready.has(pendingKey)) {
      return this.install(key, ready.get(pendingKey));
    }
    if (!this.pending.has(pendingKey) && Date.now() >= (this.failed.get(pendingKey) || 0))
      this.pending.set(
        pendingKey,
        vesselCanvas(id, mode)
          .then((canvas) => {
            this.install(key, canvas);
          })
          .catch((error) => {
            logEvent('asset-error', { key, error: String(error) });
            this.failed.set(pendingKey, Date.now() + 15000);
          })
          .finally(() => this.pending.delete(pendingKey)),
      );
    return null;
  }
}
