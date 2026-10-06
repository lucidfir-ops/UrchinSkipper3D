import * as THREE from 'three';
import { enabledEquipment } from '../equipment-controls.js';
import { waterTurbidity } from './water-optics.js';
import { bubbleOpacity } from '../bubble-visibility.js';
import { LIT_RENDER_ORDER } from './diver-boil.js';

// October 5 (designer): a torch shows as a faint glow from a diver swimming
// down to about 10 m, deeper than a body can be seen (5 m); murk shortens it.
export function torchDepthGlow(depth, turbidity = 1) {
  const d = Math.max(0, depth) * turbidity,
    t = Math.min(1, Math.max(0, (d - 4) / 6));
  return Math.exp(-d * 0.12) * (1 - t * t * (3 - 2 * t));
}

export function diverTorchStrength(world, pose) {
  if (!world.weather?.night || !enabledEquipment(world).includes('torch') || !pose.underwater)
    return 0;
  return (
    torchDepthGlow(pose.depth, waterTurbidity(world)) *
    bubbleOpacity(world, Math.hypot(pose.x - world.boat.x, pose.y - world.boat.y), true)
  );
}

export class DiverTorch {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'Diver torch · attenuated through water';
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { strength: { value: 0 } },
      vertexShader: `varying vec3 local; varying vec3 beamNormal; varying vec3 beamView; void main() {
        local = position;
        beamNormal = normalMatrix*normal;
        beamView = -(modelViewMatrix*vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
      fragmentShader: `varying vec3 local; varying vec3 beamNormal; varying vec3 beamView; uniform float strength; void main() {
        float t = clamp(-local.z/2.6,0.0,1.0);
        float edge = pow(abs(dot(normalize(beamNormal),normalize(beamView))),1.8);
        float fade = sin(t*3.14159)*exp(-t*2.0);
        gl_FragColor = vec4(vec3(.40,.75,.59),strength*edge*fade*.18);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
    this.geometry = new THREE.ConeGeometry(0.65, 2.6, 20, 1, true);
    this.geometry.translate(0, -1.3, 0);
    this.geometry.rotateX(Math.PI / 2);
    const beam = new THREE.Mesh(this.geometry, this.material);
    // Only ever visible at night with torches, as its own light past the mist.
    beam.renderOrder = LIT_RENDER_ORDER;
    this.group.add(beam);
    this.light = new THREE.SpotLight('#d4ffe6', 0, 5, 0.35, 0.85, 2);
    this.light.target.position.set(0, -0.5, -2.6);
    this.group.add(this.light, this.light.target);
    scene.add(this.group);
  }
  update(world, pose) {
    const strength = diverTorchStrength(world, pose);
    this.group.visible = strength > 0.005;
    this.material.uniforms.strength.value = strength;
    this.light.intensity = strength * 12;
    this.group.position.set(pose.x, -0.15 - pose.depth, pose.y);
    this.group.rotation.y = -pose.heading;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.light.dispose();
    this.group.removeFromParent();
  }
}
