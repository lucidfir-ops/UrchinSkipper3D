import { boatSpec } from './boats.js';
import { engineState } from './operating-state.js';
import { lightningState } from './weather-effects.js';

// Original procedural placeholder sounds; no external recordings or licenses.
// Playback, mixing, rate and lifecycle use Phaser's existing Sound Manager.
const lengths = {
  engine: 2,
  neutral: 2,
  forward: 2,
  reverse: 2,
  whistle: 1.2,
  water: 4,
  splash: 0.65,
  surface: 0.8,
  hook: 0.2,
  bag: 0.28,
  confirm: 0.09,
  ground: 0.5,
  warning: 0.38,
  radio: 0.24,
  clang: 1.1,
  thunder: 3.2,
};
export function synthesize(kind, rate = 22050) {
  const samples = new Float32Array(Math.floor((lengths[kind] || 0.2) * rate));
  let seed = 1709,
    noise = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate,
      p = i / samples.length;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1;
    noise = noise * 0.9 + white * 0.1;
    const edge = Math.min(1, i / 100, (samples.length - i) / 150),
      decay = Math.exp(-p * 6);
    let value = 0;
    if (['engine', 'neutral', 'forward', 'reverse'].includes(kind))
      value =
        0.5 * Math.sin(t * Math.PI * 2 * 44) +
        0.22 * Math.sin(t * Math.PI * 2 * 88) +
        0.08 * Math.sin(t * Math.PI * 2 * 132) +
        (kind === 'forward' ? 0.19 * noise + 0.11 * Math.sin(t * Math.PI * 2 * 176) : 0) +
        (kind === 'reverse' ? 0.055 * Math.sin(t * Math.PI * 2 * 176) + noise * 0.23 : 0);
    else if (kind === 'whistle') {
      const pulse = Math.sin(Math.PI * Math.min(1, (p % 0.5) * 2)) ** 2;
      value = 0.42 * pulse * Math.sin(t * 2 * Math.PI * 1850 + Math.sin(t * 24) * 0.65);
    } else if (kind === 'water') value = noise * 0.7;
    else if (kind === 'splash' || kind === 'surface')
      value =
        noise * 2 * Math.sin(Math.PI * p) * Math.exp(-p * 2) + 0.05 * Math.sin(t * 1700) * decay;
    else if (kind === 'hook')
      value = (Math.sin(t * 2 * Math.PI * 720) * 0.2 + white * 0.12) * decay;
    else if (kind === 'clang') {
      const strike = t % 0.28;
      value =
        (Math.sin(strike * Math.PI * 2 * 410) * 0.6 + Math.sin(strike * Math.PI * 2 * 973) * 0.3) *
        Math.exp(-strike * 18);
    } else if (kind === 'bag')
      value = (Math.sin(t * 2 * Math.PI * (65 - 30 * p)) * 0.7 + noise) * decay;
    else if (kind === 'confirm') value = 0.3 * Math.sin(t * 2 * Math.PI * 540) * decay;
    else if (kind === 'warning')
      value = 0.24 * Math.sin(t * 2 * Math.PI * 380) * Math.sin(Math.PI * p);
    else if (kind === 'radio')
      value = (noise * 0.9 + Math.sin(t * 2 * Math.PI * 890) * 0.09) * Math.sin(Math.PI * p);
    else if (kind === 'thunder')
      value =
        (noise * 1.8 + 0.32 * Math.sin(t * Math.PI * 2 * (34 - p * 18))) *
        Math.sin(Math.min(1, p * 9) * Math.PI * 0.5) *
        Math.exp(-p * 2.6);
    else if (kind === 'ground') value = noise * 2.5 * (1 - p);
    samples[i] = Math.max(-0.9, Math.min(0.9, value * edge));
  }
  return samples;
}

