# Autonomous improvement pass — October 8, 2026

Branch `autonomous-improvements` (from `overnight-balance` at `a3803c8`), not merged. Source: the designer's October 8 request to improve the game autonomously on a branch, with every change logged. None of these changes is designer-approved and the Bible is unchanged. Each section: what was wrong, how it was found, the fix, evidence and limits. The running list is [IMPROVEMENT_LOG.md](../../IMPROVEMENT_LOG.md).

## Safety

### Taxi lookout (`043cc33`)

**Wrong.** From career day 4 a taxi ignored surfaced divers completely; only days 1–3 avoided them. The October 7 bot runs counted 21 taxi deaths in 293 late-career fishing days, about one per two working weeks (Bible §15 asks for rare catastrophes connected to meaningful risk).

**Fix.** `src/taxi-lookout.js`. A taxi spots a surfaced diver within a weather-limited range: 70 m clear, 30 m at night, shortened by sea state (to 35% at 2 m) and rain (by up to 30%), capped by fog visibility. After a 1 s reaction it bends its run around the diver with the existing stable-side taxi steering. It never stops for a diver and never retargets. Speed, cadence, drive-bys, near-miss stage and lethality thresholds are unchanged.

**Evidence.** A new test in `tests/traffic.test.js` fails before the change and passes after: a clear-day taxi passes more than 8 m wide and completes its run, while a 12 m-fog taxi still strikes. The existing "surfaced diver strike can be fatal" test (diver 20 m ahead) still passes. Bot, cautious Workhorse, seed 90210, 30 days: the baseline had a day-10 taxi death; with the lookout the same pass injured instead, with no taxi deaths.

**Limits.** One seed. The bot's slow pickups leave divers on the surface longer than a person would.

### Early taxi heads-up (`d66af09`)

**Wrong.** The only taxi warning fired inside 24 m, about 1.5 s before a 30-knot taxi arrived.

**Fix.** `stepTraffic` projects each fast taxi's present course and calls once, 1.5–7 s out, when it will pass within 16 m of a surfaced diver: "RADIO · Water taxi from the W, coming fast past Ada Chen!", with the warning sound. The 24 m call remains.

**Evidence.** A test checks one call with the right compass point, and none for a taxi heading away. A phone screenshot (360×780) shows it on one line under the instruments, clear of the boat.

### Stern watch (`38c2ed1`)

**Wrong.** Reversing the powered stern onto a surfaced diver is the deadliest handling mistake, and there was no live cue. Both fatalities in the HEAD bot runs were the bot doing exactly this.

**Fix.** `src/stern-watch.js`. A fit diver aboard calls "MILO WARD · Ada's astern — neutral!" with the warning sound when the boat is under power astern (throttle below −8%) and a surfaced diver is within 9 m behind the stern and 3 m outside the beam. Once per 8 s. With nobody aboard there is no call. The diver is visible on the surface, so this adds no hidden information.

**Evidence.** Tests: one call, cooldown, repeat after cooldown; no call going ahead, with the diver forward, or with nobody aboard. The operations suite (controller and touch recovery) passes.

## Balance

### Rivals leave picked-thin ground (`501ac61`)

**Wrong.** Rivals know every bed, fish marked beds first and picked each clump to zero. Every map's marked beds were gone within 3–18 days, and season regrowth (×1.35 of survivors) had nothing to work on (overnight record, finding 2).

**Fix.** `RIVAL_PICKING.leaveFraction = 0.3` in `src/harvest-ground.js`. Physical rivals (`traffic.js`) and off-map rivals (`fleet-life.js`) stop taking from a clump at 30% of its starting stock and move to the next bed. The player's divers are unaffected.

**Evidence.** New `scripts/stock-model.js` (rival fishing, season rollover and quota health, no sailing; about 2 s for 60 days). Seed 1234, no player catch: marked beds hold at about 30% on every map instead of 0%. Home Coast all-bed stock at day 60 is 44/54/84% instead of 15/32/75%. Tests in `tests/rival-picking.test.js`; the fortnight test fails before the change. Bot, cautious Workhorse, seed 90210, 30 days, all changes up to `f589dd5`: final cash $17,313 against $4,382 this morning, and 753 lb per fished day in days 21–30 against 374.

