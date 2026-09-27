import assert from 'node:assert/strict';

// Explicit placement/exposure fixtures; movement and boarding use production simulation.
export async function feedbackVisualChecks(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  const hiddenId = await page.evaluate(() => {
    const w = urchinDebug.world,
      p = w.patches.find((p) => p.charted === false);
    Object.assign(w.boat, { x: p.x + 4, y: p.y, heading: 0, vx: 0, vy: 0, throttle: 0, rudder: 0 });
    for (const d of w.divers) {
      Object.assign(d, { state: 'ready', bag: 0, condition: 'fit' });
      const h = w.career.people[d.crewId].diveHealth;
      if (h) Object.assign(h, { load: d.id === 0 ? 0.8 : 0.1, strain: 0, pending: false });
    }
    w.environment.current = { x: 0.35, y: 0.15 };
    urchinDebug.ui.revealUrchins = false;
    return p.id;
  });
  await page.waitForFunction(
    (id) =>
      !urchinDebug.terrainView.labels[urchinDebug.world.patches.findIndex((p) => p.id === id)]
        .visible,
    hiddenId,
  );
  await page.waitForTimeout(300);
  const panels = await page.evaluate(() => {
    const clock = document.querySelector('#clock').getBoundingClientRect();
    const navigation = document.querySelector('#navigation').getBoundingClientRect();
    return { clockLeft: clock.left, navigationRight: navigation.right };
  });
  assert(panels.navigationRight < panels.clockLeft, 'Touch clock clears the navigation banner');
  await page.screenshot({ path: 'test-results/feedback-unmarked-hidden-currents.png' });
  await page.locator('#touchMenu').tap();
  await page.locator('#playtest button').filter({ hasText: 'REVEAL EVERY URCHIN' }).tap();
  await page
    .locator('#playtest button')
    .filter({ hasText: /^Resume$/ })
    .tap();
  await page.waitForFunction(
    (id) =>
      urchinDebug.terrainView.labels[urchinDebug.world.patches.findIndex((p) => p.id === id)]
        .visible,
    hiddenId,
  );
  await page.screenshot({ path: 'test-results/feedback-unmarked-revealed.png' });
  await page.evaluate(() => {
    const w = urchinDebug.world;
    urchinDebug.ui.revealUrchins = false;
    w.environment.current = { x: 0, y: 0 };
    Object.assign(w.boat, { x: 250, y: 250, heading: 0, vx: 0, vy: 0, throttle: 0, rudder: 0 });
    for (const d of w.divers) d.state = 'ready';
    w.traffic.actors = [];
    delete w.day.inspection;
    if (!urchinDebug.spawnTraffic('dfo', { start: { x: 310, y: 310 } }))
      throw new Error('DFO fixture could not spawn');
  });
  await page.waitForFunction(() => urchinDebug.ui.screen === 'patrol');
  await page.screenshot({ path: 'test-results/feedback-dfo-approach.png' });
  await page.locator('#playtest button').filter({ hasText: 'Divers up, come over' }).tap();
  const boarded = await page.evaluate(() => {
    const w = urchinDebug.world;
    for (let i = 0; i < 120 && w.day.inspection?.status !== 'boarding'; i++) urchinDebug.step(1);
    const a = w.traffic.actors.find((a) => a.kind === 'dfo');
    return {
      status: w.day.inspection?.status,
      distance: Math.hypot(a.x - w.boat.x, a.y - w.boat.y),
      hull: w.boat.hullHealth,
    };
  });
  assert.equal(boarded.status, 'boarding');
  assert(boarded.distance < 8);
  assert.equal(boarded.hull, 1);
  await page.waitForFunction(() =>
    document.querySelector('#patrolBearing').textContent.includes('OFFICER ABOARD'),
  );
  await page.screenshot({ path: 'test-results/feedback-dfo-alongside.png' });
}
