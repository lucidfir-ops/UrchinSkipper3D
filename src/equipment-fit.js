import { UPGRADES, RANKS, rankOf, money } from './career-data.js';
import { boatDefinition, boatSpec } from './boats.js';
import { boatFamily } from './vessel-catalog.js';
import { enabledEquipment } from './equipment-controls.js';

// Stations describe physical installation, never capacity. Several compatible
// fittings can share a station, and each hull retains its own purchases.
export const EQUIPMENT_STATIONS = [
  { id: 'bow', name: 'Bow', explanation: 'Front of the boat', x: 50, y: 13 },
  { id: 'console', name: 'Wheelhouse', explanation: 'Navigation and instruments', x: 50, y: 36 },
  { id: 'mast', name: 'Mast', explanation: 'Above the wheelhouse', x: 63, y: 27 },
  {
    id: 'working deck',
    name: 'Port working rail',
    explanation: 'Left side · bags and divers',
    x: 29,
    y: 61,
  },
  { id: 'dive gear', name: 'Dive station', explanation: 'Two divers’ gear', x: 64, y: 57 },
  { id: 'aft deck', name: 'Aft deck', explanation: 'Rear of the boat', x: 64, y: 76 },
  { id: 'hull', name: 'Hull', explanation: 'Below the waterline', x: 25, y: 43 },
  {
    id: 'drive',
    name: 'Engine & drive',
    explanation: 'Engine space or stern motors',
    x: 47,
    y: 88,
  },
];
export const equipmentStation = (item) =>
  EQUIPMENT_STATIONS.find(
    (station) =>
      station.id === (['skipper', 'timepiece'].includes(item?.slot) ? 'console' : item?.slot),
  );
export const equipmentLocation = (item) => equipmentStation(item)?.name || item?.slot || 'Boat';
export function equipmentGroup(item) {
  if (['drive', 'bow', 'hull', 'aft deck'].includes(item.slot)) return 'Propulsion & range';
  if (['working deck', 'dive gear'].includes(item.slot) || item.id === 'lights')
    return 'Deck & diving';
  if (item.slot === 'timepiece' || item.slot === 'skipper') return 'Wheelhouse & personal';
  return 'Navigation & weather';
}
export const EQUIPMENT_GROUPS = [
  'Deck & diving',
  'Propulsion & range',
  'Navigation & weather',
  'Wheelhouse & personal',
];
export function equipmentCatalog() {
  return EQUIPMENT_GROUPS.flatMap((group) =>
    UPGRADES.filter((item) => equipmentGroup(item) === group),
  );
}
export function equipmentAvailability(w, item) {
  if (!item || w.day.phase !== 'planning')
    return { ok: false, label: 'Harbour fitting', reason: 'Fit equipment at harbour.' };
  const vessel = w.career?.fleet[w.boat.configuration];
  if (!vessel || vessel.lost || w.boat.sinking)
    return {
      ok: false,
      label: 'Boat unavailable',
      reason: 'Choose a seaworthy owned boat before fitting equipment.',
    };
  if (item.boats && !item.boats.includes(boatFamily(w.boat.configuration)))
    return {
      ok: false,
      label: 'Incompatible',
      reason: 'This equipment is not compatible with this hull.',
    };
  if (vessel.equipment.includes(item.id)) {
    const state = equipmentOperatingState(w, item);
    return {
      ok: false,
      owned: true,
      label: state,
      reason: `${item.name} is already owned by this boat · ${state.toLowerCase()}.`,
    };
  }
  if (rankOf(w.career) < item.rank) {
    const rank = RANKS[item.rank];
    return {
      ok: false,
      label: `${rank.name} required`,
      reason: `Supplier requires ${rank.name}: ${Math.round(w.career.xp).toLocaleString()} / ${rank.xp.toLocaleString()} experience. Earn experience by landing catch and completing working days.`,
    };
  }
  if (w.career.cash < item.price)
    return {
      ok: false,
      label: `${money(item.price - w.career.cash)} short`,
      reason: `${money(item.price)} fitted; ${money(w.career.cash)} available. Need ${money(item.price - w.career.cash)} more. Financing is available in Harbour accounts.`,
    };
  return {
    ok: true,
    label: 'Ready to fit',
    reason: `Compatible with ${boatDefinition(w.boat.configuration).name}. Price includes installation.`,
  };
}
export function equipmentOperatingState(w, item) {
  const vessel = w.career?.fleet[w.boat.configuration];
  if (!vessel?.equipment.includes(item.id)) return 'Not fitted';
  if (item.slot === 'timepiece')
    return w.career.preferences?.timepiece === item.id
      ? 'Owned · selected face'
      : 'Owned · stored face';
  if (item.fixed) return 'Installed · permanent';
  if (!enabledEquipment(w).includes(item.id)) return 'Installed · switched off';
  return item.id === 'lights' ? 'Installed · automatic at night' : 'Installed · on';
}

