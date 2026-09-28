import * as THREE from 'three';
import { assist, pickupTolerance, visibilityRange } from '../assists.js';
import { diverVisual, interactionDiver } from '../presentation.js';
import { recoveryStatus } from '../diver-recovery.js';
import { selectDiver } from '../world.js';
import { boatSpec } from '../boats.js';
import { introActive } from '../career-intro.js';
import { C } from '../config.js';
import { placeSpeech } from './cue-placement.js';

// A direct translation of the original surface prompts, speech and delayed assistance.
export class DiverCues {
  constructor(scene, layer) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;
    this.outside = [0, 0];
    this.labels = [0, 1].map(() => {
      const label = document.createElement('div'),
        speech = document.createElement('div'),
        leader = document.createElement('div');
      label.style.cssText =
        'position:absolute;transform:translate(-50%,-100%);white-space:pre;text-align:center;padding:5px 7px;border-radius:4px;background:#102e3be8;color:#eed4a4;font:11px/1.4 system-ui';
      speech.style.cssText =
        'position:absolute;transform:translate(-50%,-100%);padding:7px 9px;border-radius:8px;width:max-content;max-width:210px;text-align:center;background:#fff5df;color:#19383d;box-shadow:0 3px 12px #00151a44;font:12px/1.4 system-ui';
      leader.style.cssText =
        'position:absolute;height:1px;transform-origin:0 50%;background:#fff5dfaa;pointer-events:none';
      layer.append(leader, label, speech);
      return { label, speech, leader, nextSpeechLayout: 0 };
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
    for (const entry of this.labels) {
      entry.speechBox = null;
      entry.nextSpeechLayout = 0;
    }
  }
  update(world, ui, title, project) {
    const b = world.boat,
      target = interactionDiver(world, ui.realistic),
      dt = Math.max(0, Math.min(0.1, world.time - this.time));
    this.time = world.time;
    const hidden = title || !!ui.screen,
      indicators = assist(world, 'diverIndicators', ui.realistic, ui.debug),
      arrows = [];
    const context = ui.hudMessageActive && !hidden ? document.getElementById('message') : null,
      contextStyle = context && getComputedStyle(context),
      contextBox = context?.getBoundingClientRect(),
      contextHit =
        contextBox && document.elementFromPoint(contextBox.left + 12, contextBox.top + 12),
      contextSuppliesTarget =
        ui.hudMessageActive &&
        !context?.hidden &&
        context?.hasAttribute('data-default-position') &&
        contextBox?.height > 0 &&
        contextStyle?.visibility === 'visible' &&
        Number(contextStyle.opacity) >= 0.9 &&
        !!contextHit &&
        (contextHit === context || context.contains(contextHit));
    this.group.visible = !hidden;
    this.ring.visible = indicators && !diverVisual(target).aboard;
    this.ring.position.set(target.x, 0.27, target.y);
    for (const d of world.divers) {
      const visual = diverVisual(d),
        distance = Math.hypot(d.x - b.x, d.y - b.y),
        physicallyVisible = distance <= visibilityRange(world),
        p = project(d.x, d.y),
        entry = this.labels[d.id],
        { label, speech, leader } = entry;
      const pickup =
        visual.surface && physicallyVisible && assist(world, 'actionPrompts', ui.realistic);
      label.hidden =
        hidden ||
        (!pickup && (!indicators || visual.aboard)) ||
        (pickup && d.id === target.id && contextSuppliesTarget);
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
      leader.hidden = !talking;
      if (talking) {
        const text = `${d.speech.icon}${d.speech.text ? ' ' + d.speech.text : ''}`,
          changed = speech.textContent !== text;
        if (changed) speech.textContent = text;
        const partner = world.divers.some(
          (o) =>
            o !== d &&
            o.state === 'surface' &&
            o.speech?.until > world.time &&
            Math.hypot(o.x - d.x, o.y - d.y) < 14,
        );
        if (changed || !entry.speechBox || world.time >= entry.nextSpeechLayout) {
          const obstacles = [
            ...document.querySelectorAll(
              '[data-hud-window], #keyboardHelm, #touchControls, #touchMenu, #touchHudToggle, #touchLockToggle',
            ),
          ].flatMap((panel) => {
            const style = getComputedStyle(panel),
              box = panel.getBoundingClientRect();
            return !panel.hidden &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              Number(style.opacity) > 0.25 &&
              box.width > 0 &&
              box.height > 0
              ? [box]
              : [];
          });
          const spec = boatSpec(world),
            corners = [-1, 1].flatMap((sx) =>
              [-1, 1].map((sy) => {
                const x = (sx * spec.width) / 2,
                  y = (sy * spec.length) / 2;
                return project(
                  b.x + x * Math.cos(b.heading) - y * Math.sin(b.heading),
                  b.y + x * Math.sin(b.heading) + y * Math.cos(b.heading),
                );
              }),
            );
          obstacles.push({
            left: Math.min(...corners.map((corner) => corner.x)) - 12,
            right: Math.max(...corners.map((corner) => corner.x)) + 12,
            top: Math.min(...corners.map((corner) => corner.y)) - 12,
            bottom: Math.max(...corners.map((corner) => corner.y)) + 12,
          });
          for (const diver of world.divers) {
            if (
              !diverVisual(diver).surface ||
              Math.hypot(diver.x - b.x, diver.y - b.y) > visibilityRange(world)
            )
              continue;
            const float = project(diver.x, diver.y);
            obstacles.push({
              left: float.x - 12,
              right: float.x + 12,
              top: float.y - 12,
              bottom: float.y + 12,
            });
          }
          const size = { width: speech.offsetWidth, height: speech.offsetHeight };
          entry.speechBox = placeSpeech(
            p,
            size,
            { width: innerWidth, height: innerHeight },
            obstacles,
            {
              left: p.x + (partner ? (d.id ? 90 : -90) : 0) - size.width / 2,
              top: p.y - 76 - size.height,
            },
          );
          entry.nextSpeechLayout = world.time + 0.1;
          speech.style.left = entry.speechBox.left + size.width / 2 + 'px';
          speech.style.top = entry.speechBox.top + size.height + 'px';
        }
        const box = entry.speechBox,
          x = Math.max(box.left, Math.min(box.left + box.width, p.x)),
          y = Math.max(box.top, Math.min(box.top + box.height, p.y)),
          dx = p.x - x,
          dy = p.y - y;
        leader.hidden = Math.hypot(dx, dy) < 12;
        leader.style.left = x + 'px';
        leader.style.top = y + 'px';
        leader.style.width = Math.hypot(dx, dy) + 'px';
        leader.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
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
