# Independent visual review: diver bubbles, deck-load ghost, Night switch rows (October 5, 2026)

Reviewer: independent subagent reviewer (Claude), not the author of the code under review. No code was edited; this file is the only write. Judgement is from screenshots only: staged fixtures at 1280×800 in Chromium on the Steam Deck GPU (top-down orthographic camera) and the menu-theme captures. No natural playthrough, no touch device, no animation sequence was viewed; each "pulse" frame is a single still taken 0.2 s after a sack lands.

Feedback reviewed: designer notes "10-5 v2" (bubbles 50% transparent and about 25% smaller area; Night-mode switch-row bug; deck-load cue should be a 3D ghost of a full deck that flashes, stacking into a second layer, not circles and not only the newest sack).

## Images inspected

- Before/after pairs from `test-results/in-world-cues-2026-10-05-baseline/` and `test-results/in-world-cues-2026-10-05-v2/`: bubbles-working, bubbles-ascent, bubbles-wide, bubbles-close, load-empty, load-half, load-pulse, load-light-pulse, load-second-layer, load-second-layer-pulse, load-pulse-night, load-full, load-full-night, load-full-wide (after only, full frame), hull-damaged. Comparisons were made as nearest-neighbour 3× crops of the boat (crop 160×270 at 560,260) placed side by side, and 2× crops of the bubble strip, written to the session scratchpad.
- `test-results/menu-theme-2026-10-05/`: night-phone-settings, night-phone-settings-logging-on, night-deck-settings-auto-fullscreen-on, night-tablet-settings-logging-on, day-deck-settings-auto-fullscreen-on, day-phone-settings-logging-on.
- Designer video frame sheet `scratchpad/v2frames/t02.jpg` (the bug as reported).

## 1. Diver bubbles

The reduction is clearly visible. In bubbles-close and bubbles-ascent the ascent boil goes from a bright, near-white cluster of overlapping discs to a grey-white translucent cluster through which the water texture shows; the green diver marker inside the boil is now visible through it, which it was not before. The working upwelling loses most of its glow halo and its specks are sparser; at bubbles-close it is still a readable patch around the diver ring. By eye the boil's outer extent shrinks by roughly 15–20% in diameter and its bright core by more, so the perceived area reduction is somewhat above 25% (estimate roughly 30–40%, because halving opacity also drops the faint outer edge below visibility). This is within reasonable reading of "about 25%" but slightly on the strong side. **Note.**

The ascent boil still reads as the warning: it is a dense, filled, roughly circular mass, distinctly brighter and more solid than the sparse working specks in every frame, including bubbles-wide, where the boil is still a visible white disc near the boat while the working diver is reduced to the ring plus a few specks. **Note:** at bubbles-wide the working upwelling is close to invisible on its own; the diver ring carries it. That matches the request but should be checked on the S22 phone, where everything is smaller. The boil now has less contrast against brighter water (it is grey rather than white); none of the fixtures show it over shallow/light water or in night lighting, so that is unverified. **Should-fix (verification gap):** capture the ascent boil at night and over light shallow water before calling the warning safe.

## 2. Deck-load ghost

**Shape.** The ghosts now read as rounded 3D sacks with shading, not as rings. In the flash frames they are clearly sack-sized lit spheres; the edge-ring circles from the baseline are gone. This answers "it should be a 3D representation". Accepted.

**Flash as "ghost image of a full deck".** In load-pulse, load-light-pulse and load-second-layer-pulse the whole remaining capacity lights up yellow at once, and the yellow area against red gives a quick sense of how much is left: load-light-pulse (one row loaded) shows a large yellow block filling the rest of the cargo area; load-pulse (most of the first layer loaded) shows yellow mostly over the red sacks (the second layer) plus a pale patch at the open slots. This does what the designer described. Remaining issues:

- **Should-fix:** the flashed ghosts overlap so heavily (upper-layer sacks staggered over lower-layer sacks, all at similar opacity) that the flash reads as one lumpy yellow cloud rather than countable sacks. In load-light-pulse the empty first-layer slots and the second layer above them merge into a uniform yellow carpet, so the second layer's extra capacity is not distinguishable from the first; you see "how much deck is uncovered", not "how many sacks are left". Giving the upper layer a different tint or a visibly darker outline, or slightly lower opacity than the lower layer, would let the two layers read separately.
- **Note:** where yellow ghosts sit over red sacks the result is a salmon/orange tint, which can read as the real sacks changing colour rather than as a ghost above them. At flash peak in load-pulse the red sacks under the second-layer ghosts are largely washed out.
- **Note:** the flash gives no cue which sack just landed. That is the requested design (single-sack flash removed) and I see no problem with it.

