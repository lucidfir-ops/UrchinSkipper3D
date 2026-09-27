import * as THREE from 'three';
import { assist } from '../assists.js';
import { patchVisible } from '../hidden-ground.js';
import { outlineStrokes, patchStyle, patchLabel, legendMarkup } from '../patch-style.js';
import { paintSectorMap } from '../chart-art.js';
import { seaLevel, currentAt } from '../world.js';
import { hullDepth } from '../boat.js';
import { boatSpec } from '../boats.js';
import { introActive } from '../career-intro.js';
import { diverSpec } from '../crew.js';

// Overlay information follows the existing difficulty and knowledge contract.
export class NavigationOverlay {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this.layer = document.createElement('div');
    this.layer.id = 'three-world-labels';
    this.layer.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2;overflow:hidden';
    document.body.append(this.layer);
    this.lessonLabels = ['PORT · PICKUP', 'STERN · KEEP CLEAR'].map((text, i) => {
      const el = document.createElement('span');
      el.textContent = text;
      el.style.cssText = `position:absolute;background:#0b2637e8;color:${i ? '#ffd3a0' : '#a8f3d4'};font:600 10px system-ui;padding:5px 8px;border:1px solid #accabb55;border-radius:3px;white-space:nowrap;transform:translate(-50%,-50%)`;
      this.layer.append(el);
      return { el, text, visible: false, x: 0, y: 0, hullAnchor: { x: 0, y: 0 } };
    });
    this.rails = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x9ad8c4, transparent: true, opacity: 0.9 }),
    );
    scene.add(this.rails);
  }
  update(world, ui, title, project) {
    if (this.patches !== world.patches) {
      for (const { line, label } of this.items) {
        line.geometry.dispose();
        line.material.dispose();
        label.remove();
      }
      this.group.clear();
      this.items = [];
      this.patches = world.patches;
      for (const patch of world.patches) {
        const points = outlineStrokes(patch).flatMap(([a, b]) => [a.x, 0.2, a.y, b.x, 0.2, b.y]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        const line = new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({
            color: patchStyle(patch).color,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
          }),
        );
        const label = document.createElement('span');
        label.style.cssText =
          'position:absolute;padding:4px 7px;background:#0d303ad9;border:1px solid #aac8b32c;color:#d6e6cf;border-radius:3px;font:10px/1.4 system-ui;text-align:center;white-space:pre;transform:translate(-50%,-100%)';
        this.layer.append(label);
        this.group.add(line);
        this.items.push({ line, patch, label });
      }
    }
    const reveal = !!ui.revealUrchins || ui.debug,
      exact = assist(world, 'groundDots', ui.realistic, ui.debug) || !!ui.revealUrchins;
    this.group.visible = !title && exact;
    for (const { line, patch, label } of this.items) {
      const known = patchVisible(patch, reveal);
      line.visible = known;
      const near = Math.hypot(patch.x - world.boat.x, patch.y - world.boat.y) < 100;
      label.hidden = !this.group.visible || !known || !near || !!ui.screen;
      if (!label.hidden) {
        const p = project(
          patch.x,
          Math.min(...(patch.outline?.map((p) => p.y) || [patch.y - patch.radius])),
        );
        label.hidden = p.x < 85 || p.x > innerWidth - 85 || p.y < 165 || p.y > innerHeight - 165;
        if (!label.hidden) {
          const panels = [
            'helmPanel',
            'diverPanel',
            'electronics',
            'minimapPanel',
            'speedPanel',
            'fuelPanel',
            'currentReadout',
            'frankAboard',
          ];
          label.hidden = panels.some((id) => {
            const el = document.getElementById(id);
            if (!el || el.hidden) return false;
            const r = el.getBoundingClientRect();
            return p.x + 90 > r.left && p.x - 90 < r.right && p.y > r.top && p.y - 36 < r.bottom;
          });
        }
        label.style.left = p.x + 'px';
        label.style.top = p.y - 6 + 'px';
        const text = patchLabel(
          patch,
          world.career ? diverSpec(world.divers[world.selectedDiverId]).harvestRate : 1,
        );
        if (label.textContent !== text) label.textContent = text;
      }
    }
    const legend = document.getElementById('groundLegend');
    legend.hidden =
      title ||
      !!ui.screen ||
      (!!world.career && !assist(world, 'pickingLegend', ui.realistic, ui.debug));
    if (legend.dataset.exact !== String(exact)) {
      legend.dataset.exact = String(exact);
      legend.innerHTML = legendMarkup(exact);
    }
    const info = document.getElementById('testInfo'),
      map = document.getElementById('testMap');
    info.hidden = map.hidden = title || !ui.debug || (!!world.career && !world.career.sandbox);
    if (!info.hidden && performance.now() > (this.nextInfo || 0)) {
      this.nextInfo = performance.now() + 500;
      const c = currentAt(world, world.boat.x, world.boat.y);
      info.textContent =
        `TEST REVEAL · ${world.terrain.size} × ${world.terrain.size} m\nCurrent ${Math.hypot(c.x, c.y).toFixed(2)} m/s\nTide ${seaLevel(world).toFixed(2)} m\nHull clearance ${hullDepth(world).toFixed(1)} m\n` +
        world.divers
          .map((d) => `${d.name}: ${d.state} · Air ${d.air.toFixed(0)} · ${d.bag.toFixed(0)} lb`)
          .join('\n');
      paintSectorMap(map, world.terrain, {
        tide: seaLevel(world),
        boat: world.boat,
        divers: world.divers,
        exit: world.day.returnExit?.edge,
        labels: false,
      });
    }
    const lesson =
      !title && introActive(world) && !ui.screen && !(ui.input.touchEnabled && ui.touch?.hudHidden);
    this.rails.visible = lesson;
    const b = world.boat,
      spec = boatSpec(world),
      sin = Math.sin(b.heading),
      cos = Math.cos(b.heading);
    const pt = (x, z) => ({ x: b.x + x * cos - z * sin, y: b.y + x * sin + z * cos });
    const anchors = [pt(-spec.width / 2, 0), pt(0, spec.length / 2)];
    this.lessonLabels.forEach((l, i) => {
      l.visible = lesson;
      l.el.hidden = !lesson;
      if (lesson) {
        const a = anchors[i],
          screen = project(a.x, a.y);
        l.x = screen.x + (i ? 90 : -90);
        l.y = screen.y;
        l.hullAnchor = a;
        l.el.style.left = l.x + 'px';
        l.el.style.top = l.y + 'px';
        // Compact tutorial dialogue takes precedence over floating captions.
        // Keep the coloured rails on the real hull; Frank teaches the same cue.
        if (ui.input.touchEnabled && innerHeight <= 500) {
          const covered = ['frankAboard', 'help'].some((id) => {
            const panel = document.getElementById(id);
            if (!panel || panel.hidden || !panel.getClientRects().length) return false;
            const r = panel.getBoundingClientRect(),
              halfWidth = i ? 70 : 55;
            return (
              l.x + halfWidth > r.left &&
              l.x - halfWidth < r.right &&
              l.y + 14 > r.top &&
              l.y - 14 < r.bottom
            );
          });
          l.visible = !covered;
          l.el.hidden = covered;
        }
      }
    });
    if (lesson) {
      const pairs = [
        [pt(-spec.width / 2, -spec.length * 0.28), pt(-spec.width / 2, spec.length * 0.3)],
        [pt(-spec.width * 0.5, spec.length / 2), pt(spec.width * 0.5, spec.length / 2)],
      ];
      this.rails.geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          pairs.flatMap(([a, b]) => [a.x, 0.4, a.y, b.x, 0.4, b.y]),
          3,
        ),
      );
    }
  }
}
