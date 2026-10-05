import * as THREE from 'three';

// October 5 bubble reference (designer photo and videos, feedback/10-5/):
// working divers lift a pale milky-green upwelling with smooth, flattened boil
// patches edged by fizz; the ascent warning is a filled, churning white boil
// that grows over the diver. Never a hollow ring. Drawn per diver on the sea
// surface; visibility comes from the same bubbleOpacity rule as the specks.
export const BOIL_RADIUS = 4; // metres; the shader's unit disc

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const fragmentShader = `
  uniform float uTime;
  uniform float uWork;
  uniform float uBoil;
  uniform float uOpacity;
  uniform float uLight;
  uniform float uSeed;
  uniform vec3 uGlow;
  uniform float uGlowAmount;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 17.0) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  // Soft round specks: a thresholded noise sampled on a rotated lattice so
  // the edges never show the grid.
  float speck(vec2 p, float threshold) {
    p = mat2(0.8, -0.6, 0.6, 0.8) * p;
    float n = noise(p) * 0.65 + noise(p * 1.9 + 4.1) * 0.35;
    return smoothstep(threshold, threshold + 0.07, n);
  }
  float fbm(vec2 p) {
    return noise(p) * 0.55 + noise(p * 2.1 + 3.7) * 0.3 + noise(p * 4.3 + 9.1) * 0.15;
  }
  // Churning foam cells: the nearest of jittered points, animated.
  float cells(vec2 p, float t) {
    vec2 i = floor(p), f = fract(p);
    float d = 1.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 o = vec2(float(x), float(y));
        vec2 h = vec2(hash(i + o), hash(i + o + 5.3));
        vec2 c = o + 0.5 + 0.42 * sin(t * (1.2 + h) + 6.2831 * h);
        d = min(d, length(f - c));
      }
    return d;
  }

  void main() {
    float r = length(vUv);
    if (r > 1.0) discard;
    float t = uTime;
    vec3 colour = vec3(0.0);
    float alpha = 0.0;

    // Upwelling: irregular milky green under the surface, strongest centrally.
    float wobble = fbm(vUv * 1.6 + vec2(t * 0.05, -t * 0.04)) - 0.5;
    float body = smoothstep(0.95, 0.2, r + wobble * 0.35);
    float milk = body * (0.7 + 0.3 * fbm(vUv * 3.0 - t * 0.12));
    vec3 green = vec3(0.62, 0.78, 0.68);
    alpha += uWork * milk * 0.4;
    colour += green * uWork * milk * 0.4;

    // Flattened boil patches: smooth lighter discs that swell and fade in
    // turn, each edged by fine fizz.
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float cycle = fract(t / 3.4 + fk / 3.0 + uSeed);
      vec2 centre = 0.4 * vec2(sin(fk * 2.1 + floor(t / 3.4 + fk / 3.0) * 1.7 + uSeed * 6.0),
                               cos(fk * 1.3 + floor(t / 3.4 + fk / 3.0) * 2.3 + uSeed * 4.0));
      float radius = 0.08 + 0.3 * sqrt(cycle);
      float d = length(vUv - centre) + (noise((vUv - centre) * 9.0) - 0.5) * 0.05;
      float life = smoothstep(0.0, 0.15, cycle) * (1.0 - smoothstep(0.65, 1.0, cycle));
      float slick = smoothstep(radius, radius * 0.7, d) * life;
      // A ragged, broken band of fizz rather than a neat ring.
      float band = radius * (0.55 + 0.6 * noise(vUv * 5.0 + fk * 7.0 + t * 0.2));
      float rim = smoothstep(band, radius, d) * smoothstep(radius * 1.35, radius * 0.95, d) * life;
      rim *= smoothstep(0.3, 0.6, noise(vUv * 7.0 - fk * 3.0 + t * 0.35));
      float fizz = speck(vUv * 46.0 + fk * 13.0 + t * 0.9, 0.62) * rim;
      // The reference's flattened patches are smooth and glassy: darker than
      // the chop around them, with the fizz bright at their edges.
      float glassy = uWork * slick * 0.3;
      colour += vec3(0.08, 0.17, 0.17) * glassy;
      alpha += glassy;
      float froth = uWork * fizz * 0.8;
      colour += vec3(0.97, 1.0, 0.98) * froth;
      alpha += froth;
    }

    // Sparse fizz scattered through the upwelling, drifting.
    float scatter = speck(vUv * 34.0 + vec2(t * 0.25, t * 0.1), 0.74) * body
      * smoothstep(0.45, 0.75, noise(vUv * 3.0 + t * 0.1));
    colour += vec3(0.95) * uWork * scatter * 0.55;
    alpha += uWork * scatter * 0.55;

    // Ascent boil: a filled white disc growing with the warning, churning.
    float extent = mix(0.24, 0.65, uBoil); // about 2 to 5 m across
    float edgeNoise = fbm(vUv * 3.5 + vec2(t * 0.6, t * 0.45)) - 0.5;
    float disc = smoothstep(extent, extent * 0.78, r + edgeNoise * 0.3);
    // Spray and broken foam just outside the boiling disc.
    float spray = speck(vUv * 34.0 + t * 1.3, 0.64)
      * smoothstep(extent * 1.3, extent, r) * (1.0 - disc);
    disc = max(disc, spray * 0.8);
    // Two scales of churning cells: upwelling heads with darker troughs.
    float churn = cells(vUv * 4.2 + vec2(t * 0.1, t * 0.18), t * 2.8);
    float fine = cells(vUv * 11.0 - vec2(t * 0.2, 0.0), t * 4.0);
    float foam = 0.6 + 0.28 * smoothstep(0.6, 0.1, churn) + 0.12 * smoothstep(0.5, 0.15, fine);
    float boilAlpha = step(0.001, uBoil) * disc * (0.62 + 0.36 * smoothstep(0.0, 0.5, uBoil)) * foam;
    vec3 white = mix(vec3(0.74, 0.84, 0.82), vec3(1.0), smoothstep(0.6, 0.95, foam));
    colour = colour * (1.0 - boilAlpha) + white * boilAlpha;
    alpha = alpha * (1.0 - boilAlpha) + boilAlpha;

    float a = clamp(alpha, 0.0, 1.0);
    vec3 lit = (colour / max(alpha, 0.0001)) * uLight;
    lit = mix(lit, uGlow, uGlowAmount * 0.6);
    gl_FragColor = vec4(lit, a * uOpacity);
  }`;

