# Urchin Skipper 3D — current status

September 26, 2026 · independent Three.js edition. Work, exports and publication belong only to this project and [lucidfir-ops/UrchinSkipper3D](https://github.com/lucidfir-ops/UrchinSkipper3D). The original 2D project and repository were used read-only.

## Design authority

The inherited [living Bible](bible.md) governs gameplay. Its September 26 amendments authorize this separate Three.js presentation and live coastal title. Preserve the orthographic following camera, exactly two autonomous divers, established information rules and original simulation geometry. Historical links in copied reference documents describe provenance in the 2D workspace, not additional active 3D requirements.

## Playable build

The full career, 15 physical maps, 12 career hulls, crew, controls, working-day simulation and procedural audio remain. Three.js now draws all visible world geometry: dimensioned working vessels, individual deck sacks, surface swimmers/floats and submerged bubbles, depth/tide-aware ocean and seabed, textured rocky wooded shores, kelp, actual wildlife/traffic, weather, lights, propulsion wash and safety effects. The interface has a consistent maritime style, live title, graphics presets and responsive default layouts; personal saved layouts retain precedence.

Phaser runs headless for its existing Matter engine, audio and lifecycle. Rendering is one-way and never changes collision geometry. The 3D career key is separate; deliberate logbook imports remain supported. See [implementation](DEVELOPMENT_NOTES.md) and [independent visual review](docs/review/visual-review-2026-09-26.md).

Build with `npm ci && npm run build`; `npm start` serves http://127.0.0.1:5184/. Development uses 5183; portable exports use 5198. Start with Frank's tutorial. WebGL 2 and hardware acceleration are required for the intended experience.

## Verification

- Full regression suite: 476 tests, 475 pass, 0 fail, 1 intentional private-save skip. Lint, formatting and production build pass.
- Chromium hardware rendering and Firefox keyboard/input checks pass. Keyboard helm persistence, neutral/centre, deployment, one-press bag exchange, boarding, pause, chart and graphics persistence verified.
- Synthetic controller career purchase/departure and complete natural voyage pass: 300 lb landed on time, $84.45 net, 100% hull, both divers fit. No browser page or network errors.
- Vessel contracts cover source-exact bag positions/layers, 97-bag buffer growth, rival catch/divers, all six base families, night visibility, work-light switches, departure fading, propulsion wash and incident cues.
- Day/fog/rain/night captures and contracts pass on AMD hardware. Weather visibility, mist alignment, actor concealment and simulation non-mutation verified. Coastline/intertidal depths agree with simulation within float precision.
- Nested production subdirectory/iframe loading passes with no missing assets. WebGL context interruption/recovery was exercised: a readable pause notice appears and rendering resumes after restoration.
- Default desktop, compact touch tutorial and career phone layouts pass screenshot review. Native touch actions, 44px core controls at 100%, deliberate smaller scales, rotated layouts and maximum-zoom button hit testing pass.
- Reviewed 1280×800 and 844×390 desktop views. The measured AMD RADV VANGOGH scene sustained 60 FPS over 240 live frames at 1280×800 with shadows; this is a controlled sample, not a guarantee for every device or scenario.

Reproduce using `npm run verify`; install Playwright Chromium first. Targeted Firefox is available through `--browsers-only --suite=firefox`. Local evidence is under `test-results/`; the committed scripts recreate it. [Playtest guide](PLAYTEST_GUIDE.md).

## Remaining acceptance

Physical USB Xbox/Steam Deck controls, mobile device performance, Safari, actual itch.io hosting and long-career balance need human playtesting in this edition. Synthetic input does not establish physical controller behaviour. The presentation is deliberately stylized, with the original at-sea orthographic viewpoint.

## GitHub backup and release workflow

Use this independent Git repository normally; never synchronize into or push the 2D repository. Selected rebuildable source, assets and essential documentation belong in Git. Dependencies, builds, private saves, browser profiles, recordings, test output and TEMP ZIPs stay outside it. New exports are additive; preserve older exports.

The September 26 release is under `exports/2026-09-26-threejs-release/`:

- `UrchinSkipper3D-TEMP-ITCHIO.zip`: standalone HTML build for the separate 3D itch.io project; upload remains manual.
- `Urchin Skipper 3D TEMP.zip` and its extracted folder: local/Wi-Fi edition with isolated port 5198 and portable launcher.
- Both ZIPs passed CRC and production-file byte comparisons; SHA-256 sidecars are included. The extracted portable launcher served the correct 3D edition and production JavaScript successfully.

The source is published to the independent repository's `main` branch; the verified game implementation is [ab66c5d](https://github.com/lucidfir-ops/UrchinSkipper3D/commit/ab66c5d). The production edition is running locally on port 5184. [Release verification receipt](docs/review/release-verification-2026-09-26.json) records the tested build, browser matrix, performance sample and export hashes.
