import { deckControlsLabel, cycleDeckControls } from './deck-controls.js';
import {
  fullscreenLabel,
  toggleFullscreen,
  autoFullscreenLabel,
  toggleAutoFullscreen,
} from './fullscreen.js';
import { uiScale, changeUiScale, setUiScale } from './ui-scale.js';
import { setTimeIncrease, timeIncrease } from './time-speed.js';
import { loggingEnabled, toggleLogging, downloadLog } from './troubleshooting-log.js';
import { choiceButton } from './menu-buttons.js';
import { renderSettings, menuFooter } from './menu-shell.js';
import { setText } from './dom-view.js';
import { cycleMenuTheme, menuThemeLabel } from './menu-theme.js';

// Preferences belong to the device and are available without a career too.
export function preferenceActions(ui) {
  const open = (id, label) => ({ id, label, run: () => ui.open(id) });
  const action = (id, label, run) => ({ id, label, run });
  const back = action('back', 'Back / Close', () => ui.back());
  if (ui.screen === 'settings')
    return [
      open('layout', 'Arrange UI layout'),
      open('assists', 'UI / difficulty options'),
      open('controller', 'Controller setup'),
      open('bindings', 'Controller Remapping'),
      open('ui-scale', 'UI Scale'),
      open('touch-options', 'Touchscreen Options'),
      open('gameplay-speed', 'Gameplay Speed'),
      action('deck-controls', deckControlsLabel(), cycleDeckControls),
      action('fullscreen', `⛶ ${fullscreenLabel()}`, toggleFullscreen),
      action('auto-fullscreen', autoFullscreenLabel(), toggleAutoFullscreen),
      action('volume', 'Sound volume', () => ui.panel.querySelector('#soundVolume')?.focus()),
      action('menu-theme', menuThemeLabel(), cycleMenuTheme),
      action('graphics', `3D graphics: ${ui.hooks.graphicsLabel?.() || 'High'}`, () =>
        ui.hooks.cycleGraphics?.(),
      ),
      action('logging', `Troubleshooting log: ${loggingEnabled() ? 'ON' : 'OFF'}`, toggleLogging),
      action('download-log', 'Download troubleshooting log', downloadLog),
      action('exit', 'Exit Game', () => ui.exit()),
      back,
    ];
  if (ui.screen === 'ui-scale')
    return [
      action('ui-smaller', `Smaller · now ${uiScale()}%`, () => changeUiScale(-1, false)),
      action('ui-larger', `Larger · now ${uiScale()}%`, () => changeUiScale(1, false)),
      action('ui-reset', 'Reset · 100%', () => setUiScale(100)),
      back,
    ];
  if (ui.screen === 'gameplay-speed')
    return [
      action('time-slower', `−5% · now ${timeIncrease() > 0 ? '+' : ''}${timeIncrease()}%`, () =>
        setTimeIncrease(timeIncrease() - 5),
      ),
      action('time-faster', `+5% · now ${timeIncrease() > 0 ? '+' : ''}${timeIncrease()}%`, () =>
        setTimeIncrease(timeIncrease() + 5),
      ),
      back,
    ];
  return null;
}

export function renderPreferences(ui, world, bind) {
  const actions = preferenceActions(ui);
  if (ui.screen === 'settings') {
    const signature = JSON.stringify([
      'preferences',
      actions.map((action) => action.label),
      ui.menuNotice,
      ui.saveNotice,
    ]);
    if (ui.signature !== signature) {
      ui.signature = signature;
      renderSettings(ui, world, actions, bind);
    }
    const volume = Math.round((ui.hooks.audio?.volume ?? 0.35) * 100),
      slider = ui.panel.querySelector('#soundVolume');
    if (slider && slider.value !== String(volume)) slider.value = String(volume);
    setText(ui.panel.querySelector('#soundVolumeValue'), volume ? `${volume}%` : 'Muted');
    return;
  }
  if (ui.panel.querySelector('.preference-view')?.dataset.preference !== ui.screen) {
    const speed = ui.screen === 'gameplay-speed';
    ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">PREFERENCES · SAVED ON THIS DEVICE</div><h2>${speed ? 'Set your working pace.' : 'A comfortable view.'}</h2><p class="menu-introduction">${speed ? 'The whole world moves together.' : 'Scale your menus and instruments together.'}</p></div></div><div class="career-layout preference-view"><div class="career-choices choices"></div><article class="career-detail">${speed ? '<label for="timeSpeed">World speed adjustment: <strong></strong></label><input id="timeSpeed" type="range" min="-100" max="100" step="5"/><p>0% default · −50% half · +100% double.<br>−100% pauses the world.</p><p>Default matches the former maximum. Saved pace is preserved.</p>' : '<h3>Easy to read. Room to work.</h3><p>Make menus and interface text smaller or larger, or restore the default size.</p><p>Your saved instrument positions stay yours. Touch control size is adjusted separately in Touchscreen Options.</p>'}</article></div>`;
    ui.panel.querySelector('.preference-view').dataset.preference = ui.screen;
    const list = ui.panel.querySelector('.career-choices');
    actions.forEach((action, index) =>
      list.append(choiceButton(ui, world, action.label, index, { action })),
    );
    ui.panel.append(menuFooter(ui, bind, 'Changes apply immediately.'));
    const slider = ui.panel.querySelector('#timeSpeed');
    if (slider) slider.oninput = (event) => setTimeIncrease(event.target.value);
  }
  for (const action of actions)
    setText(ui.panel.querySelector(`[data-action="${action.id}"]`), action.label);
  const slider = ui.panel.querySelector('#timeSpeed');
  if (slider) {
    if (slider.value !== String(timeIncrease())) slider.value = String(timeIncrease());
    setText(
      ui.panel.querySelector('label[for="timeSpeed"] strong'),
      `${timeIncrease() > 0 ? '+' : ''}${timeIncrease()}%`,
    );
  }
}

export function adjustSoundVolume(ui, direction) {
  if (ui.screen !== 'settings' || !['left', 'right'].includes(direction)) return false;
  if (preferenceActions(ui)[ui.index]?.id !== 'volume') return false;
  const value = Math.round((ui.hooks.audio?.volume ?? 0.35) * 100);
  ui.hooks.audio?.setVolume(
    Math.max(0, Math.min(100, value + (direction === 'right' ? 5 : -5))) / 100,
  );
  return true;
}
