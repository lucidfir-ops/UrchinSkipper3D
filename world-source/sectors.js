// Authoritative, synthetic authoring recipes. All coordinates are local metres;
// these places are invented and contain no commercial fishing-location data.
const tideCurve = {
  mean: 1.15,
  components: [
    { amplitude: 1.35, periodMinutes: 745, peakMinute: 675 },
    { amplitude: 0.25, periodMinutes: 1490, peakMinute: 410 },
  ],
};
const currentCurve = {
  mean: 0,
  components: [
    { amplitude: 0.94, periodMinutes: 745, peakMinute: 590 },
    { amplitude: 0.06, periodMinutes: 372.5, peakMinute: 645 },
  ],
};
export const RECIPES = [
  {
    id: 'near',
    name: 'Sheltered Kelp',
    seed: 260901,
    size: 600,
    spacing: 3,
    travelMinutes: 60,
    chart: { x: 215, y: 220 },
    harbourEdge: 'south',
    entry: { x: 300, y: 560 },
    description: 'A broad kelp basin, shallow shelves and quiet island pockets.',
    character: 'Sheltered basin',
    flowLabel: 'Gentle main flow · quiet lee pockets',
    coast: 'west-north',
    shoreSlope: 0.43,
    cliffs: [{ x: 450, y: 115, radius: 65, slope: 2.4 }],
    islands: [
      { x: 145, y: 180, rx: 63, ry: 48 },
      { x: 448, y: 160, rx: 66, ry: 52 },
      { x: 470, y: 470, rx: 45, ry: 60 },
    ],
    reefs: [
      { x: 355, y: 225, rx: 29, ry: 18, top: 0.15, slope: 0.32 },
      { x: 128, y: 447, rx: 25, ry: 45, top: -0.4, slope: 0.4 },
    ],
    shelves: [{ x: 290, y: 375, rx: 154, ry: 130, top: 12, slope: 0.2 }],
    bowls: [{ x: 300, y: 320, rx: 85, ry: 54, depth: 8 }],
    lab: { x: 193, y: 273, dx: 74, dy: 70 },
    flow: { x: 0.2, y: -0.38 },
    channels: [{ a: { x: 290, y: 550 }, b: { x: 310, y: 135 }, width: 64, gain: 0.22 }],
    shelters: [
      { x: 188, y: 224, rx: 53, ry: 43, calm: 0.88 },
      { x: 435, y: 510, rx: 48, ry: 42, calm: 0.86 },
    ],
    eddies: [
      { x: 200, y: 230, radius: 44, spin: 0.21, convergence: 0.055 },
      { x: 412, y: 474, radius: 40, spin: -0.19, convergence: 0.045 },
    ],
    environment: {
      model: 'spatial-v1',
      tideCurve,
      currentCurve,
      wind: { x: 0.45, y: -0.2 },
      waves: 0.012,
    },
    landmarks: [
      { x: 145, y: 180, name: 'Kelp Island' },
      { x: 448, y: 160, name: 'Gull Rock' },
      { x: 470, y: 470, name: 'South Shelter' },
    ],
  },
  {
    id: 'middle',
    name: 'South Reef',
    seed: 260902,
    size: 600,
    spacing: 3,
    travelMinutes: 120,
    chart: { x: 430, y: 280 },
    harbourEdge: 'west',
    entry: { x: 35, y: 490 },
    description: 'Braided island channels, a fast throat and back-eddies close to still water.',
    character: 'Island narrows',
    flowLabel: 'Accelerating narrows · split flow · eddies',
    coast: 'none',
    shoreSlope: 0.56,
    cliffs: [
      { x: 335, y: 215, radius: 100, slope: 2.8 },
      { x: 470, y: 510, radius: 55, slope: 2.2 },
    ],
    islands: [
      { x: 188, y: 258, rx: 96, ry: 173 },
      { x: 432, y: 217, rx: 91, ry: 142 },
      { x: 452, y: 488, rx: 76, ry: 47 },
    ],
    reefs: [
      { x: 321, y: 368, rx: 24, ry: 47, top: 0.4, slope: 0.22 },
      { x: 118, y: 470, rx: 30, ry: 28, top: -0.35, slope: 0.34 },
    ],
    shelves: [{ x: 328, y: 260, rx: 40, ry: 100, top: 8, slope: 0.25 }],
    bowls: [{ x: 305, y: 480, rx: 84, ry: 54, depth: 13 }],
    lab: { x: 82, y: 102, dx: 143, dy: 124 },
    flow: { x: 0.16, y: -0.78 },
    channels: [
      { a: { x: 309, y: 436 }, b: { x: 315, y: 90 }, width: 37, gain: 1.45 },
      { a: { x: 510, y: 415 }, b: { x: 550, y: 170 }, width: 42, gain: 0.85 },
    ],
    shelters: [
      { x: 245, y: 432, rx: 51, ry: 50, calm: 0.89 },
      { x: 481, y: 376, rx: 58, ry: 36, calm: 0.9 },
    ],
    eddies: [
      { x: 247, y: 437, radius: 45, spin: 0.46, convergence: 0.075 },
      { x: 485, y: 367, radius: 43, spin: -0.4, convergence: 0.09 },
    ],
    environment: {
      model: 'spatial-v1',
      tideCurve,
      currentCurve,
      wind: { x: 0.55, y: -0.23 },
      waves: 0.017,
    },
    landmarks: [
      { x: 188, y: 250, name: 'Split Island' },
      { x: 432, y: 217, name: 'East Wall' },
      { x: 321, y: 368, name: 'Tidal Saddle' },
    ],
  },
  {
    id: 'far',
    name: 'Outer Ledge',
    seed: 260903,
    size: 600,
    spacing: 3,
    travelMinutes: 180,
    chart: { x: 430, y: 85 },
    harbourEdge: 'south',
    entry: { x: 320, y: 560 },
    description: 'Exposed deep water meets a long reef shoulder, bowls and drying rock.',
    character: 'Exposed reef shelf',
    flowLabel: 'Oblique flow · shelf boundary · sheltered bowl',
    coast: 'east',
    shoreSlope: 0.48,
    cliffs: [
      { x: 560, y: 175, radius: 115, slope: 2.8 },
      { x: 200, y: 160, radius: 60, slope: 2.4 },
    ],
    islands: [
      { x: 218, y: 164, rx: 34, ry: 85 },
      { x: 442, y: 402, rx: 68, ry: 46 },
    ],
    reefs: [
      { x: 325, y: 291, rx: 18, ry: 104, top: 0.2, slope: 0.23 },
      { x: 144, y: 402, rx: 31, ry: 21, top: -0.6, slope: 0.38 },
    ],
    shelves: [{ x: 348, y: 275, rx: 92, ry: 162, top: 7, slope: 0.24 }],
    bowls: [
      { x: 415, y: 261, rx: 61, ry: 74, depth: 14 },
      { x: 257, y: 440, rx: 74, ry: 40, depth: 9 },
    ],
    lab: { x: 103, y: 98, dx: 124, dy: 124 },
    flow: { x: 0.56, y: -0.38 },
    channels: [{ a: { x: 356, y: 474 }, b: { x: 410, y: 147 }, width: 44, gain: 1.35 }],
    shelters: [
      { x: 400, y: 439, rx: 54, ry: 42, calm: 0.92 },
      { x: 232, y: 241, rx: 38, ry: 37, calm: 0.85 },
    ],
    eddies: [
      { x: 399, y: 447, radius: 42, spin: -0.36, convergence: 0.07 },
      { x: 252, y: 227, radius: 30, spin: 0.24, convergence: 0.05 },
    ],
    environment: {
      model: 'spatial-v1',
      tideCurve,
      currentCurve,
      wind: { x: 0.8, y: -0.3 },
      waves: 0.022,
    },
    landmarks: [
      { x: 218, y: 164, name: 'Needle Island' },
      { x: 325, y: 291, name: 'Long Shoulder' },
      { x: 442, y: 402, name: 'Outer Rock' },
    ],
  },
];

