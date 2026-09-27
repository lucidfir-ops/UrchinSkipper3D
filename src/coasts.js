// Stable physical-place contract. A sector is a playable map; legacy quota beds
// are retained only as stock-pressure history and never stand in for terrain.
export const COASTS = Object.freeze([
  {
    id: 'home',
    name: 'Home Coast',
    difficulty: 'Sheltered to exposed',
    accessCost: 0,
    sectors: ['near', 'middle', 'far'],
  },
  {
    id: 'storm',
    name: 'Stormbreak Coast',
    difficulty: 'Hard',
    accessCost: 12000,
    sectors: ['storm-channel', 'storm-sound', 'storm-cape'],
  },
  {
    id: 'frontier',
    name: 'Frontier Coast',
    difficulty: 'Extremely hard',
    accessCost: 30000,
    sectors: ['frontier-reach', 'frontier-teeth', 'frontier-bank'],
  },
  {
    id: 'maelstrom',
    name: 'Maelstrom Coast',
    difficulty: 'Expert tidal grounds',
    accessCost: 60000,
    sectors: ['maelstrom-point', 'maelstrom-garden', 'maelstrom-sill'],
  },
  {
    id: 'outer',
    name: 'Outer Reaches',
    difficulty: 'Extreme remote grounds',
    accessCost: 100000,
    sectors: ['outer-deep', 'outer-wall', 'outer-vault'],
  },
]);
export const PHYSICAL_AREAS = Object.freeze(
  [
    { id: 'near', name: 'Sheltered Kelp' },
    { id: 'middle', name: 'South Reef' },
    { id: 'far', name: 'Outer Ledge' },
    { id: 'storm-channel', name: 'Stormbreak Channel' },
    { id: 'storm-sound', name: 'Gale Sound' },
    { id: 'storm-cape', name: 'Broken Cape' },
    { id: 'frontier-reach', name: 'Blackwater Reach' },
    { id: 'frontier-teeth', name: 'Wreck Teeth' },
    { id: 'frontier-bank', name: 'Last Light Bank' },
    { id: 'maelstrom-point', name: 'Knifepoint Race' },
    { id: 'maelstrom-garden', name: 'Boulder Garden' },
    { id: 'maelstrom-sill', name: 'Needle Sluice' },
    { id: 'outer-deep', name: 'Seventy Foot Shelf' },
    { id: 'outer-wall', name: 'Devil’s Elbow' },
    { id: 'outer-vault', name: 'The Locked Vault' },
  ].map((area, index) => ({
    ...area,
    coastId: COASTS[Math.floor(index / 3)].id,
    tier: Math.floor(index / 3),
    openDay: [1, 3, 5][index % 3],
  })),
);
export const physicalArea = (id) => PHYSICAL_AREAS.find((area) => area.id === id);
export const coastFor = (id) =>
  COASTS.find((coast) => coast.id === id || coast.sectors.includes(id));
export const coastTier = (id) => physicalArea(id)?.tier || 0;
export function normalizeCoastAccess(c) {
  if (Array.isArray(c.coastAccess)) return;
  // Earlier middle/far permits were sold as later-coast access. Honour those
  // purchases, plus unrestricted pre-permit saves, without changing any stock.
  c.coastAccess = ['home'];
  if (!Array.isArray(c.areaAccess) || c.areaAccess.includes('middle')) c.coastAccess.push('storm');
  if (!Array.isArray(c.areaAccess) || c.areaAccess.includes('far')) c.coastAccess.push('frontier');
}
