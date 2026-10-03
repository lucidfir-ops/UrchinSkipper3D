# Shoal escape and actual pickup range — October 3, 2026

A fit surfaced diver on a wet shoal could stop swimming as the skipper approached, even though recovery still rejected the diver as out of range. `swimToPickupWater` checked the default 5 m recovery tolerance while the actual action used the selected difficulty/assist and night tolerance. The reproduced Realistic case had a 2 m action tolerance, a diver 4 m from the port hull, and 1 m water beneath the diver. They remained motionless for 60 simulation seconds; moving the boat away made the escape swim resume. An actual `step` recovery press returned `OUT OF RANGE` while the diver stayed stranded.

The approved behavior in `bible.md` §9 is that fit surfaced divers can swim toward boat-accessible water and that valid or ongoing pickup stops this movement. The escape decision now receives exactly the tolerance used by `stepDiver` for recovery. Standalone calls derive the same difficulty/night tolerance. Movement speed, wet-route checks, port-side and relative-speed gates, ongoing-work priority and injured-diver behavior are unchanged.

`tests/shoal-recovery.test.js` contains five named passing regressions:

- Real simulation rejects the initial Realistic pickup, advances the diver slowly into the actual recovery range, and retains the partial bag.
- The simulation forwards an explicitly supplied action tolerance even if the stored assist setting differs.
- Standalone checks distinguish Easy, Realistic, unlit night and working lights.
- Valid pickup, an ongoing recovery and injury still stop autonomous escape.
- Saving during the escape preserves its physical route; saving again during actual boarding lands the 30 lb partial bag exactly once.

Sixty related named cases also pass through direct Node execution: simulation (23), diver motion (11), touch feedback (9), save integrity (3) and two-diver operations (14). Focused ESLint and Prettier checks pass. The regression fixture uses an isolated wet shelf; it does not change any authored sector terrain.

`scripts/shoal-recovery-review.js` provides the production input check. After staging a fit surfaced diver on an isolated wet shelf, it lets ordinary runtime physics swim them into the actual Realistic pickup range, then requests boarding through keyboard, synthetic gamepad and native browser touch. All three production flows pass: two divers aboard, exactly 30 lb landed once. Screenshots, exact catch and both berth states are recorded in `test-results/shoal-recovery-2026-10-03/`. Synthetic input does not verify physical controllers or phone performance.
