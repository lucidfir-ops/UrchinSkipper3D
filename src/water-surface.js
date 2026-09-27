import { whitecapAt } from './wind-motion.js';
import { depthAt } from './world.js';

// Decorative detail follows projected size. Keep directional crest silhouettes
// at every zoom; tiny foam droplets and surface grain are close-view detail.
export function waterDetail(zoom) {
  return {
    spacing: 10 / Math.min(1, zoom / 0.65),
    foamLayers: zoom < 0.55 ? 1 : 3,
    droplets: zoom >= 0.55,
    grain: zoom >= 0.55,
  };
}
export function drawWaterSurface(g, world, { p, t, zoom, minX, minY, maxX, maxY }) {
  const detail = waterDetail(zoom),
    waveEnergy = Math.max(0, Math.min(1, (world.environment.waves || 0) / 0.1)),
    sunlight = world.weather?.sunlight || 0,
    sunAngle = world.weather?.sunAngle || 0;
  for (let y = Math.floor(minY / detail.spacing) * detail.spacing; y < maxY; y += detail.spacing)
    for (
      let x = Math.floor(minX / detail.spacing) * detail.spacing;
      x < maxX;
      x += detail.spacing
    ) {
      if (depthAt(world, x, y) <= 0) continue;
      const phase = Math.sin(x * 0.34 + y * 0.22 + t * (0.45 + waveEnergy * 0.8)),
        yy = y + phase * (0.08 + waveEnergy * 0.3);
      g.lineStyle(0.75, 0xb5cdc5, 0.045 + waveEnergy * 0.035 + 0.02 * phase);
      g.lineBetween(x * p, yy * p, (x + 2.4 + waveEnergy) * p, (yy + 0.12) * p);
      g.lineStyle(0.7, 0x071f2d, 0.035 + waveEnergy * 0.035);
      g.lineBetween((x + 3) * p, (yy + 2) * p, (x + 6.2) * p, (yy + 2.1) * p);
      const sparkle = Math.sin(x * 1.73 - y * 1.21 + t * 0.7),
        // A slow, sun-aligned band keeps the reflection legible as it travels
        // across the sea without adding another draw pass.
        reflection =
          0.35 +
          0.65 *
            ((Math.sin((x * -Math.sin(sunAngle) + y * Math.cos(sunAngle)) * 0.09 - t * 0.16) + 1) /
              2);
      if (sunlight > 0.04 && sparkle > 0.68 && reflection > 0.48) {
        const length = 0.8 + (sparkle - 0.68) * 4.6 + reflection * 1.2;
        g.lineStyle(
          0.9 / Math.max(0.75, zoom),
          0xf8dfac,
          sunlight * (sparkle - 0.6) * reflection * 0.42,
        );
        g.lineBetween(
          x * p,
          yy * p,
          (x + Math.cos(sunAngle) * length) * p,
          (yy + Math.sin(sunAngle) * length * 0.3) * p,
        );
      }
    }
  const waveSpacing = Math.max(10, 8 / zoom);
  for (let y = Math.floor(minY / waveSpacing) * waveSpacing; y < maxY; y += waveSpacing)
    for (let x = Math.floor(minX / waveSpacing) * waveSpacing; x < maxX; x += waveSpacing) {
      const crest = whitecapAt(x, y, t, world.environment.wind, world.environment.waves);
      if (crest.alpha < 0.08 || depthAt(world, crest.x, crest.y) < 0.6) continue;
      for (let foam = 0; foam < detail.foamLayers; foam++) {
        const cx = crest.x - crest.wind.x * foam * 0.48,
          cy = crest.y - crest.wind.y * foam * 0.48,
          half = crest.length * (1 - foam * 0.15);
        g.lineStyle(
          (foam ? 0.9 : 1.6) / Math.max(0.7, zoom),
          0xebf3e6,
          crest.alpha * (foam ? 0.2 : 0.67),
        );
        g.strokePoints(
          [-1, -0.55, 0, 0.5, 1].map((v, i) => ({
            x: (cx + crest.dx * half * v + crest.wind.x * Math.sin(i * 1.4 + x) * 0.32) * p,
            y: (cy + crest.dy * half * v + crest.wind.y * Math.sin(i * 1.4 + x) * 0.32) * p,
          })),
          false,
        );
        if (!foam && detail.droplets) {
          g.fillStyle(0xe8f0e2, crest.alpha * 0.32);
          for (let dot = 0; dot < 4; dot++) {
            const v = (dot / 3 - 0.5) * half;
            g.fillCircle(
              (cx + crest.dx * v - crest.wind.x * 0.45) * p,
              (cy + crest.dy * v - crest.wind.y * 0.45) * p,
              0.07 * p,
            );
          }
        }
      }
    }
  if (!detail.grain) return;
  for (let y = minY; y < maxY; y += 3.7 / Math.min(1, zoom))
    for (let x = minX; x < maxX; x += 4.1 / Math.min(1, zoom)) {
      const xx = x + Math.sin(y * 2.1 + x) * 1.6,
        yy = y + Math.cos(x * 1.8 + y) * 1.1;
      if (depthAt(world, xx, yy) <= 0) continue;
      const phase = Math.sin(xx * 0.7 + yy * 0.53 + t * 0.6),
        length = 0.22 + 0.19 * (1 + Math.sin(x + y));
      g.lineStyle(0.7, 0xc4d6cb, 0.025 + 0.025 * (phase + 1));
      g.lineBetween(xx * p, yy * p, (xx + length) * p, (yy + length * 0.22) * p);
    }
}
