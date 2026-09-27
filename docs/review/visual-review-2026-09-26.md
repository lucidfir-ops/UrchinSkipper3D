# Independent visual review — September 26, 2026

This is an implementation review, not a replacement gameplay specification. The separate 3D project follows the September 26 request and retains inherited gameplay authority.

## Review method

A separate reviewer inspected actual Chromium screenshots, including the title, normal keyboard Continue flow, Frank introduction, practice water, a coast-adjacent view and an 844×390 compact window. Screenshots are in `test-results/review/`, `test-results/three/`, `test-results/three-touch/` and `test-results/three-weather/`. The review also covered actual touch navigation, both career crew panels, weather concealment, loaded decks, surface swimmers and the six-vessel gallery. Synthetic browser input does not establish physical controller behaviour.

## Corrections made after inspection

- The inherited `in-port` class initially hid the Three.js canvas on the title. The live scene is now visible behind a bounded scrolling title card; harbour menus retain the supplied artwork.
- The first intro used almost the entire screen for a short introduction. It now uses a bounded, centered panel with readable line lengths.
- Standard instrument artwork and panel styles were inconsistent. Heading, fuel, speed, depth, time and commands now share restrained navy, ivory, seafoam and brass styling. Purchased specialty clock faces remain intact.
- Desktop default instruments now align in rails, leaving more working water visible. Saved player layouts take precedence over new first-use defaults.
- Real screenshots exposed clipped action text and ground keys; these panels received additional height and more legible typography.
- A subsequent real-career screenshot exposed nitrogen telemetry clipping not present in the practice fixture. Crew defaults were enlarged to preserve full information.
- Early boat close-ups exposed flat sharp roof corners and featureless decks. The vessel agent added rounded roof geometry, restrained wear, drainage, fittings and suit details. The reviewer inspected the revised result.

## Final normal-view assessment

The final normal 1280×800 screenshots (`title-final.png`, `hud-final.png`, `coast-final.png`) show a coherent, polished stylized maritime presentation. Boats and crew read clearly; shoreline rock, moss, foliage, seabed, irregular water and the quieter instrument styling work together. The lower title-only orthographic framing shows the working vessel's volume while normal gameplay keeps its established camera. The earlier regular sparkle, blurred reflection streaks and bland shore materials were concrete defects and were revised through repeated screenshot review. This assessment does not claim photorealism or use forced praise.

A final 844×390 desktop capture exposed overlapping default HUD panels. A dedicated short-desktop arrangement now separates the helm/crew dock, top/right instruments, ground key and central action footer. The rebuilt `compact-corrected.png` verified that separation. Saved layouts remain intact.

## Touch, weather and safety review

Actual touch screenshots exposed defects that desktop and practice views did not: the central boat was obscured by action/feedback cards, the picking/quality key lost rows, and career nitrogen panels needed more space. The first-use landscape and portrait arrangements now place those panels around the working boat. Both corrected career screenshots show the full key, complete action copy and both named divers' nitrogen status; saved player layouts remain authoritative. Default 100% helm/action controls meet at least 44-pixel dimensions; inherited top utility buttons remain 38 pixels tall. Explicitly chosen smaller touch sizes, including 70% and 50%, remain available.

The compact Frank lesson exposed a separate integration fault: the hidden Phaser simulation host reported a 0×0 viewport. Its intended camera offset was therefore zero. The root agent explicitly synchronized simulation dimensions to the viewport. A fresh 844×390 runtime check then projected the boat at exactly (489.52, 132.60), the prescribed 58%/34% position, with the Frank panel 62.57 pixels to its left. The renderer now also projects the touch boat target from the visible 3D vessel. The reusable `scripts/three-touch-review.js` checks lesson framing, career telemetry, optional throttle feedback, orientation changes and touch target sizes. The first integrated run caught inherited portrait buttons shrinking to 36 pixels despite the default 100% setting; this prompted a targeted correction. A maximum-zoom browser hit test also confirmed that the invisible boat drag area intercepted the Bag control, so named control groups now stack above that target without changing their positions. Frank’s panel now has an opaque background to keep sea labels from mixing into lesson text. The final rebuilt review passed with no JavaScript or HTTP errors. It verified the lesson camera, both nitrogen panels, complete action/key copy, real full-ahead-to-neutral feedback, 44-pixel default helm/action targets and deliberate 70%/50% smaller settings. Every named control passed hit tests at three interior points at maximum legal camera zoom in both orientations. The independent reviewer inspected all three fresh images (`test-results/three-touch/touch-lesson.png`, `touch-career-landscape.png`, `touch-career-portrait.png`) and found no remaining high-impact overlap or clipping defect in those states. The receipt is `test-results/three-touch/review.json`.

Independent inspections of `three-weather/{day,fog,rain,night}.png` confirmed legible local water and convincing distant concealment. The weather contract separately verifies original sight ranges and simulation non-mutation. Final vessel images show immersed black head/shoulder swimmers, readable red net bags and distinct fleet proportions. The earlier upright tank defect was corrected. Context-loss handling was exercised: the simulation pauses, a readable recovery card appears and rendering resumes after restoration.

## Performance and runtime evidence

The apparent severe rendering stall came from Chromium's software GPU, not JavaScript simulation cost. At 1280×800, SwiftShader measured 1.56 FPS while JavaScript work averaged 6.7 ms. Disabling the game render loop restored 60 browser animation frames per second.

Using the actual AMD Custom GPU 0405 / RADV VANGOGH with headless Chromium flags `--enable-gpu --use-angle=vulkan`, the same scene sustained 59.997 FPS across 240 frames in four seconds at native resolution and enabled shadows. Frame-time p95 was 16.7 ms; mean JavaScript work was 3.75 ms. The scene reported 111,098 rendered triangles and 68 draw calls. Raw results are in `test-results/review/performance-hardware.json`, with the software comparison in `performance.json`. These measurements describe that controlled scene; they do not establish every weather, coast or device's performance.

The final five-view hardware screenshot pass produced no JavaScript page errors or HTTP failures. Earlier unidentified HTTP 404s did not recur. The focused interface/device regression passed all six checks after the default-layout changes. Physical controller behaviour remains outside this synthetic browser review.

The final release verifier repeated the hardware sample after the last touch corrections: 59.997 FPS at 1280×800 across 240 frames, 16.8 ms frame-time p95, 4.07 ms mean JavaScript work, 111,698 triangles and 70 draw calls. This reproducible sample is recorded in `test-results/three/performance.json` and the committed [release receipt](release-verification-2026-09-26.json).
