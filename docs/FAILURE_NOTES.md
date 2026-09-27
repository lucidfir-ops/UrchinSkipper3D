# 3D translation: findings and fixes

- Compact lesson projection exposed Phaser RESIZE measuring its deliberately hidden host as 0×0. Explicitly resize the headless NONE-mode viewport from the browser instead; this also restores nonzero traffic-view extents. Consume the established lesson followOffset in Three, and project the boat touch target from the same camera. Browser regressions check dimensions after rotation and real taps on the visible boat.

- The inherited launcher checked a shared 2D/3D marker and could reuse the wrong edition on the 3D port. The 3D HTML marker and `X-Urchin-Edition: three` header now distinguish it, with a real HTTP/child-process regression. Portable exports also retain their unique launch-instance identifier.

- Touch acceptance must use the visible shared **Back to previous menu** control; the legacy Back / Close choice is intentionally hidden. Closing Chart with keyboard Escape changes the active device to keyboard and produces a keyboard-layout screenshot, even after a successful touch action. Use a native touch tap on Back for touch-only captures.

- Initial copy omitted `assets/asset-integrity.json` while including its 79 public originals. Copying the manifest restored the complete inherited verification; no image was modified.
- Legacy in-port CSS hid the Three.js canvas on the title. The 3D title has an explicit visibility rule; the harbour menu still uses its supplied reference.
- First water shader generated a visible highlight lattice, then oversized smooth streaks. Independent screenshot review required finer irregular wave normals and greatly reduced reflection strength.
- A monolithic forest/terrain initially submitted over one million triangles. Spatial terrain, forest, rock and kelp batches reduced normal-view submission; measure live GPU performance separately.
- Live Vite module replacement interrupted browser captures and world transitions. Use a frozen production snapshot, one review browser at a time, and actual UI entry. Directly setting `ui.started` is insufficient to hide the title and creates misleading screenshots.
- The old TerrainView owned the ground legend, permitted-ground labels and diagnostic map. New navigation presentation restores those responsibilities under the same assists.
- Pure prototype crew cards concealed career-only nitrogen clipping. Career screenshots led to taller first-use desktop crew panels; saved layouts retain precedence.

- Headless Chromium initially used SwiftShader and reported roughly one frame per second despite spatial culling. Explicit `--enable-gpu --use-angle=vulkan` selected the real RADV VANGOGH GPU and the isolated 1280×800/DPR 1 run reached 60 FPS. Always record renderer identity and framebuffer dimensions; software timing is not hardware acceptance.
- Analytic sine normals continued to create a diagonal weave after removing the first sparkle lattice. Two independently moving, differently oriented generated anisotropic normal textures removed the regular sine pattern in the normal helm view. Noise-gated, subdued foam replaced the continuous bright shoreline contour. The more oblique title view still needs separate scrutiny when changing reflection strength.
- Weather data exposes `kind === 'fog'` and `visibility`, not a numeric `fog` property. Reading the nonexistent field silently left clear air. Ordinary distance fog also uses the camera's 240 m altitude, which would blind the skipper if given maritime sight distances. A horizontal radial mist layer now reconstructs sea-level positions and uses the original weather/night visibility helper; rocks, logs and wildlife independently retain their source visibility limits.
- Adding UV-dependent generated terrain materials briefly exposed an undeclared per-tile UV array in a local construction probe. The focused CPU probe caught it before handoff; the array is now allocated per spatial tile, and lint plus world construction/disposal checks pass.

The following notes were copied as read-only historical reference from the 2D source at the start of the separate project. They do not describe tests newly performed on the 3D renderer.

---

# Failure and solution notes

## September 20 device pass

- Crew CSS constrained SVG portraits but not the new image class; intrinsic PNG sizes overwhelmed both list and detail. Constrain the actual `.crew-portrait-image` element with aspect/object fitting.
- Touch Chart fired on press, then a release/click reached a newly opened screen. Deferred discrete Chart/Orders commands to release; a tap stays open in landscape browser acceptance.
- New-career/training actions can replace the world mid-update. Continuing to render the new screen with the old world caused missing intro fields/blank panels. Refresh the world reference after title/menu/tutorial transitions; repeated embedded Channel Master entry now has its own regression.
- Sea Settings deliberately returned to Harbour under the previous contract. The new explicit amendment retains the Settings parent for child menus but returns sea Settings to water. Old tests were updated only for these authorized behavior changes.
- Automatic floor clearance excluded the bottom touch strip. Shared fit geometry now permits a four-pixel margin. The Deck test initially held Down for only 1.4 seconds from its higher default position, insufficient to reach the bottom; wait for the actual boundary while holding rather than assuming phone/tablet distance.
- Weather's full-height panel inherited a desktop 24-pixel top margin, putting its bottom eight pixels offscreen. Set explicit eight-pixel top and bounded height; keep report scrolling separate from navigation.
- Live water floats invalidated the intended animation cache each frame. Quantize presentation-only cache values; retain phase/time refresh. Wide kelp receives a bounded animated texture and preassociated patches; simulation stays untouched. Discard concurrent-browser performance samples, as earlier notes already require; final performance runs must be isolated.
- Do not use optional string methods on numeric terrain versions. Tutorial-v2 hazard guards now convert the version to String before matching the tutorial family; all original numeric-version maps remain covered.
- First browser setup inspected a freshly opened menu before a render/input-release frame. Wait for the rendered screen before navigating; do not attribute fixture timing to physical hardware.

[Current decisions and evidence](FEEDBACK_SEPTEMBER20_DEVICES.md).

## September 19 three-coast progression

- Expanding the destination catalogue exposed hard-coded chart utility indices (3/4) and the visible 0/1/2 list. Derive both from the complete ground catalogue; production controller navigation now reaches every map and the correct utilities.
- The first offshore cliff zones were centred on island interiors, so they produced no steep shoreline cells. Move the zones to actual island edges; retain the slope/working-ground tests across all nine maps.
- A browser helper opened Chart and immediately inspected the previous frame's buttons after reload. Wait for the rendered nine-destination list before asking the controller path finder for a route. The corrected production flow passes all six map entries/reloads.
- Screenshot review found the enlarged SVG reaching into the footer/caption. Reserve caption/header height in the vector chart size calculation, including UI scale; preserve world-coordinate geometry.
- The economic replay's exact floating-point cash comparison falsely reported a duplicate permit charge after subtracting an integer price from a cent-rounded balance. Compare within a fraction of a cent; the actual transaction and save tests independently assert the exact charged amount and rejection of a repeat purchase.
- Offshore vector-minimap frame sampling exposed expensive terrain DOM rebuilds driven by chart-track changes and tens of thousands of individual SVG cells/contour segments. Batch same-fill cell geometry and each contour into compound vector paths, update notes separately, and retain terrain between observation updates. The vector branch also returned before updating the sounder; update that independent display before either chart branch. The acceptance flow now measures HUD/frame costs and checks live soundings in vector mode.

## September 19 Debug/navigation acceptance

