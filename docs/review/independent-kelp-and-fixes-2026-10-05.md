# Independent visual review: bull kelp redraw and fixes after the first October 5 review

Reviewer: a separate Claude subagent that did not write the code. Date: October 5, 2026. Scope: runtime screenshots only. No source files were edited.

This is a screenshot audit of automated headless captures at emulated viewports on the Steam Deck: kelp at 1280×800, menus at phone 360×780, tablet 1280×800 touch and Deck 1280×800, boundary at desktop/portrait/landscape, and context loss at 412 px wide. It is not device acceptance on the Doogee tablet, the S22 or the Steam Deck. It cannot judge animation, touch feel, physical controllers or performance. Kelp motion is judged from still poses only; the swing between flood and ebb and the slack curling were not watched.

## Part A: bull kelp

Inspected: the four reference photographs in `feedback/10-4 v2/`; all eight `test-results/bull-kelp-2026-10-05/before/*.png`; all eight after images; enlarged crops of `low-tide-flood`, `low-tide-ebb` (around the boat), `low-tide-slack` and `high-tide-flood`; `records.json`; `docs/review/bull-kelp-2026-10-05.md`; Bible §2 (October 5 entry, September 30 slack decision).

### Each clause of the request

| Clause | Verdict | Evidence |
|---|---|---|
| Long floating stalk, bulb at the end, long leaves (like the 2D game) | **Mostly met.** | `low-tide-flood.png`: every plant is a long smooth tan stipe lying on the surface, ending in a bulb with a short trailing tuft. Silhouette now matches `OIP-3668431060.jpg` (many parallel floating stipes) and `region_nc_VanDamme_Bull-Kelp_2017.jpg`. The bulb is undersized (see issue A3). |
| Blades less splayed and less prominent; reduce them | **Met, possibly overshot.** | Before (`before/low-tide-flood.png`) the stands were yellow feather sprays; after they are a single narrow tuft per plant, about 1.5–2× the stipe width. In `close-low.png` the blades are thinner than the stipe for most of their length. The reference photos (`region_sea_feature01.jpg`, `header-exploding-kelp.jpg`) show a bundle of broad ribbons that is wider than the stipe; the designer asked for less, so this is a judgement call to put to the designer, not a defect. |
| Streamlined by current | **Met.** | Flood and ebb: blades trail straight downstream within a few degrees; no sideways splay. |
| Lots of stalk at low tide, mainly bulb and leaves at high tide | **Met.** | Crops: at −0.5 m the floating stipe is about 2–3× the blade length; at +1.2 m (`mid-tide-flood.png`) it is shorter; at +2.8 m (`high-tide-flood.png`) the bulb sits at or just after the bend and only the blades lie on the surface. The progression across the three tides is clear in the top-down view. |
| Affected by current and tide (flood vs ebb) | **Met in stills.** | `low-tide-flood.png` streams east, `low-tide-ebb.png` streams west, with holdfasts fixed (the canopy swings about its root; stands appear shifted by about 150 px, which is correct). |
| Slack | **Not convincing.** | See issue A1. |

### Issues, ranked

**Should fix**

