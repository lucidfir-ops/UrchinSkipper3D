# Morning summary — overnight balance pass, October 6–7, 2026

Branch `overnight-balance` (pushed; not merged to `main`). Full record: [docs/review/career-balance-2026-10-06.md](docs/review/career-balance-2026-10-06.md).

## The five most important points

1. **The career runs out of fish.** Rival boats aimed for 2,000–7,000 lb a day each (two to three times a competent player), know every bed and take marked beds first. With the player catching nothing, every marked bed on Sheltered Kelp was gone by day 2–3, and Sheltered Kelp and South Reef were completely empty by day 36. In nine 60-day bot careers, catch per fishing day fell from about 1,900 lb to under 200, and 4 of 9 careers ended at or below $0. **Changed:** rival goal scale 1.6 → 0.6. This lowers rival pressure below the level before your September 25 "more Home Coast pressure" decision, so it needs your review. Also changed: a hidden quota penalty that cut the player's own picking speed by up to 44% (sustainable levels ×4).
2. **The two changes fix the first month, not the whole career.** Over 30 days, tuned careers earned 33–74% more net, and up to about 7× more for the cautious Workhorse. Over 60 days, Workhorse careers that stay on the Home Coast still run dry after about day 30. Marked beds are still a first-week resource on every map, because rivals pick beds to zero and a stripped clump never regrows. I tested regrowth constants up to 15× with no visible effect, so this needs a rival-behaviour change (code). That's my top recommendation.
3. **Water taxis kill divers far too often.** 22 diver deaths across the runs, 21 by taxi: about one every two working weeks from season 2. Each death forces a rescue and wipes out the margin. The October 5 drive-by checks diver clearance only on the straight pass and only for divers in the water when the taxi spawns. The bot keeps divers on the surface longer than you would, so a player's rate will be lower, but it is still far from "rare". Not changed (your design); a specific code fix is in the record.
4. **Saves failed whenever a flock of nine geese was on the map** ("Save unavailable: Damaged career save: wildlife encounter"), including the end-of-day save. Validation allowed eight birds; geese spawn up to nine. **Fixed**, with a regression test. This is a bug fix, not tuning.
5. **The bot is a weaker boat handler than you.** It used a counted "place the boat alongside" fallback for about half of its bags, and bumped its own divers harmlessly about 3,700 times. Treat its catches as a lower bound and its safety numbers as an upper bound. Its findings about stock, prices and costs are about the world.

## What I changed (one commit each on the branch)

| Commit | What | Why | Verified |
| --- | --- | --- | --- |
| `6277aec` | `FLEET_LIFE.goalScale` 1.6 → 0.6 (`src/fleet-life.js`) | Point 1 | Unit verify pass; bot 30-day runs (below) |
| `530101e` | Quota sustainable pressure ×4, per-tier list made named data (`src/quota-areas.js`) | Point 2 | Unit verify pass; bot 30-day runs |
| `e1a5d76` | Save validation accepts the largest wildlife group any species spawns | Point 3 | Regression test fails before, passes after; unit verify pass |
| several | `scripts/career-bot.js`, `scripts/career-bot-report.js` | The bot and its report | — |

Nothing in the Bible was edited. No save format, storage key, UI, art or gameplay system changed. Exactly two divers throughout.

## What the bot runs showed (headline numbers)

Baseline: nine 60-day careers on the code before any change, with three seeds and three styles, half on each starter boat.
- Catch per fishing day collapses for every style. Average style: 1,893 lb/day in days 1–10, 695 by days 21–30, under 200 after day 30. Cautious: 1,083 lb/day falling to 19.
- 4 of 9 careers ended at or below $0. No career bought a boat in 60 days.
- 22 divers died across all runs: 21 by water taxi, about one per two working weeks from season 2. See point 5 and the record's finding 5; the bot's slow pickups inflate this.
- Hull lock-outs: a wrecked starter needs about $16,000 of repairs. Without borrowing, that is a month of $420 dock days, which three careers fell into.

After changes 1 and 2, same seeds, first 30 days:

| Career | Baseline net / cash day 30 | Tuned net / cash day 30 |
| --- | --- | --- |
| average, outboard, seed 1234 | $44,491 / $1,255 | $77,224 / $24,882 |
| average, outboard, seed 90210 | $56,645 / $6,863 | $75,494 / $16,206 |
| cautious, outboard, seed 7 | $23,578 / $376 | $38,142 / $9,940 |
| cautious, Workhorse, seed 90210 | $3,399 / $167 | $23,267 / $4,382 |

Over 60 days on the Workhorse, net income still rose, but final cash did not. Careers that stay on the Home Coast run dry again after day 30, and taxi deaths and repair lock-outs take the gains. **The tuning fixes the first month, not the whole career.** The unchanged recommendations below are the next levers.

## What I'd recommend but did not do

- **Rival bed choice (code):** let rivals leave a bed below some fraction of its stock, or prefer unmarked ground, so marked beds stay useful past the first week and regrowth can work.
- **Hull repair price (code/data):** a full hull costs (1 − hull) × $18,000 on every boat, which is more than a $15,000 starter is worth. A wrecked starter needs about $16,000. Without borrowing, that is about a month of $420 dock days. Consider scaling repair by boat price.
- **Starter boats:** both cost $15,000 (Bible). The Island Tender outboard (25 kn) earned roughly twice what the Harbour Workhorse (10 kn) did. It is also the fastest boat in the game: the $52k Coastal Workhorse and $68k Shoal Skipper run at 10 kn and the $145k Channel Master at 18 kn. Upgrading therefore lengthens every passage; it only buys deck space and sea-keeping. Some of the outboard's advantage may be that the bot docks it more easily.
- **Water-taxi fatalities:** from season 2, taxis aiming 14–22 m drive-bys at the boat sometimes run through surfaced divers waiting nearby. The bot keeps divers on the surface longer than a person would, so its fatality rate overstates a player's. Even so, it is high enough that you should watch for it in play.

## Things I'm unsure about

- Whether you want the September 25 pressure increase kept in some form (for example, goal scale 0.8 instead of 0.6).
- How much of the "grindy after day 20 on the Home Coast" picture is the world and how much is the bot's weak scouting of unmarked beds.
- The bot once got stuck against a rock with a nearly destroyed hull. A synthetic test showed boats in that position usually free themselves with full astern or full helm away from the rock, so I don't think it is a game trap. A human check would settle it.
- The baseline and tuned runs used three seeds each. Day-to-day noise is large, so read differences under about 20% as noise.

## Housekeeping

- Bot runs write CSVs to `test-results/career-bot/` (gitignored). Regenerate tables with `node scripts/career-bot-report.js <dir>`.
- `npm run verify -- --unit-only` passes on the branch head (652 tests, 1 intentional skip).
- A dated TEMP export of the branch build is in `exports/` (see the record for its folder name).
