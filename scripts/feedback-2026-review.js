import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import '../tests/matter-helper.js';
import { createCareer } from '../src/career-state.js';
import { careerWorld, encode, SAVE_KEY } from '../src/career-save.js';
const output = 'test-results/feedback-2026';
const receipt = process.argv.includes('--environment-only') ? 'water-receipt.json' : 'receipt.json';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const errors = [],
  records = [];
const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/';
try {
  for (const [name, width, height, touch] of [
    ['phone', 390, 844, true],
    ['landscape', 844, 390, true],
    ['desktop', 1280, 800, false],
  ]) {
    if (process.argv.includes('--environment-only')) break;
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch });
    page.on('pageerror', (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    page.on('console', (m) => {
      if (m.type() === 'error') {
        errors.push(m.text());
        console.error(m.text());
      }
    });
    await page.goto(base);
    await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
    if (touch) {
      await page.getByRole('button', { name: 'Touchscreen Options', exact: true }).tap();
      await page.getByRole('switch', { name: 'Touchscreen mode: OFF', exact: true }).tap();
      await page.getByRole('button', { name: 'Back to previous menu', exact: true }).tap();
    }
    await page.locator('#keyboardFallback')[touch ? 'tap' : 'click']();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
    await page.locator('#playtest [data-choice-index="0"]').click();
    await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.screen);
    await page.waitForTimeout(350);
    records.push(
      await page.evaluate(() => ({
        viewport: [innerWidth, innerHeight],
        boat: urchinDebug.three.project(urchinDebug.world.boat.x, urchinDebug.world.boat.y, 0),
        kelp: urchinDebug.three.coast.kelpPatches?.length,
        frank: document.querySelector('#frankAboard').getBoundingClientRect().toJSON(),
        visibleHud: [...document.querySelectorAll('[data-hud-window]')]
          .filter((e) => !e.hidden && e.getBoundingClientRect().width)
          .map((e) => e.id),
      })),
    );
    await page.screenshot({ path: `${output}/${name}-tutorial.png` });
    await page.evaluate(() => {
      const w = urchinDebug.world,
        b = w.boat;
      w.career.intro.step = 8;
      Object.assign(w.divers[0], { state: 'surface', x: b.x - 6, y: b.y, bag: 300, air: 0.4 });
    });
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${output}/${name}-pickup.png` });
    await page.waitForTimeout(2850);
    assert.equal(await page.locator('#seaSpeech').isVisible(), false, 'speech expires');
    await page.locator('[data-intro="skip"]').click();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'starter');
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[data-vessel]')].length === 2 &&
        [...document.querySelectorAll('[data-vessel]')].every((e) => e.dataset.loaded === 'true'),
    );
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${output}/${name}-starter.png` });
    const models = await page.locator('[data-vessel]').evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.dataset.vessel,
        model: n.dataset.model,
        loaded: n.dataset.loaded,
      })),
    );
    assert(models.every((n) => n.id === n.model));
    records.push({ name, models });
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ready);
    await page.locator('#keyboardFallback').click();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'starter');
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[data-vessel]')].filter((e) => e.dataset.loaded === 'true')
          .length === 2,
    );
    assert.deepEqual(
      await page.locator('[data-vessel]').evaluateAll((nodes) =>
        nodes.map((n) => ({
          id: n.dataset.vessel,
          model: n.dataset.model,
          loaded: n.dataset.loaded,
        })),
      ),
      models,
    );
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') {
      errors.push(m.text());
      console.error(m.text());
    }
  });
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, data), {
    key: SAVE_KEY,
    data: encode(careerWorld(createCareer(971))),
  });
  await page.goto(base);
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.locator('#keyboardFallback').click();
  await page.waitForFunction(() => urchinDebug.ui.started);
  await page.evaluate(() => {
    const d = urchinDebug;
    d.ui.open('chart');
    d.ui.index = 0;
    d.ui.activate(d.world);
  });
  await page.waitForFunction(() => urchinDebug.ui.screen === 'departure');
  await page.evaluate(() => {
    const d = urchinDebug;
    d.ui.index = 0;
    d.ui.activate(d.world);
  });
  await page.waitForFunction(() => !urchinDebug.ui.screen && !urchinDebug.ui.blocked);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    urchinDebug.world.day.minute = 600;
    urchinDebug.world.weather.sunlight = 1;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${output}/desktop-career.png` });
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world,
      r = d.three;
    r.host.scene.pause();
    document.querySelectorAll('body > *:not(#game)').forEach((e) => (e.style.display = 'none'));
    const rock = w.rocks.find((a) => (a.length || 0) > 2) || w.rocks[0];
    if (!rock) throw new Error('Career fixture must contain physical rocks');
    window.feedbackRock = rock;
    Object.assign(w.boat, { x: rock.x + 10, y: rock.y + 12 });
    r.host.cameras.main.setZoom(1.2);
    w.weather = { ...w.weather, visibility: 1000, rain: 0, wave: 0.1, sunlight: 1 };
    w.day.minute = 600;
    w.career.assists.currentArrows = false;
  });
  for (const depth of [5, 2, 0.3, -1.5]) {
    await page.evaluate((depth) => {
      const d = urchinDebug,
        w = d.world;
      w.environment.seaLevel = depth - window.feedbackRock.topDepth;
      d.three.draw(w, { ...d.ui, started: true, screen: null }, 0.016);
    }, depth);
    await page.screenshot({ path: `${output}/rock-depth-${depth}.png` });
  }
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world,
      p = d.three.coast.kelpPatches[0];
    w.boat.x = p.x;
    w.boat.y = p.z;
    w.environment.seaLevel = 0;
    d.three.host.cameras.main.setZoom(0.7);
  });
  for (const tide of [-1, 2, 5]) {
    await page.evaluate((tide) => {
      const d = urchinDebug,
        w = d.world;
      w.environment.seaLevel = tide;
      d.three.draw(w, { ...d.ui, started: true, screen: null }, 0.016);
    }, tide);
    await page.screenshot({ path: `${output}/kelp-tide-${tide}.png` });
  }
  for (const wind of [0, 5, 15]) {
    await page.evaluate((wind) => {
      const d = urchinDebug,
        w = d.world;
      w.boat.x = 250;
      w.boat.y = 250;
      w.environment.seaLevel = 0;
      w.environment.wind = { x: wind, y: 0 };
      d.three.host.cameras.main.setZoom(0.3);
      d.three.draw(w, { ...d.ui, started: true, screen: null }, 0.016);
    }, wind);
    await page.screenshot({ path: `${output}/wind-${wind}.png` });
  }
  const currentSamples = await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world,
      r = d.three;
    w.career.assists.currentArrows = true;
    w.environment.wind = { x: 0, y: 0 };
    w.environment.flow = 1.5;
    r.host.cameras.main.setZoom(0.3);
    r.draw(w, { ...d.ui, started: true, screen: null }, 0.016);
    return r.currentArrows.userData.samples;
  });
  await page.screenshot({ path: `${output}/current-field-wide.png` });
  const shiftedSamples = await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world;
    w.boat.x += 7;
    d.three.draw(w, { ...d.ui, started: true, screen: null }, 0.016);
    return d.three.currentArrows.userData.samples;
  });
  assert(
    currentSamples.filter((p) => shiftedSamples.some((q) => p.x === q.x && p.y === q.y)).length >
      currentSamples.length * 0.8,
  );
  for (const helm of [-1, 1]) {
    const drives = await page.evaluate((helm) => {
      const d = urchinDebug,
        w = d.world,
        r = d.three;
      w.boat.configuration = 'outboard';
      Object.assign(w.boat, { x: 250, y: 250, rudder: helm, throttle: 0.4 });
      w.career.assists.currentArrows = false;
      r.host.cameras.main.setZoom(2.2);
      r.draw(w, { ...d.ui, started: true, screen: null }, 0.016);
      return r.vessels.boat.userData.drives.map((m) => m.rotation.y);
    }, helm);
    assert.equal(drives.length, 2);
    assert(drives.every((angle) => Math.abs(angle + helm * 0.58) < 0.0001));
    records.push({ helm, drives });
    await page.screenshot({ path: `${output}/outboards-helm-${helm}.png` });
  }
  await page.evaluate(() => {
    const d = urchinDebug,
      w = d.world,
      r = d.three;
    w.boat.configuration = 'basic';
    Object.assign(w.boat, {
      x: 250,
      y: 300,
      heading: 0,
      speed: 4,
      vx: 0,
      vy: -4,
      throttle: 0.65,
      rudder: 0,
      hullHealth: 0.55,
    });
    w.catch = 900;
    w.bags = Array.from({ length: 3 }, () => ({ weight: 300 }));
    r.host.cameras.main.setZoom(1.2);
    for (let frame = 0; frame < 90; frame++) {
      w.boat.y -= 0.4;
      w.time += 0.1;
      r.draw(w, { ...d.ui, started: true, screen: null }, 0.1);
    }
  });
  await page.screenshot({ path: `${output}/loaded-damaged-boat-wake.png` });
  await page.close();
  writeFileSync(`${output}/${receipt}`, JSON.stringify({ records, errors }, null, 2));
  assert.deepEqual(errors, []);
  console.log(
    'Feedback layouts, stable fleet identities, speech expiry and environmental captures passed.',
  );
} finally {
  writeFileSync(`${output}/${receipt}`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
