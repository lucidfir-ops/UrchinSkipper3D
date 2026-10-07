// Headless career bot for balance play-testing. It plays whole careers through the
// real game code: harbour actions call the same career functions as the menus,
// and every working day is sailed with the real helm, physics, diver AI, recovery
// gates, weather, rivals, inspections, settlement and overnight rollover.
//
// Information it uses, all of which a player also has: marked (charted) beds,
// the bathymetry shown on charts and the sounder, where its own divers surfaced
// and what they brought up, forecast wave heights, prices and its own accounts.
// It never reads live stock, unmarked bed positions or hidden quality.
//
//   node scripts/career-bot.js --style=average --seed=7 --days=60 [--boat=basic]
//   node scripts/career-bot.js --sweep [--days=60] [--jobs=4]
// Per-day rows go to test-results/career-bot/<run>.csv.
import '../tests/matter-helper.js';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { fork } from 'node:child_process';
import { careerWorld, nextCareerDay, encode, decode } from '../src/career-save.js';
import {
  createCareer,
  buyAreaAccess,
  buyEquipment,
  buyVessel,
  credit,
  crewContact,
  hireCrew,
  repairQuote,
  serviceBoat,
  departureReady,
} from '../src/career-state.js';
import { chooseFirstBoat } from '../src/starter-career.js';
import {
  chooseGround,
  latestDeparture,
  groundTrip,
  requestRescue,
  rescueStatus,
} from '../src/day.js';
import { areaOpen } from '../src/season.js';
import { COASTS, coastTier, coastFor } from '../src/coasts.js';
import { boatSpec } from '../src/boats.js';
import { FLEET, UPGRADES, rankOf } from '../src/career-data.js';
import { crewProfile, crewRoster } from '../src/crew-roster.js';
import { conditionsAt } from '../src/weather.js';
import { chooseBuyer, marketOffers } from '../src/buyer.js';
import { equipmentAvailability } from '../src/equipment-fit.js';
import { subAreaRecord } from '../src/quota-areas.js';
import { answerPatrol } from '../src/fishery.js';
import { returnAvailable } from '../src/departure-transition.js';
import {
  step,
  deploymentStatus,
  recoveryStatus,
  rediveStatus,
  setInstructions,
} from '../src/simulation.js';
import { depthAt } from '../src/terrain.js';
import { C } from '../src/config.js';
import { currentAt } from '../src/environment.js';
import { pickupTolerance } from '../src/assists.js';

// Play styles. Numbers are the bot's habits, not game tuning.
export const STYLES = {
  // Rests when tired or in rough weather, keeps a cash cushion, comes home early,
  // only fishes 70%+ ground, repairs promptly, buys modest safety/convenience kit.
  cautious: {
    minQuality: 0.7,
    homeMargin: 70,
    restFatigue: 0.4,
    waveRatio: 0.6,
    repairBelow: 0.92,
    reserve: 8000,
    borrow: false,
    coastReserve: 25000,
    shopping: ['lights', 'plotter', 'hoist', 'tank', 'torch'],
    boats: [],
    restEvery: 5,
    nightWork: false,
  },
  // A reasonable player: fishes most days, buys sensible kit, upgrades boat and
  // coast when cash comfortably allows, accepts ordinary weather.
  average: {
    minQuality: 0.6,
    homeMargin: 35,
    restFatigue: 0.6,
    waveRatio: 0.9,
    repairBelow: 0.8,
    reserve: 4000,
    borrow: false,
    coastReserve: 10000,
    shopping: ['torch', 'lights', 'hoist', 'plotter', 'tank', 'engine', 'fuel-system', 'forecast'],
    boats: ['thruster', 'jet', 'twinjet'],
    restEvery: 0,
    nightWork: false,
  },
  // Pushes everything: Any quality, works past the offload deadline and into the
  // night with torches, ignores fatigue, borrows, buys the next coast immediately.
  greedy: {
    minQuality: 0,
    homeMargin: -150,
    restFatigue: 0.95,
    waveRatio: 1.4,
    repairBelow: 0.45,
    reserve: 500,
    borrow: true,
    coastReserve: 1500,
    shopping: ['torch', 'engine', 'hoist', 'lights', 'tank'],
    boats: ['sterndrive', 'jet', 'twinjet'],
    restEvery: 0,
    nightWork: true,
  },
};

const hyp = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  angle = (v) => Math.atan2(Math.sin(v), Math.cos(v));
const neutral = { neutral: true, centerRudder: true };
const CSV_FIELDS = [
  'run',
  'style',
  'seed',
  'day',
  'action',
  'area',
  'coast',
  'boat',
  'cash',
  'debt',
  'cashChange',
  'catchLb',
  'bags',
  'quality',
  'landedLb',
  'landedQuality',
  'pricePerLb',
  'market',
  'value',
  'buyer',
  'buyerBonus',
  'crewPay',
  'fuelCost',
  'premium',
  'net',
  'onTime',
  'lateMinutes',
  'arrival',
  'fuelPct',
  'hull',
  'drive',
  'repairDue',
  'fatigueA',
  'fatigueB',
  'conditionA',
  'conditionB',
  'crew',
  'injuries',
  'fatalities',
  'stockMarkedPct',
  'stockAllPct',
  'subAreaHealth',
  'bedsTried',
  'bedsDry',
  'recoveryFailures',
  'diverSurfaceReasons',
  'purchases',
  'rank',
  'xp',
  'note',
];

// ---------- harbour decisions ----------

