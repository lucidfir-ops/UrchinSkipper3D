export function captureStock(w) {
  for (const [id, terrain] of Object.entries(w.sectors || {}))
    w.career.stock[id] = terrain.patches.map((p) => ({
      id: p.id,
      remaining: p.remaining,
      kelpCover: p.kelpCover || 0,
      clumps: p.clumps?.map((c) => ({
        id: c.id,
        remaining: c.remaining,
        initialStock: c.initialStock,
      })),
    }));
}

export function restoreStock(w, id, terrain = w.terrain) {
  for (const record of w.career?.stock[id] || []) {
    const p = terrain.patches.find((p) => p.id === record.id);
    if (!p) continue;
    p.remaining = record.remaining;
    p.kelpCover = record.kelpCover || 0;
    for (const c of record.clumps || []) {
      const live = p.clumps?.find((x) => x.id === c.id);
      if (live) live.remaining = c.remaining;
    }
  }
}