- The first focused Debug visual check observed `ui.screen` before the following frame rebuilt menu DOM. Wait for the new rendered heading before inspecting copy or controls; production screen state was already correct.
- Its synthetic working-day staging initially omitted the required return-exit record, causing the normal HUD navigation reader to throw before the menu redraw. Stage a valid south return marker; real working days already create one through `chooseGround`.
- The first browser feedback rerun waited for the obsolete accessible label “Back to previous screen”; the live shared control has used “Back to previous menu” since menu-history clarification. Update the smoke locators to the current shared control and retain the production navigation behavior.
- The next legacy prototype step used controller Back to open Pause from the planning chart. Back now correctly walks to the title root; controller Menu retains the explicit Pause route. The fixture now uses Menu and leaves production history semantics unchanged.
- Firefox then reached an obsolete `.health-instrument` assertion removed by the standalone gauge pass. Check authoritative hull/drive state, absence of a live damage alert and the current speed-panel visibility instead of requiring retired markup.
- The feedback fixture’s staged 1.2 m/s centre overlap is now deliberately below the injury threshold and produced a near miss. Stage the same 3 m/s moderate contact used by the focused collision regression; do not lower production safety thresholds for the old fixture.
- Its following fatality fixture also used the moderate 3 m/s injury speed. Use the focused fatal-regression speed of 5 m/s for the intentional emergency case; the separate 3 m/s case continues to verify recoverable injury.
- The completed prototype receipt likewise used visible Back where it meant Menu. Back can walk to title; Menu reopens the completed-trip Pause and its Offload receipt entry. Update only the fixture action.
- The compact exit follow-up expected the generic Back label, but Session Ended intentionally exposes “Cancel exit.” Match that explicit exit control; ordinary menu screens continue to use “Back to previous menu.”
- The shared video helper still assumed selecting a starter row opened confirmation. Starter rows now inspect/select and the explicit Buy action opens confirmation. Exercise `buy-selected` before confirming, matching the live shop contract.
- The video rescue path used B from on-water Settings and then expected Pause. The new explicit contract sends Settings Back to Harbour; Menu still restores its visited Pause parent. Use Menu for this rescue scenario while the focused navigation tests retain the Settings → Harbour assertion.
- The standalone wildlife visual check bypassed the shared day-zero/starter helper and expected a boat choice immediately after title confirmation. Use the corrected shared helper so the visual fixture follows tutorial skip, selection and explicit purchase consistently.

## September 19 standalone SVG bows

- Missing spaces between interpolated coordinates in three fleet hull templates produced incomplete bow curve commands in 29 SVGs. Insert only the separators in each hull/deck/clip instance and the source templates; avoid regenerating unique artwork. All 35 SVGs rendered and were visually inspected; [preservation, diagnostics and validation](history/2026-09-19-svg-bows/README.md).

## September 17 minimap/layout checks

- The first sounder browser fixture targeted Frank’s starter cove, which intentionally clears collision rocks. Stage rock-top readings in an actual working sector; keep the cove safe and render its empty rock subset on charts.
- Firefox pointer clicks on UI switches could be lost: focusing a switch changed the explanation-state render signature, rebuilding the DOM between pointer down and release. Update explanation text in place and exclude that directly rendered state from the panel rebuild signature; verify real clicks in both engines.

Record reproducible causes and useful solutions; current tasks belong in `PROJECT_STATUS.md`.

## September 17 chart layout

- The first browser fixture selected a starter row and waited for harbour. Current shop rows only inspect; using the existing explicit Buy / Cancel-first confirmation completed setup. No production purchase behavior changed.
- Bound the chart window in screen dimensions divided by UI scale, including its 1200-pixel ceiling, so changing text scale does not shrink the whole window. Runtime measurements verify square maps, centring and column fill at 50/150%.

## September 17 shoreline hazards

- The first rendered density assertion counted eight existing runoff/event logs along with the new 720-log weather field. The fixture now verifies cohort IDs separately while reporting total debris; the established runoff system remains active.
- The initial rock crowns rendered like smooth circular markers. Runtime inspection led to angular stone silhouettes and light/dark facets inside the existing footprint, retaining conspicuous wash.
- A chained formatter/browser command ran inside the filesystem sandbox and hit the already documented loopback `listen EPERM`. The standalone approved `npm run verify` invocation runs the local server and browser successfully; no host settings were changed.


## September 15 keyboard controls

- Firefox view-switch assertions saw the new UI state before the next DOM render. Wait for the selected view's rendered `aria-pressed` state before counting diagrams. Both engines then pass.
- The first compact 1024×640 diagram clipped its numeric-pad alternatives below the panel. Smaller keycaps/labels at short heights keep every bound key visible; the browser check now asserts vertical containment too.
- The staged Firefox neutral checks could reset the boat before the previous shared X/Space action had a release frame. Wait for the abstract neutral action to release between staged checks, preserving the working input latch. Touch-mode toggling likewise needs its existing release gate before the next simulated Escape.
- A keyboard-only reset/remap could create a stored shared map that a first controller mistook for a historic X/Y layout after reload. Persist whether a real legacy map existed; first standard controllers still use X for bags and Y for boarding. Existing legacy mappings remain unchanged.
- The older Firefox itch fixture pressed Confirm as the patrol screen opened, before its input release gate cleared; the screenshot remained at the unanswered invitation with no page errors. Wait for that existing gate before sending the synthetic controller press. No patrol or controller behavior was changed.
- An attempted verification inside the filesystem sandbox failed launcher tests with `listen EPERM` on 127.0.0.1. Rerunning the existing approved verification outside that sandbox passed all launcher tests. No launcher or simulation changes were made for that environment restriction.

## September 15 itch.io follow-up

- The existing harbour geometry navigator heavily favors aligned buttons; free-positioned hotspots made obvious-looking directions take indirect routes. Three aligned rows fix the reported paths without a new focus engine. The lower-right Training button remains beside the supplied cabinet.
- DFO retained docking mode after inspection and could remain attached in the view. Casting off now has its own saved transition, clears docking, places the patrol on a reachable departure route and gates deployment until clear. A world with no navigable water finishes its departure under the transition.
- Root-relative runtime artwork and the default Vite base would fail beneath itch.io's upload directory. A relative production base plus relative runtime image URLs pass a strict nested host; the web ZIP has a root index.html.
- The first coastal-placement attempt required six strictly offshore additions even in the narrow middle sector, which had no eligible offshore room. The final rule reserves at least 75% coastal and permits additional safe coastal placements there.
- Exact sampled 5 m depth carried floating-point interpolation error. A one-millionth-of-a-metre comparison tolerance preserves the intended boundary turn; the turn persists for seven seconds to prevent immediate reversal chatter.
- Added hidden reefs changed the generic voyage pilot's nearest destination to a new unmarked shelf. Its old recovery route then struck the diver. The repeatable voyage now plans from charted grounds, preserving its established South Shelter route; hidden-ground search/discovery have separate tests. This does not establish safe automated recovery on every ground.
- Playwright locator.tap waits for a stable bounding box; a turning boat deliberately never satisfies that condition. The touch regression uses a real coordinate tap at the visible boat centre, without changing production motion. See the official actionability/touch references.
- Existing browser fixtures read the title/empty menu DOM in the same frame as a screen transition. Wait for the rendered starter/Resume controls before reading choices; production release gating stays intact.
- The first touch screenshots showed Fullscreen overlapping Menu and the clock. It now sits below Menu in its own narrow touch target; both engines verify reachability.
- Touch Centre rudder resolved in Input but was omitted from the scene's queued commands. The boat-tap regression now checks both throttle and rudder after the actual scene update.

## September 15 controller and inspection feedback

