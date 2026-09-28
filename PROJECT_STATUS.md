# Urchin Skipper 3D — current status

September 28, 2026 · cohesive working-boat, diver and coastal revision of the independent Three.js edition. Work, exports and publication belong only to this project and [lucidfir-ops/UrchinSkipper3D](https://github.com/lucidfir-ops/UrchinSkipper3D). The original 2D project and repository were used read-only.

## Design authority

The inherited [living Bible](bible.md) governs gameplay. Its September 26 amendments authorize this separate Three.js presentation and live coastal title; the September 27 commission authorizes substantial menu and HUD restructuring. The September 28 playtest commission extends equipment fitting, physical dive operations, the near-surface water column, training and navigation while preserving playtested behaviour. Preserve the orthographic following camera, exactly two autonomous divers, established information rules and original simulation geometry. Historical links in copied reference documents describe provenance in the 2D workspace, not additional active 3D requirements.

## Playable build

The full career, 15 physical maps, 12 career hulls, crew, controls, working-day simulation and procedural audio remain. Three.js draws all visible world geometry, with explicit profiles for all twelve career boats and twenty-five inherited traffic identities. The water is darker, greener and less transparent; kelp occupies localized stands. Divers prepare, enter, descend, work, ascend, approach the port ladder, lift their bags and climb aboard. Bodies lose colour and contrast through the water column and disappear by about five metres; physical visibility does not grant hidden status information.

Chandlery groups useful systems by purpose and previews them on a rotatable model of the actual boat. Ownership, compatibility, installation location, operating state and consequences are explicit. Engine repower and fuel management compose with the existing equipment; the hauler is available from day one. Physical stations communicate location without limiting compatible installations. A clearer ownship marker, concise task-based training, optional skipper's notes and native sound slider improve navigation and learning. Multi-night tests protect continued player control after missed offload; later daylight and shipping boundaries also work across days. [Design and implementation record](docs/review/cohesive-operations-2026-09-28.md), [independent visual critique](docs/review/independent-cohesion-review-2026-09-28.md).

Menus now share grouped preferences, consistent focus and action treatments, readable purchase previews, stable touch sliders/switches and context-preserving navigation. Compact Harbour retains the approved scenic pan with visible controls and destination cues. The HUD groups graphical instruments, named crew and contextual recovery information; compact defaults keep the boat, floats, warnings and action controls clear. Easy/Realistic entitlements and independent visibility controls remain, and saved personal layouts retain precedence. [Design and review record](docs/review/interface-redesign-2026-09-27.md).

Phaser runs headless for its existing Matter engine, audio and lifecycle. Rendering is one-way and never changes collision geometry. The 3D career key is separate; deliberate logbook imports remain supported. See [implementation](DEVELOPMENT_NOTES.md), [independent menu review](docs/review/ui-final-menu-review-2026-09-27.md) and [independent HUD review](docs/review/ui-final-hud-review-2026-09-27.md).

Build with `npm ci && npm run build`; `npm start` serves http://127.0.0.1:5184/. Development uses 5183; portable exports use 5198. Start with Frank's tutorial. WebGL 2 and hardware acceleration are required for the intended experience.

## Verification

- Full regression suite: 518 tests, 517 pass, 0 fail, 1 intentional private-save skip. Lint, formatting and production build pass.
- Chromium hardware rendering and Firefox keyboard/input checks pass. Keyboard helm persistence, neutral/centre, deployment, one-press bag exchange, boarding, pause, chart and graphics persistence verified.
- Synthetic controller career purchase/departure and complete natural voyage pass: 300 lb landed on time, 100% hull, both divers fit. No browser page or network errors.
- Vessel contracts cover source-exact bag positions/layers, 97-bag buffer growth, rival catch/divers, all twelve career profiles, twenty-five traffic profiles, night visibility, work-light switches, departure fading, propulsion wash and incident cues.
- Day/fog/rain/night captures and contracts pass on AMD hardware. Weather visibility, mist alignment, actor concealment and simulation non-mutation verified. Coastline/intertidal depths agree with simulation within float precision.
- Nested production subdirectory/iframe loading passes with no missing assets. WebGL context interruption/recovery was exercised: a readable pause notice appears and rendering resumes after restoration.
- Default desktop, compact touch tutorial and career phone layouts pass screenshot review. Native touch actions, 44px core controls at 100%, deliberate smaller scales, rotated layouts and maximum-zoom button hit testing pass.
- Eighteen production Chromium suites pass: the thirteen retained checks plus equipment, learning, diver operations, career fleet and traffic fleet reviews. These exercise purchase/cancel/fit, native volume input, chart markers, all boat previews, actual diver commands and frozen depth/phase presentation fixtures. The final HUD rerun replaces a fixed-delay fixture race with waiting for its actual rendered result; the release receipt preserves that follow-up separately. Static captures receive separate visual review and are not treated as animation or physical-input proof.
- Independent reviewers inspected equipment, all twelve/twenty-five boat galleries, depth/phase captures, chart, lessons, volume and underwater crew information. They caught and drove corrections to water banding, misleading equipment actions, duplicate recovery overlays, clipped labels and invalid screenshot fixtures. Separate CPU review reproduced and verified three final physical continuity fixes; interrupted catch transfer and old saves remain correct. Saved custom window rectangles retain precedence over default layout changes.
- Reviewed 1280×800 and 844×390 desktop views. The measured AMD RADV VANGOGH scene sustained 60 FPS over 240 live frames at 1280×800 with shadows; this is a controlled sample, not a guarantee for every device or scenario.

Reproduce using `npm run verify`; install Playwright Chromium first. Targeted Firefox is available through `--browsers-only --suite=firefox`. Local evidence is under `test-results/`; the committed scripts recreate it. [Playtest guide](PLAYTEST_GUIDE.md).

## Remaining acceptance

Physical USB Xbox/Steam Deck controls, mobile device performance, Safari, actual itch.io hosting and long-career upgrade balance need human playtesting in this edition. Synthetic input does not establish physical controller behaviour. Near-surface people are recognizable close up but remain physically small at the widest orthographic zoom. Some commercial hulls share a family silhouette, and unusual traffic artwork is interpreted rather than reproduced exactly. The presentation is deliberately stylized; completed implementation and automated checks are not full device, balance or new-player acceptance.

## GitHub backup and release workflow

Use this independent Git repository normally; never synchronize into or push the 2D repository. Selected rebuildable source, assets and essential documentation belong in Git. Dependencies, builds, private saves, browser profiles, recordings, test output and TEMP ZIPs stay outside it. New exports are additive; preserve older exports.

The latest cohesive-operations release is under `exports/2026-09-28-cohesive-operations/`; the earlier September 28 interface and September 26 exports are retained:

- `UrchinSkipper3D-TEMP-ITCHIO.zip`: standalone HTML build for the separate 3D itch.io project; upload remains manual.
- `Urchin Skipper 3D TEMP.zip` and its extracted folder: local/Wi-Fi edition with isolated port 5198 and portable launcher.
- Both ZIPs passed CRC and production-file byte comparisons; SHA-256 sidecars are included. The extracted portable launcher served the correct 3D edition and production JavaScript successfully.

The source belongs to the independent repository's `main` branch. The production edition uses local port 5184. [Cohesive-operations verification receipt](docs/review/release-verification-2026-09-28-cohesion.json) records the tested build, browser matrix, performance sample and export hashes. The previous [interface receipt](docs/review/release-verification-2026-09-28.json) and [September 26 receipt](docs/review/release-verification-2026-09-26.json) remain as history.
