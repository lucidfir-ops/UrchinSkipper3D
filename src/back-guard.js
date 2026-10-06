// Browser Back (Android Back gesture, keyboards whose Escape key the system
// turns into Back, mouse/trackpad Back) and leaving fullscreen open the game
// menu instead of navigating away from an unsaved working day.
//
// One guard history entry is pushed after a real player gesture (browsers skip
// entries added without one). Back consumes it and opens Pause, or closes the
// current menu. The guard re-arms on the next gesture, so pressing Back twice
// without touching the game still leaves the page as the browser expects.
export function installBackGuard(ui, win = globalThis.window, doc = globalThis.document) {
  if (!win?.history?.pushState) return () => {};
  let armed = false;
  const playing = () => ui.started && !ui.ended;
  const arm = (event) => {
    if (armed || !event?.isTrusted || !playing()) return;
    try {
      win.history.pushState({ urchinBackGuard: true }, '');
      armed = true;
    } catch {
      /* Sandboxed hosts may refuse history changes. */
    }
  };
  const openMenu = () => {
    if (!playing() || ui.bindingPicker?.open || ui.input?.capture) return;
    if (ui.screen) ui.back();
    else ui.open('pause');
    ui.signature = null;
  };
  win.addEventListener('pointerdown', arm, true);
  win.addEventListener('keydown', arm, true);
  win.addEventListener('popstate', () => {
    if (!armed) return;
    armed = false;
    openMenu();
  });
  // Escape (or Back) that only exits fullscreen still pauses at sea.
  const fullscreenChanged = () => {
    const full = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (!full && playing() && !ui.screen) ui.open('pause');
  };
  doc.addEventListener('fullscreenchange', fullscreenChanged);
  doc.addEventListener('webkitfullscreenchange', fullscreenChanged);
  // The game has no right-click actions. A right click (a mouse, a trackpad
  // two-finger tap, the Steam Deck left trackpad in gamepad mode) or a touch
  // long-press would otherwise open the browser menu over the sea.
  win.addEventListener('contextmenu', (event) => {
    if (!event.target?.matches?.('textarea,[contenteditable="true"],input:not([type="range"])'))
      event.preventDefault();
  });
  return () => armed;
}