// Six separately authored physical maps. Shared construction fields are only
// recipe defaults; each has its own bathymetry, entrances, channels and seed.
const offshore = [
  {
    id: 'storm-channel',
    name: 'Stormbreak Channel',
    seed: 260911,
    travelMinutes: 100,
    islands: [
      { x: 166, y: 235, rx: 71, ry: 145 },
      { x: 420, y: 295, rx: 83, ry: 135 },
      { x: 145, y: 490, rx: 35, ry: 30 },
    ],
    reefs: [{ x: 298, y: 175, rx: 24, ry: 60, top: -0.3, slope: 0.28 }],
    shelves: [{ x: 283, y: 400, rx: 68, ry: 80, top: 8, slope: 0.23 }],
    channels: [{ a: { x: 295, y: 550 }, b: { x: 305, y: 70 }, width: 46, gain: 1.8 }],
    flow: { x: 0.32, y: -0.88 },
    entry: { x: 300, y: 560 },
    description:
      'A long tidal channel between steep islands. Shelves offer respite from the central race.',
  },
  {
    id: 'storm-sound',
    name: 'Gale Sound',
    seed: 260912,
    travelMinutes: 125,
    islands: [
      { x: 130, y: 130, rx: 67, ry: 65 },
      { x: 360, y: 200, rx: 110, ry: 53 },
      { x: 215, y: 420, rx: 75, ry: 100 },
      { x: 470, y: 450, rx: 36, ry: 58 },
    ],
    reefs: [{ x: 455, y: 240, rx: 28, ry: 40, top: 0.2, slope: 0.32 }],
    shelves: [{ x: 380, y: 355, rx: 70, ry: 70, top: 10, slope: 0.2 }],
    channels: [{ a: { x: 330, y: 550 }, b: { x: 460, y: 90 }, width: 42, gain: 2.05 }],
    flow: { x: 0.85, y: -0.5 },
    entry: { x: 340, y: 560 },
    description:
      'Crosswind and braided passages separate four islands; the eastern race reverses sharply.',
  },
  {
    id: 'storm-cape',
    name: 'Broken Cape',
    seed: 260913,
    travelMinutes: 150,
    islands: [
      { x: 170, y: 185, rx: 96, ry: 75 },
      { x: 460, y: 360, rx: 52, ry: 130 },
      { x: 180, y: 465, rx: 54, ry: 40 },
    ],
    reefs: [{ x: 325, y: 310, rx: 65, ry: 22, top: -0.5, slope: 0.27 }],
    shelves: [{ x: 305, y: 415, rx: 80, ry: 65, top: 8, slope: 0.26 }],
    channels: [{ a: { x: 275, y: 545 }, b: { x: 380, y: 65 }, width: 50, gain: 2.15 }],
    flow: { x: -0.55, y: -0.9 },
    entry: { x: 310, y: 560 },
    description:
      'An exposed cape with a broken transverse reef. Look for safe tide windows around the shoulder.',
  },
  {
    id: 'frontier-reach',
    name: 'Blackwater Reach',
    seed: 260921,
    travelMinutes: 155,
    islands: [
      { x: 125, y: 250, rx: 60, ry: 160 },
      { x: 405, y: 160, rx: 115, ry: 62 },
      { x: 460, y: 440, rx: 63, ry: 80 },
    ],
    reefs: [
      { x: 295, y: 300, rx: 23, ry: 82, top: -0.5, slope: 0.26 },
      { x: 235, y: 480, rx: 30, ry: 22, top: -0.2, slope: 0.3 },
    ],
    shelves: [{ x: 350, y: 425, rx: 50, ry: 70, top: 11, slope: 0.23 }],
    channels: [{ a: { x: 300, y: 550 }, b: { x: 230, y: 85 }, width: 44, gain: 2.6 }],
    flow: { x: -0.4, y: -1.1 },
    entry: { x: 320, y: 560 },
    description:
      'Deep fast water wraps around an uncharted central ridge. Productive pockets lie outside the race.',
  },
  {
    id: 'frontier-teeth',
    name: 'Wreck Teeth',
    seed: 260922,
    travelMinutes: 175,
    islands: [
      { x: 135, y: 175, rx: 57, ry: 98 },
      { x: 300, y: 255, rx: 38, ry: 108 },
      { x: 475, y: 195, rx: 47, ry: 85 },
      { x: 180, y: 470, rx: 78, ry: 36 },
    ],
    reefs: [{ x: 432, y: 405, rx: 60, ry: 24, top: -0.6, slope: 0.26 }],
    shelves: [{ x: 390, y: 300, rx: 40, ry: 100, top: 10, slope: 0.22 }],
    channels: [{ a: { x: 385, y: 540 }, b: { x: 380, y: 65 }, width: 38, gain: 3 }],
    flow: { x: 0.55, y: -1.15 },
    entry: { x: 340, y: 560 },
    description:
      'Narrow slots between long rock teeth funnel powerful currents and gusts. Few rivals attempt them.',
  },
  {
    id: 'frontier-bank',
    name: 'Last Light Bank',
    seed: 260923,
    travelMinutes: 195,
    islands: [
      { x: 150, y: 180, rx: 95, ry: 48 },
      { x: 430, y: 460, rx: 100, ry: 45 },
      { x: 480, y: 180, rx: 30, ry: 85 },
    ],
    reefs: [
      { x: 295, y: 300, rx: 100, ry: 20, top: -0.4, slope: 0.24 },
      { x: 120, y: 395, rx: 30, ry: 58, top: -0.3, slope: 0.32 },
    ],
    shelves: [{ x: 325, y: 385, rx: 95, ry: 48, top: 9, slope: 0.24 }],
    channels: [{ a: { x: 245, y: 550 }, b: { x: 385, y: 80 }, width: 55, gain: 3.2 }],
    flow: { x: 0.85, y: -1.05 },
    entry: { x: 255, y: 560 },
    description:
      'A remote bank faces open swell and shifting shelf flow. Rich ground comes with the longest return passage.',
  },
];
for (const [index, area] of offshore.entries()) {
  const tier = index < 3 ? 1 : 2;
  RECIPES.push({
    size: 600,
    spacing: 3,
    coast: 'none',
    shoreSlope: 0.46,
    harbourEdge: 'south',
    chart: { x: 200 + (index % 3) * 145, y: tier === 1 ? 230 : 105 },
    character: tier === 1 ? 'Hard offshore coast' : 'Extremely hard frontier coast',
    flowLabel:
      tier === 1
        ? 'Strong variable races · gusty wind · uncharted crowns'
        : 'Extreme tidal races · shifting gusts · dense uncharted crowns',
    cliffs: [
      { x: area.islands[0].x + area.islands[0].rx, y: area.islands[0].y, radius: 65, slope: 2.8 },
    ],
    bowls: [{ x: 540, y: 300, rx: 35, ry: 65, depth: 8 }],
    lab: { x: 75, y: 75, dx: 140, dy: 140 },
    shelters: [
      { x: area.islands[0].x + 60, y: area.islands[0].y + 65, rx: 65, ry: 65, calm: 0.94 },
    ],
    eddies: [{ x: 360, y: 470, radius: 65, spin: tier === 1 ? 0.55 : 0.8, convergence: 0.07 }],
    environment: {
      model: 'spatial-v1',
      tideCurve,
      currentCurve: {
        ...currentCurve,
        components: [
          ...currentCurve.components,
          { amplitude: tier === 1 ? 0.12 : 0.22, periodMinutes: 210, peakMinute: 550 + index * 21 },
        ],
      },
      wind: { x: 1, y: -0.4 },
      waves: 0.03,
    },
    landmarks: area.islands.map((island, i) => ({
      x: island.x,
      y: island.y,
      name: `${area.name} ${['West Rock', 'High Island', 'East Rock', 'South Islet'][i]}`,
    })),
    ...area,
  });
}