- **A1. Slack looks like a school of identical tadpoles.** `low-tide-slack.png` (whole frame, clearest in the right-hand stand x 900–1200, y 200–550): every plant has the same orientation (blades pointing west, stipe trailing east), the same short length and the same regular sine wiggle in the stipe, roughly in phase across plants, ending in a sharp hairpin where the submerged stipe drops away. The "loosely meandering" stipe reads as a coiled spring, and the uniform heading reads as a shoal. The September 30 Bible decision says the kelp "relaxes and curls together at slack", and that may be intended, but real slack canopy (the VanDamme photo was probably taken near slack) lies in loose, varied arcs with mixed headings. Per-plant variation in meander amplitude, wavelength, phase and heading at slack would remove the pattern.
- **A2. Hard elbow where the submerged stipe meets the surface, the same on every plant.** Crops of `low-tide-flood.png` and `high-tide-flood.png`: each plant is a straight diagonal underwater line, then a sharp corner, then a straight horizontal float. With hundreds of plants this gives a repeated "check mark" or ruled-line pattern. The implementation record says the sections blend smoothly; at play zoom the blend is only a few pixels and reads as a kink. In `close-low.png` the effect is a wire lattice: diagonal underwater stipes crossing horizontal floating ones.
- **A3. The air bulb is too small to read.** At play zoom the bulb is a bead barely wider than the stipe (`low-tide-flood.png` crop, all plants); at the wide camera (`low-tide-wide.png`) it is invisible. In every reference photo the pneumatocyst is the most distinctive feature, about 3–5× the stipe diameter. The designer's request names "a bulb of air on the end"; the stipe was thickened to read from above but the bulb was not.
- **A4. The underwater stipe is bright grass-green and very prominent at high tide.** `close-high.png` (left half) and `high-tide-flood.png` crop: the submerged stipes are saturated green lines, as visible as the surface parts, so the high-tide view reads as a field of reeds or fishing rods rather than "just the bulb and leaves". In `region_sea_feature01.jpg` the submerged stipes are dark brown and fade with depth. The record acknowledges that the underwater stipe takes on the water-column green; the tint is too bright and the fade too weak.

**Minor**

- **A5. Unnatural regularity in flood and ebb.** All floating stipes are exactly parallel to one axis with near-identical length (`low-tide-flood.png`, `low-tide-ebb.png`). `OIP-3668431060.jpg` shows parallel stipes too, but with gentle curves and varied lengths. Slight per-plant heading and curvature variation would help.
- **A6. Blade ends look like a frayed brush stroke.** Enlarged crops show sawtooth, alpha-fringed tips. At play zoom they read as a smudge rather than ribbons. Acceptable at this scale; noticeable in `close-low.png`.
- **A7. Kelp passes under the boat at low tide on the ebb.** `low-tide-ebb.png`, x 560–700, y 340–460: floating stipes run straight under the hull from both sides. Physically the canopy would be pushed aside or foul the hull. It is not z-fighting (the hull correctly draws over it), but it looks as if the boat is sitting on the bed.
- **A8. Low visibility at the wide camera.** `low-tide-wide.png`: stands read as faint pale scratches. If kelp is meant to communicate current (Bible §113: "Communicate current through kelp"), it still does so by direction, but much less strongly than before.

**What is better**

- The feather-spray look is gone; the plants now have the floating-stipe silhouette of the 2D game and the photographs.
- Tide is clearly legible from stipe exposure, which the before images did not show.
- Flood and ebb reverse cleanly about fixed roots.
- Colour is darker olive-tan, closer to the photos than the before images' bright yellow. No z-fighting or flicker artefacts are visible in the stills.
- The record reports the same draw calls and fewer triangles. That is the author's number, not checked here.

## Part B: fixes after the first review

Inspected: `night-deck-summary`, `day-deck-summary`, `day-deck-summary-return`, `night-deck-summary-night`, `night-deck-summary-dusk`, `night-phone-summary-dusk`; `day-tablet-chart`, `night-tablet-chart`, `night-deck-chart`, `day-phone-chart`; `night-tablet-touch-options`, `day-tablet-touch-options`, `day-phone-touch-options`; `night-tablet-starter`, `night-tablet-starter-turned`, `night-phone-starter`, `night-phone-starter-turned`, `day-phone-starter-turned`; `day-tablet-sea-instructions`, `night-tablet-sea-instructions`, `day-phone-sea-instructions`; `night-phone-fleet-detail`, `night-tablet-fleet-detail`, `day-deck-fleet-detail`; the three `boundary-2026-10-05/*-beyond-line.png`; and `context-loss-2026-10-05/chromium-silent-loss.png` and `firefox-silent-loss.png`.

