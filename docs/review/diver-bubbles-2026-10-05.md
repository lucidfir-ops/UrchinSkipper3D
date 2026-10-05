# Diver bubbles from the designer's reference, and a filled ascent boil — October 5, 2026

Source: designer notes of October 5 (second batch): "i took photos and video of the bubbles of divers in the water for you to reference in adjusting that. the current visibility is right, but the big circle on ascent looks wrong, it should be more like a filled in boiling white circle, and the pictures are reference for divers down and not ascending." References: `feedback/10-5/20261005_113312.jpg`, `20261005_112905.mp4` (11 s), `20261005_113328.mp4` (23.5 s). Frames were extracted with ffmpeg every 3 s and inspected. The Bible §10 entry is updated in place.

## What the reference shows (divers down)

- A pale, milky green-white patch rising from below the surface: the bubble column lit through the water.
- Smooth, flattened boil patches where bubble heads break the surface, darker and glassier than the surrounding chop. Each is edged with fizz and broken foam.
- Scattered white specks and foam streaks drifting off downstream.

## What was wrong

Diver bubbles were only foam particles. Working divers emitted two white blobs every 0.12 s at a fixed 0.5 m radius. During the ascent warning, `src/three/vessels.js` emitted five particles on a fixed 2.4 m radius circling the diver. Those spread into a hollow loop: the "big circle". The Easy-only gold diver-indicator ring (`diver-cues.js`) is a separate, unchanged assist.

## Change

- `src/three/diver-boil.js`: one surface patch per diver, drawn by a shader.
  - **Working** (descending, searching, working): an irregular milky-green upwelling about 8 m across. Three smooth, darker, glassy boil patches swell and fade in turn, each edged by a ragged, broken band of bright fizz. Sparse fizz drifts through the upwelling.
  - **Ascent warning**: a filled white disc that grows with ascent progress from about 2 m to about 5 m across. It churns with two scales of animated foam cells and has spray along a broken edge. It subsides within about a second after surfacing.
- Particle specks are now smaller (0.22–0.5 m), more numerous and scattered while working, drifting with the current as before. During the ascent they are emitted inside the growing disc, never on a ring.
- Visibility is unchanged: the patch and the specks use the existing `bubbleOpacity` rule (range, fog, rain, waves). Night dims them as before, and torch-lit divers tint them as before.
- Rival divers keep their simple specks.

## Evidence

- `tests/in-world-cues.test.js`:
  - working divers raise the upwelling with no boil;
  - the boil starts at the warning, grows with progress and clears after surfacing;
  - the patch is hidden where bubbles are not visible;
  - the boil is a filled disc;
  - the fixed-radius ring emission is gone.
- `scripts/in-world-cues-review.js` captures working divers, a diver at 70% of the ascent warning, a wide view and a close-up. Screenshots: `test-results/in-world-cues-2026-10-05/bubbles-*.png`.

## Limits

- This is a stylised top-down approximation of the reference, not a reproduction. The first independent review found the upwelling too small and the patches lighter than the reference; it was enlarged and the patches darkened.
- The ascent boil was designed from the designer's description; no ascent reference exists.
- The specks in the ascent boil are soft particles and can read as blobby at close zoom.
- Not yet seen on the three physical devices.
