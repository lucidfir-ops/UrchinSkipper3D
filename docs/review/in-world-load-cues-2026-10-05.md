# Deck load, fuel and hull read from the boat — October 5, 2026

Source: designer notes of October 5 (second batch, `feedback/10-5/`): "more alternative and in game ways of showing information. instead of a deck load card put a 3d mesh to indicate a full load that flashes when a bag goes on, and an indicator like a small light on the boat or something when the boat is full, and other environmental cues like the boat sitting lower in the water as it gets heavier. don't get rid of the option to have the deck load card." The designer then chose a ghost outline on deck, the card off by default, and in-game cues for several readouts in this round. The Bible §11 entry is updated in place.

## What was there

Red sacks already accumulated on the open deck (Bible §11). With exact readouts on (the Easy and Realistic default), the boat card also printed "Deck N / M lb" as a fallback whenever the separate Deck load gauge was hidden, so a numeric load line was effectively always on screen. Nothing on the boat itself showed how much room remained or that the deck was full. The hull rode at the same height empty or full.

## Change

- **Ghost outline** (`src/three/deck-load-cues.js`). The remaining capacity is counted as full 300 lb sacks (`ceil(remaining / 300)`), and a pale ring is drawn at each slot where those sacks will land. The slots use the same `deckMarkers` layout as the real sacks, so each ring sits where a future sack goes, and the outline disappears exactly at capacity. The rings are an edge-weighted shader in cool cyan-white, distinct from the beige rope on deck, so outlines over sacks already aboard do not wash out the red. The layer being filled is drawn at full strength and later layers at 22% and 7%, so the next sacks read first. When a sack lands, that sack alone flashes warm for about 1.4 s. It is dimmer at night so it never reads as a light source.
- **Deck-full lamp.** A small amber lamp on the aft edge of the wheelhouse roof, with a soft halo that grows brighter and about twice as wide at night, lights when the deck is full (less than 0.5 lb of capacity left) and stays unlit otherwise.
- **Freeboard and motion.** As load builds, the drawn hull settles up to 0.45 m and trims up to 0.022 rad by the stern (the sacks stow aft). It bobs about 45% less at full load, and its wake and bow curls widen by up to 35%. A sack landing eases the hull down over about a second. All of this changes only the rendered pose, after the shared bob. The simulation, collision geometry, plan position and handling are untouched; load already affects handling (Bible §11).
- **Damaged hull.** Below 65% hull condition (the existing oil-sheen threshold) the hull also settles up to 0.22 m and lists up to 0.12 rad.
- **Low fuel is heard** (`src/fuel-cues.js`, `src/audio.js`). Once the home fuel reserve is reached, the engine misfires briefly at irregular moments, about every 6.5 s. Below the fuel needed for the home passage it coughs about every 3.2 s, with deeper dips in volume and pitch. The fuel plan is re-read once a second.
- **Deck load card.** The boat card no longer falls back to a deck weight line. The weight reading is the optional Deck load gauge (Settings → assists), which was already off by default; its description now explains the in-world cues. Saved choices are unchanged.

Only the player's boat gets the cues; traffic and rival hulls are built without them.

## Evidence

- `tests/in-world-cues.test.js` covers:
  - ghost slot counts by weight, including part bags, and none at capacity;
  - lamp lit only when full; pulse starts and fades;
  - settling, stern-down trim at any heading, plan position unchanged;
  - damage list only below the sheen threshold;
  - wider wake when laden;
  - misfires only on low fuel, more often below the home passage.
- `tests/wheelhouse-layout.test.js`: the boat card never falls back to deck load.
- Fixture `scripts/in-world-cues-review.js` (verify suite `in-world-cues`) stages the real game view at empty, half, a sack landing, full (day, night, wide) and a damaged hull, and asserts the lamp, settling and list. Screenshots: `test-results/in-world-cues-2026-10-05/`.

## Limits

- The 0.45 m settling cannot be seen from the fixed, almost top-down camera. A probe with twice the settling (0.9 m, dev build) showed no visible change until water reached the deck, because the hull sides are almost edge-on to the camera. The trim, damped bob and wider wake are what show the load, and only in motion. If the designer wants the load visible in stills, it would take a non-physical cue, for example water washing at the stern scuppers when full.
- The independent review's first round found the pulse ambiguous, the rings weak and rope-coloured, and the night lamp weak; all three were changed as above. See the [review](independent-in-world-cues-2026-10-05.md).
- The list of a damaged hull is also subtle from above.
- The misfire was checked as numbers and code, not by ear.
- No human has seen the cues on the S22, the Doogee tablet or the Deck.
