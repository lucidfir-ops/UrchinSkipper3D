export function boatDragActions(dx, dy, heading, radius = 70) {
  const forward = (dx * Math.sin(heading) - dy * Math.cos(heading)) / radius,
    starboard = (dx * Math.cos(heading) + dy * Math.sin(heading)) / radius,
    value = (n) => (Math.abs(n) < 0.12 ? 0 : Math.max(-1, Math.min(1, n))),
    f = value(forward),
    s = value(starboard);
  return {
    throttleUp: Math.max(0, f),
    throttleDown: Math.max(0, -f),
    left: Math.max(0, -s),
    right: Math.max(0, s),
  };
}
