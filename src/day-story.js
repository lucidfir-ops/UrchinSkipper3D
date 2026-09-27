import { money } from './career-data.js';

export function dayHighlights(w, result) {
  const lines = [],
    bags = w.bags;
  const best = bags
    .filter((b) => b.weight > 0)
    .reduce((best, b) => (!best || b.quality > best.quality ? b : best), null);
  if (best)
    lines.push(
      `Best landed bag: ${Math.round(best.weight)} lb at ${Math.round(best.quality * 100)}% sampled quality${best.diverName ? ' from ' + best.diverName : ''}${best.groundName ? ', ' + best.groundName : ''}.`,
    );
  if (result.buyerPremium > 0)
    lines.push(
      `${result.buyerDemand?.name || 'The quality buyer'} paid ${money(result.buyerPremium)} extra on ${Math.round(result.buyerAccepted).toLocaleString()} landed lb${result.buyerDemand?.target ? ' of a ' + result.buyerDemand.target.toLocaleString() + ' lb order' : ''}.`,
    );
  if (!result.onTime)
    lines.push(
      `Missed 19:00: catch waited ${result.delayHours.toFixed(1)} hours for offload. An earlier return preserves more weight and quality.`,
    );
  const previous = w.career?.history?.[0];
  if (previous) {
    const difference = result.netValue - previous.net;
    lines.push(
      `Net return ${money(Math.abs(difference))} ${difference >= 0 ? 'above' : 'below'} your previous trip (day ${previous.day}). Boats, grounds and conditions may differ.`,
    );
  } else if (w.discarded > 0)
    lines.push(`${Math.round(w.discarded)} lb released or lost at sea; it earned no sale income.`);
  return lines.slice(0, 3);
}
