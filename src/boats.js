import { C } from './config.js';
import { enabledEquipment } from './equipment-controls.js';
import { FLEET, ECONOMY } from './career-data.js';
import { depthAt } from './terrain.js';
import { currentAt } from './environment.js';

// Small composable drive packages on one test hull. Keep the original tuning
// live through C.boat; future hull/modules can compose the same spec boundary.
export const BOATS = [
  {
    id: 'basic',
    name: 'Harbour Workhorse',
    drive: 'Conventional shaft',
    tag: 'YOUR ORIGINAL BOAT',
    colour: 0xd9d2ac,
    accent: '#ceb889',
    handling: 2,
    shallow: 2,
    protection: 4,
    cost: 1,
    description:
      'The confirmed baseline. Persistent rudder, a useful middle-speed sweet spot, wide fast turns and modest reverse authority.',
    controls: 'Right stick: rudder · Left stick up/down: throttle.',
    spec: {},
    damageFactor: 0.2,
    repairHours: 24,
    repairCost: 1800,
  },
  {
    id: 'thruster',
    name: 'Coastal Workhorse',
    drive: 'Shaft + electric bow thruster',
    tag: 'LOW-SPEED CONTROL',
    colour: 0xd6dfd7,
    accent: '#8ac8b9',
    handling: 3,
    shallow: 2,
    protection: 4,
    cost: 1.05,
    description:
      'A larger coastal hull with a fitted bow thruster. Swing into position at idle, then release the thruster to coast.',
    controls: 'Hold bow thruster: {thrustPort} / {thrustStarboard}. Right stick remains rudder.',
    spec: { bowThrusterStrength: 1.05, bowThrusterFadeStart: 1.2, bowThrusterFadeEnd: 3.1 },
    damageFactor: 0.2,
    repairHours: 24,
    repairCost: 1800,
  },
  {
    id: 'sterndrive',
    name: 'Reef Runner',
    drive: 'Steerable leg / sterndrive',
    tag: 'AGILE / EXPOSED DRIVE',
    colour: 0xd5dfde,
    accent: '#d9a369',
    handling: 4,
    shallow: 2,
    protection: 1,
    cost: 1.25,
    description:
      'Vector the thrust for tight low-speed turns and strong reverse steering. Log strikes can destroy the exposed leg; shoal grounding constrains motion without damage.',
    controls:
      'Right stick: steer the drive. Turning authority follows engine thrust in forward and reverse.',
    spec: {
      acceleration: 1.35,
      reverseSpeed: 2.2,
      rudderEffectiveness: 0.54,
      reversePropWalk: 0,
      vectorDrive: true,
      turnResponse: 2.4,
    },
    damageFactor: 1.8,
    catastrophicRisk: 0.72,
    repairHours: 48,
    repairCost: 12000,
  },
  {
    id: 'outboard',
    name: 'Island Tender',
    drive: 'Outboard',
    tag: 'AGILE / QUICKER REPAIR',
    colour: 0xb8c6cf,
    accent: '#8fb6d5',
    handling: 4,
    shallow: 2,
    protection: 2,
    cost: 2.1,
    description:
      'A light, economical boat with agile thrust steering. An exposed motor is still vulnerable, but a replacement is much quicker than a leg repair.',
    controls: 'Right stick: steer the outboard. Reverse turns follow thrust direction.',
    spec: {
      acceleration: 1.4,
      reverseSpeed: 2.2,
      rudderEffectiveness: 0.55,
      reversePropWalk: 0,
      vectorDrive: true,
      turnResponse: 2.5,
    },
    damageFactor: 1.15,
    catastrophicRisk: 0.32,
    repairHours: 4,
    repairCost: 4500,
  },
  {
    id: 'jet',
    name: 'Shoal Skipper',
    drive: 'Single waterjet',
    tag: 'SHALLOW-WATER SPECIALIST',
    colour: 0xcbd8d2,
    accent: '#90d3bc',
    handling: 4,
    shallow: 5,
    protection: 5,
    cost: 1.5,
    description:
      'Shallow water access with half the conventional minimum depth, a protected pump and strong nozzle steering. A hard-over nozzle provides a wider pivot than twin differential jets.',
    controls:
      'Right stick left/right: nozzle steering; up/down: hard-over jet pivot. Left stick sideways operates a fitted bow thruster.',
    spec: {
      draft: 0.95,
      groundingRelease: 0.1,
      contactSkin: 0.025,
      acceleration: 1.5,
      reverseSpeed: 2,
      rudderEffectiveness: 0.62,
      reversePropWalk: 0,
      vectorDrive: true,
      turnResponse: 2.7,
      jetCount: 1,
      pivotRate: 0.2,
    },
    damageFactor: 0.006,
    catastrophicRisk: 0,
    repairHours: 72,
    repairCost: 6000,
  },
  {
    id: 'twinjet',
    name: 'Channel Master',
    drive: 'Twin waterjets',
    tag: 'DOCKING AUTHORITY',
    colour: 0xdedbd1,
    accent: '#edc87e',
    handling: 5,
    shallow: 5,
    protection: 5,
    cost: 1.9,
    description:
      'Two protected jets combine differential thrust and reverse buckets for a near-stationary pivot. Shallow water access with conspicuous docking control.',
    controls:
      'Hold neutral pivot port/starboard: {pivotPort} / {pivotStarboard}. Right stick left/right: nozzles. Fitted bow thruster: {thrustPort} / {thrustStarboard}.',
    spec: {
      draft: 0.95,
      groundingRelease: 0.1,
      contactSkin: 0.025,
      maxSpeed: 15 / C.knotsPerMps,
      acceleration: 1.55,
      reverseSpeed: 2.2,
      rudderEffectiveness: 0.62,
      reversePropWalk: 0,
      vectorDrive: true,
      turnResponse: 3,
      jetCount: 2,
      pivotRate: 0.42,
    },
    damageFactor: 0.006,
    catastrophicRisk: 0,
    repairHours: 72,
    repairCost: 10000,
  },
];
const DEFINITIONS = Object.fromEntries(
  BOATS.flatMap((b) => [
    [b.id, b],
    [
      b.id + '-sister',
      {
        ...b,
        id: b.id + '-sister',
        name: b.name + ' II',
        tag: 'SISTER VESSEL',
        description:
          b.description +
          ' An independently fitted sister hull: compare its deck, tank, speed and contact depth before buying.',
      },
    ],
  ]),
);
export const boatDefinition = (id) => DEFINITIONS[id] || BOATS[0];
export function boatSpec(w) {
  const spec = { ...C.boat, ...boatDefinition(w.boat.configuration).spec };
  if (w.career) {
    Object.assign(spec, FLEET[w.boat.configuration]);
    const gear = enabledEquipment(w);
    if (gear.includes('tank'))
      spec.fuelCapacity +=
        w.career.fleet[w.boat.configuration].auxTankLitres ?? ECONOMY.auxTankLitres;
    if (gear.includes('bowthruster')) Object.assign(spec, boatDefinition('thruster').spec);
    if (w.career.fleet[w.boat.configuration]?.disabledEquipment?.includes('bowthruster'))
      spec.bowThrusterStrength = 0;
    spec.turnResponse *= spec.maneuverability ?? 1;
    spec.rudderEffectiveness *= spec.maneuverability ?? 1;
    if (spec.pivotRate) spec.pivotRate *= spec.maneuverability ?? 1;
    // Faster career hulls change rudder command more promptly; baseline stays exact.
    spec.rudderRate *=
      1 + Math.max(0, FLEET[w.boat.configuration].maxSpeed * C.knotsPerMps - 10) * 0.04;
    spec.acceleration *= 1 / (1 + (Math.max(0, w.boat.fuel) * 0.84) / spec.mass);
    if (gear.includes('stabilizer')) spec.waveTolerance *= 1.5;
    const load = Math.min(1, w.catch / spec.capacity);
    // Displacement and cargo retain momentum through neutral/braking and turns.
    // Hull exposure also grows with size; environmental response is deliberately
    // stronger on large working boats, while cargo adds inertia, not windage.
    const inertia = Math.sqrt(spec.mass / C.boat.mass) * (1 + load * 0.35);
    spec.environmentResponse = Math.sqrt((spec.length * spec.width) / 40);
    spec.drag /= inertia;
    spec.lateralDrag *= spec.environmentResponse / Math.sqrt(inertia);
    spec.turnResponse /= inertia;
    spec.rudderEffectiveness /= Math.sqrt(inertia);
    spec.windage *= spec.environmentResponse;
    spec.acceleration *= 1 - load * 0.3;
    spec.maxSpeed =
      spec.loadedSpeed === undefined
        ? spec.maxSpeed * (1 - load * 0.12)
        : spec.maxSpeed * (1 - load) + spec.loadedSpeed * load;
  }
  return spec;
}
export function boatSwapStatus(w, id) {
  if (w.career)
    return { ok: false, reason: 'Use the career boatyard to acquire or fit an owned boat.' };
  const definition = BOATS.find((b) => b.id === id);
  if (!definition) return { ok: false, reason: 'UNKNOWN BOAT' };
  if (w.day.phase !== 'planning')
    return {
      ok: false,
      reason: 'BOATYARD FITTING IS BEFORE DEPARTURE — START A NEW DAY TO CHANGE BOAT',
    };
  if (!w.divers.every((d) => d.state === 'ready'))
    return { ok: false, reason: 'BRING BOTH DIVERS ABOARD BEFORE A TEST SWAP' };
  const local = currentAt(w, w.boat.x, w.boat.y);
  if (
    Math.hypot(w.boat.vx - local.x, w.boat.vy - local.y) > 1.4 ||
    Math.abs(w.boat.throttle) > 0.01
  )
    return { ok: false, reason: 'SELECT NEUTRAL AND SLOW DOWN BEFORE A TEST SWAP' };
  const spec = { ...C.boat, ...definition.spec },
    b = w.boat;
  if (w.day.phase !== 'planning')
    for (const side of [-spec.width / 2, 0, spec.width / 2])
      for (const fore of [-spec.length / 2, 0, spec.length / 2]) {
        if (
          depthAt(
            w,
            b.x + side * Math.cos(b.heading) + fore * Math.sin(b.heading),
            b.y + side * Math.sin(b.heading) - fore * Math.cos(b.heading),
          ) < spec.draft
        )
          return {
            ok: false,
            reason: `THIS BOAT NEEDS ${spec.draft.toFixed(1)} m UNDER THE HULL — MOVE TO DEEPER WATER`,
          };
      }
  return { ok: true, definition };
}
export function fitBoat(w, id) {
  const status = boatSwapStatus(w, id);
  if (!status.ok) return status;
  Object.assign(w.boat, {
    configuration: id,
    hullHealth: 1,
    driveHealth: 1,
    impactCount: 0,
    thruster: 0,
    throttle: 0,
    rudder: 0,
    turn: 0,
    fuel: C.boat.fuelCapacity,
  });
  if (w.day.phase !== 'planning') {
    w.day.assisted = true;
    w.day.boatTrials = true;
  }
  w.events.push(
    `${status.definition.name.toUpperCase()} READY — ${w.day.phase === 'planning' ? 'BOATYARD FITTED' : 'ASSISTED TEST SWAP / DRIVE SERVICED'}`,
  );
  return { ok: true };
}
