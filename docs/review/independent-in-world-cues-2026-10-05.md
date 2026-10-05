# Independent review: in-world cues, bubbles and phone menus — October 5, 2026

I am a separate reviewer who did not write this code. I looked at screenshots only: the production-build fixture captures in `test-results/in-world-cues-2026-10-05/` (1280×800, game camera) and `summary.json`, the menu captures in `test-results/overflow-before/`, `overflow-after/` (Chromium) and `overflow-firefox/`, their `audit.json` files, and the designer's references in `feedback/10-5/`: the S22 screenshot, photo `20261005_113312.jpg`, and frames taken every 4 s from `20261005_112905.mp4` and `20261005_113328.mp4`. I zoomed crops with ffmpeg. I did not play the game, watch it in motion or use a real device.

## 1. Diver bubbles (working and ascent)

**Reference.** In the photo and video frames a working diver shows as a large, irregular, milky jade-green glow under the surface. Inside it are smooth, flattened, slightly darker slick patches with ripples around their edges. White specks of fizz are scattered sparsely over a wide area, densest on the upstream side. The green area is many times wider than any single white fleck.

**Working (`bubbles-working.png`, `bubbles-close.png`, `bubbles-wide.png`).** The upper-right diver, which has no assist ring, shows two or three overlapping pale green discs about 25–30 px across. They have soft edges, and white specks gather mostly around the disc rims. This is close to the reference in colour and in "boil patch ringed by fizz". Three things fall short:
- The footprint is small and compact. The whole group is about 70 px across at default zoom and about 30 px in `bubbles-wide.png`, where it reads as a faint smudge. In the reference the milky upwelling is the dominant feature. Here it is barely brighter than the water texture. The upwelling needs to be larger and more irregular, extending beyond the boil patches (should-fix).
- The boil patches are drawn *lighter* than their surroundings, as uniform pale discs. In the reference they are smooth, glassy and a little darker than the milky water, and they are visible because the ripples and fizz stop at their edges. As drawn they read as "bright circles" rather than "flattened boil" (should-fix).
- The patches are near-perfect circles of similar size sitting side by side. The cluster looks like a few overlapping coins, not an organic boil (minor).

Specks: the scatter is reasonable but too tight to the patches. The reference has isolated specks well outside the boil (minor).

**Ascent (`bubbles-ascent.png`, `bubbles-close.png`).** The big hollow circle is gone. In its place is a filled white disc with bright clustered blobs and a fringe of spray, which matches the designer's "filled in boiling white circle". The designer's main complaint is resolved. Remaining issues:
- In `bubbles-close.png` the disc is made of overlapping bright soft-edged puffs. The silhouette is lobed, and it reads as a cloud, cauliflower or cotton wool more than churning foam. At default zoom (`bubbles-ascent.png` crop) the edge has visible flat facets, an octagon-like outline (minor; a noisier or broken edge would help).
- The white is uniformly saturated with bloom-like lumps, with no darker water between foam cells. Real boil shows foam lace over dark water. This is acceptable for readability. The ascent disc is now by far the most eye-catching element in the frame, which is probably right for "diver coming up" (minor).
- A small green rectangle is visible inside the ascent boil in `bubbles-close.png` near (850,195). It is presumably the diver or a marker showing through. Harmless, but noticeable when zoomed in.

**Not judged from stills:** how the boil churns and pulses, whether specks flicker or drift with the current, the working-to-ascent transition (does the disc grow smoothly or pop?), how it fades after surfacing, and performance on the Doogee tablet. All of these need to be seen in motion.

## 2. Deck load: ghost rings, flash, full lamp, hull settling

**Ghost rings (`load-empty.png`, `load-half.png`).** At 3× zoom the rings are thin cream circles. They overlap heavily because each ring is wider than the slot spacing, so the empty deck looks like a chain-mail or Olympic-ring pattern over the hatch outlines. At native 1280×800 they are faint cream on pale blue-grey deck, visible only if you look for them. I could not see a difference between the "layer being filled (strong)" and "later layers (faint)" rings on the empty deck. All rings look equally faint. The rings are close in colour to the coiled rope on the port quarter, which blurs the reading. Whether a player would learn "these are the remaining sack places" without being told cannot be shown in stills, and the cue is weak (should-fix: raise contrast on the current layer's rings, or shrink the rings so they don't overlap). In `load-half.png` the three unfilled slots at the stern do show as faint rings, so "space left" is legible there.

