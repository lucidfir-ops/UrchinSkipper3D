import { visiblePatch } from './world.js';
import { nearestClump } from './harvest-ground.js';

// Only what this diver can encounter within their awareness; chart knowledge
// never grants access to distant stock or unmarked bed outlines.
export function observeGround(w, d) {
  const p =
    d.state === 'harvesting' && d.patch ? d.patch : visiblePatch(w, { ...d, minQuality: 0 });
  if (!p) return;
  const clump =
    d.state === 'harvesting' && d.clump ? d.clump : p.clumps ? nearestClump(p, d.x, d.y) : null;
  d.groundSample = {
    patchId: p.id,
    quality: clump?.quality ?? p.quality,
    x: d.x,
    y: d.y,
    unmarked: p.charted === false,
  };
}