function cashFree(w, style) {
  return w.career.cash - style.reserve;
}
function shop(w, style, log) {
  const c = w.career;
  for (const id of style.shopping) {
    const item = UPGRADES.find((u) => u.id === id);
    if (!item || cashFree(w, style) < item.price) continue;
    if (!equipmentAvailability(w, item).ok) continue;
    // The repower is only worth it once ordinary cash comfortably exceeds it.
    if (id === 'engine' && c.cash < item.price * 2) continue;
    if (buyEquipment(w, id).ok) log.push(`${id}@${item.price}`);
  }
}
function considerBoat(w, style, log) {
  const c = w.career;
  for (const id of style.boats) {
    const def = FLEET[id];
    if (c.fleet[id] && !c.fleet[id].lost) continue;
    if (rankOf(c) < def.rank) continue;
    if (FLEET[w.boat.configuration].capacity >= def.capacity && id !== 'sterndrive') continue;
    if (c.cash - def.price < style.reserve + 3000) continue;
    if (buyVessel(w, id).ok) {
      log.push(`boat:${id}@${def.price}`);
      serviceBoat(w, 'fuel');
      return;
    }
  }
}
function considerCoast(w, style, log) {
  const c = w.career;
  for (const coast of COASTS.slice(1)) {
    if (c.coastAccess.includes(coast.id)) continue;
    if (c.cash - coast.accessCost < style.coastReserve) return;
    if (buyAreaAccess(w, coast.id).ok) log.push(`permit:${coast.id}@${coast.accessCost}`);
    return;
  }
}
function considerCrew(w, style, log) {
  const c = w.career;
  // Replace unavailable people with the best fit person who will come.
  const candidates = crewRoster(c)
    .filter((p) => !c.crew.includes(p.id))
    .filter((p) => {
      const r = c.people[p.id];
      return r && r.condition === 'fit' && r.availableDay <= c.day && !crewContact(c, p);
    })
    .sort((a, b) => (b.harvestRate || 1) - (a.harvestRate || 1));
  for (const slot of [0, 1]) {
    const current = w.divers[slot],
      profile = crewProfile(c, c.crew[slot]),
      unfit = current.condition !== 'fit' || (c.people[c.crew[slot]]?.availableDay || 0) > c.day;
    const better = candidates[0];
    if (!better) return;
    const upgrade =
      style !== STYLES.cautious && (better.harvestRate || 1) > (profile?.harvestRate || 1) + 0.12;
    if (unfit || upgrade) {
      if (hireCrew(w, better.id, slot).ok) {
        log.push(`hire:${better.id}`);
        candidates.shift();
      }
    }
  }
}
function chooseOrder(w, expectedLb, style) {
  const offers = marketOffers(w.career).filter(
    (o) => o.unlocked && o.minQuality <= Math.max(0.6, style.minQuality + 0.1),
  );
  const best = offers.sort(
    (a, b) =>
      Math.min(expectedLb, b.target) * b.premium - Math.min(expectedLb, a.target) * a.premium,
  )[0];
  chooseBuyer(w, best?.id || 'standard');
  return best?.id || 'standard';
}
function chooseArea(w, style, mem) {
  const c = w.career,
    tolerance = boatSpec(w).waveTolerance;
  const open = COASTS.flatMap((coast) => coast.sectors).filter(
    (id) => areaOpen(c, id) && groundTrip(w, id).ok,
  );
  const scored = open
    .map((id) => {
      const wave = Math.max(
        conditionsAt(w, w.day.minute + 120, id).wave,
        conditionsAt(w, w.day.minute + 420, id).wave,
      );
      const seen = mem.areaValue[id];
      // Unknown areas are worth a look; known ones are judged by realised net.
      const value = seen ? seen.net / seen.days : 1500 + coastTier(id) * 900;
      const dry = (mem.areaDry[id] || 0) > 2 ? 0.4 : 1;
      return { id, wave, value: value * dry, tier: coastTier(id) };
    })
    .filter((a) => a.wave <= tolerance * style.waveRatio);
  if (style === STYLES.cautious) {
    const top = Math.max(-1, ...scored.map((a) => a.tier));
    // The cautious skipper stays one coast behind the newest permit for a while.
    const comfortable = scored.filter((a) => a.tier < top || mem.daysOnTier[top] > 6);
    if (comfortable.length) return comfortable.sort((a, b) => b.value - a.value)[0]?.id;
  }
  return scored.sort((a, b) => b.value - a.value)[0]?.id || null;
}

// ---------- at sea ----------

