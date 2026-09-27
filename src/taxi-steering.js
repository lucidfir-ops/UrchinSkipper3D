// Look well ahead of a fast passage and bend around hulls on a stable side.
// Divers are deliberately absent from the obstacle list supplied by traffic.
export function taxiSteering(actor, obstacles, dx, dy) {
  const look = Math.max(65, actor.speed * 5);
  let threat = null;
  for (const o of obstacles) {
    const x = o.x - actor.x,
      y = o.y - actor.y,
      ahead = x * dx + y * dy,
      across = x * -dy + y * dx;
    if (ahead < -o.radius || ahead > look || Math.abs(across) > o.radius + 14) continue;
    if (!threat || ahead < threat.ahead) threat = { o, ahead, across };
  }
  if (!threat) {
    actor.taxiAvoidance = null;
    return { dx, dy };
  }
  const { o, across } = threat;
  const key = o.id || 'player';
  if (actor.taxiAvoidance?.id !== key) actor.taxiAvoidance = { id: key, side: across > 0 ? -1 : 1 };
  const side = actor.taxiAvoidance.side,
    clearance = o.radius + 14;
  return {
    dx: o.x - actor.x - dy * clearance * side + dx * 10,
    dy: o.y - actor.y + dx * clearance * side + dy * 10,
  };
}
