import { boatFamily } from './vessel-catalog.js';
import { gear } from './assists.js';
import { roll } from './career-data.js';
import { godmode } from './godmode.js';
export function earlyStartNotice(w) {
  const exposed = ['outboard', 'sterndrive'].includes(boatFamily(w.boat.configuration));
  return (
    'Before 07:00: +6% crew fatigue; reduced visibility. ' +
    (exposed
      ? 'This exposed drive has an 8% chance of a timber strike on the early outward passage; damage may require repairs. Radar halves that chance.'
      : 'This protected shaft / jet avoids the additional early-passage drive-strike risk. Visible logs can still damage the hull.')
  );
}
export function earlyPassageStrike(w) {
  if (godmode(w)) return false;
  if (!w.career || w.day.minute >= 420 || w.day.earlyStrikeChecked) return false;
  w.day.earlyStrikeChecked = true;
  if (!['outboard', 'sterndrive'].includes(boatFamily(w.boat.configuration))) return false;
  const radar = gear(w, 'radar');
  if (roll(w.career.seed, w.career.day + 6907) >= (radar ? 0.04 : 0.08)) return false;
  const before = w.boat.driveHealth;
  w.boat.driveHealth = Math.max(0.1, before - 0.18);
  w.boat.driveHealth = Math.min(before, w.boat.driveHealth);
  w.day.earlyStrike = true;
  w.events.push('EARLY PASSAGE · TIMBER STRIKE — DRIVE DAMAGED; CHECK REPAIRS ON RETURN');
  return true;
}
