# Independent menu cross-review — September 27, 2026

This review is by the agent responsible for the HUD follow-up, not the menu
implementation. It assesses menu screenshots independently. The agent's HUD
implementation checks are not presented here as independent HUD approval.

## Evidence

I opened the actual immutable-production PNGs under
`test-results/ui-overhaul/final/`: Title, title/harbour Settings, Frank's briefing,
starter selection, purchase confirmation, harbour, information options, touch
options, keyboard bindings, Arrange UI, crew, fleet, chandlery, harbour office,
weather, Pause, phone Title/touch options/Pause/Settings, and landscape Settings.
The inspected viewports were 1280×800, 390×844 and 844×390. I also opened the
phone information screenshot under `final-accessibility` and the first four
`final-adversarial` screenshots, including keyboard and synthetic-controller
focus and the controller diagram.

`final/results.json` reports the menu-context, purchase, keyboard-focus,
synthetic-controller and native-touch checks with no page/resource errors.
`final-adversarial/results.json` reports held-Space single activation, actual
controller routes to all 15 Settings actions, cancelled remapping, stable
controller naming, nested Back/Forward scrolling, safe purchase cancellation,
Realistic restrictions and touch scrolling without toggling a switch. These
are separate agents' executed interaction evidence, not actions performed by
this screenshot reviewer. I did not launch a competing browser during those
runs.

## Findings

- Settings has a clear hierarchy and consistent row treatment. Interface and
  control preferences are distinct, current values are visible, and the final
  desktop rows fit. The phone stacks these groups in a readable order; landscape
  retains two columns and scrolls to the remaining groups.
- Title, ordinary menus and Pause share readable typography and a consistent
  colour/focus system. Resume is immediately identifiable on both desktop and
  phone. Back and the opening context have separate, predictable places in the
  header. The input hint changes with the active device in the inspected
  adversarial captures.
- Starter difficulty is now visible beside the persistent purchase action.
  The selected hull, price, deck capacity and remaining money are readable.
  Confirmation names the item and price and initially emphasizes Cancel.
- The first final starter capture still had a small inline Buy in addition to
  the footer Buy. I reported this as an unnecessary competing affordance. A
  revision was requested to keep one purchase action; its visual recheck is
  recorded below.
- I initially criticized the empty fleet detail pane and suggested previewing
  the owned hull on entry. That suggestion was withdrawn after checking
  **Bible §6: “Shops start without a selected boat.”** The neutral selection
  state is deliberate. Selection must not be introduced merely to fill space.
  The explanatory prompt and separate Your boat route remain understandable.
- Information options expose the active information preset separately from the
  unchanged career difficulty. The desktop explanation sits alongside the list;
  on phones the inspected option explains itself directly beneath its label.
  This avoids requiring the player to find a remote help panel.
- Touch options distinguish control size, opacity and information-window
  preferences. Sliders and step controls are readable, and the preview explains
  the effect without introducing gameplay changes. Controls below the initial
  phone viewport require scrolling, as expected for this many independent
  preferences.
- Crew portraits and names remain legible when locked. The selected diver's
  larger portrait, biography and ability table establish a useful reading
  order. The bindings diagram and adjacent action list are visually coherent;
  some long native-select values truncate, but their adjacent action labels
  retain the full assignment.
- Arrange UI is functionally dense. Its small preview rectangles wrap and clip
  descriptive text at their miniature scale. The adjacent full-name selector
  remains legible, so this is a residual presentation compromise rather than a
  blocked editing action. It should not be described as perfectly polished at
  every preview size.

## Scope and limits

No blocking menu hierarchy or readability defect was visible in the inspected
states beyond the requested starter affordance cleanup. This is a considered
visual assessment, not proof that every state, custom scale or saved layout is
ideal. Phone starter/crew/bindings/layout screenshots were not part of the first
final screenshot set; the additional production inspection is recorded below. The game
contains more screens and state combinations than these captures cover.

Physical Xbox/Steam Deck controls, real phone touch accuracy/performance,
Safari, complete screen-reader operation and long-session visual fatigue were
not established by this review. Synthetic controllers and browser touch
emulation cannot establish those results.

## Revision follow-up

I opened `test-results/ui-overhaul/final2/04-starter.png` after the rebuild.
The duplicate inline Buy is gone. The selected vessel remains clear, the career
difficulty selector remains visible, and the single persistent Buy selected boat
action establishes the intended hierarchy. This closes the specific starter
finding. The production screenshot set named `final` predates that correction.

## Final production follow-up — September 28

I opened `final3/06-harbour.png` and `final3/02b-large-ui.png`. Desktop Harbour
keeps every route visible and gives Sail a clear primary focus. At 150% menu
size, the UI-size panel's text, controls and footer still fit.

I also opened these actual immutable-production captures under
`test-results/ui-overhaul/final3-mobile-career/`: portrait selected starter,
Harbour, scrolled crew roster, horizontally swiped keyboard diagram, Arrange UI
and dirty-layout confirmation. These are additional screenshot observations;
the independent mobile reviewer performed the associated interaction journey.

Phone starter selection exposes the price, cash after purchase, career
difficulty and one purchase action in a coherent sequence. Harbour initially
shows the focused Sail route, and the bottom controls explain that the scene
can be swiped or moved with arrows. Crew names and progression requirements
remain legible while scrolling. The keyboard diagram explains its horizontal
pan, with full action/remapping rows below it. Dirty-layout confirmation clearly
distinguishes continuing editing from discarding changes.

The Arrange UI preview remains dense at phone size: miniature labels truncate,
and the instruction line is small. The adjacent element list provides the full
names and the separately tested move/resize controls remain operable. I retain
that presentation limitation rather than calling the editor perfect. No new
blocking visual defect was identified in this additional set.

I subsequently opened `final4-mobile-career/portrait-06-crew-scroll.png` and
`final4-mobile-career/landscape-04-harbour.png`. The crew cards now accommodate
the full multi-line progression requirement (including “Working record
needed”). The compact Harbour header leaves the middle and lower destination
rows visible; vertical arrows expose the upper row while retaining the scenic
pan. This closes the specific crew-label clipping and compact-header crowding
raised during the subsequent independent review. Physical touch reach and
legibility on an actual phone remain outside this browser evidence.
