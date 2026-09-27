import { boatDefinition, boatSpec } from './boats.js';
import { C } from './config.js';
import { boatFamily } from './vessel-catalog.js';

const HANDLING = {
  basic:
    'Your shaft boat likes a little ahead power over the rudder. Centre the rudder before a long straight run; reverse has less steering authority. Leave room for the turn.',
  thruster:
    'Use the bow thruster in short bursts at low speed to swing the bow. It fades as speed rises. The main rudder still needs flow; settle alongside before handling a bag.',
  sterndrive:
    'That steerable leg turns the thrust itself. Small ahead or reverse inputs give good control, but keep the exposed leg away from rocks and floating timber.',
  outboard:
    'The Tender turns neatly under thrust and gets home quickly. Its small deck fills first. Give rocks and timber a wide berth: that exposed outboard is vulnerable.',
  jet: 'The single jet can work in shallower water, but still needs thrust to steer. Neutral coasts. It is a working boat at ten knots, so budget the passage time.',
  twinjet:
    'Select neutral, then hold right stick up to pivot port or down to pivot starboard. Release to coast. Left stick sideways operates a fitted bow thruster independently.',
};
export function coastWarning(coast) {
  const tales = {
    storm:
      'I watched a little wooden boat leave in sunshine. The wind swung across Stormbreak that afternoon. We found her empty fish boxes a week later.',
    frontier:
      'Two brothers took a tired old hull past Wreck Teeth. A shallow rock opened her seams, then the weather turned. Neither came home.',
    maelstrom:
      'A skipper I knew tried Knifepoint in an underpowered boat. The race set him onto shallow rocks before the next squall arrived. We never found the crew.',
    outer:
      'Out there, a calm morning can turn savage before you have the bags aboard. A weak boat went down beyond the shelf last season; the search boats came home alone.',
  };
  return `Frank: “${tales[coast.id] || tales.storm} Upgrade to a stronger, more capable boat before you go to ${coast.name}. Watch the shallow rocks, check the changing weather and leave yourself power to get clear. The permit lets you sail; it does not make your boat safe. The choice is yours.”`;
}
export function frankAdvice(w, bind) {
  const boat = boatDefinition(w.boat.configuration),
    family = boatFamily(boat.id),
    spec = boatSpec(w);
  return `Meet the boat: ${boat.name}.
${HANDLING[family]}${family === 'basic' && spec.bowThrusterStrength ? ' Your fitted bow thruster adds low-speed sideways bow control; hold left stick left or right.' : ''}
${boat.controls}
${Math.round(spec.maxSpeed * C.knotsPerMps)} knots at this load · ${spec.capacity.toLocaleString()} lb deck · ${spec.travelBurn} L/h passage. Keep fuel for the return and a reserve.

Drop on promising bottom. The sounder shows depth; kelp and the chart help you find a reef edge. ${bind('recoverDiver')} deploys the selected diver. ${bind('cycleDiver')} selects the other berth. ${bind('instructions')} / ${bind('quickOrders')} changes the search direction, minimum quality and maximum bag time. ${bind('recall')} recalls bubbles within 5 m; listen for the clang and allow 2–5 seconds for a response.

Bring the float to port and match its drift. Pickup speed is relative to the float: drifting together at two knots is fine. Keep the float outside the hull and away from powered propellers.

${bind('work')} takes and replaces one diver’s bag with one press. They go straight back down if air, ground and dive allowance permit; otherwise they tell you why. Both bag work and boarding use the diver alongside, regardless of your selected portrait. Selection still chooses who scouts or deploys next. ${bind('recoverDiver')} brings diver and any catch aboard, supplies an empty bag and a fresh tank. Partial bags stay safely on deck. The next deployment starts a new search.

When diver readouts are enabled, check the surfacing reason: full bag, air reserve, exhausted ground, a table break or the quality order. Fresh tanks do not clear accumulated dive exposure; heed requests for surface intervals. Repeated deep days can lead to suspected decompression sickness and a medical return. These are fictional game tables, never real dive guidance. Reports are written to the chart as the catch comes aboard.

Sometimes your divers pick undersize and there’s nothing you can do.

The Home Coast gets only weak storms. Later coasts have worse conditions; the fifth coast can get vicious. I have known fishermen lost when weak boats met shallow rocks and a sudden change of weather. Upgrade to a stronger boat before you go. Check the forecast before you fish. If you ground on a falling tide, reverse into deeper water while you can. Once stranded, you can wait at sea for rising water or radio for a paid tow through Pause.

Fatigue builds through the working day, slowing picking, swimming and current holding. A normal night clears most of it; very long days can leave a little behind.

An early departure before 07:00 adds 6% fatigue once; darkness also makes unlit work harder. Rest ashore or warm up the crew at sea. Experience builds over worked trips; check each diver's level in Meet the crew.

${bind('debug')} cycles the permitted information presets: Easy / Realistic / All Off in Easy careers, Realistic / All Off in Realistic careers. ${bind('assists')} opens the assists menu. For identity and selection only, disable Diver indicators and enable the portrait-only selector. ${bind('chart')} opens your current area's chart. ${bind('almanac')} opens tides, or use the Tide & current almanac button. Bring both divers home across the marked harbour edge for 19:00 offload. Injuries need medical help; sinking or a fatality needs radio assistance.`;
}
