import { introActive } from './career-intro.js';
import { boatSpec } from './boats.js';
import { C } from './config.js';

// Labels and rails rotate around the actual hull; they never change pickup or
// collision geometry. Text stays readable at every camera zoom.
export class LessonCues {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(4);
    this.labels = ['PORT · PICKUP', 'STERN · KEEP CLEAR'].map((text, i) =>
      scene.add
        .text(0, 0, text, {
          fontFamily: 'system-ui',
          fontSize: '11px',
          fontStyle: 'bold',
          color: i ? '#ffd5a0' : '#a9ffdd',
          backgroundColor: '#092330',
          padding: { x: 5, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(5)
        .setVisible(false),
    );
  }
  hide() {
    this.g.clear();
    this.labels.forEach((label) => label.setVisible(false));
  }
  draw(w, ui) {
    this.hide();
    if (
      !introActive(w) ||
      !ui.started ||
      ui.screen ||
      (ui.input.touchEnabled && ui.touch?.hudHidden)
    )
      return;
    const b = w.boat,
      spec = boatSpec(w),
      p = C.pixelsPerMeter,
      zoom = this.scene.cameras.main.zoom,
      sin = Math.sin(b.heading),
      cos = Math.cos(b.heading),
      pt = (x, y) => ({ x: (b.x + x * cos - y * sin) * p, y: (b.y + x * sin + y * cos) * p });
    const cues = [
      {
        a: pt(-spec.width / 2, -spec.length * 0.28),
        z: pt(-spec.width / 2, spec.length * 0.3),
        anchor: pt(-spec.width / 2, 0),
        color: 0x89f5c8,
      },
      {
        a: pt(-spec.width * 0.5, spec.length / 2),
        z: pt(spec.width * 0.5, spec.length / 2),
        anchor: pt(0, spec.length / 2),
        color: 0xffad6d,
      },
    ];
    cues.forEach((cue, i) => {
      // Captions stay beside the boat, clear of phone controls and dialogue.
      // The leader and coloured hull rail identify the rotating working side.
      const x = b.x * p + (i ? 96 : -96) / zoom,
        y = b.y * p;
      this.g.lineStyle(4 / zoom, cue.color, 0.9);
      this.g.lineBetween(cue.a.x, cue.a.y, cue.z.x, cue.z.y);
      this.g.lineStyle(1.5 / zoom, cue.color, 0.8);
      this.g.lineBetween(cue.anchor.x, cue.anchor.y, x, y);
      this.labels[i]
        .setPosition(x, y)
        .setScale(1 / zoom)
        .setVisible(true);
      this.labels[i].hullAnchor = cue.anchor;
    });
  }
}
