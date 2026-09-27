import { C } from './config.js';
import { drawCoastalDetail } from './coastal-art.js';

// One bounded texture. Close views bake the full detail; wide views omit facets.
export function coastCacheBounds(w, width, height, zoom = C.camera.minZoom) {
  const minimum = zoom < 0.55 ? C.camera.minZoom : Math.max(0.55, Math.floor(zoom * 2) / 2),
    quality = zoom < 0.55 ? 0.55 : Math.ceil(zoom * 2) / 2,
    spanX = width / (C.pixelsPerMeter * minimum) + 64,
    spanY = height / (C.pixelsPerMeter * minimum) + 64,
    centerX = Math.floor(w.boat.x / 20) * 20 + 10,
    centerY = Math.floor(w.boat.y / 20) * 20 + 10,
    density = Math.min(C.pixelsPerMeter * quality, 2048 / Math.max(spanX, spanY));
  return {
    left: centerX - spanX / 2,
    top: centerY - spanY / 2,
    spanX,
    spanY,
    density,
    width: Math.ceil(spanX * density),
    height: Math.ceil(spanY * density),
  };
}
export class CoastDetailCache {
  constructor(scene) {
    this.scene = scene;
  }
  invalidate() {
    this.key = null;
    this.image?.setVisible(false);
  }
  draw(w, details, zoom) {
    const scene = this.scene,
      bounds = coastCacheBounds(w, scene.scale.width, scene.scale.height, zoom),
      detail = zoom < 0.55 ? 0.4 : 1,
      tide = Math.ceil((w.environment.seaLevel || 0) * 20) / 20,
      key = `${bounds.left}/${bounds.top}/${bounds.width}/${bounds.height}/${bounds.density}/${detail}/${tide}`;
    this.image?.setVisible(true);
    if (this.terrain === w.terrain && this.key === key) return true;
    this.terrain = w.terrain;
    this.key = key;
    if (!this.texture) {
      this.texture = scene.textures.createCanvas(
        'coast-static-detail',
        bounds.width,
        bounds.height,
      );
      this.image = scene.add.image(0, 0, 'coast-static-detail').setOrigin(0).setDepth(-2);
      this.graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    } else if (this.texture.width !== bounds.width || this.texture.height !== bounds.height)
      this.texture.setSize(bounds.width, bounds.height);
    this.texture.context.clearRect(0, 0, bounds.width, bounds.height);
    const g = this.graphics;
    g.clear();
    for (const item of details) {
      if (
        item.x < bounds.left - 5 ||
        item.x > bounds.left + bounds.spanX + 5 ||
        item.y < bounds.top - 5 ||
        item.y > bounds.top + bounds.spanY + 5 ||
        item.bed + tide > -0.08 ||
        item.maxBed + tide > -0.03
      )
        continue;
      drawCoastalDetail(
        g,
        {
          ...item,
          x: item.x - bounds.left,
          y: item.y - bounds.top,
          points: item.points.map((p) => ({ x: p.x - bounds.left, y: p.y - bounds.top })),
        },
        bounds.density,
        detail,
      );
    }
    g.generateTexture(this.texture.canvas, bounds.width, bounds.height);
    if (scene.game.renderer.gl) this.texture.refresh();
    g.clear();
    this.image
      .setVisible(true)
      .setPosition(bounds.left * C.pixelsPerMeter, bounds.top * C.pixelsPerMeter)
      .setDisplaySize(bounds.spanX * C.pixelsPerMeter, bounds.spanY * C.pixelsPerMeter);
    return true;
  }
}
