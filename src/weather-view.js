import { rainMotion } from './wind-motion.js';
import { C } from './config.js';
import { visibilityRange } from './assists.js';
import { workLightsOn } from './equipment-controls.js';
import { lightningState } from './weather-effects.js';
// A screen veil changes what can be seen; it never changes the sea bed.
export class WeatherView {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'weatherVeil';
    document.querySelector('#game').after(this.canvas);
    this.lights = document.createElement('canvas');
    this.lights.width = this.lights.height = 384;
    const light = this.lights.getContext('2d');
    // Overlapping elliptical pools feather in every direction, including the
    // sides and far end. The mask is prepared once rather than blurred per frame.
    for (const [x, y, rx, ry, strength] of [
      [0, -0.4, 0.29, 0.53, 0.8],
      [0, -0.14, 0.14, 0.26, 0.7],
      [-0.34, 0.05, 0.48, 0.36, 0.85],
    ]) {
      light.save();
      light.translate(192 + x * 192, 192 + y * 192);
      light.scale(rx * 192, ry * 192);
      const glow = light.createRadialGradient(0, 0, 0, 0, 0, 1);
      glow.addColorStop(0, `rgba(255,228,165,${strength})`);
      glow.addColorStop(0.3, `rgba(255,228,165,${strength * 0.7})`);
      glow.addColorStop(0.65, `rgba(255,228,165,${strength * 0.22})`);
      glow.addColorStop(1, 'rgba(255,228,165,0)');
      light.fillStyle = glow;
      light.fillRect(-1, -1, 2, 2);
      light.restore();
    }
  }
  draw(w, width, height, zoom) {
    const canvas = this.canvas;
    canvas.hidden = !w.career;
    if (!w.career) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const weather = w.weather;
    if (!weather) return;
    const cx = width / 2,
      cy = height / 2,
      r = visibilityRange(w) * C.pixelsPerMeter * zoom,
      lightning = lightningState(weather, w.time),
      lights = weather.darkness && workLightsOn(w);
    // A full-screen Canvas upload is expensive on mobile. Dry weather changes
    // slowly: retain identical shading, including while the world is paused.
    // Rain and lightning still animate; light cones follow the boat's heading.
    const key = [
      width,
      height,
      Math.round(r),
      Math.round(weather.darkness * 255),
      weather.visibility < 200,
      weather.kind,
      lights ? w.boat.heading.toFixed(3) : '',
      lightning.flash,
      weather.rain,
      weather.rain ? `${w.environment.wind.x}/${w.environment.wind.y}` : '',
      weather.rain ? w.time : 0,
    ].join('/');
    const dt =
      this.lastWorld === w ? Math.max(0, Math.min(0.1, w.time - (this.lastTime ?? w.time))) : 0;
    this.lastTime = w.time;
    if (this.lastWorld === w && this.key === key) return;
    this.lastWorld = w;
    this.key = key;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    if (weather.darkness) {
      const light = ctx.createRadialGradient(cx, cy, Math.min(20, r * 0.2), cx, cy, r);
      light.addColorStop(0, `rgba(3,15,26,${weather.darkness * 0.18})`);
      light.addColorStop(1, `rgba(3,15,26,${weather.darkness})`);
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, width, height);
      if (lights) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(w.boat.heading);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(this.lights, -r, -r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.12;
        ctx.drawImage(this.lights, -r, -r, r * 2, r * 2);
        ctx.restore();
      }
    }
    if (weather.visibility < 200) {
      const fog = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 1.6);
      fog.addColorStop(0, '#c0d0c500');
      fog.addColorStop(1, `rgba(142,165,163,${weather.kind === 'fog' ? 0.87 : 0.25})`);
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, width, height);
    }
    if (lightning.flash) {
      ctx.fillStyle = `rgba(218,235,255,${lightning.flash * 0.58})`;
      ctx.fillRect(0, 0, width, height);
    }
    const motion = rainMotion(w.environment.wind);
    this.rainX = (this.rainX || 0) + motion.x * dt;
    this.rainY = (this.rainY || 0) + motion.y * dt;
    const speed = Math.max(1, Math.hypot(motion.x, motion.y));
    const wrap = (n, span) => ((n % span) + span) % span;
    for (const layer of [0, 1]) {
      const factor = layer ? 1.25 : 0.7;
      ctx.strokeStyle = `rgba(215,235,236,${weather.rain * (layer ? 0.58 : 0.3)})`;
      ctx.lineWidth = layer ? 1.45 : 0.9;
      ctx.beginPath();
      const count = Math.min(260, Math.floor((weather.rain * width * height) / 4700));
      const length = (9 + Math.min(24, speed * 0.05)) * factor;
      for (let i = 0; i < count; i++) {
        const x = wrap(i * 173.7 + layer * 79 + this.rainX * factor, width + 60) - 30;
        const y = wrap(i * 91.3 + layer * 173 + this.rainY * factor, height + 60) - 30;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (motion.x / speed) * length, y + (motion.y / speed) * length);
      }
      ctx.stroke();
    }
  }
}