// September 21: additive physical challenge coasts. Drying rims are seabed,
// not invisible barriers; the sounder, chart, current shelter and hull agree.
const extreme = [
  {
    id: 'maelstrom-point',
    name: 'Knifepoint Race',
    seed: 260931,
    travelMinutes: 220,
    islands: [
      { x: 105, y: 250, rx: 48, ry: 215 },
      { x: 205, y: 285, rx: 118, ry: 23 },
      { x: 455, y: 180, rx: 50, ry: 90 },
    ],
    flow: { x: 0.1, y: -2.25 },
    channels: [{ a: { x: 340, y: 570 }, b: { x: 290, y: 30 }, width: 100, gain: 3.3 }],
    description:
      'A wall of current follows the shore. The long headland sheds a different working eddy on flood and ebb. Read the kelp before committing.',
  },
  {
    id: 'maelstrom-garden',
    name: 'Boulder Garden',
    seed: 260932,
    travelMinutes: 245,
    islands: [
      { x: 115, y: 150, rx: 65, ry: 90 },
      { x: 475, y: 415, rx: 54, ry: 90 },
    ],
    flow: { x: 1.8, y: -1.4 },
    tidalBasin: { x: 310, y: 265, radius: 78, rimTop: -3.5, gateTop: -0.45, depth: 12 },
    description:
      'Enter the boulder basin on high water, wait for exposed rocks to shelter the pick, then wait for water to leave. Even jets cannot escape at low tide.',
  },
  {
    id: 'maelstrom-sill',
    name: 'Needle Sluice',
    seed: 260933,
    travelMinutes: 260,
    islands: [
      { x: 120, y: 185, rx: 55, ry: 120 },
      { x: 475, y: 360, rx: 50, ry: 140 },
    ],
    flow: { x: -1.5, y: -1.8 },
    tidalBasin: {
      x: 295,
      y: 265,
      radius: 80,
      rimTop: -3.5,
      gateTop: -0.65,
      depth: 14,
      jetOnly: true,
    },
    description:
      'A shallow gate admits waterjets only near high tide. Cross the race, sound the sill and plan the next tide before working the rich basin.',
  },
  {
    id: 'outer-deep',
    name: 'Seventy Foot Shelf',
    seed: 260941,
    travelMinutes: 300,
    islands: [
      { x: 135, y: 230, rx: 45, ry: 155 },
      { x: 430, y: 145, rx: 95, ry: 43 },
      { x: 430, y: 450, rx: 65, ry: 45 },
    ],
    flow: { x: 0.8, y: -2.6 },
    deep: true,
    description:
      'The best product lies at 18–21 metres. Long passages reward speed; repeated deep work rewards nitrox and disciplined surface intervals.',
  },
  {
    id: 'outer-wall',
    name: 'Devil’s Elbow',
    seed: 260942,
    travelMinutes: 330,
    islands: [
      { x: 110, y: 270, rx: 42, ry: 215 },
      { x: 220, y: 230, rx: 130, ry: 22 },
      { x: 470, y: 460, rx: 55, ry: 58 },
    ],
    flow: { x: 0.4, y: -2.8 },
    deep: true,
    channels: [{ a: { x: 380, y: 565 }, b: { x: 380, y: 35 }, width: 130, gain: 4 }],
    description:
      'A remote deep headland behind a tidal conveyor. The lee swaps sides with the current; speed and highly trained divers matter.',
  },
  {
    id: 'outer-vault',
    name: 'The Locked Vault',
    seed: 260943,
    travelMinutes: 360,
    islands: [
      { x: 105, y: 140, rx: 45, ry: 88 },
      { x: 480, y: 440, rx: 45, ry: 92 },
    ],
    flow: { x: 1.6, y: -2.4 },
    tidalBasin: {
      x: 310,
      y: 260,
      radius: 95,
      rimTop: -3.7,
      gateTop: -0.65,
      depth: 19,
      jetOnly: true,
    },
    deep: true,
    description:
      'Jet access, a distant harbour, deep premium picking and a drying gate. Enter high, fish low, leave on the rise. Night gear and rested crew may be essential.',
  },
];
for (const [index, area] of extreme.entries()) {
  const basin = area.tidalBasin;
  RECIPES.push({
    size: 600,
    spacing: 3,
    coast: 'none',
    shoreSlope: 0.42,
    harbourEdge: 'south',
    entry: { x: 310, y: 568 },
    chart: { x: 100 + (index % 3) * 170, y: 100 },
    character: index < 3 ? 'Expert tidal coast' : 'Extreme remote coast',
    flowLabel: basin
      ? 'Drying sill · high-water entry · low-water shelter · rising-water exit'
      : 'Shoreline current wall · reversing headland eddies · deep shelter',
    reefs: [{ x: 490, y: 265, rx: 25, ry: 45, top: -1.5, slope: 0.35 }],
    shelves: area.deep
      ? [{ x: 320, y: 375, rx: 130, ry: 95, top: 18.5, slope: 0.08 }]
      : [{ x: 270, y: 450, rx: 90, ry: 42, top: 10, slope: 0.2 }],
    bowls: [],
    lab: { x: 60, y: 60, dx: 130, dy: 130 },
    cliffs: [
      { x: area.islands[0].x + area.islands[0].rx, y: area.islands[0].y, radius: 52, slope: 2.8 },
    ],
    channels: [{ a: { x: 345, y: 565 }, b: { x: 400, y: 45 }, width: 85, gain: 3.5 }],
    shelters: [
      { x: 240, y: 335, rx: 75, ry: 45, calm: 0.96 },
      { x: 240, y: 205, rx: 75, ry: 45, calm: 0.96 },
    ],
    eddies: [
      { x: 245, y: 330, radius: 55, spin: 1.1, convergence: 0.09 },
      { x: 245, y: 195, radius: 48, spin: -1.1, convergence: 0.08 },
    ],
    environment: {
      model: 'spatial-v1',
      tideCurve: basin?.jetOnly
        ? { mean: 1, components: [{ amplitude: 1, periodMinutes: 745, peakMinute: 590 }] }
        : tideCurve,
      currentCurve,
      wind: { x: 1.3, y: -0.5 },
      waves: 0.035,
    },
    landmarks: area.islands.map((p, i) => ({
      x: p.x,
      y: p.y,
      name: `${area.name} ${['Headland', 'Point', 'Outer Rock'][i]}`,
    })),
    ...area,
  });
}
