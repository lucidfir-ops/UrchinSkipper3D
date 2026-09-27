import { CoastalRaster } from './coastal-art.js';

// One worker and two reusable buffers per scene, not a texture per tide/frame.
// The fallback keeps the build usable where workers are blocked by an embed.
export class TerrainPainter {
  constructor() {
    this.serial = 0;
    this.pending = null;
    try {
      this.worker = new Worker(new URL('./terrain-painter.worker.js', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = ({ data }) => {
        if (this.pending?.id !== data.id) return;
        this.normal = data.normal;
        this.hidden = data.hidden;
        const { resolve } = this.pending;
        clearTimeout(this.pending.timeout);
        this.pending = null;
        resolve(data);
      };
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.useFallback();
      };
    } catch {
      this.worker = null;
    }
  }
  useFallback() {
    this.worker?.terminate();
    this.worker = null;
    if (this.pending && !this.pending.fallback) {
      clearTimeout(this.pending.timeout);
      this.pending.fallback = true;
      this.fallback(this.pending);
    }
  }
  paint(terrain, tide) {
    return new Promise((resolve) => {
      const job = { id: ++this.serial, terrain, tide, resolve };
      this.pending = job;
      if (!this.worker) return this.fallback(job);
      const changed = this.terrain !== terrain;
      this.terrain = terrain;
      this.normal ||= new ArrayBuffer(1024 * 1024 * 4);
      this.hidden ||= new ArrayBuffer(1024 * 1024 * 4);
      this.worker.postMessage(
        {
          id: job.id,
          tide,
          terrain: changed
            ? {
                size: terrain.size,
                spacing: terrain.spacing,
                depths: terrain.depths,
              }
            : null,
          normal: this.normal,
          hidden: this.hidden,
        },
        [this.normal, this.hidden],
      );
      this.normal = this.hidden = null;
      job.timeout = setTimeout(() => this.useFallback(), 10000);
    });
  }
  async fallback(job) {
    const yieldFrame = () => new Promise((resolve) => setTimeout(resolve, 0));
    await yieldFrame();
    if (this.localTerrain !== job.terrain) {
      this.localRaster = new CoastalRaster(job.terrain, 1024, false);
      for (let row = 0; row < 1024; row += 8) {
        this.localRaster.prepareRows(row, Math.min(1024, row + 8));
        await yieldFrame();
      }
      this.localTerrain = job.terrain;
    }
    this.normal ||= new ArrayBuffer(1024 * 1024 * 4);
    this.hidden ||= new ArrayBuffer(1024 * 1024 * 4);
    const normal = { data: new Uint8ClampedArray(this.normal) },
      hidden = { data: new Uint8ClampedArray(this.hidden) };
    for (let i = 0; i < 1024 * 1024; i += 16384) {
      this.localRaster.paint(normal, hidden, job.tide, i, i + 16384);
      await yieldFrame();
    }
    this.pending = null;
    job.resolve({ id: job.id, tide: job.tide, normal: this.normal, hidden: this.hidden });
  }
}
