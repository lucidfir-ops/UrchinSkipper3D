import { UPGRADES, FLEET } from './career-data.js';

export function enabledEquipment(w) {
  const v = w.career?.fleet[w.boat.configuration];
  return (v?.equipment || []).filter((id) => !v.disabledEquipment?.includes(id));
}
export function toggleEquipment(w, id) {
  const v = w.career?.fleet[w.boat.configuration];
  if (!v?.equipment.includes(id)) return { ok: false, reason: 'Fit this equipment first.' };
  const disabled = (v.disabledEquipment ??= []);
  const enabling = disabled.includes(id);
  if (!enabling && id === 'tank' && w.boat.fuel > FLEET[w.boat.configuration].fuelCapacity)
    return { ok: false, reason: 'Use the auxiliary fuel before isolating that tank.' };
  if (['nitrox', 'torch'].includes(id) && w.divers.some((d) => d.state !== 'ready'))
    return { ok: false, reason: 'Bring both divers aboard before changing their equipment.' };
  if (id === 'hoist' && (w.day.dump || w.divers.some((d) => d.hooking)))
    return { ok: false, reason: 'Finish the deck operation before switching the hauler.' };
  if (enabling) disabled.splice(disabled.indexOf(id), 1);
  else disabled.push(id);
  return {
    ok: true,
    reason: `${UPGRADES.find((u) => u.id === id)?.name || id}: ${enabling ? 'enabled' : 'off'}.`,
  };
}
export const workLightsOn = (w) => !!w.weather?.night && enabledEquipment(w).includes('lights');
