import { C } from './config.js';
import { currentAt } from './environment.js';
import { boatDefinition, boatSpec } from './boats.js';
import { hullDistance, sweptPoses, toHull, fromHull } from './collision-geometry.js';
import { engineState } from './operating-state.js';
import { godmode } from './godmode.js';
export function closingImpact(pose, diver, spec, vx, vy) {
  const q = toHull(pose, diver.x, diver.y);
  const sideGap = Math.abs(q.side) - spec.width / 2;
  const foreGap = Math.abs(q.fore) - spec.length / 2;
  // A diver already deeply underneath the hull is an overrun, not a glancing brush.
  if (Math.max(sideGap, foreGap) < -0.15) return Math.hypot(vx, vy);
  const side = sideGap >= foreGap;
  const nx = side
    ? Math.cos(pose.heading) * Math.sign(q.side)
    : Math.sin(pose.heading) * Math.sign(q.fore);
  const ny = side
    ? Math.sin(pose.heading) * Math.sign(q.side)
    : -Math.cos(pose.heading) * Math.sign(q.fore);
  return Math.max(0, vx * nx + vy * ny);
}
// Surface-only swept contact. Safe pickup remains outside the port hull, matching
// local drift. Underwater bubble markers are not collision targets.
export function checkDiverSafety(w, previous, source = {}) {
  const b = source.boat || w.boat,
    spec = source.spec || boatSpec(w),
    poses = sweptPoses(previous, b, spec),
    cfg = C.diverSafety;
  for (const d of w.divers) {
    if (d.state !== 'surface') continue;
    const pose = poses.find((p) => hullDistance(p, d.x, d.y, spec) < cfg.radius);
    if (!pose) continue;
    const local = toHull(pose, d.x, d.y),
      flow = currentAt(w, d.x, d.y),
      rx = d.x - b.x,
      ry = d.y - b.y;
    const vx = b.vx - flow.x - b.turn * ry,
      vy = b.vy - flow.y + b.turn * rx;
    const relativeSpeed = Math.hypot(vx, vy);
    const speed = closingImpact(pose, d, spec, vx, vy);
    const sourceId = source.boat?.id || 'player';
    if (w.time >= (d.nextSafetyContact || 0) || (d.safetySource && d.safetySource !== sourceId)) {
      d.nextSafetyContact = w.time + 2;
      d.safetySource = sourceId;
      w.safety ??= { incidents: [], fatalities: 0, injuries: 0 };
      const exposed =
        (source.exposed ?? boatDefinition(b.configuration).damageFactor > 0.1) &&
        Math.abs(b.throttle) > 0.2 &&
        (source.boat ? b.speed > 0 : engineState(w).powered) &&
        local.fore < -spec.length / 2 + 0.8;
      const fatal =
        !godmode(w) &&
        (speed >= cfg.fatalSpeed || (exposed && relativeSpeed >= cfg.propellerFatalSpeed));
      const injured =
        !godmode(w) &&
        !fatal &&
        (speed >= cfg.injurySpeed ||
          (source.boat?.kind === 'taxi' && relativeSpeed > 0.2) ||
          (exposed && relativeSpeed >= cfg.propellerInjurySpeed));
      const outcome = fatal ? 'fatality' : injured ? 'injury' : 'near miss';
      w.safety.incidents.push({
        diverId: d.id,
        minute: w.day.minute,
        speed,
        outcome,
        x: d.x,
        y: d.y,
        time: w.time,
        sector: w.day.groundId,
        cause:
          source.boat?.kind === 'taxi'
            ? 'water taxi strike'
            : exposed
              ? 'powered stern contact'
              : 'boat strike',
      });
      if (fatal) {
        w.safety.fatalities++;
        w.discarded += d.bag;
        Object.assign(d, {
          condition: 'deceased',
          state: 'fatality',
          bag: 0,
          qualitySum: 0,
          hooking: false,
          bagHandled: true,
        });
        w.emergency = { reason: 'Fatal diver collision', mandatoryRescue: true };
        b.throttle = 0;
        w.events.push(
          `${d.name.toUpperCase()} — FATAL BOAT STRIKE. FISHING ENDED — RADIO FOR EMERGENCY ASSISTANCE`,
        );
      } else if (injured) {
        if (d.condition !== 'injured') w.safety.injuries++;
        Object.assign(d, {
          condition: 'injured',
          hooking: false,
          hook: 0,
          recoveryAction: null,
          reason: 'Injured — bring aboard',
        });
        w.emergency ??= { reason: 'Diver injured', mandatoryRescue: false };
        w.events.push(
          `${d.name.toUpperCase()} — INJURED BY BOAT. BRING ABOARD; RETURN FOR MEDICAL HELP OR RADIO FOR RESCUE`,
        );
      } else
        w.events.push(
          `${d.name.toUpperCase()} — HULL CONTACT / NEAR MISS. KEEP THE DIVER CLEAR OF THE HULL`,
        );
      if (injured || fatal) w.effects.push({ type: 'warning', diverId: d.id, x: d.x, y: d.y });
    }
    if (d.state === 'surface') {
      // Prevent a slow hull overlap becoming a way to collect a diver through the boat.
      const current = toHull(b, d.x, d.y),
        side = current.side < 0 ? -1 : 1,
        q = fromHull(b, side * (spec.width / 2 + cfg.radius + 0.15), current.fore);
      d.x = q.x;
      d.y = q.y;
    }
  }
}
