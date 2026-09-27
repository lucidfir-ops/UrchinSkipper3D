import { boatDefinition, boatSpec } from './boats.js';
import { FLEET, UPGRADES, ECONOMY } from './career-data.js';
import { updateWeather } from './weather.js';

export const ARCADE_SHOWCASES = [
  ...Object.keys(FLEET).map((boatId) => ({
    id: `boat-${boatId}`,
    label: `${boatDefinition(boatId).name} · controls showcase`,
    boatId,
    scenario: 'boat',
  })),
  {
    id: 'options',
    label: 'Equipment & extra options showcase',
    scenario: 'options',
    equipment: UPGRADES.map((upgrade) => upgrade.id),
  },
  {
    id: 'risk-reward',
    label: 'Later areas · risk / reward showcase',
    scenario: 'risk-reward',
    equipment: ['forecast', 'radar', 'scanner', 'plotter', 'stabilizer'],
  },
  {
    id: 'speed-run',
    label: 'Speed-run strategy showcase',
    boatId: 'outboard',
    scenario: 'speed-run',
    equipment: ['plotter', 'scanner', 'tank'],
  },
];

function showcaseVessel(id, source) {
  const vessel = structuredClone(source?.fleet?.[id]) || {
    id,
    hullHealth: 1,
    driveHealth: 1,
    fuel: FLEET[id].fuelCapacity,
    equipment: [],
    lost: false,
  };
  vessel.id = id;
  vessel.hullHealth = vessel.driveHealth = 1;
  vessel.fuel = FLEET[id].fuelCapacity;
  vessel.lost = false;
  return vessel;
}

export function createTrainingCareer(source, options = {}) {
  const c = structuredClone(source),
    boatId = FLEET[options.boatId] ? options.boatId : c.activeBoat,
    vessel = showcaseVessel(boatId, source);
  if (options.equipment) {
    vessel.equipment = [
      ...new Set(options.equipment.filter((id) => UPGRADES.some((u) => u.id === id))),
    ];
    if (vessel.equipment.includes('tank')) vessel.auxTankLitres = ECONOMY.auxTankLitres;
  }
  c.fleet[boatId] = vessel;
  c.activeBoat = boatId;
  c.sandbox = true;
  c.trainingReplay = true;
  c.trainingScenario = options.scenario || 'boat';
  c.day = 0;
  c.assists.frankOverlay = true;
  c.intro = { status: 'active', step: 0, prepIndex: 0 };
  c.trafficSettings = { rate: 0 };
  delete c.training;
  delete c.testConditions;
  return c;
}

export function trainingLessons(w) {
  if (!w.career?.trainingReplay) return [];
  const spec = boatSpec(w),
    boat = boatDefinition(w.boat.configuration),
    scenario = w.career.trainingScenario || 'boat';
  const lessons = [
    [
      `Your ${boat.name}`,
      `${boat.controls} Practise a slow turn and reverse here. Throttle and rudder hold their last command; Neutral and Centre rudder reset them. This unlocked arcade showcase is a practice copy: no boat or equipment purchase is required, and your career waits unchanged.`,
    ],
  ];
  if (spec.bowThrusterStrength)
    lessons.push([
      'Bow thruster',
      'Select Neutral, then move the left stick sideways to push the bow. Throttle and bow thrust cannot run together. Try both directions and watch the bow swing before continuing.',
    ]);
  if (spec.pivotRate)
    lessons.push([
      'Twin-jet pivot',
      'With Neutral selected, move the right stick up/down to turn on the jets. Left-stick sideways still operates the bow thruster. Try turning on the spot, then centre the controls.',
    ]);
  if (scenario === 'options')
    lessons.push([
      'Extra options',
      'This machine has every equipment option fitted for demonstration. Open Chart, Weather & equipment, UI / difficulty options, and Arrange UI layout to compare information and controls. Nothing fitted here is bought or carried back to your career.',
    ]);
  if (scenario === 'risk-reward')
    lessons.push([
      'Later-area risk and reward',
      'Home Coast contains Sheltered Kelp (day 1), South Reef (day 3) and Outer Ledge (day 5); all are included. A $12,000 Stormbreak Coast permit opens three harder maps; $30,000 buys Frontier Coast with three extremely hard maps. Maelstrom Coast ($60,000) adds races and drying boulder basins; Outer Reaches ($100,000) adds remote deep ground and jet-only tidal gates. Even a jet cannot escape a dry basin: enter high, pick low and wait for rising water. Each coast follows the same 1/3/5 openings. Later coasts have richer ground, higher prices and fewer rivals, but variable races, gusts, uncharted rocks and longer passages demand fuel and recovery reserves. Check the forecast and set a turn-back time.',
    ]);
  if (scenario === 'speed-run')
    lessons.push([
      'Speed-run strategy',
      'A starter-boat push across the original three coasts in season one is an expert ambition, not a guaranteed route to the most expensive boat. Permits cost $42,000 together, competing with boats, fuel and upgrades. Poor catches, injuries or repairs can postpone the push. Repeating Home Coast over several seasons buys time to learn, but worked patches retain depletion; survivors recover slowly and exhausted patches barely recruit. Rotate real grounds, compare net earnings and keep a repair reserve.',
    ]);
  const equipment = w.career.fleet[w.boat.configuration]?.equipment || [];
  for (const upgrade of UPGRADES.filter(
    (u) => equipment.includes(u.id) && u.id !== 'bowthruster',
  )) {
    const practice = {
      plotter:
        'Open Chart after moving to see your recorded track. During the coming scouting lesson, bring your discovery back to the boat.',
      radar:
        'Look in Weather and equipment for surface returns. A clear cove may have none; radar does not show underwater divers.',
      scanner:
        'Move slowly towards the shelf and watch the ahead-depth samples in Weather and equipment change.',
      nitrox:
        'Watch air and readiness during the diving lesson. Extra allowance does not remove the need for surface recovery.',
      hoist: 'During the pickup lesson, try Bag / send down and watch the handling progress.',
      glasses: 'Look at the shallow shelf near the coast. The extra clarity applies in daylight.',
      tank: 'Check fuel in the boat card. The extra tank increases capacity; fuel use still depends on your boat and work.',
      forecast: 'Before a real departure, open Weather & tides for improved forecast confidence.',
      stabilizer:
        'Keep approaches slow even with reduced wave yaw; stabilizers do not cancel wind or current.',
      lights: 'Watch the forward cone and port-side light during the night practice next.',
      torch:
        'The night practice next shows the darker water. Later try deploying after dark; unlit divers would head up at 19:30.',
    }[upgrade.id];
    lessons.push([upgrade.name, `${upgrade.detail} ${practice || ''}`]);
  }
  if (equipment.includes('lights') || equipment.includes('torch'))
    lessons.push([
      'Working at night',
      'It is now 20:00 in this practice cove. Try a slow approach and read the lighted water. Deck lights help recovery; diver flashlights allow night diving. Night work builds fatigue faster. Continue to return to daylight for the usual tutorial.',
    ]);
  return lessons;
}
export function trainingPreparation(w) {
  return trainingLessons(w)[w.career?.intro?.prepIndex || 0];
}
export function syncTrainingLight(w) {
  if (!w.career?.trainingReplay) return;
  const minute = trainingPreparation(w)?.[0] === 'Working at night' ? 1200 : 600;
  if (w.day.minute !== minute) {
    w.day.minute = minute;
    updateWeather(w);
  }
}
