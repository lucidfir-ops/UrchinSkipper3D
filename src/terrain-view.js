import { TerrainPainter } from './terrain-painter.js';
import { prepareContent } from './loading.js';
import { diverSpec } from './crew.js';
import { patchVisible } from './hidden-ground.js';
import { bearing as bearingDegrees } from './math.js';
import { CoastDetailCache } from './coast-detail-cache.js';
import { KelpCache } from './kelp-cache.js';
import { drawRivers } from './runoff.js';
import { kelpBeds, drawKelp, coastalDetails, drawCoastalDetail, SEA } from './coastal-art.js';
import { assist, reefRange } from './assists.js';
import { C, DIRECTIONS } from './config.js';
import { depthAt, currentAt, seaLevel, patchDistance, debrisCurrent } from './world.js';
import { hullDepth } from './boat.js';
import {
  patchStyle,
  patchLabel,
  patchOutline,
  patchLabelAnchor,
  outlineStrokes,
  legendMarkup,
} from './patch-style.js';
import { paintSectorMap } from './chart-art.js';

export class TerrainView {
  constructor(scene) {
    this.scene = scene;
    this.coastCache = new CoastDetailCache(scene);
    this.kelpCache = new KelpCache(scene);
    this.map = document.querySelector('#testMap');
    this.info = document.querySelector('#testInfo');
    this.legend = document.querySelector('#groundLegend');
    this.labels = [];
    this.painter = new TerrainPainter();
  }
  setWorld(w) {
    this.coastCache.invalidate();
    this.kelpCache.invalidate();
    this.world = w;
    this.terrain = w.terrain;
    this.localKey = null;
    this.tideKey = null;
    this.mapKey = null;
    this.paintGeneration = (this.paintGeneration || 0) + 1;
    this.prepared = false;
    this.kelp = kelpBeds(w.terrain);
    for (const bed of this.kelp)
      bed.patch = w.patches.find((p) => Math.hypot(p.x - bed.x, p.y - bed.y) < p.radius + 7);
    this.coastDetails = coastalDetails(w.terrain);
    if (!this.texture) {
      this.texture = this.scene.textures.createCanvas('seabed', 1024, 1024);
      this.hiddenTexture = this.scene.textures.createCanvas('coast-only', 1024, 1024);
      this.image = this.scene.add.image(0, 0, 'seabed').setOrigin(0).setDepth(-10);
      this.localTexture = this.scene.textures.createCanvas('nearby-reefs', 192, 192);
      this.localImage = this.scene.add
        .image(0, 0, 'nearby-reefs')
        .setDepth(-9)
        .setDisplaySize(
          C.visibility.reefRange * 2 * C.pixelsPerMeter,
          C.visibility.reefRange * 2 * C.pixelsPerMeter,
        );
    }
    this.image.setDisplaySize(w.terrain.size * C.pixelsPerMeter, w.terrain.size * C.pixelsPerMeter);
    prepareContent('terrain', 'Preparing the water and shoreline…', async () => {
      if (this.painting) await this.painting;
      if (this.world === w) await this.refreshTide(w);
    });
    for (const label of this.labels) label.destroy();
    this.labels = w.patches.map((p) =>
      this.scene.add
        .text(p.x * C.pixelsPerMeter, p.y * C.pixelsPerMeter, '', {
          fontFamily: 'system-ui',
          fontSize: '13px',
          color: '#fff1cd',
          backgroundColor: '#102c38db',
          align: 'center',
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5, 1)
        .setDepth(3)
        .setVisible(false),
    );
    this.patchGraphics = w.patches.map((p) => ({
      outline: patchOutline(p),
      strokes: outlineStrokes(p),
    }));
  }
  refreshTide(w) {
    const key = Math.round(seaLevel(w) * 20);
    if (this.painting || key === this.tideKey) return this.painting;
    const generation = this.paintGeneration;
    this.painting = this.painter
      .paint(w.terrain, seaLevel(w))
      .then((result) => {
        if (generation !== this.paintGeneration) return;
        this.tideKey = key;
        this.localKey = null;
        this.texture.context.putImageData(
          new ImageData(new Uint8ClampedArray(result.normal), 1024, 1024),
          0,
          0,
        );
        this.hiddenTexture.context.putImageData(
          new ImageData(new Uint8ClampedArray(result.hidden), 1024, 1024),
          0,
          0,
        );
        if (this.scene.game.renderer.gl) {
          this.texture.refresh();
          this.hiddenTexture.refresh();
        }
        this.prepared = true;
      })
      .finally(() => {
        this.painting = null;
      });
    return this.painting;
  }
  nearbyReefs(w) {
    const b = w.boat,
      range = reefRange(w),
      key = `${Math.round(b.x * 2)},${Math.round(b.y * 2)},${this.tideKey},${range.toFixed(1)}`;
    this.localImage.setDisplaySize(range * 2 * C.pixelsPerMeter, range * 2 * C.pixelsPerMeter);
    this.localImage.setPosition(b.x * C.pixelsPerMeter, b.y * C.pixelsPerMeter);
    if (key === this.localKey) return;
    this.localKey = key;
    const ctx = this.localTexture.context,
      data = (this.reefData ||= ctx.createImageData(192, 192));
    data.data.fill(0);
    this.reefMask ||= Array.from({ length: 192 * 192 }, (_, i) => {
      const x = (((i % 192) + 0.5) / 192) * 2 - 1,
        y = ((Math.floor(i / 192) + 0.5) / 192) * 2 - 1;
      return { x, y, radius: Math.hypot(x, y) };
    })
      .map((q, i) => ({ ...q, offset: i * 4 }))
      .filter((q) => q.radius <= 1);
    for (const sample of this.reefMask) {
      const depth = depthAt(w, b.x + sample.x * range, b.y + sample.y * range);
      if (depth <= 0 || depth >= 10) continue;
      const shallow = 1 - depth / 10,
        bright = 25 * shallow * shallow,
        offset = sample.offset;
      data.data[offset] = Math.round(SEA[0] + 20 * shallow + bright);
      data.data[offset + 1] = Math.round(SEA[1] + 35 * shallow + bright);
      data.data[offset + 2] = Math.round(SEA[2] + 21 * shallow + bright);
      data.data[offset + 3] = Math.round(110 * (1 - sample.radius));
    }
    ctx.putImageData(data, 0, 0);
    if (this.scene.game.renderer.gl) this.localTexture.refresh();
  }
  draw(g, w, reveal, realistic = false, revealUrchins = false) {
    if (this.world !== w || this.terrain !== w.terrain) this.setWorld(w);
    this.refreshTide(w);
    const p = C.pixelsPerMeter,
      b = w.boat,
      t = w.time,
      restricted = !assist(w, 'reefClarity', realistic, reveal),
      exact = assist(w, 'groundDots', realistic, reveal) || revealUrchins,
      range = reefRange(w);
    this.image.setTexture(restricted ? 'coast-only' : 'seabed');
    this.localImage.setVisible(restricted);
    if (restricted) this.nearbyReefs(w);
    const camera = this.scene.cameras.main,
      rx = this.scene.scale.width / (2 * p * camera.zoom) + 25,
      ry = this.scene.scale.height / (2 * p * camera.zoom) + 25;
    for (const item of this.coastCache.draw(w, this.coastDetails, camera.zoom)
      ? []
      : this.coastDetails) {
      if (Math.abs(item.x - b.x) > rx + 4 || Math.abs(item.y - b.y) > ry + 4) continue;
      // These are surface details entirely within exposed geometry, never extra
      // colliders or invented rocks appearing in navigable water.
      if (item.bed + seaLevel(w) > -0.08 || item.maxBed + seaLevel(w) > -0.03) continue;
      drawCoastalDetail(g, item, p, camera.zoom);
    }
    if (w.career) drawRivers(g, w, p);
    for (const item of w.debris) {
      if (
        Math.abs(item.x - b.x) > rx ||
        Math.abs(item.y - b.y) > ry ||
        depthAt(w, item.x, item.y) <= 0
      )
        continue;
      const c = debrisCurrent(w, item),
        speed = Math.hypot(c.x, c.y);
      g.lineStyle(1.6, 0xdce4c7, 0.5);
      g.lineBetween(
        item.x * p,
        item.y * p,
        (item.x - c.x * 0.9 - 0.13) * p,
        (item.y - c.y * 0.9) * p,
      );
      g.lineStyle(1, 0xd3f3e7, Math.min(0.3, 0.09 + speed * 0.13));
      g.lineBetween((item.x - c.x * 3) * p, (item.y - c.y * 3) * p, item.x * p, item.y * p);
    }
    for (const bed of this.kelpCache.draw(w, this.kelp, camera.zoom, restricted, range)
      ? []
      : this.kelp) {
      if (Math.abs(bed.x - b.x) > rx + 9 || Math.abs(bed.y - b.y) > ry + 9) continue;
      const depth = depthAt(w, bed.x, bed.y);
      if (depth < 0.08 || depth > 14) continue;
      const distance = Math.hypot(bed.x - b.x, bed.y - b.y);
      if (restricted && distance > range) continue;
      const flow = currentAt(w, bed.x, bed.y),
        alpha = restricted ? 0.62 * Math.max(0, 1 - distance / range) : 0.72;
      const nearby = w.career && bed.patch;
      const recovery = nearby?.kelpCover || 0;
      drawKelp(g, bed, flow, t, p, alpha, camera.zoom < 0.55 ? 0.4 : camera.zoom < 0.8 ? 0.65 : 1);
      if (recovery > 0.65)
        drawKelp(g, { ...bed, x: bed.x + 1.3, y: bed.y - 1, stems: 1 }, flow, t, p, alpha * 0.8);
      if (depth < 0.6) {
        g.lineStyle(0.8, 0xd5dac1, alpha * 0.32);
        g.strokeEllipse(bed.x * p, bed.y * p, 2.2 * p, 0.7 * p);
      }
    }
    w.patches.forEach((patch, index) => {
      const visible =
        Math.abs(patch.x - b.x) < rx + patch.radius && Math.abs(patch.y - b.y) < ry + patch.radius;
      const label = this.labels[index];
      const known = exact && patchVisible(patch, reveal || revealUrchins);
      label.setVisible(known && visible);
      label.setScale(1 / camera.zoom);
      if (known && visible) {
        const anchor = patchLabelAnchor(this.patchGraphics[index].outline, p, camera.zoom);
        label.setPosition(anchor.x, anchor.y);
        label.setText(
          patchLabel(patch, w.career ? diverSpec(w.divers[w.selectedDiverId]).harvestRate : 1),
        );
      }
      if (!visible || (w.career && !known)) return;
      const style = patchStyle(patch),
        shape = this.patchGraphics[index],
        empty = patch.remaining <= 0.001;
      g.fillStyle(style.color, empty ? 0.006 : style.fill * 0.45);
      g.fillPoints(
        shape.outline.map((v) => ({ x: v.x * p, y: v.y * p })),
        true,
      );
      g.lineStyle(1.8 / camera.zoom, empty ? 0x899c96 : style.color, empty ? 0.4 : 0.8);
      for (const [a, z] of shape.strokes) g.lineBetween(a.x * p, a.y * p, z.x * p, z.y * p);
      if (!empty && patch.clumps)
        for (const clump of patch.clumps) {
          const stock = clump.remaining / clump.initialStock;
          if (stock <= 0.001) continue;
          const count = Math.ceil(
            Math.max(3, 150 / patch.clumps.length) *
              (1 - style.tier * 0.15) *
              stock *
              (camera.zoom < 0.55 ? 0.6 : 1),
          );
          for (let i = 0; i < count; i++) {
            const a = i * 2.399 + clump.x,
              rad = Math.sqrt((i + 0.5) / count) * clump.radius * 0.9;
            const wx = clump.x + Math.cos(a) * rad,
              wy = clump.y + Math.sin(a) * rad;
            if (patchDistance(patch, wx, wy) > 0.001) continue;
            const x = wx * p,
              y = wy * p;
            g.fillStyle(0x193832, 0.45);
            g.fillCircle(x + 1, y + 1, 2.2 / camera.zoom);
            g.fillStyle(style.color, 0.48);
            g.fillCircle(x, y, 1.5 / camera.zoom);
            if (i % 2 === 0) {
              g.lineStyle(0.65 / camera.zoom, style.color, 0.42);
              g.lineBetween(x - 2.8 / camera.zoom, y, x + 2.8 / camera.zoom, y);
              g.lineBetween(x, y - 2.8 / camera.zoom, x, y + 2.8 / camera.zoom);
            }
          }
        }
      if (!empty && !patch.clumps)
        for (let i = 0; i < style.dots; i++) {
          const angle = i * 2.399,
            rad = Math.sqrt((i + 0.5) / style.dots) * patch.radius * 0.62;
          const x = (patch.x + Math.cos(angle) * rad) * p,
            y = (patch.y + Math.sin(angle) * rad * 0.78) * p;
          g.fillStyle(style.color, 0.35);
          g.fillCircle(x, y, 1.3 / camera.zoom);
          if (i % 3 === 0) {
            g.lineStyle(0.7 / camera.zoom, style.color, 0.3);
            g.lineBetween(x - 2 / camera.zoom, y, x + 2 / camera.zoom, y);
            g.lineBetween(x, y - 2 / camera.zoom, x, y + 2 / camera.zoom);
          }
        }
    });
    this.legend.hidden = !!w.career && !assist(w, 'pickingLegend', realistic, reveal);
    if (this.legend.dataset.exact !== String(exact)) {
      this.legend.dataset.exact = String(exact);
      this.legend.innerHTML = legendMarkup(exact);
    }
    this.info.hidden = this.map.hidden = !reveal || (!!w.career && !w.career.sandbox);
    if (!assist(w, 'currentArrows', realistic, reveal)) return;
    for (
      let y = Math.max(0, Math.floor((b.y - ry) / 25) * 25);
      y < Math.min(w.terrain.size, b.y + ry);
      y += 25
    )
      for (
        let x = Math.max(0, Math.floor((b.x - rx) / 25) * 25);
        x < Math.min(w.terrain.size, b.x + rx);
        x += 25
      ) {
        if (depthAt(w, x, y) <= 0) continue;
        const c = currentAt(w, x, y),
          speed = Math.hypot(c.x, c.y);
        if (speed < 0.025) continue;
        const ex = x + c.x * 14,
          ey = y + c.y * 14,
          angle = Math.atan2(c.y, c.x);
        g.lineStyle(1.4 / camera.zoom, 0xb8efff, 0.7);
        g.lineBetween(x * p, y * p, ex * p, ey * p);
        for (const side of [-1, 1])
          g.lineBetween(
            ex * p,
            ey * p,
            (ex - Math.cos(angle + side * 0.6) * 1.6) * p,
            (ey - Math.sin(angle + side * 0.6) * 1.6) * p,
          );
      }
    if (!reveal) return;
    const c = currentAt(w, b.x, b.y),
      bearing = bearingDegrees(c.x, c.y);
    const nearby = [...w.patches]
      .sort((a, z) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(z.x - b.x, z.y - b.y))
      .slice(0, 4);
    this.info.textContent =
      `TEST REVEAL · ${w.terrain.size} × ${w.terrain.size} m\nLOCAL current ${Math.hypot(c.x, c.y).toFixed(2)} m/s · ${bearing.toFixed(0)}°\nTide ${seaLevel(w).toFixed(2)} m · ${(w.environment.tideRate || 0) >= 0 ? 'rising' : 'falling'}\nHull minimum ${hullDepth(w).toFixed(1)} m · ${b.grounded ? 'GROUNDED' : 'afloat'}\n` +
      w.divers
        .map(
          (d) =>
            `DIVER ${d.id + 1} ${d.state.toUpperCase()} · ${DIRECTIONS[d.direction]}\nSearch ${d.searchTime.toFixed(1)}s · Harvest ${d.harvestTime.toFixed(1)}s\nAir ${d.air.toFixed(1)} / 100 · Bag ${d.bag.toFixed(0)} / 300 lb`,
        )
        .join('\n') +
      '\nNEARBY GROUNDS\n' +
      nearby
        .map(
          (p) =>
            `${p.id.toUpperCase()}: ${p.remaining.toFixed(0)} lb · ${p.rate ? 300 / p.rate + 's · ' + Math.round(p.quality * 100) + '%' : 'empty'}`,
        )
        .join('\n');
    const mapKey = `${Math.floor(t * 2)},${this.tideKey},${w.sectorRevision}`;
    if (mapKey !== this.mapKey) {
      this.mapKey = mapKey;
      paintSectorMap(this.map, w.terrain, {
        tide: seaLevel(w),
        boat: b,
        divers: w.divers,
        exit: w.day.returnExit?.edge,
        labels: false,
      });
    }
    for (const d of w.divers)
      if (['searching', 'harvesting'].includes(d.state)) {
        g.lineStyle(1, 0xffffff, 0.3);
        g.strokeCircle(d.x * p, d.y * p, C.diver.awareness * p);
      }
  }
}
