import { DEFAULTS, LABELS, bindingName } from './input.js';

export function openBindingPicker(ui, code) {
  ui.bindingPicker?.remove();
  const dialog = document.createElement('dialog');
  dialog.className = 'binding-picker';
  dialog.setAttribute('aria-label', `Assign ${bindingName(code, ui.input.faceNames)}`);
  const heading = document.createElement('h2'),
    note = document.createElement('p'),
    close = document.createElement('button'),
    list = document.createElement('div');
  heading.textContent = `Assign ${bindingName(code, ui.input.faceNames)}`;
  note.textContent =
    'Choose an action for this input. Existing conflicts are protected. This replaces that action’s binding for the selected device.';
  close.textContent = 'Close · keep bindings';
  close.onclick = () => dialog.close();
  list.className = 'binding-picker-list';
  for (const action of Object.keys(DEFAULTS)) {
    const button = document.createElement('button');
    button.textContent = `${ui.input.map[action].includes(code) ? '✓ ' : ''}${LABELS[action]}`;
    button.dataset.assignAction = action;
    button.onclick = () => {
      ui.input.beginCapture(action, /^(b\d+|a\d+[+-])$/.test(code) ? 'gamepad' : 'keyboard');
      const assigned = ui.input.assign(code);
      ui.input.capture = null;
      if (assigned) dialog.close();
      else note.textContent = ui.input.notice;
    };
    list.append(button);
  }
  dialog.append(heading, close, note, list);
  dialog.addEventListener('keydown', (e) => e.stopPropagation());
  dialog.onclose = () => {
    dialog.remove();
    ui.bindingPicker = null;
    ui.signature = null;
    ui.input.suppress();
    ui.canvas.focus();
  };
  document.body.append(dialog);
  ui.bindingPicker = dialog;
  ui.input.suppress();
  dialog.showModal();
}
