# Continuous-voyage rivals — October 2, 2026

## Reproduced problem

Rivals previously kept their departure-day plan throughout a continuous voyage. In a fresh day-one trip to Sheltered Kelp, aggregate off-map catch reached 26,369.1 lb by trip minute 1,140. Advancing through days two and three added exactly zero. `fleetDay` and the ambient pressure ledger both remained on day 1; all original operating windows had ended by minute 1,045. No physical rival could spawn on the later days, even with a directed ground fixture. Reload preserved the frozen state, and the eventual receipt still contained only first-day catches.

This contradicted the continuous working-day world in Bible §12 and the daily rival activity, shared stock, bounded visitor frequency and actual catch accounting in §16.

## Implementation

Fleet plans now use an explicit actual calendar date, the matching daily weather plan and the existing seeded participation, seasonal access and operating windows. Departure-based career and settlement identities remain unchanged. Each midnight completes the previous fleet ledger and starts one new plan; ambient quota pressure is applied once per actual day.

The currently occupied sector remains exempt from aggregate catch: only its physical rivals can remove stock while the skipper is there. Abstract passage accounts for the elapsed off-map interval after first consuming the occupied interval. Passage accounting runs before changing the world sector, avoiding incorrect exclusion of the destination's earlier work. Aggregate catch remains bounded by the day's existing goal and yield factor.

Physical rivals carry their fleet date. A vessel delayed past midnight leaves along a navigable exit instead of attaching its catch to the following day's same-named team. The one-or-two daily visitor allowance and optional nearby encounter restart once per actual day and survive reload and sector changes. Route-search generators recheck their fleet identity, actual date and current operating window before committing a spawn after yielding.

Season boundaries synchronize materialized stock to its save ledger, apply the approved survivor/recolonization and quota-pressure recovery, then update the live patches in place. Separate saved season watermarks make both stock and quota recovery idempotent when the skipper eventually returns to harbour. The existing stock snapshot helpers were moved unchanged into `stock-ledger.js` so these operations share one implementation.

Return receipts contain the latest actual calendar day's catch through arrival. They neither project unworked hours to 19:00 nor disguise several days as a single daily landing. Rows retain their date and observation minute. Rivals then finish the remainder of the day during the harbour interval, without rewriting the already-issued arrival receipt. Harbour fleet news includes the catch date. Save validation rejects malformed fleet dates, recovery watermarks and daily ledgers.

## Verification

`node tests/multi-night-rivals.test.js` directly executes eight named passing regressions:

1. A natural second-day rival arrives and harvests over 350 lb from the same live patch; catch and stock remain conserved through reload.
2. Daily visitor allowances renew exactly once and remain bounded through repeated reloads and sector resets.
3. A legacy prior-day actor leaves visibly without harvesting for tomorrow's same-named team.
4. Complete eight-day catch-up produces the same stock and pressure as daily advancement, with no aggregate catch in the occupied sector and no replay after reload.
5. At-sea season recovery updates live/save state once and is not repeated by rescue or the next harbour day.
6. Rivals finish an early-return day while the player is ashore; the earlier receipt remains immutable and reload does not repeat catch.
7. Invalid fleet/calendar data is rejected before save acceptance.
8. A pending route search spanning midnight cannot commit yesterday's candidate.

Direct related runs also pass: career (9 named tests), save integrity (3), quota areas (7), traffic/coasting (7), fleet life (5), coastal progression (5), and second-video regressions (14). The existing exact-stock persistence fixture now suppresses rival goals during its artificial harbour jump, isolating persistence from legitimate additional harvesting; the new harbour-interval regression separately verifies that harvesting.

Focused ESLint, Prettier and diff checks passed. Full release verification is maintained separately by the release owner.

## Catch-up cost and limits

Catch-up completes every elapsed day synchronously, preserving all stock and pressure consequences. Ordinary ticks and passages cross at most one midnight. An initial measurement completed a 40-day jump in about 687 ms while materializing authored sectors; a warmed 100-day jump took about 221 ms. A separate cold 100-day run under concurrent build/test load took about 3.91 seconds and reached fleet day 100, ambient pressure day 100 and season 12 across all fifteen sectors. These are local measurements, not a device guarantee. An unusually old or externally edited save with a very large unprocessed clock can therefore pause during first catch-up; no days are silently discarded to shorten it.

These tests establish the listed calendar, accounting and physical-rival invariants. Long-season fishing balance and real-device play remain broader acceptance work.
