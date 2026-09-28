# Paused at the designer's request

Historical checkpoint: the designer subsequently requested resumption. The
[completed redesign review](interface-redesign-2026-09-27.md) and
[release verification](release-verification-2026-09-27.json) supersede the
paused state described below.

The designer asked “Pause when you get a chance.” Work is paused, not complete.
All source edits are saved in the working tree. No commit, push or new TEMP
exports have been made for this redesign. Resume only when requested.

## Current state

Read PROJECT_STATUS.md and AGENTS.md first. The active task is a complete menu
and HUD overhaul with independent critics, preserving all gameplay, controls,
navigation history, Easy/Realistic information boundaries and saved layouts.

New presentation files: `src/interface-theme.css`, `src/menu-polish.css`,
`src/menu-shell.js`, `src/menu-preferences.js`, `src/wheelhouse.css`.
Associated menu, touch/assist, HUD, input-focus and layout files are modified.
Main imports are installed. Main also has a portrait tutorial camera offset;
orthographic following and simulation coordinates remain unchanged.

Implemented: grouped title/Settings/Pause, compact Cancel-first purchase dialog,
vessel preview cards, stable information switches and touch sliders, spatial
controller navigation, native Tab/Enter/Space focus synchronization, held-pointer
protection against DOM replacement, nested scroll restoration, graphical gauge
rail, named crew cards and adaptive phone layouts. Ordinary menus hide the
underlying HUD; Arrange UI retains previews.

## Verification already performed

- A regression run before the latest refinements: 477 tests, 476 pass, one
  intentional private-save skip, zero failures. `/tmp/urchin-ui-tests.log`.
- Production builds succeeded. Lint and format passed before the last changes.
- `scripts/interface-review.js` passed the complete snapshot2 run including a
  held purchase click, native focus activation, harbour navigation, at-sea Back,
  Realistic identity-only portraits, All Off, synthetic controller paths and
  native touch events with core 44px targets.
- `scripts/ui-accessibility-checks.js` passed against snapshot2 in Chromium and
  Firefox: stable controls during focus/held click/drag, persisted preferences,
  adjacent phone explanations, and physical 44px menu targets/sliders.
- Root and separate agents inspected screenshots. The reviewers still found
  issues; this is not final visual acceptance or physical-device verification.

Screenshots/results live under `test-results/ui-overhaul/iteration1`,
`iteration2`, `accessibility-final`, `accessibility-firefox`, and `hud-pass`.
`early-integration` is explicitly contaminated by concurrent source edits, NOT
a clean baseline. The older `review` folder also mixes interrupted runs.

The interface script's page-error listener was corrected after the snapshot2
run (attach in ready(page), not browser.on('page')); rerun it for final evidence.
The accessibility scripts did attach page-error listeners correctly and passed.

## Saved changes newer than snapshot2

- Menu preferences extracted to shared `menu-preferences.js` so the newly
  exposed title Settings also works in explicit prototype/practice worlds.
- Starter difficulty moved beside the persistent Buy footer to remain visible.
- Settings spacing tightened further to avoid the final row clipping at 800px.
- Duplicate legacy preference rendering removed. New prototype regression added.
- HUD touch helper shortened to gesture guidance, full-width touch crew strip,
  compact landscape Frank panel/padding fixes, and final portrait spacing.
- Menu agent's final targeted test/lint command was already running when paused
  (exec session 72282); result was not collected by root.

## Remaining review / work

1. Inspect latest diffs for unfinished edits, format/lint, rebuild and restart
   the production server, then rerun full regression and interaction suites.
2. Continue the harsh HUD review: the boat card duplicates standalone metrics;
   its command line sits too close to the bottom border; recovery prompt hierarchy
   is too shouty and duplicates crew details; Realistic's hidden middle gauges
   leave a disconnected gap; selected portrait focus can make a double gold edge.
   The HUD agent proposed fallback-only duplicate readings, a calmer recovery
   heading, and packing enabled *default* gauges while preserving saved positions.
   It was interrupted before implementing those proposals. Do not assume done.
3. Reinspect phone tutorial/help and compact landscape Frank/control clearance;
   test actual keyboard dock, not only a mouse-started HUD. Review updated starter
   difficulty and final Settings spacing. Get separate reviewers to inspect the
   final screenshots and update `docs/review/ui-review-2026-09-27.md` honestly.
4. Run existing keyboard/touch browser suites and a natural synthetic-controller
   voyage, plus final npm test/build. Physical controllers/mobile remain untested.
5. Update PROJECT_STATUS, verification receipt and review notes; create additive
   dated web/local TEMP exports using scripts/package-temp.py; verify them.
6. Commit and push ONLY this repository when complete, as AGENTS.md requests.

## Runtime / tooling notes

Dev server was left on 5183; snapshot2 production server on 5186. They may need
restarting after a daemon restart. `serve-build.js` precompresses HTML at startup:
**restart it after each build** or stale HTML requests removed asset hashes.
This caused one invalid startup attempt, not a game regression.

Playwright Chromium153 and Firefox155 are installed in `.browser-cache`.
Use `PLAYWRIGHT_BROWSERS_PATH=.browser-cache`. Browser launch and production
server sockets require escalated exec in this environment. Regression server
tests likewise pass outside the sandbox; use `npm test -- --test-concurrency=2`
to avoid unnecessary resource pressure. Browser examples use GPU Vulkan args.

The two untracked title PNGs under assets and `how to talk to astra.txt` predate
this work; preserve them and do not sweep them into the UI commit accidentally.
