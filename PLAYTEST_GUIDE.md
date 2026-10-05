# Urchin Skipper 3D acceptance

Run the separate 3D project at http://127.0.0.1:5184/. Start with Frank, then check a complete working day. The inherited cases below still apply.

## October 5 checks

1. **Night menus.** Menus open dark. Open Working day return, the Chandlery detail, the boatyard and the departure chart: is everything readable, and is no green panel left? Try Settings → Menu colours: Day and back.
2. **Boat selection.** Drag the large boat picture under the cards; it should turn. On the Deck, focus it and use ← →.
3. **Harbour line.** Fish close to an edge: no warning box should appear. Drive past the amber harbour line with both divers aboard: play continues and a Return to harbour chip appears beside the boat. Tap it (or press H, or use Pause → Return to harbour). Drive back in: the chip disappears.
4. **Diver calls.** Let a diver surface close to the boat (voice) and far away (whistle). Say which voices to keep or drop.
5. **Kelp.** At low tide, long stalks should float on the surface with a bulb and a few trailing leaves. At high tide, mostly bulbs and leaves. Leaves should stream with the current, not splay.
6. **Reload on itch.io.** Reload mid-day several times. If the sea is ever blank, a notice should pause play and offer Reload graphics. If it recurs, turn on Troubleshooting log and send the file.
7. **Taxis.** They should pass close to your boat, not through your divers.
8. **Rotation (touch).** Tap Continue: the game should go fullscreen and turn with the device. Leaving fullscreen keeps it inline; Settings → Auto fullscreen & rotate on touch turns this off.

- Compare High/Balanced/Battery graphics, including reload persistence. Check a wooded coast at near and far zoom, changing tide, rain/fog and night. Watch physical rock crowns and drifting logs.
- Watch people prepare at the rail, enter and descend. In ordinary coastal water their bodies remain visible near the surface, lose contrast below about 2 m and disappear by about 5 m; deeper divers leave bubbles. Surfaced orange floats retain one/two identification stripes. Match drift on the port side; collect a bag, redeploy and board both divers.
- Follow the moving port/stern tutorial guides; open charts, individual orders, pause, the boatyard, crew and logbook. Check keyboard, synthetic controller and touch separately. Physical USB Xbox/Steam Deck must be checked on the actual device.
- Check installed night working lights, fatal/injury surface cues, rival working divers, wakes and inspection boarding.
- Confirm known-ground overlays, fog/night bubble limits and Realistic shallow visibility reveal only permitted information.
- Reload a 3D career and verify fuel, bags, crew and depleted stock. The 2D save key must remain unchanged.
- Tap the visible 3D boat to neutral and centre the rudder, including Frank’s offset tutorial view. Zoom in fully and confirm labelled touch buttons still receive their own taps. Check default control targets and intentionally smaller Tiny/50% choices.
- Inspect desktop 1280×800, short 844×390 and portrait 390×844. All purchase/return confirmations must remain reachable.

For the September 27–28 menu and HUD overhaul, use the [interface review record](docs/review/interface-redesign-2026-09-27.md) and its reproducible browser scripts. Check Back from title, Harbour and water; nested scroll restoration; cancelled purchases and remapping; every Harbour destination through the compact scenic pan; crew availability labels; and saved layout precedence. Recovery checks must include eligible and denied pickup, excess catch, active progress and spoken feedback near the instruments. Compare Easy, Realistic, Custom and All Off independently.

The graphics are a separate translation; passing inherited simulation tests does not prove every visual or physical-device case. Historical descriptions of earlier artwork below do not override the commissioned interface redesign; their gameplay and control checks remain relevant.

## September 28 cohesive operations checks

