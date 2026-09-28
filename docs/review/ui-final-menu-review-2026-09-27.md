# Independent final menu review — September 27, 2026

Completed September 28 after the final production capture pass.

The corrected production build passes the independent menu behaviour and mobile
career checks below. No blocking issue remains in the reviewed menu routes,
including the settled end-of-day summary. The deeper passes corrected touch
targets, Harbour discoverability and desktop Crew status clipping that the
initial checks missed. This is a menu review, not a claim that every device or
the entire game has passed acceptance.

## Independence and evidence

This reviewer did not implement the redesigned menus. I authored earlier HUD
work before the pause, so I do **not** count my HUD opinions as an independent
HUD visual review. The resumed assignment was menu critique and adversarial
behaviour checks. I ran the development mobile journeys while the parent agent
executed the independently authored scripts against the frozen production
server to avoid concurrent GPU load. I inspected the resulting production
images and machine-readable results.

Reviewed production captures are in `test-results/ui-overhaul/final4/`, produced by
`scripts/interface-review.js` against production port 5186. Sizes inspected:
1280×800 desktop, 390×844 phone portrait, and 844×390 landscape. I also inspected
the earlier `iteration2` captures to verify that reported defects were actually
corrected rather than merely acknowledged.

## Findings and corrections

- **Settings hierarchy and visibility:** `07-settings.png` now shows all four
  groups and the entire final Artwork/Exit row at 1280×800. The earlier capture
  clipped that row. The explicit Settings heading provides orientation, and
  cycle, toggle and navigation affordances now distinguish different actions.
- **Controls and remapping:** `10-bindings.png` uses the same heading treatment
  as other menus. Current bindings, including Enter / Numpad Enter, remain
  readable in the selectors; the redundant “Current:” prefix no longer crowds
  out the actual key names. Keyboard reference and action list remain distinct.
- **Arrange UI:** `11-arrange-ui.png` fixes the overprinted heading instruction.
  Save and the editing controls remain visible. The preview and the list of
  windows are understandable as different ways to select the same window.
- **Crew:** `12-crew.png` preserves portrait identity and the two berth choices.
  Names on unavailable crew cards retain readable contrast while their portraits
  remain desaturated. The earlier names were unnecessarily dim.
- **Pause:** `19-pause.png` gives Resume clear priority and places the Session
  action under the shorter left column, avoiding the previous wasted space.
  The grouped phone version in `26-phone-pause.png` remains readable and exposes
  the normal session actions before development tools.
- **Purchases:** `04-starter.png` keeps career difficulty beside the persistent
  purchase action. `05-purchase.png` clearly identifies the item, price and
  available funds, with Cancel selected initially. The additional confirmation
  has a clear purpose and does not obscure the financial decision.
- **Touch and compact menus:** `23-phone-touch-options.png`,
  `27-phone-settings.png` and `28-landscape-settings.png` retain clear groups,
  readable action labels and usable scrolling, without horizontal overflow or
  unintended content overlap in the inspected captures. The larger-scale
  preference capture `02b-large-ui.png` also remains within the viewport.

## Independent interaction checks

`scripts/menu-adversarial-review.js` extends the main acceptance and accessibility
scripts. All eight checks passed in
`test-results/ui-overhaul/final4-adversarial/results.json`, with no page or resource
errors:

1. Cancelling a purchase leaves cash and fleet unchanged, clears the pending
   transaction and cannot reopen a purchase through Forward.
2. A held native Space press waits for release, then activates the focused
   sound preference exactly once and preserves native focus.
3. All 14 non-Back Settings actions have a route using mapped synthetic
   controller direction buttons and are brought fully into the visible scroll
   area. The driver does not set the selected index directly. Back is exercised
   separately by the navigation checks.
4. Escape cancels keyboard remapping before leaving its menu and preserves the
   original binding map.
5. Partially naming controller face buttons survives viewport resize and menu
   refresh. Escape cancels the draft while preserving applied names and gameplay
   bindings. This is controller naming, not a free-text form test: the current
   interface has no natural free-text naming field.
6. Back and Forward restore the selected fleet preview and nested scroll
   position. Opening a new Crew branch clears obsolete Forward history.
7. A naturally created **Realistic career**, rather than only an Easy career
   showing a Realistic information preset, keeps forbidden information controls
   unavailable through Custom and All Off transitions. Exact deck/diver readout
   preference remains available, and the deliberate Custom setting restores.
8. A native touch scroll beginning on an information switch does not activate
   the switch on release.

The main interface run additionally reports correct title Settings return,
sea Settings return to water, direct chart return, mapped controller navigation
and native touch actions. Sea Settings returning to water is intentional under
`bible.md` §18; it is not a lost-history defect. Escape has a different,
intentional role: it closes menus to the current water/harbour location, first
cancelling pending input capture. Consequently the Bindings instruction
“Escape returns to harbour” is correct when opened from Harbour Settings;
ordinary Back still returns to Settings.

## Deeper mobile career review

