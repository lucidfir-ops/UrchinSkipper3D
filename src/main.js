import { FrameMetrics } from './frame-metrics.js';
import { worldTimeScale } from './time-speed.js';
import { createSessionHooks } from './career-session.js';
import { renderHud } from './hud-view.js';
import { applyMenuTheme } from './menu-theme.js';

applyMenuTheme();
import { releaseFittingPreview } from './three/fitting-preview.js';
import { renderNavigationWindows } from './minimap-view.js';
import { HudWindows } from './hud-windows.js';
import { departing, departureBoat, returnAvailable } from './departure-transition.js';
import { resetSessionView } from './session-state.js';
import { BackgroundSave } from './background-save.js';

import { neighbour, menuGeometry, menuDirections } from './menu-navigation.js';

import { MarineRenderer } from './three/renderer.js';

import { pickupTolerance } from './assists.js';

import { createCareer } from './career-state.js';

import Phaser from 'phaser';
import { careerWorld, compactSaves, loadCareer, readSnapshot, saveCareer } from './career-save.js';
import './style.css';
import './harbour.css';
import './feedback-ui.css';
import './touch.css';
import './hud-windows.css';
import './harbour-shops.css';
import './s22-ui.css';
import './layout-editor.css';
import './device-feedback.css';
import './september23-ui.css';
import './three/presentation.css';
import './interface-theme.css';
import './menu-polish.css';
import './wheelhouse.css';
import './time-advance.css';
import './ui-tokens.css';
import './ui-chartroom.css';
import './ui-console.css';
import './ui-night.css';
import { C } from './config.js';
import { CHART_ATLAS, installChartMaterial } from './chart-material.js';
import { vesselCanvas, prepareVesselArt } from './vessel-art.js';
import { preparing, prepareContent, prepareInterfaceArt } from './loading.js';
import { spawnTraffic } from './traffic.js';
import { boatSpec } from './boats.js';
import { createWorld, depthAt, currentAt, selectDiver } from './world.js';
import { step, pinActionTargets, deploymentStatus, recoveryStatus } from './simulation.js';
import { configureBoatPhysics } from './boat.js';

import { BoatAudio } from './audio.js';
import { Input } from './input.js';
import { PlaytestUI } from './playtest-ui.js';
import { diverVisual } from './presentation.js';
import { formatClock } from './day.js';

configureBoatPhysics(Phaser.Physics.Matter.Matter);
const autosave = new BackgroundSave();
let savedWorld, savedTime;
const input = new Input(),
  params = new URLSearchParams(location.search),
  practice = params.get('practice') === '1',
  prototype = practice || params.has('prototype');
let saved;
try {
  if (!prototype) {
    // Older releases stored saves uncompressed and could fill the shared quota.
    compactSaves(localStorage);
    saved = loadCareer(localStorage);
  }
} catch {
  /* Restricted storage must not prevent a new playable session. */
}
const freshCareer = () => {
  const c = createCareer(Date.now() >>> 0, { chooseStarter: true });
  c.day = 0;
  c.intro = { status: 'briefing', step: 0 };
  return careerWorld(c);
};
let world = prototype ? createWorld({ practice }) : saved?.world || freshCareer(),
  accumulator = 0,
  pending = {},
  scene,
  lastSave = 0,
  saveWarned = -Infinity;
function replaceWorld(next) {
  autosave.cancel();
  world = next;
  accumulator = 0;
  pending = {};
  resetSessionView(scene);
}
function persist() {
  autosave.cancel();
  if (!world.career) return;
  if (world.career.sandbox) return { ok: true, reason: 'Test Mode is not saved.' };
  let result;
  try {
    result = saveCareer(world, localStorage);
    if (result.ok) {
      savedWorld = world;
      savedTime = world.time;
    }
  } catch (error) {
    result = { ok: false, reason: error.message };
  }
  if (scene?.playtest)
    scene.playtest.saveNotice = result.reason || (result.ok ? 'Career saved' : 'Save unavailable');
  return result;
}
window.addEventListener('pagehide', persist);
// After saving, free GPU contexts on a real unload so a reload starts clean.
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  scene?.view?.release?.();
  releaseFittingPreview();
});
// Mobile browsers often background a tab without pagehide; save when hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist();
});

