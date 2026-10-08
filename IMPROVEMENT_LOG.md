# Improvement log — autonomous pass

Started October 8, 2026 on branch `autonomous-improvements`, branched from `overnight-balance` (`a3803c8`) so the career bot and the save-validation fix are available. Nothing here is designer-approved; the Bible stays the authority. Each entry: date, what changed, why, commit.

Hard limits kept throughout: exactly two divers, rigid orthographic following camera, `urchin3d-career-v1` saves load unchanged or are migrated, `main` untouched, every pushed commit passes `npm run verify -- --unit-only`.

## Backlog (ranked: player impact for size)

1. **Remaining acceptance — compact forecasts/almanac and short landscape lessons require scrolling.** Tighten layouts on phone landscape.
2. **Remaining acceptance — compact keyboard career speech can cover the boat's bow.** Keep speech clear of the full hull.
3. **Play pass — run career-bot careers on later coasts and other hulls** (Stormbreak, Frontier) and note what's broken or dull there; feed the backlog.
4. **Audio — check the mix in a busy scene** (rain + taxi + engine + whistle) for anything overwhelming or missing.
5. **Performance — measure frame time at phone-portrait size with heavy weather + night + 720 logs**, the worst case in the Bible.
6. **Code health — survey the largest modules (`vessels.js`, `main.js`) for dead code and duplicated helpers** found while working.
7. **UX — taxi near-miss radio fires only within 24 m; give an earlier heads-up** when a taxi's committed run will pass near a surfaced diver the skipper can still protect.
8. **Balance — starter outboard (25 kn) outruns every upgrade hull** (bot finding 7). Designer decision on hull speeds; consider only recording options.

9. **Balance — Home Coast unmarked beds still drain under rival pressure** (stock model: near all-bed stock 44% by day 60 even with the leave-thin rule). Consider letting off-map rivals spread across coasts more, or the same leave rule weighting unmarked ground.
10. **UX — Deck voyage-plan detail pane is short (~240 px)**: the Buyer paragraph is cut and needs scrolling at 1280×800 (independent review note).
11. **Tooling — the stock model ignores player catch except a fixed daily take**; give it the bot's per-day catch CSV as input for faster balance sizing.

## In progress

- (none)

## Done

- **October 8 — Taxi lookout** (`043cc33`). Taxis from day 4 ignored surfaced divers entirely; the bot saw ~1 taxi death per two working weeks from season 2 (Bible §15: catastrophes rare and tied to risk). A taxi now spots a surfaced diver within weather-limited range (70 m clear, 30 m at night, shortened by fog, rain and sea) and swerves after a 1 s reaction. Speed, cadence, drive-bys and lethality thresholds unchanged; fog, night and a diver surfacing close ahead stay dangerous. Regression test fails before, passes after. Bot comparison: see below once the run finishes.
- **October 8 — Hull repair scaled to boat price** (`8dc4f31`). Full-hull rate = min($18,000, half the boat's price). A wrecked $15,000 starter needed ~$16,000 and locked careers into a month of dock work; it now needs ~$6,750. Boats worth $36,000+ unchanged.
- **October 8 — No landing fee on an empty trip** (`5b4c9b7`). The $85 fee was charged on 0 lb landed.
- **October 8 — Voyage plan explains slow picking** (`c309797`). Sail now shows the live, season-health ground potential and "Fished hard last season: picking is slower here until the ground rests." when it is down, instead of a static number while bags silently slow. Not screenshot-checked yet (backlog 10).
- **October 8 — Rivals leave picked-thin ground** (`501ac61`). Rival crews (physical and off-map) stop taking from a clump at 30% of its starting stock and move on. Marked beds no longer vanish in the first week on every map; season regrowth has something to work on. New `scripts/stock-model.js` (fast, no sailing): marked beds hold ~30% on every map; Home Coast all-bed stock at day 60 is 44/54/84% instead of 15/32/75%. Player divers unaffected.
- **October 8 — Fished-hard wording linked to the figure** (`24119ff`). Independent screenshot review on phone/tablet/Deck: no must-fix; should-fix (link the percentage to its cause) applied. `scripts/voyage-plan-shots.js`, record `docs/review/independent-voyage-plan-note-2026-10-08.md`.
- **October 8 — Input pressed after suppression no longer dropped** (`56d979a`). A key pressed after `suppress()` but before the next frame (Escape right after Continue on a slow reload) was lost; root cause of continuous-weather's flaky Pause step. Also fixed a fixture race reading the forecast before it painted. continuous-weather 6/6 after both fixes; input and operations suites pass. Real keyboards benefit too: an early Escape now always opens the menu.