- Chandlery: compare the engine repower and fuel system, rotate the actual hull preview, inspect before/after figures, cancel a purchase, then install the hauler. The same location should now be fitted in Your boat and at sea. Install every compatible item: station diagrams must never impose an equipment-count cap. Check ownership and operating switches survive hull changes and reload.
- Compare all twelve career hulls and the twenty-five original traffic identities in 3D. Check the two separate Channel Master bows, Island Tender collar, motor arrangements and actual bag footprints. Preserved original artwork remains the reference; a decorative silhouette must not change collision dimensions.
- Follow both people through preparation, entry, descent, work, ascent, pickup approach, bag lift, short port-ladder climb and walk onto deck. Interrupt recovery by failing a safety gate, then resume. One press still finishes bag exchange/redeployment or boarding; catch is credited once. Reload during descent and compare the trajectory.
- Neutral must retain entitled diver information. Compare Easy, Realistic and manually selected information options; nearby visible bodies are physical presentation, and do not authorize distant underwater status. Easy labels should avoid instrument panels. In compact active recovery, the action card replaces a colliding duplicate port callout.
- Judge 2 m visibility at ordinary gameplay zoom as well as close inspection. People are physically small at the widest view; do not confuse a close screenshot with normal-zoom readability. Compare clear weather, rain, dusk, sheltered shallows and deep green water. Kelp belongs in localized stands, independent of harvest locations.
- Maximize both chart renditions: find your vessel and heading immediately. Use Frank's first task with no prior nautical knowledge; optional notes must not be required to understand that task. Review the return task without a long final lecture.
- Drag Sound volume on desktop and phone, use keyboard arrows and controller navigation, leave and reload. Hold Space on an actual preference switch: activation should occur only once.
- Stay offshore through missed offload and a second sunrise. Time alone must not send the boat home. Quality, fatigue, fuel, shipping and deliberate rescue consequences continue; return remains the skipper's decision.

`npm run verify` includes equipment, learning, operations, fleet and traffic galleries plus the thirteen retained browser suites. Re-run individual suites with `npm run verify -- --browsers-only --suite=operations` (or `equipment`, `learning`, `fleet`, `traffic-fleet`). Static phase/depth galleries freeze disposable worlds and need separate visual inspection; the live voyage and input suites verify interaction. Synthetic gamepads do not verify physical controllers.

---

# Playtest guide — September 25 coasts and safety feedback

Player-facing release copy: [HOW_TO_PLAY.txt](HOW_TO_PLAY.txt). This guide below is the detailed testing checklist.

The checklist below is inherited gameplay reference from September 25. Its historical release is in the read-only 2D project. Use this project’s current 3D exports listed in PROJECT_STATUS.md; do not upload into the original game.

Keep testing the familiar 14-inch landscape setup. Portrait is enabled again. Open **Touchscreen Options** from the title, Settings or Pause. Try 70% Tiny controls and 40–60% opacity; UI Scale remains separate. Harbour fills the display. Physical phone/tablet/Deck performance, speakers and USB Xbox controls still need human playtesting.

## September 25 acceptance

- Sail with one unavailable/injured diver assigned. The confirmation names them, explains they cannot work and starts on Cancel. Cancel keeps you at harbour; explicit Yes allows the otherwise valid trip. Neither confirmation nor Godmode makes an unavailable person fit to dive.
- Sleep from the departure plan or Rest from the office. Cancel keeps the same day, money and crew state; Yes advances once. Dock work also confirms before skipping the fishing day. Test keyboard Enter, controller A/B and touch.
- Each map now has 65 beds. Home Coast retains 13 marks; coasts 2–5 have 5/4/3/2 marks and 60/61/62/63 unmarked beds. Quality ranges are 60–85%, 65–90%, 70–95%, 80–100%, 90–100%, including mixed clumps. Existing empty beds stay empty, recovered catch and historical chart samples retain their old values. Explore hidden ground; old reports are not live stock promises.
- Observe stronger aggregate Home Coast landings over several days, with the same one/two physical visitors and occasional nearby work. Later maps retain their richer stock.
- Watch taxis commit to straight runs at sampled bubbles, then curve around the boat without stopping to turn. They do not track a moving diver. Terrain can force another safe route. Keep surfaced divers sheltered by the boat and recover promptly; actual full-speed strikes remain fatal and leave a large red pool. Underwater bubbles are not hit targets.
- Disable Live current instruments: water arrows remain in Easy. Toggle Current arrows on the water independently, switch to Realistic, revisit a later coast and reload. Physical kelp, drift and wake cues remain in both modes.
- Buy a new coast permit. Expect a large ACCESS PURCHASED receipt and Frank’s tale with explicit advice to upgrade. Review stronger boats or go straight to voyage planning. The permit and warning never require an upgrade. Maelstrom storms and Knifepoint current retain their strength.
- Borrow $5,000 repeatedly from Accounts, even beyond the former credit limit. Debt and interest still accrue; repay through the ordinary confirmation.
- Pause → Debug mode → Godmode prevents new boat damage/diver injuries and fuel expenditure, displays a visible banner and survives reload. Turn it off to test ordinary consequences. Existing injuries/losses remain; collision geometry, weather, current, fatigue and dive readiness still apply.
- Compare factory/retrofit bow thrust: roughly 20% gentler, still useful alongside. Look for grounding silt, small injury stains, damaged-boat sheen and bow spray in rough water; these are visual cues, not new simulation rules.

