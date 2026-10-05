# Night menus, remnant panels, rotatable boats and offload art — October 5, 2026

Source: designer notes, October 5, and screenshots `feedback/10-4 v2/Screenshot_20261004_211817_Firefox.jpg` (boat select), `…221028` (offload picture), `…221036` (Working day return), `…221318` (Chandlery detail). Bible §2 interface entry updated in place.

## What was wrong

- The October 4 chart-room menus are bright cream paper on every screen.
- Several older surfaces survived the redesign as dark sea-green slabs. The chart-room rule that makes text inherit ink gave them dark text on a dark background: Working day return (contrast 1.14:1), the Chandlery / boatyard inspected row and detail, 3D preview captions (1.0–1.9:1), chart map captions (1.47:1) and the harbour scene footer strip. The almanac key badges and Touchscreen Options preview were also below 3:1.
- The offload picture was a flat SVG cartoon.
- Boats in boat selection could not be turned.

## Change

- **Night mode, on by default.** `html[data-menu-theme]` sets the theme, saved per device (`urchin3d-menu-theme-v1`), and an inline head script applies it before first paint. Night redefines the chart-room tokens as a dark slate chart table with pale ink. The signal-orange focus and ink-stamp primary actions keep their roles. Settings → Picture & sound → **Menu colours: Night / Day** switches back to chart paper. The chart-room stylesheet's 47 colour literals became tokens (`--chart-card*`, `--chart-paper-hi`, `--chart-good`, `--chart-sheen*`, and `color-mix` for ink alphas), so both themes come from one set of rules (`src/ui-night.css`, `src/ui-tokens.css`).
- **Remnant panels** were re-styled as chart-room surfaces built from those tokens, in both themes: the receipt (Working day return), the inspected shop row, the Chandlery detail, 3D preview frames and captions, map captions, the harbour footer, key badges and the touch-preview controls (console colours). ON switches are ink stamps at night.
- **Rotatable boats.** The large preview in boat selection (starter, boatyard, boat shop) turns by drag or ← / → when focused, using the existing shared preview renderer. Rotation is kept while the menu re-renders. Card thumbnails stay still so a tap still selects.
- **Offload art.** A crop of the painted harbour (`public/assets/harbour/offload-v1.jpg`, 97 KB, cut from the existing harbour painting) shows the boat alongside, crew and urchin crates. It follows the arrival hour: day as painted, dusk tinted, and night darkened with the dock lamps lit. Fatality and vessel-loss days are muted.

## Evidence

- `scripts/menu-theme-audit.js` (suite `menu-theme`) crawls title, starter, 26 harbour/planning screens, three detail panels, four at-sea menus and the summary at three arrival hours. It runs in both themes on phone 360×780, tablet 1280×800 touch and Deck 1280×800, saving 240 screenshots under `test-results/menu-theme-2026-10-05/`. It flags text below 3:1 against its composited background and any large sea-green/teal panel. Before the fixes it reported the items above. After the fixes, strict mode reports **no findings** in either theme on all three devices.
- The same suite drags the starter preview and asserts that the rotation changes and the canvas redraws. Night and dusk offload captures assert the lighting state.
- Existing suites: `equipment` (preview, transactions, keyboard, touch, synthetic controller), `interface`, `menus` and `accessibility` pass.
- Unit tests 641 pass; lint and format pass.

## Existing failures, not caused here

- `fleet` (`cohesion-visual-review.js`) fails with Three.js "Could not pack varying vMapUv / vNormal" shader validation errors.
- `mobile-career` fails at landscape "[data-harbour-pan="up"] cannot reveal Harbour office".

Both fail identically on the October 4 commit 46719bf, built and run in a separate worktree on this Deck. They are left open.

## Limits

The contrast check composites background colours and the last solid gradient stop; it cannot judge text over photographs. Visual acceptance comes from the independent screenshot review, not from this audit. Night offload lamp placement is approximate.

## Response to the independent review (same day)

The [independent review](independent-october-5-2026-10-05.md) ranked these issues; each was handled as follows:

1. **Deck summary hid the painting.** Two causes: opening the summary scrolled straight to the focused button, and the new figure could collapse inside the summary's flex column. Opening now leaves the summary at its top (later focus moves still scroll), and the figure no longer shrinks. Re-captured on Deck in both themes.
2. **Context-loss captures show an overlapping HUD at 412 px without touch mode.** This is the existing keyboard HUD at a size no target device uses, and it was not changed. The Reload graphics button now uses the game's display font.
3. **The chip sat ahead of the bow.** It now prefers either side of the boat, then the outward side, then inward, always avoiding controls and windows. The boundary suite passes again in all four input modes.
4. **Teal leftovers.** The departure coast overview now draws from theme variables: a pale paper chart by day, a slate chart at night. The touch-layout preview uses the game's dark water.
5. **Focus looked like a selection on touch.** Boat cards with keyboard focus now get an orange outline on touch screens; only the card chosen for review is solid orange. The general first-row focus highlight of the October 4 menus is unchanged.
6. **Sticky purchase bar covered content.** Shop details now have bottom room so the last lines can scroll clear of the bar, and the rotatable preview is capped at 260 px tall.
7. **Unreadable Day compass.** The Search-orders compass now uses ink-on-paper tokens in both themes.
8. **Contradictory summary captures.** This came from the fixture: it changed the arrival time without the matching shipping outcome. It now presents a consistent late arrival.
9. **Minor.** The dusk tint is stronger. The other minor items (testing tools in the pause menu, a crew-name wrap, small key captions, the mislabelled `yourboat-detail` capture) were not changed in this pass.

**Second review follow-up.** The boat shop's control notes and Frank's boat briefing showed raw `{thrustPort} / {thrustStarboard}` placeholders. They now show the player's actual bindings, as the boatyard already did. Still open: on the phone the sticky purchase bar can cover the lower part of the boat preview until the player scrolls; the Deck summary's receipt is cut off at the bottom of its scroll area; chart overview captions are small.
