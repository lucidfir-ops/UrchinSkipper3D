# Deck load ghost as a 3D full deck that flashes — October 5, 2026 (v2)

Source: designer notes, `feedback/10-5 v2/`: the highlight lit "only the most recently placed bag", where the designer imagined "a flash of a ghost image of a full deck to show the max load and see at a glance how far you are from it… it should be a 3d representation as the bags stack in a second layer." Recorded in the Bible §10 in place.

## What was there

The October 5 ghost had three parts:
- edge-weighted pale rings at 66% of sack size, which from the top-down camera read as circles;
- later layers faded to 22% and 7%, so the second layer was effectively invisible;
- an additive flash on only the newest real sack when it landed.

## Change (`src/three/deck-load-cues.js`)

- **Shape.** Each sack still to come is drawn at the real sack's size, pose and position, from the same `deckMarkers` layout. The material is translucent and softly lit (top lighter, silhouette slightly brighter), so ghosts read as volumes. Real and ghost sacks together are the picture of a full deck.
- **Layers.** Every layer is shown. A full load is two layers on every hull; the two twin-jet hulls carry one or two sacks in a third. The bottom layer flashes warm yellow. Layers stacked above flash pale cool white, with a firmer outline and a thinner body, so they can be counted and do not tint the red sacks below salmon.
- **Flash.** When a sack lands, the whole ghost load flashes to opacity 0.62 (dimmer at night) and fades over 1.8 s. Between landings the ghost is hidden. The single-sack flash is removed.
- **Review fixes.** A first version also kept a faint resting ghost (opacity 0.16) and drew all layers in one colour. The independent reviewer found the resting ghost invisible on bare deck and a milky haze over the real sacks, the two layers merging into one yellow mass in the flash, and yellow over red reading salmon. The rest state was removed and the layers given separate tints.

The roof lamp, hull settling, trim and wake are unchanged.

## Evidence

- Unit test in `tests/in-world-cues.test.js`: a 7,500 lb deck with 3 sacks aboard lays out 22 ghosts at real sack scale on two heights, with upper layers marked for their own tint. The ghost is hidden at rest, flashes above 0.5 opacity on a landing and hides again; there is no single-sack flash object.
- Fixture stages added to `scripts/in-world-cues-review.js`:
  - `load-light-pulse`;
  - `load-second-layer` and `load-second-layer-pulse` (72% load, second layer partly filled);
  - `load-pulse-night` and `load-pulse-wide`;
  - `bubbles-ascent-night`.
- The fixture's default output moved to `test-results/in-world-cues-2026-10-05-v2/` (see Failure notes). Compared against `…-baseline/`.
- `in-world-cues`, `deck-load`, `operations` and `performance` (59.997 FPS at 1280×800) pass.

Independent review: [independent-ghost-bubbles-menus-2026-10-05.md](independent-ghost-bubbles-menus-2026-10-05.md).

## Limits

- Judged from staged fixtures and still frames only, not in natural play or on the designer's devices.
- Between landings there is no ghost, following the designer's request for a flash. If the full-deck picture should stay visible, `LOAD_CUES.restOpacity` restores a resting ghost, which would then need a treatment that reads on bare deck without hazing the sacks.
- No phone-size frame was captured; the wide-zoom flash (`load-pulse-wide`) stands in for small screens.