## Earlier keyboard, coasting and traffic checks

- Build speed at full ahead, put the helm fully to either side, then press Space. Expect a small coasting arc, not a large stern slide. Repeat loaded; check that low-current neutral steering still responds both ways.
- Watch the keyboard throttle/rudder key fills: they retain the commanded setting after release; Space clears throttle and Enter centres the rudder. Click Menu in the centre key reference or press Escape. The floating Menu/help button should no longer cover the right-hand keys.
- Arrange UI now names **Tide & current almanac button** directly. Move, resize or hide it independently of Live current. Reload and check the choice. Existing chart-only and diver-card layouts remain yours.
- Zoom out occasionally during a full day. Expect at most one or two new working rivals, usually distant. They should approach marked grounds, stop with bubbles and accumulating bags, reduce the displayed remaining stock, then move on or leave. Nearby work is allowed on roughly 40% of seeded days, at most once; not every eligible day guarantees a visible close encounter. Previously saved visitors finish their existing day.
- Watch taxis complete committed long routes. Some cross a working area, others pass elsewhere; they avoid hulls and retain the existing surfaced-diver collision risk. Check map corners and falling tide. Shy Hull Wood should be exceptionally uncommon.
- Gently nudge a surfaced diver at the bow: the diver should slip aside without traveling stuck to the bow. Dangerous contacts retain consequences. Listen to the quieter, steadier reverse timbre on your speakers/headphones.

## Deployment and tablet follow-up

- With one diver underwater and their portrait selected, press Deploy / board: the eligible diver aboard must deploy. Nearby recovery keeps priority; with both aboard, selection still chooses the diver.
- Recall bubbles beside the bow/stern and working side, up to five metres from the hull. The clang retains its delayed response and never becomes a remote recall.
- On a fresh Easy/Realistic career, Deck load starts on. Saved manual choices remain. On an older labelled minimap, tap **Chart only** below the map; Arrange UI → Chart minimap → Display still offers the labelled Graphic and Plain text alternatives. Reload to confirm the choice.
- Use **Fullscreen & Rotate screen** on Title, Settings or Pause as the phone workaround. Tablet portrait startup and neutral-current helm were confirmed by the designer; phone automatic rotation remains unresolved.
- Reproduce the recording's tutorial exit → starter purchase → Sail journey. The boat and coast should be visible after preparation. The reported blank scene has not yet been reproduced locally. Enable the existing troubleshooting log before a device replay; download it if the scene freezes.
- Compare sustained tablet play near kelp at the same zoom, especially dawn/dusk. Weather shading now reuses unchanged frames and decorative foam updates less often. Keep rain, fog, night lights, collisions and both divers working. Desktop measurements do not establish physical tablet FPS.

## Rotation and helm checks

- On the same Android/Firefox itch setup as the recording, launch normally and touch the game. Rotate between portrait and landscape several times, then background/restore the browser. Check whether automatic recovery works; if it sticks, use Fullscreen & Rotate screen. Also check ordinary inline hosting and deliberate fullscreen exit. Report browser/version and download the troubleshooting log if it sticks; desktop automation cannot confirm the physical sensor/host behavior.
- Load the Coastal Workhorse to roughly 3,300 lb. In light current (about 0.6 knots), face upstream and neutralize the throttle. While water still passes the hull, hold either rudder direction: turning should be clear within several seconds. Once the hull exactly matches uniform drift, the rudder has no water flow to turn it. Compare ahead/reverse and jet/leg behavior with the previous export.
- Compare bow thrust against the previous export, empty and loaded: the bow should swing more gently but remain useful alongside a float. Test factory and retrofitted thrusters and their equipment switch; twin-jet pivot is independent.

