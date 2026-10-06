// October 5 (feedback/10-5): in-world information. Stages, in the real game
// view, divers working (bubble upwelling), a diver in the ascent warning
// (filled boil), and the deck at empty / part / full load with the ghost
// outline, the deck-full lamp and the hull settling. Also a damaged hull.
// Output: test-results/in-world-cues-2026-10-05/ (or CUES_OUT). Screenshots
// need independent review; geometry assertions are not visual acceptance.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const output = process.env.CUES_OUT || 'test-results/in-world-cues-2026-10-05-v2';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [],
  records = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

// Advance presentation (not the simulation) so particles and boils build up.
const stage = (state) =>
  page.evaluate(({ divers, load, hull, zoom, seconds, night, pulse, torch }) => {
    const d = urchinDebug,
      r = d.three,
      w = d.world,
      b = w.boat;
    w.weather = {
      ...w.weather,
      visibility: 1000,
      rain: 0,
      wave: 0.2,
      night: !!night,
      sunlight: night ? 0.05 : 1,
    };
    w.day.minute = night ? 21 * 60 : 600;
    b.hullHealth = hull;
    // Diver flashlights fitted (and enabled) only where a stage asks for them.
    const fitted = w.career?.fleet?.[b.configuration];
    if (fitted) {
      fitted.equipment = (fitted.equipment || []).filter((id) => id !== 'torch');
      if (torch) fitted.equipment.push('torch');
      fitted.disabledEquipment = (fitted.disabledEquipment || []).filter((id) => id !== 'torch');
    }
    const spec = d.simulation.boatSpec(w);
    const count = Math.round((load * spec.capacity) / 300);
    w.bags = Array.from({ length: count }, (_, n) => ({ id: `cue-${n}`, weight: 300 }));
    w.catch = Math.min(spec.capacity, count * 300);
    w.divers.forEach((diver, i) => {
      const role = divers[i];
      diver.x = b.x + (i ? 1 : -1) * (17.6 / Math.max(zoom, 1.6)); // in frame at every zoom
      diver.y = b.y - 22.4 / Math.max(zoom, 1.6);
      diver.hooking = false;
      if (role === 'working') {
        diver.state = 'harvesting';
        diver.transit = null;
      } else if (role === 'ascending') {
        diver.state = 'surfacing';
        diver.timer = 1.5;
        diver.transit = { kind: 'ascent', depth: 8, total: 5 };
      } else {
        diver.state = 'ready';
        diver.transit = null;
      }
    });
    r.host.cameras.main.setZoom(zoom);
    const ui = { ...d.ui, screen: null, started: true };
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i++) {
      w.time += 1 / 60;
      // A sack landing near the end exercises the pulse.
      if (pulse && i === frames - 12) {
        w.bags.push({ id: 'cue-new', weight: 300 });
        w.catch = Math.min(spec.capacity, w.catch + 300);
      }
      r.draw(w, ui, 1 / 60);
    }
    const v = r.vessels;
    return {
      bags: w.bags.length,
      catch: w.catch,
      capacity: spec.capacity,
      state: v.loadState,
      hullY: v.boat.position.y,
      roll: v.boat.rotation.z,
      torch: !!w.career?.fleet?.[b.configuration]?.equipment?.includes('torch'),
      boils: v.boils.map((boil) => ({
        visible: boil.mesh.visible,
        opacity: +boil.material.uniforms.uOpacity.value.toFixed(3),
        boil: +boil.boil.toFixed(3),
        light: +boil.material.uniforms.uLight.value.toFixed(3),
      })),
    };
  }, state);

