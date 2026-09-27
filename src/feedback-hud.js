import { boatSpec } from './boats.js';
import { diverSpec } from './crew.js';
import { deploymentStatus, rediveStatus } from './diver-recovery.js';
export function fuelGauge(w, status) {
  const capacity = boatSpec(w).fuelCapacity,
    ratio = Math.max(0, Math.min(1, w.boat.fuel / capacity));
  return `<div class="fuel-instrument fuel-dial ${status.level}" title="${status.detail}"><svg viewBox="0 0 100 76" role="img" aria-label="Fuel ${Math.round(ratio * 100)} percent"><path d="M20 57A34 34 0 1 1 80 57" fill="none" stroke="#b8c9b4" stroke-width="5"/><path d="M50 43V14" stroke="#f5cf87" stroke-width="3" transform="rotate(${-125 + ratio * 250} 50 43)"/><circle cx="50" cy="43" r="4" fill="#f5cf87"/><g fill="#f3e4c1" font-size="12"><text x="14" y="73">E</text><text x="79" y="73">F</text></g></svg><span>Fuel ${w.boat.fuel.toFixed(0)} / ${capacity} L${status.level === 'normal' ? '' : `<b>${status.text}</b>`}</span></div>`;
}
export function diverTelemetry(w, d) {
  const tank = diverSpec(d).tankAir || 100;
  const why =
    d.state === 'ready'
      ? deploymentStatus(w, d).reason
      : d.state === 'surface' && d.bagHandled
        ? rediveStatus(w, d).reason
        : d.reason;
  return `Air ${Math.round((d.air / tank) * 100)}% · Bag ${Math.round(d.bag)} / 300 lb · Last ${d.lastBag ? Math.round(d.lastBag.weight) + ' lb / ' + Math.round((d.lastBag.quality || 0) * 100) + '%' : '—'}${why ? ' · ' + why : ''}`;
}
