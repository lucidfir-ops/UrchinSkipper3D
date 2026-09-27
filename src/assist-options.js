// UI controls remain available regardless of the career's difficulty ceiling.
export const UI_OPTIONS = {
  almanacShortcut: [
    'Tide & current almanac button',
    'A movable shortcut to the almanac, independent of the current instruments. The almanac also remains available from Menu.',
  ],
  timepiece: [
    'Timepiece',
    'A separate ship’s clock. The black red-digit clock is standard; buy other faces in Chandlery → Timepiece. Independent of the clock/offload card.',
  ],
  depthInstrument: [
    'Depth instrument',
    'A separate sounder instrument for depth and keel clearance directly under the boat. Independent of the sounder text card.',
  ],
  compassGauge: ['Compass', 'A separate heading compass.'],
  hullGauge: ['Hull condition gauge', 'A separate hull condition dial.'],
  loadGauge: ['Deck load gauge', 'A separate load dial. Requires Exact deck / diver readouts.'],
  minimap: [
    'Chart minimap',
    'The current area’s chart with your boat position, known ground and pink crosses for charted rocks. Open the larger chart for rock clearance labels. Moving logs and uncharted rocks are not plotted: keep watching the water.',
  ],
  sounder: [
    'Depth sounder',
    'Water depth directly beneath the boat, including tide and rock tops, with clearance below your keel. Works independently of Boat instruments; it does not see ahead.',
  ],
  helmOverlay: [
    'Boat instruments card',
    'Combined heading, speed, local sounder depth, fuel and boat condition. It can be shown with any separate gauge, or hidden while separate gauges remain visible.',
  ],
  speedGauge: [
    'Speed gauge',
    'A separate through-water and over-ground speed gauge, independently movable, resizable and hideable.',
  ],
  throttleGauge: [
    'Throttle / rudder gauge',
    'A separate commanded throttle and rudder display, independently movable, resizable and hideable.',
  ],
  fuelGauge: [
    'Fuel gauge',
    'A separate fuel level and warning display, independently movable, resizable and hideable.',
  ],
  diverCards: [
    'Diver cards',
    'Two independent crew cards below the touch controls. Detailed readings require Diver indicators and Exact readouts; otherwise use the portrait selector.',
  ],
  diverPortraits: [
    'Portrait selector',
    'When Diver indicators are off, show two selectable portraits with no hidden underwater information.',
  ],
  weatherOverlay: [
    'Weather and equipment',
    'Wind, sea state and visibility conditions, plus radar/scanner readings when that equipment is fitted.',
  ],
  clockOverlay: [
    'Clock and offload',
    'The working-day clock, offload deadline and latest departure time.',
  ],
  departureGuidance: [
    'Harbour exit',
    'An arrow, distance and direction to the boundary leading home, available during a working trip.',
  ],
  actionPrompts: [
    'Pickup and action guidance',
    'The currently available recovery action, pickup progress and explanations of why a manoeuvre is unavailable.',
  ],
  controlsHelp: [
    'Controls reference',
    'A compact list of keyboard/controller commands. Touch buttons remain visible independently.',
  ],
  feedbackOverlay: [
    'Recent messages',
    'Recent action and radio messages. The full radio history remains available from Menu.',
  ],
  frankOverlay: [
    'Frank’s lesson',
    'Transparent tutorial text with step controls. Restore it here if you close it during a lesson.',
  ],
};
export const DIFFICULTY_OPTIONS = {
  groundDots: [
    'Ground outlines',
    'Known fishing grounds outlined on the water; colour indicates picking rate and dashes indicate quality. Does not reveal uncharted ground.',
  ],
  chartGrounds: [
    'Chart ground markings',
    'Known ground locations on the chart. Unmarked ground still needs to be scouted.',
  ],
  pickingLegend: [
    'Picking legend',
    'The key explaining ground colours, outlines and picking speeds.',
  ],
  diverIndicators: [
    'Diver indicators',
    'Reveals diver identity, state and location cues. Turn this off for visual bubble/float navigation; portraits can still select a diver.',
  ],
  offscreenArrows: [
    'Off-screen diver arrows',
    'Points towards a relevant diver who has been off screen for a while.',
  ],
  exactLoad: [
    'Exact deck / diver readouts',
    'Exact catch weights, diver air, bag and nitrogen readiness. Off uses observable state and the physical deck.',
  ],
  reefClarity: [
    'Extended reef clarity',
    'Makes the seabed easier to read through the water and on charts.',
  ],
  widePickup: [
    'Wide pickup tolerance',
    'Widens the port-side recovery reach. You still need to approach slowly and match the float’s drift.',
  ],
  currentOverlay: [
    'Live current instruments',
    'The dashboard current arrow and numerical speed/bearing at the boat. Independent of current arrows on the water and the almanac shortcut.',
  ],
  currentArrows: [
    'Current arrows on the water',
    'Shows local flow across the water in Easy. Independent of the dashboard current instrument; off in Realistic on every coast.',
  ],
};
export const OPTION_DETAILS = { ...UI_OPTIONS, ...DIFFICULTY_OPTIONS };
