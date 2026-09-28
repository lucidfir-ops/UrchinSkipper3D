// Authored presentation profiles, keyed to every preserved career hull.
// Dimensions and collision/working-deck geometry always come from boatSpec.
export const FLEET_PROFILES = {
  basic: { cabin: 0.4, cabinWidth: 0.69, cabinHeight: 2.18, trim: '#76847c', type: 'alloy' },
  'basic-sister': {
    cabin: 0.31,
    cabinWidth: 0.65,
    cabinHeight: 2.12,
    trim: '#957044',
    type: 'timber',
  },
  thruster: { cabin: 0.31, cabinWidth: 0.67, cabinHeight: 2.32, trim: '#c99b39', type: 'utility' },
  'thruster-sister': {
    cabin: 0.29,
    cabinWidth: 0.72,
    cabinHeight: 2.5,
    trim: '#b64b3c',
    type: 'tug',
  },
  sterndrive: {
    cabin: 0.28,
    cabinWidth: 0.71,
    cabinHeight: 1.95,
    trim: '#376c83',
    type: 'landing',
  },
  'sterndrive-sister': {
    cabin: 0.3,
    cabinWidth: 0.64,
    cabinHeight: 2.16,
    trim: '#c5a236',
    type: 'utility',
  },
  outboard: {
    cabin: 0.3,
    cabinWidth: 0.62,
    cabinHeight: 1.85,
    trim: '#df742f',
    type: 'rib',
    motors: 2,
  },
  'outboard-sister': {
    cabin: 0.28,
    cabinWidth: 0.66,
    cabinHeight: 1.95,
    trim: '#a0b2ac',
    type: 'alloy',
    motors: 1,
  },
  jet: { cabin: 0.25, cabinWidth: 0.62, cabinHeight: 1.98, trim: '#7c8b80', type: 'utility' },
  'jet-sister': {
    cabin: 0.3,
    cabinWidth: 0.7,
    cabinHeight: 2.24,
    trim: '#c4a348',
    type: 'utility',
  },
  twinjet: { cabin: 0.34, cabinWidth: 0.79, cabinHeight: 2.65, trim: '#a8b4ae', type: 'catamaran' },
  'twinjet-sister': {
    cabin: 0.3,
    cabinWidth: 0.75,
    cabinHeight: 2.52,
    trim: '#708890',
    type: 'catamaran',
    solar: true,
  },
};

export function fleetProfile(id, role = 'player') {
  const profile = FLEET_PROFILES[id] || FLEET_PROFILES.basic;
  return role === 'taxi'
    ? { ...profile, cabin: 0.53, trim: '#d9a447' }
    : role === 'dfo'
      ? { ...profile, type: 'rib', trim: '#b73c32' }
      : profile;
}
