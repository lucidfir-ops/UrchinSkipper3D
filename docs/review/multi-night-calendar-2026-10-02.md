# Multi-night career calendar — October 2, 2026

Continuous voyages already retain player control across midnight, but several event records still used the departure date. This revision separates the event calendar from the unchanged voyage identity.

## Reproduced defects

A voyage departing on career day 1 and reaching trip minute 9,240 is on calendar day 7. Before this change:

- A new DCS injury was eligible for work on day 6. Rescue and the next harbour day made the diver fit on day 8, only hours after the injury, instead of preserving the five-day absence.
- New collision injuries likewise counted their three-day absence from departure. Separately, carrying an already-injured assigned diver on another voyage restarted that absence despite no new injury.
- Taxi contact still used day-one near-miss protection, and consecutive dive-day records stayed on day 1.
- New ground reports and marks were dated day 1. The chart described day-one observations as “Today”.
- A whale strike's increased patrol attention ended on day 7 instead of day 13.
- An ordinary day-three patrol was never due when the absolute trip clock reached its scheduled time: the due check compared the entire trip clock against the 14:00 cutoff.

## Changes

`careerDayAt(world, minute)` computes actual calendar dates from the existing monotonic trip clock. It does not mutate `career.day`; saved voyage IDs, buyer agreements, settlement identity and the next-day transition retain their existing departure-date basis.

Medical availability and history use the actual injury date. Collision settlement uses the latest actual injury incident, excluding previous harmless contact, and does not restart an existing absence without another injury. DCS retains its five-day absence and ordinary contact retains three days. Exposure records advance consecutive working days across midnight.

Taxi collision consequences, avoidance and sampled route offsets share the same actual-day protection. Days 1–3 remain near-miss only; days 4–9 allow injury; later days retain normal consequences.

New chart reports, depth measurements, plotter tracks and personal marks use actual dates. Marking an old report retains its original observation date. The chart calculates report age against the actual day and shows that day with the local clock. Existing records are not rewritten or assigned invented dates.

Patrol schedules accept an explicit actual day while preserving the existing seeded single-day schedule. Due checks use local time, retain the 14:00 cutoff and do not queue missed visits. An active call or boarding finishes before another can begin; yesterday's clearance no longer suppresses every subsequent day at sea. Inspection identity and random detection remain tied to the call's original day even when boarding finishes after midnight. Whale-strike attention extends through the actual incident day plus six, preserving the existing fine and once-per-animal behavior.

## Focused verification

`tests/multi-night-calendar.test.js` adds five regression cases:

1. DCS on day 7 remains unavailable through day 11 and becomes medically fit on day 12, including rescue and save/reload.
2. A day-seven collision remains unavailable until day 10; carrying the injured person on the next voyage does not extend recovery.
3. Exposure records advance across midnight and reset the consecutive-day count after a skipped working day.
4. Real taxi collision outcomes change at actual days 4 and 10, including reload.
5. Taxi motion follows the same protection boundary.

`tests/multi-night-records.test.js` adds five further regression cases:

1. Old and new knowledge retain distinct dates across save/reload; rendered chart markup shows “6 days ago”, “Today” and the actual day-seven clock.
2. Forty continuous-voyage calendar days produce the same scheduled inspection dates as forty separate days, with no repeated completed visits after reload.
3. A day-seven whale strike is fined once and remains subject to daily increased attention through day 13.
4. An inspection spanning midnight keeps its officer and consumes only the original patrol day; the subsequent visit still respects its own time window.
5. Taxi spawn offsets expire on actual day 4.

The ten related test files passed together: `multi-night-records`, `multi-night-calendar`, `expedition`, `stabilization`, `september15`, `september21`, `s22-feedback`, `touch-feedback`, `traffic` and `september25`. Focused ESLint, Prettier and `git diff --check` also passed.

These deterministic fixtures verify the listed calendar consequences. They do not establish long-voyage balance, physical-device acceptance or a general audit of every calendar-dependent career system. Full release tests, production build and runtime presentation evidence are recorded separately by the release workflow.