**Flash (`load-pulse.png`, 14 bags, one just landed).** This is the most confusing still. A block of roughly 3×4 already-stowed sacks is tinted orange or amber, and two bright yellow discs sit at the bottom-right slot. From a still you cannot tell which sack just landed. The orange wash looks as if many sacks are glowing, or as if a second layer of ghost rings has been drawn strong *over* the stowed sacks. If the orange block is the next layer's strong ghost rings, it hides the sacks underneath and reads as a highlight, not as "space still free". It may also be the flash spreading wider than intended. Either way the image is ambiguous (should-fix: the flash should clearly mark the one sack that landed, and upper-layer ghosts should not tint the sacks below as solid colour). The timing of the flash cannot be judged.

**Full lamp (`load-full.png`, `load-full-night.png`, `load-full-wide.png`).** The amber lamp sits on the aft starboard corner of the wheelhouse roof, with a soft halo. When unlit (empty and half states) it is a small brown dot. Daytime close-up: clearly lit and readable. Wide zoom: the lamp is a dot of about 4 px. The red block of sacks filling the deck is the stronger "full" cue there, so the lamp adds little at wide zoom (minor). Night: the halo is dull, and the lamp is about as bright as the white cabin light near the companionway. For an indicator meant to work at night it is under-powered (should-fix: brighter core or larger halo at night). Steady versus blinking cannot be judged.

**Full deck (`load-full.png`).** The deck reads as visibly full, with sacks covering the working deck. Good. The top-layer sacks are irregular: the pattern of tie-dots has gaps, which reads as a natural stack.

**Hull settling (`summary.json` hullY 0 → −0.46 m, trim 0.022, `load-empty`/`load-full` stern crops).** From the rigid orthographic top-down camera I could see **no** visible difference in waterline, freeboard or hull outline between empty and full. The stern crops are the same apart from the sacks. The numbers say the hull sinks 0.46 m, but the camera cannot show it. For "sitting lower in the water" to work as a visible cue, something visible from above must change: wake or bow wave, water lapping the deck edge, a waterline band, or slower pitching. As captured, this part of the request is not achieved visually (should-fix; note the designer named it explicitly).

**Damaged hull list (`hull-damaged.png`, roll 0.068 rad ≈ 4°).** The hull is slightly asymmetric: a little more starboard topside shows, and the deck items shift. It is noticeable only when compared side by side with an undamaged hull. Most players won't see it from above (minor; the list may show better in motion as a rocking offset).

**Not judged:** whether the old deck-load HUD card was actually removed (no HUD appears in these fixtures; I looked at `night-phone-sea-deck-catch.png` and it is the catch menu, not the in-play HUD), the flash's duration and fade, lamp blink, how settling and trim animate, and night readability on a dim tablet screen.

## 3. Phone and tablet menus

**Designer's S22 screenshot.** "Coastal Workhorse", the price "$52,000" and "Inspect boat" ran past the right edge of the cards. The preview images sat in tall, narrow dark tiles beside the text.

**Fleet / fleet-detail / yourboat-detail / starter (phone).** Fixed. In both Chromium and Firefox (night) and Chromium (day), the cards stack the preview above the text. Names such as "Harbour Workhorse II" and "Coastal Workhorse II" fit on one line, and prices and "Inspect boat" stay inside the card. The audit's 15/14/14 overflow hits before the fix are now 0, and my visual check agrees. Remaining issues:
- "Harbour Workhorse II" and "Coastal Workhorse II" fill the card width with almost no right padding. A longer name or a larger UI scale would overflow again (minor; confirm at the larger UI-scale settings).
- The stats line ("6,200 lb deck · 580 L tank") is very small, about 8–9 CSS px judging from the capture. It is readable at 3× density but small for a moving phone (minor).
- In the day theme the dark preview tile is narrower than its grey frame, leaving grey bars on both sides. On the selected card these bars turn dark orange (fleet-detail, starter, both themes). This looks unfinished (minor).
- On the selected card (fleet-detail, yourboat-detail), the small "Buy" button sits bottom-right with its label pinned top-left inside the box. The card is taller than its neighbour, so the grid looks ragged. This is pre-existing and also visible in the "before" capture (minor).
- The sticky bottom bar ("Pick a boat first" / "Buy selected boat") covers the next card row. This is expected with a scrolling list, and was also in the designer's screenshot.