let ticks = 0;
const trace = process.env.BOT_TRACE;
export function safeTick(w, controls, seconds = 0.3) {
  const tolerance = pickupTolerance(w);
  for (let i = 0; i < Math.round(seconds * 60); i++)
    step(
      w,
      i ? { throttle: controls.throttle || 0, steer: controls.steer || 0 } : controls,
      1 / 60,
      { tolerance },
    );
  if (trace && ++ticks % 500 === 0)
    console.log(
      `t=${w.time.toFixed(0)} min=${w.day.minute.toFixed(0)} boat=${w.boat.x.toFixed(0)},${w.boat.y.toFixed(0)} g=${w.boat.grounded} catch=${Math.round(w.catch)} divers=${w.divers.map((d) => d.state + ':' + Math.round(d.bag)).join(',')} ${(new Error().stack.split('\n')[3] || '').trim()}`,
    );
}
// Rock-aware grid route over visible water. Rocks and their wash are conspicuous
// to a skipper (charted or not), so avoiding them is fair play.
function hazards(w) {
  const draft = boatSpec(w).draft ?? 2;
  return (w.rocks || []).filter((r) => (r.topDepth ?? -1) < draft + 1.2);
}
export function wet(w, x, y, margin = 1, rocks = hazards(w), pad = 7) {
  const draft = boatSpec(w).draft ?? 2,
    size = w.terrain.size;
  if (x < 4 || y < 4 || x > size - 4 || y > size - 4) return false;
  // Keep a tide allowance under the keel: the water falls during a working day.
  if (depthAt(w, x, y) < draft + 1.5 + margin) return false;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4)
    if (depthAt(w, x + Math.cos(a) * 8, y + Math.sin(a) * 8) < draft + 0.8 + margin) return false;
  for (const r of rocks)
    if (Math.hypot(r.x - x, r.y - y) < (r.length || r.radius * 2) / 2 + pad) return false;
  return true;
}
function planRoute(w, goal) {
  const spacing = 8,
    size = w.terrain.size,
    n = Math.ceil(size / spacing) + 1,
    rocks = hazards(w),
    cache = new Map(),
    key = (x, y) => y * n + x,
    pt = (k) => ({ x: (k % n) * spacing, y: Math.floor(k / n) * spacing }),
    ok = (k) => {
      if (!cache.has(k)) {
        const p = pt(k),
          // Let the boat work out of marginal water it is already in.
          near = Math.hypot(p.x - w.boat.x, p.y - w.boat.y) < 20;
        cache.set(k, near ? wet(w, p.x, p.y, -1.3, rocks, 2) : wet(w, p.x, p.y, 0.8, rocks));
      }
      return cache.get(k);
    };
  const clampCell = (v) => Math.max(0, Math.min(n - 1, v)),
    start = key(
      clampCell(Math.round(w.boat.x / spacing)),
      clampCell(Math.round(w.boat.y / spacing)),
    );
  const heap = [],
    push = (k, f) => {
      heap.push([f, k]);
      let i = heap.length - 1;
      while (i) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    },
    pop = () => {
      const top = heap[0],
        last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1,
            r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top[1];
    };
  const cost = new Map([[start, 0]]),
    from = new Map(),
    h = (k) => Math.hypot(pt(k).x - goal.x, pt(k).y - goal.y);
  push(start, h(start));
  let found = null,
    expanded = 0;
  while (heap.length && expanded++ < 20000) {
    const cur = pop();
    if (h(cur) < spacing * 1.2) {
      found = cur;
      break;
    }
    const cx = cur % n,
      cy = Math.floor(cur / n);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const x = cx + dx,
        y = cy + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const k = key(x, y);
      if (!ok(k)) continue;
      const c = cost.get(cur) + Math.hypot(dx, dy) * spacing;
      if (c < (cost.get(k) ?? Infinity)) {
        cost.set(k, c);
        from.set(k, cur);
        push(k, c + h(k));
      }
    }
  }
  if (found === null) return null;
  const points = [goal];
  for (let k = found; k !== start; k = from.get(k)) points.unshift(pt(k));
  return points.filter((p, i) => i === points.length - 1 || i % 2 === 1);
}
export function sail(w, goal, speed, deadline) {
  clearBow(w);
  const path = planRoute(w, goal);
  if (trace)
    console.log(
      `   sail ${w.boat.x.toFixed(0)},${w.boat.y.toFixed(0)} -> ${goal.x.toFixed(0)},${goal.y.toFixed(0)} path=${path ? path.length : 'none'} ${path ? path.map((p) => p.x.toFixed(0) + ',' + p.y.toFixed(0)).join(' ') : ''}`,
    );
  if (!path) return false;
  let i = 0,
    attempts = 0,
    best = Infinity,
    since = 0,
    mark = { x: w.boat.x, y: w.boat.y },
    unpins = 0;
  while (i < path.length && attempts++ < 2500) {
    if (w.day.phase !== 'working' || w.time > deadline) return false;
    const p = path[i],
      dist = hyp(p, w.boat);
    if (dist < (i === path.length - 1 ? 5 : 8)) {
      i++;
      best = Infinity;
      since = 0;
      continue;
    }
    if (w.boat.grounded) {
      unground(w);
      return false;
    }
    // Pinned on a rock or bank (hardly moving under power): go astern to clear it.
    if (attempts % 25 === 0) {
      if (hyp(mark, w.boat) < 1 && Math.abs(w.boat.throttle) > 0.08) {
        safeTick(w, { fullReverse: true, centerRudder: true }, 3);
        safeTick(w, neutral, 1);
        if (++unpins > 3) return false;
      }
      mark = { x: w.boat.x, y: w.boat.y };
    }
    if (dist < best - 1) {
      best = dist;
      since = 0;
    } else if (++since > 220) {
      // No progress for over a minute: let the caller choose something else.
      safeTick(w, neutral, 1);
      return false;
    }
    safeTick(w, helm(w, p, speed));
  }
  safeTick(w, neutral, 2);
  return i >= path.length;
}
// Deploy where the chart says the bed is, from wet water as close as possible.
export function workPoint(w, target) {
  if (wet(w, target.x, target.y) && depthAt(w, target.x, target.y) >= C.diver.minDepth + 1)
    return { x: target.x, y: target.y };
  let best = null;
  for (let r = 6; r <= 40; r += 6)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = target.x + Math.cos(a) * r,
        y = target.y + Math.sin(a) * r;
      if (wet(w, x, y) && depthAt(w, x, y) >= C.diver.minDepth + 1) {
        best = { x, y };
        return best;
      }
    }
  return best;
}
// The voyage pilot's helm with a configurable turn boost: rudder boats need
// propwash to turn, but a big boost overruns floats and shoals when close.
export function helm(w, goal, speed = 2, boost = 1.9) {
  const b = w.boat,
    dx = goal.x - b.x,
    dy = goal.y - b.y,
    distance = Math.hypot(dx, dy),
    flow = currentAt(w, b.x, b.y);
  let wanted = Math.max(0.35, Math.min(speed, distance * 0.18));
  const off = Math.abs(angle(Math.atan2(dx, -dy) - b.heading));
  if (off > 0.25) wanted = Math.max(wanted, boost);
  // Slow only for floating timber actually ahead of the bow.
  let timber = Infinity;
  for (const log of w.logs) {
    const lx = log.x - b.x,
      ly = log.y - b.y,
      ahead = lx * Math.sin(b.heading) - ly * Math.cos(b.heading),
      beam = Math.abs(lx * Math.cos(b.heading) + ly * Math.sin(b.heading));
    if (ahead > 0 && beam < 6 + (log.length || 4) / 2)
      timber = Math.min(timber, ahead - (log.length || 4) / 2);
  }
  // Below the damage threshold a nudge is harmless; keep enough way on to steer.
  // A turning boat swings its bow off the timber; it needs propwash to do so.
  if (timber < 20 && off < 0.5) wanted = Math.min(wanted, 1.0 + Math.max(0, timber - 8) * 0.1);
  const heading = Math.atan2(
      (dx / Math.max(0.1, distance)) * wanted - flow.x,
      (-dy / Math.max(0.1, distance)) * wanted + flow.y,
    ),
    error = angle(heading - b.heading),
    rudder = clamp(error * 1.9 - b.turn * 3, -1, 1),
    throttle = clamp(wanted / boatSpec(w).maxSpeed, 0.1, speed > 2.5 ? 0.9 : 0.65);
  return {
    steer: clamp((rudder - b.rudder) * 4, -1, 1),
    throttle: clamp((throttle - b.throttle) * 4, -1, 1),
  };
}
// Before turning under power, back away from shoal water close under the bow.
export function clearBow(w) {
  const b = w.boat,
    draft = boatSpec(w).draft ?? 2,
    shoalAhead = () =>
      [5, 9, 13].some(
        (m) =>
          depthAt(w, b.x + Math.sin(b.heading) * m, b.y - Math.cos(b.heading) * m) < draft + 1.2,
      );
  for (let i = 0; i < 4 && shoalAhead(); i++) {
    safeTick(w, { fullReverse: true, centerRudder: true }, 0.2);
    safeTick(w, {}, 3);
  }
  safeTick(w, neutral, 0.5);
}
// Back off a shoal: reverse, then try forward with helm over, as a skipper would.
export function unground(w) {
  const b = w.boat,
    ahead = (m) => depthAt(w, b.x + Math.sin(b.heading) * m, b.y - Math.cos(b.heading) * m);
  if (trace)
    console.log(
      `   aground at ${b.x.toFixed(0)},${b.y.toFixed(0)} h=${b.heading.toFixed(2)} depth here ${depthAt(w, b.x, b.y).toFixed(1)} bow ${ahead(6).toFixed(1)} stern ${ahead(-6).toFixed(1)}`,
    );
  // Throttle/steer inputs are rates; Page Down style full reverse latches.
  safeTick(w, { fullReverse: true, centerRudder: true }, 0.2);
  for (let i = 0; i < 20 && w.boat.grounded; i++) safeTick(w, {}, 0.5);
  safeTick(w, {}, 2.5);
  safeTick(w, neutral, 1.5);
  if (!w.boat.grounded) clearBow(w);
  if (w.boat.grounded) {
    // Stranded on a falling tide: wait for water, then radio for a tow.
    for (let i = 0; i < 24 && w.boat.grounded; i++) {
      safeTick(w, neutral, 10);
      if (i % 4 === 3) {
        safeTick(w, { fullReverse: true, centerRudder: true }, 0.2);
        safeTick(w, {}, 4);
        safeTick(w, neutral, 0.5);
      }
    }
    if (w.boat.grounded && rescueStatus(w).available) {
      w.botNotes?.push('stranded: tow');
      requestRescue(w);
    }
  }
  return !w.boat.grounded;
}
// Slow helm for coming alongside: like the pilot's helm without its turn boost.
function creep(w, goal, speed) {
  const b = w.boat,
    dx = goal.x - b.x,
    dy = goal.y - b.y,
    distance = Math.hypot(dx, dy),
    flow = currentAt(w, b.x, b.y),
    wanted = Math.max(0.25, Math.min(speed, distance * 0.25));
  const heading = Math.atan2(
      (dx / Math.max(0.1, distance)) * wanted - flow.x,
      (-dy / Math.max(0.1, distance)) * wanted + flow.y,
    ),
    error = Math.atan2(Math.sin(heading - b.heading), Math.cos(heading - b.heading)),
    rudder = Math.max(-1, Math.min(1, error * 2.2 - b.turn * 3)),
    throttle = Math.max(0.08, Math.min(0.45, wanted / boatSpec(w).maxSpeed));
  return {
    steer: Math.max(-1, Math.min(1, (rudder - b.rudder) * 4)),
    throttle: Math.max(-1, Math.min(1, (throttle - b.throttle) * 4)),
  };
}
// Bring the float to port, slow, and work it; the real recovery gates decide.
// want: 'bag' takes the bag (work), 'board' brings the diver aboard.
// Each attempt picks a run-in line that leaves the float ~2 m off the port side,
// with clear water along it, motors to its start, follows it slowly and stops
// when the float is abeam. The port sector is wide, so stopping anywhere within
// a few metres of abeam passes the gate.
export function workFloat(w, d, want, deadline, stats) {
  const spec = boatSpec(w),
    half = spec.width / 2 + 2;
  let attempt = 0,
    phase = 'setup',
    brg = 0,
    timer = 0;
  const retry = (back = true) => {
    if (back) {
      safeTick(w, { fullReverse: true, centerRudder: true }, 1.2);
      safeTick(w, neutral, 1);
    }
    attempt++;
    phase = 'setup';
    timer = 0;
  };
  for (let i = 0; i < 3000 && attempt < 10; i++) {
    if (w.day.phase !== 'working' || w.time > deadline) return false;
    if (d.state !== 'surface') return true;
    if (want === 'bag' && d.bagHandled) return true;
    const tol = pickupTolerance(w),
      r = recoveryStatus(w, tol, d);
    if (trace && i % 40 === 0)
      console.log(
        `  float ${d.id} a=${attempt} ${phase} boat=${w.boat.x.toFixed(0)},${w.boat.y.toFixed(0)} diver=${d.x.toFixed(0)},${d.y.toFixed(0)} ${want} ${r.reason} dist=${r.distance.toFixed(1)} ws=${r.waterSpeed.toFixed(2)}`,
      );
    if (r.available) {
      timer = 0;
      safeTick(
        w,
        d.hooking
          ? neutral
          : { ...neutral, work: want === 'bag', recoverDiver: want === 'board', diverId: d.id },
      );
      continue;
    }
    if (w.boat.grounded) {
      unground(w);
      retry(false);
      continue;
    }
    timer++;
    if (phase === 'setup') {
      const rocks = hazards(w);
      let choice = null;
      for (let k = 0; k < 16; k++) {
        const b = (k / 16) * Math.PI * 2 + attempt * 0.37,
          dir = { x: Math.sin(b), y: -Math.cos(b) },
          star = { x: Math.cos(b), y: Math.sin(b) },
          abeam = { x: d.x + star.x * half, y: d.y + star.y * half },
          start = { x: abeam.x - dir.x * 30, y: abeam.y - dir.y * 30 };
        if (!wet(w, start.x, start.y, 0.3, rocks)) continue;
        let clear = true;
        for (let t = 0.25; t <= 1.2 && clear; t += 0.25)
          clear = wet(
            w,
            start.x + (abeam.x - start.x) * t,
            start.y + (abeam.y - start.y) * t,
            -0.6,
            rocks,
            3,
          );
        if (!clear) continue;
        // Prefer a line the boat is already on (approach straight from here),
        // then starts near the boat that need little turning.
        const al = (w.boat.x - abeam.x) * dir.x + (w.boat.y - abeam.y) * dir.y,
          lt = (w.boat.x - abeam.x) * star.x + (w.boat.y - abeam.y) * star.y,
          onLine = al < -10 && al > -45 && Math.abs(lt) < 4,
          turn = Math.abs(angle(b - w.boat.heading)),
          score = onLine ? Math.abs(lt) * 2 + turn * 6 : 40 + hyp(start, w.boat) + turn * 8;
        if (!choice || score < choice.score) choice = { start, b, score, onLine };
      }
      if (!choice) {
        stats.reasons['no clear approach'] = (stats.reasons['no clear approach'] || 0) + 1;
        safeTick(w, neutral, 8);
        if (timer > 20) retry(false);
        continue;
      }
      brg = choice.b;
      if (!choice.onLine && hyp(w.boat, d) < 14) {
        // Too close to line up: back off astern first.
        safeTick(w, { fullReverse: true, centerRudder: true }, 0.2);
        safeTick(w, {}, 4);
        safeTick(w, neutral, 0.5);
        continue;
      }
      if (
        !choice.onLine &&
        hyp(choice.start, w.boat) > 8 &&
        !sail(w, choice.start, 1.6, deadline)
      ) {
        retry(false);
        continue;
      }
      phase = 'run';
      timer = 0;
      continue;
    }
    const dir = { x: Math.sin(brg), y: -Math.cos(brg) },
      star = { x: Math.cos(brg), y: Math.sin(brg) },
      abeam = { x: d.x + star.x * half, y: d.y + star.y * half },
      along = (w.boat.x - abeam.x) * dir.x + (w.boat.y - abeam.y) * dir.y,
      lat = (w.boat.x - abeam.x) * star.x + (w.boat.y - abeam.y) * star.y,
      fwd = w.boat.vx * dir.x + w.boat.vy * dir.y;
    if (phase === 'run') {
      if (along > -2.5) {
        phase = 'hold';
        timer = 0;
      } else if (along < -12) {
        const lead = Math.min(-2, along + 10),
          carrot = { x: abeam.x + dir.x * lead, y: abeam.y + dir.y * lead };
        safeTick(w, helm(w, carrot, 1, 1.7));
      } else safeTick(w, creep(w, abeam, 0.4));
      if (Math.abs(lat) > 7 || along > 6 || timer > 220) retry();
    } else {
      // Coast to a stop alongside; touch astern if still carrying way.
      safeTick(w, fwd > 0.3 ? { throttle: -0.4 } : fwd < -0.15 ? { throttle: 0.4 } : neutral);
      if (timer > 50 || along > 8 || Math.abs(lat) > 7) retry();
    }
  }
  stats.recoveryFailures++;
  return false;
}
// Handle a surfaced diver: take the bag, then send them down again or board them.
function handleSurface(w, d, keepWorking, deadline, stats, memory) {
  if (d.reason) stats.reasons[d.reason] = (stats.reasons[d.reason] || 0) + 1;
  const spot = { x: d.x, y: d.y, bag: d.bag, reason: d.reason };
  if (!d.bagHandled && d.bag > 0) workFloat(w, d, 'bag', deadline, stats);
  memory(spot);
  if (d.state !== 'surface') return;
  if (keepWorking && d.bagHandled && rediveStatus(w, d).available) {
    safeTick(w, { ...neutral, work: true, diverId: d.id });
    if (d.state !== 'surface') return;
  }
  workFloat(w, d, 'board', deadline, stats);
}
function dealWithPatrol(w) {
  const status = w.day.inspection?.status;
  if (status === 'calling') answerPatrol(w);
}
function stockShares(w) {
  const marked = w.patches.filter((p) => p.charted !== false && p.initialStock > 0),
    all = w.patches.filter((p) => p.initialStock > 0),
    share = (list) =>
      list.reduce((n, p) => n + p.remaining, 0) /
      Math.max(
        1,
        list.reduce((n, p) => n + p.initialStock, 0),
      );
  return { marked: share(marked), all: share(all) };
}

