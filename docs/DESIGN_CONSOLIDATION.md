# Living Bible provenance

The designer commissioned this documentation consolidation on September 23, 2026 after discussing obsolete decisions and scattered amendments. [bible.md](../bible.md) is now the single current design document. This file records sources and migration choices, not another specification or an implementation checklist.

## Migration and fresh designer decisions

The former DOCX, old retrieval mirror/embedded image and DOCX-editing recipe were moved intact to the [design archive](../archive/design/2026-09-23/README.md). The [preservation receipt](../archive/design/2026-09-23/preservation.json) records byte hashes. The living document keeps the original 23 section numbers so historical section citations remain interpretable.

The current conversation supplies the authority transition, the permanent two-diver boat constraint (§§2/8), the canonical mystery-vessel name (§16), and fresh qualified approval of the Settings reference (§23). The designer's two clarification replies were “an approved reference within reason” for Settings and “Shy Hull Wood” for the vessel. No gameplay change was requested or made by this migration.

Earlier sources below are the project's records of explicit designer amendments, not a claim that every original conversation has been independently recovered. Their historical bodies remain intact apart from repaired links and clearly separated status headers. The September 20 Settings edit is recorded as an actual physical DOCX addition; the old blanket claim that the whole DOCX was unchanged is retired.

## Source map

The full original vision is preserved in the [archived definitive v2 DOCX](../archive/design/2026-09-23/Urchin_Skipper_Bible_Definitive_v2.docx). Unchanged intent is consolidated throughout §§1–23; the following records supply subsequent decisions. Read the living sections for current rules rather than reconstructing their chronology.

