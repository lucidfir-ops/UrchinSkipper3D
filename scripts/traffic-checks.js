import assert from 'node:assert/strict';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
export async function trafficChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const action = (name) => pressAction(page, 'trafficPad', name),
    choose = (label) => chooseController(page, action, label);
  try {
    await page.addInitScript(gamepadScript, { name: 'trafficPad', id: 'Traffic Xbox' });
    await page.goto(process.env.URCHIN_TEST_URL);
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await action('confirm');
    await choose('Choose Harbour Workhorse');
    await choose('Harbour office');
    await choose('Fleet landings');
    assert(!/Shai|Jessy Bean|Paul|Worm/i.test(await page.locator('#playtest').innerText()));
    await page.screenshot({ path: 'test-results/v2-rival-roster.png' });
    await action('back');
    await action('back');
    await choose('Sail');
    await choose('Sheltered Kelp');
    await choose('Begin working day');
    await page.locator('#voyage').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.day.minute = 650;
      w.career.trafficSettings = { rate: 0 };
      Object.assign(w.environment, {
        model: 'uniform',
        current: { x: 0, y: 0 },
        wind: { x: 0, y: 0 },
        waves: 0,
      });
      const p = w.patches.find((p) => p.remaining > 0 && p.quality >= 0.6);
      Object.assign(w.boat, { x: p.x + 40, y: p.y + 40, vx: 0, vy: 0, throttle: 0 });
      for (const kind of ['taxi', 'tourist', 'rival'])
        window.urchinDebug.spawnTraffic(kind, { patchId: p.id });
    });
    await page.waitForFunction(() => urchinDebug.world.traffic.actors.length >= 2);
    const before = await page.evaluate(() =>
      urchinDebug.world.traffic.actors.map((a) => ({ id: a.id, x: a.x, y: a.y })),
    );
    await page.evaluate(() => urchinDebug.step(20));
    const moved = await page.evaluate(() =>
      urchinDebug.world.traffic.actors.map((a) => ({ id: a.id, x: a.x, y: a.y })),
    );
    assert(
      moved.some((a) => {
        const b = before.find((b) => b.id === a.id);
        return b && Math.hypot(a.x - b.x, a.y - b.y) > 5;
      }),
    );
    await page.evaluate(() => {
      const w = urchinDebug.world,
        a = w.traffic.actors.find((a) => a.kind === 'rival') || w.traffic.actors[0];
      Object.assign(w.boat, { x: a.x + 12, y: a.y + 12, vx: 0, vy: 0, throttle: 0 });
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/v2-physical-traffic.png' });
    await action('pause');
    const state = await page.evaluate(() => JSON.parse(JSON.stringify(urchinDebug.world.traffic)));
    await choose('Title screen');
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ui);
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(JSON.stringify(urchinDebug.world.traffic))),
      state,
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS: hidden-team privacy, seeded rival board, real water routes, physical traffic movement, artwork and exact save/resume',
    );
  } finally {
    await page.close();
  }
}
