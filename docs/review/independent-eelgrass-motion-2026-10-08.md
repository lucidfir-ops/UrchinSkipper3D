# Independent review: eelgrass motion after the round-robin refresh — October 8, 2026

Change under review: `803a9e3`. To fix a Frontier-storm frame rate of about 17 fps, eelgrass refreshed cell by cell (at most every 0.5 s per cell) and showed each new pose at once. Bull kelp still blends at 10 Hz.

Capture: 24 frames 120 ms apart at 640×400 in Frank's cove. The camera was zoomed close over shallow eelgrass, just after the current was reversed. The build was the production build on the Deck GPU.

Reviewer: a separate Claude subagent that did not write the change.
- No must-fix.
- The motion is plausible: the blades lie over into the new current over about 2.5 s, and the kelp leads.
- **Should-fix:** frame differences show grass changing in bursts, heavily in alternate 120 ms steps, consistent with cells snapping to new poses about twice a second. This would probably read as clumps twitching at about 2 Hz.
- Note: grass right of the boat is sparse, which is a density difference, not a fault.

Fix (`82afb28`):
- Each grass instance stores the time of its cell's last refresh (`flowStamp`).
- The grass shader eases from the previous pose to the new one over the 0.5 s refresh interval. Kelp is unchanged.
- The CPU cost is unchanged: one extra float per blade is uploaded when its cell refreshes.

Evidence. Mean absolute frame-to-frame luminance difference over frames 2–15 (ffmpeg `blend=difference`, `signalstats` YAVG):

| Build | YAVG per step |
| --- | --- |
| Before | 2.67 3.18 2.67 3.33 2.67 3.38 3.39 2.64 3.46 2.54 3.38 2.56 3.27 (alternating bursts) |
| After | 2.63 2.66 2.73 2.92 2.94 2.91 2.83 2.91 2.96 2.88 2.78 2.76 2.64 (smooth rise and fall) |

The vegetation suite passes.

Limits: headless captures, not live viewing on a device. The fix was not re-reviewed by the independent reviewer.