- The detail-scroll selector named the inner copy first but `querySelector` still selected the earlier outer article in document order; that article had `overflow:hidden`. Resolve the inner copy explicitly before other detail panes. Controller checks now scroll all three sector plans at 1024×640.
- Legacy DFO docking bypassed player avoidance and checked only corners, allowing crossing hull edges and extended stalls. Swept rectangle separation includes edge crossings; low-speed patrol translation is independent of heading, with an eight-second approach limit and a visible transition for blocked/shallow cases. Attached patrol artwork follows the player each render frame.
- The first live-input review found the new pivot action was resolved by input/physics but absent from the scene’s continuous-command forwarding. The runtime controller flow now tests right-stick pivot and left-stick retrofit thrust independently; unit input/physics checks alone were insufficient.
- New automatic radio dialogs apply a neutral release gate. A synthetic confirm sent in the opening frame was correctly consumed. The browser driver now waits for the neutral gate before pressing Confirm; production gating stays intact.
- A sparse browser Test Mode fixture omitted current/wind bearings, propagating NaN through motion. Defaults now supply north current / southwest wind for omitted bearings, with a focused finite-value regression.
- Roster audit found 34 visible generated contacts rather than the requested 32. New careers use 12 rival pairs plus eight contacts; surplus legacy profiles remain readable and already-hired divers remain available. Major counts use the designer-confirmed 5/5/5/5/4/4/4 distribution.
- Older browser fixtures assumed automatic boarding or ignored a newly visible radio dialogue. They now invite through the production UI; the longer career flow isolates its explicit inspection from unrelated random arrivals. The voyage fixture now starts from the same seed as the unit voyage after its conservative pilot failed a changing-weather recovery. No weather/physics override was added; that single voyage does not establish all-weather piloting or long-run balance.

## Touchscreen and fishing feedback — September 14 follow-up

- Controller boat comparison exposed a real selection bug: focus movement toward Buy could preview and purchase an intermediate hull. The candidate now changes only on explicit selection; render is read-only, artwork/specification/purchase share that candidate, and Buy names the displayed hull. The unchanged controller purchase loop detects this regression.
- DFO’s first alongside attempt aimed directly across the player’s beam, leaving a perpendicular patrol blocked by hull clearance. A stern approach lane and heading-alignment phase now lead into the physical alongside position; no remote boarding or hull bypass is required.
- Raising deterministic DCS thresholds exposed the old save validator’s 2.0 upper bound. The bound now covers the new 2.3 maximum; the new full-bag/reload regression detected this before handoff.
- Two initial mobile assertions read old menu markup in the same frame as a tap. Wait for the new preview/sail button to render, rather than relaxing the assertion or forcing UI state.
- First phone screenshots showed the desktop instrument panel consuming the diver-info area. Touch mode now has compact instruments and a separate placement for action feedback in landscape; screenshot checks remain part of acceptance.

## Definitive v2 stabilization — September 14

- The old ESLint configuration spread the recommended config, then replaced its entire `rules` object. Most recommended error checks were therefore inactive. Merge the recommended rules explicitly and include source, tools, tests and world authoring. Intentional optional-storage fallbacks now explain their empty catches; browser fixtures reference explicit window properties.
- Initial full tests inside the execution sandbox again hid the loopback launcher failure. The approved outside-sandbox run passed 224 tests (before the renderer regression was added). The first cap regression used the wrong fixture equipment location; equipment belongs to the active vessel, not directly to the career.
- A browser verification launched before its build completed loaded the previous bundle. Its functional pass is not acceptance for the new code. Rebuild first, then run browsers against the finished production assets. Do not overlap performance measurement with another browser suite: the first instrumented comparison did so and is diagnostic only.
- Frame measurement originally inherited Phaser's smoothed simulation delta. The new check uses `game.loop.rawDelta`; CPU phase timings end after renderer submission and do not pretend to measure GPU completion. See [performance checks](PERFORMANCE.md).
- The broader prototype continuation found stale HUD text immediately after a completed recovery once telemetry was limited to 10 Hz. State, catch and important-notice changes now force an immediate update; steady telemetry stays bounded. All Off tests check visibility rather than deliberately unrefreshed hidden text. The complete prototype continuation passes.
- Pillow is not installed; no image-processing dependency was added. Existing browser Canvas provides runtime-only boat framing and inspection, preserving all original PNG bytes.
- Do not format source while Node tests are loading it. One overlapping formatter/test run failed during file loading; the unchanged complete rerun after formatting passed all 250 tests.
- The career flow found that purchased radar/scanner were incorrectly gated by the weather widget. They now follow helm instruments, independently of the weather readout, as required by the new Realistic preset.
- The first DCS browser assertion incorrectly expected the mandatory-rescue modal. Suspected DCS intentionally permits alongside recovery and a controlled medical return; only mandatory-rescue emergencies force that modal. Assert the injury, fishing lock, notice and retained helm path instead.
- Maximum traffic at wide coastal zoom exceeded the unchanged 40 ms mean budget (45.28 ms). Renderer cost dominated; thousands of decorative tree facets/kelp veins remained expensive despite reduced redraw cadence. Distance-based decorative detail reduced the rerun to 24.07 ms, without altering navigation/collision geometry. The benchmark uses production actions for setup because chart cards contain decorative text that differs from their action labels; functional suites separately test rendered controller navigation.
- Firefox's populated scene then passed frame time but failed CPU p95 (36 ms). Graphics command buffers still render every frame even when their creation is throttled. Official Graphics guidance plus installed `Graphics.generateTexture`/CanvasTexture code confirmed static baking as the appropriate option. One bounded coastal-detail texture, regenerated only on cache-key changes, reduced the focused rerun to 16.95 ms/frame / 18 ms CPU p95. Never cache a full world at native pixels-per-metre or allocate a new texture every frame.
- The older simulated Alt-Tab test pressed Back immediately after dispatching blur, before a neutral input frame could clear the release gate. It now sends the matching focus event and waits for neutral before navigating, while still asserting the draft/menu survived. The game release gate was preserved. Final help review also caught old X-deployment prose and missing sister-hull handling text; advice now uses actual bindings and shared hull families.
- The remapping regression hard-coded 29 rows after nearby recall and assists expanded the action catalogue to 31. It now checks every current action's accessible binding control, retaining the conflicting-remap preservation assertion.
- The broad Firefox storm scene exceeded CPU p95 (27 ms) after the crowded calm scene passed. Separate phase timings identified rendering as the largest cost. `water-surface` now scales decorative wavelet density and drops subpixel foam/grain at wide zoom, retaining the same wind-directed crest silhouettes and all simulation inputs. Focused rerun: 19.87 ms/frame, CPU p95 24 ms, within unchanged budgets. Pure rendering regression verifies no world mutation.
- The older feedback suite expected disabled HUD instruments to be removed from the DOM. Hidden-HUD stabilization intentionally retains and skips them. Assert the hidden parent and invisible current/health widgets, then their visibility when re-enabled; do not restore per-frame hidden markup rebuilding to satisfy a structural assertion.
- The overnight fixture still pressed Space to deploy from deck; it now uses v2 keyboard X, while Space remains bag work. The environment harness counted the matrix immediately after its screen-state transition, before the next DOM render: it saw zero, but the failure screenshot showed all 16 cells and no page errors. Wait for the actual matrix before counting; retain the exact 16-cell and clickable-quality assertions.
- The final compact DFO panel assertion still matched the old “No fine simply” sentence. The actual dialogue correctly states v2's time-only inspection with no fines/catch removal. Match that explicit current promise; physical inspection tests separately verify unchanged cash/catch. This was test wording, not an inspection failure.
- An intermittent overnight keyboard-thrust fixture pressed its hold immediately after closing a fixture menu. Require a neutral, advancing gameplay interval before the hold, verify the fitted thruster hull, and always release the key in `finally`. A detailed input/lock/boat snapshot is now captured if it fails again; preserve real release gates instead of force-clearing them.

