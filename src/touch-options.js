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
  // Sliders and action buttons remain mounted throughout pointer/focus changes.
  if (!ui.panel.querySelector('#touchScale')) {
    ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">CONTROLS · SAVED ON THIS DEVICE</div><h2>Make room for your hands.</h2><p class="menu-introduction">Tune your helm controls and the view around them.</p></div></div><div class="touch-options-layout"><div class="touch-option-groups choices"><section class="touch-option-group" data-touch-group="mode"><h3>Touch controls</h3><p>Independent throttle and rudder, with your working actions close by.</p><div class="touch-option-controls"></div></section><section class="touch-option-group" data-touch-group="size"><h3>Control size</h3><label for="touchScale">Size <strong></strong></label><input id="touchScale" type="range" min="50" max="150" step="5" aria-describedby="touch-scale-help"/><p id="touch-scale-help">Tiny selects 70%. Instruments and menus use the separate UI Scale setting.</p><div class="touch-option-controls"></div></section><section class="touch-option-group" data-touch-group="opacity"><h3>Control visibility</h3><label for="touchOpacity">Opacity <strong></strong></label><input id="touchOpacity" type="range" min="0" max="100" step="1" aria-describedby="touch-opacity-help"/><p id="touch-opacity-help">From invisible to solid. Menu and help stay visible at every setting.</p><div class="touch-option-controls"></div></section><section class="touch-option-group" data-touch-group="display"><h3>On the water</h3><p>Show your chosen information windows, or adjust their positions while aboard.</p><div class="touch-option-controls"></div></section></div><article class="touch-options-detail"><div class="eyebrow">LIVE PREVIEW</div><h3>A little more sea.</h3><div class="touch-preview" aria-label="Touch controls preview"><span class="touch-preview-menu">Menu / help</span><div><span class="touch-preview-stick">RUDDER</span><span class="touch-preview-button">Deploy / board</span></div></div><p>Size and opacity affect your helm controls. Your information windows keep their own settings.</p><div class="touch-option-controls choices" data-touch-group="reset"></div><p class="touch-option-save">Changes apply immediately and are saved for this browser. Back returns to where you opened these options.</p></article></div>`;
    const groupFor = {
      touchscreen: 'mode',
      'tiny-touch': 'size',
      'touch-smaller': 'size',
      'touch-larger': 'size',
      'touch-fainter': 'opacity',
      'touch-solid': 'opacity',
      'touch-reset': 'reset',
      'touch-adjust': 'display',
      'touch-hud': 'display',
      back: 'reset',
    };
    actions.forEach((action, index) => {
      const group = ui.panel.querySelector(`[data-touch-group="${groupFor[action.id]}"]`);
      const list = group.querySelector('.touch-option-controls') || group;
      list.append(choiceButton(ui, world, action.label, index, { action }));
    });
    ui.panel.querySelector('#touchScale').oninput = (event) => setTouchScale(event.target.value);
    ui.panel.querySelector('#touchOpacity').oninput = (event) =>
      setTouchOpacity(event.target.value);
  }
  for (const action of actions)
    setText(ui.panel.querySelector(`[data-action="${action.id}"]`), action.label);
  for (const [id, checked] of [
    ['touchscreen', ui.input.touchEnabled],
    ['tiny-touch', touchScale() < 100],
    ['touch-adjust', !ui.touch.screenLocked],
    ['touch-hud', !ui.touch.hudHidden],
  ]) {
    const button = ui.panel.querySelector(`[data-action="${id}"]`);
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', String(checked));
  }
  for (const [id, value] of [
    ['touchScale', touchScale()],
    ['touchOpacity', touchOpacity()],
  ]) {
    const slider = ui.panel.querySelector(`#${id}`);
    if (slider.value !== String(value)) slider.value = String(value);
    slider.setAttribute('aria-valuetext', `${value}%`);
    setText(ui.panel.querySelector(`label[for="${id}"] strong`), `${value}%`);
  }
}
