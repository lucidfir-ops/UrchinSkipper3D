import { marketOffers, buyerNotice } from './buyer.js';
import { calculateOffload } from './offload.js';
import { passageMinutes, selectedGround } from './day.js';
import { money } from './career-data.js';

export function workingDayDetail(w, screen) {
  if (screen === 'market') {
    const quote = calculateOffload(
      w,
      w.day.minute + (w.day.phase === 'working' ? passageMinutes(w, selectedGround(w)) : 0),
    );
    return `<h3>Choose today's buyer</h3><p>${buyerNotice(w.career)}</p><p>Orders pay a bonus on qualifying landed pounds up to the stated demand. Partial orders still earn it. Extra or lower-quality catch sells at the standard price. No obligation to fill the boat; no shortfall fine.</p>${marketOffers(
      w.career,
    )
      .map(
        (o) =>
          `<p><strong>${o.name}</strong> · ${o.target.toLocaleString()} landed lb at ${Math.round(o.minQuality * 100)}%+ · +${Math.round(o.premium * 100)}% price<br>${o.unlocked ? 'Contact available' : `Contact needs ${money(o.sales)} lifetime sales and ${o.safeDays} safe returns`}</p>`,
      )
      .join(
        '',
      )}<h3>Return now estimate</h3><p>${Math.round(quote.buyerAccepted).toLocaleString()} qualifying lb · ${money(quote.buyerPremium)} bonus. Shipping age and water loss are included; further fishing and travel change this estimate.</p>`;
  }
  if (screen === 'deck-catch') {
    return `<h3>${Math.round(w.catch).toLocaleString()} lb aboard · ${w.bags.length} bags</h3><p>Newest bag first. Quality here is the sampled bag quality; shipping age and area price affect the sale. Select a bag to release it overboard.</p><p>Dumping takes exactly its original hauling time. Close this menu to continue a running operation. The boat keeps moving during deck work.</p>${w.day.dump ? `<p><strong>Dump in progress · ${w.day.dump.remaining.toFixed(1)} seconds left</strong></p>` : ''}<p>Catch released this trip: ${Math.round(w.discarded || 0)} lb. Dumped catch does not regenerate the bed or earn crew shares.</p>`;
  }
  return '<h3>Equipment switches</h3><p>Each switch belongs to this boat and is saved. Working lights run automatically after dark when enabled. Dive equipment can be changed with both divers aboard; finish a lift before switching its hauler.</p><p>Use fuel from the auxiliary tank before isolating it. Cosmetic clock faces remain selectable in Arrange UI.</p>';
}
