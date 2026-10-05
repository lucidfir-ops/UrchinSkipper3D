// Brief, semantic notices occupy the HUD edge, never the recovery water.
// Repeated telemetry updates do not extend a bubble's life.
import {
  placeSeaSpeech,
  speechIsClear,
  SPEECH_TAIL,
  bufferedSpeechFootprints,
} from './speech-layout.js';
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
export function compactPickupSpeech(name, reason, surfaceReason = '') {
  // Health, air, current and other surfacing warnings retain their full text.
  if (surfaceReason && surfaceReason !== 'Bag full') return '';
  const action = {
    'BRING FLOAT TO PORT SIDE': 'Float to port',
    'OUT OF RANGE': 'Come closer',
    'KEEP FLOAT CLEAR OF THE HULL': 'Clear the hull',
    'SLOW DOWN': 'Slow down',
    'DECK BUSY — DUMPING BAG': 'Deck busy · dumping',
  }[reason];
  return action ? `${name} · ${action}` : '';
}
export function seaMessage(ui, channel, key, text, seconds = 2.6, compactText = '') {
  ui.seaMessages ??= new Map();
  const prior = ui.seaMessages.get(channel);
  if (prior?.key === key) return;
  ui.seaMessages.set(channel, {
    key,
    text,
    compactText,
    until: performance.now() + seconds * 1000,
  });
}
export function updateSeaMessages(ui, footprints = () => []) {
  let panel = document.getElementById('seaSpeech');
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'seaSpeech';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.style.overflowWrap = 'anywhere';
    document.body.append(panel);
  }
  const active = [...(ui.seaMessages?.values() || [])]
    .filter((entry) => entry.text && entry.until > performance.now())
    .sort((a, b) => b.until - a.until)[0];
  panel.hidden = !ui.started || !!ui.screen || !active;
  if (panel.hidden) {
    ui.seaSpeechPlacement = null;
    return;
  }
  const frank = document.getElementById('frankAboard');
  if (frank && !frank.hidden) {
    if (panel.textContent !== active.text) panel.textContent = active.text;
    const rect = frank.getBoundingClientRect();
    const width = Math.min(480, rect.width, innerWidth - 16);
    panel.style.width = width + 'px';
    panel.style.left =
      Math.max(width / 2 + 8, Math.min(innerWidth - width / 2 - 8, rect.left + rect.width / 2)) +
      'px';
    panel.style.top = Math.max(4, rect.top - panel.offsetHeight - 6) + 'px';
  } else {
    const preferred = defaultSeaSpeechRect(innerWidth, innerHeight, ui.input?.touchEnabled),
      key = `${innerWidth}/${innerHeight}/${ui.input?.touchEnabled}/${active.text}/${active.compactText}`,
      protectedRects = footprints();
    let cache = ui.seaSpeechPlacement;
    if (cache?.key !== key) {
      const widths = [
          ...new Set([preferred.width, 320, 240, 180, 146, 140, 120, 104, 96, 90]),
        ].filter((width) => width <= preferred.width && width <= innerWidth - 16),
        variants = [{ text: active.text, compact: false }];
      if (active.compactText) variants.push({ text: active.compactText, compact: true });
      const sizes = variants.flatMap((variant) =>
        widths.map((width) => {
          panel.textContent = variant.text;
          panel.style.width = width + 'px';
          return { ...variant, width, height: panel.offsetHeight + SPEECH_TAIL };
        }),
      );
      cache = ui.seaSpeechPlacement = { key, sizes };
    }
    if (!cache.rect || !speechIsClear(cache.rect, protectedRects)) {
      const occupied = [],
        controls = [];
      for (const element of [
        ...document.querySelectorAll(
          '[data-hud-window], #keyboardHelm .helm-key, #keyboardHelm button, #touchControls button, #touchControls .touch-stick, #touchMenu, #touchHudToggle, #touchLockToggle',
        ),
      ]) {
        const rect = element.getBoundingClientRect(),
          style = getComputedStyle(element);
        if (
          element.hidden ||
          !rect.width ||
          !rect.height ||
          style.display === 'none' ||
          style.visibility === 'hidden'
        )
          continue;
        // The full-screen invisible touch steering gesture is not a labelled
        // action. Its visible thumb sticks and action buttons are protected.
        if (element.id === 'touchBoat') continue;
        (element.matches('[data-hud-window]') ? occupied : controls).push(rect);
      }
      cache.rect = placeSeaSpeech(
        { width: innerWidth, height: innerHeight },
        cache.sizes,
        preferred,
        [...bufferedSpeechFootprints(protectedRects), ...controls],
        occupied,
      );
      // Tight views may have room for the mandatory gap but not the buffer.
      // Keep the exact-clearance option rather than inventing an obstruction.
      if (!cache.rect?.clear)
        cache.rect = placeSeaSpeech(
          { width: innerWidth, height: innerHeight },
          cache.sizes,
          preferred,
          [...protectedRects, ...controls],
          occupied,
        );
    }
    const rect = cache.rect || preferred;
    const text = rect.text || active.text;
    if (panel.textContent !== text) panel.textContent = text;
    panel.style.width = rect.width + 'px';
    panel.style.left = rect.left + rect.width / 2 + 'px';
    panel.style.top = rect.top + 'px';
  }
}