class Ocean extends Phaser.Scene {
  preload() {
    this.load.image('chart-material', CHART_ATLAS);
  }
  create() {
    prepareContent('art', 'Preparing game artwork…', async (progress) => {
      await prepareInterfaceArt();
      await prepareVesselArt(progress);
    });
    if (this.textures.exists('chart-material')) {
      installChartMaterial(this.textures.get('chart-material').getSourceImage());
      this.textures.remove('chart-material');
    }
    scene = this;
    // The headless host is hidden. Its DOM bounds are zero, so synchronize the
    // legacy camera/traffic viewport explicitly instead of measuring that host.
    const resizeSimulation = () => this.scale.resize(window.innerWidth, window.innerHeight);
    resizeSimulation();
    window.addEventListener('resize', resizeSimulation);
    this.events.once('shutdown', () => window.removeEventListener('resize', resizeSimulation));
    this.metrics = new FrameMetrics();
    this.game.events.on('postrender', () => this.metrics.finish());
    try {
      this.view = new MarineRenderer(this);
      this.view.onReload = persist;
    } catch (error) {
      document.querySelector('#startup').innerHTML =
        '<div class="title-copy"><h1>URCHIN<br>SKIPPER 3D</h1><p>3D graphics could not start. Use a browser with WebGL 2 and enable hardware acceleration, then reload.</p><button id="retryGraphics">Reload game</button></div>';
      document.querySelector('#retryGraphics').onclick = () => location.reload();
      this.graphicsFailed = true;
      console.error('Three.js startup failed', error);
      return;
    }
    this.terrain = this.view.coast;
    this.terrain.setWorld(world);
    this.audio = new BoatAudio(this);
    this.playtest = new PlaytestUI(
      input,
      this.view.canvas,
      createSessionHooks(this, {
        get world() {
          return world;
        },
        set world(value) {
          replaceWorld(value);
        },
        persist,
        prototype,
        practice,
        freshCareer,
      }),
    );
    if (saved?.recovered) this.playtest.saveNotice = 'Recovered the previous verified career save.';
    this.anchor = this.add.zone(0, 0);
    this.cameras.main.startFollow(this.anchor, true, 1, 1);
    this.cameras.main.setZoom(C.camera.initialZoom);
    this.cameras.main.setBackgroundColor('#143b44');
    this.diverButtons = world.divers.map((d) => {
      const button = document.createElement('button');
      button.onclick = () => {
        selectDiver(world, d.id);
        this.audio.play('confirm');
        this.view.canvas.focus();
      };
      document.querySelector('#divers').append(button);
      return button;
    });
  }
  update(_, delta) {
    if (this.graphicsFailed) return;
    this.metrics.begin(this.game.loop.rawDelta);
    const dt = Math.min(delta / 1000, 0.1),
      a = input.poll(dt),
      consumed = this.playtest.update(a, world, dt),
      lockReason = this.playtest.lockReason;
    this.metrics.mark('inputMs');
    const stopped = consumed || !!lockReason || preparing() || this.view.contextLost;
    const lowered = this.view.observeFrame?.(
      this.game.loop.rawDelta,
      !stopped && ['working', 'practice'].includes(world.day.phase),
    );
    if (lowered)
      this.playtest.notify(
        `3D graphics eased to ${lowered} for smoother play · Settings to change`,
      );
    if (stopped) {
      pending = {};
      accumulator = 0;
    } else {
      const targets = pinActionTargets(world, a, pickupTolerance(world, this.playtest.realistic));
      if (a.work && pending.workDiverId === undefined) pending.workDiverId = targets.workDiverId;
      if (a.recoverDiver && pending.recoverDiverId === undefined)
        pending.recoverDiverId = targets.recoverDiverId;
      if (a.recall && pending.recallDiverId === undefined)
        pending.recallDiverId = targets.recallDiverId;
      for (const action of [
        'work',
        'recoverDiver',
        'recall',
        'fullAhead',
        'fullReverse',
        'neutral',
        'centerRudder',
        'returnHarbour',
      ])
        pending[action] ||= a[action];
      accumulator +=
        dt *
        (departing(world) ? 1 : worldTimeScale()) *
        (world.career?.sandbox && !departing(world)
          ? Math.max(0.25, Math.min(4, Number(world.career.training?.timeScale) || 1))
          : 1);
      while (accumulator >= 1 / 60) {
        step(
          world,
          {
            ...pending,
            throttle: a.throttle,
            steer: a.steer,
            thruster: a.thruster,
            pivot: a.pivot,
          },
          1 / 60,
          { tolerance: pickupTolerance(world, this.playtest.realistic) },
        );
        pending = {};
        accumulator -= 1 / 60;
      }
      this.cameras.main.setZoom(
        Phaser.Math.Clamp(
          this.cameras.main.zoom + a.zoom * C.camera.zoomRate * dt,
          C.camera.minZoom,
          C.camera.maxZoom,
        ),
      );
    }
    this.metrics.mark('simulationMs');
    this.tweens.timeScale = stopped ? 0 : 1;
    this.audio.update(world, !stopped && ['working', 'practice'].includes(world.day.phase), dt);
    for (const event of world.effects.splice(0)) {
      this.view.effect(event, world);
      if (event.type === 'voyage') {
        this.view.reset();
        this.playtest.voyageUntil = performance.now() + 1100;
        const voyage = document.querySelector('#voyage');
        voyage.replaceChildren();
        const title = document.createElement('strong');
        title.textContent = event.destination;
        const detail = document.createElement('span');
        detail.textContent = `${event.minutes} minutes underway · Arriving ${formatClock(world.day.minute)}`;
        voyage.append(title, detail);
      }
      const distance = Math.hypot(
        (event.x ?? world.boat.x) - world.boat.x,
        (event.y ?? world.boat.y) - world.boat.y,
      );
      const sound = {
        recall: 'clang',
        splash: 'splash',
        surface: 'whistle',
        warning: 'warning',
        hook: 'hook',
        bag: 'bag',
        ground: 'ground',
        deadline: 'warning',
        overflow: 'warning',
        'day-end': 'confirm',
        'drive-failed': 'warning',
        'drive-hit': 'ground',
        radio: 'radio',
      }[event.type];
      if (sound) {
        const gain = ['splash', 'surface', 'warning'].includes(event.type)
          ? Math.max(0, 1 - distance / C.visibility.soundRange)
          : 1;
        if (gain > 0) this.audio.play(sound, gain);
      }
    }
    this.playtest.collectFeedback(world, stopped ? {} : a);
    this.metrics.mark('effectsMs');
    if (world.career && !this.playtest.debugAdvancing && performance.now() - lastSave > 10000) {
      lastSave = performance.now();
      if (!preparing() && (savedWorld !== world || savedTime !== world.time)) {
        const saving = world,
          time = world.time;
        try {
          autosave
            .save(saving, localStorage)
            .then((result) => {
              if (result.superseded || result.skipped || world !== saving) return;
              if (result.ok) {
                savedWorld = saving;
                savedTime = time;
              }
              this.playtest.saveNotice =
                result.reason || (result.ok ? 'Career saved' : 'Save unavailable');
              // Never let autosave fail silently at sea.
              if (!result.ok && performance.now() - saveWarned > 60000) {
                saveWarned = performance.now();
                this.playtest.notify(
                  result.storageFull
                    ? 'SAVE FAILED: browser storage is full. Pause → Logbook → Load saved day to delete old saves.'
                    : 'SAVE FAILED: ' + (result.reason || 'storage unavailable'),
                );
              }
            })
            .catch((error) => {
              this.playtest.saveNotice = 'Save unavailable: ' + error.message;
            });
        } catch (error) {
          this.playtest.saveNotice = 'Save unavailable: ' + error.message;
        }
      }
    }
    this.metrics.mark('saveMs');
    document.querySelector('#voyage').hidden = !(this.playtest.voyageUntil > performance.now());
    const b = departureBoat(world);
    document.querySelector('#departureNotice').hidden = !departing(world) || !this.playtest.started;
    world.trafficView = {
      x: b.x,
      y: b.y,
      rangeX: this.scale.width / (2 * C.pixelsPerMeter * this.cameras.main.zoom),
      rangeY: this.scale.height / (2 * C.pixelsPerMeter * this.cameras.main.zoom),
    };
    this.anchor.setPosition(b.x * C.pixelsPerMeter, b.y * C.pixelsPerMeter);
    const compactWheelhouse = input.touchEnabled && this.scale.height <= 500;
    const portraitWheelhouse = input.touchEnabled && this.scale.width < this.scale.height;
    this.cameras.main.setFollowOffset(
      0,
      compactWheelhouse
        ? (-this.scale.height * 0.1) / this.cameras.main.zoom
        : portraitWheelhouse
          ? (-this.scale.height * 0.035) / this.cameras.main.zoom
          : 0,
    );
    if (!preparing()) this.view.draw(world, this.playtest, dt);
    this.markers = this.view.markers;
    this.metrics.mark('drawMs');
    const hudKey = `${this.playtest.screen}/${this.playtest.started}/${this.playtest.realistic}/${world.selectedDiverId}/${!!lockReason}/${world.catch}/${world.divers.map((d) => d.state + d.hooking).join('/')}/${this.playtest.importantNotice?.text}`;
    if (hudKey !== this.hudKey || performance.now() >= (this.nextHud || 0)) {
      this.hudKey = hudKey;
      this.nextHud = performance.now() + 100;
      renderHud(this, world, input, lockReason);
      renderNavigationWindows(this.playtest, world);
      this.hudWindows ||= new HudWindows(this.playtest);
      this.hudWindows.update();
    }
    this.metrics.mark('hudMs');
    this.metrics.finish();
  }
}
new Phaser.Game({
  // Phaser retains its proven fixed-step support and audio manager; all visible rendering is Three.js.
  type: Phaser.HEADLESS,
  parent: 'simulation-host',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#143b44',
  scene: Ocean,
  scale: { mode: Phaser.Scale.NONE },
  render: { antialias: true },
  fps: { target: 60 },
  audio: { disableWebAudio: false },
});
window.urchinDebug = {
  get ready() {
    return !!scene?.playtest && !preparing();
  },
  get renderer() {
    return 'three-webgl';
  },
  get world() {
    return world;
  },
  config: C,
  // Verified save payload for browser fixtures (handles compressed saves).
  readSave: (raw) => readSnapshot(raw),
  vesselCanvas,
  spawnTraffic: (kind, options) => spawnTraffic(world, kind, options),
  get vesselTexture() {
    return 'three-procedural-' + world.boat.configuration;
  },
  navigation: { neighbour, menuGeometry, menuDirections },
  simulation: {
    step,
    deploymentStatus,
    recoveryStatus,
    boatSpec,
    depthAt,
    currentAt,
    returnAvailable,
  },
  get renderSamples() {
    return scene?.metrics.samples || [];
  },
  resetRenderSamples: () => {
    scene.metrics.reset();
  },
  setSurfaceRefresh: (hz) => {
    scene.view.surfaceRefreshHz = Math.max(1, Math.min(60, hz));
  },
  input,
  get zoom() {
    return scene?.cameras.main.zoom;
  },
  step: (seconds, actions = {}) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) step(world, i === 0 ? actions : {}, 1 / 60);
  },
  reset: (options = { practice }) => scene.playtest.hooks.reset(options),
  depthAt: (x, y) => depthAt(world, x, y),
  currentAt: (x, y) => currentAt(world, x, y),
  get three() {
    return scene?.view;
  },
  get terrainView() {
    return scene?.terrain;
  },
  get ui() {
    return scene?.playtest;
  },
  get audio() {
    return scene?.audio;
  },
  get visuals() {
    return {
      diver: diverVisual(world.diver),
      divers: world.divers.map(diverVisual),
      bags: scene?.markers,
      departureAlpha: scene?.view.boatArt?.alpha,
      lessonCues: scene?.view.lessonCues?.labels.map((label) => ({
        text: label.text,
        visible: label.visible,
        x: label.x,
        y: label.y,
        anchor: label.hullAnchor,
      })),
    };
  },
};
