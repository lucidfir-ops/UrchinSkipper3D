# Verification runner readiness audit — October 3, 2026

The historical verification process exit of 143 remains unexplained. Its receipt records all eight browser suites passing before the process ended, and the owner reports no explicit termination. This audit found a separate, reproducible startup hang; it does not establish that the hang caused the historical exit.

## Lifecycle reproduction

The audit used an instrumented copy of `scripts/verify.js`, the real `scripts/serve-build.js`, isolated port 5291, and eight lightweight HTTP-only child processes in place of browser suites. It retained the npm launcher, shell redirection, readiness and shutdown paths. Instrumentation recorded child exits, signals, exact server-child termination, and remaining handles. No process groups were terminated.

- The short run completed in 3,529 ms with parent and server exit code 0, no external signals, no remaining handles, and an 11 ms server shutdown.
- A 151,250 ms run approximating the historical matrix duration also completed with parent and server exit code 0, no external signals, no remaining handles, and a 12 ms server shutdown.
- The original readiness function stayed pending for at least 11,508 ms when an HTTP listener accepted a request but sent no response headers. It settled only after the fixture closed the connection. The preflight probe runs before the old retry loop, so that loop could not bound this case.

These are lifecycle probes, not reruns of the eight browser suites. Their source copies, trace files and receipts are local artifacts under `test-results/runner-lifecycle-audit/`; the initial summary is `summary.json` and the stalled-listener receipt is `ready-stall.json`.

## Narrow change and focused verification

`scripts/verify.js` now uses a HEAD request with a 750 ms abort deadline for each readiness probe, including preflight. An unexpected response body is explicitly cancelled. Startup has a 10-second elapsed-time deadline; each probe and retry delay is capped by the remaining time. An owned server that exits or fails to spawn produces an explicit startup error. The existing exact-child shutdown behavior is unchanged.

Focused local listener checks extracted the updated readiness function directly from the source:

| Fixture                          | Result    | Elapsed                    |
| -------------------------------- | --------- | -------------------------- |
| Correct production/Three headers | Ready     | 36 ms                      |
| Wrong edition                    | Not ready | 6 ms                       |
| Wrong build                      | Not ready | 4 ms                       |
| Listener never sends headers     | Not ready | 752 ms for a 750 ms budget |
| Same stall near overall deadline | Not ready | 76 ms for a 75 ms budget   |
| No listener                      | Not ready | 3 ms                       |

All five received requests used HEAD; all five fixture connections were observed closed after cleanup. Results are in `bounded-readiness.json`.

An owned stalled server failed with `Production server not ready within 10 seconds.` at approximately 10.06 seconds, then the verifier exited 1 and released its server child. A pre-existing stalled listener failed in 3,368 ms with `Production server exited before readiness (1)` after the owned server reported its occupied port; the verifier exited 1. The real production server plus eight HTTP-only children completed in 3,650 ms, with both parent and server exiting 0 and no remaining handles. Evidence is in `bounded-stall.log`, `bounded-stall-events.jsonl`, `occupied-stall-summary.json`, `bounded-ready.log` and `bounded-ready-events.jsonl`.

Prettier, ESLint and `git diff --check` passed for the runner change. No broad browser matrix was run for this audit. The startup fix addresses the reproduced hang only; it is not evidence of a cause or cure for the historical post-suite exit 143.
