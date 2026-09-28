const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Keep speech close to its physical speaker while leaving the skipper's
// instruments and followed boat readable. Custom windows remain untouched.
export function placeSpeech(point, size, viewport, obstacles, preferred) {
  const margin = 6,
    width = Math.min(size.width, viewport.width - margin * 2),
    height = Math.min(size.height, viewport.height - margin * 2),
    xs = [preferred.left, point.x - width / 2, point.x + 20, point.x - width - 20],
    ys = [preferred.top, point.y - height - 20, point.y + 20, point.y - height / 2];
  if (
    preferred.left >= margin &&
    preferred.top >= margin &&
    preferred.left + width <= viewport.width - margin &&
    preferred.top + height <= viewport.height - margin &&
    obstacles.every(
      (box) =>
        preferred.left + width <= box.left ||
        preferred.left >= box.right ||
        preferred.top + height <= box.top ||
        preferred.top >= box.bottom,
    )
  )
    return { ...preferred, width, height };
  for (const box of obstacles) {
    xs.push(box.left - width - margin, box.right + margin);
    ys.push(box.top - height - margin, box.bottom + margin);
  }
  const lefts = [...new Set(xs.map((x) => clamp(x, margin, viewport.width - width - margin)))],
    tops = [...new Set(ys.map((y) => clamp(y, margin, viewport.height - height - margin)))];
  let best,
    bestScore = Infinity;
  for (const left of lefts)
    for (const top of tops) {
      const right = left + width,
        bottom = top + height,
        overlap = obstacles.reduce(
          (total, box) =>
            total +
            Math.max(0, Math.min(right, box.right) - Math.max(left, box.left)) *
              Math.max(0, Math.min(bottom, box.bottom) - Math.max(top, box.top)),
          0,
        ),
        dx = point.x - clamp(point.x, left, right),
        dy = point.y - clamp(point.y, top, bottom),
        score =
          overlap * 100000 +
          dx * dx +
          dy * dy +
          ((left - preferred.left) ** 2 + (top - preferred.top) ** 2) * 0.01;
      if (score < bestScore) {
        bestScore = score;
        best = { left, top, width, height };
      }
    }
  return best;
}
