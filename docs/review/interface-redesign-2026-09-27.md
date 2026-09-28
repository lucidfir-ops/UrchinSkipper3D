# Interface redesign · September 27, 2026

The menu and HUD redesign keeps the existing simulation, control bindings,
information entitlements, two-diver crew, purchase confirmations and navigation
history. It reorganizes the presentation around a shared wheelhouse palette,
legible decision groups and individually configurable instruments.

## Changes

- Title actions use a clear primary continuation, career actions and separate
  preference utilities. Local troubleshooting tools now live in Settings.
- Settings groups interface, controls, picture/sound and support. Pause groups
  work, preferences, session actions and development tools. Back keeps its
  existing water/harbour/parent context; title Settings returns to Title.
- Menus share an independent navigation header and input-aware footer.
  Keyboard focus and controller selection agree. Directional navigation follows
  rendered geometry, including the split title rows. A held mouse press cannot
  lose its control to a menu rebuild.
- Information settings group instruments, navigation and crew feedback, separate
  from difficulty assistance. Switches and touch sliders stay mounted while
  interacting, and mobile explanations appear beside the chosen option.
- Vessel selection shows catalogue previews and capacity/fuel information before
  a deliberate purchase review. Confirmations retain their Cancel-first policy.
- The HUD aligns graphic gauges, distinguishes vessel/crew/navigation stations,
  and uses named crew cards with compact readiness. Realistic selectors show
  identity and selection only; All Off and individual visibility remain intact.
- Saved manual layouts take precedence over adaptive defaults. All instruments
  remain independent. Ordinary menus quiet the HUD; Arrange UI keeps previews.

## Final review and revisions

The resumed review used three separate agents: a menu specialist, a HUD
specialist, and an adversarial interaction reviewer. The two implementers then
reviewed each other's screenshots. The earlier work also used separate agents;
the resumed pass reassessed its decisions rather than treating its reasoning
setting as evidence of either success or failure.

The final revisions pack Pause into useful columns without changing the phone's
reading order, distinguish cycling preferences from submenus, preserve more
nested scroll positions, and keep unavailable crew names readable. Starter
difficulty and the purchase action stay in one persistent footer.

The vessel card supplies exact readings when their independent gauges are
hidden. It avoids duplicating them when those gauges are visible. Unsaved
instrument rows close gaps as instruments are hidden; deliberate saved positions
take precedence. Crew meter labels, compact keyboard layouts, touch stick labels,
phone legends, and recovery prompts were corrected through screenshot review.
The touch camera remains an orthographic boat follower, framed within the clear
water between instruments and controls in each orientation.

The independent menu checks cover transaction cancellation, held native Space,
all Settings actions through actual synthetic directional input, remapping and
partial naming cancellation, history restoration, Realistic career information
limits, and native touch scrolling across switches. The complete working-voyage
test is separate from the interface script's labelled presentation fixtures.

Quiet HUD screenshots did not establish recovery-state acceptance. A separate
context pass exposed clipped recovery progress and deck-overflow warnings on
compact defaults. That finding required another presentation revision and
dedicated surfaced-diver, denied-recovery and active-recovery captures. The
phone career pass separately exercises purchase cancellation, crew scrolling,
remapping and discarding layout changes; tutorial screenshots alone do not
cover those screens.

The final context fixtures also cover denied recovery with excess catch,
duration/progress separation, physical float visibility, saved-position
precedence and restoration of passive instruments. These are presentation
fixtures, distinct from the natural voyage. [Context validation](hud-context-validation-2026-09-28.md).

Final review records are [menu interaction review](ui-final-menu-review-2026-09-27.md),
[HUD review](ui-final-hud-review-2026-09-27.md), and
[cross-review of menus](ui-final-cross-review-2026-09-27.md). Release checks and
build/export identities are recorded in
[the verification receipt](release-verification-2026-09-28.json).

## Review method

Independent agents investigated navigation/controls, HUD hierarchy and
accessibility. The first captures were made while edits were arriving and are
explicitly labelled **early integration**, not a clean before-state comparison.
Subsequent rounds use fixed production builds. Root and separate reviewers
inspect the actual PNGs; automated geometry alone is not visual acceptance.

Reproduce the core interaction/capture pass with `npm run verify --
--browsers-only --suite=interface`, using an installed Playwright browser.
`scripts/interface-review.js` exercises title preferences, native keyboard
focus, a held purchase click, harbour navigation, information presets, at-sea
return paths, synthetic controllers and touch portrait/landscape flows. Its
water-state fixture is identified in the script; it is not a completed voyage.

Physical controller hardware, actual mobile performance, Safari and hosted
itch.io play remain separate acceptance work. Synthetic gamepads and browser
touch events do not establish those results.
