import { alongsidePoint } from './patrol.js';
import { C } from './config.js';
import { clamp, angleDelta } from './math.js';
import { TRAFFIC } from './traffic-settings.js';
import { visibilityRange } from './assists.js';
export function trafficPose(actor, accumulator) {
  const previous = actor.renderFrom || actor,
    alpha = clamp(accumulator / TRAFFIC.tickSeconds, 0, 1);
  return {
    x: previous.x + (actor.x - previous.x) * alpha,
    y: previous.y + (actor.y - previous.y) * alpha,
    heading: previous.heading + angleDelta(actor.heading, previous.heading) * alpha,
  };
}
export class TrafficView {
  constructor(scene, vessels) {
    this.scene = scene;
    this.vessels = vessels;
    this.images = new Map();
    this.labels = new Map();
    this.g = scene.add.graphics().setDepth(1.1);
  }
  reset() {
    for (const image of this.images.values()) image.destroy();
    this.images.clear();
    for (const label of this.labels.values()) label.destroy();
    this.labels.clear();
    this.g.clear();
  }
  draw(w) {
    const active = new Set(),
      p = C.pixelsPerMeter;
    this.g.clear();
    for (const actor of w.traffic?.actors || []) {
      active.add(actor.id);
      let image = this.images.get(actor.id);
      const key = this.vessels.texture(actor.art);
      if (!image && key) {
        image = this.scene.add.image(0, 0, key).setDepth(1);
        this.images.set(actor.id, image);
      }
      if (image && key && image.texture.key !== key) image.setTexture(key);
      const pose =
          ['inspection', 'departing'].includes(actor.phase) &&
          actor.target === 'player' &&
          ['boarding', 'departing'].includes(w.day.inspection?.status)
            ? { ...alongsidePoint(w, actor), heading: w.boat.heading }
            : trafficPose(actor, w.traffic.accumulator),
        view = w.trafficView,
        visible =
          !view ||
          (Math.abs(actor.x - view.x) < view.rangeX + 20 &&
            Math.abs(actor.y - view.y) < view.rangeY + 20);
      if (image)
        image
          .setVisible(visible)
          .setPosition(pose.x * p, pose.y * p)
          .setRotation(pose.heading)
          .setDisplaySize(actor.width * p, actor.length * p);
      let label = this.labels.get(actor.id);
      if (!label) {
        label = this.scene.add
          .text(0, 0, '', {
            fontFamily: 'system-ui',
            fontSize: '12px',
            color: '#f4e4bf',
            backgroundColor: '#122e36',
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5, 1)
          .setDepth(3);
        this.labels.set(actor.id, label);
      }
      label.setVisible(
        visible &&
          Math.hypot(actor.x - w.boat.x, actor.y - w.boat.y) < Math.min(110, visibilityRange(w)),
      );
      label.setText(
        actor.hidden
          ? 'Shy Hull Wood'
          : actor.name ||
              (actor.kind === 'taxi'
                ? 'Water taxi'
                : actor.kind === 'dfo'
                  ? 'DFO patrol'
                  : 'Nine Ships'),
      );
      label
        .setScale(1 / this.scene.cameras.main.zoom)
        .setPosition(pose.x * p, (pose.y - actor.length / 2 - 2) * p);
      if (!visible) continue;
      if (!image) {
        this.g.fillStyle(actor.kind === 'dfo' ? 0xe3a15b : 0xc5d7d5);
        const s = Math.sin(pose.heading),
          c = Math.cos(pose.heading);
        this.g.fillPoints(
          [
            [-0.5, 0.5],
            [0.5, 0.5],
            [0.5, -0.25],
            [0, -0.5],
            [-0.5, -0.25],
          ].map(([x, y]) => ({
            x: (pose.x + x * actor.width * c - y * actor.length * s) * p,
            y: (pose.y + x * actor.width * s + y * actor.length * c) * p,
          })),
          true,
        );
      }
      if (actor.speed > 0.5) {
        const sx = Math.sin(pose.heading),
          sy = -Math.cos(pose.heading),
          x = (pose.x - (sx * actor.length) / 2) * p,
          y = (pose.y - (sy * actor.length) / 2) * p;
        this.g.lineStyle(2, 0xd6eeec, 0.25);
        this.g.lineBetween(x, y, x - (sx * 12 - sy * 3) * p, y - (sy * 12 + sx * 3) * p);
        this.g.lineBetween(x, y, x - (sx * 12 + sy * 3) * p, y - (sy * 12 - sx * 3) * p);
      }
      for (let n = 0; n < Math.min(18, actor.deckBags || 0); n++) {
        const side = ((n % 3) - 1) * 0.75,
          fore = 1 + Math.floor(n / 3) * 0.6,
          s = Math.sin(pose.heading),
          c = Math.cos(pose.heading);
        this.g.fillStyle(0xb5212e, 0.95);
        this.g.fillCircle(
          (pose.x + side * c - fore * s) * p,
          (pose.y + side * s + fore * c) * p,
          0.35 * p,
        );
      }
      for (const [i, d] of (actor.divers || []).entries()) {
        this.g.lineStyle(1.2, d.underwater ? 0xcce8e6 : 0xf2a05d, 0.65);
        this.g.strokeCircle(d.x * p, d.y * p, d.underwater ? 3 + ((w.time + i) % 2) : 5);
      }
    }
    for (const [id, image] of this.images)
      if (!active.has(id)) {
        image.destroy();
        this.images.delete(id);
      }
    for (const [id, label] of this.labels)
      if (!active.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
  }
}