**Second layer reads as stacked?** Partly. From a straight-down orthographic camera, stacking can only be shown by occlusion, shading and the 85% size; the upper-layer ghosts do read as round objects sitting on top of the red layer in load-second-layer-pulse, and the real second-layer sacks in load-second-layer look raised. But it relies on the viewer inferring height from overlap; there is no shadow or size cue strong enough to read "second tier" instantly at phone scale. **Note**; possibly unavoidable with this camera.

**Rest state.** On bare deck the rest ghost is effectively invisible: in load-empty, load-half and hull-damaged I could not make out individual ghost sacks over the empty slots, only a faint pale haze over the cargo area at 3× zoom. At normal size it is invisible. Over red sacks the upper-layer rest ghosts show as a whitish milky haze (load-half, load-second-layer, hull-damaged), which reads more like mist or a rendering artefact on the catch than like sacks. So the rest state is simultaneously too faint where it would be informative (empty deck) and slightly muddying where it is visible (over the catch). **Should-fix:** either drop the rest state entirely and rely on the flash, or raise it slightly on bare deck while lowering it over loaded sacks. Not must-fix: the designer asked for a flash, not a permanent ghost.

**Full deck.** load-full and load-full-night show no residual ghost and are pixel-equivalent to the baseline; good.

**Night.** load-pulse-night: the flash is visible against the dark deck and reads as pale yellow-green sacks; the warm glow is less saturated than daytime but legible, and it does not blow out. Acceptable. The rest-state at night was not separately inspected beyond load-full-night (which has no ghost).

**Scale.** No wide-zoom pulse frame exists. At load-full-wide the whole boat is about 50×110 px; at that scale the flash will be a small yellow smudge. **Should-fix (verification gap):** capture a pulse at wide zoom and on the phone viewport.

## 3. Night menu switch rows

The bug in the designer's video (ON, unselected switch rows turning into a cream panel with invisible title and near-invisible description) is fixed in all captures inspected. In night-phone-settings-logging-on, night-deck-settings-auto-fullscreen-on and night-tablet-settings-logging-on the ON, unselected row keeps the normal dark navy row with readable cream title ("Troubleshooting log: ON", "Auto fullscreen & rotate on touch: ON") and description, and a teal track with the knob on the right. OFF rows show a grey track with the knob on the left, and the title states ON/OFF, so state is distinguishable without colour. Day mode (day-deck-settings-auto-fullscreen-on, day-phone-settings-logging-on): ON rows are cream with dark text and a dark-teal track; readable.

**Note:** on the selected (orange) row in the OFF state (night-deck-settings-auto-fullscreen-on, Troubleshooting log: OFF) the switch track is only slightly darker than the orange and the knob is pale; the switch itself is low-contrast there, though the title text carries the state. Day OFF-on-orange is similar but slightly better (dark knob).

**Note (likely pre-existing, outside this change):** in the deck and tablet Settings captures the section headers "YOUR INTERFACE" and "CONTROLS" are clipped at the top of the scroll area under the page subtitle; on the tablet capture they are almost entirely hidden.

## 4. Regressions

- Hull (hull-damaged): no visible change in the hull or fittings other than the ghost change; no regression seen.
- Lamp (load-full, load-full-night): wheelhouse lamp glow unchanged from the baseline.
- Menus: no regression seen in the six Settings captures; only the switch-row change is visible.

## Summary of classifications

- Must-fix: none.
- Should-fix: flashed upper and lower ghost layers merge into one yellow mass, so remaining sacks cannot be counted and the second layer's capacity is unclear; rest-state ghost is invisible on bare deck yet leaves a milky haze over the real red sacks; verification gaps: no wide-zoom/phone pulse frame, no ascent boil at night or over light water.
- Notes: bubble area reduction looks slightly larger than 25% because halving opacity also hides the outer edge; working upwelling is near-invisible at wide zoom apart from the ring; yellow-over-red tint can look like the catch changing colour; stacking shown only by overlap with this camera; OFF switch low-contrast on the selected orange row; Settings section headers clipped (likely pre-existing).

