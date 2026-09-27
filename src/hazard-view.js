import { visibilityRange } from './assists.js';
import { rockVisualBand, rockWaterDepth } from './rock-depth.js';

export function rockOpacity(w, rock) {
  const distance = Math.hypot(rock.x - w.boat.x, rock.y - w.boat.y),
    range = visibilityRange(w);
  if (distance > range) return 0;
  const band = rockVisualBand(w, rock);
  if (band === 'hidden') return 0;
  const fade = Math.min(1, (range - distance) / Math.max(3, range * 0.15)),
    submerged = Math.max(0, rockWaterDepth(w, rock));
  return fade * (rock.charted ? Math.max(0.45, 0.86 - submerged * 0.12) : 1);
}

const rockShapes = new WeakMap();
export function drawHazards(g, w, { p, zoom, rangeX, rangeY }) {
  const b = w.boat,
    range = visibilityRange(w);
  const onScreen = (q) => Math.abs(q.x - b.x) <= rangeX && Math.abs(q.y - b.y) <= rangeY;
  for (const rock of w.rocks || []) {
    if (!onScreen(rock)) continue;
    const opacity = rockOpacity(w, rock);
    if (!opacity) continue;
    const x = rock.x * p,
      y = rock.y * p,
      s = Math.sin(rock.heading),
      c = Math.cos(rock.heading),
      r = rock.radius * p,
      half = (rock.length * p) / 2,
      ax = x - s * half,
      ay = y + c * half,
      bx = x + s * half,
      by = y - c * half,
      band = rockVisualBand(w, rock),
      exposed = band === 'exposed',
      deep = band === 'deep';
    // Faceted crowns sit inside the physical capsule. Only a drying/breaching
    // crown gets white wash; safe submerged crowns stay blue, shoals are warm.
    const shapeKey = `${p}/${rock.x}/${rock.y}/${rock.radius}/${rock.length}/${rock.heading}`;
    let shape = rockShapes.get(rock);
    if (shape?.key !== shapeKey) {
      shape = {
        key: shapeKey,
        points: Array.from({ length: 10 }, (_, i) => {
          const a = (i * Math.PI) / 5,
            radius = r * (0.9 + Math.sin(i * 2.8 + rock.x) * 0.1),
            side = Math.cos(a) * radius,
            fore = Math.sin(a) * radius + Math.sign(Math.sin(a)) * half;
          return { x: x + c * side + s * fore, y: y + s * side - c * fore };
        }),
      };
      rockShapes.set(rock, shape);
    }
    const points = shape.points;
    g.fillStyle(0x082e39, opacity * 0.55);
    g.fillPoints(
      points.map((q) => ({ x: q.x + 3 / zoom, y: q.y + 4 / zoom })),
      true,
    );
    g.fillStyle(deep ? 0x176c86 : exposed ? 0x9e8d70 : 0x7a9b86, opacity);
    g.fillPoints(points, true);
    const crown = { x: x - c * r * 0.2, y: y - r * 0.24 };
    g.fillStyle(deep ? 0x58a5b5 : exposed ? 0xf1dfb1 : 0xc4c39a, opacity * 0.94);
    g.fillPoints([points[1], points[2], points[3], points[4], crown], true);
    g.fillStyle(deep ? 0x0b4d63 : exposed ? 0x555a57 : 0x285f6b, opacity * 0.65);
    g.fillPoints([crown, points[6], points[7], points[8]], true);
    g.lineStyle(1 / zoom, 0x334d4c, opacity * 0.65);
    g.lineBetween(crown.x, crown.y, points[0].x, points[0].y);
    g.lineBetween(crown.x, crown.y, points[6].x, points[6].y);
    if (!deep) {
      // Warm, broken wash signals a submerged shoal; exposed rock has a bright
      // continuous rim and a dry crown. Clear/deep blue remains visibly distinct.
      g.lineStyle(
        (exposed ? 2.5 : 1.5) / zoom,
        exposed ? 0xffffff : 0xf3cc82,
        opacity * (exposed ? 0.95 : 0.8),
      );
      if (exposed) g.strokePoints(points, true);
      for (const side of [-1, 1]) {
        const wash = r + (0.3 + Math.sin(w.time * 1.8 + rock.x) * 0.12) * p;
        g.lineBetween(
          ax + c * wash * side,
          ay + s * wash * side,
          bx + c * wash * side + s * r * 0.5,
          by + s * wash * side - c * r * 0.5,
        );
      }
    }
  }
  for (const log of w.logs || []) {
    if (!onScreen(log)) continue;
    const distance = Math.hypot(log.x - b.x, log.y - b.y);
    if (distance > range) continue;
    const opacity = Math.min(1, (range - distance) / Math.max(3, range * 0.12)),
      s = Math.sin(log.heading),
      c = Math.cos(log.heading),
      x = log.x * p,
      y = log.y * p,
      l = (log.length * p) / 2,
      width = Math.max(log.radius * p * 2, 2 / zoom);
    g.lineStyle(width + 3 / zoom, 0x071f27, 0.55 * opacity);
    g.lineBetween(x - s * l + 2, y + c * l + 3, x + s * l + 2, y - c * l + 3);
    g.lineStyle(width, 0x9b7950, opacity);
    g.lineBetween(x - s * l, y + c * l, x + s * l, y - c * l);
    g.lineStyle(1.3 / zoom, 0xe4c58c, 0.95 * opacity);
    g.lineBetween(x - s * l - c, y + c * l - s, x + s * l - c, y - c * l - s);
    g.fillStyle(0xf1d39b, opacity);
    g.fillCircle(x - s * l, y + c * l, width * 0.52);
    g.fillCircle(x + s * l, y - c * l, width * 0.52);
    g.lineStyle(1 / zoom, 0xe5eee0, 0.52 * opacity);
    g.lineBetween(
      x - s * l + c * (width + 1),
      y + c * l + s * (width + 1),
      x + s * l + c * (width + 1),
      y - c * l + s * (width + 1),
    );
  }
}
