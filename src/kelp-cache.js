import { C } from './config.js';
import { currentAt, depthAt } from './world.js';
import { drawKelp } from './coastal-art.js';
import { coastCacheBounds } from './coast-detail-cache.js';

// Wide-view vegetation stays animated, but one bounded bitmap replaces hundreds
// of per-frame vector paths. Every bed still samples the live depth and current.
export class KelpCache {
  constructor(scene) {
    this.scene = scene;
  }
  invalidate() {
    this.key = null;
    this.image?.setVisible(false);
  }
  draw(w, beds, zoom, restricted, range) {
    if (zoom >= 0.7) {
      this.image?.setVisible(false);
      return false;
    }
    const scene = this.scene,
      bounds = coastCacheBounds(w, scene.scale.width, scene.scale.height),
      density = Math.min(bounds.density, 1280 / Math.max(bounds.spanX, bounds.spanY)),
      width = Math.ceil(bounds.spanX * density),
      height = Math.ceil(bounds.spanY * density),
      detail = zoom < 0.55 ? 0.32 : 0.4,
      key = `${bounds.left}/${bounds.top}/${width}/${height}/${detail}/${Math.floor(w.time * 4)}/${restricted}/${range.toFixed(1)}`;
    this.image?.setVisible(true);
    if (this.world === w && this.key === key) return true;
    this.world = w;
    this.key = key;
    if (!this.texture) {
      this.texture = scene.textures.createCanvas('wide-kelp', width, height);
      this.image = scene.add.image(0, 0, 'wide-kelp').setOrigin(0).setDepth(-1.5);
      this.graphics = scene.make.graphics({ add: false });
    } else if (width !== this.texture.width || height !== this.texture.height)
      this.texture.setSize(width, height);
    this.texture.context.clearRect(0, 0, width, height);
    const g = this.graphics;
    g.clear();
    for (const bed of beds) {
      if (
        bed.x < bounds.left - 9 ||
        bed.x > bounds.left + bounds.spanX + 9 ||
        bed.y < bounds.top - 9 ||
        bed.y > bounds.top + bounds.spanY + 9
      )
        continue;
      const depth = depthAt(w, bed.x, bed.y),
        distance = Math.hypot(bed.x - w.boat.x, bed.y - w.boat.y);
      if (depth < 0.08 || depth > 14 || (restricted && distance > range)) continue;
      const local = { ...bed, x: bed.x - bounds.left, y: bed.y - bounds.top },
        alpha = restricted ? 0.62 * Math.max(0, 1 - distance / range) : 0.72,
        flow = currentAt(w, bed.x, bed.y);
      drawKelp(g, local, flow, w.time, density, alpha, detail);
      if (bed.patch?.kelpCover > 0.65)
        drawKelp(
          g,
          { ...local, x: local.x + 1.3, y: local.y - 1, stems: 1 },
          flow,
          w.time,
          density,
          alpha * 0.8,
          detail,
        );
    }
    g.generateTexture(this.texture.canvas, width, height);
    if (scene.game.renderer.gl) this.texture.refresh();
    g.clear();
    this.image
      .setVisible(true)
      .setPosition(bounds.left * C.pixelsPerMeter, bounds.top * C.pixelsPerMeter)
      .setDisplaySize(bounds.spanX * C.pixelsPerMeter, bounds.spanY * C.pixelsPerMeter);
    return true;
  }
}