**Conditions (phone).** Fixed. "Wait 30 minutes at harbour" now sits beside "Tide & current almanac" on two lines, inside the panel, in Chromium night/day and Firefox. Before the fix it was pushed off the right edge. No issues.

**Bindings (phone).** Night, Chromium and Firefox: the keyboard diagram is wider and scrolls sideways. Labels such as "Deploy / board", "Throttle up" and "Return to harbour (beyond the harbour line)" fit inside their keys. Firefox hyphenates a few ("Detail lev-els", "har-bour line"), which is acceptable. **However, `overflow-after/day-phone-bindings.png` still shows the old narrow keyboard**, with words broken mid-word by the new `overflow-wrap: break-word`: "Deplo y/ board", "Throt tle up", "Rudde r left", "Neutr al", "Order s", "Retur n to har- bour". This is uglier than the original. In the CSS diff, the 720 px width is scoped to `body.touchscreen #playtest .keyboard-diagram`, so any narrow window *without* the touchscreen class gets the 510 px keyboard plus the forced mid-word breaks. That covers this day capture, and possibly a phone that isn't detected as touch, or a narrow desktop or Deck browser window. The audit counts this as "no overflow" because the text no longer spills, but it is not readable (must-fix: either apply the width whenever the viewport is narrow, or confirm why the day capture lacks the class and make sure no real device ends up in that state). Night-phone screenshots crop the right-hand keys (F6 "Assists", "Space Neutral"). This is acceptable given the "Swipe the keyboard sideways" hint.

**Tablet (night/day `*-tablet-*`).** Fleet still shows the preview beside the text, with very small boat thumbnails in tall dark tiles. This is pre-existing, nothing overflows, but it looks sparse (minor). The tablet bindings keyboard fits fully. Other phone screens sampled (sea-deck-catch, market, accounts, outfit-detail): no overflow seen.

**Not judged:** real S22 Firefox rendering at device font settings, rendering at UI scales other than the captured default, and touch scrolling of the keyboard diagram.

## Prioritized list

1. **Must-fix**: `day-phone-bindings.png`: the narrow keyboard plus `overflow-wrap: break-word` breaks key labels mid-word ("Deplo y/", "Rudde r", "Neutr al"). The widening only applies under `body.touchscreen`.
2. **Should-fix**: load settling is invisible from the top-down camera; nothing visibly changes between empty and full apart from the sacks. The designer asked for "sitting lower in the water".
3. **Should-fix**: `load-pulse.png` is ambiguous. An orange wash over about 12 stowed sacks and two yellow discs: you cannot tell which sack landed, and upper-layer ghosts appear to tint the sacks below.
4. **Should-fix**: ghost rings are faint, overlap into a chain pattern, show no visible strong/faint layer difference, and are coloured like the rope coil.
5. **Should-fix**: working-diver upwelling is too small and faint, especially at wide zoom. Boil patches are lighter discs rather than smooth, darker flattened slicks.
6. **Should-fix**: the full-load lamp is weak at night, roughly as bright as the cabin light.
7. **Minor**: the ascent boil reads as cloud or cauliflower with a faceted edge. Working patches are uniform circles. Specks are too tight to the patches. The damaged-hull list is barely visible. The lamp is a 4 px dot at wide zoom. Boat-card names have no right padding. Stats text is very small. Grey or orange bars sit beside preview tiles. The "Buy" label is mis-aligned. Tablet fleet thumbnails are tiny.

## Follow-up — October 5, 2026 (afternoon)