export class DiverBoil {
  constructor(scene, seed = 0) {
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWork: { value: 0 },
        uBoil: { value: 0 },
        uOpacity: { value: 0 },
        uLight: { value: 1 },
        uSeed: { value: seed * 0.37 },
        uGlow: { value: new THREE.Color('#c4ffe3') },
        uGlowAmount: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(BOIL_RADIUS * 2, BOIL_RADIUS * 2),
      this.material,
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.work = 0;
    this.boil = 0;
    scene.add(this.mesh);
  }
  // phase: the diverMotion phase; progress: ascent progress 0..1.
  update({ x, z, surfaceY, phase, progress, opacity, light, glow, time, dt }) {
    const working = ['descending', 'searching', 'working', 'ascending'].includes(phase),
      ascending = phase === 'ascending';
    const ease = Math.min(1, dt * 1.5);
    this.work += ((working ? 1 : 0) - this.work) * ease;
    // The boil builds over the warning and subsides quickly once surfaced.
    const boilTarget = ascending ? 0.25 + 0.75 * Math.min(1, progress) : 0;
    this.boil += (boilTarget - this.boil) * Math.min(1, dt * (ascending ? 2.5 : 1.2));
    if (this.boil < 0.01 && !ascending) this.boil = 0;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uWork.value = this.work;
    u.uBoil.value = this.boil;
    u.uOpacity.value = opacity;
    u.uLight.value = light;
    u.uGlowAmount.value = glow ? 1 : 0;
    this.mesh.visible = opacity > 0 && (this.work > 0.01 || this.boil > 0.01);
    this.mesh.position.set(x, surfaceY + 0.06, z);
  }
  reset() {
    this.work = this.boil = 0;
    this.mesh.visible = false;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
