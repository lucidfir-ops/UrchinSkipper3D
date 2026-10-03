// Brief, semantic notices occupy the HUD edge, never the recovery water.
// Repeated telemetry updates do not extend a bubble's life.
export function defaultSeaSpeechRect(width, height, touch = false) {
  if (touch && width > height && height < 500)
    return { left: 10, top: 90, width: Math.min(300, width / 2 - 76) };
  const bubbleWidth = Math.min(width - 20, 480);
  return {
    left: (width - bubbleWidth) / 2,
    top: width < height ? 126 : 132,
    width: bubbleWidth,
  };
}
export function seaMessage(ui, channel, key, text, seconds = 2.6) {
  ui.seaMessages ??= new Map();
  const prior = ui.seaMessages.get(channel);
  if (prior?.key === key) return;
  ui.seaMessages.set(channel, { key, text, until: performance.now() + seconds * 1000 });
}
export function updateSeaMessages(ui) {
  let panel = document.getElementById('seaSpeech');
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'seaSpeech';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    document.body.append(panel);
  }
  const active = [...(ui.seaMessages?.values() || [])]
    .filter((entry) => entry.text && entry.until > performance.now())
    .sort((a, b) => b.until - a.until)[0];
  panel.hidden = !ui.started || !!ui.screen || !active;
  if (panel.hidden) return;
  panel.textContent = active.text;
  const frank = document.getElementById('frankAboard');
  if (frank && !frank.hidden) {
    const rect = frank.getBoundingClientRect();
    const width = Math.min(480, rect.width, innerWidth - 16);
    panel.style.width = width + 'px';
    panel.style.left =
      Math.max(width / 2 + 8, Math.min(innerWidth - width / 2 - 8, rect.left + rect.width / 2)) +
      'px';
    panel.style.top = Math.max(4, rect.top - panel.offsetHeight - 6) + 'px';
  } else {
    const rect = defaultSeaSpeechRect(innerWidth, innerHeight, ui.input?.touchEnabled);
    panel.style.width = rect.width + 'px';
    panel.style.left = rect.left + rect.width / 2 + 'px';
    panel.style.top = rect.top + 'px';
  }
}