async function fishDay(w, style, mem, stats) {
  const areaId = w.day.groundId,
    areaMem = (mem.spots[areaId] ??= []),
    hardStop = w.time + (2 * 1440) / C.day.minutesPerSecond;
  // Minutes to get everyone aboard and run to the harbour edge at transit speed.
  const exitMinutes = () => {
    const e = w.day.returnExit?.edge,
      size = w.terrain.size,
      metres =
        { south: size - w.boat.y, north: w.boat.y, east: size - w.boat.x, west: w.boat.x }[e] ??
        300;
    return ((metres * 1.4) / 3) * C.day.minutesPerSecond + 35;
  };
  const timeLeft = () => latestDeparture(w) - style.homeMargin - exitMinutes() - w.day.minute,
    deckRoom = () => boatSpec(w).capacity - w.catch,
    workable = () =>
      timeLeft() > 15 &&
      deckRoom() >= C.diver.bagSize * 1.5 &&
      !w.emergency &&
      w.time < hardStop &&
      (!w.weather?.night ||
        (style.nightWork && w.career.fleet[w.boat.configuration].equipment.includes('torch')));
  for (const d of w.divers)
    setInstructions(w, d.id, {
      direction: 0,
      minQuality: style.minQuality,
      searchLimit: 70,
      maxBagSeconds: 0,
    });
  const remember = (spot) => {
    // A player sees where the float came up and what was in the bag.
    if (spot.bag >= 150) {
      const near = areaMem.find((s) => hyp(s, spot) < 25);
      if (near) Object.assign(near, { good: w.career.day, bag: spot.bag });
      else areaMem.push({ x: spot.x, y: spot.y, good: w.career.day, bag: spot.bag });
    } else if (/exhausted|NO PRODUCTIVE|below quality/i.test(spot.reason || '')) {
      for (const s of areaMem) if (hyp(s, spot) < 30) s.dry = w.career.day;
      for (const key of Object.keys(mem.dry)) {
        const [a, x, y] = key.split(':');
        if (a === areaId && Math.hypot(x - spot.x, y - spot.y) < 40) mem.dry[key] = w.career.day;
      }
    }
  };
  const marked = w.patches
    .filter((p) => p.charted !== false)
    .map((p) => ({
      x: p.x,
      y: p.y,
      key: `${areaId}:${Math.round(p.x)}:${Math.round(p.y)}`,
      q: p.quality,
    }));
  const candidates = () => {
    const day = w.career.day;
    const list = [
      ...marked.filter((t) => !(mem.dry[t.key] >= day - 4) && !stats.triedToday.has(t.key)),
      ...areaMem
        .filter(
          (s) =>
            !(s.dry >= s.good) &&
            !stats.triedToday.has(`${areaId}:${Math.round(s.x)}:${Math.round(s.y)}`),
        )
        .map((s) => ({
          x: s.x,
          y: s.y,
          key: `${areaId}:${Math.round(s.x)}:${Math.round(s.y)}`,
          q: 0.8,
        })),
    ];
    return list.sort((a, b) => hyp(a, w.boat) - hyp(b, w.boat));
  };
  // Blind scouting: if every known spot is spent, drop on 6-14 m water near a
  // shoreline the bot has not tried today. Uses chart depth only.
  const scoutSpot = () => {
    for (let k = 0; k < 60; k++) {
      const x = 40 + ((k * 137 + w.career.day * 53) % 520),
        y = 40 + ((k * 211 + w.career.day * 97) % 520),
        depth = depthAt(w, x, y),
        key = `${areaId}:${Math.round(x)}:${Math.round(y)}`;
      if (depth >= 6 && depth <= 14 && wet(w, x, y) && !stats.triedToday.has(key))
        return { x, y, key, q: 0 };
    }
    return null;
  };
  while (workable()) {
    dealWithPatrol(w);
    const target = candidates()[0] || scoutSpot();
    if (!target) break;
    stats.triedToday.add(target.key);
    stats.bedsTried++;
    const point = workPoint(w, target);
    if (!point || !sail(w, point, 3.5, hardStop)) continue;
    dealWithPatrol(w);
    // Deploy everyone who can go.
    let sent = 0;
    for (const d of w.divers) {
      if (d.state !== 'ready') continue;
      if (!deploymentStatus(w, d).available) continue;
      safeTick(w, { ...neutral, recoverDiver: true, diverId: d.id });
      if (d.state !== 'ready') sent++;
      safeTick(w, neutral, 1);
    }
    if (!sent) {
      const reasons = w.divers.map((d) => deploymentStatus(w, d).reason).join('/');
      stats.reasons['deploy:' + reasons] = (stats.reasons['deploy:' + reasons] || 0) + 1;
      if (/DARKNESS|UNFIT|NO ROOM|FISHING ENDED/.test(reasons)) break;
      // Exposure readiness: wait a little on deck before trying elsewhere.
      safeTick(w, neutral, 30);
      continue;
    }
    let bagsHere = 0;
    // Tend the divers until both are aboard again.
    for (let guard = 0; guard < 20000; guard++) {
      if (w.day.phase !== 'working') return;
      dealWithPatrol(w);
      const up = w.divers.find((d) => d.state === 'surface');
      if (up) {
        const had = w.bags.length;
        handleSurface(w, up, workable(), hardStop, stats, remember);
        bagsHere += w.bags.length - had;
        continue;
      }
      if (w.divers.every((d) => d.state === 'ready')) break;
      // Keep station near the drop while divers work, as a skipper would, and
      // never sit drifting onto shoal or rock.
      if (w.boat.grounded) unground(w);
      else if (hyp(point, w.boat) > 18 || !wet(w, w.boat.x, w.boat.y, -0.5))
        safeTick(w, helm(w, point, 1, 1.4));
      else safeTick(w, neutral, 0.6);
      if (w.time > hardStop) break;
    }
    if (!bagsHere) {
      mem.dry[target.key] = w.career.day;
      mem.areaDry[areaId] = (mem.areaDry[areaId] || 0) + 1;
      stats.bedsDry++;
    }
  }
}
function goHome(w, stats) {
  const deadline = w.time + 1440 / C.day.minutesPerSecond;
  // Bring anyone still out aboard first.
  for (
    let i = 0;
    i < 4000 && w.divers.some((d) => d.state !== 'ready') && w.day.phase === 'working';
    i++
  ) {
    const up = w.divers.find((d) => d.state === 'surface');
    if (up) handleSurface(w, up, false, deadline, stats, () => {});
    else {
      const down = w.divers.find((d) => ['searching', 'harvesting'].includes(d.state));
      // Recall works only close to the bubbles; otherwise wait for them.
      if (down && hyp(down, w.boat) < 12) safeTick(w, { ...neutral, recall: true });
      else safeTick(w, neutral, 1);
    }
  }
  if (w.day.phase !== 'working') return;
  if (!w.divers.every((d) => d.state === 'ready')) return rescue(w, stats, 'crew not aboard');
  const size = w.terrain.size,
    edge = w.day.returnExit.edge;
  const along = (t) =>
    ({
      south: { x: t, y: size - 14 },
      north: { x: t, y: 14 },
      east: { x: size - 14, y: t },
      west: { x: 14, y: t },
    })[edge];
  const beyond = (p) =>
    ({
      south: { x: p.x, y: size + 30 },
      north: { x: p.x, y: -30 },
      east: { x: size + 30, y: p.y },
      west: { x: -30, y: p.y },
    })[edge];
  const gates = [];
  for (let t = 20; t < size - 20; t += 20) {
    const p = along(t);
    if (wet(w, p.x, p.y, 1.5)) gates.push(p);
  }
  gates.sort((a, b) => hyp(a, w.boat) - hyp(b, w.boat));
  for (const gate of gates.slice(0, 4)) {
    if (!sail(w, gate, 3.5, deadline)) continue;
    const out = beyond(gate);
    for (let i = 0; i < 600 && w.day.phase === 'working'; i++) {
      if (returnAvailable(w)) {
        safeTick(w, { ...neutral, returnHarbour: true });
        for (let j = 0; j < 100 && w.day.phase === 'working'; j++) safeTick(w, neutral);
        break;
      }
      safeTick(w, helm(w, out, 2));
    }
    if (w.day.phase !== 'working') return;
  }
  if (w.day.phase === 'working') rescue(w, stats, 'could not reach harbour line');
}
function rescue(w, stats, why) {
  stats.note.push('rescue:' + why);
  if (!rescueStatus(w).available) {
    // A rescue needs a stranding reason; drain the bot's patience by idling, as a
    // player with no route would, until fuel or the tide resolves it.
    w.boat.grounded = true;
  }
  requestRescue(w);
}

