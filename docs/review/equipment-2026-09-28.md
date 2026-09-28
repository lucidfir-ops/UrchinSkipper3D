# Equipment and chandlery — September 28, 2026

## Implemented

The old shop had no equipment-capacity limit. The bag hauler was locked behind rank-one contacts, while an “Empty station” blueprint and vague purchase failure suggested unavailable slots. The hauler is now available from the first working day. Specialist equipment retains its established reputation requirements, with exact current/required experience, insufficient funds and compatibility shown before purchase.

The chandlery is organized around deck/diving, propulsion/range, navigation/weather and personal equipment. Every compatible fitting can coexist. The boat plan numbers physical locations rather than limiting equipment. Owned clock faces, installed equipment, permanent systems, automatic lights and switched-off fittings have distinct states. Purchases include fitting to the named active boat; equipment stays with that boat. Confirmations remain explicit and initially select Cancel.

Two new compatible systems are available on all twelve hulls:

- Working engine repower: $9,800; 15% more speed throughout the existing load curve, 20% more acceleration, 18% more fuel use. Drive family, reverse speed, draft, hull dimensions and established steering remain unchanged. Existing drive damage is not repaired by an engine installation.
- Fuel management: $2,400; 12% less fuel use, composing with the standard engine or repower. Both packages are permanent installations, not at-sea switches.

These changes affect actual underway consumption and acceleration, passage duration, passage charges, departure/reserve estimates and the current boat specification. Preview comparisons use the actual composed specification on an isolated copy; inspection does not mutate the save. The parent change updates the remaining departure/return fuel calculations to use the same effective specification.

Chandlery and Your Boat render the actual authored Three.js vessel with installed fittings. Candidates show a gold installation marker and highlighted fitting. Dragging or focused keyboard arrows turn the model. The renderer is persistent, shares no materials with the world renderer, disposes replaced model resources and caches snapshots; it has no idle animation loop and creates no context per card. A labeled station diagram and inventory remain available below the preview. The visible benefit precedes the image, with numeric comparisons and fitting details below.

## Review and corrections

The independent diver agent initially found an undersized model, benefits below the fold, excessive nested mobile content and three competing purchase controls. Corrections enlarged and tightened the camera, added a clear station marker, brought the benefit above the image, reclaimed desktop header space and removed the redundant top purchase action. The selected row and persistent bottom purchase action remain.

The same independent agent inspected the final hauler, portrait fuel-management and twinjet screenshots: benefits and price were understandable before purchase; the fitting marker was readable; Your Boat clearly read as navigation; and the catamaran silhouette was distinct. No blocking visual issue was found in that reviewed subset. Portrait details still require scrolling.

## Validation and evidence

- `tests/equipment-fit.test.js`: all 17 purchases coexist on all 12 hulls, save/reload and per-boat ownership, duplicate-charge prevention, first-day hauler, explicit reputation gating, immutable preview, permanent systems, actual acceleration/consumption, passage quote/charge agreement and the Island Tender load curve.
- Focused equipment, career, boats, harbour-shop and training tests passed. The training inventory assertion now compares against the complete upgrade catalog instead of a hardcoded count.
- ESLint and formatting passed for the changed implementation. Production build passed during implementation; integrated final tests/build are the parent task’s release check.
- `scripts/equipment-review.js` passed on Chromium with Vulkan hardware rendering: inspect/cancel/install, exact cash charge, rank explanation, installed state, keyboard preview rotation, native touch purchase/cancel at 390×844 and 844×390, synthetic mapped controller inspection/purchase/cancel, and 12 distinct live 3D boat previews. Zero page errors.
- Evidence: `test-results/equipment-review.json`, `equipment-hauler-preview.png`, `equipment-hauler-installed.png`, `equipment-engine-preview.png`, `equipment-installation-confirmation.png`, `equipment-supplier-status.png`, `equipment-touch-390.png`, `equipment-touch-844.png`, `equipment-complete-installation.png`, and `equipment-boat-*.png`.

The browser review uses an isolated funded career. It verifies transactions and simulation composition, not long-career economic balance. Physical controllers, actual mobile performance and Safari were not tested. The independent final visual sample covers three screenshots, not every fitting on every hull. Small personal items are identified by their installation station; not every clock or piece of personal kit has a unique visible mesh.

## Main files

`src/equipment-fit.js`, `src/equipment-view.js`, `src/three/fitting-preview.js`, `src/career-data.js`, `src/career-state.js`, `src/boats.js`, `src/equipment-controls.js`, `src/shop-actions.js`, `src/shop-view.js`, `src/career-actions.js`, `src/career-ui.js`, `src/harbour-shops.css`, `tests/equipment-fit.test.js`, `tests/s22-latest.test.js`, `scripts/equipment-review.js`, `scripts/harbour-shop-checks.js`.

The parent owns the shared Three.js vessel/fitting factories and physical fitting geometry. The interface agent added focused-preview keyboard ownership to the existing keyboard filter.

## Independent diver continuity review

After equipment implementation, I independently reviewed `diver-motion.js`, `simulation.js`, `diver-recovery.js`, `save-validation.js`, serialization and dive exposure. CPU reproductions found three concrete continuity faults, reported to the diver author for correction:

- A diver at the far end of a valid pickup could begin climbing while still about three metres from the ladder. Swimming distance must gate the climb, including a bag already recovered.
- Nightfall during on-deck preparation moved a still-aboard diver instantly into a zero-depth ascent. Preparation and an entry already in progress need distinct handling.
- A diver drifting from shallower to deeper ground during descent could jump from 7.5 m to 24.47 m at the searching transition. The descent pose must finish at the current local bottom.

Catch transfer is guarded by `bagHandled`; the bag is transferred once at completion, not while a recovery is interrupted. A surface bag exchange keeps the current tank, while completed boarding supplies a fresh tank. The new transit and deck-walk save fields are optional, preserving acceptance of existing snapshots. These code findings are distinct from the three reproduced faults above; no additional catch-transfer or legacy-save defect was found in this review.

An independent CPU check interrupted a 300 lb pickup by moving the boat out of range: both hook progress and catch transfer paused; returning to range completed one 300 lb bag, restored a full tank and did not add a second bag during eight subsequent seconds. A genuine career save with both new motion fields absent decoded successfully and advanced from legacy deployment to searching with a finite rendered pose.

The diver author corrected all three reproduced faults. I reread the changes and reran the original independent fixtures after the fixes:

- At 2.35 seconds, the far pickup remains at the waterline, still 3.011 m from the ladder; hook progress waits at 2.15 seconds. The climb starts only within 0.35 m of the ladder and finishes aboard.
- Nightfall leaves a preparing diver aboard. An entry already in progress retains its continuous short movement into the water before the existing ascent begins.
- The slope transition is now 24.0795 m to 24.4719 m, a 0.3923 m frame movement reflecting the current and slope, instead of the previous approximately 17 m jump.

The interrupted-catch and genuine legacy-save checks also passed again after these fixes. No remaining blocker was found in this focused independent audit. These last corrections were reviewed with CPU simulation and code; they were not rerun in a browser by this reviewer.
