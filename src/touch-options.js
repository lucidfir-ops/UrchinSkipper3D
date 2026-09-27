import { touchScale, setTouchScale, changeTouchScale } from './touch-scale.js';
import { touchOpacity, setTouchOpacity } from './touch-opacity.js';
import { choiceButton } from './menu-buttons.js';
import { setText } from './dom-view.js';

export function touchOptionsActions(ui) {
  return [
    {
      id: 'touchscreen',
      label: `Touchscreen mode: ${ui.input.touchEnabled ? 'ON' : 'OFF'}`,
      run: () => ui.touch.setEnabled(!ui.input.touchEnabled),
    },
    {
      id: 'tiny-touch',
      label: `Tiny Touch Controls Mode: ${touchScale() < 100 ? 'ON' : 'OFF'}`,
      run: () => setTouchScale(touchScale() < 100 ? 100 : 70),
    },
    {
      id: 'touch-smaller',
      label: `Smaller controls · ${touchScale()}%`,
      run: () => changeTouchScale(-1),
    },
    {
      id: 'touch-larger',
      label: `Larger controls · ${touchScale()}%`,
      run: () => changeTouchScale(1),
    },
    {
      id: 'touch-fainter',
      label: `Less opaque · ${touchOpacity()}%`,
      run: () => setTouchOpacity(touchOpacity() - 5),
    },
    {
      id: 'touch-solid',
      label: `More opaque · ${touchOpacity()}%`,
      run: () => setTouchOpacity(touchOpacity() + 5),
    },
    {
      id: 'touch-reset',
      label: 'Reset controls · 100% size and opacity',
      run: () => {
        setTouchScale(100);
        setTouchOpacity(100);
      },
    },
    {
      id: 'touch-adjust',
      label: `Adjust UI on water: ${ui.touch.screenLocked ? 'OFF' : 'ON'}`,
      run: () => ui.touch.lockToggle.click(),
    },
    {
      id: 'touch-hud',
      label: `Show information on water: ${ui.touch.hudHidden ? 'OFF' : 'ON'}`,
      run: () => ui.touch.hudToggle.click(),
    },
    { id: 'back', label: 'Back / Close', run: () => ui.back() },
  ];
}

export function renderTouchOptions(ui, world) {
  const actions = touchOptionsActions(ui);
  // Keep sliders mounted throughout a drag, including focus and pointer release.
  if (!ui.panel.querySelector('#touchScale')) {
    ui.panel.innerHTML = `<div class="day-heading"><h2>Touchscreen Options</h2></div><div class="career-layout"><div class="career-choices choices"></div><article class="career-detail touch-options-detail"><label for="touchScale">Controls scale: <strong></strong></label><input id="touchScale" type="range" min="50" max="150" step="5"/><p>Tiny sets 70%; adjust from 50–150%. Instrument and menu sizes use UI Scale.</p><label for="touchOpacity">Controls opacity: <strong></strong></label><input id="touchOpacity" type="range" min="0" max="100" step="1"/><p>0% invisible · 100% full visibility. Applies to helm buttons and sticks. Menu / help stays visible.</p><div class="touch-preview" aria-label="Touch controls preview"><span>Preview</span><div><span class="touch-preview-stick">RUDDER</span><span class="touch-preview-button">Deploy / board</span></div></div><p>Changes apply immediately and are saved for this browser. Back returns to where you opened these options.</p></article></div>`;
    const list = ui.panel.querySelector('.choices');
    actions.forEach((action, index) =>
      list.append(choiceButton(ui, world, action.label, index, { action })),
    );
    ui.panel.querySelector('#touchScale').oninput = (e) => setTouchScale(e.target.value);
    ui.panel.querySelector('#touchOpacity').oninput = (e) => setTouchOpacity(e.target.value);
  }
  for (const action of actions)
    setText(ui.panel.querySelector(`[data-action="${action.id}"]`), action.label);
  for (const [id, value] of [
    ['touchScale', touchScale()],
    ['touchOpacity', touchOpacity()],
  ]) {
    const slider = ui.panel.querySelector(`#${id}`);
    if (slider.value !== String(value)) slider.value = String(value);
    setText(ui.panel.querySelector(`label[for="${id}"] strong`), `${value}%`);
  }
}
