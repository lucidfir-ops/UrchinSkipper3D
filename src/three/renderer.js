import { updateWorkLightWater } from './work-light-water.js';
import { CurrentField } from './current-field.js';
import { SurfaceDrift } from './surface-drift.js';
import { updateSeaMessages } from '../sea-messages.js';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CoastalWorld } from './world.js';
import { VesselView } from './vessels.js';
import { C } from '../config.js';
import { boatSpec } from '../boats.js';
import { departureBoat } from '../departure-transition.js';
import { lightningState } from '../weather-effects.js';
import { assist } from '../assists.js';
import { createWorld } from '../world.js';
import { NavigationOverlay } from './navigation.js';
import { DiverCues } from './diver-cues.js';
import { coastalDaylight } from './water-optics.js';

// Presentation is one-way: this module never mutates simulation positions, terrain or weather.
export class MarineRenderer {
  constructor(host) {
    this.host = host;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#53868c');
    this.scene.fog = new THREE.FogExp2('#94aeb2', 0.0007);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.id = 'ocean3d';
    this.canvas.setAttribute(
      'aria-label',
      'Three dimensional ocean. W/S throttle, A/D rudder; 1 deploy or board, 2 haul bag, 3 recall.',
    );
    document.querySelector('#game').append(this.canvas);
    this.camera = new THREE.OrthographicCamera(-60, 60, 40, -40, 0.1, 2400);
    this.target = new THREE.Vector3();
    this.sun = new THREE.DirectionalLight('#ffedce', 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -85,
      right: 85,
      top: 85,
      bottom: -85,
      near: 1,
      far: 350,
    });
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.065;
    this.scene.add(this.sun, this.sun.target);
    this.skyLight = new THREE.HemisphereLight('#c5e8ef', '#243f39', 1.5);
    this.scene.add(this.skyLight);
    this.prepareEnvironment();
    this.coast = new CoastalWorld(this.scene);
    this.navigation = new NavigationOverlay(this.scene);
    this.diverCues = new DiverCues(this.scene, this.navigation.layer);
    this.titleWorld = createWorld({ practice: true });
    Object.assign(this.titleWorld.boat, { x: 185, y: 155, heading: -0.5 });
    this.titleWorld.day.minute = 580;
    this.vessels = new VesselView(this.scene);
    this.markers = [];
    this.lessonCues = { labels: this.navigation.lessonLabels };
    this.currentArrows = new CurrentField();
    this.scene.add(this.currentArrows);
    this.surfaceDrift = new SurfaceDrift();
    this.scene.add(this.surfaceDrift);
    this.rain = this.makeRain();
    this.resize = () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.renderer.setSize(this.width, this.height);
    };
    window.addEventListener('resize', this.resize);
    this.resize();
    try {
      this.quality = localStorage.getItem('urchin3d-graphics-v1') || 'High';
    } catch {
      this.quality = 'High';
    }
    this.applyQuality();
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      let message = document.getElementById('rendererNotice');
      if (!message) {
        message = document.createElement('div');
        message.id = 'rendererNotice';
        message.setAttribute('role', 'alert');
        document.body.append(message);
      }
      message.textContent =
        'The graphics device was interrupted. Your game is paused while it reconnects.';
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      document.getElementById('rendererNotice')?.remove();
    });
  }
  get graphicsLabel() {
    return this.quality;
  }
  cycleGraphics() {
    const modes = ['High', 'Balanced', 'Battery'];
    this.quality = modes[(modes.indexOf(this.quality) + 1) % modes.length];
    try {
      localStorage.setItem('urchin3d-graphics-v1', this.quality);
    } catch {
      /* Live quality remains usable without storage. */
    }
    this.applyQuality();
    return this.quality;
  }
  applyQuality() {
    const settings = { High: [1.6, 2048], Balanced: [1, 1024], Battery: [0.75, 512] }[
      this.quality
    ] || [1.6, 2048];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings[0]));
    this.sun.shadow.mapSize.set(settings[1], settings[1]);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }
  prepareEnvironment() {
    const sky = new Sky();
    sky.scale.setScalar(1000);
    const u = sky.material.uniforms;
    u.turbidity.value = 3;
    u.rayleigh.value = 1.2;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.set(-0.6, 0.85, -0.35).normalize();
    const environment = new THREE.Scene();
    environment.add(sky);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(environment, 0.04, 0.1, 2000);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.55;
    sky.geometry.dispose();
    sky.material.dispose();
    pmrem.dispose();
  }
  makeRain() {
    const array = new Float32Array(900 * 6);
    for (let i = 0; i < 900; i++) {
      const x = ((Math.sin(i * 72.3) * 43758.5) % 1) * 80,
        z = ((Math.sin(i * 31.7) * 9371.2) % 1) * 80,
        y = ((i * 0.371) % 1) * 40;
      array.set([x, y, z, x - 0.13, y - 1.6, z + 0.08], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(array, 3));
    const mesh = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xcee6e9,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    this.scene.add(mesh);
    return mesh;
  }
  project(x, y, height = 0.5) {
    const p = new THREE.Vector3(x, height, y).project(this.camera);
    return { x: ((p.x + 1) * this.width) / 2, y: ((1 - p.y) * this.height) / 2 };
  }
  boatScreenPose(world) {
    const b = departureBoat(world),
      spec = boatSpec(world),
      centre = this.project(b.x, b.y, 0),
      forward = this.project(
        b.x + (Math.sin(b.heading) * spec.length) / 2,
        b.y - (Math.cos(b.heading) * spec.length) / 2,
        0,
      ),
      side = this.project(
        b.x + (Math.cos(b.heading) * spec.width) / 2,
        b.y + (Math.sin(b.heading) * spec.width) / 2,
        0,
      );
    return {
      ...centre,
      width: 2 * Math.hypot(side.x - centre.x, side.y - centre.y),
      length: 2 * Math.hypot(forward.x - centre.x, forward.y - centre.y),
      heading: Math.atan2(forward.x - centre.x, centre.y - forward.y),
    };
  }
  reset() {
    this.vessels.reset();
    this.diverCues.reset();
    this.markers = [];
  }
  effect(event, world) {
    this.vessels.effect?.(event, world);
  }
  draw(world, ui, dt) {
    if (this.contextLost) return;
    const title = !ui.started;
    if (title) world = this.titleWorld;
    this.coast.setWorld(world);
    const b = departureBoat(world);
    const zoom = this.host.cameras.main.zoom;
    const viewHeight = this.height / (C.pixelsPerMeter * zoom);
    const span = title ? 38 : viewHeight;
    this.camera.left = (-span * this.width) / this.height / 2;
    this.camera.right = -this.camera.left;
    this.camera.top = span / 2;
    this.camera.bottom = -span / 2;
    // Fixed orthographic, north-up bird's-eye view. No pan/orbit control changes helm or geography.
    this.target.set(b.x, 0, b.y);
    if (title) {
      this.target.x -= ((span * this.width) / this.height) * 0.18;
      this.target.z -= 5;
    } else {
      // Tutorial and career share the same working viewport framing.
      // Phaser follows target minus offset; Three's tilted orthographic view
      // foreshortens the sea-level Z axis, which we account for here.
      const offset = this.host.cameras.main.followOffset;
      const groundVerticalScale = 240 / Math.hypot(240, 105);
      this.target.x -= (offset?.x || 0) / C.pixelsPerMeter;
      this.target.z -= (offset?.y || 0) / (C.pixelsPerMeter * groundVerticalScale);
    }
    this.camera.position
      .copy(this.target)
      .add(title ? new THREE.Vector3(0, 160, 210) : new THREE.Vector3(0, 240, 105));
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    const minute = world.day.minute ?? 600;
    const day = coastalDaylight(minute);
    const cloud = Math.min(
      0.65,
      (world.weather?.rain || 0) * 0.4 + (world.weather?.kind === 'fog' ? 0.2 : 0),
    );
    const lightning = lightningState(world.weather, world.time).flash;
    this.sun.intensity = (0.35 + day * 2.8) * (1 - cloud) + lightning * 3;
    this.skyLight.intensity = 0.34 + day * 1.05 + lightning;
    this.scene.environmentIntensity = 0.15 + day * 0.4;
    this.sun.color.set(day < 0.4 ? '#ffa97a' : '#ffecd2');
    this.sun.position.set(b.x - 65, 110, b.y - 45);
    this.sun.target.position.set(b.x, 0, b.y);
    this.scene.fog.density = 0.0007;
    this.scene.fog.color.set(day < 0.12 ? '#102333' : '#9bafb0');
    this.renderer.toneMappingExposure = 0.87 + day * 0.19;
    this.coast.setVisibility?.(world, ui);
    this.coast.update(world, dt, this.camera);
    this.vessels.update(world, dt);
    if (this.coast.water)
      updateWorkLightWater(this.coast.water.material.uniforms, this.vessels.workSpots);
    this.markers = this.vessels.markers || [];
    this.navigation.update(world, ui, title, (x, y) => this.project(x, y));
    this.diverCues.update(world, ui, title, (x, y) => this.project(x, y));
    this.currentArrows.visible = !title && assist(world, 'currentArrows', ui.realistic, ui.debug);
    this.currentArrows.update(world, ((span * this.width) / this.height) * 1.12, span * 1.3);
    this.surfaceDrift.update(world, ((span * this.width) / this.height) * 1.12, span * 1.3);
    this.rain.visible = (world.weather?.rain || 0) > 0.06;
    this.rain.position.set(b.x, 8 - ((world.time * 19) % 8), b.y);
    this.rain.material.opacity = Math.min(0.4, (world.weather?.rain || 0) * 0.35);
    updateSeaMessages(ui);
    this.renderer.render(this.scene, this.camera);
    document.body.classList.toggle('three-title', title);
    document.body.classList.toggle('three-at-sea', ui.started && !ui.screen);
  }
}
