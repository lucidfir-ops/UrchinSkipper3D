import { trainingPreparation } from './training-replay.js';
import { crossedReturnBoundary } from './navigation.js';
// New careers alone opt in. The loan-boat lesson has its own 240 m fishery;
// no season stock, purchase money or medical history is spent on day zero.
export const introActive = (w) => w.career?.intro?.status === 'active';
export const introPending = (w) => ['briefing', 'active'].includes(w.career?.intro?.status);
export const INTRO_STEPS = [
  [
    'A little ahead',
    'I’m aboard with you. The green rail is our PORT pickup side; orange marks the dangerous stern. These turn with the boat. Give her a little ahead throttle. On touch, use Ahead or drag the left stick up.',
  ],
  [
    'Feel the rudder',
    'While moving ahead, turn the rudder and watch the bow turn. Leave room: she keeps her throttle and rudder when you release.',
  ],
  [
    'See the whole cove',
    'Zoom out until you can read the water around us. Use Zoom − on touch or your zoom-out control.',
  ],
  [
    'Read our chart',
    'Open Chart. Green marks known ground; pink crosses mark rocks that may be hard to see. Rocks and floating timber are solid hazards: hitting them can damage the hull or exposed drive. This is only a partial survey, so watch for unmarked crowns, wash, and objects in the water. The minimap shows our chart and boat position; select it to open the larger chart. The sounder reads depth only beneath us, including rock tops. Menu → UI / difficulty options toggles each; Arrange UI layout moves or resizes them. Close the chart when ready.',
  ],
  [
    'Find the marked ground',
    'Steer to the green patch northwest of our starting position, then select Neutral. Watch the sounder as we approach.',
  ],
  [
    'Put a diver to work',
    'Deploy Ada or Milo on the marked patch. On touch use Deploy / board; otherwise use your deploy control. Wait for a little catch.',
  ],
  [
    'Bring them alongside',
    'Recall near the bubbles or wait for the float. Bring it into the green pickup sector outside the PORT rail — left when facing the bow. Select Neutral, match its drift, then use Deploy / board. Keep divers away from the orange stern, especially when reversing.',
  ],
  [
    'Scout unmarked water',
    'Now head east along the northern shelf. Look in about 5–11 m of water in this cove, near the eastern kelp, and deploy a diver to scout. Orders can point the search east. There is no chart marker to follow: watch bubbles and the diver’s report. Unmarked ground is often fresher and less worked, so it can hold more and better-quality urchins, but finding it costs time and brings more navigation risk.',
  ],
  [
    'Bring the discovery home',
    'They found fresh ground! Recover your working divers and some catch, keeping the floats on port. In the future you can buy an upgrade that will let you mark the ground you find: the Recording chartplotter keeps ground observations for later trips. To find urchins, look for not too steep a slope, between 5 m and 25 m, but your divers will do better shallower, often near kelp.',
  ],
  [
    'Return through the south edge',
    'That’s the loop: read the water, scout, look after the divers, and bring the catch home. Recover everyone, then drive all the way through the SOUTH edge of the map to return to harbour. Other edges will hold you inside the cove. I’ll cover today’s fuel; once we cross south, we choose your own boat and start day 1. Miss 19:00 offload and your catch lands at 06:00 next morning, with departure at 09:00. You can still fish a shorter day. Continuing late costs fatigue, freshness and safety; night diving needs flashlights. Home Coast only gets weak storms. Later areas have worse conditions, especially the fifth coast: check the forecast before you fish. A falling tide can leave you beached. Wait at sea for rising water or radio for a paid tow.',
  ],
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
