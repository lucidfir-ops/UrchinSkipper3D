import { bindingName } from './input.js';
import { boatSpec } from './boats.js';
import { setMarkup } from './dom-view.js';

export function renderKeyboardHelm(ui, w) {
  let panel = document.getElementById('keyboardHelm');
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'keyboardHelm';
    panel.setAttribute('aria-label', 'Keyboard helm controls');
    panel.addEventListener('click', (event) => {
      if (event.target.closest('[data-action="pause"]')) ui.open('pause');
    });
    document.body.append(panel);
  }
  panel.hidden = !ui.started || !!ui.screen || ui.ended || ui.input.lastDevice !== 'keyboard';
  if (panel.hidden) return;
  const spec = boatSpec(w),
    key = (action, label, position = '') => {
      const codes = (ui.input.map[action] || []).filter((code) => !/^(b\d+|a\d+[+-])$/.test(code));
      const tag = action === 'pause' ? 'button' : 'div';
      return `<${tag} data-action="${action}" class="helm-key ${position} ${codes.some((code) => ui.input.keys.has(code)) ? 'pressed' : ''}"><kbd>${codes.map(bindingName).join(' / ') || 'Unbound'}</kbd><span>${label}</span></${tag}>`;
    };
  setMarkup(
    panel,
    `<div class="keyboard-cluster"><div class="key-cross">${key('throttleUp', 'Throttle +', 'key-north')}${key('left', 'Rudder port', 'key-west')}${key('throttleDown', 'Throttle −', 'key-south')}${key('right', 'Rudder starboard', 'key-east')}</div><div class="keyboard-extra">${key('neutral', 'Neutral')}${key('fullAhead', 'Full ahead')}${key('fullReverse', 'Full reverse')}</div></div><div class="keyboard-actions">${[
      ['recoverDiver', 'Deploy / board'],
      ['work', 'Take / give bag'],
      ['recall', 'Recall diver'],
      ['cycleDiver', 'Select diver'],
      ['quickOrders', 'Orders'],
      ['chart', 'Chart'],
      ['pause', 'Menu'],
      ['zoomOut', 'Zoom −'],
      ['zoomIn', 'Zoom +'],
    ]
      .map(([id, label]) => key(id, label))
      .join(
        '',
      )}</div><div class="keyboard-cluster"><div class="key-cross">${key('pivotPort', spec.pivotRate ? 'Jet pivot port' : 'Jet only', 'key-north')}${key('thrustPort', spec.bowThrusterStrength ? 'Bow port' : 'No bow thruster', 'key-west')}${key('pivotStarboard', spec.pivotRate ? 'Jet pivot starboard' : 'Jet only', 'key-south')}${key('thrustStarboard', spec.bowThrusterStrength ? 'Bow starboard' : 'No bow thruster', 'key-east')}</div><div class="keyboard-extra">${key('centerRudder', 'Centre rudder')}</div></div>`,
  );
  const levels = {
    throttleUp: Math.max(0, w.boat.throttle),
    throttleDown: Math.max(0, -w.boat.throttle),
    left: Math.max(0, -w.boat.rudder / spec.rudderLimit),
    right: Math.max(0, w.boat.rudder / spec.rudderLimit),
  };
  for (const [action, level] of Object.entries(levels)) {
    const key = panel.querySelector(`[data-action="${action}"]`);
    key.style.setProperty('--command-level', `${Math.round(level * 100)}%`);
    key.classList.add('command-level');
  }
}
