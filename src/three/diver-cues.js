import { seaMessage } from '../sea-messages.js';
import * as THREE from 'three';
import { assist, pickupTolerance, visibilityRange } from '../assists.js';
import { diverVisual, interactionDiver } from '../presentation.js';
import { recoveryStatus } from '../diver-recovery.js';
import { selectDiver } from '../world.js';
import { boatSpec } from '../boats.js';
import { introActive } from '../career-intro.js';
import { C } from '../config.js';
import { diverMotion } from '../diver-motion.js';

// A direct translation of the original surface prompts, speech and delayed assistance.
export class DiverCues {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;
    this.outside = [0, 0];
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
    this.ring.renderOrder = 3;
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
    this.sector.renderOrder = 3;
    this.pickupWater = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0x81d6bb,
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.group.add(this.pickupWater);
    this.pickupWater.renderOrder = 2;
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
    this.ring.visible =
      indicators &&
      [
        'descending',
        'searching',
        'working',
        'ascending',
        'waiting',
        'approaching',
        'hauling',
      ].includes(diverMotion(world, target).phase);
    this.ring.position.set(target.x, 0.27, target.y);
    for (const d of world.divers) {
      const visual = diverVisual(d),
        distance = Math.hypot(d.x - b.x, d.y - b.y),
        physicallyVisible = distance <= visibilityRange(world),
        p = project(d.x, d.y),
        onScreen = p.x >= 15 && p.y >= 15 && p.x <= innerWidth - 15 && p.y <= innerHeight - 15;
      const talking =
        !hidden &&
        visual.surface &&
        physicallyVisible &&
        distance < 28 &&
        d.speech?.until > world.time;
      if (talking)
        seaMessage(
          ui,
          `diver-${d.id}`,
          `${d.speech.until}:${d.speech.text}`,
          `${d.name} · ${d.speech.icon}${d.speech.text ? ' ' + d.speech.text : ''}`,
        );

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
    const prompts = assist(world, 'actionPrompts', ui.realistic),
      nearby = world.divers.find(
        (d) =>
          Math.hypot(d.x - b.x, d.y - b.y) < Math.min(32, visibilityRange(world)) &&
          (d.state === 'surface' || (indicators && d.state === 'surfacing')),
      );
    this.sector.visible = !hidden && (ui.debug || ((prompts || introActive(world)) && !!nearby));
    this.pickupWater.visible = this.sector.visible;
    if (this.sector.visible) {
      const spec = boatSpec(world),
        tolerance = pickupTolerance(world, ui.realistic),
        key = `${spec.width}/${spec.length}/${tolerance}`;
      if (key !== this.sectorKey) {
        this.sectorKey = key;
        const points = [],
          inner = [],
          vertices = [],
          indices = [];
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
          const edge = Math.min(
            spec.width / (2 * Math.max(0.0001, Math.abs(dx))),
            spec.length / (2 * Math.max(0.0001, Math.abs(dy))),
          );
          inner.push(new THREE.Vector3(dx * edge, 0.22, dy * edge));
          vertices.push(dx * lo, 0.19, dy * lo, dx * edge, 0.19, dy * edge);
          const i = points.length - 1;
          if (i)
            indices.push((i - 1) * 2, i * 2, i * 2 + 1, (i - 1) * 2, i * 2 + 1, (i - 1) * 2 + 1);
        }
        this.sector.geometry.dispose();
        this.sector.geometry = new THREE.BufferGeometry().setFromPoints([
          ...points,
          ...inner.reverse(),
        ]);
        this.pickupWater.geometry.dispose();
        this.pickupWater.geometry = new THREE.BufferGeometry();
        this.pickupWater.geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(vertices, 3),
        );
        this.pickupWater.geometry.setIndex(indices);
      }
      const status = nearby?.state === 'surface' ? recoveryStatus(world, tolerance, nearby) : null,
        ready = status?.available,
        color = ready ? 0x91e4b5 : 0x9fc7b7;
      this.sector.material.color.setHex(color);
      this.pickupWater.material.color.setHex(color);
      this.pickupWater.material.opacity = ready ? 0.085 : 0.04;
      this.sector.position.set(b.x, 0, b.y);
      this.sector.rotation.y = -b.heading;
      this.pickupWater.position.copy(this.sector.position);
      this.pickupWater.rotation.copy(this.sector.rotation);
    }
  }
}
