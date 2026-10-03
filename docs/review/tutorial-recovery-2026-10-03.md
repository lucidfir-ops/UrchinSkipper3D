# October 3 tutorial recovery audit and guidance

A fresh keyboard playthrough used the portable edition at `http://127.0.0.1:5198/`, starting from Frank's introduction. Its served `index-CHG5lalE.js` matched the current production bytes from commit `323b0ad` (SHA-256 `55cc72c53c2c416d29181b11186a61c0e6730759b4de98d3bbf660d7a35bd1ec`). Helm, deployment and recall used browser keyboard events; menus used normal controls. Read-only telemetry documented positions and eligibility. No boat, diver, catch or lesson state was injected in this natural run.

The player reached the marked shelf, deployed Ada, collected about 70 lb and recalled her. At the first boarding attempt her float was 5.73 m from the hull and outside the port sector. Pressing `1` deployed Milo, who was still aboard. This is the intended Bible §10 behavior: the command first takes an eligible nearby recovery, otherwise it deploys an eligible aboard diver. It must not be changed merely because the selected portrait belongs to a surfaced diver.

The teaching problem was the lack of a persistent explanation of that next action. Frank continued showing the general recovery paragraph and the keyboard reference continued saying “Deploy / board.” A later approach brought Ada within 2.66 m, but she was still too far forward for port recovery. The small float ring and faint port sector did not explain which condition remained unsatisfied. The run stopped during this first recovery, with both divers surfaced, catch still carried by them and an intact hull. Hidden-ground discovery, harbour return and starter selection were **not** completed in this natural playthrough.

Evidence is preserved in `test-results/novice-continuation-2026-10-02/trace.jsonl` and these screenshots:

- `02-marked-arrival.png`: actual arrival before deployment.
- `03-first-float.png`: Ada surfaced before the premature boarding command.
- `04-board-attempt-deployed-second.png`: Milo deployed after that command.
- `05-close-wrong-side.png`: close range still fails the port-side condition.

The implementation changes only tutorial guidance. Both recovery lessons now resolve the real `actionTarget` and `recoveryStatus`, name an observable float, explain range/side/speed/hull-clearance failures and preview whether the command will deploy the other diver or bring the eligible diver aboard. Ongoing boarding asks the player to hold the drift, including automatic resumption after a rejected approach. Second-recovery retry text refers to the newly found ground. A distant hidden float does not reveal its name or surfacing state. The approach text and optional note retain the stern-danger warning.

The short speech bubble now reads recovery eligibility separately. Previously it checked the existing `playState.reason`, which is a redive reason; its speed-warning branch consequently did not receive `SLOW DOWN`. Existing consumers of that field are unchanged.

Six focused cases in `tests/tutorial-recovery-guidance.test.js` cover:

1. Accurate deployment preview and the unchanged automatic fallback in actual simulation.
2. Distinct wrong-side, speed and hull-clearance instructions.
3. Eligible/ongoing recovery following the real target, including a different selected portrait.
4. Identical advice for distant hidden underwater/surfaced states and hidden catch changes.
5. Appropriate guidance for the second recovery and its retry context.
6. Speed speech using actual recovery status without changing the redive-reason contract.

These cases and the existing related tutorial/simulation tests passed locally. Formatting, targeted lint and whitespace checks also passed. `scripts/tutorial-retry-review.js` retains its earlier actual keyboard approach/catch checks and adds desktop, portrait and landscape recovery captures. The new recovery poses and bag values are explicitly **staged fixtures**; keyboard/native browser touch then initiate the real boarding operation. They are not a substitute for finishing the natural tutorial. The final production result and screenshots are recorded in `test-results/tutorial-recovery-2026-10-03/receipt.json`; independent screenshot review and the release receipt provide the broader verification record. Physical controller and device acceptance remain unverified.
