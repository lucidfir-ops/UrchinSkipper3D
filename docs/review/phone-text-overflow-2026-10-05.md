# Phone text overflow — October 5, 2026

Source: designer notes of October 5 (second batch): "text spilling over on small screen, see images", with `feedback/10-5/Screenshot_20261005_135021_Firefox.jpg` (S22, Firefox for Android, 1080×2340 at 3×, i.e. 360×780 CSS px). The screenshot shows Boats for sale: "Coastal Workhorse", "$52,000" and "$61,000" run past the right edge of their cards.

## Cause and reproduction

- **Boat cards.** Paired boat cards are about 140 px wide on a 360 px phone, and each card put a 64 px preview beside the name, specs and price. That left roughly 50 px for "Workhorse" and the price. The October 5 menu audit checked contrast and teal remnants but not overflow, so the spill went unnoticed.
- **Detection.** `scripts/menu-theme-audit.js` now also reports text wider than its own box (unless it scrolls or uses an ellipsis) and text past its card's edge. On the phone it found the boat cards on three screens (spill of 3–9 px in Chromium). It also found two problems nobody had reported:
  - **Conditions**: "Wait 30 minutes at harbour" had wrapped into a second flex column off the right edge, 120 px out of view.
  - **Controls & Remapping**: key labels ("Throttle up", "Rudder left", "Backspace") ran past their keys.

## Fix

- **Boat cards** (`src/menu-polish.css`): a container query stacks the preview above the text whenever a card is under 230 px wide, at any UI scale, so the copy gets the full card width. Names, specs and prices may wrap as a last resort.
- **Conditions** (`src/device-feedback.css`): the action row is a row-direction flex, so a second button wraps below or beside the first instead of into an off-screen column.
- **Bindings** (`src/touch.css`, `src/feedback-ui.css`): the touch keyboard diagram is 720 px wide (it already scrolls sideways on phones), wide enough for whole words. Key labels break only if a single word cannot fit.

## Evidence

The audit runs every reachable menu screen (title, starter, 26 harbour screens, details, 4 at-sea menus, summary and offload scenes). After the fix it reports no spill, low-contrast text or teal panel:

- Chromium, night and day themes, on the phone and tablet (164 captures);
- Firefox, night theme, on the phone (41 captures).

New verify suites: `menu-theme` (already strict, now including overflow) and `menu-theme-firefox`. Screenshots: `test-results/overflow-before/`, `test-results/overflow-after/`, `test-results/overflow-firefox/`.

## Limits

- Playwright's desktop Firefox is not Firefox for Android on the S22. System font scaling and Android fonts can still differ.
- The audit checks horizontal spill against cards and own boxes. It does not judge whether wrapped text looks good, which is left to the independent review.
