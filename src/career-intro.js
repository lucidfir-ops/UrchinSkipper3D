import { trainingPreparation } from './training-replay.js';
import { crossedReturnBoundary } from './navigation.js';
// New careers alone opt in. The loan-boat lesson has its own 240 m fishery;
// no season stock, purchase money or medical history is spent on day zero.
export const introActive = (w) => w.career?.intro?.status === 'active';
export const introPending = (w) => ['briefing', 'active'].includes(w.career?.intro?.status);
export const INTRO_STEPS = [
  [
    'A little ahead',
    'Give her a little ahead throttle. On touch, drag the left stick up or tap Ahead. The bow is the front of the boat; watch it begin to move.',
  ],
  [
    'Feel the rudder',
    'While moving ahead, turn the rudder and watch the bow turn. Release the control: the rudder and throttle stay where you left them. Leave room for her momentum.',
  ],
  [
    'See the whole cove',
    'Zoom out until you can read the water around us. Use Zoom − on touch or your zoom-out control.',
  ],
  [
    'Read our chart',
    'Open Chart. The gold ring and pointer show our position and heading. Green marks known fishing ground; pink crosses mark charted rocks. Find the green patch northwest of us, then close the chart.',
  ],
  [
    'Find the marked ground',
    'Steer to the green patch northwest of our starting position, then select Neutral. Neutral removes engine thrust; we still drift. The sounder measures water depth directly beneath the boat.',
  ],
  [
    'Put a diver to work',
    'Deploy Ada or Milo here with Deploy / board. Watch the diver enter and descend, then follow the bubbles. Give them a moment to find urchins and collect a little catch.',
  ],
  [
    'Bring them alongside',
    'Recall near the bubbles, or wait for the float. Bring it beside the green PORT rail — the left side when facing the bow (front). Select Neutral, match its drift, then use Deploy / board. Keep the stern (back) away from the diver.',
  ],
  [
    'Scout unmarked water',
    'Head east along the northern shelf, toward the eastern kelp. Look for about 5–11 m on the sounder, then deploy a diver. There is no chart marker here: follow the bubbles and listen for their report.',
  ],
  [
    'Bring the discovery home',
    'They found fresh ground! Bring the floats alongside on port — our left working side. Use Deploy / board to take each diver and their catch aboard. We need everyone aboard before leaving.',
  ],
  [
    'Return through the south edge',
    'Recover everyone, then drive all the way through the SOUTH edge of the map to return to harbour. I’ll cover today’s fuel. Once we get home, we’ll choose your own boat.',
  ],
];
// Optional explanations remain beside the action they explain, rather than
// becoming a final lecture before the player can finish the lesson.
export const INTRO_NOTES = [
  'Bow means front; stern means back. Port is left and starboard is right when facing the bow. These directions turn with the boat.',
  'Water flowing over a rudder turns a shaft-drive boat. Neutral does not stop the boat instantly. Reverse can slow you, but always keep the stern clear of divers.',
  'The camera follows your boat. Zoom close for alongside work and out for navigation.',
  'The chart is a partial survey. Unmarked rocks and floating timber are real hazards. The sounder reads only directly underneath you; it does not scan ahead.',
  'Tide changes the water depth. A falling tide can strand a boat. Reverse toward deeper water if possible, wait for the tide, or call for a paid tow from the radio.',
  'Exactly two divers work from your boat. They search and pick independently. Bubbles mark their presence; the orange float appears when they surface. Night diving requires fitted flashlights.',
  'Deploy / board ends one diver’s operation. Bag work takes and replaces one bag so a ready diver can keep fishing. Both actions automatically choose a diver alongside; portrait selection is for deployment and orders.',
  'Urchins favour workable slopes in roughly 5–25 m, often near kelp. Shallower work is generally quicker. Orders can set a search direction, quality target and time limit.',
  'The Recording chartplotter preserves dated observations. A report tells you what the diver found at that place and time; it does not reveal every hidden bed or guarantee tomorrow’s catch.',
  'The shipping boat leaves at 19:00. Missing it reduces freshness and payable weight, but you decide when to stop fishing. Check the return estimate, fuel and forecast before committing to more work. Home Coast storms are weak; later coasts, especially the fifth, can be much harsher.',
];
export const INTRO_SCOUT_HINT = 'The urchins are east of the patch you can see, right next to it!';
export function tickIntroHint(w, seconds, playing) {
  const intro = w.career?.intro;
  if (!introActive(w) || intro.step !== 7 || !playing) return false;
  const before = intro.scoutSeconds || 0;
  intro.scoutSeconds = Math.min(60, before + Math.max(0, seconds));
  return before < 60 && intro.scoutSeconds >= 60;
}
export function introTerrain() {
  const size = 240,
    spacing = 2.5,
    depths = [];
  for (let y = 0; y <= size; y += spacing)
    for (let x = 0; x <= size; x += spacing) {
      // Islands have finite shores; the map boundary is open water on every side.
      const islands = [
        [48, 46, 19],
        [198, 35, 18],
        [204, 193, 14],
      ];
      const coast = Math.min(
        ...islands.map(
          ([cx, cy, r]) =>
            Math.hypot(x - cx, y - cy) - r - 2 * Math.sin(x * 0.1) * Math.cos(y * 0.08),
        ),
      );
      depths.push(Math.max(-3, Math.min(11, coast * 0.24)));
    }
  const patches = [
    ['lesson-marked', 82, 88, true],
    ['lesson-hidden', 171, 69, false],
  ].map(([id, x, y, charted]) => ({
    id,
    x,
    y,
    charted,
    name: charted ? 'Frank’s marked shelf' : 'Newly scouted shelf',
    radius: 17,
    rate: charted ? 10 : 13,
    quality: charted ? 0.8 : 0.95,
    remaining: charted ? 2400 : 3000,
    initialStock: charted ? 2400 : 3000,
    drop: { x: x + 7, y },
    outline: Array.from({ length: 12 }, (_, i) => ({
      x: x + Math.cos((i * Math.PI) / 6) * 21,
      y: y + Math.sin((i * Math.PI) / 6) * 11,
    })),
    clumps: [-10, 0, 10].map((dx, i) => ({
      id: `${id}-${i}`,
      x: x + dx,
      y,
      radius: 8,
      remaining: charted ? 800 : 1000,
      initialStock: charted ? 800 : 1000,
    })),
  }));
  return {
    version: 'frank-cove-v2',
    size,
    spacing,
    depths,
    patches,
    landmarks: [],
    provenance: { seed: 160926 },
  };
}
export function initializeIntroWorld(w) {
  w.terrain = introTerrain();
  w.patches = w.terrain.patches;
  for (const p of w.patches) {
    const saved = w.career.intro.stock?.find((s) => s.id === p.id);
    if (saved) {
      p.remaining = saved.remaining;
      p.clumps.forEach((c, i) => {
        c.remaining = saved.clumps[i];
      });
    }
  }
  w.environment.model = 'uniform';
  w.environment.current = { x: 0.015, y: 0 };
  w.environment.seaLevel = 0;
  w.career.weatherPlan =
    w.career.trainingScenario === 'risk-reward'
      ? [{ minute: 0, kind: 'rain', bearing: 225 }]
      : [{ minute: 0, kind: 'calm', bearing: 210 }];
  if (w.career.trainingScenario === 'risk-reward') w.environment.current = { x: 0.32, y: 0.12 };
  w.day.phase = 'practice';
  if (!w.career.intro.helpInitialized) {
    w.career.assists.controlsHelp = true;
    w.career.intro.helpInitialized = true;
  }
  w.day.minute = 600;
  w.day.groundId = null;
  w.day.returnExit = { edge: 'south', bearing: 180, label: 'SOUTH' };
  w.day.practiceTimeStart = 0;
  Object.assign(w.boat, { x: 113, y: 164, heading: 0, vx: 0, vy: 0, throttle: 0, rudder: 0 });
  w.divers.forEach((d) => Object.assign(d, { x: w.boat.x, y: w.boat.y, condition: 'fit' }));
  w.debris = [];
  w.logs = [
    {
      id: 'lesson-log',
      x: 188,
      y: 142,
      kind: 'log',
      length: 6,
      radius: 0.3,
      severity: 1,
      heading: 0.7,
      phase: 0,
    },
  ];
  w.rocks = [
    {
      id: 'lesson-charted-rock',
      x: 137,
      y: 119,
      bed: 4,
      kind: 'rock',
      charted: true,
      topDepth: 0.2,
      radius: 1.5,
      length: 0,
      heading: 0,
      severity: 1.35,
    },
    {
      id: 'lesson-visible-rock',
      x: 55,
      y: 132,
      bed: 3,
      kind: 'rock outcrop',
      charted: false,
      topDepth: -1.7,
      radius: 2.1,
      length: 4,
      heading: 0.4,
      severity: 1.65,
    },
  ];
  delete w.logField;
  w.sectorRevision = (w.sectorRevision || 0) + 1;
}
export function rememberIntroStock(w) {
  if (introActive(w))
    w.career.intro.stock = w.patches.map((p) => ({
      id: p.id,
      remaining: p.remaining,
      clumps: p.clumps.map((c) => c.remaining),
    }));
}
export function advanceIntro(w, actions = {}, screen = null) {
  if (!introActive(w) || trainingPreparation(w)) return false;
  const intro = w.career.intro;
  const aboard = w.divers.every((d) => d.state === 'ready');
  if (w.divers.some((d) => d.patch?.id === 'lesson-marked' && d.bag > 0)) intro.markedCatch = true;
  if (w.divers.some((d) => d.patch?.id === 'lesson-hidden' && d.bag > 0)) intro.discovery = true;
  const passed = [
    w.boat.throttle > 0.1,
    Math.abs(w.boat.heading) > 0.08 && Math.abs(w.boat.rudder) > 0.1,
    actions.zoom < 0,
    screen === 'introchart',
    Math.hypot(w.boat.x - 82, w.boat.y - 88) < 28 && Math.abs(w.boat.throttle) < 0.05,
    intro.markedCatch,
    aboard && w.catch > 0,
    intro.discovery,
    aboard && w.catch > (intro.markedLanded || 0),
    aboard && crossedReturnBoundary(w),
  ][intro.step];
  if (!passed) return false;
  if (intro.step === 6) intro.markedLanded = w.catch;
  if (intro.step === INTRO_STEPS.length - 1) {
    intro.departed = true;
    return true;
  }
  intro.step++;
  return true;
}