- Browser smoke: Chromium sandbox initialization can fail with `sandbox_host_linux.cc` / operation not permitted in the execution sandbox. Use the already-approved browser smoke command outside that sandbox when available; do not change game input or browser permissions to fix the test runner. See `EXTERNAL_REFERENCES.md`.
- Native Deck controls: unresolved physical environment/Steam Input issue; USB Xbox works. Device-specific profiles and explicit raw-device mapping are now implemented, but package permissions and actual Steam/KDE routing still require physical evidence. See `../CONTROLLER_NOTES.md`.
- Historical rule corrections: never swap physical X bag / Y boarding to match stale prose; derive labels from mappings. Never freeze all hull velocity when grounded. Old global-current and fixed-sea-level assumptions are superseded by environmental samplers.

## Overnight pass — 2026-09-10
- Generated boat v1 had usable alpha but showed a tilted cabin wall. A targeted imagegen edit corrected the view but produced an opaque painted checkerboard (RGB PNG). Stopped generation retries. Retained both original files; `src/boat-art.js` clips the corrected source to a decorative hull outline once into a reusable transparent CanvasTexture. This outline is never used for physics. Inspect alpha/perspective before accepting future sprites.
- The ordinary sandbox also blocks loopback-dependent launcher tests: `npm test` there can report only per-file failures without useful subtest output. The approved outside-sandbox `npm test` runs all named tests and passes. No game or launcher code was changed to mask this environment issue.
- The first compact almanac layout let its second button row overlap the footer despite the parent rectangle fitting. Added actual child-boundary checks, a shorter chart and contained scrolling. Future layout checks must include children, not only parent dimensions.
- Tide was simulated but visually under-explained: steep distant shores changed subtly, and the old depth-based palette made exposed drying rock look vegetated. Added nearby drying aprons, a discoverable independent height/current almanac, and datum-based rock/vegetation materials. The harmonic timing curves remain unchanged.
- Full browser day-flow initially timed out at the third recovery: the old fixture left the boat fixed while the new clumped-ground diver correctly moved several metres. Updated that explicit recovery fixture to align the boat to the actual surfaced diver; retained separate natural harvest movement, stock-conservation and recovery-eligibility tests. Do not undo diver movement to satisfy a stationary fixture.
- Sparse first-pass clump spacing consumed too much air in local transit, even on fast ground. Measured search versus picking time, then densified the nine-clump layout with modest overlap. A deliberately well-placed fast-ground drop now supports three full bags; distant drops can still produce partial final bags. Tank capacity, air use, swimming speed and picking rates stay unchanged.

## Authoritative playtest-feedback pass — 2026-09-10
- Bag turnaround automatically sent the diver back down, hiding the opportunity to board. It now waits at the surface; a separate X sends down and Y boards. Browser fixtures that assumed automatic descent must issue the new explicit action. Never swap X/Y to fix this state-machine problem.
- After that change, an adjacent-float test incorrectly expected HUD selection to determine Y's target. The nearer waiting diver was correctly boarded. The fixture now maneuvers to make the intended diver physically nearest; stable tie/selection-independent tests remain.
- A trial with 30 small hex clumps covered more area but added roughly 40 seconds of transit to a good bag, exhausting air too soon. Abandoned it. Nine wider, overlapping, outline-clipped resource regions cover most of the ground; harvesting motion heads toward the next region at the existing swimming speed. Tests retain stock conservation, partner separation and three-fast-bag tank mileage.
- A log touching the bow previously triggered direct drive damage. Hull contact and a swept stern-propulsion zone are now separate; speed/severity damage rolls occur per contact phase, not every frame. Gentle timber yields.
- Screenshot review found compact chart clipping and stale medical wording. Tightened card spacing, anchored the outer menu frame, kept inner lists/receipts scrollable, and made boarded-injury feedback direct the skipper home. Completed trips use a harbour menu; Back cannot reopen a pre-rescue state or reuse the prior day's navigation history.
- One browser regression run disconnected unexpectedly with no page error or crash evidence. Checked Playwright's documented crash/disconnection and debugging APIs, added bounded locator waits plus page-crash capture, and reran the same flow successfully. Cause remains unproven; no simulation or OS setting was changed to mask it.
- Final verification: 131 named automated tests, production build, keyboard fishing, controller-driven full day, remapping/reconnect/launcher, new feedback flows and all-sector environment/overnight rendering suites pass. Physical Deck/paddle routing and QA feel remain unconfirmed; passing synthetic checks do not supersede that limitation.

