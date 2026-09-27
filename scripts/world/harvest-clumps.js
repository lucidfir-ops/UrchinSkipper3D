// Offline synthetic stock layout. Exported clumps are small resource regions;
// the larger outline remains a useful chart/quality marking, not a stock bucket.
export function createClumps(patch, random) {
  if (!patch.rate) return [];
  // Spread the same nine independent stock regions across the full outline.
  // Their harvesting footprints overlap; both art and harvest are clipped by the
  // parent boundary, leaving the outline authoritative instead of a central blob.
  const points = [],
    xs = patch.outline.map((p) => p.x),
    ys = patch.outline.map((p) => p.y),
    rx = (Math.max(...xs) - Math.min(...xs)) / 2,
    ry = (Math.max(...ys) - Math.min(...ys)) / 2;
  for (let row = -1; row <= 1; row++)
    for (let column = -1; column <= 1; column++) {
      const jitter = () => Math.round((random() - 0.5) * 0.7 * 100) / 100;
      points.push({
        id: `${patch.id}/c${points.length + 1}`,
        x: patch.x + column * rx * 0.56 + jitter(),
        y: patch.y + row * ry * 0.56 + jitter(),
        radius: Math.min(rx, ry) * 0.49,
        weight: 0.85 + random() * 0.3,
      });
    }
  const total = points.reduce((s, c) => s + c.weight, 0);
  let allocated = 0;
  return points.map((c, i) => {
    const stock =
      i === points.length - 1
        ? Math.round((patch.initialStock - allocated) * 100) / 100
        : Math.round(((patch.initialStock * c.weight) / total) * 100) / 100;
    allocated += stock;
    const { weight, ...point } = c;
    return { ...point, initialStock: stock, remaining: stock };
  });
}
export function addTidalApron(terrain) {
  const good = terrain.patches.find((p) => p.id === 'good'),
    { size, spacing } = terrain,
    n = size / spacing + 1;
  const positions = [
    [37, 21],
    [-37, -21],
    [8, 43],
    [-8, -43],
  ].map(([x, y]) => ({ x: good.x + x, y: good.y + y }));
  const site = positions.find(
    (s) =>
      s.x > 28 &&
      s.y > 28 &&
      s.x < size - 28 &&
      s.y < size - 28 &&
      terrain.patches.every((p) => Math.hypot(p.x - s.x, p.y - s.y) > 35),
  );
  if (!site) return;
  const rx = 13,
    ry = 9;
  for (let iy = 0; iy < n; iy++)
    for (let ix = 0; ix < n; ix++) {
      const x = ix * spacing,
        y = iy * spacing,
        dx = x - site.x,
        dy = y - site.y,
        r = Math.hypot(dx / rx, dy / ry);
      if (r > 2.5) continue;
      // Broad drying apron around a small fixed rock: a visible reference for tide.
      let depth = -0.68 + Math.max(0, r - 0.55) ** 2 * 8;
      if (r < 0.2) depth = -2.9 + r * 9;
      terrain.depths[iy * n + ix] =
        Math.round(Math.min(terrain.depths[iy * n + ix], depth) * 100) / 100;
    }
  terrain.tidalSites = [
    { ...site, name: 'Tidewatch Rock', kind: 'drying-apron', rx, ry },
    ...(terrain.id === 'middle' ? [{ x: 321, y: 368, name: 'Tidal Saddle', kind: 'passage' }] : []),
  ];
  terrain.tideStation = {
    x: terrain.size * 0.51,
    y: terrain.size * 0.52,
    name: 'Main-channel reference',
  };
}
