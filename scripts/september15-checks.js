import assert from 'node:assert/strict';
import { gamepadScript, pressAction } from './gamepad-fixture.js';
import { chooseController } from './controller-menu.js';
export async function september15Checks(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } }),
    errors = [];
  const action = (name) => pressAction(page, 'feedbackPad', name),
    choose = async (label) => {
      await page.waitForFunction(() => !urchinDebug.input.suppressed);
      return chooseController(page, action, label);
    };
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.addInitScript(gamepadScript, { name: 'feedbackPad', id: 'September 15 Xbox' });
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await action('confirm');
    await choose('Choose Harbour Workhorse');
    assert.equal(await page.locator('.place-workshop svg').count(), 0);
    assert.match(
      await page.locator('body').evaluate((e) => getComputedStyle(e).backgroundImage),
      /harbour-training-mode-v1/,
    );
    await page.screenshot({ path: 'test-results/september15-harbour.png' });
    await choose('Meet the crew');
    assert(
      !/Product care|Quick picking|sorting|undersize|careful sort/i.test(
        await page.locator('#playtest').innerText(),
      ),
    );
    assert.match(await page.locator('.career-detail').innerText(), /Major \(fast\): Picking speed/);
    await action('back');
    await choose('Sail');
    for (const label of ['Sheltered Kelp', 'South Reef', 'Outer Ledge']) {
      await choose(label);
      await page.locator('.expedition-copy').waitFor();
      await page.evaluate(() => (feedbackPad.axes[3] = 1));
      await page.waitForFunction(() => document.querySelector('.expedition-copy').scrollTop > 80);
      await page.evaluate(() => (feedbackPad.axes[3] = 0));
      const atBottom = await page.locator('.expedition-copy').evaluate((e) => {
        e.scrollTop = e.scrollHeight;
        return e.scrollHeight - e.clientHeight;
      });
      assert(atBottom > 80);
      await page.screenshot({ path: `test-results/september15-scroll-${label.split(' ')[0]}.png` });
      await action('back');
    }
    await choose('Sheltered Kelp');
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.sandbox = true;
      w.diver.state = 'surface';
      urchinDebug.ui.signature = null;
    });
    await choose('Begin working day');
    await page
      .getByRole('button', { name: 'Bring both divers aboard first', exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() => urchinDebug.ui.choices(urchinDebug.world)[urchinDebug.ui.index]),
      'Bring both divers aboard first',
    );
    await page.screenshot({ path: 'test-results/september15-departure-remedy.png' });
    await action('confirm');
    assert(await page.evaluate(() => urchinDebug.world.divers.every((d) => d.state === 'ready')));
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.career.trafficSettings = { rate: 0, inspectionMinutes: 5 };
      w.career.testConditions = { weather: 'calm', current: 0, freezeClock: true };
    });
    await choose('Begin working day');
    await page.waitForFunction(() => !urchinDebug.ui.screen);
    const actorId = await page.evaluate(() => {
      const w = urchinDebug.world;
      w.day.minute = 650;
      w.terrain.depths.fill(20);
      w.logs = [];
      Object.assign(w.boat, {
        x: 250,
        y: 250,
        heading: 0.55,
        vx: 0,
        vy: 0,
        throttle: 0,
        turn: 0,
        rudder: 0,
      });
      Object.assign(w.diver, { state: 'surface', x: 246, y: 250 });
      const a = urchinDebug.spawnTraffic('dfo', { start: { x: 380, y: 250 } });
      return a?.id;
    });
    assert(actorId);
    await page.waitForFunction(() => urchinDebug.ui.screen === 'patrol');
    await page.locator('.patrol-portrait svg').waitFor();
    await page.screenshot({ path: 'test-results/september15-dfo-radio.png' });
    await choose('Keep clear');
    await page.waitForTimeout(1200);
    await page.locator('#patrolBearing').click();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'patrol');
    await action('back');
    assert(
      await page.evaluate(() => {
        const w = urchinDebug.world,
          a = w.traffic.actors.find((a) => a.kind === 'dfo');
        return Math.hypot(a.x - w.boat.x, a.y - w.boat.y) >= 99;
      }),
    );
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.diver.state = 'ready';
      w.terrain.depths.fill(0.1);
    });
    await page.waitForFunction(() => urchinDebug.ui.screen === 'patrol');
    await choose('Divers up, come over');
    await page.locator('#dfoTransition').waitFor({ state: 'visible', timeout: 12000 });
    await page.screenshot({ path: 'test-results/september15-dfo-transition.png' });
    await page.waitForFunction(() => urchinDebug.world.day.inspection.status === 'boarding', {
      timeout: 6000,
    });
    await page.screenshot({ path: 'test-results/september15-dfo-alongside.png' });
    assert(
      await page.evaluate(() => {
        const w = urchinDebug.world,
          a = w.traffic.actors.find((a) => a.kind === 'dfo');
        return Math.abs(a.heading - w.boat.heading) < 0.02;
      }),
    );
    await page.waitForFunction(() => urchinDebug.world.day.inspection.status === 'cleared', {
      timeout: 15000,
    });
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.day.phase = 'planning';
      w.career.cash = 1e6;
      w.career.xp = 12000;
      urchinDebug.ui.open('boatshop');
    });
    await choose('Channel Master ·');
    await choose('Buy ');
    await page.evaluate(() => urchinDebug.ui.open('outfit'));
    await choose('Bow thruster');
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.terrain.depths.fill(20);
      w.day.phase = 'working';
      w.day.inspection = null;
      w.traffic.actors = [];
      Object.assign(w.boat, {
        x: 250,
        y: 250,
        heading: 0,
        vx: 0,
        vy: 0,
        turn: 0,
        throttle: 0,
        rudder: 0,
      });
      urchinDebug.ui.open(null);
    });
    await page.waitForFunction(() => !urchinDebug.input.suppressed);
    await page.evaluate(() => (feedbackPad.axes[3] = 1));
    await page.waitForFunction(() => urchinDebug.world.boat.heading > 0.4);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.thruster), 0);
    await page.evaluate(() => (feedbackPad.axes[3] = 0));
    await page.waitForFunction(() => urchinDebug.world.boat.pivot === 0);
    await page.evaluate(() => (feedbackPad.axes[0] = -1));
    await page.waitForFunction(() => urchinDebug.world.boat.thruster < -0.5);
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.pivot), 0);
    await page.evaluate(() => (feedbackPad.axes[0] = 0));
    await page.screenshot({ path: 'test-results/september15-jet-controls.png' });
    assert.deepEqual(errors, []);
    console.log(
      'PASS: September 15 controller harbour, all three scroll panes, departure remedy, DFO portrait/invitation/100 m hold/shallow docking transition and inspection.',
    );
  } catch (error) {
    await page.screenshot({ path: 'test-results/september15-browser-failure.png' });
    throw error;
  } finally {
    await page.close();
  }
}