The original phone checks covered tutorial and Settings routes. The additional
independent `scripts/mobile-career-review.js` follows a fresh career through
day-zero skip, difficulty selection, hull selection, purchase cancellation and
confirmation, Harbour, Crew, Bindings, Arrange UI and dirty-draft discard. It
uses 390×844 and 844×390 browser-native touch, plus native Tab/Space in Bindings.

The first production run in `test-results/ui-overhaul/mobile-career/` found two
real omissions despite the earlier checks passing:

- Reset to Defaults in Bindings and the landscape purchase actions rendered
  only 38.39 pixels high with touch mode enabled. Later development captures
  verified the strengthened 44-pixel minimum throughout the tested menus.
- The panning Harbour opened on an isolated column without an obvious pan cue,
  while the compact landscape heading could disappear above the viewport.
  Locator-based automated taps silently scrolled hidden destinations into view,
  so successful transactions alone did not prove usable navigation.

The approved scenic composition and compact panning are explicit requirements
in `bible.md` §§5 and 23. A temporary development layout fitting all destinations
into one view was rejected for that reason. The corrective implementation keeps
the artwork and destination positions, adds a fixed heading and labelled pan
controls, and retains actual scene panning. This preserves the established
navigation decision while making it discoverable.

The revised test no longer accepts automatic locator scrolling as evidence for
Harbour navigation. It uses physical-coordinate touch taps on visible pan
controls, verifies that each of the nine destinations can be completely clear
of the fixed heading and controls, then opens Crew and Settings and checks the
return pan position. The same pass checks reachable career difficulty/purchase
actions, a Crew swipe without accidental assignment, diagram switching without
remapping, and Arrange movement/discard without changing the saved layout.

Development diagnostics in `mobile-career-pan-diagnostics/` and
`mobile-career-dev-pan-fixed/` then exposed an initially offscreen Sail action
and vertical arrow steps that could skip the usable region for a middle-row
destination. A stale shop scroll restoration was being applied after purchase
opened Harbour; the implementation now clears stale restoration on an explicit
new screen while retaining deliberate Back/Forward restoration. Pan steps now
use the space actually available between heading and controls.

Both corrected production journeys in
`test-results/ui-overhaul/final4-mobile-career/results.json` passed with 33
captures and no page/resource errors:
initial Sail visible, all nine destinations clear and reachable through native
pan controls, exact Crew/Settings return positions, every measured menu action
at least 44 pixels, and a native sideways keyboard swipe without accidental
remapping. Coordinate taps also removed the earlier ambiguous 10-pixel return
measurement caused by locator auto-scrolling. One final small correction
disables the horizontal arrows at the first/last destination column rather
than leaving a no-op enabled step. The production tour also passes these
boundary-state assertions. I inspected the actual production initial/left/right
Harbour, purchase, keyboard-swipe and Arrange captures; these corrected states
are visible in the images, not inferred from passing commands alone.

## Late desktop finding — resolved

Inspection of `final3/12-crew.png` at full size found that some desktop roster
cards clipped their status line beneath the name: Aboard, Assign berth and rank
requirements disappeared even though the portrait and name fit. The corrected
`final4/12-crew.png` shows the names and status lines fully inside their cards,
including multi-line names and rank requirements. The menu now gives portrait,
name and status their own rows. The main production interface run also passes
an internal content-containment assertion for these labels, rather than relying
only on button hit sizes. `final4-mobile-career/portrait-05-crew.png` confirms
the phone roster retains readable names and status after the correction.

The final compact landscape Harbour heading uses one bounded row for Back,
location and funds. The production `landscape-04-harbour.png` and
`landscape-13-harbour-return.png` preserve the scenic composition and visibly
leave more room for destinations, while the complete native pan tour still
passes.

## Settled end-of-day summary

I inspected the final natural-voyage `test-results/natural-voyage-offload.png`
showing a $84.93 working-day return. The net return has clear priority, the
weight/quality/sale/cost breakdown remains legible, and Prepare next day is
clearly separated from the receipt. The scenic background does not compete
with the settled text. An earlier very translucent capture was taken during
the entry transition; the corrected screenshot timing establishes the actual
resting appearance rather than treating that intermediate frame as a permanent
contrast defect.

## Remaining limits

The Arrange UI miniature preview is necessarily dense at phone sizes. The final
production capture uses controlled single-line ellipses rather than the earlier
broken label wrapping; the separate full-size list provides readable window
names and the same selections. Long phone Settings pages rely on ordinary
scrolling and a partially visible following section as the continuation cue.
These are minor presentation limitations, not missing actions in the tested
paths.

Controller inputs here are synthetic browser gamepads. They do not establish
physical Xbox or Steam Deck behaviour. Touch tests use browser-native events
under emulation, not physical phone ergonomics or mobile GPU performance.
This review does not establish Safari support, screen-reader certification,
every custom binding/layout combination, or all possible screen sizes. The
parent's release receipt owns the final full-suite and export status.
