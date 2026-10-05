// October 4 deck-load review: every career hull carrying a full and an
// overfull load of red sacks, photographed top-down so the wheelhouse and the
// open working deck can be compared. Screenshots need independent review.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { FLEET } from '../src/career-data.js';
const output = 'test-results/deck-load';
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
  const summary = [];
  for (const [label, factor] of [
    ['full', 1],
    ['overfull', 2],
  ]) {
    const result = await page.evaluate(
      ({ fleet, factor }) => {
        const d = urchinDebug,
          r = d.three,
          original = r.vessels,
          w = d.world;
        r.host.scene.pause();
        document.body.classList.remove('in-port');
        document
          .querySelectorAll('body > *:not(#game), #game > *:not(#ocean3d)')
          .forEach((e) => (e.style.display = 'none'));
        // Reuse one view per hull: each VesselView adds shadowed work lights.
        const reuse = window.deckLoadViews || [];
        const origin = { x: w.boat.x, y: w.boat.y };
        r.draw(w, { ...d.ui, started: true, screen: null }, 0.016);
        original.boat.visible = false;
        r.currentArrows.visible = false;
        original.divers.forEach((v) => (v.group.visible = false));
        const views = Object.entries(fleet).map(([id, capacity], i) => {
          let v = reuse[i];
          if (!v) {
            v = new original.constructor(r.scene);
            // Daylight review: drop each extra view's (unlit) spot lights so
            // twelve hulls stay within the GPU's shader sampler limits.
            v.lightRig.removeFromParent();
            v.diverTorches.forEach((torch) => torch.group.removeFromParent());
          }
          const count = Math.ceil(capacity / 300) * factor,
            world = {
              ...w,
              boat: {
                ...w.boat,
                configuration: id,
                x: origin.x + ((i % 4) - 1.5) * 19,
                y: origin.y + (Math.floor(i / 4) - 1) * 26,
                heading: 0,
                throttle: 0,
              },
              career: { ...w.career, fleet: { [id]: { equipment: [], disabledEquipment: [] } } },
              traffic: { actors: [] },
              bags: Array.from({ length: count }, (_, n) => ({ id: `review-${n}`, weight: 300 })),
              catch: count * 300,
              divers: w.divers.map((a) => ({ ...a, state: 'ready' })),
            };
          v.update(world, 0.016);
          v.divers.forEach((diver) => (diver.group.visible = false));
          return { v, world, id, count };
        });
        window.deckLoadViews = views.map((x) => x.v);
        const camera = r.camera;
        camera.left = -50;
        camera.right = 50;
        camera.top = 50 * (1000 / 1440);
        camera.bottom = -50 * (1000 / 1440);
        camera.position.set(origin.x, 160, origin.y + 0.01);
        camera.lookAt(origin.x, 0, origin.y);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        r.renderer.render(r.scene, camera);
        document.getElementById('deckLoadLabels')?.remove();
        const labels = document.createElement('div');
        labels.id = 'deckLoadLabels';
        labels.style.cssText =
          'position:fixed;inset:0;pointer-events:none;color:#eee8d5;font:13px system-ui;text-shadow:0 2px 3px #000;z-index:99999';
        for (const { world, id, count } of views) {
          const p = r.project(world.boat.x, world.boat.y + 9);
          const tag = document.createElement('div');
          tag.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;transform:translateX(-50%);background:#102b2ae6;padding:3px 7px;border-radius:4px`;
          tag.textContent = `${id} · ${count} sacks`;
          labels.append(tag);
        }
        document.body.append(labels);
        return views.map(({ v, id, count }) => ({
          id,
          count,
          drawn: v.boat.userData.catchLoad.bodies.count,
          stations: v.boat.userData.stations,
        }));
      },
      {
        fleet: Object.fromEntries(Object.entries(FLEET).map(([id, s]) => [id, s.capacity])),
        factor,
      },
    );
    assert.equal(result.length, 12);
    assert.ok(result.every((x) => x.drawn === x.count));
    await page.screenshot({ path: `${output}/fleet-${label}.png` });
    summary.push({ label, result });
    // Close top-down view of each hull so wheelhouse and stack edges are legible.
    for (const [i, { id }] of result.entries()) {
      await page.evaluate((index) => {
        const r = urchinDebug.three,
          v = window.deckLoadViews[index],
          camera = r.camera,
          { x, z } = v.boat.position;
        document.getElementById('deckLoadLabels')?.remove();
        camera.left = -9;
        camera.right = 9;
        camera.top = 9 * (1000 / 1440);
        camera.bottom = -9 * (1000 / 1440);
        camera.position.set(x, 160, z + 0.01);
        camera.lookAt(x, 0, z);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        r.renderer.render(r.scene, camera);
      }, i);
      await page.screenshot({ path: `${output}/${label}-${id}.png` });
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/deck-load.json`, JSON.stringify(summary, null, 2));
  console.log('Twelve loaded hulls rendered; screenshots need independent review.');
} finally {
  await browser.close();
}
