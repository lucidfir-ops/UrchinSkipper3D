import { roll } from './career-data.js';
export const BUYERS = [
  {
    id: 'cooperative',
    name: 'Harbour Co-op',
    target: 3000,
    minQuality: 0.6,
    premium: 0.12,
    sales: 0,
    safeDays: 0,
  },
  {
    id: 'table',
    name: 'Cove Table',
    target: 1500,
    minQuality: 0.8,
    premium: 0.25,
    sales: 0,
    safeDays: 0,
  },
  {
    id: 'premium',
    name: 'Pearl Select',
    target: 3000,
    minQuality: 0.9,
    premium: 0.45,
    sales: 8000,
    safeDays: 3,
  },
  {
    id: 'wholesale',
    name: 'Strait Wholesale',
    target: 10000,
    minQuality: 0.6,
    premium: 0.2,
    sales: 30000,
    safeDays: 6,
  },
];
export function marketOffers(c, day = c.day) {
  return BUYERS.map((buyer, i) => ({
    ...buyer,
    day,
    premium: Math.round((buyer.premium + (roll(c.seed + day, 9203 + i) - 0.5) * 0.06) * 100) / 100,
    unlocked:
      (c.records.totalRevenue || 0) >= buyer.sales && (c.records.safeDays || 0) >= buyer.safeDays,
  }));
}
export function chooseBuyer(w, id) {
  if (w.day.phase !== 'planning') return { ok: false, reason: 'Choose a buyer before sailing.' };
  const offer = marketOffers(w.career).find((o) => o.id === id);
  if (id !== 'standard' && !offer?.unlocked)
    return { ok: false, reason: 'Build the sales and safe-return record shown for this buyer.' };
  w.career.buyerToday = offer ? { ...offer } : null;
  return {
    ok: true,
    reason: offer
      ? `${offer.name} order selected. Part orders earn the bonus per eligible pound; no shortfall fine.`
      : 'Standard market selected. Fish your own plan.',
  };
}
export function prepareBuyer(c) {
  // Preserve a legacy agreement already announced in this save. New days
  // offer a choice rather than silently granting an unlimited premium.
  c.buyerNext ??= null;
}
export function advanceBuyer(c) {
  c.buyerToday = c.buyerNext?.day === c.day ? c.buyerNext : null;
  c.buyerNext = null;
}
export function buyerNotice(c) {
  prepareBuyer(c);
  const offer = (d) =>
    `${d.name ? d.name + ' · ' : ''}${d.target ? 'up to ' + d.target.toLocaleString() + ' landed lb · ' : ''}${Math.round(d.minQuality * 100)}% landed quality · +${Math.round(d.premium * 100)}% price`;
  const tomorrow = c.buyerNext
    ? offer(c.buyerNext)
    : marketOffers(c, c.day + 1)
        .filter((o) => o.unlocked)
        .map(offer)
        .join('; ');
  return `Today: ${c.buyerToday ? offer(c.buyerToday) : 'standard market'}. Tomorrow (day ${c.day + 1}): ${tomorrow}. Choose each day's order before sailing. Lower quality still sells at the standard market price. Catch age can reduce landed quality.`;
}
