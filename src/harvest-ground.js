export const clumpDistance = (c, x, y) => Math.max(0, Math.hypot(x - c.x, y - c.y) - c.radius);
export function nearestClump(p, x, y, minQuality = 0) {
  let best = null,
    distance = Infinity;
  for (const c of p.clumps || [])
    if (c.remaining > 0.001 && (c.quality ?? p.quality) >= minQuality) {
      const gap = clumpDistance(c, x, y);
      if (gap < distance - 1e-7 || (Math.abs(gap - distance) < 1e-7 && c.id < (best?.id || '~'))) {
        distance = gap;
        best = c;
      }
    }
  return best;
}
export function availableGroundDistance(p, x, y, minQuality = 0) {
  const c = nearestClump(p, x, y, minQuality);
  return c ? clumpDistance(c, x, y) : Infinity;
}
export function takeCatch(p, c, requested) {
  const amount = Math.min(requested, p.remaining, c ? c.remaining : Infinity);
  p.remaining = Math.max(0, p.remaining - amount);
  if (c) c.remaining = Math.max(0, c.remaining - amount);
  return amount;
}
// October 8: commercial rival crews move on once a clump is picked thin instead
// of stripping it, so marked beds stay worth a look past the first week and
// season regrowth has something to work on. The player's divers are unaffected.
export const RIVAL_PICKING = { leaveFraction: 0.3 };
export const rivalPickable = (c) =>
  Number.isFinite(c?.initialStock)
    ? Math.max(0, c.remaining - c.initialStock * RIVAL_PICKING.leaveFraction)
    : (c?.remaining ?? 0);
export const rivalPatchStock = (p) =>
  p.clumps?.length ? p.clumps.reduce((n, c) => n + rivalPickable(c), 0) : p.remaining;
export function takeRivalCatch(p, c, requested) {
  return takeCatch(p, c, Math.min(requested, rivalPickable(c)));
}

// Claim the next clump once. Partners favor opposite routes around the ground;
// explicit compass instructions still take priority over that default bias.
export function chooseHarvestClump(w, p, d, exclude = null) {
  const candidates = (p.clumps || []).filter(
    (c) =>
      c !== exclude &&
      c.remaining > 0.001 &&
      (c.quality ?? p.quality) >= d.minQuality &&
      clumpDistance(c, d.x, d.y) <= 9.144,
  );
  const partners = w.divers.filter(
    (other) =>
      other !== d && ['searching', 'harvesting'].includes(other.state) && other.patch === p,
  );
  const rx = d.x - p.x,
    ry = d.y - p.y,
    len = Math.max(0.1, Math.hypot(rx, ry)),
    sign = d.id % 2 ? 1 : -1;
  const angle = d.direction ? ((d.direction - 1) * Math.PI) / 4 : null;
  const dx = angle === null ? (-ry / len) * sign : Math.sin(angle),
    dy = angle === null ? (rx / len) * sign : -Math.cos(angle);
  const cost = (c) => {
    const gap = clumpDistance(c, d.x, d.y),
      distance = Math.max(0.1, Math.hypot(c.x - d.x, c.y - d.y));
    const heading = ((c.x - d.x) * dx + (c.y - d.y) * dy) / distance;
    const crowd = partners.reduce(
      (sum, o) =>
        sum +
        (o.clump === c
          ? 12
          : Math.hypot(c.x - (o.clump?.x ?? o.x), c.y - (o.clump?.y ?? o.y)) < 4
            ? 5
            : 0),
      0,
    );
    return gap - heading * (d.direction ? 1 : partners.length ? 1.2 : 0) + crowd;
  };
  let best = null,
    bestCost = Infinity;
  for (const candidate of candidates) {
    const value = cost(candidate);
    if (value < bestCost || (value === bestCost && candidate.id.localeCompare(best.id) < 0)) {
      best = candidate;
      bestCost = value;
    }
  }
  return best || (exclude ? null : nearestClump(p, d.x, d.y, d.minQuality));
}
