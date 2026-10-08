# Urchin Skipper 3D — current status

October 5, 2026 (v2 notes) · torch-lit bubbles show at night as by day, the deck-load ghost becomes a flashing 3D picture of a full deck, diver bubbles are half as opaque and a quarter smaller, and night-menu Settings switches keep their text when ON. Earlier the same day: deck load, fuel and hull read from the boat, the bubble redesign, whistle only, phone text overflow, night menus, harbour-line action, bull kelp, render recovery, taxi drive-bys and touch auto-rotate. Claude (Claude Code) develops this project; entries from October 3 and earlier were written by Codex ("Astra"). Work, exports and publication belong only to this project and [lucidfir-ops/UrchinSkipper3D](https://github.com/lucidfir-ops/UrchinSkipper3D). The 2D edition is no longer developed.

## October 8 autonomous improvement pass (branch `autonomous-improvements`, not merged)

Source: the designer's October 8 request to improve the game autonomously on a branch (never `main`), logging each change. Built on `overnight-balance`. Nothing here is designer-approved; the Bible is unchanged. Running list with reasons and commits: [IMPROVEMENT_LOG.md](IMPROVEMENT_LOG.md); record: [docs/review/autonomous-pass-2026-10-08.md](docs/review/autonomous-pass-2026-10-08.md).

- **Safety.** Taxis keep a weather-limited lookout and swerve around surfaced divers they can see (fog, night, rough water and a close surfacing stay dangerous). An earlier radio call warns 1.5–7 s before a taxi passes close to a surfaced diver. A diver aboard shouts when the boat goes astern toward a surfaced diver.
- **Balance.** Rival crews leave clumps at 30% of starting stock instead of stripping them, so marked beds outlast the first week. Hull repair costs at most half the boat's price. No landing fee on an empty trip.
- **Readability.** The voyage plan shows live ground potential and says when a map was fished hard. On wide screens its actions are paired so all seven show.
- **Audio.** Other boats are audible: one procedural engine loop with distance and Doppler, for the loudest nearby vessel.
- **Performance.** Distant floating logs drift in staggered cohorts. New Auto graphics default steps down from High on sustained slow frames; explicit choices are kept.
- **Input bug.** A key pressed just after the game suppressed input (Escape right after Continue) was lost; this was the flaky continuous-weather step.
- **Code health.** Nine unused 2D-era modules removed.
- **Tools.** `scripts/stock-model.js` (fast stock/rival model), `scripts/stress-performance.js` (night+fog+720 logs at three sizes), `scripts/voyage-plan-shots.js`.

Verification: `npm run verify -- --unit-only` passes on every commit (665 tests at `55f90c7`, 1 intentional skip). Browser suites run where relevant: continuous-weather (6/6 after the fix), input, operations, traffic-fleet, voyage, strict menu-theme. Independent screenshot review of the voyage-plan note: [record](docs/review/independent-voyage-plan-note-2026-10-08.md). Limits: performance figures use Chromium CPU throttling and the Deck GPU, not a phone; the traffic sound and the Auto-graphics notice have not been heard or seen on a real device; bot comparisons use one or two seeds.

## October 6–7 overnight balance pass (branch `overnight-balance`, not merged)

Source: the designer's overnight request of October 6 to play-test the career with a bot and tune its balance. Nothing here is designer-approved yet; the Bible is unchanged. [Record and findings](docs/review/career-balance-2026-10-06.md); [morning summary](MORNING_SUMMARY.md).

- **Career bot.** `scripts/career-bot.js` plays whole careers through the real simulation: harbour actions through the career functions, and every day sailed at 60 Hz with the real helm, physics, diver AI and recovery gates. It has three styles (cautious, average, greedy), uses only player-visible information, and logs per-day CSVs; `scripts/career-bot-report.js` summarises them. It is a weaker boat handler than a person and uses a counted docking fallback, so its catches are a lower bound.
- **Tuning (two commits).**
  - Rival daily catch goals ×0.6/1.6 (`FLEET_LIFE.goalScale`). Rivals were emptying every map's marked beds within days and the inner Home Coast maps by day 36, even with no player fishing. This reduces pressure below the September 25 level and needs designer review.
  - Quota sustainable pressure ×4, so one full-time player no longer cuts their own picking speed by a third, then nearly half.
- **Bug fix.** Saves were rejected as damaged while a nine-bird goose flock was on the map; validation now allows the largest group any species spawns. Regression test added.
- **Not changed, recommended:**
  - rival bed choice, so marked beds survive the first week;
  - taxi routes, which kill surfaced divers far too often from season 2;
  - hull repair scaled to boat price;
  - starter-boat parity: the starter outboard is the fastest boat in the game.

Verification: `npm run verify -- --unit-only` passes (652 tests, 1 intentional skip). The bot runs were headless node simulation, not browsers or devices, and no visual change was made.

## October 5 revision, v2 notes

Source: designer notes and a Firefox screen recording from the S22 in `feedback/10-5 v2/`. Decisions are recorded in the Bible (§10 deck load, §11 bubbles).

- **Deck load ghost.**
  - When a sack lands, a translucent 3D ghost of every sack still to come flashes on deck for about 1.8 s. The ghosts are at real sack size and in the real stacking layers.
  - The bottom layer flashes yellow. Layers stacked above flash pale white with an outline, so the second layer can be read over the red sacks.
  - Between landings the ghost is hidden. This replaces the resting outline rings and the flash on only the newest sack.
  - [Record](docs/review/deck-ghost-3d-2026-10-05.md).
- **Bubbles.**
  - Working upwelling, ascent boil and foam specks are at 50% opacity and 75% area.
  - Measured against the previous commit: area −22% (ascent) and −28% (working); summed brightness −57% to −61%.
  - [Record](docs/review/bubbles-lighter-2026-10-05.md).
- **Night menu switches.**
  - Troubleshooting log and Auto fullscreen turned into a blank cream panel when ON and not selected. A night "ink stamp" rule hid their own text (1:1 contrast). Settings rows are now excluded from it.
  - The menu audit now also checks both switches ON, and it fails on the old CSS.
  - [Record](docs/review/night-switch-rows-2026-10-05.md).

Independent screenshot review, two passes: [ghost, bubbles and menus](docs/review/independent-ghost-bubbles-menus-2026-10-05.md). The first pass's should-fix items, a resting haze and merged layers, led to the flash-only, two-tint ghost.

Verification:

- 650 unit tests: 649 pass, 1 intentional private-save skip, 0 fail. Lint, formatting and the production build pass.
- Browser suites on the production build (Chromium with the Deck GPU) all pass:
  - menu-theme (night and day on phone, tablet and Deck, strict) and menu-theme-firefox (phone);
  - in-world-cues, deck-load and operations (keyboard, synthetic controller, touch);
  - performance: 59.997 FPS at 1280×800 on RADV VANGOGH.
- After the review fixes, in-world-cues and deck-load were rerun and pass.

**Night flashlights (designer's answer, same day).**
- At night, divers work with flashlights or don't dive. Torch-lit bubbles and glow are now seen out to the weather's visibility, as by day, and draw above the night mist.
- The lit ascent boil is at full strength and torch-lit; working bubbles stay a faint glow. The torch's underwater glow now reaches about 10 m deep, where it used to stop at 5 m.
- Reefs and divers without flashlights keep the night limit.
- A third independent pass found no must-fix.
- `continuous-weather` sometimes times out reopening Pause after a reload: 3 of 10 runs here, and 1 of 10 on the commit before today, at the same line. It is an existing flaky step.
- [Record](docs/review/night-torch-bubbles-2026-10-05.md).

**Not yet verified.**

- The S22, tablet and Deck in person.
- A phone-size frame of the flash: at wide zoom it reads as "room left aft", but individual sacks can't be told apart.
- Whether the white upper-layer ghosts could be mistaken for bubbles in play.
- How the night glow looks in motion, and on a phone at wide zoom (the working glow is about 35 px across).
- Night bubbles are torch-green while daytime bubbles are white-grey (the torch tint is from September 30).

## October 5 revision, second notes

Source: designer notes, photos and videos in `feedback/10-5/` and the designer's answers of October 5. The designer tested only on the S22 this round. Approved decisions are recorded in the Bible (§3, §10, §11).

- **Deck load on the boat.**
  - A faint ghost outline marks where the rest of a full load will sit and flashes when a sack lands.
  - A small amber lamp on the wheelhouse roof lights when the deck is full.
  - The drawn hull settles, trims by the stern, bobs more heavily and pushes a wider wake as weight builds.
  - The boat card no longer prints a deck weight line. The Deck load gauge remains an optional card, off by default.
  - Also, as the designer asked for several cues this round (both are the agent's choices, not yet reviewed by the designer): the engine misfires on low fuel, and a badly damaged hull settles and lists.
  - [Record](docs/review/in-world-load-cues-2026-10-05.md).
- **Bubbles.**
  - Working divers now show a milky green upwelling with flattened boil patches edged by fizz, and scattered specks, modelled on the designer's photo and videos. Visibility is unchanged.
  - The ascent warning is a filled, churning white boil that grows over the diver, replacing the particle ring.
  - [Record](docs/review/diver-bubbles-2026-10-05.md).
- **Whistle only.** The recorded voice hails added earlier on October 5 are removed; surfaced divers whistle, quieter with distance. [Record](docs/review/whistle-only-2026-10-05.md).
- **Phone text overflow.**
  - Boat cards stack their preview above the text when narrow, so names and prices fit.
  - The Conditions "Wait 30 minutes" button no longer hides in an off-screen column.
  - Phone key labels fit their keys.
  - The menu audit now detects overflow and is clean on every screen: Chromium phone and tablet in both themes, and Firefox phone.
  - [Record](docs/review/phone-text-overflow-2026-10-05.md).

Independent screenshot review: [in-world cues, bubbles and menus](docs/review/independent-in-world-cues-2026-10-05.md).

Verification:

- 646 unit tests: 645 pass, 1 intentional private-save skip, 0 fail. Lint, formatting and the production build pass.
- Browser suites on the production build (Chromium with the Deck GPU; Firefox where named) all pass:
  - in-world-cues;
  - menu-theme (night and day themes on phone, tablet and Deck, strict, now including overflow);
  - menu-theme-firefox (phone);
  - deck-load, hud-context (4 layouts), operations (keyboard, synthetic controller, touch), voyage (complete career day), input, learning;
  - performance: 59.997 FPS at 1280×800 on RADV VANGOGH. After the review fixes, in-world-cues, deck-load, operations and performance were rerun and pass (59.93 FPS).

**Not yet verified.**

- The S22, Doogee tablet and Steam Deck in person: the designer's S22 test predates these changes.
- The misfire by ear.
- Whether the hull sitting lower can be seen at all. A probe at twice the settling showed no change from the game camera until water reached the deck. The trim, heavier bob and wider wake carry the cue, in motion only. The designer may prefer a stronger, non-physical cue.
- Firefox for Android itself: Playwright's desktop Firefox stood in for it.

## October 5 revision

Source: designer notes and screenshots in `feedback/10-4 v2/` and the designer's answers of October 5. Approved decisions are recorded in the Bible.

- **Night menus by default.** Menus are now a dark chart table; Settings → Picture & sound → Menu colours switches back to the Day chart paper. The last pre-redesign sea-green panels were rebuilt from theme tokens. They had left text unreadable, down to 1.05:1 contrast: Working day return, the Chandlery and boatyard detail, preview captions, map captions, the harbour footer, the coast overview chart and the touch preview. An automated audit of 37 screens in both themes on phone, tablet and Deck now finds no text below 3:1 and no teal panels. Boats in boat selection turn by drag or ← →. The offload picture is a crop of the harbour painting, lit for the arrival hour. [Record](docs/review/night-menus-2026-10-05.md).
- **Harbour line.** The on-water edge label is gone, and crossing the harbour line no longer pauses. Beyond the line with both divers aboard, a **Return to harbour** chip appears beside the boat, clear of the controls. H or Pause → Return to harbour also work. [Record](docs/review/border-return-2026-10-05.md).
- **Diver calls** (superseded the same day by whistle only, above). A surfaced diver within 35 m hailed the boat with a recorded CC0 human voice; further away they whistled. [Record](docs/review/diver-calls-2026-10-05.md).
- **Bull kelp.** Each plant is now a long stipe, an air bulb and four to six narrow blades streaming downstream, posed in closed form from tide and current in the vertex shader. Low water leaves 2.6–6 m of stipe floating; ordinary high water shows mainly bulbs and blades. Draw calls are unchanged and triangles fell slightly. [Record](docs/review/bull-kelp-2026-10-05.md).
- **Blank sea after reloading on itch.io.** The likely cause is a WebGL context lost without an event, which left the HUD and simulation running over a transparent canvas. The renderer now checks for this every frame, pauses play, and offers **Reload graphics** (save and reload). Contexts are released on unload. This was reproduced synthetically in Firefox, not on the S22. [Record](docs/review/context-loss-2026-10-05.md).
- **Water taxis** keep their speed, cadence and straight committed runs, but aim for 14–22 m drive-bys of the player's boat, clear of divers. Before, they aimed through the bubbles. [Record](docs/review/taxi-drive-by-2026-10-05.md).
- **Phone rotation.** A page cannot rotate itself outside fullscreen. On touch screens, starting play now enters fullscreen automatically, where the game allows every orientation, with a Settings switch to turn it off. [Record](docs/review/auto-rotate-2026-10-05.md).

Independent screenshot reviews: [first](docs/review/independent-october-5-2026-10-05.md) (its should-fix items were addressed the same day; see the night-menus record) and [second, kelp and fixes](docs/review/independent-kelp-and-fixes-2026-10-05.md).

**Still failing, not caused by this revision.** These failed identically on the October 4 commit, rebuilt in a separate worktree:

- browser suite `fleet`: Three.js "Could not pack varying vMapUv/vNormal" shader validation errors;
- `mobile-career`: landscape harbour pan cannot reveal the Harbour office;
- `coastal-progression`: storm frame-time limit.

**Not yet verified.** The S22, Doogee tablet and Steam Deck in person; real rotation; and whether the reload fix addresses the designer's actual trigger.

## October 4 revision

The October 3 TEMP upload broke career management on the designer's itch.io install. New Career opened Load Game, loading failed, there was no delete, and autosave reverted. One cause explains all of it: full uncompressed saves, repeated identical archives and other itch.io games sharing one site's browser storage filled the quota, so every save failed silently.

Saves are now compressed about 10×, and older saves are compacted in place at launch without losing any. Identical archives are stored once. Load Game shows storage use and an explicit, confirmed **Delete old saves…** mode. A failed save is announced at sea, and the game also saves when the page is hidden. [Cause, fix and evidence](docs/review/october-4-feedback-2026-10-04.md).

Steam Deck built-in controls should now work in a desktop browser through a new **Steam Deck controls** setting (verified with the exact key events Steam's desktop layout sends, not yet with physical buttons) (automatic on a Deck), which maps Steam's desktop keyboard/mouse layout to throttle, rudder, deploy, bag, menu and zoom. The full gamepad route is explained in Controller setup. Escape, browser/Android Back and leaving fullscreen open the menu instead of leaving the game, P also opens it, and the mouse wheel zooms.

Catch sacks stack only on open deck on every hull, including the aft-cabin landing craft. The Catalogue artwork setting is removed.

The menus are redesigned as a chart room and the HUD as a wheelhouse console, with independent visual reviews and fixes. [Interface record](docs/review/interface-redesign-2026-10-04.md).

The lost-vessel replacement fix and career speech-clearance work left uncommitted by the previous agent on October 3 are verified and included. Its pending coastal-progression rerun first exposed a fixture gap: the staged storm drifts across the harbour edge and correctly raises the return prompt, which the fixture now declines. The same suite then reaches its Frontier Bank storm frame-time check and fails it: total CPU p95 is about 100 ms against a 50 ms limit at the widest zoom in the staged storm. The last committed build (d6e635e), measured with the previous agent's `scripts/frontier-storm-diagnostic.js` in alternating runs on this Deck, gives the same ~103–107 ms p95, so this is an existing performance problem, not a regression. It is left open rather than relaxed.

Verification:

- 642 unit tests (641 pass, 1 intentional private-save skip, 0 fail); lint, formatting and production build pass.
- Final browser run on the exported build: save-storage (Chromium and Firefox), vessel-replacement (5 input modes), chart-layout, deck-load, training-preferences, keyboard-reading (Chromium and Firefox), continuous-weather, learning, operations, accessibility, hud-context (4 layouts), input, weather, voyage (300 lb landed on time) and performance (59.997 FPS at 1280×800 on RADV VANGOGH) pass.
- coastal-progression passes its permit, map, chart and depth-gauge checks, then fails only the pre-existing storm frame-time limit described above.

**October 5 update:** the designer confirmed on the physical Deck that every button works as expected in Steam's gamepad mode, with the right trackpad still acting as the mouse. Deck controls are accepted through gamepad mode; the desktop-layout key mapping was not separately accepted.

The browser right-click menu no longer opens over the game (mouse right click, a trackpad tap, the Deck's left trackpad click in gamepad mode, a touch long-press); text entry keeps it. Controller setup guidance moves to the itch.io front page by designer decision. [Record](docs/review/context-menu-2026-10-05.md).

**Not yet verified.** The desktop-layout Deck key mapping on physical buttons, the designer's Android Escape key, real-device storage, and the new look on the three physical devices.

## Design authority

The inherited [living Bible](bible.md) governs gameplay. Its September 26 amendments authorize this separate Three.js presentation and live coastal title; the September 27 commission authorizes substantial menu and HUD restructuring. The September 28 playtest commission extends equipment fitting, physical dive operations, the near-surface water column, training and navigation while preserving playtested behaviour. Preserve the orthographic following camera, exactly two autonomous divers, established information rules and original simulation geometry. Historical links in copied reference documents describe provenance in the 2D workspace, not additional active 3D requirements.

## Playable build

Keyboard readers can now Tab into named menu text panes and use arrows, Page Up/Down, Home/End and Space without triggering menu choices or helm commands. Reading focus and scroll history survive menu updates. The forecast gives an explicit keyboard hint, and Orders explains when its focused text owns the scrolling keys. Portrait almanacs stack the graph and chart; compact chart notes are reachable with keyboard and right-stick scrolling. [Implementation and browser evidence](docs/review/keyboard-reading-2026-10-03.md).

Tutorial instruments now honor individual choices, with Settings and Layout showing their actual visibility. Realistic careers receive the required time, depth, speed, throttle and fuel gauges. Migrations preserve deliberate saved choices; tutorial completion preserves Custom preset slots and explicit Controls Help choices. Training instructions use actual input bindings. Frank's scouting sounder is restored and reads real water clearance, including rock tops. [Implementation](docs/review/training-preferences-2026-10-03.md).

Frank's lesson text scrolls while its sounder and action row remain visible. Enabled tutorial instruments have clear default positions; compact keyboard crew cards clear Frank and the controls, and short touch-landscape recovery speech clears the boat and float. Saved personal layouts retain precedence. [Independent reviews and remaining visual limits](docs/review/independent-training-preferences-2026-10-03.md).

An informed agent completed all ten tutorial lessons using ordinary keyboard input on the preceding frozen build, including both recoveries, scouting, explicit harbour return and starter purchase. Full starting funds and fresh crew were verified. Read-only telemetry informed steering, so this is not unaided human-new-player acceptance. That run exposed the hidden sounder fixed above. [Complete input audit and its limits](docs/review/tutorial-completion-2026-10-03.md).

The October 3 revision fixes a fit surfaced diver stopping their shallow-water escape outside the actual pickup range. Escape now uses the same difficulty, night and assist tolerance as boarding, retaining slow physical movement, route checks and exact catch accounting. [Recovery evidence](docs/review/shoal-recovery-2026-10-03.md).

Frank's two recovery lessons now explain the observable float's actual rejection reason and preview the real Deploy/board target. When nobody can be boarded, they explicitly name the other diver that the command would deploy; eligible and ongoing boarding get different instructions. The speed-warning speech uses the recovery reason, while hidden diver information and established command targeting remain intact. The earlier [novice audit and implementation](docs/review/tutorial-recovery-2026-10-03.md) distinguish its incomplete playthrough from staged verification; the later complete informed audit is linked above.

Portrait forecasts now start with the seven-day table. Wider screens retain both columns, touch hints describe tapping/swiping, and controller hints describe the right stick. Harbour departure advice appears only during planning. Current conditions for all fifteen coasts, confidence and night advice remain available. [Implementation](docs/review/forecast-reading-2026-10-03.md), [two independent visual reviews](docs/review/independent-forecast-reading-2026-10-03.md). Verification startup now has bounded HTTP probes and a real elapsed-time deadline; the earlier unexplained post-suite exit signal remains documented separately in the [runner audit](docs/review/runner-readiness-2026-10-03.md).

The latest October 2 revision keeps weather, seven-day forecasts, storm runoff, rival fishing and destination opening dates moving during continuous multi-night voyages. Saved departure plans and voyage identities remain intact. Daily rival visitor limits, shared stock, off-map depletion and seasonal recovery advance once, including after reload and harbour return; reports show the actual day and observation time. [Implementation and regression evidence](docs/review/continuous-voyage-tutorial-2026-10-02.md), [rival accounting detail](docs/review/continuous-rivals-2026-10-02.md).

A separate novice playthrough found that Frank could approve an empty-water drop and then leave an unsuccessful diver search without retry instructions. Arrival now checks the real port entry point against usable marked ground. His instructions respond to deployment readiness, bubbles, surfaced divers and failed searches; only actual catch advances the lesson. The unchanged marked shelf and simulation geometry remain authoritative. Portrait forecasts now stack vertically, avoiding the former clipped, narrow columns. The short landscape forecast has twice the reading space, with full-size text and 44 px touch actions retained.

The October 2 revision fixes events during voyages that continue across multiple nights. New injuries retain their full absence from the actual incident date; carrying an injured diver on another voyage no longer restarts recovery. Dive exposure, taxi onboarding protections, chart observations and report ages, wildlife enforcement attention and patrol visits now follow the actual calendar. Departure-based voyage identities and once-only settlement remain intact. Ten regression cases include rescue/reload, dates crossing days 4 and 10, old/new chart reports and forty days of patrol scheduling. [Calendar defects and verification](docs/review/multi-night-calendar-2026-10-02.md).

Ocean whitecaps use irregular spacing, varied broken crests and patchy coverage in the real wind direction. The tutorial's hard rectangular water-shading cutoff is removed: the decorative seabed and depth shading continue smoothly beyond the marked playable sector, with all original survey vertices and simulation data preserved. Two separate reviewers inspected the runtime captures. [Independent ocean review](docs/review/independent-ocean-review-2026-10-02.md). Close wind strokes and kelp still look stylized; the wide low-tide cove retains a soft shallow-water halo.

The October 1 revision maps live currents from the actual connected shoreline and seabed on all fifteen career maps. Flood and ebb have separate geographic wakes, lee backflow, headland deflection and channel acceleration; tide-height layers model drying rims. Exposed late-coast races retain the existing 5-knot ceiling. All original bathymetry, fishing-bed data and habitat-authoring inputs are hash-verified unchanged. The new field is baked offline, packed losslessly and interpolated at runtime. Actual current-driven foam and weed now render in 3D; wash and bubbles also advect with simulation time, including paused and accelerated play. [Independent flow and screenshot review](docs/review/independent-current-review-2026-10-01.md).

Work lights now offer explicit OFF / AUTO / ON controls saved per boat. Standard lights retain their cost and appearance; $3,200 double-strength and $8,500 quadruple-strength packages require the previous tier plus Working/Coastal Skipper reputation. The shop explains output and fog-limited night sight. All playable edges have visible markings, with an amber harbour exit. Crossing it with both divers aboard pauses for “Return to harbour?”, initially on Cancel; only confirmation travels home. Cancellation neutralizes the helm and requires moving 12 m inward before another crossing prompts. Tutorial, save/load, keyboard, controller menus and touch share this behavior. [Independent operations review](docs/review/independent-operations-2026-10-01.md).

Harvesting divers no longer have unlimited immunity to current: holding ability, experience and fatigue determine drift, and a diver swept off ground surfaces with the conserved partial bag. Save snapshots isolate nested diver state; malformed berth identities, operation clocks and catch values cannot replace a valid backup. Bag-exchange and ladder-climb reloads land catch exactly once. Short landscape touch now hides the overlapping helm primer while recovery speech is visible.

Current approximation limits: submerged shelves deflect and resist flow, while explicit separated wakes come from drying obstacles. Closely overlapping wakes use a dominant contribution and 6 m sampling; this is a game approximation. Foam is easier to read in motion than still screenshots. Long-career lamp affordability and extreme-coast fishing balance need human playtesting.

The September 30 revision follows all four recordings in `feedback/9-30/`. Debug time advances now paint a running clock, destination and real progress, yield between simulation batches, and support stopping at the current time. Neutral forward/port work lamps replace the flat yellow ovals; actual fixture pose drives both geometry lighting and water reflection/scattering. Diver torches have attenuated underwater beams and subtly brighter visible bubbles. Kelp gathers into soft curls at slack, swings with lagging tips and re-extends into current; tide changes canopy exposure through the existing water column. The former maximum world pace becomes the new default 0%, adjustable ±100%, with existing saved physical pace preserved. Fog extinction is smoother. [Implementation and evidence](docs/review/lighting-kelp-feedback-2026-09-30.md), [independent review](docs/review/independent-lighting-kelp-2026-09-30.md).

The September 29 follow-up uses the six photographs in `feedback/9-29`: broad meadows of individually rooted eelgrass occupy 2–6 m chart-datum depths; procedural bull kelp with long stems, floats and trailing olive-brown ribbons occupies 4–10 m. Lower tide exposes more canopy, higher tide submerges shorter plants, and local current sets downstream orientation. The former upright kelp fans are removed. Water arrows are more translucent (22% opacity). Brief speech paints over Frank’s card, including top-edge overlap. Outboards, sterndrives and jet nozzles now steer with the correct stern-thrust direction. [Implementation record](docs/review/vegetation-feedback-2026-09-29.md), [independent screenshot reviews](docs/review/independent-vegetation-feedback-2026-09-29.md).

The September 29 feedback revision follows `feedback/9-28`: tutorial instruments give way to Frank and a clear working viewport, while career defaults keep five gauges, crew and controls. Pickup text is short-lived speech above Frank (or at the HUD edge in career). Tutorial and career use matching camera framing; compact touch retains its existing space above the lower controls. Saved custom layouts remain intact.

All twelve fleet cards now render the corresponding 3D model and remain stable through reload. Named boats have distinct cabin positions, hull forms, colours and source-specific deck fittings; outboards and legs turn with the rudder. Port cranes, bottle racks, timber cockpit furniture, tug winch/fenders, bow ramp, lockers, work mats and catamaran nets complement the retained ladder, tanks and crew animation. Chandlery costs stay above the purchase buttons, and the fitting locator/caption are red.

Taxi contact cannot injure on career days 1–3, can only injure through the rest of season one, and regains normal consequences afterward. Near-miss routes also avoid surfaced divers during the first three days. Current arrows sample a fixed water grid across the viewport; procedural kelp follows current and tide, including Frank’s cove. Physical boulders fade through the near-surface column, and wind drives sparse whitecaps that disappear at zero wind. Damage sheen uses irregular translucent patches instead of circular rings.

The full career, 15 physical maps, 12 career hulls, crew, controls, working-day simulation and procedural audio remain. Three.js draws all visible world geometry, with explicit profiles for all twelve career boats and twenty-five inherited traffic identities. The water is darker, greener and less transparent; kelp occupies localized stands. Divers prepare, enter, descend, work, ascend, approach the port ladder, lift their bags and climb aboard. Bodies lose colour and contrast through the water column and disappear by about five metres; physical visibility does not grant hidden status information.

Chandlery groups useful systems by purpose and previews them on a rotatable model of the actual boat. Ownership, compatibility, installation location, operating state and consequences are explicit. Engine repower and fuel management compose with the existing equipment; the hauler is available from day one. Physical stations communicate location without limiting compatible installations. A clearer ownship marker, concise task-based training, optional skipper's notes and native sound slider improve navigation and learning. Multi-night tests protect continued player control after missed offload; later daylight and shipping boundaries also work across days. [Design and implementation record](docs/review/cohesive-operations-2026-09-28.md), [independent visual critique](docs/review/independent-cohesion-review-2026-09-28.md).

Menus now share grouped preferences, consistent focus and action treatments, readable purchase previews, stable touch sliders/switches and context-preserving navigation. Compact Harbour retains the approved scenic pan with visible controls and destination cues. The HUD groups graphical instruments, named crew and contextual recovery information; compact defaults keep the boat, floats, warnings and action controls clear. Easy/Realistic entitlements and independent visibility controls remain, and saved personal layouts retain precedence. [Design and review record](docs/review/interface-redesign-2026-09-27.md).

Phaser runs headless for its existing Matter engine, audio and lifecycle. Rendering is one-way and never changes collision geometry. The 3D career key is separate; deliberate logbook imports remain supported. See [implementation](DEVELOPMENT_NOTES.md), [independent menu review](docs/review/ui-final-menu-review-2026-09-27.md) and [independent HUD review](docs/review/ui-final-hud-review-2026-09-27.md).

Build with `npm ci && npm run build`; `npm start` serves http://127.0.0.1:5184/. Development uses 5183; portable exports use 5198. Start with Frank's tutorial. WebGL 2 and hardware acceleration are required for the intended experience.

## Verification

- October 3 reading/training regression run: 617 named tests, 616 pass, zero failures and one intentional private-save skip. Lint, formatting and production build pass. Twenty added cases cover native reading ownership, focus/history, focused Frank buttons, responsive almanac scrolling, tutorial instrument placement, compact crew/speech placement, preset migration and tutorial preference persistence. The existing geography chunk remains about 3.88 MB gzip.
- October 3 reading/training production: all thirteen selected browser suites pass across the full run and a focused HUD rerun against identical game bytes. The initial run exited 1 because the custom-layout fixture captured a speech bubble before its next rendered frame; the corrected fixture waits for its actual position and exits 0. Earlier failed evidence is retained. Native keyboard reading passes in Chromium and Firefox; native browser touch and synthetic controllers cover the relevant flows. The full voyage lands 300 lb on time with 100% hull and two fit divers; the isolated 1280×800 RADV VANGOGH sample measures 60.15 FPS. [Keyboard reviews](docs/review/independent-keyboard-reading-2026-10-03.md), [training/HUD reviews](docs/review/independent-training-preferences-2026-10-03.md), [release receipt](docs/review/release-verification-2026-10-03-reading-training.json).

- October 3 regression run: 597 named tests, 596 pass, zero failures and one intentional private-save skip. Production build, lint and formatting pass. Eleven new cases cover authoritative shoal pickup tolerances, escape/boarding reloads, actual tutorial command targets, rejection reasons and hidden-information boundaries. The existing geography-chunk warning remains (about 3.88 MB gzip).
- October 3 production: shoal recovery, tutorial retry/guidance, continuous weather/forecast, operations, rival fleet, input, weather, full voyage and performance suites pass. The complete verifier exits 0. Keyboard, native browser touch and synthetic controller flows are covered. The voyage lands 300 lb on time with 100% hull and two fit divers; the isolated 1280×800 RADV VANGOGH sample measures 60.13 FPS. Two separate reviewers accept the [tutorial captures](docs/review/independent-tutorial-recovery-2026-10-03.md), retaining small-float and compact-text limitations. [Release receipt](docs/review/release-verification-2026-10-03.json).

- Latest October 2 regression run: 586 named tests, 585 pass, zero failures and one intentional private-save skip. Production build, lint and formatting pass. Twenty added cases cover continuous weather/runoff, sector access, rival accounting and tutorial retry. The existing geography-chunk warning remains (about 3.88 MB gzip).
- Latest production tutorial-retry, continuous-weather, operations, rival fleet, input, weather, full-voyage and performance checks all pass. The complete voyage lands 300 lb on time with an intact hull and two fit divers; the isolated 1280×800 RADV VANGOGH sample measures approximately 60 FPS. Keyboard, native browser touch and synthetic controller flows are covered; physical controllers remain untested. Two separate reviewers inspected the final [forecast and tutorial captures](docs/review/independent-continuous-voyage-2026-10-02.md). [Latest release receipt](docs/review/release-verification-2026-10-02-continuous.json).

- October 2 production: ocean-edge, wind-crests, boundary, operations, input, weather, full voyage and performance suites all pass. GPU readback of the served shader confirms zero whitecaps at zero wind and correct crest travel in all four wind directions. Keyboard, native browser touch and synthetic controller recovery/return pass; the complete voyage lands 300 lb on time with an intact hull and two fit divers. The isolated 1280×800 RADV VANGOGH sample measures about 60.05 FPS. [Release receipt](docs/review/release-verification-2026-10-02.json).
- October 2: full regression run passes 565 tests, zero failures, with one intentional private-save skip (566 total). Production build, lint, formatting and diff checks pass. New tests cover actual multi-night medical dates, chart observations, taxi outcomes, patrol schedules and decorative seabed continuity without editing the survey. The existing large geography-chunk warning remains (about 3.88 MB gzip).

- October 1: full unit regression run passes 554 tests, zero failures, with one intentional private-save skip. New geometry tests rotate actual T-shaped terrain through four inflow directions, test flooded/closed pools, submerged ridges, tide interpolation and late-coast danger/shelter. Deterministic generation reproduces the baked data exactly and a separate hash guards all original terrain/bed records. Production build passes; the geography chunk remains large (about 3.88 MB gzip after lossless current packing).
- October 1 final production matrix passes boundary, surface drift, work-light purchase/control/rendering, 36 coastal-current fixtures, prior lighting/kelp, diving operations, input, full voyage and performance suites. Keyboard, native browser touch and synthetic controllers are covered. The voyage lands 300 lb on time with 100% hull and two fit divers after an explicit harbour confirmation. The isolated 1280×800 RADV VANGOGH sample measures approximately 60 FPS. Lint, formatting and diff checks pass. [Release receipt](docs/review/release-verification-2026-10-01.json).

- September 30 production checks pass for clock/progress painting, a complete 30-minute advance, native touch/keyboard/synthetic-controller cancellation, saved speed, actual lamp pose/switch-off and torch attenuation. Desktop, phone portrait and landscape screenshots received independent review. A complete production voyage lands 300 lb on time with an intact hull and two fit divers. The 1280×800 controlled performance sample is approximately 59.79 FPS; a lit-scene fixture also measures approximately 60 FPS. These are not physical phone/controller acceptance.

- Full regression suite: 532 tests, 531 pass, 0 fail, 1 intentional private-save skip. Lint, formatting and production build pass; the existing large geography-chunk warning remains.
- Latest production Chromium checks pass for vegetation habitats, tide/current reversal, five propulsion configurations at three helm positions, feedback layouts, keyboard/touch input, performance and a complete career voyage. Earlier equipment, fleet and weather evidence remains in the previous release receipt. Synthetic controller coverage includes career menus and the complete voyage; it does not establish physical controller support.
- Phone 390×844, landscape touch 844×390 and desktop 1280×800 tutorial/pickup/starter captures; three reload checks preserve boat identities; speech expires after 2.6 seconds. Portrait/landscape purchase confirmations keep their detail box above the buttons.
- Frozen tide/wind fixtures show boulder depth 5/2/0.3/−1.5 m, kelp exposure at tides −1/+2/+5 m, and wind 0/5/15. Actual outboard, leg and jet transforms produce the correct stern-thrust torque at both helm extremes. In Frank’s cove the fixture contains 17,411 grass blades and 637 kelp plants; surfaced kelp counts fall from 637 to 262 to 0 at tides −1/+2/+5 m. Separate headless tests check fixed roots, exact habitat bands, flow direction and hidden-catch independence. Current lattice samples remain fixed after ownship moves. These fixtures test presentation, not natural tide timing or physical input.
- A complete career voyage lands 300 lb on time with 100% hull and both divers fit. Taxi tests cover days 1–3, 4/9 and later-season fatal risk without resetting onboarding protection. Rendering/non-mutation tests now include physical rock geometry.
- AMD RADV VANGOGH measured 240 frames in four seconds at 1280×800, approximately 59.95 FPS in the latest sample. This controlled sample is not a device-wide performance guarantee.
- Latest [independent screenshot reviews](docs/review/independent-vegetation-feedback-2026-09-29.md) drove darker kelp, smoother stipes, denser grass and varied proportions, and confirmed readable speech/current arrows. The earlier [visual review](docs/review/independent-feedback-2026-09-29.md) drove fixes to landscape Frank placement, capture timing, whitecap shape, five-metre rock contrast, wide-view current arrow readability and source-specific fleet fittings.

Reproduce the current checks with `PLAYWRIGHT_BROWSERS_PATH=.browser-cache URCHIN_READING_OUTPUT=test-results/reading-training-handoff-2026-10-03/keyboard URCHIN_TRAINING_OUTPUT=test-results/reading-training-handoff-2026-10-03/training URCHIN_WEATHER_OUTPUT=test-results/reading-training-handoff-2026-10-03/weather URCHIN_TUTORIAL_OUTPUT=test-results/reading-training-handoff-2026-10-03/tutorial URCHIN_ACCESS_OUTPUT=test-results/reading-training-handoff-2026-10-03/accessibility URCHIN_HUD_REVIEW_OUTPUT=test-results/reading-training-handoff-2026-10-03/hud-context npm run verify -- --suite=training-preferences,keyboard-reading,keyboard-reading-firefox,tutorial-retry,continuous-weather,learning,operations,accessibility,hud-context,input,weather,voyage,performance`. Local evidence is in `test-results/`; the [release receipt](docs/review/release-verification-2026-10-03-reading-training.json) records verification and export hashes. Earlier validation remains documented in the previous review records.

## Remaining acceptance

Very stale long-voyage saves may pause briefly while complete daily stock and pressure catch-up runs. Compact forecasts, almanacs and short landscape lessons require scrolling. Some compact labels remain small, and the auxiliary desktop Day 0 caption retains a partly clipped final word; main readings and action labels are clear. Compact keyboard career speech can briefly cover the boat's bow even while its centre and the selected float remain visible; the fixture's point-clearance check does not establish full-hull clearance. Deliberately moved panels may overlap other HUD because personal positions are preserved. A complete informed-agent keyboard tutorial is verified, but broader unaided human-new-player completion remains unverified.

Physical USB Xbox/Steam Deck controls, mobile device performance, Safari, actual itch.io hosting and long-career upgrade balance need human playtesting in this edition. Synthetic input does not establish physical controller behaviour. Near-surface people are recognizable close up but remain physically small at the widest orthographic zoom. Career boats now have distinct source-based fittings and layouts, but remain stylized models rather than exact raster reconstructions. Close wind crests remain sharp stylized strokes, and kelp ribbons/grass blades retain some visible repetition. The finite tutorial cove retains a soft shallow-water halo at low tide and very wide zoom. Unusual traffic artwork is interpreted rather than reproduced exactly. The presentation is deliberately stylized; completed implementation and automated checks are not full device, balance or new-player acceptance.

## GitHub backup and release workflow

Use this independent Git repository normally; never synchronize into or push the 2D repository. Selected rebuildable source, assets and essential documentation belong in Git. Dependencies, builds, private saves, browser profiles, recordings, test output and TEMP ZIPs stay outside it. New exports are additive; preserve older exports.

The latest release is under `exports/2026-10-04-saves-deck-redesign/`; the October 3 vessel-replacement TEMP that broke saves on itch.io is superseded but retained. Previously the latest was `exports/2026-10-03-reading-and-training-r2/`; all earlier dated exports, including the superseded reading-and-training trial, are retained:

- `UrchinSkipper3D-TEMP-ITCHIO.zip`: standalone HTML build for the separate 3D itch.io project; upload remains manual.
- `Urchin Skipper 3D TEMP.zip` and its extracted folder: local/Wi-Fi edition with isolated port 5198 and portable launcher.
- Both ZIPs passed CRC and production-file byte comparisons; SHA-256 sidecars are included. The extracted portable launcher served the correct 3D edition and production JavaScript successfully.

The source belongs to the independent repository's `main` branch. The production edition uses local port 5184. [Cohesive-operations verification receipt](docs/review/release-verification-2026-09-28-cohesion.json) records the tested build, browser matrix, performance sample and export hashes. The previous [interface receipt](docs/review/release-verification-2026-09-28.json) and [September 26 receipt](docs/review/release-verification-2026-09-26.json) remain as history.