## Crew and coast checks

- Select the other diver, then come alongside a float. Bag takes and replaces that one diver’s bag in one press; they descend as soon as the lift finishes if ready. Board collects the nearby diver regardless of selection. With two floats together, finish one exchange before the next. Confirm selecting a specialist chooses between eligible aboard divers and still controls individual orders.
- Offer a bag to a diver with low air, exhausted ground, a nitrogen break, darkness without a torch, or a deck-capacity limit. The diver should explain why in a visible bubble. They keep their catch on deck and wait if the automatic replacement cannot proceed.
- In Orders set 90% quality and a 45-second maximum bag time. Scout a poor unmarked area, then a slow patch. Expect actual sampled quality or a partial bag and a speed complaint, never distant hidden-bed facts. Bag time excludes scouting. Test keyboard, controller triggers, and touch controls in portrait, then reload and swap berths; orders belong to the person.
- Return repeatedly to unchanged ground: ordinary crew should report once. New quality, slower picking, tiredness or a new problem should bring new information. Nell skips casual chatter; Milo and Roy occasionally repeat opinions. Even quiet crew answer a refused bag offer. A first report from a distant surfaced diver becomes readable when you approach.
- Watch a taxi transit: the working pass should be mostly straight, with some routes crossing active ground and others elsewhere. They must route around boats and land. Actual contact with a surfaced diver causes injury or death; submerged bubbles are safe from these strikes. Test medical boarding or radio rescue afterward.
- Compare a rested morning with several hours of work. Picking and swimming should slow and air/current performance worsen. Normal overnight recovery clears most ordinary-day fatigue; very long or night work can leave some carryover. Nitrogen exposure remains separate.
- In each Home Coast map, compare calm weather with a forced storm. Loaded Workhorse in Realistic must back away from an ordinary shore where deeper water is astern at the region’s combined maximum wind/current. Rain, waves and drift remain visible. Compare fifth-coast storms and check the forecast and Frank’s advice before leaving.
- On a drying shoal, let the tide fall until the boat sits firmly on the bottom. It must stay put despite throttle. Stay on the working sea for rising tide to refloat, or Pause → Radio for rescue: the trip ends and the receipt includes the tow/handling charge. Menus pause the tide; close them to wait. Preserve the career before deliberate hazardous testing.

## Working-day checks

- Close/reopen the browser at sea with each owned boat, including sister hulls; compare both Raster/Vector settings. The same boat, equipment, catch and crew should return. Report any shadow-only hull with renderer, boat, screenshot and troubleshooting log.
- In a strong current, select Neutral and centre the rudder while facing upstream. Drift astern; apply full port/starboard and compare shaft, leg/outboard and jet hulls. Jets have no passive nozzle steering. Try a slightly angled heading, an opposing wind and an empty versus loaded large boat. Powered helm/pivot and USB Xbox mappings remain familiar.
- Recover several ordinary bags. A visible surfaced float has an amber approach cue and turns green only when all pickup gates pass. Bring port alongside and match drift; the actual action still chooses the nearest eligible float. Watch for a brief crew bubble and sampled quality on recovery.
- Bags stay red, fixed in size and inside the deck. Fill a small and large boat; later bags overlap and cover gaps. In Realistic, keep Exact deck/diver readouts enabled to see quality.
- Pause → Deck catch lists the bags newest first. Dump a low-quality bag: its original haul time elapses on the working sea, deck pickup is blocked meanwhile, exact weight comes off once, and the bed never regrows. Save/reload during the operation. Check a 2.2-second hauler bag and a 3-second ordinary bag.
- Harbour office → Buyer market, or Sail → departure plan → Buyer market: choose a small order or standard sales. Premium/bulk contacts display sales/safe-return unlocks. At sea the same screen estimates eligible landed weight/bonus if returning now; the order is fixed until the next day. Excess catch still sells normally, and short orders have no fine.
- Local Chart: read report age, reporter and tide phase. Mark a recent sample, then select that personal mark for bearing/distance guidance. It must retain the actual sample point without revealing an unmarked bed outline. Reload and revisit next day; old reports remain dated observations.
- Return to harbour: compare net return, three factual highlights, buyer premium, crew shares and the previous trip. Try an early quality trip and a late offload; gross sales must stay distinct from profit.
- Pause → Equipment switches (also Your boat): toggle lights, hauler, electronics or retrofit thruster. Enabled lights are automatic after dark, feather smoothly and are absent at noon. Switching lights off restores the shorter unlit pickup/visibility range. Each hull retains its own switches after reload.
- Watch for named selfish rivals working the same bed and real depletion of shared stock. Taxis sometimes cut across an occupied bed and warn on an actual close surface pass; they still avoid boats. Shy Hull Wood has a readable nearby name, with hidden crew still private. Event frequency has not been reduced.
- Gameplay Speed defaults to +50%; a deliberate older saved choice remains. The [crew relationship proposal](docs/CREW_RELATIONSHIPS_PROPOSAL.txt) includes the deferred 40-knot passage-weather idea; no new random sinking rule ships here.