## Second pass (October 5, 2026, later build)

The same independent reviewer inspected the rebuilt captures after the coordinator reported two changes: the rest-state ghost is removed (ghosts are hidden between landings and only flash), and in the flash the bottom layer is warm yellow while stacked layers are pale cool white with a firmer outline and thinner body. Images re-inspected from `test-results/in-world-cues-2026-10-05-v2/` (overwritten by the new build), each compared against the unchanged baseline with the same 3× crops: load-half, load-pulse, load-light-pulse, load-second-layer, load-second-layer-pulse, load-pulse-night, hull-damaged, plus the new load-pulse-wide (full frame and a 6× crop of the boat) and bubbles-ascent-night (full frame and a brightness/contrast-boosted copy).

**Rest-state haze: resolved.** load-half, load-second-layer and hull-damaged show clean red sacks and bare deck with no milky haze and no ghost. They are cleaner than the baseline, which still had edge rings. Nothing remains at rest.

**Layers merging in the flash: largely resolved.** In load-pulse and load-second-layer-pulse the upper-layer ghosts over the red sacks are now pale, outlined spheres; each can be counted, and the salmon wash over red is gone. In load-light-pulse the yellow bottom layer and the white-outlined upper layer can be told apart: the white outlines are visible on top of the yellow block, so the second tier's capacity reads separately from the first. The yellow bottom layer itself still merges into one block where several slots are empty together, but that block shows remaining floor area, which is what it needs to show. **Note:** the white upper-layer ghosts, with their glassy body and bright rim, look somewhat like large soap bubbles. In isolation this is harmless, but now that diver bubbles are also pale translucent discs it is worth a glance in play to confirm nobody reads them as bubbles.

**Night flash: acceptable.** In load-pulse-night the yellow bottom layer is muted but visible against the dark deck, and the white upper ghosts read clearly over the dark red sacks.

**Wide zoom (load-pulse-wide): acceptable at Deck resolution.** At about 50×110 px for the whole boat, the flash appears as a yellow patch aft of a pinkish-red patch. "Yellow = room left aft" is readable at a glance, but individual sacks and the second layer are not; at this scale the white upper ghosts only lighten the red. That is probably the best this camera can do. **Note:** no phone-viewport frame exists. The S22 in landscape renders the scene at a similar or smaller pixel size and is viewed on a much smaller physical screen, so the wide frame is the best proxy, not proof. This matters, because the designer mostly plays on touch devices.

**Ascent boil at night (bubbles-ascent-night): not verified, should-fix.** The frame shows the boat, the lamp-lit wheelhouse, one current arrow and darkness; there is no boil, no diver ring and no hose line anywhere. Even with brightness and contrast boosted heavily the frame is black outside the boat. The day bubbles-ascent fixture shows the diver ring, hose fan and boil in the upper half of the frame, so this capture either did not stage the divers (the night fixture may have failed), or the boil, ring and hose are all fully invisible at night. If the latter, that is a must-fix, because the ascent boil is a safety warning. The capture cannot tell which, so the night gap from the first pass is still open. Check whether the fixture placed the divers (for example by logging diver positions and boil state into summary.json, which currently records only load state) and re-capture.

**Nothing new regressed** in the hull, the lamp, the full-deck frames or the red sacks in the frames listed above.

Second-pass status: both ghost should-fixes resolved. The wide-zoom gap is closed for Deck resolution, with phone untested. The night ascent-boil gap remains open, and the night frame as captured shows no bubbles at all.

## Author's response (October 5)

- The empty night frame was the fixture, not the change. Divers were 18 m off, beyond the 16 m night range without work lights, so the existing rule correctly hid them. The night stage now uses close zoom, with the divers about 9 m off, and the boil renders.
- Measured against the previous commit, the night ascent boil was already faint and is now about 70% dimmer. Whether to exempt the ascent warning or night from the designer's uniform 50% request is left to the designer; see the [bubbles record](bubbles-lighter-2026-10-05.md).

## Third pass: night flashlights (October 5, 2026)

