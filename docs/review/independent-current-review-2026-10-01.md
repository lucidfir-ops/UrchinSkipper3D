# October 1 current and natural-cue review

The reviewer inspected the coastal solver independently of its author, reviewed live Chromium screenshots, and contributed the natural-cue timing repair and capture fixtures. This is code, simulation and browser evidence, not physical-device acceptance.

`scripts/coastal-current-review.js` covers Devil’s Elbow (`outer-wall`) and Knifepoint Race (`maelstrom-point`): flood and ebb, strengths 0.3/0.8/1.1, and sea levels −0.5/1.15/3.2 m. The 36 fixtures preserve the normal 1.15 m mean when testing tidal squeeze. Deep-water samples are taken every 6 m; a 20-second physical drifter track starts in the strongest headland return flow. Tests require wet tracks, upstream displacement, usable slow water and dangerous offshore races. `--numerical-only` runs without a browser.

All 36 fixtures passed. Each had at least 102 deep reverse-flow samples and 482 deep samples below 1.5 kn. The 0.8/1.1-strength races reached the established 5 kn maximum. The strongest sampled headland return remained at most 55.1% of the offshore peak; slower water also exists within the lee. Every physical test drifter travelled upstream by at least 3.42 m over 20 seconds.

At strength 0.8 and sea level 1.15 m, the browser provider agreed with the numerical field:

| Ground / direction | Headland sample (m) | Depth | Local current | Offshore peak | Natural foam upstream travel in 8 s |
| --- | --- | --- | --- | --- | --- |
| Devil’s Elbow flood | 266, 146 | 26.1 m | 1.04 kn | 5.00 kn | 4.02 m |
| Devil’s Elbow ebb | 254, 296 | 20.2 m | 1.72 kn | 5.00 kn | 5.77 m |
| Knifepoint flood | 248, 218 | 19.0 m | 1.54 kn | 5.00 kn | 6.20 m |
| Knifepoint ebb | 236, 356 | 20.2 m | 1.20 kn | 5.00 kn | 3.85 m |

Natural foam starts from the normal seeded debris population, roughly 11–14 m from the measured point, rather than being placed in a fabricated shelter. The water and current curves are fixed for these reproducible fixtures; they do not prove an entire naturally evolving tide cycle.

Evidence is in `test-results/coastal-current-2026-10-01/`: `report.json`, `numerical.json`, and eight screenshots named `{outer-wall,maelstrom-point}-{flood,ebb}-{headland-arrows,lee-no-arrows}.png`. These show actual loaded working grounds with the boat in water, live instruments and no harbour backdrop. Reviewed examples include both `outer-wall-*-headland-arrows.png`, `outer-wall-ebb-lee-no-arrows.png`, `maelstrom-point-ebb-headland-arrows.png` and `maelstrom-point-flood-lee-no-arrows.png`.

The arrow views visibly separate faster offshore water from the opposite-moving lee. Flow bends around the point rather than crossing the obstruction unchanged. Kelp responds differently on the two sides. In the views without arrows, foam and loose weed are unobtrusive and blend into the water; movement is a stronger cue than a still image. The wide view still makes the boat small, and bright kelp retains some repetitive, yellow-looking ribbons. These are honest remaining presentation limitations.

`scripts/surface-drift-review.js` also passed with desktop daylight/fog and a fresh 390×844 touch context. Its screenshots are in `test-results/surface-drift-2026-10-01/`. Fourteen drift instances become eight in the fog fixture; the fresh portrait frame correctly places crew below the helm controls with no clipped desktop sidebar. The earlier invalid phone capture had resized a paused desktop layout and has been replaced. The fog view retains a discernible broad visibility halo.

The review found and fixed a real timing error: bubbles/wake foam used wall-clock delta for current while boats and physical debris used simulation time. Current advection now reads elapsed `world.time`. A browser regression checks zero drift while stopped and exactly 0.75/0.15 m travel through a 1.5/0.3 m/s field after 0.5 simulation seconds, despite only 0.125 visual seconds elapsing. Particle expansion/fading remains visual time.

Solver inspection found no blocking defect. Depth-grid connectivity excludes isolated dry-rim pools; separate directional solves and geometry-derived wakes explain the changing lee. Remaining approximation limits are the 6 m wake profile, strongest-wake selection where wakes overlap, and underwater shelves producing resistance/deflection without explicit separated vortices unless they dry. Bilinear sampling smooths vector values, but this is a game approximation, not fluid-dynamics validation. Physical controller, phone performance and unaided human recognition of the eddies still need playtesting.
