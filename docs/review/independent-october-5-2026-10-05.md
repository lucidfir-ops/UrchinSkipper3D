# Independent visual review — October 5 menu theme, boat preview, harbour chip, offload scene, graphics notice

Reviewer: separate Claude subagent that did not write the code. Date: October 5, 2026. Scope: runtime screenshots only. No source files were edited.

## What was inspected

- Designer "before" references: `feedback/10-4 v2/Screenshot_20261004_211817_Firefox.jpg` (bright chart-paper boat select), `Screenshot_20261004_221028_Firefox.jpg` (flat vector offload card on cream), `Screenshot_20261004_230038_Firefox.jpg` (sea HUD).
- `test-results/menu-theme-2026-10-05/`: every night phone screen (40 files) and every night tablet screen (39 files); day phone title, starter-turned, harbour, settings, accounts, summary, summary-return, sea-pause, chart, touch-options, outfit-detail, crew; day tablet starter-turned, settings, summary-dusk, chart, accounts, touch-options, pause, sea-instructions; night deck title, harbour, starter-turned, summary, summary-night, settings, bindings, sea-pause, chart, sea-deck-catch; day deck title, fleet-detail, summary, summary-return.
- `test-results/boundary-2026-10-05/`: all six PNGs plus `input-results.json`.
- `test-results/context-loss-2026-10-05/`: chromium silent-loss and after-reload, firefox silent-loss and restored, plus both results JSON files.

This is a screenshot audit of headless Chromium/Firefox captures at emulated viewports. It is not device acceptance on the Doogee tablet, the S22 or the Steam Deck, and it says nothing about touch feel, physical controller behaviour or performance.

## Summary verdict per request

1. **Night mode default.** Achieved. Every menu screen opens in a dark navy chart-grid theme with cream headings, orange accents and readable body text. It reads as dark and calm rather than muddy; contrast of body text on the navy panels is adequate on phone and tablet. The day theme is selectable (Settings > Picture & sound > "Menu colours: Night/Day") and renders consistently as the earlier cream chart paper. A few teal elements survive (see issues 4 and 5).
2. **Rotatable boat preview.** Present. The starter screen shows a large preview with a "Drag to turn · ← →" caption once a boat is selected; the Your boat, Outfit and Fleet screens use the same component. `night-*-starter-turned.png` shows the Harbour Workhorse at a clearly different heading from its card thumbnail (cabin to the right, deck to the left), so a turn has happened. There is no same-boat unturned preview capture to compare against, because `night-*-starter.png` has nothing selected and therefore no preview.
3. **Return to harbour chip.** Present, compact, readable, and does not overlap touch controls in portrait or landscape. The old floating edge box is gone in all near-edge captures. Placement relative to the bow is questionable (issue 3).
4. **Offload scene and green screens.** The flat vector card is replaced by a painted dock scene in the same illustrated style as the harbour hub painting; it now matches the rest of the art. The "Working day return" panel is now navy (night) or white paper (day), not green. Chandlery ("Keep the boat working") is navy/cream. No full green screen remains in the menus reviewed.
5. **Graphics interruption notice.** Present and legible in both browsers; button is clear. The HUD behind it in these captures is broken (issue 2), unrelated to the notice itself.

## Issues, ranked

### Should fix