Reviewer: an independent Claude subagent that did not write the flashlight change; screenshots only, no code edited. Images examined in `test-results/in-world-cues-2026-10-05-v2/`: `bubbles-night-torch.png` (zoom 1.6, divers about 18 m from an unlit boat, left working, right ascending), `bubbles-night-torch-wide.png` (zoom 0.8, same stage), `bubbles-ascent-night.png` (no flashlights, divers about 9 m), and the daytime references `bubbles-ascent.png` and `bubbles-working.png`. I also inspected 2x crops and gamma/contrast-boosted copies made with ffmpeg in the session scratchpad, and measured mean luma (0–255) per region with ffmpeg `signalstats`. These are staged still frames from Chromium on the Steam Deck GPU at 1280×800; a still frame cannot show motion, bubble churn, flicker or how the glow behaves as the boat moves in and out of the 16 m range, and nothing here was checked on the tablet or phone.

**Lit ascent at night: passes at both zooms.** The ascending diver's boil is the brightest object in either frame apart from the wheelhouse roof: mean luma about 105 at zoom 1.6 and 124 at zoom 0.8, against about 12 for the open sea. At 0.8 it is a small (about 40 px) but unmistakable mint-green disc; you would see it at once on a dark screen. Compared with the unlit 9 m frame, where the ascent is a barely visible grey smudge, the change does what the designer asked. The ascent is opaque and has a soft halo plus scattered specks at the rim, not a hard cut-out edge. Note: at zoom 1.6 the opaque core reads as a fairly flat, lumpy pale-green disc ("cauliflower") with less internal structure than the daytime boil; that matches "bright and fully opaque" but looks a little like a sticker. Whether it reads as a churning boil in motion is untested here.

**Working diver: a faint glow, clearly weaker.** Mean luma is about 30 at 1.6 and 37 at 0.8, so roughly 2.5–3× the background and about a third of the ascent. It shows as two or three soft dim-green discs with sparse specks. It is visible if you look for it and easy to tell from the ascent, which fits "faint glow". Note: at zoom 0.8 it is only about 35 px across, so on the 14-inch tablet or in sunlight on the phone it may be close to invisible; that is a device check, not a defect in these frames.

**Edges, colour and layering.** I found no hard rectangles, sprite boundaries or mist banding around either bubble patch, even in the boosted copies; the glow falls off smoothly into the mist. The green torch tint is consistent across both divers and reads as torch-lit water, though it is noticeably more saturated green than the daytime boil, which is white-grey. That colour shift is a design choice, not a fault, but the designer should know the night ascent and daytime ascent do not look like the same object. No foam, wake, current arrows or other surface effects are drawn over the mist anywhere in either frame; the only shapes above the mist are the two bubble patches and the boat. No torch beam or cone is visible in either frame; given the divers are underwater at 18 m this is presumably correct (the underwater glow now fades to zero at 10 m from the diver, and the bubbles carry the cue), but this pass does not confirm the beam renders when it should.

**Reefs and rocks.** No reef, rock, kelp or bed detail is visible anywhere in the two torch frames, including after a strong gamma boost that crushes the sea to black; nothing is revealed around the bubble patches, so the flashlight glow does not light the bottom. Consistent with "you cannot see the rocks until it's too late". The stage may simply have no reef nearby, so this shows no leak in this frame, not that no leak is possible.

**Boat region.** The unlit boat sits in a disc of sea darker than the surrounding mist (mean luma about 8 next to the hull against 12 further out, radius about 220 px at zoom 1.6). The same inverted vignette is in the no-flashlight frame, so it predates this change. It looks slightly odd: the water nearest an unlit boat should not be darker than distant water. Also, the left diver's thin footprint ring and the boat-side wedge outline seen by day are absent at night in the torch frames because they are beyond range under the mist. In the 9 m unlit frame both are still drawn as faint lines, and they remain the only clear marks of the working diver there.

**Classifications.**
- Must-fix: none found.
- Should-fix: none required by the decision. Consider a device check of the zoom-0.8 working glow on the tablet and phone before treating "faint glow" as accepted.
- Note: at close zoom the opaque ascent core is flat and sticker-like; motion is untested.
- Note: the night lit boil is green, the daytime boil white-grey.
- Note: no torch beam was visible in these frames; its presence when it should render is not verified here.
- Note (pre-existing): the dark disc around the unlit boat is darker than the far mist.
- Note: these are staged frames with no nearby reef, so the reef check is limited.
