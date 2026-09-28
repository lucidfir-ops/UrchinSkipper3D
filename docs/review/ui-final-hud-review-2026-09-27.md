# Independent HUD review · September 27, 2026

Updated September 28. The inspected revision 4 quiet, recovery and natural-voyage
views have no remaining visual blocker. This is acceptance of the pictured
states and tested viewports, not a claim of universal device or custom-layout
compliance. Quiet screenshots alone did not establish working-state acceptance.

The menu/navigation reviewer inspected the HUD separately from its author. This
reviewer changed menu presentation, navigation scroll capture and the short touch
help copy; assessment of that help copy is implementation verification, not an
independent opinion. Instrument graphics, default HUD geometry, crew cards and
recovery presentation were authored by another agent.

## Evidence

The PNGs were opened with the image viewer at their actual capture sizes. The
final quiet replacement set is `test-results/ui-overhaul/final4/`, produced from
the root agent's fixed production build. Earlier `final2/` and `final3/` images
were also opened. Reviewed views include:

- `17-tutorial-hud`, `18-easy-hud`, `20-realistic-hud`, `21b-all-off`: 1280×800.
- `18b-compact-keyboard-hud`: 844×390, after actual keyboard input.
- `24-phone-tutorial`, `25-phone-hud`: 390×844.
- `24b-landscape-tutorial`, `29-landscape-hud`: 844×390 with touch controls.

Earlier `iteration2`, `hud-final` and `final` images were also inspected to identify
and reject specific defects. They are not interchangeable acceptance evidence.

## Criticism that changed the result

1. Desktop Easy crew cards initially crowded their lower edge: air/bag labels,
   meter bars and nitrogen readiness overlapped. The final desktop and compact
   screenshots separate these rows. The compact view retains both named divers
   and readable headline readings without displacing the boat.
2. Realistic initially left gaps in the instrument rail when additional Easy
   gauges disappeared. The final rail packs the enabled defaults, while the boat
   card supplies readings for independently hidden instruments. This review does
   not certify every user-created layout; saved positions still take precedence.
3. Early portrait touch help clipped its recovery line. The shorter final help
   fits. Portrait Frank text and its three actions stay above the working-action
   controls, and the followed vessel remains visible above the lesson.
4. Landscape tutorial captures previously brought the boat into the instrument
   and lesson/control areas. In `final2/24b` the vessel has a clear working space
   between them. The independent deck-load reading also remains visible.
5. The first file called `18b-compact-keyboard-hud` had no keyboard dock: the test
   captured it before its first keyboard event. This reviewer rejected that as
   keyboard-layout evidence. The replacement follows Space input and a visibility
   assertion; its three keyboard control clusters fit below the vessel and HUD.
6. The initial phone quality legend clipped its final 60% entry. This reviewer
   **missed it on the first visual pass** while concentrating on crew and control
   bands; the broader verification caught it. Reinspection confirmed the defect.
   `final2/25` now shows the entire quality legend, including 60%. The earlier
   blanket statement about phone clipping was therefore withdrawn.
7. Broader dynamic review then found recovery warnings and progress missing or
   clipped despite the quiet screenshots looking acceptable. The contextual
   panel was rebuilt around the recovery heading, progress, critical consequence
   and required action. This reviewer checked the replacement development and
   fixed-production states rather than treating the idle view as proof.
8. In development portrait recovery, the duration touched the progress rule and
   a right-side message card concealed the surfaced float when it was on the
   wrong side of the vessel. This reviewer reported both. The corrected duration
   sits beside the heading; ready/denied messages use a lower strip, exposing both
   sides of the boat. The longer active-recovery card retains clear port water.
9. The natural voyage then exposed a distant surfaced diver's speech mostly
   behind the instrument rail. Its corrected placement avoids visible HUD
   windows and uses a short leader to the float. Revision 4 fixture and natural
   surface PNGs both show the complete speech and visible float.

## Quiet-view assessment

