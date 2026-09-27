import { diveForecast } from './dive-exposure.js';
import { depthAt } from './terrain.js';
import { setText, setMarkup } from './dom-view.js';

export function renderNitrogen(container, w, d, show, compact = false) {
  let info = container.querySelector('.nitrogen-info');
  if (!info) {
    info = document.createElement('span');
    info.className = 'nitrogen-info';
    info.innerHTML =
      '<span class="nitrogen-bar" role="meter" aria-label="Simulated accumulated nitrogen" aria-valuemin="0" aria-valuemax="100"></span><small></small>';
    container.append(info);
  }
  info.hidden = !show || !w.career;
  if (info.hidden) return;
  const forecast = diveForecast(
    w,
    d,
    d.state === 'ready'
      ? depthAt(w, w.boat.x, w.boat.y)
      : (d.lastDiveDepth ?? depthAt(w, d.x, d.y)),
  );
  const count = Math.round(forecast.fraction * 12),
    bar = info.firstElementChild;
  setMarkup(
    bar,
    Array.from(
      { length: 12 },
      (_, i) =>
        `<i style="--nitrogen-color:hsl(${120 - (i * 120) / 11} 65% 55%);opacity:${i < count ? 1 : 0.16}"></i>`,
    ).join(''),
  );
  bar.setAttribute('aria-valuenow', String(Math.round(forecast.fraction * 100)));
  const text = `N₂ ${Math.round(forecast.fraction * 100)}% · ${forecast.fullBagReady ? 'Full bag ready' : `Rest ~${forecast.restMinutes} min`} at ${Math.round(forecast.depth)} m`;
  bar.setAttribute('aria-valuetext', text);
  info.classList.toggle('ready', forecast.fullBagReady);
  setText(
    info.lastElementChild,
    compact ? (forecast.fullBagReady ? 'Ready' : `Rest ~${forecast.restMinutes} min`) : text,
  );
}