export class BoatAudio {
  constructor(scene) {
    this.scene = scene;
    this.manager = scene.sound;
    this.volume = 0.35;
    this.played = 0;
    try {
      const value = Number(localStorage.getItem('urchin-volume'));
      if (localStorage.getItem('urchin-volume') !== null && Number.isFinite(value))
        this.volume = Math.max(0, Math.min(1, value));
    } catch {
      /* Storage can be unavailable; retain the default volume. */
    }
    const context = this.manager.context;
    if (!context) return;
    for (const kind of Object.keys(lengths)) {
      const key = 'urchin-' + kind;
      if (!scene.cache.audio.exists(key)) {
        const data = synthesize(kind, context.sampleRate),
          buffer = context.createBuffer(1, data.length, context.sampleRate);
        buffer.copyToChannel(data, 0);
        scene.cache.audio.add(key, buffer);
      }
    }
    this.engines = Object.fromEntries(
      ['neutral', 'forward', 'reverse'].map((kind) => [
        kind,
        this.manager.add('urchin-' + kind, { loop: true, volume: 0 }),
      ]),
    );
    this.engine = this.engines.neutral;
    this.water = this.manager.add('urchin-water', { loop: true, volume: 0 });
    this.gesture = () => this.unlock();
    window.addEventListener('pointerdown', this.gesture);
    window.addEventListener('keydown', this.gesture);
    scene.events.once('shutdown', () => {
      window.removeEventListener('pointerdown', this.gesture);
      window.removeEventListener('keydown', this.gesture);
      Object.values(this.engines).forEach((sound) => sound.destroy());
      this.water?.destroy();
    });
  }
  unlock() {
    const context = this.manager.context;
    if (context?.state === 'suspended') context.resume().catch(() => {});
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    try {
      localStorage.setItem('urchin-volume', String(this.volume));
    } catch {
      /* Volume remains usable for this session without storage. */
    }
  }
  get needsGesture() {
    return !!this.manager.context && this.manager.context.state !== 'running' && this.volume > 0;
  }
  play(kind, gain = 1) {
    if (!this.engine || this.manager.context.state !== 'running' || this.volume === 0) return;
    this.manager.play('urchin-' + kind, { volume: Math.min(1, gain * this.volume * 0.6) });
    this.played++;
  }
  update(w, active, dt) {
    if (!this.engine) return;
    if (this.manager.context.state === 'running') {
      for (const sound of Object.values(this.engines)) if (!sound.isPlaying) sound.play();
      if (!this.water.isPlaying) this.water.play();
    }
    const lightning = lightningState(w.weather, w.time);
    if (active && lightning.thunder && lightning.strikeId !== this.lastThunder) {
      this.lastThunder = lightning.strikeId;
      this.play('thunder', 0.9);
    }
    const speed = Math.min(1, Math.abs(w.boat.speed) / 5.2),
      power = Math.max(
        Math.abs(w.boat.throttle),
        Math.abs(w.boat.thruster || 0) * (boatSpec(w).bowThrusterStrength ? 0.55 : 0),
        Math.abs(w.boat.pivot || 0) * 0.7,
      );
    const engine =
        active && engineState(w).powered ? this.volume * (0.055 + 0.62 * power ** 0.8) : 0,
      water = active
        ? this.volume *
          (0.055 +
            0.1 * speed +
            Math.min(0.12, (w.weather?.wind || 0) * 0.003 + (w.weather?.wave || 0) * 0.025))
        : 0;
    const ease = Math.min(1, dt * 5);
    const gear = w.boat.throttle < -0.02 ? 'reverse' : power > 0.02 ? 'forward' : 'neutral';
    this.engine = this.engines[gear];
    const now = this.manager.context.currentTime,
      rate = Math.round((0.8 + power * 1.2 + speed * 0.15) * 100) / 100,
      updateRate = now >= (this.nextRateUpdate || 0);
    if (updateRate) this.nextRateUpdate = now + 0.05;
    for (const [kind, sound] of Object.entries(this.engines)) {
      // AudioParam stores float32. Match that precision so a settled gain does
      // not receive the same value forever due to double/float roundoff.
      const target = Math.fround(kind === gear ? engine : 0),
        difference = target - sound.volume;
      if (difference !== 0)
        sound.setVolume(Math.abs(difference) < 0.0001 ? target : sound.volume + difference * ease);
      // Phaser rebuilds the scheduled loop source on every setRate, even for
      // identical values. Only update audible loops for meaningful pitch changes.
      if (updateRate && (target > 0 || sound.volume > 0.001) && sound.rate !== rate)
        sound.setRate(rate);
    }
    const waterTarget = Math.fround(water),
      waterDifference = waterTarget - this.water.volume;
    if (waterDifference !== 0)
      this.water.setVolume(
        Math.abs(waterDifference) < 0.0001
          ? waterTarget
          : this.water.volume + waterDifference * ease,
      );
  }
}
