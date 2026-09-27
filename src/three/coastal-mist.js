import * as THREE from 'three';
import { visibilityRange } from '../assists.js';

// Orthographic camera height is not the skipper's line of sight. This veil
// reconstructs each screen ray's sea-level position, then uses the simulation's
// actual horizontal weather/night sight distance around the player.
export class CoastalMist {
  constructor(scene, noiseTexture) {
    this.scene = scene;
    this.direction = new THREE.Vector3();
    this.uniforms = {
      uNoise: { value: noiseTexture },
      uBoat: { value: new THREE.Vector2() },
      uShift: { value: new THREE.Vector2() },
      uRange: { value: 500 },
      uTime: { value: 0 },
      uTint: { value: new THREE.Color('#9bafb0') },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec2 vWorld;
        void main() {
          vec4 world=modelMatrix*vec4(position,1.0);
          vWorld=world.xz;
          gl_Position=projectionMatrix*viewMatrix*world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uNoise;
        uniform vec2 uBoat;
        uniform vec2 uShift;
        uniform float uRange;
        uniform float uTime;
        uniform vec3 uTint;
        varying vec2 vWorld;
        void main() {
          vec2 sea=vWorld-uShift;
          float distanceFromSkipper=length(sea-uBoat);
          float wisps=texture2D(uNoise,sea*.003+vec2(uTime*.00065,-uTime*.0003)).b;
          float haze=smoothstep(uRange*(.24+wisps*.16),uRange,distanceFromSkipper);
          haze*=.91+wisps*.12;
          // Nothing beyond the original sight limit is exposed by moving mist.
          haze=max(haze,smoothstep(uRange*.91,uRange,distanceFromSkipper));
          if(haze<.003) discard;
          vec3 tint=uTint*(.985+wisps*.035);
          gl_FragColor=vec4(tint,clamp(haze,0.0,1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const geometry = new THREE.PlaneGeometry(3000, 3000);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Horizontal sea mist · true skipper sight range';
    this.mesh.position.y = 80;
    this.mesh.renderOrder = 100000;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(world, elapsed, camera) {
    const range = visibilityRange(world);
    this.mesh.visible = range < 500 || world.weather?.kind === 'fog' || !!world.weather?.night;
    this.uniforms.uRange.value = Math.max(1, range);
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uBoat.value.set(world.boat.x, world.boat.y);
    this.mesh.position.set(world.boat.x, 80, world.boat.y);
    this.uniforms.uTint.value.copy(this.scene.fog?.color || new THREE.Color('#9bafb0'));
    if (camera) {
      camera.getWorldDirection(this.direction);
      const scale = this.mesh.position.y / Math.min(-0.05, this.direction.y);
      this.uniforms.uShift.value.set(this.direction.x * scale, this.direction.z * scale);
    }
  }
  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