**Limits.** With a player also fishing, Home Coast maps still thin by about day 30. The average-style bot fell to 516 lb/day by days 21–30. That pressure now points onward (dock talk, below).

### Hull repair scaled to boat price (`8dc4f31`)

**Wrong.** A full hull rebuild cost $18,000 on every boat, more than a $15,000 starter is worth. Three bot careers were stuck for weeks of $420 dock days.

**Fix.** The full-hull rate is `min($18,000, 0.5 × boat price)` (`hullRepairRate` in `src/boats.js`). It applies to the harbour quote and to the trip's hull-loss quote. Boats worth $36,000 or more are unchanged.

### No landing fee on an empty trip (`5b4c9b7`)

The $85 landing fee was charged on 0 lb landed. It is now charged only when catch is landed, and the receipt shows the actual amount.

### Dock talk toward the next coast (`6507d5d`)

**Wrong.** Careers that stayed home saw catches fall with nothing pointing onward.

**Fix.** After three trips that each landed under 900 lb, with a further coast still unpermitted, the morning news names that coast and its permit price, with a caution to look at the boat first. At most once per nine days. It never blocks or requires anything (Bible §13). The day is saved as `career.dockTalkDay`; a test round-trips it.

## Readability

### Voyage plan explains slow picking (`c309797`, `24119ff`)

**Wrong.** Season quota health scales picking speed, but Sail showed only the static base potential. Over-fished maps just gave slower bags (Bible §10: readable reasons).

**Fix.** The plan reads "Ground potential 61% (fished hard last season)" and "Picking is slower here until the ground rests."

**Evidence.** Unit test of the rendered markup. `scripts/voyage-plan-shots.js` captures phone, tablet and Deck screenshots. [Independent review](independent-voyage-plan-note-2026-10-08.md): no must-fix; its should-fix (link the percentage to its cause) was applied.

### Voyage actions paired on wide screens (`55f90c7`)

At 1280×800 the plan showed five of its seven actions; Arrival approach and Local Chart were hidden below a scroll. At 1000 px and wider, Begin working day stays full width and the rest sit in pairs. DOM and controller order are unchanged. The strict menu-theme audit (night and day; phone, tablet and Deck) passes.

## Audio

### Other boats are audible (`e5935fe`, `b8adacc`)

**Wrong.** No traffic made any sound; a 30-knot taxi arrived unheard (Bible §3).

**Fix.** One procedural loop, a higher outboard buzz, follows the loudest moving vessel within 160 m: louder as it nears, quieter for slow boats, pitched up while closing and down as it leaves. It is capped at 0.3 of the volume setting. A rival working on station within 90 m idles at a tenth of the volume.

**Evidence.** Unit tests of the gain and pitch model. The traffic-fleet and voyage suites run without page errors.

**Limits.** Nobody has listened to it. The mix balance needs the designer's ear.

## Performance

### Distant logs in cohorts (`051909d`)

**Wrong.** Night plus fog brings 720 logs. Each was advanced every 60 Hz step, and a slow device runs several steps per frame.

**Fix.** Logs more than 90 m from the boat advance in four staggered cohorts by the accumulated time, so no drift is lost. Logs that can touch the boat still step every step.

**Evidence.** New `scripts/stress-performance.js`. Phone size at 4× Chromium CPU throttle, night + fog + rain + 720 logs: simulation 17.7 → 9.6 ms per frame, 13.2 → 14.7 fps. Deck stays at 60 fps. In Node, `stepLogs` fell from 0.62 to 0.27 ms per step. Test in `tests/log-cohorts.test.js`.

### Auto graphics (`70dca2d`)

**Wrong.** Every device started on High (1.6× resolution, 2048 shadows) unless the player found the setting.

