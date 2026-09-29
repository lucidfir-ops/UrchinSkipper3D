# Urchin Skipper 3D — current status

September 29, 2026 · screenshot feedback revision of the independent Three.js edition. Work, exports and publication belong only to this project and [lucidfir-ops/UrchinSkipper3D](https://github.com/lucidfir-ops/UrchinSkipper3D). The original 2D project and repository were used read-only.

## Design authority

The inherited [living Bible](bible.md) governs gameplay. Its September 26 amendments authorize this separate Three.js presentation and live coastal title; the September 27 commission authorizes substantial menu and HUD restructuring. The September 28 playtest commission extends equipment fitting, physical dive operations, the near-surface water column, training and navigation while preserving playtested behaviour. Preserve the orthographic following camera, exactly two autonomous divers, established information rules and original simulation geometry. Historical links in copied reference documents describe provenance in the 2D workspace, not additional active 3D requirements.

## Playable build


The September 29 feedback revision follows `feedback/9-28`: tutorial instruments give way to Frank and a clear working viewport, while career defaults keep five gauges, crew and controls. Pickup text is short-lived speech above Frank (or at the HUD edge in career). Tutorial and career use matching camera framing; compact touch retains its existing space above the lower controls. Saved custom layouts remain intact.

All twelve fleet cards now render the corresponding 3D model and remain stable through reload. Named boats have distinct cabin positions, hull forms, colours and source-specific deck fittings; outboards and legs turn with the rudder. Port cranes, bottle racks, timber cockpit furniture, tug winch/fenders, bow ramp, lockers, work mats and catamaran nets complement the retained ladder, tanks and crew animation. Chandlery costs stay above the purchase buttons, and the fitting locator/caption are red.

Taxi contact cannot injure on career days 1–3, can only injure through the rest of season one, and regains normal consequences afterward. Near-miss routes also avoid surfaced divers during the first three days. Current arrows sample a fixed water grid across the viewport; procedural kelp follows current and tide, including Frank’s cove. Physical boulders fade through the near-surface column, and wind drives sparse whitecaps that disappear at zero wind. Damage sheen uses irregular translucent patches instead of circular rings.

The full career, 15 physical maps, 12 career hulls, crew, controls, working-day simulation and procedural audio remain. Three.js draws all visible world geometry, with explicit profiles for all twelve career boats and twenty-five inherited traffic identities. The water is darker, greener and less transparent; kelp occupies localized stands. Divers prepare, enter, descend, work, ascend, approach the port ladder, lift their bags and climb aboard. Bodies lose colour and contrast through the water column and disappear by about five metres; physical visibility does not grant hidden status information.

Chandlery groups useful systems by purpose and previews them on a rotatable model of the actual boat. Ownership, compatibility, installation location, operating state and consequences are explicit. Engine repower and fuel management compose with the existing equipment; the hauler is available from day one. Physical stations communicate location without limiting compatible installations. A clearer ownship marker, concise task-based training, optional skipper's notes and native sound slider improve navigation and learning. Multi-night tests protect continued player control after missed offload; later daylight and shipping boundaries also work across days. [Design and implementation record](docs/review/cohesive-operations-2026-09-28.md), [independent visual critique](docs/review/independent-cohesion-review-2026-09-28.md).

Menus now share grouped preferences, consistent focus and action treatments, readable purchase previews, stable touch sliders/switches and context-preserving navigation. Compact Harbour retains the approved scenic pan with visible controls and destination cues. The HUD groups graphical instruments, named crew and contextual recovery information; compact defaults keep the boat, floats, warnings and action controls clear. Easy/Realistic entitlements and independent visibility controls remain, and saved personal layouts retain precedence. [Design and review record](docs/review/interface-redesign-2026-09-27.md).

Phaser runs headless for its existing Matter engine, audio and lifecycle. Rendering is one-way and never changes collision geometry. The 3D career key is separate; deliberate logbook imports remain supported. See [implementation](DEVELOPMENT_NOTES.md), [independent menu review](docs/review/ui-final-menu-review-2026-09-27.md) and [independent HUD review](docs/review/ui-final-hud-review-2026-09-27.md).

Build with `npm ci && npm run build`; `npm start` serves http://127.0.0.1:5184/. Development uses 5183; portable exports use 5198. Start with Frank's tutorial. WebGL 2 and hardware acceleration are required for the intended experience.

## Verification

- Full regression suite: 522 tests, 521 pass, 0 fail, 1 intentional private-save skip. Lint, formatting and production build pass; the existing large geography-chunk warning remains.
- Production Chromium checks pass for feedback layouts, equipment, all twelve fleet models, keyboard/touch input, performance, day/fog/rain/night rendering and a complete career voyage. Synthetic controller checks cover equipment purchase/cancel and the career voyage; they do not establish physical controller support.
- Phone 390×844, landscape touch 844×390 and desktop 1280×800 tutorial/pickup/starter captures; three reload checks preserve boat identities; speech expires after 2.6 seconds. Portrait/landscape purchase confirmations keep their detail box above the buttons.
- Frozen tide/wind fixtures show boulder depth 5/2/0.3/−1.5 m, kelp exposure at tides −1/+2/+5 m, and wind 0/5/15. Actual twin outboard transforms turn together at both helm extremes. Current lattice samples remain fixed after ownship moves. These fixtures test presentation, not natural tide timing or physical input.
- A complete career voyage lands 300 lb on time with 100% hull and both divers fit. Taxi tests cover days 1–3, 4/9 and later-season fatal risk without resetting onboarding protection. Rendering/non-mutation tests now include physical rock geometry.
- AMD RADV VANGOGH measured 240 frames in four seconds at 1280×800, approximately 60 FPS. This controlled sample is not a device-wide performance guarantee.
- Separate [visual review](docs/review/independent-feedback-2026-09-29.md) drove fixes to landscape Frank placement, capture timing, whitecap shape, five-metre rock contrast, wide-view current arrow readability and source-specific fleet fittings.

Reproduce with `npm run verify -- --suite=feedback,equipment,fleet,input,performance,weather,voyage`. Local evidence is in `test-results/`; the [release receipt](docs/review/release-verification-2026-09-29-feedback.json) records verification and export hashes. Earlier September 28 validation remains documented in the existing review records.

## Remaining acceptance

Physical USB Xbox/Steam Deck controls, mobile device performance, Safari, actual itch.io hosting and long-career upgrade balance need human playtesting in this edition. Synthetic input does not establish physical controller behaviour. Near-surface people are recognizable close up but remain physically small at the widest orthographic zoom. Career boats now have distinct source-based fittings and layouts, but remain stylized models rather than exact raster reconstructions. The wide wind-crest pattern can still look regular, and kelp blades are a stylized interpretation. Unusual traffic artwork is interpreted rather than reproduced exactly. The presentation is deliberately stylized; completed implementation and automated checks are not full device, balance or new-player acceptance.

## GitHub backup and release workflow

Use this independent Git repository normally; never synchronize into or push the 2D repository. Selected rebuildable source, assets and essential documentation belong in Git. Dependencies, builds, private saves, browser profiles, recordings, test output and TEMP ZIPs stay outside it. New exports are additive; preserve older exports.

The latest feedback release is under `exports/2026-09-29-feedback/`; all September 28 and September 26 exports are retained:

- `UrchinSkipper3D-TEMP-ITCHIO.zip`: standalone HTML build for the separate 3D itch.io project; upload remains manual.
- `Urchin Skipper 3D TEMP.zip` and its extracted folder: local/Wi-Fi edition with isolated port 5198 and portable launcher.
- Both ZIPs passed CRC and production-file byte comparisons; SHA-256 sidecars are included. The extracted portable launcher served the correct 3D edition and production JavaScript successfully.

The source belongs to the independent repository's `main` branch. The production edition uses local port 5184. [Cohesive-operations verification receipt](docs/review/release-verification-2026-09-28-cohesion.json) records the tested build, browser matrix, performance sample and export hashes. The previous [interface receipt](docs/review/release-verification-2026-09-28.json) and [September 26 receipt](docs/review/release-verification-2026-09-26.json) remain as history.
