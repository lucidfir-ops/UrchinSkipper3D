# Independent visual review — September 30

Two separate reviewers inspected actual runtime screenshots using image-viewing tools. The vegetation/lighting reviewer also inspected all fourteen contact sheets from the four original recordings and read their locally transcribed speech. Neither reviewer edited source or claimed physical controller validation.

## Vegetation and lighting reviewer

The first runtime pass exposed two material problems: compressed slack ribbons formed repeated pointed W/accordion shapes, and water illumination still looked like cloudy turquoise teardrops. The implementation was revised to length-preserving curved paths, lower diffuse fill, neutral source-connected light and lamp positions at the actual roof fixtures.

The second pass inspected `kelp-slack`, `kelp-turn-1`, `kelp-turn-3`, `kelp-flood`, `kelp-ebb`, tide comparisons, `night-lights-0`, `night-lights-1.2`, `night-ripples` and `diver-torch-isolated` under `test-results/lighting-kelp-2026-09-30/`.

The reviewer found long continuous slack curls instead of the angular folds, distinct intermediate reversal poses, and opposite extended flood/ebb orientations. Higher tide visibly reduces and darkens the canopy. Some repeated large loops remain.

The final lights read as restrained, neutral beams connected to the vessel; yellow ovals and conspicuous cloudy pools are gone, and nearby fronds catch the light. The isolated diver has a visible small directional torch. Water remains dark, and the still ripple capture shows limited obvious glint detail. The reviewer recommends describing improved directional lighting, not photorealism.

## Interface and second lighting reviewer

Inspected desktop/portrait/landscape advance dialogs, the landscape speed menu, both night headings, ripple and isolated torch captures, plus full-HUD touch portrait/landscape screenshots from the existing input suite.

All advance dialogs fit their viewports and clearly expose current time, target, progress and “Stop here”. The second reviewer independently confirmed softly feathered, directional lights and selective kelp illumination without the old oval decals. The isolated torch reads clearly; its effect is subtler at ordinary zoom. Outlined circles/sectors in that fixture are diver/recovery cues rather than light boundaries.

The initial speed screenshot clipped the last explanatory sentence and displayed a damaged-save warning because the manipulated fixture completed the tutorial without advancing career day zero. The fixture was corrected to day one and asserts a successful save; the menu copy was shortened. The reviewer reopened the final screenshot and confirmed that all explanation fits and the footer reads “Career saved”. The additional phone fog capture has a soft gradient with no obvious circular fog boundary; the separate curved shoreline remains visible.

Full-HUD touch captures show readable action controls and both diver cards with the boat unobscured. Landscape is crowded, and portrait's picking-legend text is small; these are existing layout limitations.

## Evidence limits

Lighting/tide images use frozen renderer fixtures with HUD hidden. The isolated torch deliberately uses a closer camera. The time dialogs use real actions within a modified fixture; full-HUD screenshots come from the separate input playtest. Still images establish poses, appearance and layout, not continuous animation smoothness, hardware input or real-device brightness/performance. Kelp motion is additionally checked through numerical continuity/lag tests. The scene remains a stylized real-time presentation with approximated water/plant optics, not a claim of full physical realism.
