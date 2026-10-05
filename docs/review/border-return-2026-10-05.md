# Harbour border without a blocking prompt — October 5, 2026

Source: designer notes and screenshot `feedback/10-4 v2/Screenshot_20261004_212857_Firefox.jpg` (S22 portrait), designer answer of October 5 choosing "Button, no pause". Bible §2 boundary entry updated in place.

## What was wrong

Two things blocked play near the harbour-facing edge:

1. Within 110 m of any edge, `src/three/sector-boundary.js` drew an on-water label ("HARBOUR BOUNDARY · SOUTH · CONFIRM TO RETURN"). It sat over the touch action buttons in portrait, exactly where a skipper fishing near the border needs to tap.
2. Crossing the harbour line with both divers aboard paused the game with a full-screen "Return to harbour?" dialog (October 1 design).

## Change

- The edge lines stay; the floating label is removed for every edge.
- Crossing never pauses and never leaves by itself. While the boat is beyond the harbour line with both divers aboard and no bag work, a compact **Return to harbour** chip appears beside the boat on the off-sector side. If that spot would cover a touch control or HUD window, it tries either side, then the inward side. Steering back inside withdraws it.
- Input: tap/click the chip (any pointer), keyboard **H** (new remappable `returnHarbour` action), or Pause menu → first entry **Return to harbour** (controller route; also in Frank's tutorial pause menu at the final lesson).
- The action is evaluated at the start of the fixed step, against the position at which it was offered.
- The `harbour-return` screen, `requestDeparture` / `cancelDeparture`, `returnPending` and `returnDismissed` are gone. Older saves holding a pending decision load as ordinary play (`restore` drops the fields).
- Frank's final lesson text now describes the button.

## Evidence

- `tests/harbour-return.test.js` (rewritten): all four edges offer the return with time still running and no departure until the explicit action; the offer is withdrawn inside, on wrong edges, with crew in water, during bag work and in practice; legacy pending saves load; H default binding, Pause-menu entry and single departure.
- Updated: `departure-transition`, `major-gameplay`, `s22-latest`, the voyage pilot and its browser wrapper.
- Browser: `scripts/boundary-review.js` (suite `boundary`, Chromium with the Deck GPU) passes. Desktop shows no label, time advances beyond the line with no dialog, the chip reads "Press H", it withdraws inside, and H returns. Synthetic controller: Menu lists Return to harbour first, Back keeps fishing, Confirm returns. Touch at 390×844 and 844×390: the chip is ≥44 px, on screen, covers no touch control, and a tap returns. Screenshots: `test-results/boundary-2026-10-05/`.

## Limits

Synthetic controller and touch only; not yet tried on the S22, the Doogee tablet or physical Deck buttons. Current can carry a boat that is idling at the line back inside, so the chip can come and go; the boat is held at the line while driven outward.