| Source record | Living Bible sections / contribution |
| --- | --- |
| [Explicit September 14 decisions in v2 implementation](V2_IMPLEMENTATION.md#explicit-september-14-amendments) | §§3, 6, 9, 11, 16, 18–19: supplied fleet art, Tender load speed, fictional exposure, Realistic readouts and controls. Later implementation-only entries are not independently promoted to design. |
| [Touchscreen and diving](FEEDBACK_TOUCH_AND_DIVING.md) and [exposure explanation](DIVE_EXPOSURE.md) | §§3, 5–6, 8–10, 14–15, 19: retrofit/sisters, starter art exception, dive readiness/recovery, skills, hidden grounds and touch. |
| [September 15](FEEDBACK_SEPTEMBER15.md) | §§8, 10–11, 14, 16, 19: person-owned orders, boarding, undersize, 32-person roster, inspection interaction and jet pivot. |
| [itch follow-up](FEEDBACK_ITCH_TEMP.md) | §§7–9, 12, 19: scouting, added grounds, night work, forecast, world pace and departure. Later shop/layout/hazard rules supersede affected details. |
| [Keyboard/remapping](FEEDBACK_KEYBOARD_CONTROLS.md) | §19: keys, capture, per-device preservation and Escape/browser behavior. |
| [S22 and Frank](FEEDBACK_S22_FRANK.md) | §§6, 13, 15–16, 21: purchase confirmation, current ordinary patrol schedule, injury/premiums, introductory lesson. |
| [Frank/travel](FEEDBACK_FRANK_TRAVEL_NAVIGATION.md) and [menu history](FEEDBACK_MENU_HISTORY.md) | §§10, 12, 18, 21: working-side teaching, exit fade and navigation, subject to later sea-menu return corrections. |
| [HUD windows](FEEDBACK_HUD_WINDOWS.md), [harbour shops](FEEDBACK_HARBOUR_SHOPS.md) and [boat card/harbour](FEEDBACK_BOAT_CARD_HARBOUR.md) | §§3, 6, 18, 21, 23: independent usable windows, explicit purchase controls, scenery and approved button relocations. |
| [Compact information and repeat training](FEEDBACK_S22_LATEST.md) | §§18–19, 21: modular information, custom presets, selection/controls and career-isolated practice replacing the player-facing cheat arcade. |
| [Shore hazards](FEEDBACK_SHORE_HAZARDS.md), [minimap/layout](FEEDBACK_MINIMAP_LAYOUT.md) and [chart sizing](FEEDBACK_CHART_LAYOUT.md) | §§4, 12, 18: physical hazards/partial surveys, bounded persistent logs, local sounder and stored UI geometry. |
| [Season/economy](FEEDBACK_SEASON_ECONOMY.md) | §§5, 13–16: nine-day seasons, physical coasts, persistent stock/pressure, permits, records and contact balance. Numerical analysis is not proof of final fun/balance. |
| [September 20](FEEDBACK_SEPTEMBER20_DEVICES.md) | §§3–4, 12–13, 18–21, 23: save preservation, automatic insurance, sea-menu returns, editor/instruments, fullscreen, cove and Settings image. |
| [September 21](FEEDBACK_SEPTEMBER21.md) | §§4–7, 12–18: portrait restored, harbour/morning/offload timing, cumulative fatigue/level 20, five coasts, tidal basins, rivals, wildlife and art. |
| [September 22](FEEDBACK_SEPTEMBER22.md) | §§3, 18–20: prepared content, persistent chart tap, independent instruments/rotation and presentation efficiency without simulation redesign. |
| [September 23](FEEDBACK_SEPTEMBER23.md) | §§3, 18–20, 23: Touchscreen Options, Tiny control scale, opacity, orientation, portrait defaults and preserved audio. |
| [Standing working/backup policy](../AGENTS.md) | §§1, 20, 22: selected GitHub backup and additive TEMP releases supersede earlier no-GitHub instructions. |

## Supersession checks

The consolidation resolves old vs current rules in place: two berths rather than deferred larger crews; fictional exposure rather than literal Navy tables; Realistic's explicitly permitted instruments/readouts; current DFO schedule/fines rather than time-only or opening-two-day visits; automatic insurance rather than arming; repeat training rather than the normal developer arcade; nine-day/five-coast progression; tidal basins and Easy grounding assistance; current offload/rest timing; portrait support; Tiny control scaling rather than Fit/Tiny UI; and corrected sea-menu returns.

The harbour reference has an intentional distinction between composition and labels: the explicit later three-button relocations govern placement. The Settings image is approved subject to later responsive/touch decisions. The old ambiguous vessel spelling is replaced by the designer's answer in the living text, leaving originals untouched.

Specific cache/audio implementation rates, migration versions, fixture results and obsolete numerical calibrations remain in technical/history records. Current major gameplay numbers are labelled tunable in the Bible. The archived v1.2/prototype lock and September 11 feedback are not fallback requirements. [Gameplay recommendations](GAMEPLAY_RECOMMENDATIONS_2026-09-23.txt) and Claude's review remain proposals/analysis; this cleanup does not authorize their implementation.

## Verification record

Checks and results for this documentation migration are recorded in [PROJECT_STATUS.md](../PROJECT_STATUS.md#verification-and-latest-exports). Pre-edit human documents are preserved locally under `docs/history/2026-09-23-bible-consolidation/before/`. Runtime source, tests, maps, assets and package/build configuration are unchanged. Existing playable exports remain the current release; no duplicate gameplay export is needed for this documentation-only update.

## September 23 crew-and-coasts follow-up

The designer’s follow-up in the implementation conversation explicitly requests informative, non-repeating diver bubbles and personality variation; quality/bag-speed feedback, particularly on unmarked ground; automatic alongside targeting and one-press take/give exchanges while retaining specialist deployment selection; occasional straight taxi passes with physical injury/death; stronger within-day and weaker between-day fatigue; starter-safe storms, harsher fifth-coast weather, Frank’s forecast advice and falling-tide stranding with waiting or paid rescue. Incorporated in living Bible §§4, 7–10 and 14–16. Numeric presets, regional caps and fatigue coefficients are autonomous reversible tuning, not separately dictated designer values.

## September 24 video follow-up

After the [September 23 recording review](history/2026-09-24-sep23-video-review/README.md), the designer explicitly requested implementation of the missed changes. Living Bible §§5 and 19 now require noticeable neutral rudder response in light current, a modest bow-thruster reduction and automatic phone orientation recovery without the manual Fullscreen workaround. The review identifies the three clips and timestamps. The 20% thruster reduction and light-flow curve are autonomous reversible tuning choices. The longer weather clip's concluding preference remains starter-safe storms, already incorporated in the prior update; it does not authorize a global wind/reverse rebalance.

## September 24 tablet follow-up

Designer chat explicitly removes portrait-selection dependence for deployment when an eligible diver is aboard, preserves future specialist selection, requests “Fullscreen & Rotate screen”, confirms the neutral-current rudder correction and reports tablet lag plus working tablet portrait startup. Supplied recording: `feedback/screen-20260925-020039.mp4` (11:06; original retained locally). Frame/audio review also identifies a blank departure around 02:55–03:30, recall requested within pickup range, deck load wanted on by default, and a plain minimap wanted while retaining the labelled version as an option (around 08:08–10:45). Approved behavior is recorded in Bible §§10, 12, 18 and 19. The blank scene and physical tablet performance are observed defects, not approval to remove gameplay. [Implementation and evidence](history/2026-09-24-deploy-and-tablet/README.md).

## September 24 keyboard follow-up

This entry is superseded where specified by the September 25 decisions below.

Designer request in chat plus `feedback/9-24 keyboard/2026-09-24 20-22-39.mp4` (08:18) and screenshots `Screenshot_20260924_201556.png`, `Screenshot_20260924_202036.png`, `Screenshot_20260924_203018.png`. Original media is untouched. Reviewed full-recording sampled frames, closer 01:50–02:20 handling frames, all screenshots and a local small.en speech transcript. The first two screenshots show Lucky Sound and Tide Turner lingering by the shore; the video shows excessive coasting yaw, confused nearby traffic, the desired straight taxi pass, and keyboard/UI concerns.

Explicit newest decisions: sharply reduce full-speed neutral stern swing while keeping current/rudder response; prefer marked grounds for rival fishing; one or two distant working visitors per day with occasional nearby work every two or three days; taxis choose committed long map passages with a tunable chance of crossing the working area; massively reduce Shy Hull Wood appearances. The spoken feedback also requests keyboard command gradients, clearer almanac layout control, unobstructed Menu access, less eerie reverse audio and less sticky harmless bow/diver contact. Chart-only is already the new-layout default and chosen saved presentations remain respected. The fatigue remarks describe the existing progression/trait intent and do not replace the approved within-day fatigue design. Living Bible §§3, 6, 15, 16 and 18 now contain these decisions. Counts, probabilities and force curves are reversible implementation tuning. [Review and verification](history/2026-09-24-traffic-and-coasting/README.md).

## September 25 coasts and safety

The designer’s implementation request supplies `feedback/9-25/2026-09-25 16-00-33.mp4` (00:41) and `2026-09-25 16-20-17.mp4` (17:30), plus explicit written decisions now incorporated in Bible §§5–7, 13–16 and 21. Reviewed sampled frames throughout both; the short clip shows repeated taxi turns near the working boat, and the long clip shows UI changes, difficult Maelstrom working and boat shopping. Its local automatic transcript is mostly unrelated background media, so it supplies no additional design decisions.

Approved: confirmations for unfit-crew departure and sleeping away a day; richer later coasts with the stated five quality bands and progressively more unmarked ground; stronger starter-area pressure without more nearby rivals; straight bubble-directed taxi passages curving around hulls; fatal blood pools; gentler bow thrusters; independent water arrows governed by information mode; unmistakable access purchases with Frank’s lost-fishermen stories and upgrade advice, never a departure block; repeatable $5,000 development borrowing; live Debug Godmode; additional environmental cues preserving established simulation. Explicitly retain Maelstrom weather and Knifepoint current. Treat areas 1–5 as the five coasts, applying each range across all three maps. Exact bed counts, thruster coefficient, pressure factors and decorative effects are reversible implementation choices. [Implementation and evidence](history/2026-09-25-coasts-and-safety/README.md).
