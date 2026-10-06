# Night menus: Settings switches lost their text when ON — October 5, 2026

Source: designer's Firefox screen recording on the S22, `feedback/10-5 v2/Screen_Recording_20261005_171840_Firefox.mp4` ("menu bug with night mode on some buttons").

## What was wrong

In Night menu colours, the two Settings switch rows, **Troubleshooting log** and **Auto fullscreen & rotate on touch**, turned into a cream panel when ON and not selected. The title disappeared and the hint was barely legible. Selected (orange) and OFF rows were correct, so the fault showed only after the selection moved off a switch that had been turned on.

Cause: the night-theme rule added on October 5 (`src/ui-night.css`, "Switches that are ON read as inked stamps") inverted every `[role='switch'][aria-checked='true']`. It set a cream background and dark text. Small plain-text toggles inherit that text colour, but a Settings row's title and hint set their own cream ink colour, giving 1:1 contrast for the title and 1.48:1 for the hint. The October 5 menu audit did not catch it because both switches are OFF by default.

## Fix

Settings rows (`.menu-row`) are excluded from the inversion. Their teal sliding knob already shows the state. Other switches (assist and touch-option toggles) keep the stamp.

## Evidence

- `scripts/menu-theme-audit.js` now turns each Settings switch ON, moves the selection to the other row, and audits both states (`settings-logging-on`, `settings-auto-fullscreen-on`).
- Run against the previous CSS (rebuilt with the October 5 file), the strict Firefox phone audit fails with exactly the designer's symptom: `LOW 1 strong "Troubleshooting log: ON" | LOW 1.48 small "Keep a local record…"`, and the same for Auto fullscreen.
- With the fix, `menu-theme` (night and day on phone, tablet and Deck) and `menu-theme-firefox` pass strict.
- `tests/in-world-cues.test.js` guards the selector.

## Limits

Reproduced in Playwright's desktop Firefox at phone size and in Chromium, not on the S22 itself.
