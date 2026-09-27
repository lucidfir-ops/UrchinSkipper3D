// Designer-selected originals. Stable IDs are shared by shops, sprites and traffic.
export const VESSEL_FAMILIES = [
  ['basic', 'harbour workhorse', 'harbour workhorse3'],
  ['thruster', 'coastal workhorse', 'coastal workhorse2'],
  ['sterndrive', 'reef runner', 'reef runner2'],
  ['outboard', 'island tender', 'island tender2'],
  ['jet', 'shoal skipper', 'shoal skipper2'],
  ['twinjet', 'channel master', 'channel master2'],
];
export const RIVAL_ART = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14].map((n) => `rival-${n}`);
export const TAXI_ART = [1, 3, 4, 5].map((n) => `taxi-${n}`);
export const DFO_ART = [1, 2, 3].map((n) => `dfo-${n}`);
export const NINE_ART = ['03-r1-c3', '06-r2-c3', '07-r3-c1', '08-r3-c2', '09-r3-c3'].map(
  (n) => `nine-${n}`,
);
const files = Object.fromEntries(
  VESSEL_FAMILIES.flatMap(([id, first, second]) => [
    [id, first],
    [id + '-sister', second],
  ]),
);
for (const id of RIVAL_ART) files[id] = id.replace('-', '');
for (const id of TAXI_ART) files[id] = id.replace('-', '');
for (const id of DFO_ART) files[id] = id.replace('dfo-', 'dfoboat');
for (const id of NINE_ART) files[id] = id.replace('nine-', 'nine-ships-');
export const VESSEL_ART = Object.freeze(
  Object.fromEntries(
    Object.entries(files).map(([id, name]) => [
      id,
      `./assets/fleet/${encodeURIComponent(name)}.png`,
    ]),
  ),
);
// The repaired SVG fleet is an alternate visual treatment only. Three legacy
// Nine Ships sheets have no matching SVG yet, so those retain their originals.
const VECTOR_IDS = new Set(Object.keys(files).filter((id) => !id.startsWith('nine-')));
export const VESSEL_VECTOR_ART = Object.freeze(
  Object.fromEntries(
    Object.entries(files)
      .filter(([id]) => VECTOR_IDS.has(id))
      .map(([id, name]) => [
        id,
        `./assets/fleet-vector/${encodeURIComponent(name.replaceAll(' ', '-'))}-top.svg`,
      ]),
  ),
);
export const boatFamily = (id) => id?.replace(/-sister$/, '') || 'basic';
