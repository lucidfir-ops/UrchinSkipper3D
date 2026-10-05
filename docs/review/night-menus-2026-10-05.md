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
