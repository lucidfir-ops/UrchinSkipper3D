import { bedDepthAt, depthGradient, clamp } from '../../src/terrain.js';

const gaussian = (x, y, zone) =>
  Math.exp(-(((x - zone.x) / zone.rx) ** 2 + ((y - zone.y) / zone.ry) ** 2) * 1.8);
export function shelterAt(recipe, x, y) {
  return Math.max(0, ...recipe.shelters.map((zone) => gaussian(x, y, zone) * zone.calm));
}
export function authorFlow(recipe, terrain, x, y, sign = 1, residual = false) {
  const water = bedDepthAt(terrain, x, y) + 1.15;
  if (water <= -0.7) return { x: 0, y: 0 };
  const base = { x: recipe.flow.x * sign, y: recipe.flow.y * sign },
    speed = Math.hypot(base.x, base.y);
  const ux = base.x / speed,
    uy = base.y / speed;
  let vx = residual ? 0 : base.x,
    vy = residual ? 0 : base.y;
  if (!residual) {
    // Potential-flow-like island splitting, then a dissipative downstream lee.
    for (const island of recipe.islands) {
      const dx = x - island.x,
        dy = y - island.y,
        r = Math.hypot(dx / island.rx, dy / island.ry);
      const length = Math.max(1, Math.hypot(dx, dy)),
        nx = dx / length,
        ny = dy / length;
      const influence = Math.min(0.92, 1 / Math.max(1, r * r)),
        dot = base.x * nx + base.y * ny;
      vx += influence * (base.x - 2 * dot * nx);
      vy += influence * (base.y - 2 * dot * ny);
      const downstream = dx * ux + dy * uy,
        across = dx * uy - dy * ux,
        radius = Math.min(island.rx, island.ry);
      if (downstream > radius) {
        const lee =
          0.8 *
          Math.exp(-(((downstream - radius) / (radius * 2)) ** 2) - (across / (radius * 0.9)) ** 2);
        vx *= 1 - lee;
        vy *= 1 - lee;
      }
    }
    for (const channel of recipe.channels) {
      const dx = channel.b.x - channel.a.x,
        dy = channel.b.y - channel.a.y,
        l2 = dx * dx + dy * dy;
      const t = clamp(((x - channel.a.x) * dx + (y - channel.a.y) * dy) / l2, 0, 1);
      const distance = Math.hypot(x - channel.a.x - dx * t, y - channel.a.y - dy * t);
      const gain =
        channel.gain *
        Math.exp(-((distance / channel.width) ** 2)) *
        Math.sin(Math.PI * (0.12 + 0.76 * t));
      const direction = dx * base.x + dy * base.y >= 0 ? 1 : -1;
      vx += (dx / Math.sqrt(l2)) * gain * direction;
      vy += (dy / Math.sqrt(l2)) * gain * direction;
    }
    const calm = shelterAt(recipe, x, y);
    vx *= 1 - calm;
    vy *= 1 - calm;
  }
  for (const eddy of recipe.eddies) {
    const dx = (x - eddy.x) / eddy.radius,
      dy = (y - eddy.y) / eddy.radius,
      weight = Math.exp(-(dx * dx + dy * dy) * 1.4);
    const spin = eddy.spin * (residual ? 0.28 : sign),
      attract = eddy.convergence * (residual ? 1 : 0.35);
    vx += (-dy * spin - dx * attract) * weight;
    vy += (dx * spin - dy * attract) * weight;
  }
  // Divert incoming flow along coast/reef contours. Drifters still have their
  // own swept wet-path constraint because a coarse field cannot define shore.
  if (water < 7) {
    const g = depthGradient(terrain, x, y),
      m = Math.hypot(g.x, g.y);
    if (m > 0.001) {
      const nx = g.x / m,
        ny = g.y / m,
        dot = vx * nx + vy * ny;
      if (dot < 0) {
        const remove = -dot * clamp((7 - water) / 5, 0, 1);
        vx += nx * remove;
        vy += ny * remove;
      }
    }
  }
  const wet = clamp((water + 0.7) / 2, 0, 1);
  return { x: vx * wet, y: vy * wet };
}
export function generateCurrentField(recipe, terrain) {
  const grid = {
    size: terrain.size,
    spacing: 12,
    channels: ['floodX', 'floodY', 'ebbX', 'ebbY', 'residualX', 'residualY', 'lagMinutes'],
    values: [],
  };
  for (let y = 0; y <= grid.size; y += grid.spacing)
    for (let x = 0; x <= grid.size; x += grid.spacing) {
      const flood = authorFlow(recipe, terrain, x, y, 1),
        ebb = authorFlow(recipe, terrain, x, y, -1),
        residual = authorFlow(recipe, terrain, x, y, 1, true);
      grid.values.push(
        ...[
          flood.x,
          flood.y,
          ebb.x,
          ebb.y,
          residual.x,
          residual.y,
          shelterAt(recipe, x, y) * 28,
        ].map((v) => Math.round(v * 1000) / 1000),
      );
    }
  return grid;
}
