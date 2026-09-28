# Navigation, learning and player agency — September 28, 2026

The player’s chart symbol is now an ivory-ringed gold heading pointer with a forward heading line. Full charts label it `YOU` with a three-digit heading; minimaps retain a compact symbol whose size is independent of map scale and chart zoom. Raster and vector charts use the same visual contract. The normal chart knowledge rules and world coordinates remain unchanged.

Frank’s ten original action gates remain. The spoken prompts now describe the immediate task, with bow, stern, port, neutral and sounder explained when needed. Advanced material survives in optional, contextual Frank notes alongside the cove chart and pause screen. The last task only asks the player to recover everyone and cross the south boundary. Chart notes place map and current task side by side on desktop. The default lesson window shrinks to its content; deliberate saved window sizes retain priority.

Sound volume is a native 0–100% slider. Touch dragging keeps the same mounted input; native keyboard arrows/Home/End and mapped controller left/right (five-point increments) adjust the saved audio level. The former cycling control has been removed. Settings retains its existing navigation grouping.

The current source contains no clock-triggered automatic home return. Inspection found only physical harbour-edge departure and existing rescue/catastrophe paths. Those remain. A new regression steps the simulation across missed shipping, midnight and several later nights and confirms that the skipper retains helm control until actual return. The late warning explicitly offers continued fishing or returning. The clock shows the next shipping window instead of an expired departure target. Arrival exactly at a morning 06:00 shipping window no longer incurs an extra 24-hour wait; later days remain correctly ordered. Passage fuel quotes and return reserves use the effective fitted-engine specification.

Underwater crew cards were verified in neutral: Easy retains two named state/readout cards; Realistic retains two identity-only selectors; All Off hides them as requested. The investigation did find a distinct information leak: context-message observability followed an old `realistic` flag derived from exact-load display. Since Realistic legitimately allows exact readings, its message could expose searching/working states. Observability now follows the actual Diver indicators entitlement, independently of exact readouts. Easy card status now describes the physical preparation, entry, descent, ascent, ladder approach and boarding phases.

Validation: direct unit runs passed agency, shipping-window, settings, chart, keyboard and harbour-shop regressions. The hardware Chromium `--learning-interface-only` suite exercised real keyboard events, native CDP touch dragging, synthetic mapped controller events, raster/vector charts, concise tutorial prompts and the three crew-card presets without page errors. Desktop and phone settings, tutorial, full charts and neutral underwater HUD screenshots were inspected. The final hardware rerun also passed the context-entitlement assertion: Realistic shows generic bubble/alongside guidance and separately permitted readings, with no hidden searching/working/surfacing state. Synthetic controller input does not establish physical-controller compatibility. No physical mobile device was tested.

Evidence: `test-results/learning-interface-*.png`, `test-results/learning-interface-checks.json`. Reproduce with `PLAYWRIGHT_BROWSERS_PATH=.browser-cache URCHIN_HARDWARE=1 URCHIN_TEST_URL=http://127.0.0.1:5183/ node scripts/browser-smoke.js --learning-interface-only`. The development-only fixture suppresses Vite HMR messages during its captures; it does not alter game code.


## Author screenshot verification and remaining limits

This is an author verification of the interface changes, not a claim of independent review. A separate critic should inspect these same screenshots.

- `learning-interface-settings-desktop.png` and `settings-phone.png`: the percentage, track and thumb are legible; native range focus is visible. The phone page scrolls to reach lower settings. No drag-induced remount or lost final value occurred.
- `learning-interface-tutorial-first-task.png` and `tutorial-return-task.png`: the task is readable above the boat, the two crew cards remain, and the shorter panel gives back unused scene area. The last prompt is under 55 words. Optional notes no longer occupy the live gameplay panel.
- `learning-interface-full-chart-raster.png` and `full-chart-vector.png`: own vessel and heading are immediately distinguishable. The chart, task, notes, rendition controls and Back fit at 1280×800. The vector chart retains its intentionally coarse sampled coastline; this change did not rebuild the chart cartography. At smaller widths the chart/workspace stacks and scrolls.
- `learning-interface-easy-underwater-neutral.png`: both named crew cards retain status, air, bag and readiness while the boat is in neutral. Some world-space diver labels can run behind the top instruments at the edge of the view, but the crew cards preserve important information.
- `learning-interface-realistic-underwater-neutral.png`: two identity-only cards and generic local-operation guidance remain. Exact permitted air/bag readings are identified with the selected diver’s name; the message no longer reveals whether the diver is searching or picking.

The short-touch generic HELM primer is now suppressed only while an actual recovery context is active, leaving its labelled controls and recovery message available. It returns afterward. This rule applies to the default window only; custom placed windows remain the player’s responsibility. The diver browser suite separately verified native-touch recovery.

Independent observations of other authors’ visuals: the first working-fleet sheet showed weak silhouette differences among most monohulls, and the initial dark-water screenshots had overly regular diagonal bands. These were reported to the renderer author for iteration. The later UI captures show less conspicuous banding; acceptance of the final twelve-hull models belongs to the later independent fleet review.

## Independent renderer screenshot review

The interface author separately inspected the renderer authors’ actual current screenshots: `cohesion/fleet-twelve.png`, `cohesion/traffic-twenty-five.png`, and `diver-operations/phase-{entering,descending,hauling,boarding,stowing}.png`, `column-{2,3-5,5}-metres.png`, `column-2-metres-zoom-1.1.png`, `keyboard-underwater-neutral.png`, `controller-approach.png` and `touch-port-recovery.png`. This is independent of the vessel geometry, water shader and diver animation implementation; the reviewer did supply traffic-reference profile data and authored some surrounding interface code.

The twelve career hulls and all twenty-five traffic identities are present. The catamarans, open DFO RIB, timber decks, helipad, galley canopy/oars, sail rig and industrial fittings provide recognizable differences. Dark green, largely opaque water and green absorption of the submerged diver fit the requested coastal direction. Close views visibly connect entry and descent with a particular port ladder, bag handling and bodies back aboard. At 3.5 metres the body is subdued; at 5 metres it is no longer visible. The current touch recovery capture has no stale HELM popup obscuring the operation.

Remaining weaknesses were reported to the renderer author before any further changes:

- At normal 1.1 zoom, the 2-metre diver occupies roughly eight pixels and is difficult to pick out against surface grain. The close view proves a submerged model is rendered, but the requested clear visibility at that depth is still marginal in ordinary play.
- Several ordinary rivals, particularly 1/3/5, and standard career monohulls retain very similar white-wheelhouse silhouettes. Complete 3D coverage should not be described as equally strong visual individualization of every source asset.
- The frozen boarding pose can read as a tilted swimmer alongside the ladder rather than unmistakable climbing. Motion may explain the pose, but these stills cannot establish timing, limb contact or animation continuity.
- The surface texture still has a directional grain, although the earlier conspicuous diagonal stripes are reduced. These open-water screenshots do not independently establish coastline or kelp quality.
- Touch recovery remains visible in a narrow central opening between panels. The controller recovery panel has appreciable empty space, and the keyboard teaching view is busy. Essential information survives, but these are dense interfaces rather than an unobstructed cinematic view.

No renderer edits or new browser runs were made for this review. Screenshot inspection does not substitute for continuous motion review or physical-controller and real-device touch testing.
