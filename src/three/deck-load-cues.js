import * as THREE from 'three';
import { C } from '../config.js';
import { deckMarkers } from '../presentation.js';
import { openDeckSpan } from './catch-load.js';

// October 5 (feedback/10-5): deck load read from the boat itself. A faint
// ghost outline marks where the rest of a full load would sit and pulses when
// a sack lands, a small roof lamp lights when the deck is full, and the hull
// settles lower as weight builds. Presentation only: nothing here writes the
// simulation, and the deck load card remains an optional instrument.
export const LOAD_CUES = {
  fullSquat: 0.45, // metres lower at full capacity
  fullTrim: 0.022, // radians stern-down at full capacity (sacks stow aft)
  fullBobDamping: 0.45, // a laden hull rides the swell more heavily
  fullWake: 0.35, // wider wake and wash at full capacity
  damageSquat: 0.22, // extra settling at zero hull condition
  damageList: 0.12, // radians of list at zero hull condition
  damageThreshold: 0.65, // matches the oil sheen cue
  pulseSeconds: 1.4,
  settleRate: 1.6, // per second, eased toward the target freeboard
};

// Sacks still to come are counted as full bags of the remaining weight, so the
// outline shrinks with each landed sack and vanishes exactly at capacity.
export function deckLoadState(world, spec) {
  const capacity = Math.max(1, spec.capacity || 1),
    weight = Math.max(0, world.catch || 0),
    bags = world.bags?.length || 0,
    remaining = Math.max(0, capacity - weight),
    full = remaining < 0.5,
    bagSize = C.diver?.bagSize || 300,
    fill = Math.min(1, weight / capacity),
    hull = world.boat?.hullHealth ?? 1,
    damage = Math.max(0, (LOAD_CUES.damageThreshold - hull) / LOAD_CUES.damageThreshold);
  return {
    bags,
    slots: full ? bags : bags + Math.ceil(remaining / bagSize),
    full,
    fill,
    squat: fill * LOAD_CUES.fullSquat + damage * LOAD_CUES.damageSquat,
    trim: fill * LOAD_CUES.fullTrim,
    list: damage * LOAD_CUES.damageList,
    wake: 1 + fill * LOAD_CUES.fullWake,
  };
}

