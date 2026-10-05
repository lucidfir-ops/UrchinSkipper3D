# October 4 designer feedback — saves, Deck controls, bags, menus

Source: the designer's October 4 notes after uploading the October 3 TEMP build to itch.io, with `feedback/10-4/` (one Firefox for Android screen recording, one screenshot; kept outside Git).

## Saving and loading

**Report:** New Career opened Load Game; loading did not work; there was no way to delete saves; leaving the game to write notes and returning restored an older save.

**Cause.** One failure explains all four. The recording shows twelve restore points (several identical "$20,000 · day 0" careers) and, after choosing one, "Save unavailable. Current career retained." New Career and every load first save the current career (`changeCareer` → `persist`). When that write throws, New Career deliberately falls back to Load Game with the notice, loading is refused, and autosave fails silently at sea, so the next launch restores the last save that fit.

The write failed because browser storage was full. A career that has visited the coasts encodes to about 600 KB, mostly its stock ledger. The game stored the live save, its rolling backup, a start-of-day snapshot each day, and a full archive copy on *every* load or new career, even when identical. Browsers allow roughly 5 MB per site, and every itch.io HTML game, including the 2D edition, shares the same site storage.

**Fix.**
- Save envelopes are now version 2: the JSON payload is deflated with fflate (MIT) and base64-encoded. The checksum still covers the uncompressed payload. A fully travelled career shrinks from 602 KB to 63 KB. Encoding takes about 30–50 ms on the Deck CPU and still runs in the existing save worker during autosave. Version 1 saves remain readable.
- At launch, `compactSaves` rewrites every readable v1 save in place as v2. Each one is verified first, and its payload is unchanged. Unreadable entries are left untouched.
- `archiveCareer` reuses an existing restore point with the same checksum instead of storing another copy.
- If the live save hits the quota, it removes only its own rolling backup and retries. A real failure now returns `storageFull` with an actionable reason, and at sea a "SAVE FAILED" notice appears at most once a minute.
- The game also saves when the page becomes hidden (`visibilitychange`), because mobile browsers often background a tab without firing `pagehide`.
- Load Game:
  - Labels: career tag, day, cash, boat, kind and the time the save was archived.
  - Storage readout: this game's usage and the whole site's usage against about 5 MB.
  - A **Delete old saves…** mode. Each delete asks for confirmation, starting on Cancel. The live save and its backup cannot be deleted from this list.

The Bible's rule against *automatic* pruning of unique snapshots is unchanged.

**Evidence.** `tests/save-storage.test.js`:
- Exact compressed round trip, and tamper detection.
- A quota-filled store of legacy restore points (reproducing the report) where the live save still succeeds. Compaction keeps every key and shrinks the store below a quarter of the quota.
- Backup-yielding under a tight quota.
- Archive deduplication.
- Protected deletion.
- A completely full store reporting a clear storage-full reason.

`tests/career.test.js` now expects deduplicated rather than duplicate archives. Tests that compared raw envelopes, and three browser fixtures that parsed `envelope.payload`, now read saves through `readSnapshot`, which is exposed to fixtures as `urchinDebug.readSave`.

**Limits.** The designer's real phone storage was not available. Storage readouts are estimates; browsers do not report the real quota for `localStorage`. A completely full site store (for example, filled by other itch.io games) still cannot be saved into until the player deletes restore points. The game now says so instead of failing silently.

## Steam Deck built-in controls in a browser

**Investigation on this Deck.** The machine was in Desktop Mode, with Flatpak Firefox 156 as the only browser.
- The built-in controller (`28de:1205`) shows up to the system only as a keyboard and a mouse.
- Steam's virtual pad (`28de:11ff`) appears only when a Gamepad controller template is active.
- Steam's default desktop layout (`desktop_neptune.vdf`) sends:

| Deck control | Sends |
|---|---|
| D-pad and left stick | Arrow keys |
| A | Enter |
| B and ☰ | Escape |
| Y | Space |
| View | Tab |
| L1 | Left Ctrl |
| R1 | Left Alt |
| Back grips | Shift, Meta, Page Up, Page Down |
| Left trackpad | Scroll wheel |
| Right trackpad, R2/L2 | Mouse movement and clicks |

- The Flatpak sandbox also hides `/run/udev`, which Firefox needs to find gamepads at all.

Previously, arrows fired the bow/stern thrusters, L1/R1 counted as Ctrl/Alt shortcuts (clearing input), and the Shift back grip toggled information levels.

**Fix.**
- `src/deck-controls.js` adds a **Steam Deck controls** setting (Auto/On/Off). Auto detects a Linux browser with a Deck screen or a Valve pad.
- When active, the setting changes these keys:
  - Arrows set throttle and rudder.
  - Lone Left Ctrl and Left Alt act as deploy/board and bag. Their browser default, the Firefox menu bar, is prevented.
  - Shift no longer toggles debug or information.
  - Menus keep the arrow keys.
- The mouse wheel / left trackpad zooms for every player.
- Controller setup explains both this mode and the full gamepad path: launch the browser from Steam with the Gamepad template, plus a one-time `flatpak override --user --filesystem=/run/udev:ro org.mozilla.firefox`.

**Limits.** These are keyboard-event and unit tests. No physical button press on the Deck has been verified; that remains the designer's acceptance. Whether Steam's virtual pad reports X and Y swapped in Firefox was not tested; the remap screen can correct it.

## Escape and Back

On Android, a hardware Escape key can reach the browser as Back. `src/back-guard.js` pushes one history entry after a real gesture, so browser Back opens Pause (or backs out of a menu) instead of leaving the game. A second Back with no gesture in between still leaves, as the browser intends. Leaving fullscreen during play also opens Pause, and **P** opens the menu as well. If the tablet's key is truly the system Home key, no web page can intercept it.

## Deck bags

`deckMarkers` used one fixed aft span on every hull. On the aft-cabin landing craft (`sterndrive`) the sacks were almost entirely inside the wheelhouse. On `basic`, `basic-sister`, `twinjet` and `twinjet-sister` the first row overlapped the cabin's back wall or roof overhang. `openDeckSpan` in `src/three/catch-load.js` now uses each model's own cabin position plus 0.25 m clearance, and the landing craft loads forward of its house.

This is presentation only: bag weight, capacity and collision are unchanged. `tests/deck-bag-placement.test.js` builds all twelve hull models and checks every instanced sack at 1, 4, full, twice-full and 120 bags. A new `deck-load` browser suite renders the fleet on the GPU. Remaining overlaps with deck fittings and crew are noted, not fixed.

## Catalogue artwork setting

The player-facing Raster/Vector switch is removed. Menus show the 3D models, and the original raster illustrations remain the fixed reference art. The internal vector mode is kept for fixtures.

## Menus and HUD

See [interface redesign](interface-redesign-2026-10-04.md).
