# HUD recovery context validation — September 28, 2026

This is the HUD implementer's focused validation, not an independent visual
approval. The separate menu agent inspected the actual revised HUD screenshots
and reported its own findings to the root agent.

The quiet voyage captures originally missed a substantive defect: surface
recovery instructions, progress and excess-catch warnings were clipped by the
small default message rectangle. The first production context check exposed
that problem. Its failing captures remain under
`test-results/ui-overhaul/hud-context/`.

## Corrections

- The message prioritises the selected skipper-visible diver, eligibility or
  denial, recovery progress, control lock, excess-catch notice and port-side /
  relative-speed requirement. Large desktop layouts retain supplemental exact
  readings. Compact layouts omit redundant supplemental readings, without
  removing the mandatory working-side and speed requirement.
- Active default contexts receive sufficient space. On phone portrait, simple
  eligibility/denial (including an excess-catch warning) uses a compact strip
  below the boat. Longer active recovery uses a side card. The tested port and
  starboard physical floats remain visible. Duration stays above the progress
  meter when its headline wraps.
- Saved window rectangles remain the user's rectangles. The conditional
  displacement of less urgent default gauges applies only while the default
  context is visible. Hiding action prompts restores those gauges.
- Only duplicate target status text is suppressed when a visible, unoccluded
  default context supplies it. Physical floats, markers, target selection,
  other divers' cues and the existing observational rules remain unchanged.
  A custom context rectangle restores the original world status cue.
- Portrait ground-legend content now fits its default rectangle. On-water
  Adjust UI, Hide UI and Menu controls have 44-pixel minimum heights.

## Executed focused check

`scripts/hud-context-review.js` entered through the title/tutorial flow, then
explicitly staged isolated presentation fixtures. It did **not** simulate a
completed commercial voyage. Fixtures place the surfaced diver four metres
from the vessel so eligibility and working-side denial are meaningful; the
script asserts the intended state before capturing it.

The final development run is
`test-results/ui-overhaul/hud-context-dev7/results.json`. It passed all sixteen
captures: ready, wrong side, wrong side with excess catch, and active recovery
with excess catch at 1280×800 keyboard, 844×390 keyboard, 390×844 touch and
844×390 touch. The script checks required text/progress bounds, duration versus
progress, physical target versus message bounds, ground-legend overflow,
custom message position, restoration of the duplicate cue and restoration of
passive gauges when action prompts are hidden. It recorded no page/resource
errors. The final browser process exited successfully and closed before the
root agent's production matrix.

I opened the actual revised phone denial/overflow and compact recovery PNGs.
The wrong-side float is now visible beside the vessel; the compact strip shows
the denial, excess-catch warning and port/speed requirement without scrolling.
The active portrait duration no longer sits on its progress meter. The final
unit geometry test and focused source lint also passed.

The root agent's immutable production run establishes release evidence.
This development record does not substitute for that run, physical-controller
validation, real-phone testing, or every possible custom layout and recovery
combination.

## Immutable production measurements

The root agent subsequently ran the same fixture suite against the fixed build
on port 5186. I read
`test-results/ui-overhaul/final3-hud-context/results.json`: all sixteen captures
are present, with no page/resource errors. Every tested selected float is clear
of its message, and every duration is clear of the progress meter. Portrait
compact messages measure 80 pixels of client height and 80 pixels of content;
the longer portrait recovery card measures 212/212 and landscape cards 132/132.
All three on-water utility controls measure **72×44 pixels** in every touch
capture. These are actual DOM measurements from the production browser, not
inferred CSS dimensions.

## Further defects exposed by the full voyage/touch pass

The full final3 touch suite then exposed a quiet-state case that the recovery
fixtures did not cover: the default portrait “Diver aboard / Choose a drop”
message had 65 pixels of scroll content in a 58-pixel client area. Its text was
visible, but its lower spacing overflowed. The correction reduces only quiet
touch padding and trailing margins; it does not resize or move that window.
The full development `three-touch-review.js` suite subsequently passed, including
quiet career telemetry, tutorial framing, orientations and touch targets. The
failing final3 evidence was preserved under `final3-three-touch`.

The completed natural voyage also exposed distant speech hidden under the top
instrument rail and its physical float behind the default context card. The
bounded correction chooses a clear position for the same spoken message near
its speaker, with a short leader when needed. It avoids visible HUD windows,
the followed boat and visible physical floats. An already clear placement is
retained; placement checks are limited to ten per simulated second. Speech
visibility and its content retain the existing rules.

Only an unsaved default desktop context covering the observed target may now
use the free space to the target's left or right within the existing middle
band. No other window moves. Saved message positions **or** sizes disable this
alternate default. The isolated `far-speech` fixture and geometry tests cover
the discovered distant pose. Its new PNG visibly shows the physical float,
readable nearby speech and unobstructed instruments/boat. The independent menu
reviewer opened that actual PNG and confirmed the original obstruction closed.

`hud-context-dev8` passed all seventeen fixtures after these changes, including
actual speech-versus-HUD bounds and all previous recovery states. Source lint,
the speech-placement tests and HUD geometry tests passed. The browser closed
before the root agent's final4 production matrix. As above, these staged
fixtures do not themselves constitute a completed voyage.

## Final release rerun

After the small speech-cache lifecycle safeguard, the root agent rebuilt the
release. I ran these production browser suites sequentially and closed both
browsers before handing the slot back:

- `verification-hud-context.json`: passed, exit 0. Eighteen captures now include
  a repeated identical spoken message after a simulated voyage-clock restart.
  It receives a new valid position immediately instead of retaining the prior
  voyage's future layout deadline. All earlier text, speech, physical-float,
  saved-layout, visibility and touch-target assertions also passed. Actual
  release PNGs and detailed measurements are in `release-hud-context`.
- `verification-voyage.json`: passed, exit 0, no page/resource errors. This is
  the separate natural voyage: actual boat navigation, unchanged tide/weather,
  natural 300-pound harvest, manoeuvred recovery, physical return and settlement.
  The voyage returned on time with both divers fit and full hull condition;
  its recorded net was $84.85 after 683.4 simulated seconds.

I opened the release far-speech and clock-reset PNGs. The same spoken message
remains readable and attached to the physical speaker in both positions, clear
of the boat, float and instrument rail. The separate visual reviewer was sent
the fresh natural-voyage surface capture for independent inspection.
