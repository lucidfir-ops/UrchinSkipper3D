# Water taxis: close drive-bys of the boat — October 5, 2026

Source: designer notes, October 5 ("less aggressive… close drive bys of the player's boat, rather than aiming at the divers"). Supersedes the September 25 bubble-crossing target in Bible §15; recorded there in place.

## What was wrong

When a diver was working, every taxi spawn (`taxiWorkingChance: 1`) sampled an active diver and committed a 30-knot straight run through that bubble or float position (offset 10 m only on days 1–3).

## Change

- The trigger is unchanged: a diver is working and the existing cadence is used. Speed, the commitment at spawn, hull/land avoidance and first-season injury protection are also unchanged.
- The target is now a pass point beside the player's boat, set at spawn: 14–22 m laterally (+6 m on career days 1–3), perpendicular to the navigable run angle and never retargeted (`taxiDriveBy` in `src/taxi-route.js`).
- The side is random. The run is rejected if its straight segment passes within 14 m of any working or surfaced diver position; the other side and a 10 m wider pass are then tried. If no clear run is found, the taxi falls back to the ordinary long-haul route.
- Drive-bys only start from entry points more than 120 m from the boat. A taxi entering beside a boat parked at the sector edge got stuck in hull avoidance during testing.

## Evidence

- Tests updated: `september25` (pass distance 14–32 m, not aimed at the diver, no homing after the boat moves), `working-day` (16/16 spawns are boat drive-bys clear of the harvesting diver), `multi-night-records` (onboarding widening expires with actual days). `traffic-coasting` long-haul test still passes.
- Simulation sample (scratch script; 6 seeds × days 2 and 10 × 5 spawns; boat 12 m from a harvesting diver and a surfaced diver): 55 of 60 taxis drove by. Closest approach to the boat: 13.5 m minimum, 23.2 m median, 36.6 m maximum (19.3 m minimum on day 2). Closest approach to any diver: 11.3 m minimum, 17.4 m median. Before this change the target was the diver position itself.

## Limits

These are centre-to-centre distances. No human playtest yet of how the passes feel.
