import { fixedFeatures } from './shore-hazards.js';
import { seaLevel } from './terrain.js';
import { boatSpec } from './boats.js';
import { sweptPoses, logContact, toHull } from './collision-geometry.js';
import { collisionDamage } from './propulsion.js';
import { currentAt } from './environment.js';
import { rockCanHit } from './rock-depth.js';

export function createRocks(w) {
  const spec = boatSpec(w);
  return fixedFeatures(w.terrain).map((f) => ({
    ...f,
    // A pre-amendment save or an arrival must never materialize a strike.
    grace: !!logContact(w.boat, f, false, spec),
  }));
}

export function stepRocks(w, previous = w.boat) {
  const b = w.boat,
    spec = boatSpec(w),
    tide = seaLevel(w),
    poses = sweptPoses(previous, b, spec),
    nearby = (w.rocks || []).filter((r) => {
      if (r.grace && !logContact(b, r, false, spec)) r.grace = false;
      if (!rockCanHit(r, tide, spec.draft) || r.grace) return false;
      if (
        Math.hypot(r.x - b.x, r.y - b.y) >
        spec.length + r.length + r.radius + Math.hypot(b.x - previous.x, b.y - previous.y)
      ) {
        r.hullTouch = r.driveTouch = false;
        return false;
      }
      return true;
    });
  for (let i = 0; i < poses.length; i++) {
    const pose = poses[i];
    let blocked = false;
    for (const rock of nearby) {
      const touch = logContact(pose, rock, false, spec),
        drive = logContact(pose, rock, true, spec);
      if (!touch && !drive) continue;
      // Fixed stones take the component of motion into the contact face.
      const q = toHull(pose, rock.x, rock.y),
        s = Math.sin(pose.heading),
        c = Math.cos(pose.heading),
        sideFace = Math.abs(q.side) - spec.width / 2 > Math.abs(q.fore) - spec.length / 2,
        nx = sideFace ? Math.sign(q.side) * c : Math.sign(q.fore) * s,
        ny = sideFace ? Math.sign(q.side) * s : -Math.sign(q.fore) * c,
        inward = Math.max(0, b.vx * nx + b.vy * ny),
        speed = inward + (Math.abs(b.turn || 0) * spec.length) / 2;
      if (touch && !rock.hullTouch && w.time >= (rock.nextHullHit || 0)) {
        collisionDamage(w, { speed, severity: rock.severity, cause: rock.kind });
        rock.nextHullHit = w.time + 2;
        if (speed > 0.8) w.effects.push({ type: 'ground', x: pose.x, y: pose.y });
      }
      if (drive && !rock.driveTouch && w.time >= (rock.nextDriveHit || 0)) {
        collisionDamage(w, {
          speed,
          severity: rock.severity,
          cause: `${rock.kind} at stern drive`,
          hull: false,
          propulsion: true,
        });
        rock.nextDriveHit = w.time + 2;
      }
      rock.hullTouch = !!touch;
      rock.driveTouch = !!drive;
      // Permit reversing out of an existing overlap; block entry and rotation.
      if (
        (i > 0 && !logContact(previous, rock, false, spec)) ||
        inward > 0 ||
        Math.abs(b.turn || 0) > 0.001
      ) {
        Object.assign(b, poses[Math.max(0, i - 1)]);
        b.vx -= nx * inward;
        b.vy -= ny * inward;
        b.turn = 0;
        blocked = true;
      }
    }
    if (blocked) {
      const flow = currentAt(w, b.x, b.y);
      b.speed = (b.vx - flow.x) * Math.sin(b.heading) - (b.vy - flow.y) * Math.cos(b.heading);
      break;
    }
  }
  for (const rock of nearby) {
    if (!logContact(b, { ...rock, radius: rock.radius + 0.3 }, false, spec))
      rock.hullTouch = rock.driveTouch = false;
  }
}
