import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deckMarkers } from '../src/presentation.js';
mkdirSync('test-results/three', { recursive: true });
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
const errors = [];
const missing = [];
page.on('response', (r) => {
  if (r.status() === 404) missing.push(r.url());
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (e) => {
  if (e.type() === 'error' && !e.text().includes('favicon')) errors.push(e.text());
});
try {
  await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/?practice=1');
  await page.waitForFunction(() => window.urchinDebug?.ready, { timeout: 90000 });
  const result = await page.evaluate(() => {
    const d = urchinDebug,
      base = d.world,
      renderer = d.three,
      v = renderer.vessels;
    renderer.host.scene.pause();
    document.querySelectorAll('body > *:not(#game)').forEach((e) => {
      e.style.display = 'none';
    });
    document.querySelectorAll('#game > *:not(#ocean3d)').forEach((e) => {
      e.style.display = 'none';
    });
    renderer.host.cameras.main.setZoom(3.7);
    const w = {
      ...base,
      time: 80,
      day: { ...base.day },
      environment: { ...base.environment },
      boat: { ...base.boat },
      divers: base.divers.map((x) => ({ ...x })),
      traffic: { actors: [], accumulator: 0.05 },
    };
    w.divers.forEach((diver) => {
      diver.state = 'ready';
    });
    w.boat.speed = w.boat.throttle = w.boat.vy = 0;
    w.boat.vx = 2;
    v.wakes.reset();
    v.wakeAccumulator = 0;
    v.update(w, 0.1);
    v.update(w, 0.1);
    const driftWakeCount = v.wakes.particles.filter((p) => p.life > 0).length;
    w.boat.throttle = 0.5;
    v.wakes.reset();
    v.wakeAccumulator = 0;
    v.update(w, 0.1);
    v.update(w, 0.1);
    const forwardWash = v.wakes.particles.find((p) => p.life > 0)?.vz;
    w.boat.throttle = -0.5;
    v.wakes.reset();
    v.wakeAccumulator = 0;
    v.update(w, 0.1);
    v.update(w, 0.1);
    const reverseWash = v.wakes.particles.find((p) => p.life > 0)?.vz;
    const wash = { driftWakeCount, forwardWash, reverseWash };
    w.weather = { night: true, visibility: 1000, wave: 0.2, rain: 0 };
    w.boat.vx = w.boat.vy = w.boat.speed = w.boat.throttle = 0;
    Object.assign(w.divers[0], { state: 'harvesting', x: w.boat.x + 30, y: w.boat.y });
    Object.assign(w.divers[1], { state: 'surface', x: w.boat.x + 30, y: w.boat.y + 1 });
    v.wakes.reset();
    v.wakeAccumulator = 0;
    v.update(w, 0.1);
    v.update(w, 0.1);
    const farNight = {
      surface: v.divers[1].group.visible,
      bubbles: v.wakes.particles.filter((p) => p.life > 0 && p.bubble).length,
    };
    w.divers[0].x = w.boat.x + 5;
    w.divers[1].x = w.boat.x + 6;
    v.update(w, 0.1);
    v.update(w, 0.1);
    const nearNight = {
      surface: v.divers[1].group.visible,
      bubbles: v.wakes.particles.filter((p) => p.life > 0 && p.bubble).length,
      aboard: v.boat.userData.deckCrew.map((c) => c.visible),
    };
    w.divers[0].state = 'deploying';
    v.wakes.reset();
    v.wakeAccumulator = 0;
    v.update(w, 0.1);
    v.update(w, 0.1);
    const deployment = {
      body: v.divers[0].group.visible,
      bubbles: v.wakes.particles.filter((p) => p.life > 0 && p.bubble).length,
    };
    w.divers[0].state = 'harvesting';
    w.weather = { kind: 'fog', visibility: 50, wave: 1.5, rain: 0.3 };
    w.divers[0].x = w.boat.x + 40;
    v.wakes.reset();
    v.update(w, 0.1);
    v.update(w, 0.1);
    const fogOpacity = v.wakes.particles
      .map((p, i) => (p.bubble && p.life > 0 ? v.wakes.opacities.getX(i) : 0))
      .filter((x) => x > 0);
    w.day.returnFade = 1.1;
    w.boat.vy = -3;
    v.update(w, 0.016);
    const departure = { alpha: v.boat.userData.alpha, y: v.boat.position.z, physicalY: w.boat.y };
    delete w.day.returnFade;
    w.day.phase = 'complete';
    v.update(w, 0.016);
    const complete = v.boat.visible;
    w.day.phase = base.day.phase;
    w.boat.vy = 0;
    w.weather = { night: true, visibility: 1000, wave: 0.2, rain: 0 };
    w.career = {
      assists: { preset: 'realistic', currentArrows: false },
      fleet: { [w.boat.configuration]: { equipment: ['lights'], disabledEquipment: [] } },
    };
    v.update(w, 0.016);
    const lightsOn = v.workSpots.map((l) => l.intensity);
    w.career.fleet[w.boat.configuration].disabledEquipment = ['lights'];
    v.update(w, 0.016);
    const lightsOff = v.workSpots.map((l) => l.intensity);
    w.career.fleet[w.boat.configuration].disabledEquipment = [];
    w.day.minute = 1300;
    w.divers[0].x = w.boat.x + 5;
    w.divers[1].x = w.boat.x - 5;
    w.divers[1].y = w.boat.y + 1;
    w.safety = {
      incidents: [
        {
          outcome: 'fatality',
          x: w.boat.x + 8,
          y: w.boat.y + 3,
          time: w.time,
          sector: w.day.groundId,
        },
      ],
      fatalities: 1,
      injuries: 0,
    };
    v.update(w, 0.016);
    const pool = {
      visible: v.surfaceCues.pools[0].visible,
      diameter: v.surfaceCues.pools[0].scale.x,
    };
    w.traffic.actors = [
      {
        id: 'review-rival',
        kind: 'rival',
        phase: 'transit',
        name: 'Review',
        x: w.boat.x + 22,
        y: w.boat.y,
        heading: 0,
        length: 11,
        width: 4,
        vx: 0,
        vy: 0,
        deckBags: 7,
        renderFrom: { x: w.boat.x + 20, y: w.boat.y, heading: 0 },
        divers: [
          { x: w.boat.x + 19, y: w.boat.y + 6, underwater: false },
          { x: w.boat.x + 18, y: w.boat.y - 5, underwater: true },
        ],
      },
    ];
    v.update(w, 0.016);
    const traffic = {
      x: v.traffic.get('review-rival').position.x,
      actualX: w.traffic.actors[0].x,
      previousX: w.traffic.actors[0].renderFrom.x,
      catchBags: v.traffic.get('review-rival').userData.catchLoad.bodies.count,
      rivalSurface: [...v.rivalDivers.values()].map((m) => m.group.visible),
    };
    w.traffic.actors = [];
    w.bags = Array.from({ length: 97 }, (_, id) => ({ id: `review-bag-${id}`, weight: 10 }));
    w.catch = 970;
    v.update(w, 0.016);
    const grownBagCount = v.boat.userData.catchLoad.bodies.count;
    w.bags = w.bags.slice(0, 27);
    w.catch = 270;
    v.update(w, 0.016);
    const bagMesh = v.boat.userData.catchLoad.bodies,
      matrices = bagMesh.instanceMatrix.array;
    const catchLoad = {
      count: bagMesh.count,
      grownBagCount,
      spec: d.simulation.boatSpec(w),
      instances: Array.from({ length: bagMesh.count }, (_, i) => ({
        x: matrices[i * 16 + 12],
        y: matrices[i * 16 + 13],
        z: matrices[i * 16 + 14],
        radius: Math.hypot(matrices[i * 16], matrices[i * 16 + 2]),
      })),
    };
    renderer.draw(w, { ...d.ui, started: true, screen: null }, 0.016);
    window.vesselReviewWorld = w;
    const gl = renderer.renderer.getContext(),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return {
      wash,
      deployment,
      farNight,
      nearNight,
      fogOpacity,
      departure,
      complete,
      lightsOn,
      lightsOff,
      pool,
      traffic,
      catchLoad,
      gpu,
    };
  });
  assert.equal(result.wash.driftWakeCount, 0);
  assert.ok(result.wash.forwardWash > 0 && result.wash.reverseWash < 0);
  assert.equal(result.deployment.body, false);
  assert.ok(result.deployment.bubbles > 0);
  assert.equal(result.farNight.surface, false);
  assert.equal(result.farNight.bubbles, 0);
  assert.equal(result.nearNight.surface, true);
  assert.ok(result.nearNight.bubbles > 0);
  assert.deepEqual(result.nearNight.aboard, [false, false]);
  assert.ok(result.fogOpacity.length > 0 && result.fogOpacity.every((a) => a < 0.5 && a > 0));
  assert.ok(result.departure.alpha > 0 && result.departure.alpha < 1);
  assert.ok(result.departure.y < result.departure.physicalY);
  assert.equal(result.complete, false);
  assert.ok(result.lightsOn.every((x) => x > 0));
  assert.deepEqual(result.lightsOff, [0, 0]);
  assert.ok(result.pool.visible && result.pool.diameter > 14);
  assert.ok(
    result.traffic.x >= result.traffic.previousX && result.traffic.x <= result.traffic.actualX,
  );
  assert.equal(result.traffic.catchBags, 7);
  assert.deepEqual(result.traffic.rivalSurface, [true, false]);
  assert.equal(result.catchLoad.count, 27);
  assert.equal(result.catchLoad.grownBagCount, 97);
  const marks = deckMarkers(Array.from({ length: 27 }), result.catchLoad.spec);
  marks.forEach((mark, i) => {
    const instance = result.catchLoad.instances[i];
    assert.ok(
      Math.abs(instance.x - (mark.x * result.catchLoad.spec.width) / 4) < 1e-5,
      `bag ${i} transverse placement`,
    );
    assert.ok(
      Math.abs(instance.z - (mark.y * result.catchLoad.spec.length) / 10) < 1e-5,
      `bag ${i} fore/aft placement`,
    );
    assert.ok(Math.abs(instance.radius - mark.radius) < 1e-5, `bag ${i} fixed radius`);
    if (mark.layer > 0)
      assert.ok(instance.y > result.catchLoad.instances[0].y, `bag ${i} layered height`);
  });
  await page.screenshot({ path: 'test-results/three/vessels-night-safety.png' });
  await page.evaluate(() => {
    const w = window.vesselReviewWorld;
    w.day.minute = 690;
    w.weather = { night: false, visibility: 1000, wave: 0.2, rain: 0 };
    urchinDebug.three.draw(w, { ...urchinDebug.ui, started: true, screen: null }, 0.016);
  });
  await page.screenshot({ path: 'test-results/three/vessels-day-safety.png' });
  await page.evaluate(() => {
    const w = window.vesselReviewWorld;
    w.divers.forEach((d) => {
      d.state = 'ready';
    });
    w.safety.incidents = [];
    w.boat.heading = -0.55;
    urchinDebug.three.draw(w, { ...urchinDebug.ui, started: true, screen: null }, 0.016);
  });
  await page.screenshot({ path: 'test-results/three/vessels-loaded-deck.png' });
  if (process.argv.includes('--fleet')) {
    const fleet = await page.evaluate(() => {
      const d = urchinDebug,
        renderer = d.three,
        original = renderer.vessels,
        template = window.vesselReviewWorld;
      original.boat.visible = false;
      const families = ['basic', 'thruster', 'sterndrive', 'outboard', 'jet', 'twinjet'];
      const names = [
        'Harbour Workhorse',
        'Coastal Workhorse',
        'Reef Runner',
        'Island Tender',
        'Shoal Skipper',
        'Channel Master',
      ];
      const x = template.boat.x,
        z = template.boat.y;
      const views = families.map((id, i) => {
        const world = {
          ...template,
          boat: {
            ...template.boat,
            configuration: id,
            x: x + ((i % 3) - 1) * 19,
            y: z + (Math.floor(i / 3) - 0.5) * 22,
            heading: -0.35,
          },
          career: { ...template.career, fleet: { [id]: { equipment: [], disabledEquipment: [] } } },
          bags: template.bags.slice(0, 2),
          catch: 300,
          safety: { incidents: [] },
        };
        const view = new original.constructor(renderer.scene);
        view.update(world, 0.016);
        return { view, world, spec: d.simulation.boatSpec(world), name: names[i] };
      });
      const camera = renderer.camera;
      camera.left = -37;
      camera.right = 37;
      camera.top = 28.12;
      camera.bottom = -28.12;
      camera.position.set(x, 120, z + 65);
      camera.lookAt(x, 0, z);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      renderer.renderer.render(renderer.scene, camera);
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:10000;color:#f0eedc;font-family:system-ui;text-shadow:0 1px 5px #082e36';
      const title = document.createElement('div');
      title.style.cssText =
        'position:absolute;top:22px;width:100%;text-align:center;letter-spacing:4px;font-size:13px';
      title.textContent = 'THE WORKING FLEET';
      overlay.append(title);
      views.forEach(({ world, spec, name }) => {
        const p = renderer.project(world.boat.x, world.boat.y + spec.length * 0.55 + 1.2);
        const label = document.createElement('div');
        label.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;transform:translateX(-50%);text-align:center;font-size:12px;white-space:nowrap`;
        label.textContent = `${name} · ${spec.length} × ${spec.width} m`;
        overlay.append(label);
      });
      document.body.append(overlay);
      window.vesselFleetReview = views;
      return views.map(({ world, spec }) => ({
        id: world.boat.configuration,
        length: spec.length,
        width: spec.width,
      }));
    });
    await page.screenshot({ path: 'test-results/three/vessels-fleet.png' });
    result.fleet = fleet;
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  writeFileSync(
    'test-results/three/vessels-contract.json',
    JSON.stringify({ ...result, errors, missing }, null, 2),
  );
  console.log(JSON.stringify({ ...result, errors, missing }, null, 2));
} finally {
  await browser.close();
}
