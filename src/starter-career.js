import { ECONOMY, FLEET } from './career-data.js';
import { freshVessel, useVessel } from './career-state.js';

export const STARTER_BOATS = ['outboard', 'basic'];
export const harbourScreen = (w) =>
  w.career?.intro?.status === 'briefing'
    ? 'intro'
    : w.career?.starterPending
      ? 'starter'
      : 'harbour';

// Only newly created player careers opt into this transaction. Existing careers
// have already acquired their boats and must never be charged or reset by it.
export function chooseFirstBoat(w, id) {
  const c = w.career;
  if (!c?.starterPending || w.day.phase !== 'planning' || !STARTER_BOATS.includes(id))
    return { ok: false, reason: 'The first-boat choice is only available for a new career.' };
  const price = FLEET[id].price;
  if (c.cash < price) return { ok: false, reason: 'Not enough starting funds for that boat.' };
  c.fleet = { [id]: freshVessel(id) };
  c.cash -= price;
  c.starterPending = false;
  const result = useVessel(w, id);
  c.firstBoat = { id, price, budget: ECONOMY.startCash };
  return result;
}