try {
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/');
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.locator('#keyboardFallback').click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
  await page.locator('#playtest [data-choice-index="0"]').click();
  await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.screen);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const d = urchinDebug,
      r = d.three,
      w = d.world;
    r.host.scene.pause();
    document.querySelectorAll('body > *:not(#game)').forEach((e) => (e.style.display = 'none'));
    w.career.testConditions = null;
    w.environment.model = 'uniform';
    w.environment.wind = { x: 0, y: 0 };
    w.environment.current = { x: 0.25, y: 0.1 };
    Object.assign(w.boat, { heading: 0, throttle: 0, rudder: 0, speed: 0, vx: 0, vy: 0 });
  });
  for (const [label, state] of [
    [
      'bubbles-working',
      { divers: ['working', 'working'], load: 0, hull: 1, zoom: 1.6, seconds: 6 },
    ],
    [
      'bubbles-ascent',
      { divers: ['working', 'ascending'], load: 0, hull: 1, zoom: 1.6, seconds: 4 },
    ],
    ['bubbles-wide', { divers: ['working', 'ascending'], load: 0, hull: 1, zoom: 0.8, seconds: 4 }],
    [
      'bubbles-close',
      { divers: ['working', 'ascending'], load: 0, hull: 1, zoom: 3.2, seconds: 4 },
    ],
    [
      // Close zoom puts the divers about 9 m off, inside the 16 m night range
      // without work lights; at 1.6 they sit 18 m off and are correctly hidden.
      'bubbles-ascent-night',
      { divers: ['working', 'ascending'], load: 0, hull: 1, zoom: 3.2, seconds: 4, night: true },
    ],
    // October 5: torch-lit divers 18 m off, past the 16 m unlit night range.
    [
      'bubbles-night-torch',
      {
        divers: ['working', 'ascending'],
        load: 0,
        hull: 1,
        zoom: 1.6,
        seconds: 4,
        night: true,
        torch: true,
      },
    ],
    [
      'bubbles-night-torch-wide',
      {
        divers: ['working', 'ascending'],
        load: 0,
        hull: 1,
        zoom: 0.8,
        seconds: 4,
        night: true,
        torch: true,
      },
    ],
    [
      'load-pulse-wide',
      { divers: ['ready', 'ready'], load: 0.3, hull: 1, zoom: 1, seconds: 3, pulse: true },
    ],
    ['load-empty', { divers: ['ready', 'ready'], load: 0, hull: 1, zoom: 2.2, seconds: 2 }],
    ['load-half', { divers: ['ready', 'ready'], load: 0.5, hull: 1, zoom: 2.2, seconds: 3 }],
    [
      'load-pulse',
      { divers: ['ready', 'ready'], load: 0.5, hull: 1, zoom: 2.2, seconds: 3, pulse: true },
    ],
    // October 5 v2: the whole remaining load flashes as 3D sacks, including
    // the second layer stacked over sacks already aboard.
    [
      'load-light-pulse',
      { divers: ['ready', 'ready'], load: 0.12, hull: 1, zoom: 2.2, seconds: 3, pulse: true },
    ],
    [
      'load-second-layer',
      { divers: ['ready', 'ready'], load: 0.72, hull: 1, zoom: 2.2, seconds: 3 },
    ],
    [
      'load-second-layer-pulse',
      { divers: ['ready', 'ready'], load: 0.72, hull: 1, zoom: 2.2, seconds: 3, pulse: true },
    ],
    [
      'load-pulse-night',
      {
        divers: ['ready', 'ready'],
        load: 0.3,
        hull: 1,
        zoom: 2.2,
        seconds: 3,
        pulse: true,
        night: true,
      },
    ],
    ['load-full', { divers: ['ready', 'ready'], load: 1, hull: 1, zoom: 2.2, seconds: 4 }],
    [
      'load-full-night',
      { divers: ['ready', 'ready'], load: 1, hull: 1, zoom: 2.2, seconds: 4, night: true },
    ],
    ['load-full-wide', { divers: ['ready', 'ready'], load: 1, hull: 1, zoom: 1, seconds: 2 }],
    ['hull-damaged', { divers: ['ready', 'ready'], load: 0.3, hull: 0.25, zoom: 2.2, seconds: 4 }],
  ]) {
    records.push({ label, ...(await stage(state)) });
    await page.screenshot({ path: `${output}/${label}.png` });
  }
  const byLabel = Object.fromEntries(records.map((r) => [r.label, r]));
  assert.ok(byLabel['load-full'].state.full, 'deck full lights the lamp');
  assert.ok(!byLabel['load-half'].state.full);
  assert.ok(byLabel['load-full'].hullY < byLabel['load-empty'].hullY - 0.2, 'full hull sits lower');
  assert.ok(Math.abs(byLabel['hull-damaged'].roll) > 0.03, 'damaged hull lists');
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/summary.json`, JSON.stringify(records, null, 2));
  console.log(JSON.stringify(records, null, 1));
} finally {
  await browser.close();
}