## Latest playtest fixes — 2026-09-11
- Firefox Flatpak exposed `/dev/input` but hid `/run/udev`. Its startup scan checks `ID_INPUT_JOYSTICK` from udev; later hotplug events supply properties independently, explaining why reconnect worked. Read-only probes reproduced the missing metadata and verified the launch-scoped `/run/udev:ro` remedy. Device permissions alone were insufficient. See [decisions](history/2026-09-11-latest-fixes/DECISIONS.md) and [sources](EXTERNAL_REFERENCES.md#firefox-cold-start-enumeration--2026-09-11).
- Session Ended set `ended=true`, and the update loop then admitted only Confirm, repeatedly retrying exit. Back/navigation never ran. Exit is now a controller-navigable paused screen; actual process close happens only when its Exit choice is selected. Do not freeze menu input when freezing simulation.
- The ordinary execution sandbox cannot create a Flatpak instance. Read-only sandbox probes ran with tool escalation; no browser/global settings were altered to make the diagnostic run.
- One extended browser/controller run disconnected during remapping while several rendering suites were active. No page exception established a gameplay fault. Added page-crash/browser-disconnection messages and bounded DOM waits, then ran the controller suite separately. Do not infer physical controller failure from a headless browser-process loss.
- Keep the already-approved smoke command as its own tool call. Combining a file-edit command and browser command in one shell invocation loses the saved approval match and runs Chromium in the execution sandbox. The same applies to adding shell redirection to the approved `npm test` command.
- The isolated extended controller rerun passed through remapping, recovery, disconnect/reconnect, Back/Cancel, Retry, Launcher/title and authenticated exit. The initial process loss remains unexplained; no game change was made to hide it.

## v1.7 livelihood slice
- Adding catch attribution initially added an `undefined` crew field to prototype bags. Keep career extensions conditional so preserved prototype record shapes remain meaningful.
- Availability initially masked an injured person's condition. Injury/death now takes precedence over scheduling absence; next-day and save/resume regressions preserve both vessel loss and crew condition.
- A vessel factory initially risked syncing a new default hull into the existing owned-vessel record before loading it. Factories now restore stored condition/fuel directly; switching live boats alone synchronizes the boat being left behind. Tests cover repeated switching, new days and restore.
- Fuel is prepaid at bunkering. Settlement reports consumed fuel in operating return but excludes it from the second cash debit; the explicit cash-change test prevents double charging.
- Checkpoint validation caught documentation changing while the first career archive was being written. The script correctly rejected that milestone. Keep the archive, pause all edits until backup completion, and create another verified archive; do not treat a launched backup process as a completed checkpoint.

## v1.7 integrated coast / fleet pass
- New career panels were initially styled only on a changed render, while the generic per-frame panel toggle removed their day-screen class. Include every career/expedition screen in that toggle so paused HUDs stay hidden and layout stays stable.
- Starting a new day could retain a history entry pointing to the old summary. Clear the screen/history before opening the new harbour; controller Back/Back is now included in the multi-day flow.
- Repeated alongside observations could overwrite a known sample with zeroed bag data after bag recovery. Skip already-handled bags; preserve the recorded quality/report.
- A browser fixture constructed an incomplete offload result and broke receipt formatting. Replace the fixture with the real boundary-return transition; do not make production receipt code pretend an incomplete test result is a legitimate landing.
- The first complete-voyage pilot attempted low-power turns beside the sector edge, below the shaft boat's useful rudder authority. It drifted into the edge while a diver waited. Revised the test pilot to allow turning room and sufficient ahead power; the second full voyage recovered a natural full bag and returned intact. The game handling was preserved.
- The final isolated controller harness initially received `ERR_CONNECTION_REFUSED` before loading the page: the long-running local Vite server was no longer listening. Restarted the approved development server and the unchanged suite passed through authenticated Exit. The harness's normal browser-close message also says “disconnected”; distinguish the preceding navigation failure or explicit crash from routine cleanup.

## Designer video review — 2026-09-11, 02:21 recording

- **Historical review-only finding; implementation was subsequently authorized and completed.** The recording shows accepted helm commands without thrust around 02:21 onward. The visible starting fuel and an isolated diagnostic strongly support fuel exhaustion; the old HUD exposed drive health as “Propulsion 100%” but omitted fuel/empty-tank feedback. The outward-only departure check also permitted too little fuel for the return. Evidence is recorded once in the [video fault log](history/2026-09-11-video-playtest/FAULTS.md); the following implementation sections record the fixes. Do not attribute this symptom to a controller disconnect without input evidence.


## Video / transcript implementation

- Return fuel originally used the prototype's fixed passage time while the arrival estimate used actual hull/load/weather speed. Both now use `passageMinutes`; the fast, loaded-boat return regression checks time and litres together.
- Harbour indices 7/8 were accidentally included in an expanded screen array, intercepting rest/dock-work actions. Explicit dispatch and next-day browser checks prevent this recurrence.
- Controller tests used a linear, wrapping choice list. Spatial focus intentionally supersedes that behavior; a shared test driver finds paths through rendered geometry and sends mapped controller buttons. Independent geometry and analogue/trigger assertions test actual direction, focus and clock isolation.
- A first assumption that three Up presses from the third chart area would select Almanac was wrong: the visible Boatyard was above that column. Fixed the test to follow the actual geometry; kept the UI behavior.
- The first long career browser run passed its career/save/navigation checks, then lost the browser during the separate voyage. Added a fresh Chromium instance between those substantial suites. No gameplay change was made to hide the process loss; rendered and pure-simulation voyage checks must still pass.
- D&D Pacific Fisheries public synopsis/general-information pages failed through the web reader with and without `www`. Stopped retries and used the official DFO overview for limited context. No full-site review or real-world price accuracy is claimed.

- Full-voyage diagnostics identified a very light shore contact during the scripted pickup approach after the new wind load changed drift. Wider route clearance reduced damage from 0.92% to 0.16%. Trying the deeper opposite-side approach sent the simplistic pilot across the float and injured a diver; rejected it. Kept the safe crew approach and an explicit <1% hull-damage bound for the ordinary-voyage scenario, while retaining strict collision/grounding unit tests. The voyage report records any contact and actual hull condition; a successful working day need not be a perfect AI docking performance.
- Editing a helper during an active Vite browser run caused a page reload and destroyed the execution context. Freeze source/helper edits during browser suites, including seemingly unrelated script changes. Treat that run as invalid and rerun after edits finish.

- Overnight mouse rescue uncovered a navigation regression: calling `scrollIntoView` for the selected controller button every frame pulled a manually scrolled list back to its old selection. Scroll focus only when the selected DOM button changes. This preserves automatic controller visibility while allowing wheel/touch scrolling and pointer clicks below the initial viewport.

- The controller test driver initially treated the focus graph as static while a long remapping list was scrolled. The header becomes reachable as Up scrolls toward the first row. Re-evaluate after each press and walk upward for that Back target; do not restore wrapping menus or change remapping's left/right device controls to satisfy the helper.

## Second video iteration

- Root wharf buttons inherited `.panel button { width: 100% }`, so controller activation passed while the art was covered by stretched labels. Screenshot review caught it. Scope wharf button rules explicitly, keep harbour CSS in its own file, and assert rendered button/frame bounds at compact resolution.
- The new optional R3 shortcut initially blocked existing remapping tests. Optional default shortcuts now yield when that input is explicitly assigned elsewhere; an explicitly mapped orders control remains protected. Existing device profiles and their X/Y meanings are retained.
- New shelf placement first checked a smaller rectangle than the actual outline. Vertex-depth regressions caught the mismatch. Validate the actual outline corners as well as clump centres; do not relax safe-depth assertions.
- Prior non-wrapping guidance is superseded by the latest transcript. Keep directional spatial focus but wrap at vertical boundaries, including Back. Old rest/dock menu-index assumptions are replaced by stable harbour action IDs.
- Running the full verification process inside the execution sandbox again prevented loopback launcher tests and reduced the Node reporter to file-level failures. Run the approved `npm run verify` outside that tool sandbox; no game/launcher code change is justified by that environment failure.
- Rendering measurements must distinguish JavaScript drawing from total frames. A headless Chromium frame can spend far more time in software rendering than in the measured draw function. Record browser, zoom, cadence, sample size and timings; do not claim physical Deck FPS from headless timings.
- The production career UI/save/archive flow passed, but the separate voyage pilot still dynamically imported `/scripts/voyage-pilot.js` from the development server. The production server correctly refuses source files. The harness now injects its test pilot and supplies references to the production game's real simulation functions; it does not ship source files or duplicate physics to satisfy the test.
- Wrapped navigation exposed a real long-list fault: using scrolled screen coordinates moved offscreen rows above the fixed Back button, changing the focus graph after each press and trapping the Almanac route. `menuGeometry` now compensates ancestor scroll offsets. A pure geometry regression verifies stable order and Back/bottom wrapping; the corrected feedback, controller, Chromium and Firefox flows pass.


## September 12 feedback

- Boarding after a depleted-ground dive left `localSearch.elapsed` at its expired deadline. A later fresh deployment inherited it and immediately surfaced, including the reported partial-bag sequence. Clear per-dive search state at boarding/deployment; the failing-then-passing regression follows exhaust → board 41 lb → move → deploy → harvest. Bag clearing itself already worked in the reproduced recovery sequences.
- Recovery could clear the bag and ground before the next periodic chart observation. Record the actual diver sample on recovery completion, before clearing. Test with the periodic observation deliberately deferred; do not reveal unobserved quality to compensate.
- An older saved device profile without newer optional actions failed whole-map validation. Migrate missing fields while preserving existing work/boarding/custom bindings and avoiding occupied shortcuts. This establishes a software migration defect; the video alone cannot establish physical X/Y routing.
- The larger chart preview initially covered part of the offload clock. Screenshot review caught it despite the size assertion passing. Use the panel's right padding, retain the original header footprint, and verify clock separation, panel containment and unchanged neighbour geometry at 1280×800, 1152×720 and 1024×640.
- The intentional Workhorse passage change from 22 to 15 L/h invalidated an old 33 L departure expectation. It now covers both passages but lacks a working reserve; update that expected warning and retain the no-created-fuel invariant. New starter budgets also require browser shopping flows to use actual borrowing before expensive equipment.
- The first full rendered rerun failed its keyboard compass assertion (neutral instead of west). Its driver sent Enter and released ArrowLeft before a rendered frame necessarily consumed Confirm. Centring intentionally clears a compass draft. Hold the arrow until the instruction screen closes, then release and wait for the gameplay gate; preserve the existing compass semantics. No browser exception was reported. The focused rendered rerun verifies this correction.
- A final recovery-range regression reproduced a legal Channel Master pickup completing outside the 12 m passive observation radius. A routine three-second fixture drifted back inside the radius and initially concealed it; placing an already-running recovery at its completion boundary exposed the missing report. Completed recovery now records regardless of passive observation range; ordinary observation retains its limit. Both hull cases pass, alongside turning-relative-speed and true old over-capacity Island Tender save checks.

## September 13 feedback iteration

- Local blur/visibility handlers replaced the current menu with Pause. Keep the existing focus lock and save; do not push a new screen. Video reproduction and both browser engines cover this.
- Rain coordinates based on total time multiplied by changing wind speed jump/reverse during gusts. Integrate incremental displacement instead.
- Adding title actions exposed a confirm press entering and activating the next menu in one frame. Consume the startup frame before screen actions. A full-width remapping panel also needed left/right constraints rather than a new width on an old inset.
- Additive buyer accounting initially dereferenced absent career data in prototype settlement. Guard the demand before using career fields; ordinary prototype offload and rescue regressions pass.
- Earlier tests assumed an eight-service harbour, cloned workshop balance and first-pad legacy bindings without a saved profile. Latest feedback supersedes those assumptions; update fixtures/expected actions explicitly while retaining their navigation, save isolation and physical-input tests.

- The September 13 full run passed the career, save, prior-feedback and two-browser menu suites, then timed out in the prototype compass hold. The driver used a 260 ms wall-clock delay while UI hold time advances through capped render deltas. On the software renderer that was not always a registered long press. Wait for the actual hold threshold and for the orders screen to close before centring the stick; preserve hold/tap behavior. No page exception was reported.
- Title navigation from explicit `?prototype=1` / `?practice=1` sessions must retain that laboratory world. Only the Prototype Lab entered through the main career title returns to the career on title navigation. A dedicated hook and regression distinguish these routes.
- Extending message lifetime alone did not guarantee readable radio: frequent throttle/rudder updates could fill the four visible slots. Retain only one live helm line and pin urgent weather/runoff/passage notices; history excludes helm chatter.

## September 16 S22 / Frank

- Touch CSS alone did not fix phone menus: `screen-render.js` reset the outer panel scroll to zero on every frame, undoing native swipes and even Playwright's scroll-to-button. Preserve outer scroll in touch and introductory menus; use one continuous layout instead of shrinking nested flex rows. Chromium finger swipes and both-orientation button reachability cover the cause.
- A previous portable TEMP had been launched in place and contained `.player-data/firefox-profile/lock`, which the checkpoint correctly refused as an unreviewed symlink. Exclude portable `.player-data` directories from source archives, consistent with the existing live-profile policy; retain every original profile byte in place. The amended pre-pass archive restored and hash-verified 930 files.
- Day-zero exposure needs a nonnegative epoch; clamping the career-day offset to zero keeps the lesson save valid without changing days 1+. Save the separate cove's remaining clumps explicitly, because normal sector stock capture correctly does not include this lesson.
- Initial browser checks against Vite were invalidated by hot reload while source edits continued. Run acceptance against the production server, and change the saved scale through the real title action instead of importing development source into production.

## September 16 tutorial and travel follow-up

- Rendered phone screenshots exposed Frank covering the boat in portrait and the stern label falling behind landscape controls. Put the scrollable lesson card above/beside the boat, move essential readings into it, and keep callout captions beside the rotating hull rails. Short-landscape follow framing stays orthographic. Rechecked actual screenshots in both orientations; coordinate/visibility checks alone did not establish readability.
- The new browser journey initially used an invented chart action ID (`near`). The chart uses indexed choices; use its actual first ground button. This was a fixture selector error, with no runtime exception.
- Direct-to-title Back must remain separate from internal purchase cancellation/completion. Those use immediate-parent navigation; Forward drops pending confirmations and world replacements invalidate the bookmark. Regressions preserve both generic and named-boat purchase cancellation.
- The controller regression caught Menu using the new Back-to-title route during a held-stick resume. Restrict that amendment to visible Back and B; Menu retains its previous pause/resume navigation and release gate. The test checks Back/Forward separately and retains held-stick resume/disconnect coverage.

## Clarified menu history

- The designer's reply supersedes the earlier direct-to-title assumption. Keep separate backward/forward view stacks with a title root, invalidate forward history on a new route, and exclude purchase confirmations. Preserve explicit Menu/Cancel semantics and guard world/phase changes.
- Screenshots caught the compact Forward button wrapping below Back on narrow headings. Group the two in an inline flex container; browser checks assert their centre lines match at every tested phone scale. Include controller traversal across the header without changing remapping's selected device.

## September 16 HUD windows

- Initial resize placement inferred anchors from computed `left/top: auto`, but browsers resolve visible fixed offsets to pixel values. Explicit CSS corner directions now cover left/right/center and top/bottom anchoring.
- Native portrait swipe diagnostics found the helm’s old `pointer-events: none` outranked the first shared attribute rule: touches in gaps went to the canvas. Use explicit window-ID selectors so the whole scrolling region owns gestures. The same specificity correction makes action-feedback overflow scroll instead of clip. Finger swipes test the actual hit target; changing scrollTop alone would not establish this.
- The first portrait overflow fixture could fit its entire contents after widening. Resize it shorter before asserting scrolling; keep the independent assertion that the final nitrogen reading is visible.

## September 16 harbour and shops

- The first selected card inherited the generic panel button’s full width for its Buy control, covering inspection. Browser hit testing caught this; scope shop controls to the shop panel and keep Buy a distinct sibling action. Obsolete touch harbour grid/wash rules also outranked the new scene styling; remove those superseded rules rather than retain two layouts.
- A sticky vertical harbour header hid upper destinations after auto-scrolling a small landscape screen. Let the heading scroll vertically with the scene while retaining its horizontal anchor; all nine destination centres are then reachable.
- Expanding a selected boat across two columns shifted its sister into the next pair. Put the narrow-screen detail after the whole pair, preserve both boat columns, and check their alignment at 150% text.

## September 16 boat card and approved harbour correction

- The touch tutorial explicitly hid `#helmPanel` after moving a few readings into Frank. The follow-up restored the full separate card and positioned the two windows independently. Browser regressions now require boat-card visibility during the lesson and after Show UI, rather than testing it only after the tutorial.
- Making `#startup` scroll moved its absolute backdrop with the contents, exposing empty space below on short phones. The viewport shell now stays fixed; the scaled `.title-copy` owns bounded scrolling. Native swipes verify positive card scroll and unchanged backdrop bounds at 80%, 100% and 150%.
- Restoring the approved desktop harbour alone left portrait `cover` cropping the dock while the button grid stretched vertically. Keep the approved 1.6:1 composition on compact screens and pan it; screenshot review caught this after button-reachability checks passed.
- The old source checkpoint policy included every accumulated game export in each fresh archive. The designer deleted checkpoints and superseded that workflow with additive game exports; do not recreate routine checkpoints.

## September 17 small-screen feedback

- Earlier tutorial/portrait CSS had higher specificity than the new compact boat strip and restored its old top placement. The final touch/intro rule sets the same bottom position explicitly. Resize anchors now match left-positioned Frank/weather windows; tiny footer grips no longer cover the readings.
- New independent current/diver panels initially rendered over the menu because the old menu-hide selectors only named existing panels. Add both new panels to that visibility boundary; the current readout is still independent of the boat card at sea.
- Screenshot review found duplicate controls/recent-message windows crowding the tutorial. Those new optional windows start off, and unrelated panels stay suppressed during the lesson. Every option can still be restored through the shared UI menu.
- Under simultaneous browser work, a smoke assertion could observe the new menu state before the next frame painted its DOM. The new journey waits for render frames after a navigation transition and for the updated scale label after a click. This does not change gameplay timing.
- Practice initially copied an empty real tank. Refill only the isolated practice world; regression checks protect the original career and verify night equipment preparation.

## September 19 debug and environment acceptance

- The wildlife browser check assumed the application owned exactly one canvas, but live chart, minimap and weather layers legitimately add canvases. Identify the Phaser surface through its `#game` parent; do not weaken the check by counting unrelated render surfaces.

## September 21 feedback pass

- Adding six sectors exposed three-entry quota tuning arrays and a version-2 validator that expected the current sector count. Extend all tier tuning, introduce quota-state version 3, validate original three/nine-map saves against their original shapes, then migrate additively. The designer's day-15/day-17 careers are direct regression fixtures.
- Portrait screenshot review caught a translated flex child moving action buttons off-screen. Use a portrait-only two-column grid with a full-width action row; browser checks now assert every touch button stays within the viewport. Tiny instrument text uses container-relative sizes so reducing its window also reduces its contents.
- The bottom-edge layout restore must apply saved size and position together before clamping. Separately fitting against the original intrinsic height moved the saved bottom strip upward.
- Failed vessel image promises and pending sprite entries previously stayed cached. Remove failed promises, clear pending requests and retry with bounded delay; record asset errors even when detailed input logging is off. Browser acceptance deliberately fails a taxi image once and verifies recovery. This does not prove the original physical Deck hang's cause.
- A synchronous audio test read the old Web Audio gain immediately after scheduling a change. Phaser's local `WebAudioSound.volume` getter reads the AudioParam, while the setter schedules it. Measure after audio processing advances. [Official WebAudioSound reference](https://docs.phaser.io/api-documentation/class/sound-webaudiosound). Production continues to use Phaser's sound manager.
- Generated atlas rows were unequal. Equal grid cropping leaked the next portrait; measure the actual gutters and use individual SVG viewports. A CSS circle clip on nested instrument SVGs changed image framing in-browser; retaining the correct viewport without that clip keeps the live face aligned.
- Artwork fixtures must use `spawnWildlife`'s `point` argument and respect its two-encounter cap. Chart headings include navigation buttons in their accessible names, so exact text-role matching incorrectly timed out despite a visible correct map. Bounded waits and failure screenshots exposed both fixture mistakes.

## September 22 performance and device pass

- Sharing immutable sector grids exposed fixtures that called `depths.fill()` on shared authored arrays. Copy depth grids in intentionally mutable fixtures; clone patches/clumps per career. Production never edits authored grids. The complete regression suite verifies career stock isolation.
- Size containment made an unpositioned clock/load widget measure with no intrinsic height after rotation. Apply the complete default/saved rectangle before measuring. Arrange UI retains separate drafts when the viewport changes; Save applies every edited orientation.
- A native Chart click commits after touch release. Queuing menu actions through the neutral-input gate could lose a short tap or reopen the chart; repeated native taps now exercise the actual browser path.
- Firefox's text metrics slightly exceeded the initial clock glass allowance. Reduce the height-relative digital font size and verify the text range against the face in both engines.
- The historical HUD suite still expected the pre-September-21 Lock Screen labels and an extra departure confirmation. Update those expectations to Adjust UI and direct departure. Its old scroll gesture also reversed direction on a 36-pixel-tall resized window; use a positive upward travel from inside the actual window.
- An all-renderer water texture cache regressed forced software WebGL to ~125 ms/frame. Keep animated WebGL geometry; cache only Canvas and avoid its unnecessary `CanvasTexture.refresh()` pixel readback. The failed comparison is retained in this release's acceptance history.
- The restricted sandbox prevents the launcher test's local authenticated HTTP companion. The authorized `npm test`/verification execution outside that sandbox passes; the failure was environmental, not a reason to drop launcher coverage.
- The final crowded Firefox scene exceeded the unchanged 25 ms CPU p95 budget at 27 ms. Distant kelp now uses one representative stem per bed, retaining nearby detail and every physical bed; Canvas texture updates also avoid unnecessary readback. The failed sample is retained, and the same scenario/budget is rerun.
- A cached primary save must be semantically verified, not merely produced by the encoder. Manual and background paths validate the snapshot object before encoding, and invalid live state cannot replace primary/backup data. This retains protection while avoiding re-parsing a large previous envelope every interval.

## September 23 touch and portrait pass

- The harbour uses `zoom: 1`, but inherited inverse-scale navigation minimums enlarged its header when UI Scale shrank. Give this header local 44-pixel navigation targets and content-driven height. Actual hit tests and screenshots cover 50–150% UI Scale in both phone/tablet orientations.
- Startup/child-fullscreen unlock alone misses a late host launch or restored page. Reattempt on visibility/focus/viewport transitions and touch, with one bounded settled retry. Desktop iframe checks cover host-owned fullscreen in both orientations; only physical Android testing can confirm the reported intermittent rotation case.
- Installed Phaser's `WebAudioSound.calculateRate()` replaces its next loop source even when `setRate()` receives an unchanged value. Calling this on every frame created hundreds of sources per three seconds. Only set changed, quantized rates for audible loops, capped at 20 Hz, and stop redundant gain writes once settled. Preserve the before/after source counts and audible gear assertions in release evidence.
- Rebuilding a settings panel every render would detach a native range input during dragging. Keep both sliders mounted and update their labels/values in place; browser acceptance performs a real mouse drag and asserts the original element remains connected.
- The first new journey used the invented starter ID `boat-basic`; the actual stable ID is `starter-basic`. Correct the fixture, without changing production actions. One interrupted device run ended with SIGTERM (143) after tablet checks; it is not passing evidence and was rerun.
- Chromium rejects Playwright window resizing while native fullscreen is active. After checking the official `setViewportSize` reference, the embed fixture exits host fullscreen, resizes, then re-enters at each orientation. Separate ordinary live resize checks cover layout rotation; do not present this as physical rotation while fullscreen.
- The September 22 journey referenced a feedback save's old location. Check its archived location as well, matching the migration suite; use an explicitly labelled synthetic fallback only when neither private file exists. This pass used the archived day-17 career successfully. Original career files were only read.
- Web Audio gain values are stored at float32 precision. Comparing a settled gain against its unrounded JavaScript target still issued identical writes every frame. Round gain targets to float32 before comparison; the final audio regression counts gain writes after idle settles as well as loop source creation.
- Restart the production test server after rebuilding `dist`: it deliberately precompresses static files at startup. Leaving it running served the previous compressed index, whose hashed bundle had been replaced, causing both audio suites to time out before game readiness. Restarting the owned server restores a coherent build; portable exports do not rebuild in place.
- Desktop Menu could be covered by a saved/enlarged minimap. Keep that escape control above HUD windows. The old layout test selected the first row after explicitly choosing the helm; select the row by stable ID instead.

## September 23 working-day pass

- Neutral bow/stern forces initially added a second copy of lateral resistance and weakened the confirmed sideways slew. Redistribute existing linear resistance across the hull, retaining the additional rudder lift and rotational appendage damping. Focused shaft/leg/jet, wind, momentum and existing maneuvering regressions pass.
- Reload checks must enter a real working sea save: the harbour intentionally hides the boat. The first fixture inspected a missing harbour texture. Corrected checks compare each of twelve hulls' installed pixels with its prepared source after reload in Canvas/WebGL and exercise the vector switch. Cached artwork now stays separate from Phaser-owned canvases, with explicit initial GPU refresh; a stale harbour hull is repaired from the saved trip hull. This hardens both paths without claiming reproduction of the original intermittent physical-device symptom.
- Keep Pause's established first actions stable when adding deck/equipment menus; inserting new rows before those actions broke controller/menu expectations. The new entries follow the existing controls.
- A fixture that changed only `career.activeBoat` contradicted the actual saved boat. Use `useVessel` to change both; restore correctly treats an owned saved trip hull as authoritative.
- Optional capped buyer orders supersede automatically generated unlimited premiums. Preserve previously saved today/tomorrow agreements once, then return to a fresh daily choice. The economic sensitivity harness must explicitly choose an available order before sailing; otherwise it models a skipper declining every new offer. With that stated strategy the existing solvency/progression guards pass, without relaxing their thresholds or changing coast prices.
- The controller journey still expected Sea Pause Back to return to Title, superseded by the current Bible's return-to-water rule. Correct that stale fixture and reopen Pause through Menu; retain actual mapped-button remapping, recovery, focus and disconnect checks. No production navigation change was needed.
- Prototype restart prepares the replacement terrain asynchronously. Checking old render markers immediately after menus close can see the previous load; wait for readiness and the replacement frame's empty deck, while retaining the immediate simulation-total assertions.

## September 24 crew and coasts

- Runtime current limits initially fed the habitat-authoring view and changed reef candidates, even preventing one coast’s extra grounds from fitting. Apply the limits only to views carrying a live/forecast sector ID; retain the original authoring field and deterministic ground identities. Scale the Home Coast field before bounding so channels, eddies and slack keep their relative structure.
- The new browser fixture omitted `debugConditions.tideHeight: null`, so save validation correctly rejected it and started Frank’s intro. Use a valid saved fixture and assert the working state before sending controls. This was a test setup fault, not a save migration fault.
- Screenshot inspection found the Orders grid clipped on a narrow keyboard-driven window despite passing button-click checks. Narrow Orders now use one scrollable column regardless of input mode, and browser checks assert every order control fits the viewport.
- Tests that required a second bag press, skipped a diver who refused descent, expected strong starter currents, or accumulated large weekly fatigue were updated to the explicit new design. Collision, exposure, catch conservation and ordinary voyage checks remain active.
- The older prototype journey read the retired text clock and sent boarding during an asynchronous scene reset. Check the actual arrival time/summary state, then wait for scene readiness and its neutral-input gate before boarding. The updated full prototype journey passes with the actual one-press recovery flow; no production input bypass was added.

## September 24 rotation and helm

- `ScreenOrientation.unlock()` restores a default that can still be landscape. Prefer explicit `lock('any')` where permitted and keep unlock as the unsupported/denied fallback. Cache a successful request so routine resizes cannot undo it. Inside an already-fullscreen touch host, a trusted touch can claim the child's fullscreen permission, matching the video's successful manual transition. Desktop checks model orientation permission; they cannot prove physical Android rotation.
- The first Firefox embed run failed an exact phone-size assertion after entering native fullscreen. An isolated diagnostic showed headless Firefox always expands to its 1366×768 virtual display although `screen.width/height` and the pre-fullscreen viewport follow Playwright's requested phone size. The corrected check requires the child to fill the actual fullscreen host and verifies both requested phone layouts outside fullscreen; Chromium additionally retains exact-size fullscreen assertions. This changes the fixture, not game layout or claimed physical-device coverage.
- Firefox can complete the fullscreen promise before the touch menu's next render. Wait for the actual menu to become visible instead of asserting visibility synchronously; the original touch is retained, with no extra tap or production input change.

## September 24 deployment and tablet feedback

- The previous shared target selector fell back to the selected underwater diver after finding no alongside recovery target. Deployment now chooses an eligible aboard diver; active recovery and explicitly pinned commands still win. The old HUD and controller regressions expected no deployment when the selected diver was away; update them to verify automatic second-diver deployment, unchanged selection and rejection only when neither diver is aboard.
- Profiling the supplied tablet-size scene exposed unnecessary full-screen weather Canvas redraws and per-step decorative foam shoreline checks. Cache dry shading by its visible inputs; keep rain/lightning/lights responsive. Advance decorative foam in staggered cohorts with accumulated elapsed time and the same swept wet-path check. Preserve every physical object's update cadence. [Measurements](history/2026-09-24-deploy-and-tablet/README.md).
- The browser diagnostic initially guessed an input setter that does not exist. Use the actual `ui.touch.setEnabled()` path for the permanent acceptance journey. A sandboxed Chromium launch and launcher regression were blocked by OS/loopback restrictions; the authorized external-sandbox reruns pass.
- The recording's blank first departure is real but was not reproduced by the local departure/reload journeys. Do not attribute it to graphics loss, assets or terrain workers without a device error log. The existing bounded troubleshooting download now carries the correct release identity.

## September 24 keyboard, coasting and traffic

- Full-speed neutral immediately enabled the full low-speed bow/stern water-force couple, producing an 81–101° shaft-boat swing in the five-second diagnostic. Fade its forward coasting contribution at passage speed while preserving the established low-flow lift, rotational damping, powered control and no-relative-flow rule. The final diagnostic is about 6–8°; existing low-current/momentum checks pass.
- Rival destinations were bed centres and repeated pickup targets inside their own bubble-avoidance circles. Full-hull safe berths, stationary fishing and daily visit budgets replace those loops. Three-seed/five-sector runs exposed a narrow shoal missed by four-metre route samples and a route that became unsafe as tide fell. One-metre samples and low-water rival clearance pass complete approach/fish/exit checks without reducing collision checks.
- A surfaced diver was separated using a local coordinate from the earlier swept pose and then placed relative to the boat's new position. This transferred forward boat displacement to the diver. Keep the current world-tangent position during sideways separation; slow bow tests at three headings and existing harmful-contact tests remain active.
- The full natural-voyage fixture hit timber after handling changed. Centring the test pilot's rudder during neutral waits alone did not solve it. Make the pilot slow for nearby visible timber, retaining actual helm, weather, harvest, contacts, damage thresholds and the ≥99% hull assertion. The completed voyage returns with 100% hull and both divers fit. No production damage rule was loosened.
- The new browser journey initially asserted keyboard controls immediately after mouse Continue, before any keyboard input selected that device. Send a real Enter press before testing the keyboard reference. Sandboxed launcher checks could not open loopback sockets; the authorized outside-sandbox verification runs the actual tests.

## September 25 coasts and safety

- Taxi turns previously zeroed speed above a 0.35-radian heading error; radial repulsion also changed avoidance direction around a hull. Use predictive, stable-side avoidance and continuous taxi speed. Normalize missing speed in older diagnostic actors before acceleration; otherwise undefined speed propagated NaN into swept hull geometry.
- The new open-water bubble fixture modified depths after the coast rock catalogue was cached. Clone the terrain object before deliberately flattening that fixture. Actual coastal navigation and solid-rock guards remain active.
- Update old migration/force/confirmation/crossing assertions to the explicitly approved version-7 quality, gentler thrusters, confirmation menus and bubble-directed taxis. The five-second stationary thruster diagnostic drops from 0.3058 to 0.2456 radians; force is 20.5% lower.
- The natural voyage pilot's 80% ground filter selected a different reef after the Home Coast quality band changed. Use the corresponding 77% class. Its unnecessary staging loop then left a nearby surfaced diver exposed to a committed taxi; direct slow pickup succeeds with ordinary physics and unchanged safety assertions, returning on time with both crew fit and 100% hull.
- Sandboxed Node test children hid individual assertion output, and the launcher cannot open its local socket there. Direct focused files exposed failures; the authorized external-sandbox full run supplies complete test counts and real launcher coverage.
- Final review caught that a saved Godmode choice must also mark subsequent trips assisted when all information assists are off. Include it in trip-start classification and verify the next-day path; the invulnerability/rendering behavior is unchanged. Preserve the first export and create an additive final pair.
- A visual-only blood screenshot lowered the existing emergency panel’s opacity, masking that the ordinary full-height panel concealed the effect in actual play. Keep the real rescue menu compact at the bottom, then test untouched landscape/touch-portrait screens and the actual rescue action. Do not treat a modified diagnostic screenshot as proof of normal visibility.
