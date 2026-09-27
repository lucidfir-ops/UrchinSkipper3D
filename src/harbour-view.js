import { choiceButton } from './menu-buttons.js';
import { money, RANKS, rankOf } from './career-data.js';
import { seasonStatus } from './season.js';
export function renderHarbour(ui, w, actions, bind) {
  const c = w.career,
    season = seasonStatus(c);
  ui.panel.innerHTML = `<div class="wharf-content"><div class="wharf-heading"><div><div class="eyebrow">${c.sandbox ? 'TEST MODE' : 'HOME HARBOUR'} · ${RANKS[rankOf(c)].name}</div><h2>Another day on the water.</h2></div><div class="wharf-money">${money(c.cash)}<small>Season ${season.season} · day ${season.day} / ${season.length}</small></div></div><div class="wharf-scene choices" aria-label="Harbour places"></div><div class="day-footer">${ui.menuNotice || `${bind('confirm')} Visit · ${bind('back')} Title · ${c.sandbox ? 'Test Mode does not save.' : 'Career saves automatically.'}`}</div></div>`;
  const list = ui.panel.querySelector('.choices');
  for (const [index, a] of actions.entries()) {
    const b = choiceButton(ui, w, a.label, index, { action: a });
    b.classList.add('wharf-place', `place-${a.id}`);
    if (a.id === 'workshop') {
      b.textContent = 'Training Mode';
      b.setAttribute('aria-label', 'Training Mode · repeat tutorial');
    }
    list.append(b);
  }
}
