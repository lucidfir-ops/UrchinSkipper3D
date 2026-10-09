# Improvement log — autonomous pass

Started October 8, 2026 on branch `autonomous-improvements`, branched from `overnight-balance` (`a3803c8`) so the career bot and the save-validation fix are available. Nothing here is designer-approved; the Bible stays the authority. Each entry: date, what changed, why, commit.

Hard limits kept throughout: exactly two divers, rigid orthographic following camera, `urchin3d-career-v1` saves load unchanged or are migrated, `main` untouched, every pushed commit passes `npm run verify -- --unit-only`.

## Backlog (ranked: player impact for size)

1. **Regression sweep again** — rerun every browser suite after today's fixes (last sweep: 38/43 pass; all five failures since fixed individually).
2. **Play pass — bot careers on later coasts and other hulls** (Stormbreak, Frontier; outboard and bigger boats) to find what's broken or dull there.
3. **Balance — Home Coast unmarked beds still drain under rival pressure** (stock model: near all-bed stock 44% by day 60). Consider spreading off-map rivals more across coasts.
4. **Remaining acceptance — compact forecasts/almanac and short landscape lessons require scrolling** on phone landscape.
5. **Remaining acceptance — compact keyboard career speech can cover the boat's bow.** Reproduce first; the footprint code may already cover it.
6. **Feel — rival boats at work are silent when stopped**; a quiet idle/compressor cue could help find them in fog.
7. **Tooling — feed the stock model the bot's per-day catch CSV** for faster balance sizing.
8. **Code health — tests that only exercise retired 2D view modules** (coastal-art, hazard-view, water-surface, weather-view, wildlife-view, coast-detail-cache): move what they protect to the 3D path or retire them.
9. **UX — check the stern-watch shout, taxi heads-up and Auto-graphics notices together on a phone** for crowding of the HUD message line.
10. **Balance — starter outboard (25 kn) outruns every upgrade hull** (bot finding 7). Designer decision; only record options.
11. **Audio — nobody has listened to the mix** (rain + traffic + engine + whistle). Needs the designer's ear.
12. **UX — the voyage plan's detail text is still short on 1280×800** (Buyer paragraph scrolls); consider a smaller chart column on wide-but-short screens.

## In progress

- (none)

## Done

