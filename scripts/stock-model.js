// Fast stock model: advances a career day by day with rival fishing, season
// recovery and quota health but no player sailing (optionally a fixed player
// catch taken from one map's marked beds), and prints the share of marked and
// all bed stock left per map. Seconds for 60 days; use it to size stock tuning
// before confirming with scripts/career-bot.js.
//
//   node scripts/stock-model.js [--seed=1234] [--days=60] [--player=near:2000]
import '../tests/matter-helper.js';
import { careerWorld, nextCareerDay } from '../src/career-save.js';
import { createCareer } from '../src/career-state.js';
import { advanceFleet } from '../src/fleet-life.js';
import { materializeSector } from '../src/sectors.js';
import { takeCatch } from '../src/harvest-ground.js';
import { PHYSICAL_AREAS } from '../src/coasts.js';

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const seed = Number(arg('seed', 1234)),
  days = Number(arg('days', 60)),
  [playerArea, playerLb] = (arg('player', '') || ':0').split(':');
const report = [1, 3, 9, 18, 36, 60, 90].filter((d) => d <= days);
const areas = PHYSICAL_AREAS.map((a) => a.id);

function stockShare(w, id) {
  const patches = materializeSector(w, id).patches;
  const share = (list) => {
    let left = 0,
      start = 0;
    for (const p of list)
      for (const c of p.clumps || []) {
        left += c.remaining;
        start += c.initialStock || 0;
      }
    return start ? Math.round((left / start) * 100) : 0;
  };
  return `${share(patches.filter((p) => p.charted !== false))}/${share(patches)}`;
}

let w = careerWorld(createCareer(seed));
w.career.coastAccess = undefined;
const rows = [];
for (let day = 1; day <= days; day++) {
  if (Number(playerLb) > 0) {
    let left = Number(playerLb);
    for (const p of materializeSector(w, playerArea).patches.filter((p) => p.charted !== false))
      for (const c of p.clumps || []) left -= takeCatch(p, c, left);
  }
  advanceFleet(w, 1439);
  if (report.includes(day)) rows.push([day, ...areas.map((id) => stockShare(w, id))]);
  w = nextCareerDay(w);
}
console.log(`seed ${seed}; marked % / all % of initial bed stock left`);
console.log(['day', ...areas].join('\t'));
for (const row of rows) console.log(row.join('\t'));
