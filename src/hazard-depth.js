import { depthAt, seaLevel } from './terrain.js';
import { toHull } from './collision-geometry.js';

// Local sounder/scanner measurements include the top of a fixed feature only
// inside its footprint. Diver habitat still uses the surrounding seabed.
export function soundingDepth(w, x, y) {
  let depth = depthAt(w, x, y);
  for (const rock of w.rocks || []) {
    if (Math.hypot(rock.x - x, rock.y - y) > rock.length / 2 + rock.radius) continue;
    const q = toHull(rock, x, y);
    if (Math.hypot(q.side, Math.max(0, Math.abs(q.fore) - rock.length / 2)) <= rock.radius)
      depth = Math.min(depth, rock.topDepth + seaLevel(w));
  }
  return depth;
}
