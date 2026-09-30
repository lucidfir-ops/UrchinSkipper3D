const TAU = Math.PI * 2;
const difference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Presentation-only memory: the buoyant stipe relaxes before the trailing
// blades catch a reversing current. All roots remain fixed on the seabed.
export function kelpMotion(flow, variation = 0, previous, dt = 0) {
  const speed = Math.hypot(flow.x, flow.y);
  const strength = 1 - Math.exp(-speed * 2.4);
  if (!previous) {
    const angle = speed > 0.015 ? -Math.atan2(flow.y, flow.x) : variation * TAU;
    return { angle, tip: angle, extension: strength, velocity: 0 };
  }
  const state = { ...previous };
  const target = speed > 0.015 ? -Math.atan2(flow.y, flow.x) : state.angle;
  let error = difference(target, state.angle);
  // At an exact reversal, give each plant a stable preferred swing direction.
  if (Math.abs(error) > Math.PI - 0.01) error = (variation < 0.5 ? -1 : 1) * Math.abs(error);
  const aligned = Math.max(0, Math.cos(error));
  const extension = strength * (0.16 + 0.84 * aligned * aligned);
  state.extension += (extension - state.extension) * (1 - Math.exp(-dt / (0.7 + variation * 0.8)));
  const release = 1 - Math.min(1, state.extension * 0.9);
  const targetVelocity = Math.max(-0.85, Math.min(0.85, error * (0.5 + variation * 0.3))) * release;
  state.velocity += (targetVelocity - state.velocity) * (1 - Math.exp(-dt * 2.5));
  state.angle += state.velocity * dt;
  state.tip += difference(state.angle, state.tip) * (1 - Math.exp(-dt / (0.65 + variation * 0.8)));
  return state;
}