- **October 8 — Taxi lookout** (`043cc33`). Taxis from day 4 ignored surfaced divers entirely; the bot saw ~1 taxi death per two working weeks from season 2 (Bible §15: catastrophes rare and tied to risk). A taxi now spots a surfaced diver within weather-limited range (70 m clear, 30 m at night, shortened by fog, rain and sea) and swerves after a 1 s reaction. Speed, cadence, drive-bys and lethality thresholds unchanged; fog, night and a diver surfacing close ahead stay dangerous. Regression test fails before, passes after. Bot comparison (cautious, Workhorse, seed 90210, 30 days, one seed only, so weak evidence): baseline had a taxi fatality on day 10 plus four other rescues; with the lookout the same day-10 taxi pass injured instead of killed, and no taxi deaths in 30 days.
- **October 8 — Hull repair scaled to boat price** (`8dc4f31`). Full-hull rate = min($18,000, half the boat's price). A wrecked $15,000 starter needed ~$16,000 and locked careers into a month of dock work; it now needs ~$6,750. Boats worth $36,000+ unchanged.
- **October 8 — No landing fee on an empty trip** (`5b4c9b7`). The $85 fee was charged on 0 lb landed.
- **October 8 — Voyage plan explains slow picking** (`c309797`). Sail now shows the live, season-health ground potential and "Fished hard last season: picking is slower here until the ground rests." when it is down, instead of a static number while bags silently slow. Not screenshot-checked yet (backlog 10).
- **October 8 — Rivals leave picked-thin ground** (`501ac61`). Rival crews (physical and off-map) stop taking from a clump at 30% of its starting stock and move on. Marked beds no longer vanish in the first week on every map; season regrowth has something to work on. New `scripts/stock-model.js` (fast, no sailing): marked beds hold ~30% on every map; Home Coast all-bed stock at day 60 is 44/54/84% instead of 15/32/75%. Player divers unaffected.
- **October 8 — Fished-hard wording linked to the figure** (`24119ff`). Independent screenshot review on phone/tablet/Deck: no must-fix; should-fix (link the percentage to its cause) applied. `scripts/voyage-plan-shots.js`, record `docs/review/independent-voyage-plan-note-2026-10-08.md`.
- **October 8 — Input pressed after suppression no longer dropped** (`56d979a`). A key pressed after `suppress()` but before the next frame (Escape right after Continue on a slow reload) was lost; root cause of continuous-weather's flaky Pause step. Also fixed a fixture race reading the forecast before it painted. continuous-weather 6/6 after both fixes; input and operations suites pass. Real keyboards benefit too: an early Escape now always opens the menu.
- **October 8 — Distant logs drift in cohorts** (`051909d`). Logs over 90 m from the boat advance every fourth step by the accumulated time; near logs (collisions) every step. New `scripts/stress-performance.js`. Phone at 4x CPU throttle, night+fog+720 logs: simulation 17.7 -> 9.6 ms/frame. Deck unchanged at 60 fps.
- **October 8 — Auto graphics quality** (`70dca2d`). New default for players who never chose a level: starts High, steps down to Balanced then Battery on sustained >30 ms frames while working, with a notice; never steps up in the same visit; explicit choices untouched. Throttled phone 17 -> 23 fps calm; tablet/Deck stay High at 60. Real phone GPUs not measured.
- **October 8 — Early taxi heads-up radio** (`d66af09`). Projects each fast taxi's course; one call 1.5–7 s out if it will pass within 16 m of a surfaced diver ("Water taxi from the W, coming fast past Ada Chen!"), with the warning sound. Phone screenshot: fits one line under the instruments.
- **October 8 — Dead 2D modules removed** (`d5c14e4`). Nine modules (~1,300 lines) imported by nothing.
- **October 8 — Other boats are audible** (`e5935fe`). One procedural outboard loop follows the loudest moving vessel within 160 m with distance gain and Doppler pitch; capped at 0.3 of volume. Unit-tested model; traffic-fleet and voyage suites pass. Not checked by ear.
- **October 8 — Stern watch** (`38c2ed1`). A fit diver aboard shouts "Ada's astern — neutral!" when the boat is under power astern with a surfaced diver within 9 m behind the stern; 8 s cooldown. Both bot fatalities in today's HEAD runs were own-stern reversals.
- **October 8 — Voyage actions paired on wide screens** (`55f90c7`). At 1280×800 two of seven actions were hidden below a scroll; now all show. Strict menu-theme audit passes.
- **October 8 — TEMP export** `exports/2026-10-08-autonomous-improvements/` (build at `6c5653e`; upload `UrchinSkipper3D-TEMP-ITCHIO.zip`, SHA-256 sidecars included).
- **October 8 — Bot check of the combined changes** (code at `f589dd5`, before the stern watch). Cautious Workhorse seed 90210, 30 days: final cash $17,313 (this morning's code: $4,382), lb per fished day in days 21–30 753 (was 374), no diver deaths (was one taxi death). Average Workhorse seed 1234: $6,640, 1,248 lb per fished day, catch still falls to 516 lb/day by days 21–30 on the Home Coast, and two own-stern reversal deaths (bot handling; prompted the stern watch). One seed each: indicative only.
- **October 8 — Dock talk toward the next coast** (`6507d5d`). After three trips under 900 lb with a further coast unpermitted, the morning news names that coast and its permit price, with a caution to check the boat; once per nine days, never a requirement.
- **October 8 — Full browser sweep** (43 suites at `100e084`): 38 passed. Of the 5 failures, only menus was caused by today's work (Escape cancelling button naming also acted as Back after the input change); fixed in `deaf111`. The other four failed identically on the branch base `a3803c8` and were fixed:
  - fleet (`6f3715b`): fixture-only; twelve gallery renderers each added shadow-casting lights, exceeding the GPU varying limit.
  - touch (`17b47e7`): stale off-centre framing expectation (Bible §3 now centres the lesson) and an invalid staged save.
  - **Real bug found there** (`17b47e7`): with default assists, a failed autosave at sea was silent (Bible §12). Now announced in the HUD speech; the action-message overlay lists newest first. save-storage suite gained a check that fails before and passes after.
  - mobile-career (`75eddd2`): harbour heading took ~150 of 390 px on landscape phones and pinned the top row; now one row (~70 px).
  - coastal-progression (`803a9e3`): **real performance bug** — Frontier storm at widest zoom ran ~17 fps on the Deck because every frame recomputed all ~44,600 plants. Eelgrass now refreshes round-robin: 52 fps, vegetation 44 → 5.4 ms.