The inspected HUD now has a coherent hierarchy: graphical navigation/helm
instruments across the top, named crew at an edge, a separate chart, and a
contextual working message. The boat retains clear surrounding water in the
desktop and compact captures. The boat card no longer repeats all independent
gauges; the context heading is calmer and the selected diver has one clear
selection treatment.

Realistic's portrait cards show identity and selection only in the reviewed
images, and the Easy picking legend and live-current gauge disappear. Exact deck/diver
readouts are an explicit later allowance in `bible.md` §18; retaining that option
is preservation of the approved rules, not a claim that all telemetry is literal
real-world observation. All Off hides the optional information panels while
leaving the player's controls available.

Phone layouts remain dense because they retain the independent helm controls,
working actions, two crew members and important instruments. Primary numeric
readings and working actions are distinct, and the corrected captures show no
overlap among vessel, lesson, action controls and crew. They are acceptable for
the inspected viewports, not proof that every phone is comfortable for prolonged
play.

## Remaining limits

Gauge graduations, compact crew readiness and some secondary captions are small
(roughly 8–10 CSS pixels in compact views). UI Scale and saved arrangements
provide adjustments; these screenshots do not establish universal readability
or formal WCAG conformance. A static idle image cannot prove every long recovery,
grounding or emergency message fits. Dynamic work-state evidence is recorded
separately below when reviewed.

Physical Xbox/Steam Deck controls, actual phone touch accuracy/performance,
Safari, screen-reader use and long-session eye fatigue were not verified by this
reviewer. Browser screenshots and synthetic input cannot establish those results.

## Dynamic inspection · September 28

The fixed-production `final4-hud-context/` PNGs reviewed include portrait touch
active recovery with excess catch, wrong-side denial with excess catch, compact
keyboard recovery, landscape touch recovery and distant desktop speech. The
earlier `final3-hud-context/` equivalents were also inspected. In those pictured states the
250 lb excess consequence, permission to board, progress, duration, instruction
to remain alongside and port/speed requirement fit. The vessel and the relevant
port or starboard surfaced float remain visible. These are deliberately arranged
work-state fixtures, not evidence that an entire fishing trip happened naturally.

The reviewer also opened `natural-voyage-{drop,surface,recovered,offload}.png`
from the production natural-voyage run, then reopened the revision 4 surface,
recovered and offload replacements after their timestamps changed. Surface and recovered states display the
radio message, recovery status and updated crew/catch information. The recovered
view shows 300 lb aboard. The root owns the voyage's behavioural and accounting
assertions; this review inspected presentation.

That natural journey exposed the speech obstruction described above, missed by
the nearby-float fixtures. The final natural surface capture shows the entire
77% sample / about 40 seconds a bag message, its leader and the float below the
instrument rail, separate from the recovery panel. The initial offload image also appeared translucent; source
inspection established that the capture occurred 80 ms into a 160 ms menu fade,
while the settled shell was already nearly opaque and the receipt fully opaque.
The capture now finishes CSS animations. The inspected revision 4 replacement
has clear contrast and a distinct receipt showing a $84.93 working-day return.
The opacity issue was a capture timing artefact; no unnecessary summary styling
change was made.

The final contextual fixture reports 17 states without page/resource errors;
its geometry assertions complement the selected PNG inspection. This does not
prove every possible emergency, lengthy radio combination or user-created
arrangement is optimal. The natural journey provides additional evidence that
ordinary work, speech, recovery and the settled offload remain coherent outside
the arranged fixtures.

A subsequent cache-lifecycle correction clears speech placement when a new
voyage starts; it does not change the reviewed visual styling. The reviewer
opened the rebuilt `release-hud-context/keyboard-1280-speech-clock-reset.png`
and `keyboard-1280-far-speech.png`: both show complete speech, a clear leader and
the visible float without covering the vessel or instrument rail. The release
fixture reports 18 states and no page/resource errors. This closes the pending
post-reset visual check. The release natural-surface and settled-offload PNGs
were also reopened: the speech remains clear and the latest receipt shows
$84.85 with the same readable layout. The root retains ownership of the complete release
matrix and packaged-build checks.
