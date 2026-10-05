import * as THREE from 'three';
import { makeVessel, makeMaterials, addFittings, disposeGroup } from './vessels.js';
import { boatDefinition, boatSpec } from '../boats.js';
import { UPGRADES, FLEET } from '../career-data.js';
import { equipmentStation } from '../equipment-fit.js';

// One renderer serves all menu canvases. Each canvas receives an ordinary 2D
// snapshot and redraws only when the player turns the boat or changes fittings.
// No animation loop, simulation mutation or WebGL context per card.
let preview;
class FittingPreview {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(720, 440);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.snapshot = document.createElement('canvas');
    this.snapshot.width = 720;
    this.snapshot.height = 440;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#112a30');
    this.camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 150);
    this.materials = makeMaterials();
    this.scene.add(new THREE.HemisphereLight('#edf2df', '#30505a', 2.4));
    const key = new THREE.DirectionalLight('#fff4d9', 3.5);
    key.position.set(-12, 18, 8);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#a8cbd4', 1.5);
    fill.position.set(10, 5, -8);
    this.scene.add(fill);
    this.highlightMaterials = [];
    this.grid = new THREE.GridHelper(30, 30, '#315158', '#1c3e44');
    this.grid.position.y = -0.65;
    this.scene.add(this.grid);
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.035, 6, 36),
      new THREE.MeshBasicMaterial({
        color: '#ff5145',
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.renderOrder = 5;
  }
  prepare(w, candidateId) {
    const spec = boatSpec(w),
      item = UPGRADES.find((candidate) => candidate.id === candidateId);
    const installed = [...(w.career.fleet[w.boat.configuration].equipment || [])];
    if (item && !installed.includes(item.id)) installed.push(item.id);
    const identity = `${w.boat.configuration}:${installed.join(',')}:${candidateId}`;
    if (identity !== this.identity) {
      this.ring.removeFromParent();
      if (this.vessel) disposeGroup(this.vessel);
      for (const material of this.highlightMaterials) material.dispose();
      this.highlightMaterials = [];
      this.vessel = makeVessel(spec, boatDefinition(w.boat.configuration), this.materials);
      addFittings(this.vessel, spec, this.materials, installed);
      this.vessel.userData.radar.visible = installed.includes('radar');
      this.vessel.userData.deckCrew.forEach((diver) => {
        diver.visible = false;
      });
      this.scene.add(this.vessel);
      this.scene.remove(this.ring);
      if (item) {
        const fitting =
          item.id === 'radar'
            ? this.vessel.userData.radar
            : this.vessel.userData.fittings?.[item.id];
        fitting?.traverse((object) => {
          if (!object.isMesh) return;
          const material = object.material.clone();
          material.emissive?.set('#db9c30');
          material.emissiveIntensity = 0.75;
          object.material = material;
          this.highlightMaterials.push(material);
        });
        const { cabinTop, cabinZ, cabinLength } = this.vessel.userData.stations;
        const locations = {
          bow: [0, 0.75, -spec.length * 0.32],
          console: [0, cabinTop + 0.3, cabinZ + cabinLength * 0.4],
          mast: [0, cabinTop + 1.1, cabinZ],
          'working deck': [-spec.width * 0.4, 1.3, spec.length * 0.1],
          'dive gear': [spec.width * 0.3, 1.4, spec.length * 0.18],
          'aft deck': [spec.width * 0.3, 1.5, spec.length * 0.38],
          hull: [0, 0.8, spec.length * 0.2],
          drive: [0, 1.15, spec.length * 0.27],
        };
        this.ring.position.set(...locations[equipmentStation(item).id]);
        this.vessel.add(this.ring);
      }
      this.identity = identity;
    }
    return spec;
  }
  draw(canvas, w, candidateId, rotation = 0) {
    const spec = this.prepare(w, candidateId);
    const frame = `${this.identity}:${rotation}`;
    if (frame === this.lastFrame) {
      canvas.getContext('2d').drawImage(this.snapshot, 0, 0, canvas.width, canvas.height);
      canvas.dataset.loaded = 'true';
      return;
    }
    this.vessel.rotation.y = rotation;
    const span = spec.length * 0.44;
    this.camera.left = (-span * 720) / 440;
    this.camera.right = (span * 720) / 440;
    this.camera.top = span;
    this.camera.bottom = -span;
    this.camera.position.set(-spec.length * 0.8, spec.length * 0.85, spec.length * 0.85);
    this.camera.lookAt(0, 0.9, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    this.snapshot.getContext('2d').drawImage(this.renderer.domElement, 0, 0);
    canvas.getContext('2d').drawImage(this.snapshot, 0, 0, canvas.width, canvas.height);
    this.lastFrame = frame;
    canvas.dataset.loaded = 'true';
  }
}
export function paintFittingPreviews(panel, w) {
  for (const canvas of panel.querySelectorAll('canvas[data-fitting-preview]')) {
    if (!canvas.isConnected) continue;
    let rotation = 0,
      pointer;
    const draw = () => {
      try {
        preview ??= new FittingPreview();
        preview.draw(canvas, w, canvas.dataset.fittingPreview, rotation);
      } catch {
        canvas.hidden = true;
        const notice = canvas.parentElement.querySelector('.fitting-preview-caption');
        if (notice) notice.textContent = '3D preview unavailable · installation plan below.';
      }
    };
    draw();
    canvas.onpointerdown = (event) => {
      pointer = { id: event.pointerId, x: event.clientX };
      canvas.setPointerCapture(event.pointerId);
    };
    canvas.onpointermove = (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      rotation += (event.clientX - pointer.x) * 0.014;
      pointer.x = event.clientX;
      draw();
    };
    canvas.onpointerup = canvas.onpointercancel = () => {
      pointer = null;
    };
    canvas.onkeydown = (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      rotation += event.key === 'ArrowLeft' ? -0.22 : 0.22;
      draw();
    };
  }
}

const fleetSnapshots = new Map();
export function paintFleetPreviews(panel) {
  for (const canvas of panel.querySelectorAll('canvas[data-vessel]')) {
    const id = canvas.dataset.vessel;
    if (!FLEET[id]) continue;
    try {
      preview ??= new FittingPreview();
      if (!fleetSnapshots.has(id)) {
        const snapshot = document.createElement('canvas');
        snapshot.width = 720;
        snapshot.height = 440;
        const world = {
          boat: { configuration: id, fuel: 0 },
          catch: 0,
          career: { fleet: { [id]: { equipment: [] } } },
        };
        preview.draw(snapshot, world, undefined, 0);
        fleetSnapshots.set(id, snapshot);
      }
      canvas.getContext('2d').drawImage(fleetSnapshots.get(id), 0, 0, canvas.width, canvas.height);
      canvas.dataset.loaded = 'true';
      canvas.dataset.model = id;
    } catch {
      canvas.setAttribute('aria-label', `${id}: 3D preview unavailable`);
      canvas.closest('figure')?.classList.add('preview-unavailable');
    }
  }
}

export function releaseFittingPreview() {
  if (!preview) return;
  try {
    preview.renderer.dispose();
    preview.renderer.forceContextLoss();
  } catch {
    /* The page is unloading. */
  }
  preview = null;
}
