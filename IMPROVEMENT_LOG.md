# Improvement log — autonomous pass

Started October 8, 2026 on branch `autonomous-improvements`, branched from `overnight-balance` (`a3803c8`) so the career bot and the save-validation fix are available. Nothing here is designer-approved; the Bible stays the authority. Each entry: date, what changed, why, commit.

Hard limits kept throughout: exactly two divers, rigid orthographic following camera, `urchin3d-career-v1` saves load unchanged or are migrated, `main` untouched, every pushed commit passes `npm run verify -- --unit-only`.

## Backlog (ranked: player impact for size)

1. **Balance — rivals pick marked beds to zero**, so marked beds are a first-week resource and never regrow. Rivals should leave a bed below a stock fraction and move on (code; regrowth then works).
2. **Flaky test — `continuous-weather` sometimes times out reopening Pause after reload** (3/10 runs). Find the race.
3. **Remaining acceptance — compact forecasts/almanac and short landscape lessons require scrolling.** Tighten layouts on phone landscape.
4. **Remaining acceptance — compact keyboard career speech can cover the boat's bow.** Keep speech clear of the full hull.
5. **Play pass — run career-bot careers on later coasts and other hulls** (Stormbreak, Frontier) and note what's broken or dull there; feed the backlog.
6. **Audio — check the mix in a busy scene** (rain + taxi + engine + whistle) for anything overwhelming or missing.
7. **Performance — measure frame time at phone-portrait size with heavy weather + night + 720 logs**, the worst case in the Bible.
8. **Code health — survey the largest modules (`vessels.js`, `main.js`) for dead code and duplicated helpers** found while working.
9. **UX — taxi near-miss radio fires only within 24 m; give an earlier heads-up** when a taxi's committed run will pass near a surfaced diver the skipper can still protect.
10. **Visual — screenshot pass of the Sail/voyage plan on phone portrait** with the new fished-hard line and long coast names.
11. **Balance — starter outboard (25 kn) outruns every upgrade hull** (bot finding 7). Designer decision on hull speeds; consider only recording options.

## In progress

- (none)

## Done

- **October 8 — Taxi lookout** (`043cc33`). Taxis from day 4 ignored surfaced divers entirely; the bot saw ~1 taxi death per two working weeks from season 2 (Bible §15: catastrophes rare and tied to risk). A taxi now spots a surfaced diver within weather-limited range (70 m clear, 30 m at night, shortened by fog, rain and sea) and swerves after a 1 s reaction. Speed, cadence, drive-bys and lethality thresholds unchanged; fog, night and a diver surfacing close ahead stay dangerous. Regression test fails before, passes after. Bot comparison: see below once the run finishes.
- **October 8 — Hull repair scaled to boat price** (`8dc4f31`). Full-hull rate = min($18,000, half the boat's price). A wrecked $15,000 starter needed ~$16,000 and locked careers into a month of dock work; it now needs ~$6,750. Boats worth $36,000+ unchanged.
- **October 8 — No landing fee on an empty trip** (`5b4c9b7`). The $85 fee was charged on 0 lb landed.
- **October 8 — Voyage plan explains slow picking** (`c309797`). Sail now shows the live, season-health ground potential and "Fished hard last season: picking is slower here until the ground rests." when it is down, instead of a static number while bags silently slow. Not screenshot-checked yet (backlog 10).
