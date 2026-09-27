# Troubleshooting and external research — September 10, 2026

Policy: diagnose our gameplay locally, make a supported fix and test it. For uncertain platform/framework/tool behavior, consult current primary documentation before repeated experiments. Record the actual package/version and successful remedy. Do not turn a platform-input problem into a speculative rewrite of working game commands.

## Steam Deck native input — package/physical follow-up remains open

The designer identifies USB Xbox as the working test controller. No Steam, Flatpak, device or browser permission settings were changed this pass. The project launcher currently selects native Firefox, falling back to `org.mozilla.firefox`; that does not establish which browser was used in the unsuccessful native-Deck playtest.

[Microsoft's Steam Deck/Edge guidance](https://support.microsoft.com/en-us/edge/xbox-cloud-gaming-in-microsoft-edge-with-steam-deck) explicitly gives read-only `/run/udev` access to the **Edge Flatpak**, and launches it through Steam with a gamepad template. This supports the designer's research lead. Applying the same remedy to the actual Chromium/Firefox installation remains an inference requiring package-specific verification.

[Flatpak permissions documentation](https://docs.flatpak.org/en/latest/sandbox-permissions.html) describes filesystem access and input-device permissions, including version-dependent device options. `/run/udev` metadata access and `/dev/input` device access are different concerns.

For the dedicated future investigation: identify the installed/running browser and Flatpak ID, inspect existing permissions and Flatpak version, consult that package's current guidance, then test a scoped change through Steam's actual shortcut and gamepad layout. Do not copy the Edge package name into a Firefox/Chromium command or grant broad filesystem/device access speculatively. Verify with real physical button/stick activity, not just a detected virtual device.

## Ocean convergence reference

[MIT's May 26, 2020 TRAPS article](https://meche.mit.edu/news-media/search-and-rescue-algorithm-identifies-hidden-%E2%80%9Ctraps%E2%80%9D-ocean-waters-0) describes identifying transient attraction structures from ocean velocity information and validating predictions with drifting objects. It is a conceptual reference, not code or a requirement to reproduce the algorithm.

The prototype authors flood/ebb fields, damped island lee zones and rotational/convergent residual flow. Foam and floats simply integrate their local velocity. There is no invisible collection-point teleport, no TRAPS extraction and no CFD. Tests check local convergence by inward radial velocity. These are plausible visual/gameplay approximations, not validated oceanography.

## Real data direction

[CHS NONNA portal](https://www.charts.gc.ca/data-gestion/nonna/index-eng.html) provides non-navigational bathymetric data. [CHS licensing guidance](https://cartes-charts.gc.ca/copyright-droitdauteur/index-eng.html) distinguishes products and their terms; do not assume every CHS product shares one licence. The [NONNA FAQ](https://api-proxy.edh-cde.dfo-mpo.gc.ca/catalogue/records/d3881c4c-650d-4070-bf9b-1e00aabf0a1d/attachments/CHS_NONNA_Data_Portal_FAQ_en.pdf) describes the chart-datum vertical reference. A future importer must retain both horizontal projection and vertical datum and reconcile sea-level offsets with that datum.

No GIS data was downloaded, licence accepted, or real fishing location encoded this pass. Port McNeill–Kelsey Bay / north and east of Johnstone Strait is a future region of interest, not the geography of these synthetic maps.

## Tooling findings

The environment's execution sandbox prevents headless Chromium startup (`sandbox_host_linux.cc`, operation not permitted) and can prevent the launcher's loopback companion tests. Run the existing approved browser/test commands outside that execution sandbox; do not change the user's browser/Steam configuration to fix an automation sandbox error. Browser rendering is tested using the installed Phaser 4.2.1 and Playwright Chromium. Matter contact velocity updates were checked against Phaser's bundled `lib/body/Body.js`; the existing fixed 60 Hz unit conversion was retained.

## Active controller identity — playtest-feedback pass

[MDN Gamepad.mapping](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/mapping) distinguishes browser-standardized from raw layouts. [MDN Gamepad.id](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/id) documents the browser-exposed identifier. These support per-exposed-device profiles and explicit mapping of unknown gameplay controls, not guessing raw Deck axes.

[Valve gamepad-emulation best practices](https://partner.steamgames.com/doc/features/steam_controller/steam_input_gamepad_emulation_bestpractices) explains virtual-controller emulation and physical-origin support through native Steam Input. The browser may see a virtual Xbox device or keys; reliable original hardware/paddle identification is unavailable here. The game therefore reports what is observed, preserves the existing profile and offers a physical X/Y action verifier. It does not claim to disable desktop exit shortcuts or repair Steam's global layout.

For an unexpected automation disconnect, [Playwright crash events](https://playwright.dev/docs/api/class-page#page-event-crash), [browser disconnection events](https://playwright.dev/docs/api/class-browser#browser-event-disconnected) and [debugging guidance](https://playwright.dev/docs/debug) distinguish page exceptions from browser-process loss and support bounded diagnostic reruns. One transient run disconnected without a recorded page exception; its bounded rerun passed. This is not evidence of a fixed physical-browser problem.

## Firefox cold-start enumeration — 2026-09-11

The actual installed `org.mozilla.firefox` metadata grants `devices=all` but no `/run/udev` filesystem access; the user's override only grants Plasma browser integration. [Mozilla's Linux backend](https://raw.githubusercontent.com/mozilla/gecko-dev/master/dom/gamepad/linux/LinuxGamepad.cpp) calls `ScanForDevices()` at startup and filters devices through the udev `ID_INPUT_JOYSTICK` property. Hotplug uses a separate udev event path. This supports the diagnosis that missing udev metadata causes the reported startup/reconnect asymmetry.

Read-only `flatpak run --command=sh` checks: `/dev/input/event18` was readable, `/run/udev/data/c13:82` hidden. Adding the launch-only `--filesystem=/run/udev:ro` made both readable. The launcher now includes that scoped flag. [Flatpak's permissions reference](https://docs.flatpak.org/en/latest/sandbox-permissions.html) distinguishes filesystem and device grants. No persistent override or global Steam layout was changed.

[MDN's Gamepad guide](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API) explains that Firefox still requires a visible-page controller interaction to expose existing pads. Register connection events early, poll fresh snapshots, preserve release gating, and expect a first physical button press. Reconnection should no longer be required for metadata enumeration. Actual Game Mode button routing remains to be physically checked.

## Steam library art — 2026-09-11
[Valve library asset guidance](https://partner.steamgames.com/doc/store/assets/libraryassets) specifies 600×900 capsule, 920×430 header, 3840×1240 hero and a transparent logo 1280 px wide and/or 720 px high. Hero art is text-free with separate logo placement. The original `scripts/brand-art.js` exports use those formats; title art has its own wide composition.


## Video / transcript UI feedback — 2026-09-11

Primary guidance reviewed: [Microsoft XAG 112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112), [XAG 113](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/113), and [Valve hardware recommendations](https://partner.steamgames.com/doc/steamhardware/recommendations). Applied consistent directional focus, visible selection, reachable Back and controller access to routine flows. Implementation decisions and limited fishery-reference use are recorded in [feedback implementation](FEEDBACK_IMPLEMENTATION.md#reference-use).

## Second video tooling pass

[Playwright browser guidance](https://playwright.dev/docs/browsers) was consulted for matching installed browsers to Playwright versions and checking Chromium plus Firefox. [ESLint flat configuration guidance](https://eslint.org/docs/latest/use/configure/configuration-files) informed the small project lint configuration. Existing game/framework behaviour was diagnosed against installed Phaser/Matter and project tests. Vite's versioned static-deployment page failed in the web reader; the existing production-build guidance and local build output remained sufficient for serving `dist` through the loopback-only Node server.

Updated development tools are Vite 7.3.6 / Playwright 1.63.0. The package audit reports zero known vulnerabilities after the compatible updates. Test-browser Firefox is a Playwright build; it provides engine coverage, not proof of the installed Firefox Flatpak's physical Game Mode routing.


## September 15 itch.io TEMP and fullscreen

[itch.io HTML5 upload guidance](https://itch.io/docs/creators/html5) requires a ZIP entry point, relative asset paths and case-correct filenames, and documents iframe/mobile/fullscreen options and archive limits. The packager validates a root index.html, count/path/size limits and byte hashes. The browser suite serves a strict nested path and a separate-origin iframe. Actual publication is still a designer follow-up.

[MDN Fullscreen guide](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide) documents user-initiated requests, iframe permission and unsupported/rejected requests. The touch button handles completion, exit, failure and browser fullscreen-change events.

[Playwright actionability](https://playwright.dev/docs/actionability) requires a stable element for locator taps. [Touchscreen.tap](https://playwright.dev/docs/api/class-touchscreen) sends a coordinate touch to the intentionally moving boat; the test then checks real queued helm behavior.


## Keyboard shortcuts — September 15

[Mozilla keyboard shortcuts](https://support.mozilla.org/en-US/kb/keyboard-shortcuts-perform-firefox-tasks-quickly) distinguishes Escape/stop, browser navigation and modified shortcuts. The physical report alone does not establish which event that keyboard emits. [MDN KeyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) documents modifier-aware values and cancelling default behavior. Input protection runs in capture phase, covers keydown/keypress/keyup where delivered, preserves form editing and leaves modified chords available.

[MDN requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen#keyboard_locking) documents `keyboardLock: 'browser'`, cancellation with `preventDefault()`, unsupported-mode rejection and reserved escape routes. The game requests this option for its own fullscreen and falls back when unsupported. Chromium can additionally use [Keyboard.lock](https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/lock) scoped to Escape; rejection leaves ordinary fullscreen usable. Its availability and behavior depend on the browser; this is not a global OS/Steam shortcut change or proof that a physical Escape macro reaches the game.

[Playwright actionability](https://playwright.dev/docs/actionability) does not wait for game-specific input gates, and keyboard presses do not have the same actionability checks as clicks. [waitForFunction](https://playwright.dev/docs/api/class-page#page-wait-for-function) supports explicitly waiting for the game's release state; no production gate was removed to accommodate a synthetic press.

## September 16 phone menus

[MDN CSS zoom](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/zoom) describes layout-aware content scaling, used for menu/title scale with inverse viewport dimensions. [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) describes native gesture ownership: menus allow panning; helm gestures stay owned by game controls. Checked September 16, 2026; actual Chromium/Firefox rendered and gesture checks remain the acceptance evidence.

## September 16 HUD gestures

Rechecked [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) during native portrait swipe diagnosis: gesture ownership intersects the touched node and ancestors through the scrolling element. Hit-target tracing then isolated the local pointer-events specificity issue described in [failure notes](FAILURE_NOTES.md#september-16-hud-windows). Scrolling regions permit native pan; corner grips retain pointer capture and `touch-action: none`.

## September 22 phone orientation and preparation

[MDN ScreenOrientation.unlock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/unlock) resets the document orientation restriction, subject to embed/security constraints. The game calls it on installation and fullscreen changes; it cannot override the operating system or an itch parent frame's orientation choice. [itch HTML5 upload guidance](https://itch.io/docs/creators/html5) describes mobile-friendly/fullscreen hosting. The dated upload notes request any orientation. Physical phone rotation still needs a hosted-device check.

Installed Phaser `Graphics.generateTexture`, `CanvasTexture.refresh` and Canvas renderer code were inspected for retained command replay, pixel readback and texture updates. [Official Graphics guidance](https://docs.phaser.io/phaser/concepts/gameobjects/graphics) supports baking repeated drawing, but measured animated WebGL uploads were slower here. The renderer-specific result is recorded in the release evidence.

## September 23 tablet, audio and rotation

[DOOGEE's Tab E3 Max specifications](https://uk.doogee.com/products/tab-e3-max) list G100/MT8781, 8 GB physical LPDDR4X plus extended memory, and a 2160×1440 display. [MediaTek's Helio G100 specifications](https://www.mediatek.com/products/smartphones/mediatek-helio-g100) give the CPU/GPU configuration. These support a plausible target assessment, not a device performance measurement. [Full report](DOOGEE_TAB_E3_MAX_REPORT_2026-09-23.txt).

The [Phaser WebAudioSound API](https://docs.phaser.io/api-documentation/class/sound-webaudiosound) and installed `calculateRate`/`createAndStartLoopBufferSource` implementation establish the rescheduling path. Actual before/after browser source counters establish the improvement; they do not establish an audible cure on Android.

Rechecked [MDN orientation unlock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/unlock), the [Screen Orientation specification](https://www.w3.org/TR/screen-orientation/) and [itch HTML5 hosting guidance](https://itch.io/docs/creators/html5). Event-driven recovery leaves OS/browser/host restrictions intact. [Playwright setViewportSize](https://playwright.dev/docs/api/class-page#page-set-viewport-size) also changes the screen dimensions; its Chromium implementation cannot resize an active native fullscreen window in this environment. The acceptance fixture checks host fullscreen separately at each viewport.

## September 24 rotation follow-up

The [Screen Orientation specification](https://www.w3.org/TR/screen-orientation/) distinguishes `unlock()` (restore default, possibly a host/browser orientation) from `lock('any')` (allow every supported orientation), and documents fullscreen/security preconditions. [MDN lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock) describes availability and rejected requests. [MDN display-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/display-mode) documents the fullscreen media query used to identify an already-fullscreen embed without accessing its cross-origin parent. [itch HTML5 guidance](https://itch.io/docs/creators/html5) describes mobile click-to-launch fullscreen. The [2017 itch mobile-host update](https://itch.io/updates/better-support-for-mobile-html-games-more) is historical evidence of host orientation choices, not verification of today's parent implementation. The chosen fallback reproduces the recording's successful child Fullscreen transition automatically on a trusted touch. Browser acceptance simulates orientation permission; it does not emulate a physical Android sensor.

For the Firefox fixture failure, rechecked [Playwright setViewportSize](https://playwright.dev/docs/api/class-page#page-set-viewport-size) and [MDN exitFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Document/exitFullscreen). An isolated local browser diagnostic established the actual headless display behavior; the documentation alone does not assert this implementation-specific size.

## September 24 Android test access

For the now-confirmed Firefox tablet, [Mozilla's Android remote-debugging guide](https://firefox-source-docs.mozilla.org/devtools-user/about_colon_debugging/index.html#connecting-to-a-remote-device) documents Android USB debugging, Firefox's Remote Debugging via USB setting, device authorization and desktop Firefox's `about:debugging` connection. Mozilla's [remote-debugging smoke flow](https://firefox-source-docs.mozilla.org/devtools/release.html#debug-targets) documents recording with **Profile Performance** on the connected runtime. This allows the game to run on the physical tablet while development stays on the computer. The connection and resulting profile still need to be obtained; no Android performance result is implied.

[Chrome's official Android remote-debugging guide](https://developer.chrome.com/docs/devtools/remote-debugging) documents device approval, USB/Wi-Fi debugging and the ADB/CDP connection for testing a physical Android browser from a computer. Screencasting can affect timing; disable it during FPS profiling. No device was connected or reconfigured in this pass. [OpenAI CLI documentation](https://learn.chatgpt.com/docs/codex/cli) lists desktop installation routes; [Codex Remote](https://learn.chatgpt.com/docs/remote) controls work on another machine. The checked official pages did not establish Android-native execution or Android Remote availability; neither is claimed.
