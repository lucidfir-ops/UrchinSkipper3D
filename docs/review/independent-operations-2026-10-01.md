# Independent operations review — October 1, 2026

Reviewed the boundary and light implementation independently of its original authors. Browser evidence uses Chromium at 1280×800, 390×844 and 844×390. Controller input is synthetic; no physical controller or phone acceptance is claimed.

## Harbour boundary

Inspected fresh `test-results/boundary-2026-10-01/desktop-boundary.png`, `desktop-confirmation.png`, `portrait-confirmation.png` and `landscape-confirmation.png`. The amber dashed edge and harbour label are clearly distinguishable from the water. The confirmation names the destination, passage time, arrival and catch; Cancel receives initial focus. Both actions fit on the landscape screen. An older screenshot had clipped Confirm; the current centred dialog fixes this.

The browser check passes Enter-to-cancel, Escape, mouse Cancel, synthetic controller Back and Menu, controller selection of explicit Return, and portrait/landscape touch Cancel/Return. It checks that time freezes, Cancel leaves neutral helm and no departure, both touch buttons are unobscured and at least 44 px tall, and ordinary controller pause→Back still resumes after cancellation with no obsolete forward history. See `input-results.json` in that directory.

Code review confirms that only the designated edge requests return, both divers must be aboard, pending decisions survive save/load, and rearming requires returning 12 m inside. Held inputs are suppressed when the dialog opens and closes. No additional boundary blocker was found.

## Work lights

Inspected `test-results/work-lights-2026-10-01/supplier-locked.png`, `double-preview.png`, all three `switches-*` captures, `night-1x.png`, `night-4x.png`, `day-off.png` and `day-on.png`. The three explicit OFF/AUTO/ON controls and selected checkmark remain clear at every viewport. Landscape explanation text scrolls while all switches remain visible. The supplier presents the price and rank requirement beside the upgrade.

Corrected the visual fixture to load a real working `near` ground before freezing the night scene. The stronger light visibly brightens and extends illumination across actual water and kelp. The existing forward/port arrangement survives. Daytime ON is visibly different from OFF; AUTO remains automatic. Nearest kelp highlights approach white under 4× output, but the bright region remains local. Repeated ribbon shapes in kelp remain visible in frozen close views.

Purchases charge $1,100, then $3,200 and $8,500, with rank and prerequisite checks. Browser checks pass cancellation, all modes through keyboard/touch/synthetic controller, actual spot/shader powers of 240/480/960 and fixture lens counts of 2/4/8. Headless tests cover saved per-hull modes, clear-weather sight ranges and fog limits. Long-career affordability remains a balance playtest, not a proven result.

## Recovery and remaining visual limits

The operations review exposed an obsolete short-touch rule: it watched the removed permanent pickup panel, so the helm primer could overlap the replacement speech bubble. Updated the rule to hide the primer while current speech is visible and restored the verification to the current UI. The old fixture also referenced a removed `pickupLabel`; it now checks current recovery speech and the hidden obsolete panel.

The corrected hardware Chromium development run passes keyboard deployment, synthetic controller recovery, native touch recovery with 150 lb landed by each recovery, and frozen depth/phase renderer checks with no page errors. Inspected fresh `test-results/diver-operations/touch-port-recovery.png`, `phase-entering.png`, `phase-boarding.png` and `column-2-metres-zoom-1.1.png`. The short-touch speech is legible and the overlapping helm primer is now absent; the brief banner can still cross the boat on this short viewport. Port-side entry and ladder alignment are recognizable close up; near-surface people remain small at wide zoom. Climbing hand contact and the stiff entry pose are worthwhile future polish but do not justify changing recovery geometry during this pass. The initial software-rendered attempt timed out, and the earlier production attempt exposed the obsolete fixture; those attempts are not recorded as passes.

Also inspected existing `test-results/surface-drift-2026-10-01/day-no-arrows.png`, `fog-no-arrows.png` and `phone-no-arrows.png`. Drift particles are restrained and fog attenuates them. The original phone capture clips the crew stack and overlaps Frank, so it was reported for correction rather than accepted. A faint large polygonal fog edge remains visible at the extreme visibility radius.
