import * as THREE from 'three';
import { assist, pickupTolerance, visibilityRange } from '../assists.js';
import { diverVisual, interactionDiver } from '../presentation.js';
import { recoveryStatus } from '../diver-recovery.js';
import { selectDiver } from '../world.js';
import { boatSpec } from '../boats.js';
import { introActive } from '../career-intro.js';
import { C } from '../config.js';

// A direct translation of the original surface prompts, speech and delayed assistance.
export class DiverCues {
  constructor(scene, layer) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;
    this.outside = [0, 0];
    this.labels = [0, 1].map(() => {
      const label = document.createElement('div'),
        speech = document.createElement('div');
      label.style.cssText =
        'position:absolute;transform:translate(-50%,-100%);white-space:pre;text-align:center;padding:5px 7px;border-radius:4px;background:#102e3be8;color:#eed4a4;font:11px/1.4 system-ui';
      speech.style.cssText =
        'position:absolute;transform:translate(-50%,-100%);padding:7px 9px;border-radius:8px;max-width:210px;text-align:center;background:#fff5df;color:#19383d;box-shadow:0 3px 12px #00151a44;font:12px/1.4 system-ui';
      layer.append(label, speech);
      return { label, speech };
    });
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.98, 2.02, 48),
      new THREE.MeshBasicMaterial({
        color: 0xf5d594,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.ring);
    this.sector = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x81d6bb,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.group.add(this.sector);
  }
  reset() {
    this.time = 0;
    this.outside = [0, 0];
  }
  update(world, ui, title, project) {
    const b = world.boat,
      target = interactionDiver(world, ui.realistic),
      dt = Math.max(0, Math.min(0.1, world.time - this.time));
    this.time = world.time;
    const hidden = title || !!ui.screen,
      indicators = assist(world, 'diverIndicators', ui.realistic, ui.debug),
      arrows = [];
    this.group.visible = !hidden;
    this.ring.visible = indicators && !diverVisual(target).aboard;
    this.ring.position.set(target.x, 0.27, target.y);
    for (const d of world.divers) {
      const visual = diverVisual(d),
        distance = Math.hypot(d.x - b.x, d.y - b.y),
        physicallyVisible = distance <= visibilityRange(world),
        p = project(d.x, d.y),
        { label, speech } = this.labels[d.id];
      const pickup =
        visual.surface && physicallyVisible && assist(world, 'actionPrompts', ui.realistic);
      label.hidden = hidden || (!pickup && (!indicators || visual.aboard));
      if (!label.hidden) {
        const status = pickup
          ? recoveryStatus(world, pickupTolerance(world, ui.realistic), d)
          : null;
        const text = pickup
          ? `${status.available ? '✓' : '↧'} ${d.name} · ${Math.round(distance)} m\n${d.hooking ? 'Hauling…' : status.available ? (d.bagHandled ? 'Bag aboard' : 'Ready to hook') : status.reason === 'SLOW DOWN' ? 'Match the float’s drift' : status.reason === 'OUT OF RANGE' ? 'Bring port alongside' : status.reason}`
          : `${d.id === target.id ? '› ' : ''}${d.name}`;
        if (label.textContent !== text) label.textContent = text;
        label.style.color = status?.available ? '#a0edcc' : '#f3d499';
        label.style.left = p.x + (d.id ? 20 : -20) + 'px';
        label.style.top = p.y - 26 - d.id * 17 + 'px';
      }
      const talking =
        !hidden &&
        visual.surface &&
        physicallyVisible &&
        distance < 28 &&
        d.speech?.until > world.time;
      speech.hidden = !talking;
      if (talking) {
        speech.textContent = `${d.speech.icon}${d.speech.text ? ' ' + d.speech.text : ''}`;
        const partner = world.divers.some(
          (o) =>
            o !== d &&
            o.state === 'surface' &&
            o.speech?.until > world.time &&
            Math.hypot(o.x - d.x, o.y - d.y) < 14,
        );
        speech.style.left = p.x + (partner ? (d.id ? 90 : -90) : 0) + 'px';
        speech.style.top = p.y - 76 + 'px';
      }
      const onScreen = p.x >= 15 && p.y >= 15 && p.x <= innerWidth - 15 && p.y <= innerHeight - 15;
      this.outside[d.id] = onScreen || visual.aboard ? 0 : this.outside[d.id] + dt;
      if (
        !hidden &&
        assist(world, 'offscreenArrows', ui.realistic, ui.debug) &&
        !visual.aboard &&
        this.outside[d.id] >= C.visibility.assistanceDelay
      ) {
        const dx = p.x - innerWidth / 2,
          dy = p.y - innerHeight / 2,
          scale = Math.min(
            (innerWidth / 2 - 75) / Math.max(1, Math.abs(dx)),
            (innerHeight / 2 - 150) / Math.max(1, Math.abs(dy)),
          );
        arrows.push({
          id: d.id,
          x: innerWidth / 2 + dx * scale,
          y: innerHeight / 2 + dy * scale,
          angle: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
        });
      }
    }
    const signature = JSON.stringify(
      arrows.map((a) => [a.id, Math.round(a.x), Math.round(a.y), Math.round(a.angle)]),
    );
    if (signature !== this.signature) {
      this.signature = signature;
      const root = document.getElementById('offscreen');
      root.replaceChildren();
      for (const a of arrows) {
        const button = document.createElement('button');
        button.style.left = a.x + 'px';
        button.style.top = a.y + 'px';
        button.innerHTML = `<span style="transform:rotate(${a.angle}deg)">↑</span>Diver ${a.id + 1}`;
        button.onclick = () => selectDiver(world, a.id);
        root.append(button);
      }
    }
    this.sector.visible =
      (ui.debug || introActive(world) || diverVisual(target).surface) &&
      (!ui.realistic || ui.debug || introActive(world));
    if (this.sector.visible) {
      const spec = boatSpec(world),
        tolerance = pickupTolerance(world, ui.realistic),
        key = `${spec.width}/${spec.length}/${tolerance}`;
      if (key !== this.sectorKey) {
        this.sectorKey = key;
        const points = [new THREE.Vector3(0, 0.22, 0)];
        for (let angle = 120; angle <= 240; angle += 5) {
          const rad = (angle * Math.PI) / 180,
            dx = Math.cos(rad),
            dy = Math.sin(rad);
          let lo = 0,
            hi = 15;
          for (let i = 0; i < 12; i++) {
            const r = (lo + hi) / 2,
              d = Math.hypot(
                Math.max(0, Math.abs(dx * r) - spec.width / 2),
                Math.max(0, Math.abs(dy * r) - spec.length / 2),
              );
            if (d < tolerance) lo = r;
            else hi = r;
          }
          points.push(new THREE.Vector3(dx * lo, 0.22, dy * lo));
        }
        this.sector.geometry.dispose();
        this.sector.geometry = new THREE.BufferGeometry().setFromPoints(points);
      }
      this.sector.position.set(b.x, 0, b.y);
      this.sector.rotation.y = -b.heading;
    }
  }
}