// ---------- the career loop ----------

export async function playCareer({
  style: styleName = 'average',
  seed = 7,
  days = 60,
  boat = 'basic',
  out = null,
} = {}) {
  const style = STYLES[styleName],
    run = `${styleName}-${boat}-s${seed}`;
  let w = careerWorld(createCareer(seed, { chooseStarter: true }));
  chooseFirstBoat(w, boat);
  const mem = { spots: {}, dry: {}, areaDry: {}, areaValue: {}, daysOnTier: {} };
  const rows = [];
  const file = out ? `${out}/${run}.csv` : null;
  if (file) writeFileSync(file, CSV_FIELDS.join(',') + '\n');
  const emit = (row) => {
    rows.push(row);
    if (file) appendFileSync(file, CSV_FIELDS.map((k) => csv(row[k])).join(',') + '\n');
  };
  let workedStreak = 0;
  while (w.career.day <= days) {
    const c = w.career,
      purchases = [],
      dayNo = c.day,
      before = c.cash;
    const base = {
      run,
      style: styleName,
      seed,
      day: dayNo,
      boat: w.boat.configuration,
      market: +c.market.toFixed(3),
    };
    // Harbour: licence, fuel, repairs, crew, kit, boats, permits.
    if (c.licenceThrough < c.day) serviceBoat(w, 'licence');
    if (
      Math.min(w.boat.hullHealth, w.boat.driveHealth) < style.repairBelow &&
      repairQuote(w) <= c.cash
    )
      serviceBoat(w, 'repair');
    serviceBoat(w, 'fuel');
    considerCrew(w, style, purchases);
    shop(w, style, purchases);
    considerBoat(w, style, purchases);
    considerCoast(w, style, purchases);
    if (c.cash < 0 && style.borrow) credit(w);
    if (c.cash < 1500 && style.borrow && c.debt < 30000) credit(w);
    // Pay down debt when comfortable.
    while (c.debt > 0 && c.cash > style.reserve + 15000 && credit(w, true).ok);
    serviceBoat(w, 'fuel');
    const blocked = departureReady(w),
      tired = w.divers
        .filter((d) => d.condition === 'fit')
        .every((d) => (d.fatigue || 0) > style.restFatigue),
      restDay = style.restEvery && workedStreak >= style.restEvery;
    let action = 'fish',
      area = null,
      note = blocked;
    if (blocked) action = /overdrawn|lost|Repair/.test(blocked) ? 'dock' : 'rest';
    else if (tired || restDay) action = 'rest';
    else {
      area = chooseArea(w, style, mem);
      if (!area) action = 'rest';
    }
    if (action !== 'fish') {
      // A boat with no money and no fit way to sail works the dock.
      const dock = action === 'dock' || (c.cash < 600 && !style.borrow);
      emit({
        ...base,
        action: dock ? 'dock' : action,
        cash: c.cash,
        debt: c.debt,
        cashChange: c.cash - before,
        fuelPct: +(w.boat.fuel / boatSpec(w).fuelCapacity).toFixed(3),
        hull: +w.boat.hullHealth.toFixed(3),
        drive: +w.boat.driveHealth.toFixed(3),
        fatigueA: +(w.divers[0].fatigue || 0).toFixed(3),
        fatigueB: +(w.divers[1].fatigue || 0).toFixed(3),
        conditionA: w.divers[0].condition,
        conditionB: w.divers[1].condition,
        crew: c.crew.join('+'),
        purchases: purchases.join(' '),
        rank: rankOf(c),
        xp: c.xp,
        note: note || (tired ? 'tired' : restDay ? 'rest day' : 'weather/none open'),
      });
      workedStreak = 0;
      w = nextCareerDay(w, { dockWork: dock }) || w;
      if (w.career.day === dayNo) throw new Error('Day did not advance: ' + note);
      continue;
    }
    // Buyer order for roughly what the bot expects to land.
    const expected = mem.areaValue[area]?.lb / Math.max(1, mem.areaValue[area]?.days || 1) || 1500;
    const buyer = chooseOrder(w, expected, style);
    const trip = chooseGround(w, area);
    if (!trip.ok) {
      emit({
        ...base,
        action: 'rest',
        cash: c.cash,
        debt: c.debt,
        note: 'trip refused: ' + trip.reason,
      });
      w = nextCareerDay(w) || w;
      continue;
    }
    const tier = coastTier(area);
    mem.daysOnTier[tier] = (mem.daysOnTier[tier] || 0) + 1;
    const stats = {
      bedsTried: 0,
      bedsDry: 0,
      recoveryFailures: 0,
      reasons: {},
      triedToday: new Set(),
      note: [],
    };
    try {
      await fishDay(w, style, mem, stats);
      if (w.day.phase === 'working') goHome(w, stats);
    } catch (error) {
      stats.note.push('error:' + error.message.slice(0, 80));
      if (w.day.phase === 'working') rescue(w, stats, 'bot error');
    }
    if (w.day.phase !== 'complete') {
      stats.note.push('day not completed');
      w.boat.grounded = true;
      requestRescue(w);
    }
    const r = w.day.result,
      stock = stockShares(w),
      sub = subAreaRecord(w.career, area, w.day.subAreaId);
    const seen = (mem.areaValue[area] ??= { net: 0, days: 0, lb: 0 });
    seen.net += r.netValue;
    seen.lb += r.gross;
    seen.days++;
    emit({
      ...base,
      action: 'fish',
      area,
      coast: coastFor(area)?.id,
      boat: w.boat.configuration,
      cash: w.career.cash,
      debt: w.career.debt,
      cashChange: +(w.career.cash - before).toFixed(2),
      catchLb: Math.round(r.gross),
      bags: r.gross ? Math.round(r.gross / 30) / 10 : 0,
      quality: +r.quality.toFixed(3),
      landedLb: Math.round(r.landed),
      landedQuality: +r.landedQuality.toFixed(3),
      pricePerLb: +r.price.toFixed(3),
      value: r.value,
      buyer,
      buyerBonus: r.buyerPremium,
      crewPay: r.career?.crewPay ?? 0,
      fuelCost: +(r.costs?.fuel || 0).toFixed(2),
      premium: r.career?.premium ?? 0,
      net: r.netValue,
      onTime: r.onTime ? 1 : 0,
      lateMinutes: r.lateMinutes,
      arrival: Math.round(r.arrival),
      fuelPct: +(w.boat.fuel / boatSpec(w).fuelCapacity).toFixed(3),
      hull: +w.boat.hullHealth.toFixed(3),
      drive: +w.boat.driveHealth.toFixed(3),
      repairDue: repairQuote(w),
      fatigueA: +(w.divers[0].fatigue || 0).toFixed(3),
      fatigueB: +(w.divers[1].fatigue || 0).toFixed(3),
      conditionA: w.career.people[w.divers[0].crewId]?.condition,
      conditionB: w.career.people[w.divers[1].crewId]?.condition,
      crew: w.career.crew.join('+'),
      injuries: w.safety?.injuries || 0,
      fatalities: w.safety?.fatalities || 0,
      stockMarkedPct: +(stock.marked * 100).toFixed(1),
      stockAllPct: +(stock.all * 100).toFixed(1),
      subAreaHealth: +(sub?.health ?? 1).toFixed(3),
      bedsTried: stats.bedsTried,
      bedsDry: stats.bedsDry,
      recoveryFailures: stats.recoveryFailures,
      diverSurfaceReasons: Object.entries(stats.reasons)
        .map(([k, v]) => `${k}=${v}`)
        .join(' | '),
      purchases: purchases.join(' '),
      rank: rankOf(w.career),
      xp: w.career.xp,
      note: [r.rescue ? 'rescued:' + r.rescue.reason : '', r.sunk ? 'SUNK' : '', ...stats.note]
        .filter(Boolean)
        .join(' '),
    });
    workedStreak++;
    // Save/reload every trip, as the game does, so persistence is exercised too.
    w = decode(encode(w));
    w = nextCareerDay(w) || w;
  }
  return { run, rows, cash: w.career.cash, debt: w.career.debt };
}
function csv(v) {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------- command line ----------
function args() {
  return Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = args(),
    out = a.out || 'test-results/career-bot';
  mkdirSync(out, { recursive: true });
  if (a.sweep) {
    const days = +(a.days || 60),
      seeds = String(a.seeds || '7,1234,90210')
        .split(',')
        .map(Number),
      styles = String(a.styles || 'cautious,average,greedy').split(','),
      boats = String(a.boats || 'basic,outboard').split(',');
    const jobs = [];
    for (const style of styles)
      for (const seed of seeds)
        jobs.push({ style, seed, boat: boats[(seed + style.length) % boats.length] });
    const limit = +(a.jobs || 4);
    let next = 0;
    const started = Date.now();
    await Promise.all(
      Array.from({ length: limit }, async () => {
        while (next < jobs.length) {
          const job = jobs[next++];
          await new Promise((resolve) => {
            const child = fork(fileURLToPath(import.meta.url), [
              `--style=${job.style}`,
              `--seed=${job.seed}`,
              `--boat=${job.boat}`,
              `--days=${days}`,
              `--out=${out}`,
            ]);
            child.on('exit', resolve);
          });
        }
      }),
    );
    console.log(`sweep done in ${((Date.now() - started) / 60000).toFixed(1)} min`);
  } else {
    const t = Date.now();
    const result = await playCareer({
      style: a.style || 'average',
      seed: +(a.seed || 7),
      days: +(a.days || 60),
      boat: a.boat || 'basic',
      out,
    });
    console.log(
      `${result.run}: day ${a.days || 60} cash ${Math.round(result.cash)} debt ${result.debt} in ${((Date.now() - t) / 60000).toFixed(1)} min`,
    );
  }
}
