# Interface redesign — October 4, 2026

**Commission.** The designer described the menus as the generic look of non-coder AI projects ("Astra's hallmark green buttons") and gave artistic licence to redesign them. They also said the HUD "isn't exactly pretty on any device" and "doesn't convey boat controls." Phone portrait is the hardest case. Target devices: Samsung S22 (360×780 CSS px, touch), Doogee E3 Tab Max 14" (1280×800, touch), and Steam Deck (1280×800, browser).

Behaviour, navigation, information entitlements, saved layouts, hit targets and stick interaction are unchanged. Speech placement logic is also unchanged.

## Menus — the chart room

The menus are in `src/ui-tokens.css` and `src/ui-chartroom.css`, loaded last.
- Panels are chart paper: a faint 40 px grid, an ink rule under the navigation strip, and a heavy shadow over the sea.
- Type is Barlow Condensed for headings, Barlow for body and IBM Plex Mono for eyebrows and figures. All three fonts are bundled from `@fontsource` under the OFL, so the offline Wi-Fi export works.
- Exactly one signal-orange element marks controller or keyboard focus. Primary actions are solid ink. Hover never adds a second orange state, and touch devices get no sticky hover.
- Title and harbour hotspots are paper tags with an ink tab.
- Load Game keeps the supplied Channelmaster image (Bible §3) as a framed plate in its reading pane.
- On compact screens the harbour heading stacks so the money and season line cannot clip.

The older layered stylesheets are not rewritten. The new layer wins by repeating the ID (`#playtest#playtest`). Leftover pale dark-theme text inherits ink through a `:where()` rule that stays below the new class rules. The old `--ui-accent` token now maps to ink, so legacy accent uses no longer look like focus.

## HUD — the wheelhouse console

The HUD is in `src/ui-console.css`, with markup in `src/instruments.js` and `src/touch-controls.js`.
- Instrument windows are gunmetal modules with recessed wells and backlit readouts: amber for time, speed, fuel and helm; sea-green for depth. A shallow keel turns the depth readout red.
- A titled **HELM** module shows an engine-order lever and a rudder-angle arc, with word-and-number readouts ("AHEAD 35%", "RUDDER P20").
- The touch throttle stick is drawn as a telegraph (AHEAD / ASTERN, plus a BOW caption only on boats with bow thrust). The rudder stick is a port-red/starboard-green wheel.
- Reverse / Neutral / Ahead form one telegraph selector.
- Actions are console push-buttons. Their lamp lights only when that action is actually offered and the player is entitled to action prompts.
- Crew cards are slates with float-matching stripes.
- Speech is a dark console callout. The detached decorative tail is hidden.
- Labels have a minimum legible size. Small modules drop tick numbers instead of shrinking them below about 10 px.
- The phone toggle row is aligned, and the bottom slates respect the safe area.

## Review

The independent reviews inspected `test-results/ui-gallery/final-1/` (made with `scripts/ui-gallery.js`).

**Menus.** The reviewer accepted the direction as coherent and clearly better than before. They also listed defects:
- old pale text (equipment status, crew level, almanac labels);
- dark device diagrams;
- a second highlight state from sticky hover;
- orange used for non-focus states;
- the area-preview plate overflowing the panel;
- small phone tables;
- mid-word breaks;
- some sticky shop footers covering content.

All but the footers, some long crew-name breaks, the "HOME HARBOUR" location label on every screen and the flush tablet insets were fixed. Those four are left as known issues.

**HUD.** The reviewer accepted the change in materials and asked for:
- legible minimum sizes;
- a titled helm with consistent wording;
- a discoverable bow thrust;
- aligned phone toggles;
- a safe-area margin;
- a console-style speech callout;
- an old-style Deck key panel restyled;
- capped tablet slate width;
- lamps that mean something.

All of these were implemented.

Two requests were declined deliberately:
- Instruments stay hidden while Frank's tutorial card is shown, as the designer approved in the September 28 feedback.
- The touch sticks were not rebuilt as a slider lever and an arc; that would change established control behaviour, not just presentation.

**Remaining limits.**
- The phone's bottom console still covers a large share of the screen.
- The tablet modules sit at the screen edges rather than forming one console.
- Some phone dial names sit across tick marks.
- Nothing has been checked on a physical device. The designer's own playtest is the acceptance test.
