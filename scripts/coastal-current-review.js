import '../tests/matter-helper.js';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { careerWorld, encode } from '../src/career-save.js';
import { chooseGround } from '../src/day.js';
import { enterSector } from '../src/sectors.js';
import { currentAt } from '../src/environment.js';
import { depthAt } from '../src/terrain.js';
import { driftSurface } from '../src/world.js';
import { C } from '../src/config.js';

const directory = 'test-results/coastal-current-2026-10-01';
mkdirSync(directory, { recursive: true });
const records = [],
  errors = [];
const maps = [
  { id: 'outer-wall', flow: { x: 0.4, y: -2.8 }, armY: 230 },
  { id: 'maelstrom-point', flow: { x: 0.1, y: -2.25 }, armY: 285 },
];

function sourceWorld(id) {
  const w = careerWorld();
  assert(chooseGround(w, 'near').ok);
  w.day.groundId = id;
  enterSector(w, id);
  w.day.minute = 750;
  return w;
}

// Examine a broad region of real deep water, including the T-shaped headland.
// Locations come from the solved field, never from authored shelter/eddy tags.
function measure(w, map, sign, strength, tide) {
  Object.assign(w.environment, {
    seaLevel: tide,
    flow: sign * strength,
    minute: 750,
    currentCurve: { mean: sign * strength },
    tideCurve: { mean: 1.15 },
  });
  const length = Math.hypot(map.flow.x, map.flow.y),
    axis = { x: (sign * map.flow.x) / length, y: (sign * map.flow.y) / length };
  let wet = 0,
    reversed = 0,
    sheltered = 0,
    race = { knots: 0 },
    pocket = { along: 0 };
  for (let y = 20; y < 580; y += 6)
    for (let x = 20; x < 580; x += 6) {
      const depth = depthAt(w, x, y);
      if (depth < 5) continue;
      wet++;
      const flow = currentAt(w, x, y),
        knots = Math.hypot(flow.x, flow.y) * C.knotsPerMps,
        along = flow.x * axis.x + flow.y * axis.y;
      if (knots < 1.5) sheltered++;
      if (along < -0.04) reversed++;
      if (knots > race.knots) race = { x, y, knots };
      if (x > 180 && x < 330 && y > 90 && y < 420 && along < pocket.along)
        pocket = { x, y, depth, along, knots };
    }
  assert(reversed > 30, `${map.id}: geography must produce substantial reverse flow`);
  assert(pocket.along < -0.08, `${map.id}: the headland must produce a deep lee return`);
  assert(
    pocket.knots < race.knots * 0.65,
    `${map.id}: lee must offer an exploitable current contrast`,
  );
  assert(sheltered > 150, `${map.id}: deep water must contain usable sub-1.5-knot shelter`);
  if (strength >= 0.8) assert(race.knots > 4.8, `${map.id}: offshore race remains dangerous`);
  const drifter = { x: pocket.x, y: pocket.y };
  for (let i = 0; i < 80; i++) {
    driftSurface(w, drifter, 0.25);
    assert(depthAt(w, drifter.x, drifter.y) > 0, 'current-borne objects never cross dry land');
  }
  const alongDisplacement = (drifter.x - pocket.x) * axis.x + (drifter.y - pocket.y) * axis.y;
  assert(
    alongDisplacement < -0.5,
    `${map.id}: a physical drifter must actually travel upstream in the lee`,
  );
  return {
    id: map.id,
    sign,
    strength,
    tide,
    axis,
    wet,
    reversed,
    sheltered,
    race,
    pocket,
    drifter: { ...drifter, seconds: 20, alongDisplacement },
  };
}

for (const map of maps) {
  const w = sourceWorld(map.id);
  for (const sign of [1, -1])
    for (const strength of [0.3, 0.8, 1.1])
      for (const tide of [-0.5, 1.15, 3.2]) records.push(measure(w, map, sign, strength, tide));
}