I am the same separate reviewer and again looked at screenshots only. I used the regenerated captures in `test-results/in-world-cues-2026-10-05/` (timestamps 14:55–14:56) and `test-results/menu-theme-2026-10-05/day-phone-bindings.png` (14:45). I cropped and zoomed them the same way as in the first pass.

**#1 Day-phone keyboard labels — resolved.** By file time, `overflow-after/day-phone-bindings.png` (14:38) does predate the fix. The post-fix strict-suite capture, `menu-theme-2026-10-05/day-phone-bindings.png`, shows the wide keyboard with whole words on the keys: "Deploy / board", "Throttle up", "Rudder left", "Neutral", "Return to harbour (beyond the harbour line)". The right-hand keys are cut off behind the swipe hint, as in the night capture. No mid-word breaks are visible. I still cannot say whether a narrow window *without* `body.touchscreen` falls back to 510 px; this capture does not test that case.

**#2 Sitting lower in the water — open; accepted as a camera limit.** I agree with the coordinator: from the rigid top-down orthographic camera, a hull sinking in place cannot read in stills. The regenerated `load-full.png` stern still looks like `load-empty.png` apart from the sacks. Trim, heavier bob and a wider wake are motion cues that I cannot verify from stills. The designer should be told plainly that this part of the request is carried by motion, not by a visible waterline. Otherwise they may judge from a still and conclude it is missing.

**#3 Flash on the landed sack — resolved.** In `load-pulse.png` a single sack at the after end of the stack (bottom row, second from port) is lit salmon-pink with a pale rim. It is clearly "the one that just landed". The other sacks are back to plain red. Two leftover traces remain: a faint warm-yellow ring at the next free slot to starboard, and a very faint warm cast over the second-layer area. Both are subtle and do not compete (minor). The pink is closer to "selected" than "flash". Timing and fade are still unjudged.

**#4 Ghost rings — partly resolved.** The rings are now cyan-white and clearly distinct from the cream rope coil, so the rope confusion is fixed. They still overlap into a chain-link pattern, because each ring is wider than the slot spacing. At native size they remain faint on the pale deck. I still cannot see a strong/faint layer difference on the empty deck. With later layers at 22% and 7% opacity this is expected, but it means the empty deck shows the ring pattern as one undifferentiated grid (should-fix stays, at lower priority). In `load-half.png` and `hull-damaged.png` the free slots read clearly as cyan rings.

**#5 Working upwelling — partly resolved.** In `bubbles-working.png` and `bubbles-close.png` the milky glow is now a larger soft halo that spreads past the fizz. In `bubbles-wide.png` the working diver now shows as a visible pale glow rather than a smudge. This is a clear improvement and closer to the photo. The "darker, glassy" boil patches are barely visible in the stills. Inside the glow I can just make out slightly darker lobes ringed by bright fizz, but the overall impression is still a pale disc with specks. The glow is also still close to circular, while the reference shows an irregular, current-skewed shape (should-fix reduced to minor; the change in motion may help).

**#6 Night lamp — resolved.** In `load-full-night.png` the halo is about twice as wide and clearly the brightest thing on the boat, well above the cabin light. In daytime `load-full.png` it is unchanged and readable. At wide zoom it is still only a small dot (minor, unchanged).

**Minor items from the first pass:**
- Ascent boil: unchanged in character. It still reads as clustered bright puffs (cloud or cauliflower in `bubbles-close.png`), with a slightly faceted outline at default zoom.
- Damaged-hull list: still subtle.
- Menu nits: not re-captured, assumed unchanged.

**New:** none of note. The regenerated captures show no regressions I could find: assists, current arrows and boat appearance match the first pass.

**Remaining list:**
1. Settling has no visible cue in stills. It is an accepted limit and must be stated to the designer.
2. Ghost rings overlap into a chain pattern and the layers are not distinguishable (should-fix, low).
3. Working boil patches are not visibly darker or glassy, and the glow is circular (minor).
4. The ascent boil looks like puffs (minor).
5. Minor menu items as listed in the first pass.

Not judged, as before: all motion (boil churn, flash timing, lamp, trim, bob, wake), device performance, and real-device menus.