### Status of the first review's issues

| # | Issue | Status | Evidence |
|---|---|---|---|
| 1 | Deck summary hid the painting | **Resolved** for the painting; the ledger cut is **not resolved** | `night-deck-summary.png`, `day-deck-summary.png`: the summary opens at the top, the painting and heading are fully visible. The right ledger still ends at "Landing / interest / insurance" with Operating cash below the fold, and no action button ("Prepare next day") or scroll cue is visible, although the footer says "Enter Select". A Deck player presses Enter on a button they cannot see (minor). |
| 2 | Narrow desktop HUD collapse; button font | **Not changed** (HUD, by decision); font **resolved in Chromium only** | `chromium-silent-loss.png`: "RELOAD GRAPHICS" in the display face. `firefox-silent-loss.png` still shows a sentence-case system-sans "Reload graphics", but its files are timestamped 00:24, before the fix (Chromium 01:41). **Firefox has not been re-captured.** Firefox is the designer's phone browser, so this needs a new capture. The HUD overlap ("HIP'S TIM", clipped diver cards) remains as the first review described. |
| 3 | Chip ahead of the bow | **Resolved on desktop and landscape; new overlap in portrait** | `desktop-beyond-line.png`: chip abeam to port, clear of the hull. `landscape-beyond-line.png`: abeam, about 30 px clear. `portrait-beyond-line.png`: the chip (x 8–220, y 372–415) **covers the port half of the hull** (boat x 163–228). See new issue N1. |
| 4 | Teal coast overview and touch preview | **Resolved** | Day chart: pale grey-blue paper with tan coast silhouettes (`day-tablet-chart.png`, `day-phone-chart.png`). Night chart: slate with olive coasts. Touch preview: dark slate diagonal stripes in both themes. |
| 5 | Focus looks like selection on touch | **Resolved for boat cards; general first-row focus unchanged by decision** | `night-tablet-starter.png`, `night-phone-starter.png`: Island Tender has only an orange outline while "Nothing is selected yet"; the chosen card in `*-starter-turned.png` is solid orange. Other menus still open with a solid orange first row or Back (for example the orange BACK in `*-sea-instructions.png`). |
| 6 | Sticky bar covers content | **Partly resolved** | `night-tablet-starter-turned.png`: the preview (capped) and "A $20,000 START FROM THE HARBOUR" are now visible, but the bar still sits over the second "HARBOUR WORKHORSE" detail block (y 700–770). `night-phone-starter-turned.png`, `day-phone-starter-turned.png`: the bar covers the bottom of the preview frame and its caption, including the "Drag to turn" hint. `night-phone-fleet-detail.png`: the bar cuts through the middle of the preview, with the caption peeking out below it. Bottom padding presumably lets the content scroll clear, but in the opening state the preview is still half covered on phone. `day-deck-fleet-detail.png`: the top row of cards is still clipped under the "Your boat / Buy selected boat" strip ("Harbour Workhorse" cut). Not resolved for that case. |
| 7 | Day compass unreadable | **Resolved** | `day-tablet-sea-instructions.png`: dark ink ring and labels on paper, well above 3:1. On phone (`day-phone-sea-instructions.png`) the labels are about 7 px, which is small but legible. |
| 8 | Contradictory summary captures | **Mostly resolved** | `*-summary-night.png`: "DELAYED SHIPPING · Arrived 22:15 · 195 min late", offload 06:00 +1d, missed-offload text. `*-summary-dusk.png`: 19:40, 40 min late. Remaining contradiction: the text says "with more water loss and lower quality", yet the ledger is identical to the on-time capture (12.5% water loss, 82% quality, $557.79). Day/night captures also differ by a cent ($557.78 vs $557.79). The fixture still stages only part of the outcome (minor, because the designer reads these literally). |
| 9 | Dusk tint too weak | **Resolved** | `night-deck-summary-dusk.png` vs `night-deck-summary.png`: dusk is visibly cooler and darker, with the low sun reduced. The night variant is convincing. |
| 10–19 | Other minor items | **Not changed** (as stated) | Confirmed still present: the small dark "Buy" box on the orange card (`night-tablet-fleet-detail.png`, `day-deck-fleet-detail.png`); tiny, low-contrast "Drag to turn · ← →" caption. |

