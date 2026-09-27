import { seaLevel } from './terrain.js';

export const ROCK_DEPTH = Object.freeze({
  blue: 2,
  hidden: 5,
});

// A rock's topDepth and the tide share the same positive-down datum. Keeping
// this conversion in one place prevents a deep sounding from looking like a
// drying crown or becoming a collision obstacle.
export const rockWaterDepth = (w, rock) => rock.topDepth + seaLevel(w);

export function rockVisualBand(w, rock) {
  const depth = rockWaterDepth(w, rock);
  if (depth > ROCK_DEPTH.hidden) return 'hidden';
  if (depth >= ROCK_DEPTH.blue) return 'deep';
  if (depth > 0) return 'shallow';
  return 'exposed';
}

export function rockCanHit(rock, level, draft) {
  const depth = rock.topDepth + level;
  if (depth >= ROCK_DEPTH.blue) return false;
  return depth <= 0 || depth < draft;
}
