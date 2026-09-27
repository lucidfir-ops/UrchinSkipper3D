# Urchin Skipper 3D — implementation

## One simulation, new presentation

`src/main.js` retains the original input queue, fixed 60 Hz simulation, career hooks, save validation, audio, menus and HUD. Phaser runs headless; `src/three/renderer.js` owns the sole visible WebGL canvas. Keeping the exact bundled Matter engine avoids changing the established helm calibration during the visual migration.

- `three/world.js`: physical depth sampling, tide-relative coast/bed, depth-aware water, spatially batched plants and stone. Decorative geometry never participates in contact resolution.
- `three/coastal-life.js`: driftwood and wildlife presentation from existing actor state.
- `three/vessels.js`: dimensioned hulls and working decks, family-specific drives, deck crew/catch, wakes, surface swimmers, floats and bubble-only submerged divers, traffic interpolation, lights and safety cues.
- `three/navigation.js`: known-ground outlines/labels, information legend, diagnostic chart and rotating port/stern tutorial guides, governed by existing assists.
- `three/presentation.css`: additive interface skin. `hud-defaults.js` adapts first-use desktop positions; saved player layouts and touch defaults retain precedence.

At sea the camera is rigid orthographic, north-up, following the actual vessel. The title uses a separate presentation-only world for a coastal vignette; it cannot move a player's boat, consume fuel or change a save. Tide translates the visible seabed relative to the y=0 water plane. All horizontal coordinates remain metres: Three x = simulation x; Three z = simulation y; heading zero points toward -z.

## Storage and project isolation

The 3D career key is `urchin3d-career-v1`; contents retain the original versioned save schema and validation. Only this directory and `lucidfir-ops/UrchinSkipper3D` are writable project targets. Default development/review ports are 5183/5184; portable exports use 5198. Production reuse requires the dedicated `deck-playtest-3d` HTML marker and `X-Urchin-Edition: three` header. The compact touch tutorial consumes the existing Phaser follow offset, converted into the tilted orthographic sea plane; normal following has zero offset. Never run a publication script against the 2D repository.

Generated builds, test screenshots, dependency caches and exports are ignored by Git. The selected original public assets and their copied integrity manifest remain byte-verified. Full authoring history, careers, recordings, credentials and dependencies are excluded.

## Rendering and review

High uses antialiasing, filmic tone mapping, colour-managed materials, environment lighting and soft 2048px sun shadows. Balanced/Battery reduce framebuffer resolution and shadows without altering gameplay. Terrain/forest/kelp batches use spatial culling. Browser tests must report their GPU: software WebGL timings are not physical Steam Deck acceptance.

Use stable production builds for review. Vite hot replacement can reload modules during a controller action or screenshot. `serve-build.js` caches compressed assets at launch and must restart after a rebuild; Vite preview reads the current build directly. Freeze the game loop only for static visual capture, then resume; that is not an FPS measurement.

Official implementation references: [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [colour management](https://threejs.org/manual/pages/color-management.html), [Playwright locators](https://playwright.dev/docs/api/class-locator), [screenshots](https://playwright.dev/docs/screenshots).

## Coastal presentation boundaries

The original bilinear depth grid remains the navigation authority. Water depth texels use center-correct UVs; the full submerged/intertidal mesh matches source heights within Float32 precision. Only land above 5 m receives bounded ±0.52 m decorative relief, excluding every shoreline-crossing triangle. This exceeds the exported coasts' 2.75 m maximum natural tide. Forest/fern bases follow the relief. Decorative outcrop footprints stay inside land; only `world.rocks` and `world.logs` represent physical obstacles. Kelp uses an independent deterministic distribution and cannot disclose harvest patches.

`coastal-textures.js` generates seamless granite/grit, cedar needles and irregular anisotropic ocean normal maps locally. Ocean material layers two advected normal fields, depth tint/transparency, restrained reflections and broken shoreline foam. Spatial terrain, forest, stone and kelp batches preserve density without submitting the entire coast each frame. `setVisibility(world,ui)` preserves the original reef-clarity assist and `reefRange`; physical rocks use `rockOpacity`, and timber/wildlife use `visibilityRange`.

`coastal-mist.js` reconstructs sea-level coordinates under an overhead transparent plane, compensating for orthographic view angle. Haze depends on horizontal distance from the skipper and becomes opaque at the original weather/night sight range. Camera elevation therefore cannot obscure the player's boat. Existing simulation sight limits still control actors independently. `CoastalWorld.update` receives the renderer camera; no additional fog API is needed. These views read simulation state without writing it, and own/dispose their generated textures and geometry.

## GPU verification and capture

For Steam Deck hardware review use Chromium with `--enable-gpu --use-angle=vulkan`; record `WEBGL_debug_renderer_info`, canvas framebuffer dimensions and device pixel ratio. The verified device reports AMD Custom GPU 0405, RADV VANGOGH. `--enable-unsafe-swiftshader` is a software compatibility path: it can validate shader compilation but its frame times cannot establish physical Deck performance. A 1280×800 native framebuffer at DPR 1 and a 640×400 framebuffer at DPR 0.5 are different workloads; record both dimensions instead of calling either simply "native" without context.

The initial isolated hardware receipt recorded 60 FPS at 1280×800/DPR 1 with approximately 111k submitted triangles and 68 calls; mean draw 2.20 ms, p95 draw 2.80 ms. This is a short browser measurement, not physical controller or long-session acceptance. Local receipts are in `test-results/review/performance-hardware.json` and remain untracked.

Run `scripts/three-weather-checks.js` against a current production preview using `URCHIN_TEST_URL` (or `URCHIN_URL`) and the normal `PLAYWRIGHT_BROWSERS_PATH` or optional `URCHIN_BROWSER_EXECUTABLE`. It records actual GPU identity, captures day/fog/rain/night, checks camera-to-mist alignment, source sight ranges, actor concealment and rendering non-mutation. It deliberately freezes only its disposable practice fixture; use a live loop for FPS measurements. The script's screenshots still require human/agent visual inspection. `scripts/three-performance-checks.js` records a live native-resolution sample; `--compare` adds reduced-resolution and suspended-loop comparisons.
