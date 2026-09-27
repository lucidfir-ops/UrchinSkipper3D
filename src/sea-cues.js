import { currentAt } from './environment.js';
import { depthAt } from './terrain.js';
import { boatSpec } from './boats.js';

// Observable consequences only. No collision bodies, stock reveal or extra forces.
export function surfaceBlood(w) {
  return (w.safety?.incidents || [])
    .filter(
      (e) =>
        ['fatality', 'injury'].includes(e.outcome) &&
        Number.isFinite(e.x) &&
        Number.isFinite(e.y) &&
        Number.isFinite(e.time) &&
        e.sector === w.day.groundId &&
        w.time - e.time < (e.outcome === 'fatality' ? 180 : 45),
    )
    .slice(-4)
    .map((e) => {
      const age = Math.max(0, w.time - e.time),
        flow = currentAt(w, e.x, e.y),
        duration = e.outcome === 'fatality' ? 180 : 45,
        x = e.x + flow.x * Math.min(age, 18),
        y = e.y + flow.y * Math.min(age, 18),
        wet = depthAt(w, x, y) > 0;
      return {
        x: wet ? x : e.x,
        y: wet ? y : e.y,
        age,
        radius: (e.outcome === 'fatality' ? 5.5 : 1.1) + Math.min(age, 30) * 0.09,
        alpha: (e.outcome === 'fatality' ? 0.85 : 0.5) * (1 - age / duration),
      };
    });
}

export function drawSeaCues(g, w, p) {
  for (const pool of surfaceBlood(w)) {
    // Nested irregular contours read as spreading stained water, not particles.
    for (let layer = 0; layer < 7; layer++) {
      const radius = pool.radius * (1.3 - layer * 0.095);
      g.fillStyle(layer < 3 ? 0xd31b28 : 0x8e0713, pool.alpha * (layer < 3 ? 0.12 : 0.2));
      g.beginPath();
      for (let i = 0; i < 49; i++) {
        const angle = (i * Math.PI) / 24,
          edge = 1 + Math.sin(angle * 3 + 0.6) * 0.09 + Math.cos(angle * 5 - 0.3) * 0.05,
          x = (pool.x + Math.cos(angle) * radius * edge) * p,
          y = (pool.y + Math.sin(angle) * radius * edge * 0.72) * p;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.closePath();
      g.fillPath();
    }
  }
  const b = w.boat,
    spec = boatSpec(w),
    s = Math.sin(b.heading),
    c = Math.cos(b.heading),
    t = w.time;
  if (b.grounded) {
    for (let i = 0; i < 5; i++) {
      const phase = (t * 0.15 + i / 5) % 1;
      g.fillStyle(0x9c9472, (1 - phase) * 0.14);
      g.fillEllipse(
        (b.x - s * spec.length * 0.2) * p,
        (b.y + c * spec.length * 0.2) * p,
        (spec.width + phase * 9) * p,
        (spec.width + phase * 5) * p,
      );
    }
  }
  if (b.hullHealth < 0.65 || b.driveHealth < 0.5) {
    for (let i = 0; i < 4; i++) {
      const behind = spec.length * 0.5 + i * 1.8,
        x = b.x - s * behind,
        y = b.y + c * behind;
      if (depthAt(w, x, y) <= 0) continue;
      g.lineStyle(1.2, [0x535b56, 0x736184, 0x7e8876, 0x415e70][i], 0.23);
      g.strokeEllipse(x * p, y * p, (3 + i) * p, (1 + i * 0.3) * p);
    }
  }
  // Bow spray follows the actual rough sea and through-water speed.
  const spray = Math.min(1, Math.abs(b.speed) / 5) * Math.min(1, (w.environment.waves || 0) / 0.45);
  if (spray > 0.1)
    for (const side of [-1, 1]) {
      const phase = (t * 1.4 + (side + 1) * 0.2) % 1,
        fore = spec.length * 0.48 - phase * 1.6,
        lateral = side * (spec.width * 0.25 + phase * 2.5);
      g.lineStyle(1.5, 0xe8f2ef, spray * (1 - phase) * 0.6);
      g.lineBetween(
        (b.x + s * fore + c * lateral) * p,
        (b.y - c * fore + s * lateral) * p,
        (b.x + s * (fore - 1) + c * (lateral + side)) * p,
        (b.y - c * (fore - 1) + s * (lateral + side)) * p,
      );
    }
}