## September 23 checks

- From title → Touchscreen Options, turn touch mode on, drag both sliders, then Back. Continue the same career. Repeat from Settings, sea Pause and Frank’s lesson Pause; Back returns to the opener. Toggle Adjust UI / Show information here or with their on-water shortcuts.
- Compare 50, 70, 100 and 150% controls in both orientations. Tiny selects 70%, then you can fine-tune it. Action buttons, gear buttons and both sticks resize; instrument windows keep their own size. Set opacity to 43%, leave and reload. At 0%, Menu/help stays visible so Reset remains reachable.
- Match the supplied phone screenshot’s top instruments, chart/load/current below and bottom helm/diver cards. Existing personal layouts still win; Arrange UI → Reset positions opts into the new defaults. Default action prompts should sit above the controls when their scale changes. Optional text cards still follow your information choices.
- Cold-launch the itch page in portrait with OS auto-rotate enabled. Rotate before touching the game’s Fullscreen button, then after entering/leaving fullscreen and after switching away/back to the browser. Portrait recovery should no longer depend on that particular button. Actual hosted Android behavior still needs this physical check.
- At UI Scale 50/60/70/100/150%, return to Harbour. Pan to Settings on a narrow phone. The header should hug its contents and remain clear of the top row of buttons.
- Compare steady idle, forward and reverse with speakers and headphones. Audio now avoids rebuilding engine loop schedules every frame. Compare motion with volume on/off, initially without screen recording. If choppy, enable Troubleshooting log before a short repeat and download afterward; it now includes frame and audio/viewport details. [Tablet assessment](docs/DOOGEE_TAB_E3_MAX_REPORT_2026-09-23.txt).

## Retained regression checks

- Wait for preparation to finish, then tap Chart quickly and release. The chart should stay open. Repeat while using touch helm controls; closing it must not steer or reopen it.
- With OS auto-rotate enabled, rotate phone/tablet both ways on water and while Arrange UI is open. Clock and pounds remain visible. Make a change in portrait, rotate, change landscape, Save, then revisit both orientations. Adjust UI drag/resize controls should remain usable. On itch, enable Mobile friendly and allow any orientation in the host settings.
- Check red digits stay inside the clock face at default/custom sizes. Minimap → Chart only should show just the map, without labels, backing, border or controls. Graphic mode retains chart controls.
- Reverse and pivot while zoomed in. Propulsion wash and diver bubbles disappear under the opaque hull; deck artwork stays clear. Confirm the existing instrument artwork and landscape arrangement look familiar.
- Work for several minutes, including tide changes and at least two ten-second autosaves, then reload the career. Compare crowded coast/night/fog scenes and training transitions. Initial artwork is prepared up front; a new sector may briefly show preparation while its local raster is painted. No terrain download is deferred into a trip.

## Continuing gameplay checks

