import * as THREE from 'three';
import { assist, pickupTolerance, visibilityRange } from '../assists.js';
import { diverVisual, interactionDiver } from '../presentation.js';
import { recoveryStatus } from '../diver-recovery.js';
import { selectDiver } from '../world.js';
import { boatSpec } from '../boats.js';
import { introActive } from '../career-intro.js';
import { C } from '../config.js';
import { placeSpeech } from './cue-placement.js';
import { diverMotion, portRecoveryPoint } from '../diver-motion.js';

// A direct translation of the original surface prompts, speech and delayed assistance.
export class DiverCues {
  constructor(scene, layer) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;
    this.outside = [0, 0];
    this.hudObstacles = [];
    this.nextObstacleRead = 0;
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
      return { label, speech, leader, nextSpeechLayout: 0, nextLabelLayout: 0 };
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
    this.pickupLabel = document.createElement('div');
    this.pickupLabel.dataset.diverPickup = '';
    this.pickupLabel.style.cssText =
      'position:absolute;transform:translate(-100%,-50%);pointer-events:none;padding:5px 8px;border-left:2px solid #90dcb9;border-radius:3px;background:#102d2bdc;color:#c5f2dc;font:600 10px/1.45 system-ui;letter-spacing:.035em;white-space:pre;text-align:right';
    layer.append(this.pickupLabel);
  }
  reset() {
    this.time = 0;
    this.outside = [0, 0];
    this.hudObstacles = [];
    this.nextObstacleRead = 0;
    for (const entry of this.labels) {
      entry.speechBox = null;
      entry.nextSpeechLayout = 0;
      entry.labelBox = null;
      entry.nextLabelLayout = 0;
    }
  }
  update(world, ui, title, project) {
    const b = world.boat,
      target = interactionDiver(world, ui.realistic),
      dt = Math.max(0, Math.min(0.1, world.time - this.time));
    this.time = world.time;
    const hidden = title || !!ui.screen,
      indicators = assist(world, 'diverIndicators', ui.realistic, ui.debug),
      arrows = [],
      labelBoxes = [],
      now = performance.now();
    const hudObstacles = () => {
      if (now >= this.nextObstacleRead) {
        this.hudObstacles = [
          ...document.querySelectorAll(
            '[data-hud-window], #keyboardHelm, #touchControls, #touchMenu, #touchHudToggle, #touchLockToggle',
          ),
        ]
          .slice(0, 32)
          .flatMap((panel) => {
            const style = getComputedStyle(panel),
              box = panel.getBoundingClientRect();
            return !panel.hidden &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              Number(style.opacity) > 0.25 &&
              box.width > 0 &&
              box.height > 0
              ? [{ left: box.left, right: box.right, top: box.top, bottom: box.bottom }]
              : [];
          });
        this.nextObstacleRead = now + 100;
      }
      return this.hudObstacles;
    };
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
        motion = diverMotion(world, d),
        distance = Math.hypot(d.x - b.x, d.y - b.y),
        physicallyVisible = distance <= visibilityRange(world),
        p = project(d.x, d.y),
        onScreen = p.x >= 15 && p.y >= 15 && p.x <= innerWidth - 15 && p.y <= innerHeight - 15,
        entry = this.labels[d.id],
        { label, speech, leader } = entry;
      const pickup =
        visual.surface && physicallyVisible && assist(world, 'actionPrompts', ui.realistic);
      label.hidden =
        hidden ||
        !onScreen ||
        (!pickup && (!indicators || visual.aboard)) ||
        (pickup && d.id === target.id && contextSuppliesTarget);
      if (!label.hidden) {
        const status = pickup
          ? recoveryStatus(world, pickupTolerance(world, ui.realistic), d)
          : null;
        const phases = {
          preparing: 'Checking kit',
          entering: 'Entering water',
          descending: 'Descending',
          searching: 'Searching',
          working: 'Picking',
          ascending: 'Ascending',
        };
        const text = pickup
          ? `${status.available ? '✓' : '↧'} ${d.name} · ${Math.round(distance)} m\n${d.hooking ? (motion.phase === 'boarding' ? 'Climbing aboard…' : motion.phase === 'approaching' ? 'Swimming to ladder…' : 'Hauling…') : status.available ? (d.bagHandled ? 'Bag aboard' : 'Ready to hook') : status.reason === 'SLOW DOWN' ? 'Match the float’s drift' : status.reason === 'OUT OF RANGE' ? 'Bring the left side alongside' : status.reason}`
          : `${d.id === target.id ? '› ' : ''}${d.name}${phases[motion.phase] ? ` · ${phases[motion.phase]}` : ''}`;
        const changed = label.textContent !== text;
        if (changed) label.textContent = text;
        label.style.color = status?.available ? '#a0edcc' : '#f3d499';
        const overlaps = (box, obstacle) =>
          box &&
          box.left < obstacle.right &&
          box.left + box.width > obstacle.left &&
          box.top < obstacle.bottom &&
          box.top + box.height > obstacle.top;
        if (
          changed ||
          !entry.labelBox ||
          now >= entry.nextLabelLayout ||
          labelBoxes.some((box) => overlaps(entry.labelBox, box))
        ) {
          const size = { width: label.offsetWidth, height: label.offsetHeight };
          entry.labelBox = placeSpeech(
            p,
            size,
            { width: innerWidth, height: innerHeight },
            [...hudObstacles(), ...labelBoxes],
            {
              left: p.x + (d.id ? 20 : -20) - size.width / 2,
              top: p.y - 26 - d.id * 17 - size.height,
            },
          );
          entry.nextLabelLayout = now + 100;
        }
        const box = entry.labelBox;
        label.style.left = box.left + box.width / 2 + 'px';
        label.style.top = box.top + box.height + 'px';
        label.hidden = [...hudObstacles(), ...labelBoxes].some((obstacle) =>
          overlaps(box, obstacle),
        );
        if (!label.hidden)
          labelBoxes.push({
            left: box.left,
            top: box.top,
            right: box.left + box.width,
            bottom: box.top + box.height,
          });
      } else entry.labelBox = null;
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
          const obstacles = [...hudObstacles(), ...labelBoxes];
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
    this.pickupLabel.hidden = !this.sector.visible;
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
        color = ready ? 0x91e4b5 : 0x9fc7b7,
        point = portRecoveryPoint(world, 1.05),
        p = project(point.x, point.y);
      this.sector.material.color.setHex(color);
      this.pickupWater.material.color.setHex(color);
      this.pickupWater.material.opacity = ready ? 0.085 : 0.04;
      this.pickupLabel.textContent = `PORT LADDER · LEFT SIDE\n${ready ? (nearby.hooking ? 'Hold this drift · recovery in progress' : 'Alongside · ready to recover') : status?.reason === 'SLOW DOWN' ? 'Neutral · match the float’s drift' : 'Bring the float alongside here'}`;
      this.pickupLabel.style.left = p.x - 18 + 'px';
      this.pickupLabel.style.top = p.y + 23 + 'px';
      const labelBox = this.pickupLabel.getBoundingClientRect();
      // Compact touch places the live recovery card beside the rail. That card
      // already names the port ladder: keep its text clear instead of stacking
      // a duplicate callout over its duration, refusal or urgent information.
      this.pickupLabel.hidden =
        !!contextBox &&
        !context.hidden &&
        contextStyle?.visibility === 'visible' &&
        Number(contextStyle.opacity) > 0.5 &&
        labelBox.left < contextBox.right + 4 &&
        labelBox.right > contextBox.left - 4 &&
        labelBox.top < contextBox.bottom + 4 &&
        labelBox.bottom > contextBox.top - 4;
      this.sector.position.set(b.x, 0, b.y);
      this.sector.rotation.y = -b.heading;
      this.pickupWater.position.copy(this.sector.position);
      this.pickupWater.rotation.copy(this.sector.rotation);
    }
  }
}
