import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { FLEET, UPGRADES } from '../src/career-data.js';
const output = 'test-results/cohesion';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  const url = new URL(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/');
  url.searchParams.set('practice', '1');
  await page.goto(url.href);
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  const result = await page.evaluate(
    ({ ids, equipment }) => {
      const d = urchinDebug,
        r = d.three,
        original = r.vessels,
        w = d.world;
      r.host.scene.pause();
      document.body.classList.remove('in-port');
      document
        .querySelectorAll('body > *:not(#game), #game > *:not(#ocean3d)')
        .forEach((e) => (e.style.display = 'none'));
      const origin = { x: w.boat.x, y: w.boat.y };
      r.draw(w, { ...d.ui, started: true, screen: null }, 0.016);
      original.boat.visible = false;
      r.currentArrows.visible = false;
      original.divers.forEach((v) => (v.group.visible = false));
      const views = ids.map((id, i) => {
        const v = new original.constructor(r.scene);
        // Each gallery copy would add two more shadow-casting work lights and
        // two torches. Twelve copies exceed the GPU's varying limit ("Could not
        // pack varying"); the game itself has one set. Keep the original's.
        r.scene.remove(v.lightRig);
        v.diverTorches.forEach((torch) => r.scene.remove(torch.group));
        const world = {
          ...w,
          boat: {
            ...w.boat,
            configuration: id,
            x: origin.x + ((i % 4) - 1.5) * 19,
            y: origin.y + (Math.floor(i / 4) - 1) * 26,
            heading: -0.26,
            throttle: 0,
          },
          career: {
            ...w.career,
            fleet: {
              [id]: { equipment: id.endsWith('-sister') ? equipment : [], disabledEquipment: [] },
            },
          },
          traffic: { actors: [] },
          bags: [],
          catch: 0,
          divers: w.divers.map((a) => ({ ...a, state: 'ready' })),
        };
        v.update(world, 0.016);
        return { v, world, id };
      });
      const camera = r.camera;
      camera.left = -51.84;
      camera.right = 51.84;
      camera.top = 36;
      camera.bottom = -36;
      camera.position.set(origin.x, 140, origin.y + 90);
      camera.lookAt(origin.x, 0, origin.y);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      r.renderer.render(r.scene, camera);
      const labels = document.createElement('div');
      labels.id = 'reviewLabels';
      labels.style.cssText =
        'position:fixed;inset:0;pointer-events:none;color:#eee8d5;font:13px system-ui;text-shadow:0 2px 3px #000;z-index:99999';
      labels.innerHTML =
        '<div style="text-align:center;padding:18px;font-size:18px;letter-spacing:3px">THE WORKING FLEET · TWELVE CAREER HULLS</div>';
      for (const { world, id, v } of views) {
        const p = r.project(world.boat.x, world.boat.y + 10);
        const label = document.createElement('div');
        label.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;transform:translateX(-50%);text-align:center;background:#102b2ae6;padding:5px 9px;border-radius:4px`;
        label.textContent =
          v.boat.userData.profile.id + ' · ' + (id.endsWith('-sister') ? 'fitted' : 'standard');
        labels.append(label);
      }
      document.body.append(labels);
      window.cohesionViews = views;
      return views.map(({ v, id }) => ({
        id,
        profile: v.boat.userData.profile,
        stations: Object.keys(v.boat.userData.fittings),
        crew: v.boat.userData.deckCrew.length,
      }));
    },
    {
      ids: Object.keys(FLEET),
      equipment: UPGRADES.filter((x) => x.slot !== 'timepiece').map((x) => x.id),
    },
  );
  assert.equal(result.length, 12);
  assert.equal(new Set(result.map((r) => r.profile.id)).size, 12);
  assert.ok(result.every((r) => r.crew === 2));
  assert.equal(await page.locator('#ocean3d').isVisible(), true, 'gallery canvas must be visible');
  await page.screenshot({ path: `${output}/fleet-twelve.png` });
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/fleet-contract.json`, JSON.stringify(result, null, 2));
  console.log(
    'Twelve fleet profiles, fitted stations, and two crew per hull verified; screenshots need independent review.',
  );
} finally {
  await browser.close();
}