export function equipmentBenefit(item) {
  return (
    {
      engine: 'More speed and stronger acceleration; higher fuel use.',
      'fuel-system': '12% less fuel used, with either engine package.',
      hoist: 'A bag exchanged in 2.2 seconds instead of 3.',
      nitrox: 'Longer fictional dive allowance and tank endurance.',
      lights: 'Light the working side and forward water after dark.',
      torch: 'Both divers can work after dark.',
      plotter: 'Keep your depth tracks and reef observations between trips.',
      bowthruster: 'Push the front of the boat sideways at low speed.',
      tank: 'Carry 120 litres more fuel; refuelling is separate.',
      stabilizer: 'Less wave yaw and more comfortable rough-water work.',
      radar: 'Read nearby surface hazards in fog and darkness.',
      forecast: 'Better timing and confidence in the weather outlook.',
      scanner: 'Sample a narrow fan of bottom ahead of the boat.',
      glasses: 'Read nearby shallow reefs more easily in daylight.',
    }[item.id] || 'A new wheelhouse clock face; the time stays the same.'
  );
}

// Compute the real composed specification on a shallow isolated vessel copy;
// inspecting a candidate must never change equipment, fuel, cash or the save.
export function equipmentPreview(w, item) {
  const id = w.boat.configuration,
    vessel = w.career.fleet[id];
  const owned = vessel.equipment.includes(item.id);
  const preview = {
    ...w,
    career: {
      ...w.career,
      fleet: {
        ...w.career.fleet,
        [id]: {
          ...vessel,
          equipment: [...vessel.equipment.filter((fitting) => fitting !== item.id), item.id],
          disabledEquipment: (vessel.disabledEquipment || []).filter(
            (fitting) => fitting !== item.id,
          ),
        },
      },
    },
  };
  const before = boatSpec(w),
    after = boatSpec(preview);
  const rows = [],
    add = (label, from, to, unit, digits = 1) =>
      rows.push({
        label,
        before: `${from.toFixed(digits)} ${unit}`,
        after: `${to.toFixed(digits)} ${unit}`,
      });
  if (['engine', 'fuel-system'].includes(item.id)) {
    add('Speed at this load', before.maxSpeed * 1.943844, after.maxSpeed * 1.943844, 'kn');
    add('Passage fuel', before.travelBurn, after.travelBurn, 'L/h');
    add(
      'Fuel for 10 nautical miles',
      (before.travelBurn * 10) / (before.maxSpeed * 1.943844),
      (after.travelBurn * 10) / (after.maxSpeed * 1.943844),
      'L',
    );
  }
  if (item.id === 'engine') add('Acceleration', before.acceleration, after.acceleration, 'm/s²', 2);
  if (item.id === 'tank') add('Fuel capacity', before.fuelCapacity, after.fuelCapacity, 'L', 0);
  if (item.id === 'stabilizer')
    add('Comfortable waves', before.waveTolerance, after.waveTolerance, 'm');
  if (item.id === 'hoist')
    add('Bag exchange', enabledEquipment(w).includes('hoist') ? 2.2 : 3, 2.2, 's');
  if (item.id === 'nitrox') {
    add('Depth-time allowance', enabledEquipment(w).includes('nitrox') ? 160 : 100, 160, '%', 0);
    add('Tank endurance', enabledEquipment(w).includes('nitrox') ? 120 : 100, 120, '%', 0);
  }
  return { owned, before, after, rows };
}