1. **Steam Deck / keyboard summary scrolls the offload painting out of view.** `night-deck-summary.png`, `night-deck-summary-night.png`, `day-deck-summary.png`, `day-deck-summary-return.png` (1280×800, keyboard/controller input): the left column is already scrolled so that the focused "Prepare next day" button is visible; the offload painting and in `day-deck-summary.png` even the "EVERYONE HOME. CATCH ACCOUNTED FOR." heading are above the fold. The tablet captures at the same 1280×800 size show the painting because touch mode does not scroll to focus. A Deck player will normally never see the new painting, which was one of the designer's explicit requests. The right-hand "Working day return" panel is also cut before "Operating cash" on Deck (`night-deck-summary.png`, bottom right).
2. **Desktop-mode HUD collapses at narrow portrait width.** `context-loss-2026-10-05/*-silent-loss.png`, `*-after-reload.png`, `*-restored.png` (412 px wide, non-touch): the instrument row overlaps (Ship's time box clipped to "HIP'S TIM", Depth box overlaps Helm and Time), and both diver cards are clipped to about 90 px so names read "Ch"/"Wa" and "Bag0" spills out of the card. This is probably pre-existing and caused by the fixture using desktop defaults at phone width, but anyone on a narrow desktop window or a phone with touch mode off will see it. Separately, the "Reload graphics" button appears to use a system sans-serif rather than the game's button face (minor).
3. **Return to harbour chip sits directly ahead of the bow.** `boundary-2026-10-05/desktop-beyond-line.png` and `portrait-beyond-line.png`: the boat is heading south (line has moved from below the boat to across it), and the chip is centred about 10–60 px in front of the bow, over exactly the water the skipper is steering into. In `landscape-beyond-line.png` it is beside the boat instead, which is better. If the brief is "must not cover the working water", placing the chip astern or abeam (as in landscape) would be safer. Otherwise the chip is good: dark pill, gold outline, anchor icon, ≥44 px tall, "Press H" hint on desktop, no dialog.
4. **Remaining teal panels.** Not full screens, but they are the most "old look" items left and the designer asked to hunt down remnants:
   - Departure/chart screen coast overview ("N ↑ · FIVE COASTS / FIFTEEN SUBAREAS"): saturated teal block with green coast silhouettes, `night-tablet-chart.png` and `day-tablet-chart.png` left column, `night-phone-chart.png` top. On the cream day theme it is especially jarring.
   - Touchscreen options "LIVE PREVIEW · A LITTLE MORE SEA" teal diagonal-stripe box, `night-tablet-touch-options.png`, `day-tablet-touch-options.png` right column.
   - The sea charts and boat preview backgrounds are dark teal too, but those read as water/plan views and are acceptable.
5. **Focus highlight looks like a selection on touch screens.** On almost every menu the first row is solid orange on open (e.g. `night-phone-accounts.png` "Refuel · $0", `night-phone-fleetboard.png` "Standard market · no target", `night-phone-skipper-stuff.png` "Radio", `night-phone-knowledge.png` "Mark current position", BACK in `night-phone-radio.png`/`fleet-board`/`help`). Worst case: `night-tablet-starter.png` shows Island Tender filled orange while the side panel says "Nothing is selected yet". On a touch device the player cannot tell focus from the current choice. Consider a lighter focus ring in touch mode.
6. **Sticky action bar covers content.** `night-tablet-starter-turned.png`: the bottom bar ("Career difficulty" / "Buy selected boat") sits over the preview description ("A $20,000 START FROM THE HARBOUR." is cut). `night-phone-fleet-detail.png` / `night-phone-yourboat-detail.png`: the preview is half hidden behind "Buy selected boat". `day-deck-fleet-detail.png`: top row of boat cards is clipped under the header ("Harbour" cut off). Needs bottom padding equal to the bar height.
7. **Day theme compass labels unreadable.** `day-tablet-sea-instructions.png` (Diver 1 · Search orders): N/NE/E/SE/S/SW/W/NW are pale teal on cream, roughly 1.5:1 contrast. Fine in night theme.
8. **Summary data in the fixture contradicts itself.** `night-*-summary-dusk.png` (arrived 19:40) and `night-*-summary-night.png` (arrived 22:15) both say "ON TIME", "Your catch made the scheduled offload" and OFFLOAD/SHIP 07:01, whereas the designer's own October 4 capture showed 22:15 as "DELAYED SHIPPING … 196 min late for 19:00". Probably the fixture only overrides the clock to drive the painting tint, but the designer will read these screenshots literally; the staging should be made consistent or labelled.

### Minor

9. **Dusk tint barely differs from day.** `night-tablet-summary-dusk.png` vs `night-tablet-summary.png`: almost identical. The base painting already has low golden evening light, so a 07:01 morning arrival shows a sunset-looking scene. The night variant (`night-tablet-summary-night.png`) is convincing: darkened, cool, with warm wheelhouse and head-torch glows.
10. **Sea menus have a black void around the panel.** `night-tablet-sea-pause.png`, `night-deck-sea-pause.png`, `night-deck-sea-deck-catch.png`, phone sea screens: outside the panel is pure black, whereas harbour menus show the harbour painting. It looks like a missing backdrop rather than a design choice. Confirm it is intended.
11. **"TESTING TOOLS · REVEAL EVERY URCHIN: OFF"** is visible in the sea pause menu (`night-tablet-sea-pause.png`, `night-deck-sea-pause.png`). If that is gated to playtest builds, fine; if not, it should not ship to the itch build.
12. **Crew name wraps mid-word.** `night-phone-crew.png` "R. Robinso / n". Also the day crew grid shows two "Sage" cards on the last row (`day-phone-crew.png`), which may be data, not layout.
13. **Phone keyboard bindings diagram.** `night-phone-bindings.png`: key captions are about 6 px; the H key crams "Return to harbour (beyond the harbour line)" into six lines. The horizontal swipe is signposted, so this is legibility only.
14. **Equipment switches with nothing fitted** (`night-*-sea-equipment-controls.png`) leaves the whole left column empty with no "No switchable equipment fitted" line.
15. **Summary time row.** "→" between AT HARBOUR and OFFLOAD/SHIP is tiny and floats; the "Your day" heading butts directly against the time values with no spacing (all summary captures).
16. **Boundary line markers look like UI widgets.** The cream dashes with dark outlines (`boundary-*-near-edge.png`, `*-beyond-line.png`) resemble slider bars; in `portrait-near-edge.png` they poke out from behind the throttle and rudder wheels and look like part of the controls.
17. **Small "Buy" box inside the selected fleet card** (`night-tablet-fleet-detail.png`) is a dark square on orange with tiny text; low affordance next to the large "Buy selected boat" bar.
18. **`yourboat-detail` captures show the Boats for sale screen**, identical to `fleet-detail` (`night-tablet-yourboat-detail.png`). Fixture labelling or navigation issue, not a UI bug.
19. Archive storage reads "this game 0.0 MB" with saved careers listed (`night-*-archives.png`); probably rounding.

### Nit

- Harbour hub header on tablet/deck crams "← BACK HOME HARBOUR" together (`night-tablet-harbour.png` top left).
- Phone harbour navigator: the right arrow is a bright cream block in night theme (`night-phone-harbour.png` bottom right), the brightest element on the screen.
- Title panel on tablet/deck covers half of the 3D boat in the background (`night-tablet-title.png`).

## What looks good

- The night theme is coherent across ~35 screens: same header rule, eyebrow, display heading, list rows with a cream left bar, footer hints. No screen reviewed reverted to the old cream or green look in night mode.
- Text contrast on navy is good for headings, list labels and body copy; orange status text ("Coastal skipper required") and green "Ready to fit" remain readable.
- Settings and pause menus float over the harbour painting with a clear panel edge and look finished.
- The new offload painting matches the harbour hub art (same palette, same figures, same rendering), a large improvement on the flat vector card in the October 4 screenshot. The night variant is convincing.
- The "Working day return" ledger is clean and legible in both themes; negative values in orange-red, totals emphasised.
- The boat preview is large, well lit and crisp; the "Drag to turn" caption is present (though small and low contrast).
- The day theme is still tidy and is a genuine alternative rather than a broken fallback.
- The graphics notice is concise, centred, unmissable and its button is the obvious action; chromium and firefox render it identically.
- The Return to harbour chip is far less intrusive than the old boundary box: no pause, no dialog, tappable, clear of controls in both phone orientations.

## Limits

Screenshots only, from automated fixtures at emulated viewports (360×780 phone, 1280×800 tablet/deck, 412-wide portrait for context loss). Nothing here verifies drag-to-rotate by touch on a real tablet, Deck physical controls, real GPU context loss on the Deck or the designer's devices, or natural playthrough states (several summary values are staged).
