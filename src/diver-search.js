import { depthAt, depthGradient } from './terrain.js';

// Sweep to either side of the ordered course. On sloping coastal bottom,
// loosely follow its contour, reversing the depth component at 5 and 20 m.
export function scoutHeading(w, d) {
  const course = d.direction
      ? ((d.direction - 1) * Math.PI) / 4
      : d.id * 2.4 + (d.diveCount || 1) * 2.399963,
    g = depthGradient(w.terrain, d.x, d.y),
    slope = Math.hypot(g.x, g.y),
    depth = depthAt(w, d.x, d.y);
  let base = course;
  if (d.searchTime >= (d.scoutTurnUntil || 0)) d.scoutDepthSign = 0;
  if (slope > 0.025) {
    const tangent = Math.atan2(-g.y, -g.x),
      aligned = Math.cos(tangent - course) >= 0 ? tangent : tangent + Math.PI;
    // Course still chooses which way around the shore to travel.
    base = Math.atan2(
      Math.sin(course) * 0.3 + Math.sin(aligned) * 0.7,
      Math.cos(course) * 0.3 + Math.cos(aligned) * 0.7,
    );
    if (depth <= 5.000001 || depth >= 19.999999) {
      d.scoutDepthSign = depth <= 5.000001 ? 1 : -1;
      d.scoutTurnUntil = d.searchTime + 7;
    }
    if (d.scoutDepthSign)
      return Math.atan2(
        (g.x / slope) * d.scoutDepthSign + Math.sin(base) * 0.4,
        (-g.y / slope) * d.scoutDepthSign + Math.cos(base) * 0.4,
      );
  }
  const side = Math.floor(d.searchTime / 7) % 2 ? -1 : 1;
  return base + (side * Math.PI) / 4;
}
