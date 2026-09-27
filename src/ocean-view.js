import { bubbleOpacity } from './bubble-visibility.js';
import { drawHazards } from './hazard-view.js';
import { drawWaterSurface } from './water-surface.js';
import { assist, gear, pickupTolerance, visibilityRange } from './assists.js';
import { C } from './config.js';
import { boatDefinition, boatSpec } from './boats.js';
import { depthAt, selectDiver } from './world.js';
import { diverVisual, deckMarkers, interactionDiver } from './presentation.js';
import { VesselSprites } from './vessel-art.js';
import { boatFamily } from './vessel-catalog.js';
import { TrafficView } from './traffic-view.js';
import { drawWildlife } from './wildlife-view.js';
import { LessonCues } from './lesson-cues.js';
import { departureBoat } from './departure-transition.js';
import { introActive } from './career-intro.js';
import { workLightsOn } from './equipment-controls.js';
import { recoveryStatus } from './diver-recovery.js';
import { drawSeaCues } from './sea-cues.js';

export class OceanView {
  constructor(scene) {
    this.scene = scene;
    this.vessels = new VesselSprites(scene);
    this.trafficView = new TrafficView(scene, this.vessels);
    this.lessonCues = new LessonCues(scene);
    this.g = scene.add.graphics();
    this.surfaceCache = scene.game.renderer.gl ? null : new SurfaceCache(scene);
    this.surfaceGraphics = this.surfaceCache?.graphics || scene.add.graphics().setDepth(-1);
    this.deckGraphics = scene.add.graphics().setDepth(2);
    this.boatArt = null;
    this.surfaceRefreshHz = 15;
    this.wake = [];
    this.ripples = new Set();
    this.offscreenTime = [0, 0];
    this.lastTime = 0;
    this.labels = [0, 1].map(() =>
      scene.add
        .text(0, 0, '', {
          fontFamily: 'system-ui',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#f8ead1',
          backgroundColor: '#092330',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5, 1)
        .setDepth(5),
    );
    this.offscreen = document.querySelector('#offscreen');
    this.loadFlash = { value: 0 };
    this.speechGraphics = scene.add.graphics().setDepth(4);
    this.speechLabels = [0, 1].map(() =>
      scene.add
        .text(0, 0, '', {
          fontFamily: 'system-ui',
          fontSize: '13px',
          color: '#17313a',
          align: 'center',
          wordWrap: { width: 170 },
          padding: { x: 9, y: 7 },
        })
        .setOrigin(0.5, 1)
        .setDepth(5),
    );
  }
  reset() {
    this.trafficView.reset();
    this.lessonCues.hide();
    this.wake = [];
    this.offscreenTime = [0, 0];
    this.lastTime = 0;
    this.nextWake = 0;
    for (const circle of this.ripples) {
      this.scene.tweens.killTweensOf(circle);
      circle.destroy();
    }
    this.ripples.clear();
    this.scene.tweens.killTweensOf(this.loadFlash);
    this.loadFlash.value = 0;
  }
  effect(event, world) {
    const p = C.pixelsPerMeter;
    if (['surface', 'splash'].includes(event.type)) {
      const circle = this.scene.add
        .circle(event.x * p, event.y * p, 8)
        .setStrokeStyle(2, 0xdbf0e9, 0.8)
        .setDepth(1);
      this.ripples.add(circle);
      this.scene.tweens.add({
        targets: circle,
        scale: 4,
        alpha: 0,
        duration: event.type === 'surface' ? 1200 : 850,
        onComplete: () => {
          this.ripples.delete(circle);
          circle.destroy();
        },
      });
    }
    if (event.type === 'bag' && event.weight > 0) {
      this.scene.tweens.killTweensOf(this.loadFlash);
      this.loadFlash.value = 1;
      this.scene.tweens.add({ targets: this.loadFlash, value: 0, duration: 600 });
    }
    if (event.type === 'ground') this.scene.cameras.main.shake(170, 0.0012);
  }
  draw(world, ui) {
    const spec = boatSpec(world);
    this.trafficView.draw(world);
    let g = this.g;
    const p = C.pixelsPerMeter,
      b = departureBoat(world),
      t = world.time,
      camera = this.scene.cameras.main,
      zoom = camera.zoom;
    const width = this.scene.scale.width,
      height = this.scene.scale.height,
      rangeX = width / (2 * p * zoom) + 12,
      rangeY = height / (2 * p * zoom) + 12;
    g.clear();
    this.deckGraphics.clear();
    this.speechGraphics.clear();
    this.deckGraphics.setAlpha(b.alpha);
    this.lessonCues.draw(world, ui);
    const waterKey = `${Math.floor(t * this.surfaceRefreshHz)}/${zoom.toFixed(3)}/${Math.floor(b.x / 4)}/${Math.floor(b.y / 4)}/${width}/${height}/${ui.debug}/${ui.realistic}/${ui.revealUrchins}/${world.career?.assists.currentArrows}/${Math.round(world.environment.waves * 100)}/${Math.round((world.weather?.sunlight || 0) * 100)}`;
    if (this.waterWorld !== world || this.waterKey !== waterKey) {
      this.waterWorld = world;
      this.waterKey = waterKey;
      const g = this.surfaceCache
        ? this.surfaceCache.begin(
            (b.x - rangeX) * p,
            (b.y - rangeY) * p,
            rangeX * 2 * p,
            rangeY * 2 * p,
            zoom,
          )
        : this.surfaceGraphics.clear();
      this.scene.terrain.draw(g, world, ui.debug, ui.realistic, ui.revealUrchins);
      const minX = Math.max(0, Math.floor((b.x - rangeX) / 10) * 10),
        minY = Math.max(0, Math.floor((b.y - rangeY) / 10) * 10);
      drawWaterSurface(g, world, {
        p,
        t,
        zoom,
        minX,
        minY,
        maxX: Math.min(world.terrain.size, b.x + rangeX),
        maxY: Math.min(world.terrain.size, b.y + rangeY),
      });
      if (!introActive(world)) {
        g.lineStyle(2, 0xa9beb0, 0.4);
        g.strokeRect(0, 0, world.terrain.size * p, world.terrain.size * p);
      }
      if (
        world.day.phase === 'working' &&
        assist(world, 'departureGuidance', ui.realistic, ui.debug)
      ) {
        const edge = world.day.returnExit.edge,
          size = world.terrain.size,
          horizontal = edge === 'north' || edge === 'south';
        const fixed = (edge === 'north' || edge === 'west' ? 0 : size) * p;
        g.lineStyle(4 / zoom, 0xf3d28c, 0.8);
        if (horizontal) g.lineBetween(0, fixed, size * p, fixed);
        else g.lineBetween(fixed, 0, fixed, size * p);
        for (let along = 25; along < size; along += 50) {
          const x = horizontal ? along : edge === 'west' ? 3 : size - 3,
            y = horizontal ? (edge === 'north' ? 3 : size - 3) : along;
          if (depthAt(world, x, y) <= 0) continue;
          g.fillStyle(0xf3d28c, 0.85);
          g.fillCircle(x * p, y * p, 4 / zoom);
          g.lineStyle(1 / zoom, 0xf3d28c, 0.4);
          g.strokeCircle(x * p, y * p, 8 / zoom);
        }
      }
    }
    if (this.surfaceCache && this.surfaceGraphics.commandBuffer.length) this.surfaceCache.finish();
    drawHazards(g, world, { p, zoom, rangeX, rangeY });
    drawSeaCues(g, world, p);
    if (t >= (this.nextWake || 0) && Math.abs(b.speed) > 0.3) {
      this.wake.push({
        x: b.x,
        y: b.y,
        heading: b.heading,
        time: t,
        speed: Math.abs(b.speed),
        power: Math.abs(b.throttle),
      });
      this.nextWake = t + 0.09;
    }
    this.wake = this.wake.filter((point) => t - point.time < 5).slice(-65);
    for (const point of this.wake) {
      const age = t - point.time,
        spread = 1.7 + age * (0.7 + (point.power || 0)),
        s = Math.sin(point.heading),
        co = Math.cos(point.heading),
        x = point.x - s * 5,
        y = point.y + co * 5;
      const opacity = Math.min(0.55, point.speed / 20 + (point.power || 0) * 0.18) * (1 - age / 5);
      g.lineStyle(1.6, 0xd2eeeb, opacity);
      for (const side of [-1, 1])
        g.lineBetween(
          (x + side * co * spread) * p,
          (y + side * s * spread) * p,
          (x + side * co * (spread + 0.5) - s * 0.4) * p,
          (y + side * s * (spread + 0.5) + co * 0.4) * p,
        );
    }
    drawWildlife(g, world, {
      p,
      zoom,
      rangeX,
      rangeY,
      maxDistance: visibilityRange(world),
    });
    const target = interactionDiver(world, ui.realistic),
      dt = Math.max(0, Math.min(0.1, t - this.lastTime));
    this.lastTime = t;
    const arrows = [];
    for (const d of world.divers) {
      const visual = diverVisual(d),
        distance = Math.hypot(b.x - d.x, b.y - d.y),
        selected = d.id === target.id;
      const physicallyVisible = distance <= visibilityRange(world);
      if (visual.bubbles && physicallyVisible) {
        const warning = d.state === 'surfacing',
          fade = bubbleOpacity(world, distance),
          radius = warning ? 3.2 : 1;
        for (let i = 0; i < (warning ? 30 : 10); i++) {
          const angle = i * 2.4 + t * 0.2 + d.id * 0.8,
            rr = radius * (0.2 + ((i * 0.137 + t * 0.18) % 0.8));
          g.lineStyle(1.4, 0xe7ffff, fade);
          g.strokeCircle(
            (d.x + Math.cos(angle) * rr) * p,
            (d.y + Math.sin(angle) * rr) * p,
            1.7 + (i % 3),
          );
        }
      } else if (visual.surface && physicallyVisible) {
        const x = d.x * p,
          y = d.y * p,
          bob = Math.sin(t * 2.1 + d.id) * 1.5;
        g.fillStyle(0x071e28, 0.28);
        g.fillEllipse(x + 4, y + 5, 25, 10);
        g.lineStyle(1, 0xc9e8e4, 0.4);
        g.strokeEllipse(x, y + 3, 23 + Math.sin(t * 2) * 3, 12);
        g.fillStyle(0xee762d);
        g.fillEllipse(x, y + bob, 15, 11);
        g.fillStyle(0xffb66c);
        g.fillEllipse(x - 2, y - 2 + bob, 6, 3);
        g.lineStyle(2, 0xe6d8ab);
        g.lineBetween(x, y + bob, x, y - 18 + bob);
        g.fillStyle(0xf59b3e);
        g.fillTriangle(x, y - 18 + bob, x + 13, y - 15 + bob, x, y - 9 + bob);
        g.lineStyle(2, 0xfff7df);
        for (let stripe = 0; stripe <= d.id; stripe++)
          g.lineBetween(x + 3 + stripe * 4, y - 17 + bob, x + 3 + stripe * 4, y - 11 + bob);
        // Surface-only head/shoulders. There is never an underwater character sprite.
        g.fillStyle(0x0b202a);
        g.fillCircle(x + 16, y, 5);
        g.fillRoundedRect(x + 12, y + 5, 9, 10, 3);
        g.lineStyle(1, 0xb8dbd3, 0.8);
        g.strokeCircle(x + 16, y, 5);
      }
      if (assist(world, 'diverIndicators', ui.realistic, ui.debug) && selected && !visual.aboard) {
        g.lineStyle(1.5, 0xffdf9c, 0.7);
        g.strokeCircle(d.x * p, d.y * p, (visual.surface ? 2 : 2.1) * p);
      }
      const label = this.labels[d.id];
      const pickupCue =
        visual.surface && physicallyVisible && assist(world, 'actionPrompts', ui.realistic);
      const recovery = pickupCue
        ? recoveryStatus(world, pickupTolerance(world, ui.realistic), d)
        : null;
      label.setVisible(
        pickupCue || (assist(world, 'diverIndicators', ui.realistic, ui.debug) && !visual.aboard),
      );
      label.setScale(1 / zoom);
      label.setColor(pickupCue ? (recovery.available ? '#9be5c3' : '#f3cf92') : '#f8ead1');
      label.setText(
        pickupCue
          ? `${recovery.available ? '✓' : '↧'} ${d.name} · ${Math.round(distance)} m\n${d.hooking ? 'Hauling…' : recovery.available ? (d.bagHandled ? 'Bag aboard' : 'Ready to hook') : recovery.reason === 'SLOW DOWN' ? 'Match the float’s drift' : recovery.reason === 'OUT OF RANGE' ? 'Bring port alongside' : recovery.reason}`
          : `${selected ? '› ' : ''}${d.name}`,
      );
      label.setPosition(
        d.x * p + (d.id ? 18 : -18) / zoom,
        d.y * p - 30 / zoom - (d.id * 19) / zoom,
      );
      const speech = this.speechLabels[d.id],
        talking = visual.surface && physicallyVisible && distance < 28 && d.speech?.until > t;
      speech.setVisible(!!talking);
      if (talking) {
        speech.setText(`${d.speech.icon}${d.speech.text ? ' ' + d.speech.text : ''}`);
        const partner = world.divers.find(
          (other) =>
            other !== d &&
            other.state === 'surface' &&
            other.speech?.until > t &&
            Math.hypot(other.x - d.x, other.y - d.y) * p * zoom < 200,
        );
        speech
          .setScale(1 / zoom)
          .setPosition(d.x * p + (partner ? (d.id ? 100 : -100) / zoom : 0), d.y * p - 85 / zoom);
        const bounds = speech.getBounds(),
          sg = this.speechGraphics;
        sg.fillStyle(0xfff8e6, 0.96);
        sg.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 9 / zoom);
        sg.fillTriangle(
          speech.x - 5 / zoom,
          bounds.bottom - 1 / zoom,
          speech.x + 7 / zoom,
          bounds.bottom - 1 / zoom,
          speech.x + 1 / zoom,
          bounds.bottom + 9 / zoom,
        );
        sg.lineStyle(1 / zoom, 0x294b53, 0.6);
        sg.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 9 / zoom);
      }
      const sx = (d.x - b.x) * p * zoom + width / 2,
        sy = (d.y - b.y) * p * zoom + height / 2;
      const visible = sx >= 15 && sy >= 15 && sx <= width - 15 && sy <= height - 15;
      this.offscreenTime[d.id] = visible || visual.aboard ? 0 : this.offscreenTime[d.id] + dt;
      if (
        assist(world, 'offscreenArrows', ui.realistic, ui.debug) &&
        !visual.aboard &&
        this.offscreenTime[d.id] >= C.visibility.assistanceDelay
      ) {
        const dx = sx - width / 2,
          dy = sy - height / 2,
          scale = Math.min(
            (width / 2 - 75) / Math.max(1, Math.abs(dx)),
            (height / 2 - 150) / Math.max(1, Math.abs(dy)),
          );
        arrows.push({
          id: d.id,
          x: width / 2 + dx * scale,
          y: height / 2 + dy * scale,
          angle: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
        });
      }
    }
    const arrowSignature = JSON.stringify(
      arrows.map((a) => ({
        ...a,
        x: Math.round(a.x),
        y: Math.round(a.y),
        angle: Math.round(a.angle),
      })),
    );
    if (arrowSignature !== this.arrowSignature) {
      this.arrowSignature = arrowSignature;
      this.offscreen.replaceChildren();
      for (const a of arrows) {
        const button = document.createElement('button');
        button.style.left = `${a.x}px`;
        button.style.top = `${a.y}px`;
        button.innerHTML = `<span style="transform:rotate(${a.angle}deg)">↑</span>Diver ${a.id + 1}`;
        button.onclick = () => selectDiver(world, a.id);
        this.offscreen.append(button);
      }
    }
    const sin = Math.sin(b.heading),
      cos = Math.cos(b.heading);
    let pt = (x, y) => ({ x: (b.x + x * cos - y * sin) * p, y: (b.y + x * sin + y * cos) * p });
    if (
      (ui.debug || introActive(world) || diverVisual(target).surface) &&
      (!ui.realistic || ui.debug || introActive(world))
    ) {
      const tolerance = pickupTolerance(world, ui.realistic),
        key = `${spec.width}/${spec.length}/${tolerance}`;
      if (this.pickupOutlineKey !== key) {
        this.pickupOutlineKey = key;
        this.pickupOutline = [{ x: 0, y: 0 }];
        for (let angle = 120; angle <= 240; angle += 5) {
          const rad = (angle * Math.PI) / 180,
            dx = Math.cos(rad),
            dy = Math.sin(rad);
          let lo = 0,
            hi = 15;
          for (let i = 0; i < 12; i++) {
            const r = (lo + hi) / 2,
              dist = Math.hypot(
                Math.max(0, Math.abs(dx * r) - spec.width / 2),
                Math.max(0, Math.abs(dy * r) - spec.length / 2),
              );
            if (dist < tolerance) lo = r;
            else hi = r;
          }
          this.pickupOutline.push({ x: dx * lo, y: dy * lo });
        }
      }
      const points = this.pickupOutline.map(({ x, y }) => pt(x, y));
      if (!ui.realistic || ui.debug || introActive(world)) {
        g.fillStyle(0x7ad8c0, 0.07);
        g.fillPoints(points, true);
        g.lineStyle(1, 0x7ad8c0, 0.4);
        g.strokePoints(points, true);
      }
    }
    pt = (x, y) => ({
      x: (b.x + ((x * spec.width) / 4) * cos - ((y * spec.length) / 10) * sin) * p,
      y: (b.y + ((x * spec.width) / 4) * sin + ((y * spec.length) / 10) * cos) * p,
    });
    const hull = [pt(-2, 5), pt(2, 5), pt(2, -3), pt(0, -5), pt(-2, -3)];
    g.fillStyle(0x061d29, 0.35 * b.alpha);
    g.fillPoints(
      hull.map((point) => ({ x: point.x + 4, y: point.y + 5 })),
      true,
    );
    const vesselTexture = this.vessels.texture(b.configuration);
    if (!this.boatArt && vesselTexture)
      this.boatArt = this.scene.add.image(0, 0, vesselTexture).setDepth(1);
    if (this.boatArt && vesselTexture && this.boatArt.texture.key !== vesselTexture)
      this.boatArt.setTexture(vesselTexture);
    if (this.boatArt)
      this.boatArt
        .setVisible(!!vesselTexture)
        .setPosition(b.x * p, b.y * p)
        .setRotation(b.heading)
        .setAlpha(b.alpha)
        .setDisplaySize(spec.width * p, spec.length * p)
        .clearTint();
    g = this.deckGraphics;
    if (!vesselTexture) {
      g.fillStyle(boatDefinition(b.configuration).colour);
      g.fillPoints(hull, true);
      g.lineStyle(1.5, 0xa9bdb1);
      g.strokePoints(hull, true);
      g.fillStyle(0xa8875c);
      g.fillPoints([pt(-1.65, 0.3), pt(1.65, 0.3), pt(1.65, 4.6), pt(-1.65, 4.6)], true);
      g.lineStyle(1, 0xd9bf8f, 0.55);
      for (let y = 0.7; y < 4.6; y += 0.55) {
        const a = pt(-1.6, y),
          z = pt(1.6, y);
        g.lineBetween(a.x, a.y, z.x, z.y);
      }
      g.fillStyle(0x537e86);
      g.fillPoints([pt(-1.45, -2.5), pt(1.45, -2.5), pt(1.45, 0.0), pt(-1.45, 0.0)], true);
      g.fillStyle(0xdbe7d5);
      g.fillPoints([pt(-1.35, -2.55), pt(1.35, -2.55), pt(1.35, -1.7), pt(-1.35, -1.7)], true);
      g.fillStyle(0x143945);
      g.fillPoints([pt(-1.2, -1.5), pt(1.2, -1.5), pt(1.2, -0.6), pt(-1.2, -0.6)], true);
      const mastA = pt(0, -3),
        mastB = pt(0.6, -3.7);
      g.lineStyle(2, 0xecebd6);
      g.lineBetween(mastA.x, mastA.y, mastB.x, mastB.y);
      const railA = pt(-1.95, 0.8),
        railB = pt(-1.95, 4.5);
      g.lineStyle(2, 0xe5eadb);
      g.lineBetween(railA.x, railA.y, railB.x, railB.y);
    }
    if (gear(world, 'radar')) {
      const q = pt(0, -2);
      g.lineStyle(3, 0xeee9d0);
      g.lineBetween(q.x - 7, q.y, q.x + 7, q.y);
    }
    if (gear(world, 'hoist')) {
      const a = pt(-1.7, 1),
        z = pt(-2.8, 0.3);
      g.lineStyle(3, 0xaac3b2);
      g.lineBetween(a.x, a.y, z.x, z.y);
    }
    if (workLightsOn(world))
      for (const side of [-1, 1]) {
        const q = pt(side * 1.5, -1);
        g.fillStyle(0xf9e5a9, 0.9);
        g.fillCircle(q.x, q.y, 2.5);
      }
    const drive = boatDefinition(b.configuration),
      jet = drive.spec.jetCount,
      leg = ['sterndrive', 'outboard'].includes(boatFamily(drive.id));
    const part = (x1, y1, x2, y2, color) => {
      g.fillStyle(color);
      g.fillPoints([pt(x1, y1), pt(x2, y1), pt(x2, y2), pt(x1, y2)], true);
    };
    if (leg && !vesselTexture) {
      part(-0.48, 4.7, 0.48, drive.id === 'outboard' ? 5.65 : 5.4, 0x253842);
      const a = pt(-0.58, 5.6),
        z = pt(0.58, 5.6);
      g.lineStyle(2, 0x9bafad);
      g.lineBetween(a.x, a.y, z.x, z.y);
    }
    if (jet)
      for (let i = 0; i < jet; i++) {
        const x = jet === 1 ? 0 : i ? 1.1 : -1.1;
        part(x - 0.3, 4.7, x + 0.3, 5.1, 0x243c43);
      }
    if (spec.bowThrusterStrength) {
      const a = pt(-1.45, -3),
        z = pt(1.45, -3);
      g.lineStyle(1.2, 0x8ad4be, 0.8);
      g.lineBetween(a.x, a.y, z.x, z.y);
    }
    const trimA = pt(1.72, 1),
      trimB = pt(1.72, 4.2);
    g.lineStyle(1.5, parseInt(drive.accent.slice(1), 16), 0.9);
    g.lineBetween(trimA.x, trimA.y, trimB.x, trimB.y);
    // Propeller/jet/bow wash belongs to the water, including reverse wash
    // travelling underneath the hull. Deck equipment and catch stay above it.
    g = this.g;
    const powered = b.fuel > 0 && (b.driveHealth ?? 1) > 0;
    if (powered && Math.abs(b.thruster || 0) > 0.05 && spec.bowThrusterStrength) {
      for (let i = 0; i < 12; i++) {
        const age = (i * 0.13 + t * 1.8) % 1,
          side = Math.sign(b.thruster),
          bow = !!spec.bowThrusterStrength;
        const q = bow
          ? pt(-side * (2 + age * 2.8), -3 + Math.sin(i * 2) * age * 0.8)
          : pt(
              (i % 2 ? 1.1 : -1.1) + Math.sin(i) * age * 0.4,
              5 + side * (i % 2 ? 1 : -1) * age * 3,
            );
        g.lineStyle(1.1, 0xd6e9da, (1 - age) * 0.45 * Math.abs(b.thruster));
        g.strokeCircle(q.x, q.y, (0.08 + age * 0.23) * p);
      }
    }
    if (jet && powered && Math.abs(b.pivot || 0) > 0.05) {
      for (let i = 0; i < 20; i++) {
        const age = (i * 0.091 + t * 2.4) % 1,
          side = Math.sign(b.pivot),
          lane = i % 2 ? 1 : -1;
        const q =
          jet === 2
            ? pt(lane * 1.1 + Math.sin(i) * age * 0.45, 5 - side * lane * age * 4.5)
            : pt(side * age * 5, 5 + age * 0.5 + Math.sin(i) * age * 0.3);
        g.lineStyle(1.6, 0xe5f8ef, (1 - age) * 0.8 * Math.abs(b.pivot));
        g.strokeCircle(q.x, q.y, (0.08 + age * 0.28) * p);
      }
    }
    if (powered && !b.pivotGesture && Math.abs(b.throttle) > 0.05) {
      for (let i = 0; i < 14; i++) {
        const age = (i * 0.093 + t * 1.5) % 1,
          q = pt(
            Math.sin(i * 2.4) * age * (jet === 2 ? 1.1 : 0.5),
            5 + age * (1.5 + Math.abs(b.throttle) * 6) * Math.sign(b.throttle),
          );
        g.fillStyle(0xe1eee1, (1 - age) * Math.abs(b.throttle) * 0.65);
        g.fillEllipse(q.x, q.y, (0.1 + age * 0.15) * p, (0.15 + age * 0.2) * p);
      }
    }
    g = this.deckGraphics;
    if ((b.driveHealth ?? 1) < 0.9) {
      const q = pt(0, 4);
      g.lineStyle(2, 0xf0a16f, 0.7);
      g.strokeCircle(q.x, q.y, 5);
    }
    if (this.loadFlash.value > 0) {
      g.fillStyle(0xffd694, this.loadFlash.value * 0.22);
      g.fillPoints([pt(-1.7, 0.3), pt(1.7, 0.3), pt(1.7, 4.6), pt(-1.7, 4.6)], true);
    }
    const markerKey = `${b.configuration}/${world.bags.length}`;
    if (this.markerKey !== markerKey) {
      this.markers = deckMarkers(world.bags, spec);
      this.markerKey = markerKey;
    }
    for (const mark of this.markers) {
      const q = pt(mark.x, mark.y),
        r = mark.radius * p;
      g.fillStyle(0x291a19, 0.5);
      g.fillCircle(q.x + 1.5, q.y + 2, r);
      g.fillStyle(mark.layer % 2 ? 0xc93438 : 0xb5212e);
      g.fillCircle(q.x, q.y, r);
      g.lineStyle(1, 0x63151f, 0.85);
      g.strokeCircle(q.x, q.y, r);
      g.lineStyle(0.8, 0xf0887d, 0.65);
      for (const offset of [-0.45, 0, 0.45]) {
        const span = Math.sqrt(1 - offset * offset) * r * 0.85;
        g.lineBetween(q.x - span, q.y + offset * r, q.x + span, q.y + offset * r);
        g.lineBetween(q.x + offset * r, q.y - span, q.x + offset * r, q.y + span);
      }
      g.fillStyle(0xefb6a1, 0.9);
      g.fillCircle(q.x - r * 0.23, q.y - r * 0.35, 1.3);
    }
    if (world.career?.intro?.status === 'active') {
      const q = pt(0.8, -3);
      g.fillStyle(0xe1b26c);
      g.fillCircle(q.x, q.y, 4.5);
      g.fillStyle(0x49718a);
      g.fillRoundedRect(q.x - 3.5, q.y + 4, 7, 9, 2);
    }
    world.divers
      .filter((d) => d.state === 'ready')
      .forEach((d) => {
        const q = pt(d.id ? 1.3 : -1.3, -0.4);
        g.fillStyle(0x071c25);
        g.fillCircle(q.x, q.y, 4.5);
        g.fillRoundedRect(q.x - 3.5, q.y + 4, 7, 9, 2);
        g.fillStyle(d.id ? 0xebba69 : 0xb7dfce);
        g.fillRect(q.x - 3, q.y + 6, 6, 2);
      });
  }
}
import { SurfaceCache } from './surface-cache.js';
