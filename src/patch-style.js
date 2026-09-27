// One visual vocabulary for the surface view, charts, and laboratory selector.
// Picking rate is colour; quality is outline continuity and texture density.
export function patchStyle(p) {
  const color =
    p.rate >= 13 ? 0x62dca6 : p.rate >= 10 ? 0xb9d77b : p.rate >= 7 ? 0xf1b45f : 0xe77962;
  const tier = p.quality >= 0.89 ? 0 : p.quality >= 0.79 ? 1 : p.quality >= 0.69 ? 2 : 3;
  return {
    color,
    css: `#${color.toString(16).padStart(6, '0')}`,
    tier,
    dash: [0, 3, 1.8, 0.8][tier],
    gap: [0, 1.2, 2.3, 3][tier],
    dots: [66, 40, 23, 11][tier],
    fill: [0.12, 0.09, 0.065, 0.035][tier],
  };
}
export const pickingName = (p) =>
  p.rate >= 13
    ? 'VERY FAST'
    : p.rate >= 10
      ? 'FAST'
      : p.rate >= 7
        ? 'SLOW'
        : p.rate > 0
          ? 'VERY SLOW'
          : 'EMPTY';
export const patchLabel = (p, harvestRate = 1) =>
  p.rate <= 0
    ? 'EMPTY CONTROL · no harvest\n0 lb remaining'
    : `${p.mixedQuality ? Math.round(Math.min(...p.clumps.map((c) => c.quality ?? p.quality)) * 100) + '–' + Math.round(Math.max(...p.clumps.map((c) => c.quality ?? p.quality)) * 100) + '% mixed' : Math.round(p.quality * 100) + '%'} · ${pickingName(p)} · ${(300 / p.rate / harvestRate).toFixed(0)}s / bag\n${Math.round(p.remaining).toLocaleString('en-CA')} lb remaining`;
export const patchOutline = (p) =>
  p.outline ||
  Array.from({ length: 40 }, (_, i) => ({
    x: p.x + Math.cos((i * Math.PI) / 20) * p.radius,
    y: p.y + Math.sin((i * Math.PI) / 20) * p.radius,
  }));
// The label's bottom edge sits above the northernmost rendered boundary.
export function patchLabelAnchor(outline, pixelsPerMeter, zoom) {
  const xs = outline.map((p) => p.x);
  return {
    x: ((Math.min(...xs) + Math.max(...xs)) / 2) * pixelsPerMeter,
    y: Math.min(...outline.map((p) => p.y)) * pixelsPerMeter - 8 / zoom,
  };
}
export function outlineStrokes(p) {
  const style = patchStyle(p),
    points = patchOutline(p),
    segments = [];
  let travelled = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!style.dash) {
      segments.push([a, b]);
      continue;
    }
    for (let d = 0; d < length;) {
      const phase = travelled % (style.dash + style.gap),
        drawing = phase < style.dash;
      const part = Math.min(
        length - d,
        (drawing ? style.dash : style.dash + style.gap) - phase + 0.000001,
      );
      if (drawing)
        segments.push([
          { x: a.x + ((b.x - a.x) * d) / length, y: a.y + ((b.y - a.y) * d) / length },
          {
            x: a.x + ((b.x - a.x) * (d + part)) / length,
            y: a.y + ((b.y - a.y) * (d + part)) / length,
          },
        ]);
      d += part;
      travelled += part;
    }
  }
  return segments;
}
export function legendMarkup(exact = true) {
  return `<div class="ground-legend"><span>Picking</span><i style="--swatch:#62dca6">Very fast</i><i style="--swatch:#b9d77b">Fast</i><i style="--swatch:#f1b45f">Slow</i><i style="--swatch:#e77962">Very slow</i><span>Quality</span><b class="q q0">${exact ? '90%' : 'Rich'}</b><b class="q q1">${exact ? '80%' : 'Good'}</b><b class="q q2">${exact ? '70%' : 'Fair'}</b><b class="q q3">${exact ? '60%' : 'Lean'}</b></div>`;
}
