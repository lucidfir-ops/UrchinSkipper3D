# Diver bubbles: half as opaque, a quarter smaller — October 5, 2026 (v2)

Source: designer notes, `feedback/10-5 v2/`: "the new diver bubbles look great, but let's make them 50% transparent and about 25% smaller area." Recorded in the Bible §11 (bubble reference) in place.

## Change

`BUBBLE_LOOK` in `src/three/diver-boil.js` sets opacity 0.5 and linear scale √0.75 ≈ 0.866. These apply to:
- the per-diver surface boil mesh: the working upwelling and the ascent boil, which share one shader;
- the foam specks emitted around working and ascending divers: spread radius and speck size scaled, specks drawn at half opacity;
- bubble particles of rival divers, which use the same bubble flag.

Visibility ranges (fog, waves, rain, depth) are unchanged; the factor multiplies the existing `bubbleOpacity`. Ascent and working bubbles are scaled alike, so the ascent boil remains denser than the working upwelling as the Bible requires.

## Evidence

The same fixture (`scripts/in-world-cues-review.js`) was rendered from the previous commit in a separate worktree (`test-results/in-world-cues-2026-10-05-baseline/`) and from this build (`…-v2/`), both on the Deck GPU. In `bubbles-ascent`:
- the area brighter than the sea fell from 7,463 to 5,791 px (ascent boil, −22%) and from 7,345 to 5,318 px (working diver, −28%);
- summed brightness above the sea fell by 61% and 57%, against an expected 62.5% (half opacity times three-quarters area).

Unit test: `tests/in-world-cues.test.js`.

## Night

The independent reviewer's second pass found the first night frame empty. The fixture placed the divers 18 m off, beyond the 16 m night range without work lights (`workLightRange`), so the existing night rule hid them correctly. At close zoom (9 m) the night ascent boil renders. Compared with the previous commit, it was already faint at night (peak grey 33 on a background of 15) and is now fainter (27 on 12, about 70% less summed brightness). It remains visible, but at night it is a weak warning. A night or ascent-only exception would depart from the designer's uniform request, so it is left as a question for the designer.

## Limits

Not seen on the S22, tablet or Deck in person, and not judged in rain, fog or rough water, where bubbles were already fainter.