**Fix.** Auto, the default when nothing is saved, starts at High. When the median frame interval over about 90 working frames exceeds 30 ms, it steps down one level with a short notice. It never steps up in the same visit. Explicit choices, including a saved High, are kept. The setting now cycles Auto, High, Balanced, Battery.

**Evidence.** Unit test. The input suite passes with the updated cycle. With throttling, the phone went from 17 to 23 fps in a calm scene and from 14.7 to 18 fps in the worst case. Tablet and Deck sizes stay on High at 60 fps.

**Limits.** CPU throttling on the Deck's GPU is not a phone. Real phone GPUs, which are more often the bottleneck, were not measured.

## Input

### Keys pressed after suppression (`56d979a`)

**Wrong.** `suppress()` (Continue, menus, focus) ignored all input until a frame saw everything released. A key pressed after the suppression but before the next frame was dropped while held. An example is Escape right after Continue on a slow reload. This was the cause of continuous-weather's intermittent "reopen Pause after reload" timeout: 3 of 10 runs on October 5.

**Fix.** Input held across the suppression still waits for release. Keys pressed since then count at once. Queued chip commands are discarded with other stale taps.

**Evidence.** The keyboard test fails before the change. continuous-weather passed 13 of 14 runs after the change. The remaining failure was a separate fixture race reading the forecast before it painted; after fixing that, it passed 6 of 6. The input and operations suites pass.

## Code health

Nine modules imported by nothing (`d5c14e4`, about 1,300 lines of the retired Phaser presentation) were removed. Modules still exercised by tests were kept.

## Full browser sweep and fixes

All 43 browser suites were run at `100e084`; 38 passed. A rerun of the five failures on the branch base `a3803c8` separated today's regressions from earlier failures.

- **menus: a regression from the input fix (`deaf111`).** Escape cancelled button naming, which calls `suppress()` inside the same poll. The reordered gate then let that frame's Escape through as Back. A suppression raised during a poll now suppresses that frame. Unit test added; the menus suite passes.
- **fleet: a fixture fault, failing before today (`6f3715b`).** The gallery builds twelve extra vessel renderers, each with two shadow-casting work spotlights and two torch lights. Together they exceeded the GPU varying limit ("Could not pack varying"). The game has one set; the fixture now removes the copies' lights.
- **touch: failing before today (`17b47e7`).**
  - The lesson framing check expected the pre-September-29 off-centre boat; it now checks the Bible's centred view.
  - The staged career (day 0, practice phase, finished intro) failed validation on every autosave; it now stages a valid working day.
  - Investigating this exposed a real bug. The autosave failure notice went only to the action-message overlay, which every preset disables. A failing save at sea was therefore silent by default, against Bible §12. It now also goes to the HUD speech for 8 s, whatever the assists. The overlay lists its newest message first.
  - A new save-storage step sails a real working day, makes storage writes fail and requires "SAVE FAILED" in the sea speech. It fails on the previous build and passes now; both sides were rebuilt, since `--browsers-only` does not rebuild.
- **mobile-career: failing before today (`75eddd2`).** On an 844×390 phone the stacked harbour heading took about 150 px and pinned the top row of places with no room to pan. Short wide screens now keep the heading on one row (about 70 px). Portrait, tablet and desktop are unchanged.
- **coastal-progression: failing before today (`803a9e3`).** A Frontier storm at the widest zoom ran at about 17 fps on the Deck. `vegetation.update` took 44 ms a frame recomputing current and motion for about 44,600 plants every 0.1 s, which at that frame rate was every frame. Kelp still updates at 10 Hz. Eelgrass refreshes cell by cell, up to 3,000 blades per frame and at most every 0.5 s per cell.
  - The frontier-storm diagnostic now shows 52 fps, vegetation at 5.4 ms and draw p95 at 23 ms, and Auto graphics stays on High.
  - Suites vegetation, bull-kelp, lighting-kelp and coastal-progression pass.
  - Limit: grass now shows its new pose directly instead of blending, which should not be visible given how slowly it changes. No independent visual review was done.
