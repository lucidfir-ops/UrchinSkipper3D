import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const output = 'test-results/vegetation-2026-09-29';
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
try {
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5183/');
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  await page.locator('#keyboardFallback').click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
  await page.locator('#playtest [data-choice-index="0"]').click();
  await page.waitForFunction(() => urchinDebug.ui.started && !urchinDebug.ui.screen);
  await page.waitForTimeout(500);
  records.push(
    await page.evaluate(() => {
      const d = urchinDebug,
        r = d.three,
        w = d.world;
      r.host.scene.pause();
      document.querySelectorAll('body > *:not(#game)').forEach((e) => (e.style.display = 'none'));
      w.career.testConditions = null;
      w.environment.model = 'uniform';
      w.environment.current = { x: 0.8, y: 0 };
      w.environment.wind = { x: 0, y: 0 };
      w.environment.seaLevel = -1;
      w.weather = { ...w.weather, visibility: 1000, rain: 0, wave: 0.1, sunlight: 1 };
      w.day.minute = 600;
      w.career.assists.currentArrows = false;
      return {
        kelp: r.coast.kelpPatches.length,
        grass: r.coast.eelgrassPatches.length,
        kelpDepth: [
          Math.min(...r.coast.kelpPatches.map((p) => p.depth)),
          Math.max(...r.coast.kelpPatches.map((p) => p.depth)),
        ],
        grassDepth: [
          Math.min(...r.coast.eelgrassPatches.map((p) => p.depth)),
          Math.max(...r.coast.eelgrassPatches.map((p) => p.depth)),
        ],
      };
    }),
  );
  assert(records[0].kelp > 80 && records[0].grass > 400);
  assert(records[0].kelpDepth[0] >= 4 && records[0].kelpDepth[1] <= 10);
  assert(records[0].grassDepth[0] >= 2 && records[0].grassDepth[1] <= 6);
  for (const habitat of ['kelp', 'grass']) {
    await page.evaluate((habitat) => {
      const d = urchinDebug,
        r = d.three,
        w = d.world;
      const plants = habitat === 'kelp' ? r.coast.kelpPatches : r.coast.eelgrassPatches;
      const candidates = plants.filter((p) => (habitat === 'kelp' ? p.x > 140 : p.depth < 2.9));
      const p = candidates[Math.floor(candidates.length / 2)] || plants[0];
      window.habitatFocus = { x: p.x, z: p.z };
      Object.assign(w.boat, { x: p.x + 8, y: p.z + 5, heading: 0, throttle: 0, rudder: 0 });
      r.host.cameras.main.setZoom(1.6);
    }, habitat);
    for (const tide of [-1, 2, 5]) {
      for (const direction of tide === -1 && habitat === 'kelp' ? [1, -1] : [1]) {
        records.push(
          await page.evaluate(
            ({ tide, direction }) => {
              const d = urchinDebug,
                r = d.three,
                w = d.world;
              w.environment.seaLevel = tide;
              w.environment.current = { x: direction * 0.8, y: 0 };
              r.coast.vegetation.nextFlow = 0;
              r.draw(w, { ...d.ui, screen: null, started: true }, 0);
              const plants = r.coast.kelpPatches;
              return {
                tide,
                direction,
                surfaced: plants.filter((p) => p.length >= p.depth + tide).length,
                angles: plants.slice(0, 5).map((p) => p.angle),
                calls: r.renderer.info.render.calls,
              };
            },
            { tide, direction },
          ),
        );
        await page.screenshot({ path: `${output}/${habitat}-tide-${tide}-flow-${direction}.png` });
      }
    }
    await page.evaluate(() => {
      const d = urchinDebug,
        r = d.three,
        w = d.world;
      w.environment.seaLevel = -1;
      r.draw(w, { ...d.ui, screen: null, started: true }, 0);
      const { x, z } = window.habitatFocus;
      r.camera.left = -14;
      r.camera.right = 14;
      r.camera.top = 8.75;
      r.camera.bottom = -8.75;
      r.camera.position.set(x, 24, z + 17);
      r.camera.lookAt(x, 0, z);
      r.camera.updateProjectionMatrix();
      r.camera.updateMatrixWorld();
      r.renderer.render(r.scene, r.camera);
    });
    await page.screenshot({ path: `${output}/${habitat}-close.png` });
  }
  const exposure = records.filter((r) => r.surfaced !== undefined).slice(0, 4);
  assert(
    exposure[0].surfaced > exposure[2].surfaced && exposure[2].surfaced > exposure[3].surfaced,
  );
  assert(exposure[0].angles.every((a) => Math.abs(a) < 0.001));
  assert(exposure[1].angles.every((a) => Math.abs(Math.abs(a) - Math.PI) < 0.001));
  await page.evaluate(() => {
    const d = urchinDebug,
      r = d.three,
      w = d.world;
    Object.assign(w.boat, { x: 145, y: 80 });
    w.environment.seaLevel = 0;
    w.career.assists.currentArrows = true;
    r.host.cameras.main.setZoom(0.5);
    r.draw(w, { ...d.ui, screen: null, started: true }, 0);
  });
  assert.equal(
    await page.evaluate(() => urchinDebug.three.currentArrows.arrows.material.opacity),
    0.22,
  );
  await page.screenshot({ path: `${output}/current-field.png` });
  for (const id of ['outboard', 'outboard-sister', 'sterndrive', 'jet', 'twinjet']) {
    for (const helm of [-1, 0, 1]) {
      const drives = await page.evaluate(
        ({ id, helm }) => {
          const d = urchinDebug,
            r = d.three,
            w = d.world;
          Object.assign(w.boat, {
            configuration: id,
            x: 145,
            y: 145,
            heading: 0,
            rudder: helm,
            throttle: 0.4,
          });
          w.career.assists.currentArrows = false;
          r.draw(w, { ...d.ui, screen: null, started: true }, 0);
          r.camera.left = -8;
          r.camera.right = 8;
          r.camera.top = 5;
          r.camera.bottom = -5;
          r.camera.position.set(157, 14, 164);
          r.camera.lookAt(145, 0, 145);
          r.camera.updateProjectionMatrix();
          r.camera.updateMatrixWorld();
          r.renderer.render(r.scene, r.camera);
          return r.vessels.boat.userData.drives.map((drive) => ({
            type: drive.userData.type,
            angle: drive.rotation.y,
            aftX: Math.sin(drive.rotation.y),
            thrustX: -Math.sin(drive.rotation.y),
            z: drive.position.z,
            propellerZ: drive.userData.propeller?.position.z,
          }));
        },
        { id, helm },
      );
      assert(drives.length > 0);
      assert(drives.every((d) => d.z > 0 && (helm === 0 ? d.angle === 0 : d.thrustX * helm < 0)));
      assert(drives.every((d) => d.propellerZ === undefined || d.propellerZ > 0));
      records.push({ id, helm, drives });
      await page.screenshot({ path: `${output}/${id}-helm-${helm}.png` });
    }
  }
  assert.deepEqual(errors, []);
  console.log('Vegetation habitats, tide exposure, flow reversal and five drive models passed.');
} finally {
  writeFileSync(`${output}/receipt.json`, JSON.stringify({ records, errors }, null, 2));
  await browser.close();
}
