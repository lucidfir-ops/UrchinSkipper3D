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
  const pan = document.createElement('nav');
  pan.className = 'harbour-pan-controls';
  pan.setAttribute('aria-label', 'Explore the harbour');
  const makePanButton = (direction, text, dx, dy) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.harbourPan = direction;
    button.textContent = text;
    button.setAttribute('aria-label', `Pan harbour ${direction}`);
    button.onclick = () => {
      if (dx) {
        const width = ui.panel.querySelector('.wharf-content').offsetWidth,
          column = Math.round(((ui.panel.scrollLeft + ui.panel.clientWidth / 2) / width) * 3 - 0.5),
          next = Math.max(0, Math.min(2, column + dx));
        ui.panel.scrollLeft = ((next + 0.5) * width) / 3 - ui.panel.clientWidth / 2;
      } else {
        const top = ui.panel.querySelector('.wharf-heading').getBoundingClientRect().bottom,
          bottom = pan.getBoundingClientRect().top;
        ui.panel.scrollTop += dy * Math.max(44, (bottom - top) / 2);
      }
      ui.updateHarbourPan();
    };
    return button;
  };
  const left = makePanButton('left', '←', -1, 0),
    up = makePanButton('up', '↑', 0, -1),
    right = makePanButton('right', '→', 1, 0),
    down = makePanButton('down', '↓', 0, 1),
    cue = document.createElement('span');
  cue.className = 'harbour-pan-cue';
  pan.append(left, up, cue, down, right);
  ui.panel.append(pan);
  ui.updateHarbourPan = () => {
    if (ui.screen !== 'harbour' || !pan.isConnected) return;
    const content = ui.panel.querySelector('.wharf-content'),
      maxX = ui.panel.scrollWidth - ui.panel.clientWidth,
      maxY = ui.panel.scrollHeight - ui.panel.clientHeight,
      column = Math.max(
        0,
        Math.min(
          2,
          Math.round(
            ((ui.panel.scrollLeft + ui.panel.clientWidth / 2) / content.offsetWidth) * 3 - 0.5,
          ),
        ),
      );
    pan.classList.toggle('has-vertical-pan', maxY > 2);
    up.hidden = down.hidden = maxY <= 2;
    left.disabled = maxX <= 2 || column === 0;
    right.disabled = maxX <= 2 || column === 2;
    up.disabled = ui.panel.scrollTop <= 2;
    down.disabled = ui.panel.scrollTop >= maxY - 2;
    const labels = [
      'Office · Chandlery · Frank',
      'Weather · Crew · Sail',
      'Settings · Boatyard · Training',
    ];
    cue.textContent = `${labels[column]}\n${ui.input.touchEnabled ? 'Swipe the harbour or use arrows' : 'Use arrows to pan the harbour'}\n${ui.menuNotice || (c.sandbox ? 'Test Mode does not save.' : 'Career saves automatically.')}`;
    ui.panel.style.setProperty(
      '--harbour-header-space',
      `${ui.panel.querySelector('.wharf-heading').offsetHeight + 20}px`,
    );
  };
  ui.panel.onscroll = ui.updateHarbourPan;
}
