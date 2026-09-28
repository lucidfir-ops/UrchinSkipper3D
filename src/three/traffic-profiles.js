import { RIVAL_ART, TAXI_ART, DFO_ART, NINE_ART } from '../vessel-catalog.js';

// Presentation interpretations of every preserved, designer-selected traffic
// artwork. Stable art IDs, not spawn order or random colours, own these choices.
// Engine family here selects visible machinery only; actor motion, dimensions,
// collision geometry and the rival fleet's actual specifications stay unchanged.
export const TRAFFIC_PROFILES = Object.freeze({
  'rival-1': {
    family: 'basic',
    profile: {
      cabin: 0.32,
      cabinWidth: 0.7,
      cabinHeight: 2.08,
      trim: '#77898b',
      type: 'alloy',
      motors: 0,
      solar: false,
    },
    reference: 'Silver working hull, white forward cabin, open grey stern deck.',
  },
  'rival-2': {
    family: 'thruster',
    profile: {
      cabin: 0.32,
      cabinWidth: 0.66,
      cabinHeight: 2.1,
      trim: '#d4582f',
      type: 'rib',
      motors: 0,
      solar: false,
    },
    reference: 'Orange rescue-style working hull and dark rubbing collar.',
  },
  'rival-3': {
    family: 'sterndrive',
    profile: {
      cabin: 0.31,
      cabinWidth: 0.66,
      cabinHeight: 2.05,
      trim: '#94988a',
      type: 'utility',
      motors: 0,
      solar: false,
    },
    reference: 'Long silver utility hull, narrow bow and port lifting arm.',
  },
  'rival-4': {
    family: 'sterndrive',
    profile: {
      cabin: 0.42,
      cabinWidth: 0.75,
      cabinHeight: 2.12,
      trim: '#a28b65',
      type: 'timber',
      motors: 0,
      solar: false,
    },
    reference: 'Broad varnished timber decks around a large white cruiser cabin.',
  },
  'rival-5': {
    family: 'thruster',
    profile: {
      cabin: 0.29,
      cabinWidth: 0.67,
      cabinHeight: 2.25,
      trim: '#306389',
      type: 'utility',
      motors: 0,
      solar: false,
    },
    reference: 'Blue commercial hull with working rigging around its open stern.',
  },
  'rival-6': {
    family: 'outboard',
    profile: {
      cabin: 0.31,
      cabinWidth: 0.7,
      cabinHeight: 1.94,
      trim: '#3a7297',
      type: 'alloy',
      motors: 2,
      solar: false,
    },
    reference: 'Blue aluminium workboat with two conspicuous black outboards.',
  },
  'rival-7': {
    family: 'basic',
    profile: {
      cabin: 0.25,
      cabinWidth: 0.59,
      cabinHeight: 2.08,
      trim: '#7f623d',
      type: 'timber',
      motors: 0,
      solar: false,
      canopy: true,
    },
    reference: 'Weathered timber working boat, short cabin and patched aft canopy.',
  },
  'rival-8': {
    family: 'thruster',
    profile: {
      cabin: 0.3,
      cabinWidth: 0.75,
      cabinHeight: 2.68,
      trim: '#366b58',
      type: 'utility',
      motors: 0,
      solar: false,
      landingPad: true,
    },
    reference: 'Green utility vessel, tall white bridge and circular aft landing marking.',
  },
  'rival-9': {
    family: 'twinjet',
    profile: {
      cabin: 0.3,
      cabinWidth: 0.74,
      cabinHeight: 2.34,
      trim: '#d1d1c1',
      type: 'catamaran',
      motors: 0,
      solar: true,
    },
    reference: 'White twin hull with separated bows and dark solar panels.',
  },
  'rival-11': {
    family: 'outboard',
    profile: {
      cabin: 0.38,
      cabinWidth: 0.63,
      cabinHeight: 1.97,
      trim: '#383e42',
      type: 'rib',
      motors: 2,
      solar: false,
      timberDeck: true,
    },
    reference: 'Black inflatable collar, timber inset deck and twin outboards.',
  },
  'rival-12': {
    family: 'thruster',
    profile: {
      cabin: 0.23,
      cabinWidth: 0.61,
      cabinHeight: 2.34,
      trim: '#446e45',
      type: 'tug',
      motors: 0,
      solar: false,
    },
    reference: 'Green heavy utility/tug form with a small square wheelhouse.',
  },
  'rival-13': {
    family: 'outboard',
    profile: {
      cabin: 0.28,
      cabinWidth: 0.63,
      cabinHeight: 1.9,
      trim: '#cdd3cb',
      type: 'alloy',
      motors: 2,
      solar: false,
    },
    reference: 'White cruiser shape, long clean foredeck, twin black outboards.',
  },
  'rival-14': {
    family: 'outboard',
    profile: {
      cabin: 0.3,
      cabinWidth: 0.64,
      cabinHeight: 2.02,
      trim: '#8e9590',
      type: 'alloy',
      motors: 2,
      solar: false,
    },
    reference: 'Narrow grey aluminium working hull and twin outboards.',
  },
  'taxi-1': {
    family: 'outboard',
    profile: {
      cabin: 0.39,
      cabinWidth: 0.63,
      cabinHeight: 1.96,
      trim: '#e26d2d',
      type: 'rib',
      motors: 2,
      solar: false,
    },
    reference: 'Bright orange enclosed RIB taxi with twin black outboards.',
  },
  'taxi-3': {
    family: 'jet',
    profile: {
      cabin: 0.33,
      cabinWidth: 0.7,
      cabinHeight: 2.08,
      trim: '#b73835',
      type: 'utility',
      motors: 0,
      solar: false,
    },
    reference: 'Red-railed silver work taxi, broad aft platform and enclosed drive.',
  },
  'taxi-4': {
    family: 'outboard',
    profile: {
      cabin: 0.33,
      cabinWidth: 0.61,
      cabinHeight: 1.91,
      trim: '#383d3c',
      type: 'rib',
      motors: 2,
      solar: false,
      timberDeck: true,
    },
    reference: 'Dark collar, brown-grey planked deck, compact cabin and twin outboards.',
  },
  'taxi-5': {
    family: 'sterndrive',
    profile: {
      cabin: 0.44,
      cabinWidth: 0.71,
      cabinHeight: 2.17,
      trim: '#a99976',
      type: 'timber',
      motors: 0,
      solar: false,
    },
    reference: 'White enclosed passenger launch with varnished timber foredeck.',
  },
  'dfo-1': {
    family: 'outboard',
    profile: {
      cabin: 0.2,
      cabinWidth: 0.47,
      cabinHeight: 1.46,
      trim: '#414848',
      type: 'rib',
      motors: 2,
      solar: false,
      openConsole: true,
    },
    reference: 'Low black RIB, compact open console and two exposed outboards.',
  },
  'dfo-2': {
    family: 'outboard',
    profile: {
      cabin: 0.3,
      cabinWidth: 0.65,
      cabinHeight: 2.02,
      trim: '#797965',
      type: 'utility',
      motors: 2,
      solar: false,
    },
    reference: 'Olive-grey patrol workboat with flat stern deck and twin outboards.',
  },
  'dfo-3': {
    family: 'outboard',
    profile: {
      cabin: 0.29,
      cabinWidth: 0.67,
      cabinHeight: 2.26,
      trim: '#555d65',
      type: 'alloy',
      motors: 2,
      solar: false,
    },
    reference: 'Angular gunmetal patrol hull, raised cabin and twin outboards.',
  },
  'nine-03-r1-c3': {
    family: 'twinjet',
    profile: {
      cabin: 0.4,
      cabinWidth: 0.55,
      cabinHeight: 1.95,
      trim: '#398798',
      type: 'catamaran',
      motors: 0,
      solar: false,
      outriggers: true,
    },
    reference: 'Preserved futuristic silver ship with blue machinery and two side pods.',
  },
  'nine-06-r2-c3': {
    family: 'thruster',
    profile: {
      cabin: 0.31,
      cabinWidth: 0.63,
      cabinHeight: 2.42,
      trim: '#8e3330',
      type: 'utility',
      motors: 0,
      solar: false,
    },
    reference: 'Preserved red/silver machinery vessel with a broad working stern.',
  },
  'nine-07-r3-c1': {
    family: 'basic',
    profile: {
      cabin: 0.23,
      cabinWidth: 0.84,
      cabinHeight: 1.65,
      trim: '#9b343b',
      type: 'timber',
      motors: 0,
      solar: false,
      canopy: true,
      oars: true,
    },
    reference: 'Preserved ornate timber galley, red canopies, gold trim and side oars.',
  },
  'nine-08-r3-c2': {
    family: 'twinjet',
    profile: {
      cabin: 0.35,
      cabinWidth: 0.6,
      cabinHeight: 1.8,
      trim: '#3f6f87',
      type: 'catamaran',
      motors: 0,
      solar: false,
      sailingRig: true,
    },
    reference: 'Preserved blue-and-white sailing multihull with central mast and rigging.',
  },
  'nine-09-r3-c3': {
    family: 'thruster',
    profile: {
      cabin: 0.34,
      cabinWidth: 0.78,
      cabinHeight: 2.95,
      trim: '#a78637',
      type: 'tug',
      motors: 0,
      solar: false,
      machinery: true,
    },
    reference: 'Preserved dark bronze industrial ship, bulky superstructure and machinery.',
  },
});

for (const entry of Object.values(TRAFFIC_PROFILES)) {
  Object.freeze(entry.profile);
  Object.freeze(entry);
}

export function trafficProfile(actor = {}) {
  const match = TRAFFIC_PROFILES[actor.art];
  if (match) return match;
  // Legacy actors can lack an art ID. Keep a sensible stable role default;
  // known assets never pass through this fallback or lose their own appearance.
  const fallback =
    actor.kind === 'taxi'
      ? TAXI_ART[0]
      : actor.kind === 'dfo'
        ? DFO_ART[0]
        : actor.kind === 'rival'
          ? RIVAL_ART[0]
          : NINE_ART[1];
  return TRAFFIC_PROFILES[fallback];
}