if (process.argv.includes('--numerical-only')) {
  writeFileSync(`${directory}/numerical.json`, JSON.stringify({ records }, null, 2));
  console.log('PASS: 36 coastal direction/strength/tide fixtures and physical drifter tracks.');
  process.exit(0);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
try {
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  for (const map of maps)
    for (const sign of [1, -1]) {
      const record = records.find(
        (r) => r.id === map.id && r.sign === sign && r.strength === 0.8 && r.tide === 1.15,
      );
      const saved = encode(sourceWorld(map.id));
      const result = await page.evaluate(
        ({ saved, map, record }) => {
          const d = urchinDebug;
          d.three.host.scene.resume();
          const result = d.ui.hooks.changeCareer(null, saved);
          if (!result.ok) throw new Error(result.reason);
          d.ui.begin(true);
          d.ui.open(null);
          const w = d.world;
          w.career.testConditions = null;
          Object.assign(w.environment, {
            seaLevel: 1.15,
            flow: record.sign * 0.8,
            minute: 750,
            currentCurve: { mean: record.sign * 0.8 },
            tideCurve: { mean: 1.15 },
            wind: { x: 0, y: 0 },
          });
          w.weather = {
            ...w.weather,
            visibility: 1000,
            rain: 0,
            wave: 0,
            sunlight: 1,
            night: false,
          };
          Object.assign(w.boat, {
            x: 270,
            y: map.armY - 50,
            heading: 0,
            throttle: 0,
            rudder: 0,
            vx: 0,
            vy: 0,
          });
          w.career.assists.currentArrows = true;
          d.three.host.cameras.main.setZoom(0.4);
          return { terrain: w.terrain.name, groundId: w.day.groundId };
        },
        { saved, map, record },
      );
      assert.equal(result.groundId, map.id);
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const d = urchinDebug;
        d.three.host.scene.pause();
        d.three.draw(d.world, d.ui, 0);
      });
      const phase = sign > 0 ? 'flood' : 'ebb';
      await page.screenshot({ path: `${directory}/${map.id}-${phase}-headland-arrows.png` });
      record.runtime = await page.evaluate((record) => {
        const d = urchinDebug,
          w = d.world,
          r = d.three;
        const pocketFlow = d.currentAt(record.pocket.x, record.pocket.y),
          raceFlow = d.currentAt(record.race.x, record.race.y);
        const natural = w.debris.reduce((best, item) => {
          const distance = Math.hypot(item.x - record.pocket.x, item.y - record.pocket.y);
          return !best || distance < best.distance ? { item, distance } : best;
        }, null);
        const before = { x: natural.item.x, y: natural.item.y };
        d.step(8);
        const drift = { x: natural.item.x - before.x, y: natural.item.y - before.y };
        w.career.assists.currentArrows = false;
        Object.assign(w.boat, {
          x: record.pocket.x,
          y: record.pocket.y,
          grounded: false,
          throttle: 0,
          vx: 0,
          vy: 0,
        });
        w.weather = { ...w.weather, visibility: 1000, rain: 0, wave: 0, sunlight: 1, night: false };
        w.environment.wind = { x: 0, y: 0 };
        r.host.cameras.main.setZoom(0.6);
        r.draw(w, d.ui, 0);
        return {
          pocketKnots: Math.hypot(pocketFlow.x, pocketFlow.y) * d.config.knotsPerMps,
          raceKnots: Math.hypot(raceFlow.x, raceFlow.y) * d.config.knotsPerMps,
          naturalDrift: {
            initialDistance: natural.distance,
            ...drift,
            along: drift.x * record.axis.x + drift.y * record.axis.y,
          },
          visibleDrifters: r.surfaceDrift.mesh.count,
          arrowsVisible: r.currentArrows.visible,
          uiStarted: d.ui.started,
          uiScreen: d.ui.screen,
        };
      }, record);
      assert(
        record.runtime.uiStarted && !record.runtime.uiScreen,
        'capture actual deployed map, never harbour backdrop',
      );
      assert(record.runtime.pocketKnots < 2 && record.runtime.raceKnots > 4.8);
      assert(record.runtime.visibleDrifters > 10 && !record.runtime.arrowsVisible);
      assert(
        record.runtime.naturalDrift.along < -0.2,
        'naturally populated foam reverses in the actual lee',
      );
      // Repaint the real instruments after moving to the measured pocket.
      // A paused renderer alone would retain the previous position's HUD.
      await page.evaluate(() => urchinDebug.three.host.scene.resume());
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const d = urchinDebug;
        d.three.host.scene.pause();
        d.three.draw(d.world, d.ui, 0);
      });
      await page.screenshot({ path: `${directory}/${map.id}-${phase}-lee-no-arrows.png` });
    }
  assert.deepEqual(errors, []);
  console.log(
    'PASS: 36 flood/ebb/strength/tide fixtures, dangerous races, deep reverse-flow pockets, wet drifter tracks and eight deployed-map screenshots.',
  );
} finally {
  writeFileSync(`${directory}/report.json`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
