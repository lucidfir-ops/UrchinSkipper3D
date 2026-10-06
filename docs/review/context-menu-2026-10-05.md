# Browser right-click menu blocked over the game — October 5, 2026

## What was wrong

The game has no right-click actions, but only the touch-control layer cancelled the browser's `contextmenu` event. Everywhere else (the sea canvas, HUD, menus) a right mouse click opened the browser menu over the game. On the designer's Steam Deck in Steam's gamepad mode, the left trackpad click arrives as a right mouse click (capture log of the October 5 physical session: `pointerdown` button 2), so pressing it during play opened the browser menu. Touch long-presses outside the touch controls can do the same on Android browsers.

## Fix

`installBackGuard` (`src/back-guard.js`), which already intercepts other browser interruptions (Back, leaving fullscreen), now cancels `contextmenu` on the window for every target except text entry (`textarea`, editable content, non-range `input`), so copy and paste keep working where text can be typed. The game currently has no text fields; the exception is for future ones.

## Evidence

- `tests/deck-controls.test.js`: "right clicks and long-presses never open the browser menu over the game" — game targets are cancelled before and during play; text entry is left to the browser.
- Production build in Chromium (Playwright, 1280×800): a cancellable `contextmenu` dispatched on the WebGL canvas and on the page body reports `defaultPrevented: true`; on a textarea it reports `false`. A real right click at the centre of the title screen completes without a browser menu.
- `npm test` 646 tests (645 pass, 1 intentional skip), lint, format check and build pass.

## Limits

Synthetic events in Chromium only. The Deck trackpad, Firefox on the S22 and the Doogee tablet long-press were not exercised physically; the designer's next session covers that. Separately, the designer decided on October 5 that controller setup guidance belongs on the itch.io front page, so the in-game Controller setup text was left unchanged.
