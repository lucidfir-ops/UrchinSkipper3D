import { boatDefinition, boatSpec } from './boats.js';
import { C } from './config.js';
import { clamp } from './terrain.js';
import { godmode } from './godmode.js';
export function incidentRoll(seed) {
  let n = (seed ^ 0x9e3779b9) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
// Call once per obstacle/contact phase. Hull and stern-drive contacts are separate;
// a bow touching floating timber cannot damage a leg several metres behind it.
export function collisionDamage(
  w,
  { speed, severity = 1, cause = 'collision', hull = true, propulsion = false },
) {
  const b = w.boat,
    def = boatDefinition(b.configuration),
    t = C.damage;
  if (godmode(w) || speed <= t.safeSpeed) return { hull: 0, propulsion: 0, catastrophic: false };
  b.impactCount = (b.impactCount || 0) + 1;
  const seed = (w.terrain.provenance?.seed || 1606) + b.impactCount * 997,
    energy = ((speed - t.safeSpeed) ** 2 * severity) / (boatSpec(w).durability ?? 1);
  const oldHull = b.hullHealth ?? 1,
    oldDrive = b.driveHealth ?? 1;
  const hullRisk = hull
    ? clamp((energy - t.hullCatastrophicEnergy) * t.hullCatastrophicChance, 0, 0.65)
    : 0;
  const sinking = incidentRoll(seed) < hullRisk;
  const hullLoss = hull ? Math.min(oldHull, sinking ? oldHull : energy * t.hullDamage) : 0;
  const vulnerability = def.damageFactor || 0,
    driveEnergy =
      (Math.max(0, speed - t.propSafeSpeed) ** 2 * severity) / (boatSpec(w).durability ?? 1);
  const driveRisk = propulsion
    ? clamp(
        (driveEnergy - t.driveCatastrophicEnergy) *
          t.driveCatastrophicChance *
          (def.catastrophicRisk || 0),
        0,
        0.7,
      )
    : 0;
  const failed = incidentRoll(seed + 871) < driveRisk;
  const driveLoss = propulsion
    ? Math.min(oldDrive, failed ? oldDrive : driveEnergy * t.driveDamage * vulnerability)
    : 0;
  b.hullHealth = Math.max(0, oldHull - hullLoss);
  b.driveHealth = Math.max(0, oldDrive - driveLoss);
  if (b.driveHealth < 0.06) b.driveHealth = 0;
  if (w.costs) {
    w.costs.repair += (oldDrive - b.driveHealth) * def.repairCost;
    w.costs.hullRepair = (w.costs.hullRepair || 0) + hullLoss * t.hullRepairCost;
  }
  if (hullLoss > 0.01 || driveLoss > 0.01) {
    const text =
      b.hullHealth <= 0
        ? 'HULL BREACHED — VESSEL SINKING'
        : b.driveHealth <= 0
          ? 'PROPULSION FAILED — RADIO FOR RESCUE'
          : driveLoss > 0.01
            ? 'DRIVE DAMAGED — CHECK THRUST / STEERING'
            : 'HULL DAMAGED — CHECK VESSEL';
    w.events.push(`${text} · ${cause.toUpperCase()}`);
    w.effects.push({ type: b.driveHealth <= 0 ? 'drive-failed' : 'drive-hit', x: b.x, y: b.y });
  }
  if (b.hullHealth <= 0) {
    b.sinking = true;
    w.emergency = { reason: 'Vessel sinking', mandatoryRescue: true };
    b.throttle = 0;
  }
  return { hull: hullLoss, propulsion: oldDrive - b.driveHealth, catastrophic: sinking || failed };
}
// Retained diagnostic entry point for a direct strike against the drive itself.
export function strikeDrive(w, speed, cause) {
  if (w.time < (w.boat.nextImpactTime || 0)) return { damage: 0 };
  if (speed > C.damage.safeSpeed) w.boat.nextImpactTime = w.time + 4;
  const r = collisionDamage(w, { speed, cause, hull: false, propulsion: true });
  return { damage: r.propulsion, failed: w.boat.driveHealth <= 0, catastrophic: r.catastrophic };
}
