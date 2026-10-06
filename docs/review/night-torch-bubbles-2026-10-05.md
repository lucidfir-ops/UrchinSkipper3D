# Night: torch-lit bubbles seen like daytime, lit ascent bright — October 5, 2026

Source: the designer's reply of October 5, after the v2 notes: "divers will be using flashlights or not diving. Therefore their bubbles will be illuminated, you can see when a diver is ascending at night super easily, and you can also see a faint glow of them swimming around down to 10m. You cannot, however, see the rocks usually until it's too late." The designer then chose, when asked:
- torch-lit bubbles are seen out to the weather's visibility, as by day;
- the lit ascent is bright and fully opaque, while working bubbles stay a faint glow.

Recorded in the Bible §3 (September 30 torch entry, superseding its "existing sight limits") and §11.

## What was there

At night every bubble, torch glow and diver cue was cut off at the boat's light range: 16 m with work lights off, 38 m on (`visibilityRange` → `workLightRange`). Beyond that, the night sea mist (`coastal-mist.js`, render order 100000, no depth test) darkened everything. The torch's underwater glow used the body-visibility curve, reaching zero at 5 m. Earlier on October 5, the 50% bubble transparency also made the night ascent boil about 70% dimmer.

## Change

- `bubbleOpacity(world, distance, lit)` with `diverLightsOn(world)` (night and flashlights fitted and enabled). A lit source's range is the weather visibility instead of the work-light range. Fog, rain and wave fades still apply.
- The player's divers use the lit range for the surface boil, the bubble specks and the torch glow. Rival divers and every other night cue keep the old limit.
- `DiverBoil` has separate working and ascent opacities:
  - with flashlights at night, the ascent boil is drawn at full opacity and brightened toward full light as it builds, keeping the torch's green tint;
  - working bubbles stay at 50% and night light;
  - without flashlights, nothing changes.
- Ascent specks with flashlights are drawn at full opacity.
- Lit boils, the particle layer (when flashlights are on) and the torch beam draw after the night mist (`LIT_RENDER_ORDER`). Unlit foam already has zero opacity beyond the light range, so the mist still hides it.
- Torch glow underwater: `torchDepthGlow` fades out between 4 m and 10 m (scaled by turbidity), replacing the 5 m body curve for the torch only.
- Reefs: unchanged. At night the reef range is about 6 m with work lights off and about 14.5 m with them on. A test checks that flashlights do not change it.

## Evidence

- Tests:
  - `tests/in-world-cues.test.js`: lit range, weather bound, no torch, unlit sources, reef range unchanged, lit ascent at full strength and light, working faint, unlit ascent dark.
  - `tests/night-lighting.test.js`: glow faint at 8 m, zero at 10 m, visible 100 m from an unlit boat, zero past weather visibility.
- Fixture stages `bubbles-night-torch` (zoom 1.6, divers 18 m from an unlit boat) and `bubbles-night-torch-wide` (zoom 0.8). Before the mist fix the probe recorded both boils as visible at full opacity yet the frames were black, which located the mist as the cause. Afterwards, the lit ascent glows clearly and the working diver is a faint green patch.
- Unit suite and browser suites pass: in-world-cues, deck-load, work-lights, lighting-kelp, weather, operations, voyage, and performance (60.1 FPS at 1280×800).
- `continuous-weather` intermittently times out reopening Pause after a page reload (`continuous-weather-review.js:44` via `:327`). This happened in 3 of 10 runs on this build and also, at the same line, in 1 of 10 on commit 286ba3d from before today's changes. It is an existing flaky step, not caused by this change, and it passed on rerun.

## Limits

- Still frames from staged fixtures; flicker and motion were not judged.
- Not seen on the designer's devices.
- Fog at night was not staged; it should still fade lit bubbles through the existing fog rule.
- Raising the particle layer's draw order while flashlights are on also lifts the boat's own foam above the mist inside the light range, where the mist is clear. Any effect would show only at the edge of the light range.
