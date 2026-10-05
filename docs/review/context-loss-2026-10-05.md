# Blank sea after reloading on itch.io — October 5, 2026

Source: designer report "bug whereupon reload itch.io and the game isn't rendering", screenshot `feedback/10-4 v2/Screenshot_20261004_230038_Firefox.jpg` (S22, Firefox Android, itch.io).

## Diagnosis

The screenshot's empty area is uniformly `#143c4d`, which is the page background (`presentation.css`), not the scene background (`#53868c`). The WebGL canvas itself was not drawing, while the DOM HUD was live and the clock had advanced. A NaN camera or an unbuilt scene would still show the scene colour. An exception in the frame loop would freeze the HUD.

The game learned of a lost graphics context only from the `webglcontextlost` event. Three.js silently skips rendering while its context is lost. If the context is lost and the event never reaches the game, Firefox shows a transparent canvas: the HUD and simulation keep running, divers keep using air unseen, and there is no notice. Ways this can happen: the context is already lost at creation, a restore fails without a second event, or Firefox drops the oldest contexts on the shared itch.io origin (`html-classic.itch.zone`) during a reload.

An independent agent investigation reproduced the designer's exact image in desktop Firefox by suppressing the event. A reload alone could not be made to fail in desktop Chromium or Firefox.

## Fix

- `MarineRenderer.draw` polls `getContext().isContextLost()` every frame. A loss with or without an event shows the existing notice and pauses the simulation (`main.js` already stops on `view.contextLost`).
- If the loss lasts 3 s, the notice offers **Reload graphics**: it saves the career (`persist`) and reloads.
- After a real restore, the environment lighting map is rebuilt and shadows are refreshed. Previously the restored scene came back darker.
- On a real unload (`pagehide`, not bfcache), after saving, the main renderer and the shared fitting-preview renderer are disposed and their contexts released. A reload therefore does not compete with the outgoing page's contexts.

## Evidence

`scripts/context-loss-review.js`, suites `context-loss` (Chromium, Deck GPU) and `context-loss-firefox`: both pass.
- An ordinary loss and restore removes the notice and drawing resumes.
- A silent loss is detected, the clock stops, and Reload graphics appears.
- Reload resumes the saved career with drawing restored.

Screenshots: `test-results/context-loss-2026-10-05/`.

## Limits

The real-device trigger is inferred, not observed. The fix was not run on the S22 or on itch.io, and the loss is forced synthetically. If the blank sea recurs, the designer can turn on Troubleshooting log on the title screen (it records context events) and note whether the ship's clock was moving. Seen incidentally: desktop Firefox at 412 px wide without touch mode overlaps the keyboard-layout instrument cards. This was not changed here.