### New problems found

- **N1 (should fix). Return-to-harbour chip overlaps the boat in portrait.** `portrait-beyond-line.png`: the pill covers the port side of the hull from the wheelhouse to the stern. The placement now avoids the water ahead, but it should also exclude the hull's own screen rectangle.
- **N2 (should fix, probably pre-existing). Unfilled control placeholders in the boat shop detail.** `night-tablet-fleet-detail.png`, right panel: "Hold bow thruster: {thrustPort} / {thrustStarboard}. Right stick remains rudder." The template comes from `src/boats.js:42` (also `:150` and `src/training-replay.js:92`) and is not substituted on this screen. On a touch tablet, "Right stick" is also the wrong input vocabulary.
- **N3 (minor). Deck chart overview is shrunk to unreadable text.** `night-deck-chart.png`: the overview is drawn at about 360 px wide inside a 560 px column, with subarea captions about 5–6 px tall, and the "Synthetic coast" caption bar spans the full column under a narrower map. The phone chart (`day-phone-chart.png`) also has about 5 px captions. This may predate the theming change, but it is now the screen's main visual.
- **N4 (minor). The touch preview shows Rudder but no throttle.** `*-touch-options.png`: the preview has "Menu / help", "RUDDER" and "Deploy / board" only, while the panel text says "Independent throttle and rudder". In night theme the preview's slate is only slightly darker than its panel, so it reads weakly as a sea.
- **N5 (nit). Selected-card thumbnail.** On the orange selected card the dark inset render is visibly smaller than and offset within its frame (`night-tablet-starter-turned.png`, `day-phone-starter-turned.png`); unselected cards hide this because frame and render are both dark.
- **N6 (nit). Touch-mode copy on sea instructions.** `day-tablet-sea-instructions.png` (touch tablet) leads with "Point the left stick, or use arrow keys." This is probably pre-existing.

## Ranked summary

1. Kelp slack pose: identical heading, length and phase on every plant, spring-like wiggle (should fix).
2. Return chip covers the hull in portrait (should fix, new).
3. Kelp hard elbow at the waterline, repeated on every plant; lattice look in close-ups (should fix).
4. Kelp air bulb too small to read; it is the defining feature in every reference (should fix).
5. Bright green submerged stipes dominate the high-tide view (should fix).
6. `{thrustPort} / {thrustStarboard}` placeholders visible in the boat shop (should fix, probably pre-existing).
7. Sticky purchase bar still covers the phone preview and its caption; Deck fleet-detail top cards still clipped (should fix, partly resolved).
8. Firefox context-loss captures are stale, so the button-font fix is unverified in the designer's browser (re-capture).
9. Minor: summary ledger contradicts "more water loss" text; Deck summary has no visible action or scroll cue; Deck chart overview text unreadable; kelp regularity and brush-stroke blade tips; touch preview lacks throttle.

Resolved: Deck summary painting, teal coast overview and touch preview, boat-card focus versus selection, Day compass, dusk tint, and (in Chromium) the button font. The kelp meets the core request (floating stipe, fewer streamlined blades, more stipe at low tide, flood/ebb reversal) and is a clear improvement over the before images.

## Limits

These are still screenshots from scripted fixtures with staged tide, flow and career states. Nothing here verifies kelp animation, the gradual flood/ebb swing, performance on the designer's tablet or phone, drag-to-rotate by real touch, Deck physical controls, or real GPU context loss. Firefox context-loss images predate the fix. Kelp realism was judged against four reference photographs, not against the 2D game, which this reviewer did not run.
