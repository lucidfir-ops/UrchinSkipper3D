import { UPGRADES, FLEET } from './career-data.js';

export function enabledEquipment(w) {
  const v = w.career?.fleet[w.boat.configuration];
  return (v?.equipment || []).filter((id) => !v.disabledEquipment?.includes(id));
}
export function toggleEquipment(w, id) {
  const v = w.career?.fleet[w.boat.configuration];
  if (!v?.equipment.includes(id)) return { ok: false, reason: 'Fit this equipment first.' };
  if (id === 'lights') return setWorkLightMode(w, workLightMode(w) === 'off' ? 'auto' : 'off');
  if (UPGRADES.find((item) => item.id === id)?.fixed)
    return { ok: false, reason: 'This is a permanent installation, with no operating switch.' };
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
export function workLightMode(w) {
  const vessel = w.career?.fleet[w.boat.configuration];
  if (!vessel?.equipment.includes('lights') || vessel.disabledEquipment?.includes('lights'))
    return 'off';
  // Pre-existing saves keep their automatic night operation.
  return vessel.workLightMode === 'on' ? 'on' : 'auto';
}
export function setWorkLightMode(w, mode) {
  const vessel = w.career?.fleet[w.boat.configuration];
  if (!vessel?.equipment.includes('lights'))
    return { ok: false, reason: 'Fit deck and working lights first.' };
  if (!['off', 'auto', 'on'].includes(mode))
    return { ok: false, reason: 'Choose OFF, AUTO or ON.' };
  vessel.workLightMode = mode;
  vessel.disabledEquipment = (vessel.disabledEquipment || []).filter((id) => id !== 'lights');
  if (mode === 'off') vessel.disabledEquipment.push('lights');
  return {
    ok: true,
    reason: `Work lights: ${mode.toUpperCase()}${mode === 'auto' ? ' · automatically after dark' : mode === 'on' ? ' · lit in daylight and darkness' : ''}.`,
  };
}
export function workLightStrength(w) {
  const installed = w.career?.fleet[w.boat.configuration]?.equipment || [];
  if (!installed.includes('lights')) return 0;
  return installed.includes('lights-quad') ? 4 : installed.includes('lights-double') ? 2 : 1;
}
export const workLightsOn = (w) =>
  workLightMode(w) === 'on' || (workLightMode(w) === 'auto' && !!w.weather?.night);
export const workLightRange = (w) => (workLightsOn(w) ? 38 * Math.sqrt(workLightStrength(w)) : 16);
