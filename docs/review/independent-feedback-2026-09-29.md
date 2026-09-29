# Independent visual review — September 29, 2026

The final inspected captures address the main visual feedback: the tutorial leaves a clear operating view, pickup prose sits above Frank, starter cards contain distinct 3D boats, purchase costs no longer collide with buttons, and the coastal surface communicates changing depth, tide, wind and current. This is acceptance of the inspected presentation, with the limitations below; it is not a claim of full gameplay or device acceptance.

I read `PROJECT_STATUS.md`, inspected all thirteen user-supplied images in `feedback/9-28`, and compared all twelve `public/assets/fleet-runtime/sep22/raster-*.png` career references individually with the runtime models. I did not change implementation code. This document is my only edited file.

## Interface and framing

The final `test-results/feedback-2026/{phone,landscape,desktop}-tutorial.png` and corresponding pickup captures substantially improve on the crowded original. Instruments, chart and verbose floating labels no longer compete with the boat in training. Frank sits above the open operating space; on landscape touch he sits at the upper left. The lesson, boat, diver float and working side remain legible together. Kelp is visibly present in training.

The cream pickup speech bubble is immediately above Frank in all inspected viewports. It conveys the next action without covering the boat or float. Screenshots establish its placement, not the promised dismissal time.

The corrected desktop career capture contains the five core instruments and two crew panels without the original weather, exit-banner, picking legend or central diver-detail clutter. That particular capture is at 06:00 and dark, so it demonstrates HUD arrangement rather than daylight scenery.

Desktop framing centers the boat at `(640, 400)` in 1280×800. Touch deliberately preserves the existing career framing: the capture receipt reports `(195, 392.46)` in 390×844 and `(422, 156)` in 844×390. These positions center the boat in the usable water above the controls rather than at the literal vertical midpoint of the screen. The implementation author retained this because the user explicitly said career framing was already correct. The boat is unobscured in the inspected tutorial layouts; this distinction should not be described as literal geometric centering on every device.

The final starter captures at all three sizes show both models clearly with readable names and prices. The first captures caught menu fade-in and looked severely translucent; settled recaptures resolved that evidence problem. Static frames cannot establish reload stability; the implementation author separately reports passing reload identity assertions.

## Fleet appearance

I inspected `test-results/cohesion/fleet-twelve.png` and all twelve `test-results/equipment-boat-*.png` views. Every hull has a visible 3D model. The final profiles retain these recognizable reference signatures:

| Reference | Visible identity in the 3D model |
| --- | --- |
| `basic` | Silver broad working hull, forward cabin, two aft hatches and black fenders. |
| `basic-sister` | Wood decking, longer open foredeck, central cabin and aft bench. |
| `thruster` | Yellow trim and articulated port crane, blue bottle bank and aft crates. |
| `thruster-sister` | Red tug cabin and hull, heavier black fender belt and central aft winch. |
| `sterndrive` | Blue blunt punt, open foredeck and distinctly aft-mounted wheelhouse. |
| `sterndrive-sister` | Yellow pointed workboat, forward cabin and silver working boom. |
| `outboard` | Orange RIB collar and two outboards. |
| `outboard-sister` | Silver skiff, one outboard and paired aft storage/seat boxes. |
| `jet` | Open silver working hull with smaller forward cabin, central box and aft transverse boom. |
| `jet-sister` | Separate yellow crane arrangement, starboard white bins and black aft working grid. |
| `twinjet` | True separated twin bows and sterns with a broad bridging cabin and work deck. |
| `twinjet-sister` | Forward netting, aft solar platform and deck-circle detail distinguish the second catamaran. |

The first yellow workboat versions were too similar; the revised articulated cranes and different deck inventories materially improve their identity. The outboard pair of captures, `outboards-helm--1.png` and `outboards-helm-1.png`, visibly shows both motor heads turned in opposite directions between helm states. This establishes the rendered poses, not physical controller operation or continuous animation quality.

These remain stylized interpretations. The wheelhouses share a fairly box-shaped construction; the source rasters have more varied windshield contours, weathering, rigging and deck clutter. They should not be described as exact reproductions of every raster detail. Ladders, rails, tanks, deck fittings and differentiated equipment make the models useful and appealing at the game scale.

## Chandlery

The desktop hauler confirmation and `equipment-touch-confirm-390.png` / `equipment-touch-confirm-844.png` contain the cost, cash-after-fitting and available-cash prose above the action buttons without overlap. The portrait fuel-package example has a substantial description and still keeps the card and actions separate. The landscape capture is scrolled to the confirmation body, with the action row visible below it.

The fitting locator is red and the final portrait preview caption correctly says that red marks the fitting. The earlier contradictory gold caption was reported and corrected.

## Water and coastal cues

The kelp tide sequence visibly progresses from mostly hidden at +5 to faint at +2 and distinct grouped stands at -1. The blades are a stylized, grass-like rendering; screenshots alone do not verify current-driven motion.

The final rock depth sequence makes the five-metre rock faintly locatable as a low-contrast teal shape. It becomes substantially clearer at two metres, lighter near the surface and plainly exposed above the waterline. Earlier captures did not make the five-metre rock visually useful; its contrast was increased after review.

The first whitecap implementation looked like dense rain scratches and was rejected in review. Final `wind-0.png`, `wind-5.png` and `wind-15.png` show no wind crests at zero, sparse small curved crests at moderate wind and larger, more frequent crests at strong wind. The strongest case has a somewhat regular crescent pattern at the widest zoom, but preserves visibility of the boat and coastline and communicates wind strength.

The final `current-field-wide.png` has readable arrowheads across the visible water and changes in direction around the island. The initial arrows collapsed into faint dashes at this zoom; the enlarged final glyphs address that readability issue. One screenshot cannot establish that their roots stay fixed as the boat moves; that needs the separate runtime checks.

## Remaining evidence limits

- The subsequent `loaded-damaged-boat-wake.png` capture closes the wake evidence gap. A boat carrying three visible deck bags leaves a coherent pair of foamy trails; the broad translucent concentric hoops from the user's original image are absent. The supplied fixture is moving at 4 m/s with 55% hull condition to exercise the damage sheen. This frame confirms the inspected appearance, not every speed or damage state.
- I did not independently exercise speech expiry, starter reloads, continuous kelp/outboard animation, current-arrow anchoring, or collision consequences. Report those from their runtime tests, not from this visual review.
- Static desktop and emulated touch screenshots do not establish physical Xbox/Steam Deck controller behavior, real-phone performance, Safari behavior, frame rate, or new-player acceptance.

No additional blocking layout or readability defect was found in the final inspected captures. The touch framing nuance, shared stylized wheelhouse construction and evidence limits above remain explicit.
