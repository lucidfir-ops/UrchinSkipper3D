import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { TRAFFIC_PROFILES } from '../src/three/traffic-profiles.js';
const output = 'test-results/cohesion';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1440 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  const url = new URL(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/');
  url.searchParams.set('practice', '1');
  await page.goto(url.href);
  await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 90000 });
  const result = await page.evaluate((ids) => {
    const d = urchinDebug,
      r = d.three,
      w = d.world,
      original = r.vessels;
    r.host.scene.pause();
    document.body.classList.remove('in-port');
    document
      .querySelectorAll('body > *:not(#game),#game > *:not(#ocean3d)')
      .forEach((e) => (e.style.display = 'none'));
    r.draw(w, { ...d.ui, started: true, screen: null }, 0);
    original.boat.visible = false;
    original.divers.forEach((v) => (v.group.visible = false));
    r.currentArrows.visible = false;
    const actors = ids.map((art, i) => ({
      id: art,
      art,
      kind: art.split('-')[0] === 'nine' ? 'tourist' : art.split('-')[0],
      phase: 'transit',
      x: w.boat.x + ((i % 5) - 2) * 17,
      y: w.boat.y + (Math.floor(i / 5) - 2) * 21,
      heading: -0.2,
      length: 10,
      width: 3.8,
      deckBags: 0,
      divers: [],
      vx: 0,
      vy: 0,
    }));
    const view = new original.constructor(r.scene);
    view.update({ ...w, traffic: { actors, accumulator: 0 }, divers: [] }, 0);
    view.boat.visible = false;
    const camera = r.camera;
    camera.left = -50;
    camera.right = 50;
    camera.top = 50;
    camera.bottom = -50;
    camera.position.set(w.boat.x, 160, w.boat.y + 80);
    camera.lookAt(w.boat.x, 0, w.boat.y);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    r.renderer.render(r.scene, camera);
    const labels = document.createElement('div');
    labels.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:99999;color:#f4ebd5;font:14px system-ui;text-shadow:0 2px 3px #000';
    labels.innerHTML =
      '<div style="text-align:center;padding:18px;letter-spacing:3px">TRAFFIC FLEET · ALL 25 PRESERVED IDENTITIES</div>';
    for (const actor of actors) {
      const p = r.project(actor.x, actor.y + 7.2),
        label = document.createElement('div');
      label.textContent = actor.art;
      label.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;transform:translateX(-50%);background:#102b2ae6;padding:4px 8px;border-radius:4px`;
      labels.append(label);
    }
    document.body.append(labels);
    return actors.map((a) => ({
      art: a.art,
      profile: view.traffic.get(a.id).userData.profile,
      meshes: view.traffic.get(a.id).children.length,
      visible: view.traffic.get(a.id).visible,
      position: view.traffic.get(a.id).position.toArray(),
    }));
  }, Object.keys(TRAFFIC_PROFILES));
  assert.equal(result.length, 25);
  assert.ok(
    result.every(
      (x) => x.profile && x.meshes > 0 && x.visible && x.position.every(Number.isFinite),
    ),
  );
  assert.equal(await page.locator('#ocean3d').isVisible(), true, 'gallery canvas must be visible');
  await page.screenshot({ path: `${output}/traffic-twenty-five.png` });
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/traffic-contract.json`, JSON.stringify(result, null, 2));
  console.log(
    'All 25 traffic references render using explicit 3D profiles; physical actors remain unchanged.',
  );
} finally {
  await browser.close();
}