1. **Listen to the helm.** Neutral idles quietly. Forward grows louder and higher with throttle; reverse has a distinct whine/flutter. Full throttle should be unmistakable, with stronger wash and wake. Listen for a thin double whistle when a diver surfaces: nearby is loudest, distant fades away. Check the master volume and whether a browser interaction is needed to unlock sound.
2. **Day planning.** Harbour menus pause the clock. A normal day starts at 05:00; choose 07:00 to avoid the early-start fatigue cost, or Sleep → fish next day. Miss 19:00 offload: catch lands at the next 06:00, and the next departure is 09:00. Early departure is unavailable that morning. Later returns add fatigue and age the catch. Diver flashlights allow night work, with double work fatigue; unlit evening departures with no daylight left are replaced by the equipment/rest choice.
3. **Crew.** Compare Base / Trained / Today stats, including precise holding current. Level cap is 20. Fatigue should be noticeable within a working day and mostly recover overnight; very long days can leave some carryover. Medical & absence history records new sickness, injuries and recovery; old saves cannot explain past unrecorded absences. Nitrogen behaviour is preserved.
4. **Layout.** Phone portrait keeps the boat centre clear and touch actions reachable. Arrange UI shows ON/OFF and graphic/text indicators. Move diver cards to the bottom, save, leave and reload. Change something, Back, then Exit without saving: the previous layout should return. Portrait and landscape retain separate saved layouts; touch size does not switch instrument layouts. Reset positions opts into current defaults.
5. **Instruments.** Hull silhouette cracks as damage increases; deck bags show load. Photographic instrument housings have live readouts without blue cards. Minimap defaults to Chart only, with no labels or control buttons; choose Graphic for chart controls or Plain text. Chart key/touch action still opens the large chart. Arrange UI → Timepiece → Clock face cycles every owned clock, including the original red digital one.
6. **Portraits and boat setup.** Meet the crew includes all remaining diver portraits. Your boat and Chandlery show an equipment blueprint by physical station, including dive gear, drive, sounder and compass.
7. **Input.** Keyboard use in a menu selects keyboard input. On water, WASD and arrow clusters show the actual mapped keys and functions; remapping updates them. With a jet, right-stick up/down commands stern turning: twin opposed jets turn tightly, a single sideways nozzle turns in a wider circle. Left-stick horizontal is bow thrust only when installed. Explicit full-ahead/full-reverse cancels a simultaneous pivot command. Rudder and throttle otherwise remain latched.
8. **Grounding.** Easy allows slow powered reverse toward deeper water despite wind. Realistic keeps physical engine-versus-wind handling, with starter conditions bounded so reversing into deeper water remains possible. Neither can drive over a dry sill; wait for tide. The final tutorial reminder explains the selected difficulty and morning offload.
9. **Wildlife and rivals.** Watch for V-shaped geese, gull mobs, occasional eagles and rock sea lions. Nearby sea lions can slow picking temporarily. Surfaced whale strikes incur $35,000–$50,000 fines and increased DFO attention. Rival boats work between bubbles and gradually load bags; more skippers now fish and deplete shared beds. Compare fleet reports and stock over multiple seasons.
10. **Raster and saves.** Import the provided tablet career on Deck; switch boat art Raster → Vector → Raster. Both the player and taxis should draw recognizable boats; failed artwork loads now retry. Repeat Tiny Touch Controls/fullscreen Training Mode entry and Hide/Show UI, then return to the real career. Exported career JSON now includes a bounded local troubleshooting snapshot. For intermittent hangs, also enable the detailed troubleshooting log before reproducing and export it after.

## New grounds

All original nine maps remain. Later coasts have fewer chart marks but abundant actual stock. The two new permits each open three maps on the existing season-day 1/3/5 schedule:

- **Maelstrom Coast ($60,000):** Knifepoint Race (shoreline race and headland eddies), Boulder Garden (high-water entry, low-water shelter), Needle Sluice (jet access).
- **Outer Reaches ($100,000):** Seventy Foot Shelf (18–21 m premium ground), Devil’s Elbow (remote deep headland), The Locked Vault (remote, deep, jet-access tidal basin).

Sound the basin gate before entering. At low water even jets cannot leave; the rising tide opens a longer window for jets than deeper boats. The sheltered basin contains exceptionally fast, 100%-quality picking. Bring fuel, rested crew and suitable night/deep-diving equipment. Deep ground remains within the game's existing depth system. Watch tides in the almanac and the actual sounder; Debug tide overrides can demonstrate access, but normal-tide trips are the balance test.

Export a career before a long test. Named restore points and automatic day-start saves remain additive and local to the browser; loading preserves the current career in an archive. Never clear browser storage as a routine test step. New tuning deliberately increases pressure; the enjoyable number of seasons remains a playtest question.
