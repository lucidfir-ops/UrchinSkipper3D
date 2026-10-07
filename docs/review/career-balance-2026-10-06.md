# Career balance from a headless career bot — October 6, 2026 (overnight)

Source: the designer's overnight request of October 6 to play-test the career with a bot across several play styles, seeds and coasts, rank the problems, and tune data and constants one change at a time. Work is on the `overnight-balance` branch only; nothing here is merged or designer-approved.

## Method

`scripts/career-bot.js` plays whole careers through the real game code:

- Harbour: licence, fuel, repairs, crew hiring, equipment, boats, permits, buyer orders and credit go through the same career functions the menus call (`serviceBoat`, `hireCrew`, `buyEquipment`, `buyVessel`, `buyAreaAccess`, `chooseBuyer`, `credit`, `chooseGround`, `nextCareerDay`).
- At sea: every day is sailed with `step()` at 60 Hz through the real helm, Matter physics, weather, tides, current, logs, rocks, rivals, taxis, DFO inspections, diver AI, air, exposure, recovery gates (with the career's own pickup tolerance), harbour-line return, settlement and overnight rollover. The world is encoded and decoded after every trip, so saves are exercised too.
- What the bot knows, all of which a player also has: marked beds, chart depths, visible rocks and their wash, where its own divers surfaced and what they brought up, forecasts, prices and its own accounts. It never reads live stock, unmarked bed positions or hidden quality. When every known spot is spent it scouts blind on 6–14 m water.

Three styles (`STYLES` in the script; the numbers are the bot's habits, not game tuning):

| Style | Quality order | Comes home | Rests | Money |
| --- | --- | --- | --- | --- |
| Cautious | 70%+ | 70 min before the latest departure | every 5 working days, or diver fatigue > 40% | keeps $8,000; no credit; next coast only with $25,000 spare; safety/convenience kit |
| Average | 60%+ | 35 min before | diver fatigue > 60% | keeps $4,000; no credit; sensible kit, boat and coast when cash allows |
| Greedy | Any | up to 150 min after, works nights with torches | almost never | keeps $500; borrows; buys the next coast as soon as possible |

Runs: three seeds (7, 1234, 90210) per style, 60 days each, starting on the basic Workhorse or the outboard Island Tender (alternating by seed). Per-day CSVs are in `test-results/career-bot/` (gitignored); `scripts/career-bot-report.js` turns them into the tables below. A fast stock model (career rollover, rivals and an optional fixed player catch, no sailing; about 7 s for 60 days) was used to size the stock changes before confirming them with the bot.

## Limits — read before trusting any number

- **The bot is a worse boat handler than a practised player.** Its first dockings failed most of the time; after a rewrite it recovers about 12 of 13 floats on Sheltered Kelp, with a median of about 100 simulation seconds per pickup (a person probably takes 30–60). When its own attempts fail for ~150 s it uses a counted fallback that places the boat stopped alongside the float (`dockAssists` column). Everything else stays the real simulation. Its catches and day lengths are therefore a lower bound on a competent player's, and its frequent harmless bumps of its own divers ("near miss: boat strike") say nothing about player safety.
- **Blind scouting is weak.** Once marked beds are gone the bot finds unmarked ground slowly. A player who learns a map does better. Findings about empty marked beds are about the world; findings about the bot's catch on those days partly reflect the bot.
- **Starter boats are confounded with handling.** The small outboard is easier for the bot to bring alongside, so part of its income advantage may be the bot.
- **Synthetic play, not people.** Nothing here is human new-player acceptance, physical controllers or device performance.
- Easy difficulty (the career default). Realistic narrows pickup tolerance and would lengthen the bot's pickups.

## Findings, ranked by harm to a real player

### 1. Rival boats strip the grounds within days, whether or not the player fishes — soft-lock risk (changed)

Each rival team's daily catch goal was `target × 1.6 × crew × random × area factor`: 2,000–7,000 lb per boat per day, two to three times what the bot lands with two divers, and they know every bed and take marked beds first. On seed 1234 the plan for day 2 sent four teams with 17,300 lb of goals into Sheltered Kelp alone.

Fast stock model, current tuning, **no player catch at all** (marked beds % / all beds % remaining):

| Day | Sheltered Kelp | South Reef | Outer Ledge | Stormbreak Channel | Blackwater Reach | Knifepoint Race | Seventy Foot Shelf |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 0 / 80 | 100 / 100 | 100 / 100 | 40 / 96 | 37 / 97 | 100 / 100 | 100 / 100 |
| 9 | 0 / 63 | 51 / 93 | 43 / 92 | 0 / 87 | 0 / 90 | 0 / 91 | 11 / 99 |
| 18 | 0 / 48 | 0 / 66 | 0 / 76 | 0 / 77 | 0 / 78 | 0 / 85 | 0 / 87 |
| 36 | 0 / 2 | 0 / 0 | 0 / 58 | 0 / 60 | 0 / 62 | 0 / 77 | 0 / 73 |
| 60 | 0 / 0 | 0 / 0 | 0 / 33 | 0 / 36 | 0 / 49 | 0 / 62 | 0 / 64 |

All 13 marked beds on the starter map are gone by day 2–3, every map's marked beds by day 3–18, and the two inner Home Coast maps are completely empty by day 36. In the bot runs Sheltered Kelp returned 0 lb from day 4 for every style. A cautious player on the starter Harbour Workhorse cannot outrun this: in the interrupted baseline run (cautious, basic, seed 1234) days 11–20 averaged 22 lb, every trip lost about $340, and cash fell from $10,347 on day 5 to $648 on day 19 with no way to afford the $12,000 Stormbreak permit. That is the closest thing to an unwinnable career the bot found.

**Change 1** (`src/fleet-life.js`): the fixed 1.6 becomes `FLEET_LIFE.goalScale = 0.6`, so a home-coast rival lands about 1,500 lb a day, comparable to a competent player. The Bible's catch-by-area factors (§16) are untouched. Same model after the change:

| Day | Sheltered Kelp | South Reef | Outer Ledge | Stormbreak Channel | Blackwater Reach | Knifepoint Race | Seventy Foot Shelf |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 43 / 93 | 100 / 100 | 100 / 100 | 78 / 99 | 76 / 99 | 100 / 100 | 100 / 100 |
| 9 | 0 / 86 | 82 / 98 | 79 / 97 | 25 / 95 | 32 / 96 | 0 / 97 | 67 / 99 |
| 18 | 0 / 78 | 6 / 87 | 33 / 91 | 0 / 92 | 0 / 92 | 0 / 94 | 0 / 95 |
| 36 | 0 / 51 | 0 / 61 | 0 / 84 | 0 / 85 | 0 / 86 | 0 / 92 | 0 / 90 |
| 60 | 0 / 15 | 0 / 32 | 0 / 75 | 0 / 76 | 0 / 81 | 0 / 86 | 0 / 87 |

With a player also taking 2,000 lb a day from Sheltered Kelp, it still empties by about day 50 — fishing one map every day should exhaust it and push the player on. **Conflict to review:** on September 25 the designer asked for *more* Home Coast pressure (catch factors 0.62/0.82/1.0 → 0.85/1.05/1.2). This change keeps those factors but lowers total rival catch below its pre-September-25 level. It is reversible by setting `goalScale` back to 1.6.

### 2. Marked beds are a first-week resource everywhere, and regrowth constants cannot fix it (not changed)

Even after change 1, marked beds on every map are gone by day 9–18. Regrowth runs per clump at each nine-day season (`remaining × 1.35 + 0.4% of initial`), so a stripped clump stays stripped. In the fast model, raising recolonisation from 0.4% to 3% or 6%, or survivor growth from 1.35 to 1.6, changed remaining stock by at most a few percent over 60 days, because rival boats take the regrowth the next day. The cause is behavioural: rivals know every bed, always fish marked beds first and pick a bed to zero. That needs a code change (for example, rivals leave a bed below some fraction of its stock, or prefer unmarked ground), so it is a recommendation, not a tuning change. The Bible-recorded regrowth values were left alone.

### 3. A hidden second depletion penalty cuts the player's picking speed by a third, then nearly half (changed)

Separately from bed stock, each map has quota "sub-areas" whose health scales picking speed for everyone (`subAreaYield`, floor 45%). Every player trip books its pressure to sub-area a (the old selector is retired), and the sustainable level was 5,500 a season — about 600 lb a day — against the ~2,000 lb a day the bot lands. In the interrupted baseline, Sheltered Kelp's health fell to 0.55 at the first season change (day 10, picking speed −33%) and South Reef's to 0.75; a second season reaches the 0.35 floor (−44%). The player sees only slower bags, with no explanation. **Change 2** (`src/quota-areas.js`) scales the sustainable levels by four (22,000 / 32,000 / 44,000 on the Home Coast maps; 22,000–60,000 by coast tier, now named data), so one full-time player sits near the line. Not recorded in the Bible.

### 4. Saves fail whenever a nine-goose flock is on the map (bug, fixed)

The bot's save round trip after a normal day 2 failed with "Damaged career save: wildlife encounter". Goose flocks spawn with five to nine birds; save validation allowed at most eight. In the game `saveCareer` returns "Save unavailable" while such a flock exists, including at the end of a day. The bound now follows the largest group any species spawns; regression test in `tests/wildlife.test.js` (fails before, passes after). Not a balance change and no format change.

### 5. Water taxis kill divers far more often than "rare" (not changed)

Across all bot runs, 293 fishing days fell on day 10 or later, when taxis may kill (Bible §15). Those days had 21 diver deaths from water-taxi strikes, one from the bot's own powered stern, and 13 taxi injuries. That is roughly one dead diver every two working weeks. One cautious career (basic, seed 90210) lost a diver on days 10, 17 and 23. Each death forced a rescue, replaced the crew and wiped out the week's margin. The bot leaves divers on the surface two to three times longer than a practised skipper (slow pickups, and its fallback only after 150 s), so a player's rate should be lower, but nowhere near "rare and connected to meaningful risk" (§15).

The cause is visible in `src/taxi-route.js` and `src/traffic.js`. The October 5 drive-by keeps 14 m (`DRIVE_BY.diverClearance`) between divers and the 100 m straight pass only. Those divers are sampled when the taxi spawns. The approach and departure legs, the fallback edge-to-edge routes, and any diver who surfaces or drifts into the lane during the taxi's run are not checked. Taxi speed, cadence, the 14–22 m drive-by and the lethality thresholds are all designer decisions, so nothing was changed. **Recommendation (code):** re-check surfaced divers along the whole committed route at spawn, and either abort or swing wide when a diver surfaces within the lane during the run. The existing "cutting close to a surfaced diver" radio warning would then rarely end in a death.

### 6. Repair lock-out: a wrecked starter needs about a month of dock work (not changed)

Hull repair costs `(1 − hull) × $18,000` on every boat, plus drive damage. A Harbour Workhorse costs $15,000. Below 20% hull the boat may not sail. The bot runs show the trap three times:

- average/basic/seed 7: hull 0.1 by day 24, repair about $16,000, cash $3,300; 33 dock days ($420 each) to day 60;
- greedy/basic/seed 1234: hull 0.19 on day 9, repair $14,700; 24 dock days;
- cautious/basic/seed 90210: hull 0.1 on day 27 after its third diver death; dock days to the end.

The temporary development credit (§13) lets a player borrow out of it. Without that facility (the ordinary credit ceiling), this is the most likely real-player soft-lock after the stock collapse. The bot hits rocks more than a person would. **Recommendation:** scale hull repair to the boat's price (a code change to `repairQuote`), or cap it at a fraction of the boat's value.

### 7. The starter choice is lopsided, and boat upgrades lengthen passages (not changed)

Both starters cost $15,000 (Bible §13). The Island Tender outboard runs at 25 kn, the Harbour Workhorse at 10 kn. Passage minutes each way and the remaining working window (05:00–19:00):

| Area | Workhorse 10 kn | Island Tender 25 kn | Coastal Workhorse 10 kn ($52k) | Shoal Skipper 10 kn ($68k) | Channel Master 18 kn ($145k) |
| --- | --- | --- | --- | --- | --- |
| Sheltered Kelp | 60 / 720 | 24 / 792 | 60 / 720 | 60 / 720 | 34 / 772 |
| Outer Ledge | 180 / 480 | 72 / 696 | 180 / 480 | 180 / 480 | 100 / 640 |
| Last Light Bank | 200 / 440 | 85 / 670 | 195 / 450 | 198 / 444 | 109 / 622 |
| Needle Sluice | 278 / 284 | 119 / 602 | 263 / 314 | 274 / 292 | 145 / 550 |
| The Locked Vault | 400 / 40 | 173 / 494 | 375 / 90 | 393 / 54 | 202 / 436 |

The starter outboard is the fastest boat in the game, and every bigger boat makes each passage longer. A bigger boat buys only deck space (useful once the outboard's 3,000 lb fills) and sea-keeping. In the bot runs the outboard careers earned about twice the Workhorse careers over the first 30 days. Part of that may be the bot: the small outboard is easier for it to bring alongside. **Recommendation:** decide whether the outboard's speed is meant to beat every upgrade. If not, faster upgrade hulls would change handling feel, so the designer should judge it.

### 8. Missed offloads are mostly the bot (not changed)

Late offloads were common: about a third of fishing days for the average style and for the greedy style by design. Most come from the bot's slow pickups on a 10 kn boat, not from the 19:00 deadline. No change.

### 9. Smaller observations

- Zero-catch trips still cost about $300–$500 (fuel, insurance and the $85 landing fee on 0 lb).
- Crew who see poor returns leave between days. With depleted grounds, the average bot re-hired a diver every few days. That is the stock collapse showing up again, not a separate problem.
- Rock scrapes cost $1,000–$4,800 a repair for the bot. A person would hit fewer rocks.
- Recolonisation and survivor growth: see finding 2. They were tested and left alone.

## Results tables

### Baseline: nine 60-day careers on the code before any change (`d8980e0`)

| Run | Fished / rest / dock days | Final cash | Total lb | lb per fishing day | Net per fishing day | Late offloads | Diver deaths |
| --- | --- | --- | --- | --- | --- | --- | --- |
| average, Workhorse, seed 7 | 27 / 0 / 33 | −$415 | 26,321 | 975 | $744 | 9 | 1 |
| average, outboard, seed 1234 | 51 / 0 / 9 | −$676 | 39,671 | 778 | $771 | 16 | 2 |
| average, outboard, seed 90210 | 59 / 0 / 1 | $7,204 | 55,020 | 933 | $1,152 | 19 | 2 |
| cautious, Workhorse, seed 1234 | 42 / 7 / 11 | $9,223 | 19,399 | 462 | $290 | 8 | 1 |
| cautious, Workhorse, seed 90210 | 22 / 3 / 35 | $9,697 | 9,612 | 437 | $154 | 5 | 3 |
| cautious, outboard, seed 7 | 43 / 4 / 13 | −$33 | 19,835 | 461 | $418 | 7 | 2 |
| greedy, Workhorse, seed 1234 | 28 / 0 / 30 | $10,639 | 28,955 | 1,034 | $1,056 | 28 | 1 |
| greedy, Workhorse, seed 90210 | 9 / 0 / 50 | $30,883 | 13,801 | 1,533 | $2,770 | 9 | 0 |
| greedy, outboard, seed 7 | 60 / 0 / 0 | $2,912 (debt $5,000) | 53,788 | 896 | $894 | 50 | 5 |

The greedy/Workhorse/seed 90210 run sank on day 9, collected insurance and then docked for the rest of the run because the bot does not buy a replacement boat (a bot gap; ignore that run after day 9). No baseline career bought a boat. Only the greedy style bought a coast permit before day 27.

By style, catch per fishing day collapses over the career (fishing days only):

| Days | Average lb/day | Average net/day | Cautious lb/day | Cautious net/day | Greedy lb/day | Greedy net/day |
| --- | --- | --- | --- | --- | --- | --- |
| 1–10 | 1,893 | $2,419 | 1,083 | $1,276 | 1,736 | $2,225 |
| 11–20 | 1,009 | $987 | 277 | $59 | 1,173 | $1,802 |
| 21–30 | 695 | $830 | 251 | −$17 | 782 | $893 |
| 31–40 | 188 | $84 | 340 | $100 | 751 | $645 |
| 41–50 | 599 | $439 | 167 | −$95 | 542 | $377 |
| 51–60 | 184 | −$211 | 19 | −$407 | 525 | $304 |

### After changes 1 and 2: same seeds and styles

Thirty days, the first three verification pairs (change 1 alone gave similar numbers for the first two):

| Run | Baseline lb / net / cash day 30 | Tuned lb / net / cash day 30 |
| --- | --- | --- |
| average, outboard, seed 1234 | 36,504 / $44,491 / $1,255 | 54,636 / $77,224 / $24,882 |
| average, outboard, seed 90210 | 41,129 / $56,645 / $6,863 | 54,715 / $75,494 / $16,206 |
| cautious, outboard, seed 7 | 19,630 / $23,578 / $376 | 29,815 / $38,142 / $9,940 |
| cautious, Workhorse, seed 90210 | 9,612 / $3,399 / $167 | 23,699 / $23,267 / $4,382 |
| greedy, outboard, seed 7 (change 1 only, 27 days) | 40,039 / $49,941 | 45,012 / $58,797 |

Sixty days, Workhorse careers (net over all fishing days):

| Run | Baseline net / final cash / dock days | Tuned net / final cash / dock days |
| --- | --- | --- |
| average, seed 7 | $20,079 / −$415 / 33 | $21,163 / $764 / 10 |
| cautious, seed 90210 | $3,399 / $9,697 / 35 | $18,826 / $641 / 8 |
| cautious, seed 1234 | $12,178 / $9,223 / 11 | $17,155 / $16 / 31 |
| greedy, seed 1234 | $29,566 / $10,639 / 30 | $31,592 / $12,214 / 17 |

Quota health stayed at 1.0 in every tuned run (baseline fell to 0.35–0.55).

What the tuned runs still show: Workhorse careers that stay on the Home Coast run dry again after about day 30, and repair lock-outs (finding 6) and taxi deaths (finding 5) take most of the extra income. Final cash is therefore no better on the starter Workhorse even though net income rose. The two changes fix the first month. They do not by themselves make a cautious Workhorse career work over 60 days. Recommendations 2, 5 and 6 are the next levers.

### Other observations from the runs

- **Crew churn.** Divers leave between days after several poor returns. In the depleted baseline, average/outboard/seed 1234 hired a replacement 28 times in 60 days. This follows from the stock collapse.
- **Saves.** The goose-flock save failure (finding 4) occurred in several runs before the fix.
- **The bot's own limits, measured:** the docking fallback was used for about 940 of 1,730 bags across all runs; the bot recorded about 3,700 harmless hull contacts with its own divers; and it stayed on the Home Coast longer than a person who reads the stock signals would.

## Changes on the branch

1. `6277aec` — `FLEET_LIFE.goalScale` 0.6 (was a fixed 1.6). Unit verification passed. Bot evidence above. Reversible.
2. `530101e` — quota sustainable pressure ×4; per-tier list named as data. Unit verification passed. Bot evidence above.
3. `e1a5d76` — save-validation wildlife group bound (bug fix, regression test).

An independent read-only review of the three commits found no correctness problems. One side effect it noted: a save whose day's rival plan was already prepared keeps the old 1.6-based goals until the next fleet day. No change touches the save format, the `urchin3d-career-v1` key, UI, art or the two-diver rule. The Bible was not edited.

## Verification

- `npm run verify -- --unit-only` passed after each change (latest: 652 tests, 651 pass, 1 intentional skip; lint, format and build pass).
- Bot runs: headless Node simulation at 60 Hz, Easy difficulty. No browser, device or controller testing was done, and no visual change was made.
