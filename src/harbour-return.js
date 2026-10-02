import { cancelDeparture, confirmDeparture } from './departure-transition.js';
import { formatClock, passageMinutes, selectedGround, returnStatus } from './day.js';
import { choiceButton } from './menu-buttons.js';
import { menuFooter } from './menu-shell.js';

export const RETURN_CHOICES = ['Cancel · keep fishing', 'Confirm · return to harbour'];

export function updateReturnPrompt(ui, w, ready) {
  if (!ready || ui.ended || !w.day.returnPending || ui.screen === 'harbour-return') return;
  ui.open('harbour-return', { replace: true });
  ui.input.suppress();
}

export function activateReturn(ui, w) {
  if (ui.index === 1) {
    if (!confirmDeparture(w)) {
      ui.menuNotice = 'Both divers must be aboard at the marked harbour boundary.';
      ui.signature = null;
      return;
    }
    ui.hooks.audio?.play('confirm');
  } else cancelDeparture(w);
  ui.open(null, { replace: true });
  ui.input.suppress();
  ui.hooks.save?.();
}

export function renderReturn(ui, w, bind) {
  const signature = JSON.stringify(['harbour-return', ui.index, ui.menuNotice]);
  if (signature === ui.signature) return;
  ui.signature = signature;
  const tutorial = w.career?.intro?.status === 'active',
    minutes = passageMinutes(w, selectedGround(w)),
    detail = tutorial
      ? 'Both divers are aboard. Return to the wharf with Frank and finish this lesson.'
      : `Both divers are aboard. Homeward passage takes ${minutes} minutes; estimated arrival ${formatClock(returnStatus(w).arrival)}. ${Math.round(w.catch).toLocaleString()} lb on deck.`;
  ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">HARBOUR BOUNDARY · TIME PAUSED</div><h2>Return to harbour?</h2></div></div><p class="return-detail">${detail}</p><p>Cancel keeps you here in neutral. Turn back into the sector to continue working.</p><div class="choices return-choices"></div>`;
  const choices = ui.panel.querySelector('.choices');
  RETURN_CHOICES.forEach((label, index) =>
    choices.append(choiceButton(ui, w, label, index, { currentWorld: true })),
  );
  ui.panel.append(menuFooter(ui, bind, 'Return only when you are ready.'));
}
