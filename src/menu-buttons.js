// Screen-specific markup stays with its screen; action wiring/focus is shared.
export function choiceButton(
  ui,
  world,
  label,
  index,
  { action, decorate, currentWorld = false } = {},
) {
  const button = document.createElement('button');
  button.dataset.choiceIndex = String(index);
  if (action) button.dataset.action = action.id;
  button.textContent = label;
  button.disabled = !!action?.disabled;
  const selected = index === ui.index;
  button.classList.toggle('selected', selected);
  button.setAttribute('aria-current', String(selected));
  button.onclick = () => {
    if (button.disabled) return;
    ui.index = index;
    ui.activate(currentWorld ? ui.hooks.world() : world);
  };
  decorate?.(button);
  return button;
}
export function appendChoices(container, ui, world, labels, options = {}) {
  labels.forEach((label, index) => {
    if (options.indices && !options.indices.includes(index)) return;
    container.append(
      choiceButton(ui, world, label, index, {
        ...options,
        action: options.actions?.[index],
      }),
    );
  });
}
