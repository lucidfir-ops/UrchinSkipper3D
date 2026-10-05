// Screen-space placement only. The last five pixels include the speech tail.
export const SPEECH_GAP = 8;
export const SPEECH_TAIL = 5;
// Place slightly beyond the mandatory gap so boat bobbing does not force a
// complete search each frame. Controls retain their exact required clearance.
export function bufferedSpeechFootprints(rects) {
  return rects.map((rect) => ({
    ...rect,
    left: rect.left - 4,
    right: rect.right + 4,
    top: rect.top - 4,
    bottom: rect.bottom + 4,
  }));
}

export function rectanglesOverlap(a, b, gap = 0) {
  return (
    a.left < b.right + gap &&
    a.right > b.left - gap &&
    a.top < b.bottom + gap &&
    a.bottom > b.top - gap
  );
}
export function speechIsClear(rect, protectedRects) {
  return protectedRects.every((other) => !rectanglesOverlap(rect, other, SPEECH_GAP));
}
function overlapArea(a, b, gap = 0) {
  return (
    Math.max(0, Math.min(a.right, b.right + gap) - Math.max(a.left, b.left - gap)) *
    Math.max(0, Math.min(a.bottom, b.bottom + gap) - Math.max(a.top, b.top - gap))
  );
}
export function placeSeaSpeech(viewport, sizes, preferred, protectedRects, occupied = []) {
  const margin = 8;
  // Five lines at the unchanged12px/1.35 font plus padding and tail. Longer
  // routine notices cannot be read comfortably during a2.6-second bubble.
  const compactAvailable = sizes.some((size) => size.compact);
  let best;
  for (const size of sizes) {
    if (size.width > viewport.width - margin * 2 || size.height > viewport.height - margin * 2)
      continue;
    const sizeCost =
      (preferred.width - size.width) * 2 +
      (size.compact ? 20000 : 0) +
      (!size.compact && compactAvailable && size.height > 100 ? 30000 : 0);
    if (best?.clear && sizeCost >= best.score) continue;
    const maxX = viewport.width - margin - size.width,
      maxY = viewport.height - margin - size.height,
      clamp = (n, max) => Math.max(margin, Math.min(max, n)),
      xs = new Set([clamp(preferred.left, maxX), margin, maxX, (viewport.width - size.width) / 2]),
      ys = new Set([clamp(preferred.top, maxY), margin, maxY]);
    for (const other of [...protectedRects, ...occupied]) {
      xs.add(clamp(other.left - size.width - SPEECH_GAP, maxX));
      xs.add(clamp(other.right + SPEECH_GAP, maxX));
      ys.add(clamp(other.top - size.height - SPEECH_GAP, maxY));
      ys.add(clamp(other.bottom + SPEECH_GAP, maxY));
    }
    for (const left of xs) {
      const horizontalCost = sizeCost + Math.abs(left - preferred.left);
      if (best?.clear && horizontalCost >= best.score) continue;
      for (const top of ys) {
        const positionCost = horizontalCost + Math.abs(top - preferred.top) * 2;
        if (best?.clear && positionCost >= best.score) continue;
        const rect = {
          left,
          top,
          width: size.width,
          height: size.height,
          right: left + size.width,
          bottom: top + size.height,
        };
        if (best?.clear && !speechIsClear(rect, protectedRects)) continue;
        const critical = best?.clear
            ? 0
            : protectedRects.reduce((sum, other) => sum + overlapArea(rect, other, SPEECH_GAP), 0),
          hud = occupied.reduce((sum, other) => sum + overlapArea(rect, other, 4), 0),
          score = hud * 100 + positionCost;
        if (!best || critical < best.critical || (critical === best.critical && score < best.score))
          best = {
            ...rect,
            text: size.text,
            compact: size.compact,
            critical,
            score,
            clear: critical === 0,
          };
        if (best.clear && best.score === 0) return best;
      }
    }
  }
  return best;
}