export class DeckLoadCues {
  constructor(vessel, sackGeometry) {
    this.vessel = vessel;
    this.group = new THREE.Group();
    this.group.name = 'Deck load cues';
    this.group.userData.dynamic = true;
    vessel.add(this.group);
    this.ghostMaterial = ghostOutlineMaterial();
    this.sackGeometry = sackGeometry;
    this.capacity = 0;
    this.grow(32);
    this.transform = new THREE.Object3D();
    this.key = '';
    this.pulse = 0;
    this.lastBags = null;
    this.squat = null;
    this.trim = 0;
    this.list = 0;
    this.fill = 0;
    const { cabinTop, cabinZ, cabinLength, cabinWidth } = vessel.userData.stations;
    this.lampOff = new THREE.MeshStandardMaterial({
      color: '#5a3d12',
      roughness: 0.35,
      metalness: 0.1,
    });
    this.lampOn = new THREE.MeshBasicMaterial({ color: '#ffc23a' });
    this.lamp = new THREE.Group();
    this.lamp.name = 'Deck full lamp';
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.08, 14),
      new THREE.MeshStandardMaterial({ color: '#1d2125', roughness: 0.6 }),
    );
    base.position.y = 0.04;
    this.lens = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), this.lampOff);
    this.lens.position.y = 0.13;
    this.lens.scale.y = 0.85;
    // A soft halo keeps the small lamp readable at working zoom and in daylight.
    this.halo = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 28),
      new THREE.MeshBasicMaterial({
        color: '#ffc23a',
        map: haloTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.16;
    this.halo.renderOrder = 4;
    this.lamp.add(base, this.lens, this.halo);
    this.lamp.position.set(
      (cabinWidth || 1.6) * 0.32,
      cabinTop + 0.02,
      cabinZ + cabinLength / 2 - 0.22,
    );
    this.group.add(this.lamp);
    this.flash = new THREE.Mesh(
      sackGeometry,
      new THREE.MeshBasicMaterial({
        color: '#ffe27a',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.flash.name = 'Landed sack flash';
    this.flash.renderOrder = 4;
    this.flash.visible = false;
    this.group.add(this.flash);
  }
  grow(capacity) {
    this.ghosts?.removeFromParent();
    this.ghosts?.geometry.dispose();
    this.ghosts?.dispose();
    this.capacity = capacity;
    this.ghosts = new THREE.InstancedMesh(this.sackGeometry, this.ghostMaterial, capacity);
    this.ghosts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ghosts.frustumCulled = false;
    this.ghosts.count = 0;
    this.ghosts.renderOrder = 3;
    this.fades = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.fades.setUsage(THREE.DynamicDrawUsage);
    this.ghosts.geometry = this.sackGeometry.clone();
    this.ghosts.geometry.setAttribute('aFade', this.fades);
    this.group.add(this.ghosts);
  }
  layout(state, spec) {
    const area = openDeckSpan(spec, this.vessel.userData.stations),
      key = `${state.bags}:${state.slots}:${spec.width}:${spec.length}:${area?.fore}:${area?.aft}`;
    if (key === this.key) return;
    this.key = key;
    if (state.slots > this.capacity) this.grow(2 ** Math.ceil(Math.log2(state.slots)));
    // The same marker layout as the real sacks, so each ghost is exactly where
    // a future sack will land.
    const markers = deckMarkers(Array.from({ length: state.slots }), spec, area).slice(state.bags);
    this.ghosts.count = markers.length;
    // The layer being filled reads first; later layers recede.
    const firstLayer = markers[0]?.layer ?? 0;
    markers.forEach((mark, i) => {
      this.fades.setX(i, [1, 0.22, 0.07][Math.min(2, mark.layer - firstLayer)]);
      const x = (mark.x * spec.width) / 4,
        z = (mark.y * spec.length) / 10,
        y = 0.88 + mark.radius * 0.64 + mark.layer * 0.67;
      this.transform.position.set(x, y, z);
      this.transform.rotation.set(0, ((state.bags + i) * 2.399) % (Math.PI * 2), 0);
      // Smaller than a sack so neighbouring rings stay separate and legible.
      this.transform.scale.set(mark.radius * 0.66, mark.radius * 0.42, mark.radius * 0.66);
      this.transform.updateMatrix();
      this.ghosts.setMatrixAt(i, this.transform.matrix);
    });
    this.ghosts.instanceMatrix.needsUpdate = true;
    this.fades.needsUpdate = true;
  }
  update(world, spec, dt, alpha = 1) {
    const state = deckLoadState(world, spec);
    if (this.lastBags !== null && state.bags > this.lastBags) this.pulse = 1;
    this.lastBags = state.bags;
    this.pulse = Math.max(0, this.pulse - dt / LOAD_CUES.pulseSeconds);
    this.layout(state, spec);
    const light = world.weather?.sunlight ?? 1,
      flash = this.pulse * this.pulse;
    // Dimmer at night so the outline never reads as a light source.
    const ghost = this.ghostMaterial.uniforms;
    ghost.uOpacity.value = (0.35 + 0.25 * light) * (1 + flash * 1.6) * alpha;
    ghost.uFill.value = 0.04 + flash * 0.06;
    // Cool white, distinct from the beige coiled rope on deck.
    ghost.uColor.value.set(flash > 0.02 ? '#fff6c4' : '#d6f3f6');
    // Only the sack that just landed flashes.
    const newest = this.vessel.userData.catchLoad?.markers?.at(-1);
    this.flash.visible = flash > 0.01 && !!newest;
    if (this.flash.visible) {
      const x = (newest.x * spec.width) / 4,
        z = (newest.y * spec.length) / 10,
        y = 0.88 + newest.radius * 0.64 + newest.layer * 0.67;
      this.flash.position.set(x, y, z);
      this.flash.scale.set(newest.radius * 1.08, newest.radius * 0.72, newest.radius * 1.08);
      this.flash.material.opacity = 0.7 * flash * alpha;
    }
    this.lens.material = state.full ? this.lampOn : this.lampOff;
    this.halo.visible = state.full;
    if (state.full) {
      // Brighter and wider in the dark, so it stands out from cabin lights.
      const dark = 1 - Math.min(1, light);
      this.halo.material.opacity = Math.min(1, 0.55 + 0.45 * dark + flash * 0.3) * alpha;
      this.halo.scale.setScalar(1 + dark * 0.9);
    }
    // Ease the freeboard so a landed sack visibly settles the hull.
    const ease = this.squat === null ? 1 : Math.min(1, dt * LOAD_CUES.settleRate);
    this.squat = (this.squat ?? state.squat) + (state.squat - (this.squat ?? state.squat)) * ease;
    this.trim += (state.trim - this.trim) * ease;
    this.list += (state.list - this.list) * ease;
    this.fill += (state.fill - this.fill) * ease;
    return state;
  }
  // Applied after the shared bob/heading pose; only the drawn hull moves.
  apply(visual, surfaceY = 0) {
    const bob = visual.position.y - surfaceY;
    visual.position.y =
      surfaceY + bob * (1 - this.fill * LOAD_CUES.fullBobDamping) - (this.squat || 0);
    // Roll about the hull's own fore-aft axis (Euler Z is applied first), then
    // trim about its own beam axis so the stern settles whatever the heading.
    visual.rotation.z += this.list;
    if (this.trim) visual.quaternion.multiply(trimQuaternion.setFromAxisAngle(BEAM, this.trim));
  }
  // Geometry goes with the vessel's disposeGroup; materials are owned here.
  dispose() {
    this.halo.material.map?.dispose();
    for (const material of [
      this.ghostMaterial,
      this.lampOn,
      this.lampOff,
      this.halo.material,
      this.lamp.children[0].material,
      this.flash.material,
    ])
      material.dispose();
  }
}

const BEAM = new THREE.Vector3(1, 0, 0),
  trimQuaternion = new THREE.Quaternion();

// Edge-weighted: each future sack reads as a pale ring, so ghosts over
// sacks already aboard outline the next layer without washing out the red.
function ghostOutlineMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide, // back faces close each rim into a full ring
    uniforms: {
      uColor: { value: new THREE.Color('#d6f3f6') },
      uOpacity: { value: 0.6 },
      uFill: { value: 0.05 },
    },
    vertexShader: `
      attribute float aFade;
      varying float vRim;
      varying float vFade;
      void main() {
        vFade = aFade;
        vec4 local = vec4(position, 1.0);
        mat4 model = modelMatrix;
        #ifdef USE_INSTANCING
          model = modelMatrix * instanceMatrix;
        #endif
        vec3 n = normalize(mat3(viewMatrix) * mat3(model) * normal);
        vRim = 1.0 - abs(n.z);
        gl_Position = projectionMatrix * viewMatrix * model * local;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uFill;
      varying float vRim;
      varying float vFade;
      void main() {
        float edge = smoothstep(0.84, 0.98, vRim);
        gl_FragColor = vec4(uColor, uOpacity * vFade * (uFill + edge * 0.9));
      }`,
  });
}

function haloTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'),
    gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
