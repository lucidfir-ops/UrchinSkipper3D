import assert from 'node:assert/strict';
import { VESSEL_ART } from '../src/vessel-catalog.js';
import { feedbackVisualChecks } from './feedback-visual-checks.js';

export async function touchFeedbackChecks(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const choose = (name) => page.locator('#playtest button').filter({ hasText: name }).first().tap();
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await page.locator('[data-touch-options]').tap();
    await page.locator('[data-action="touchscreen"]').tap();
    await page.locator('.screen-back').tap();
    assert(await page.evaluate(() => urchinDebug.input.touchEnabled));
    await page.screenshot({ path: 'test-results/touch-title-portrait.png' });
    await page.locator('#keyboardFallback').tap();
    await choose('Choose Harbour Workhorse');
    await page.locator('.place-workshop').waitFor();
    assert.equal(await page.locator('.place-workshop svg').count(), 0);
    await page.screenshot({ path: 'test-results/touch-dock-arcade.png' });
    await page.locator('.place-workshop').tap();
    await page.locator('[data-action=sandbox]').tap();
    assert(await page.evaluate(() => urchinDebug.world.career.sandbox));
    await page.evaluate(() => {
      const ui = urchinDebug.ui,
        w = urchinDebug.world;
      w.career.cash = 1e6;
      w.career.xp = 12000;
      w.career.trafficSettings = { rate: 0 };
      ui.open('boatshop');
    });
    const cash = await page.evaluate(() => urchinDebug.world.career.cash);
    await page.locator('[data-action=buy-basic-sister]').tap();
    await page.waitForFunction(() =>
      document.querySelector('.career-detail')?.textContent.includes('Harbour Workhorse II'),
    );
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), cash);
    assert.match(await page.locator('.career-detail').innerText(), /Harbour Workhorse II/);
    await page.locator('[data-action=cancel-buy]').tap();
    await page.locator('[data-action=buy-basic]').tap();
    await page.locator('[data-action=cancel-buy]').tap();
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), cash);
    const positions = await page.locator('.boat-pairs [data-action^=buy-]').evaluateAll((buttons) =>
      buttons.slice(0, 12).map((b) => {
        const r = b.getBoundingClientRect();
        return { x: r.x, y: r.y };
      }),
    );
    for (let i = 0; i < positions.length; i += 2) {
      assert(Math.abs(positions[i].y - positions[i + 1].y) < 2);
      assert(positions[i + 1].x > positions[i].x);
    }
    await page.screenshot({ path: 'test-results/touch-boat-pairs.png' });
    await page.evaluate(() => urchinDebug.ui.open('harbour'));
    await choose('Sail');
    await choose('Sheltered Kelp');
    await page.locator('[data-action=sail]').waitFor();
    const order = await page
      .locator('.choices [data-action]')
      .evaluateAll((buttons) => buttons.map((b) => b.dataset.action));
    assert.deepEqual(order.slice(0, 2), ['sail', 'early']);
    await page.locator('[data-action=early]').tap();
    assert.equal(await page.evaluate(() => urchinDebug.world.day.minute), 300);
    await page.locator('[data-action=sail]').tap();
    await page.locator('#voyage').waitFor({ state: 'hidden' });
    await page.locator('#touchControls').waitFor();
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.day.minute = 480;
      w.career.testConditions = { ...w.career.testConditions, holdClock: true };
      w.terrain.depths.fill(12);
      w.environment = { seaLevel: 0, current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
      Object.assign(w.boat, { x: 250, y: 250, heading: 0, vx: 0, vy: 0, throttle: 0, rudder: 0 });
      w.logs = [];
      w.traffic.actors = [];
      delete w.day.inspection;
    });
    await page.locator('[data-touch=fullAhead]').tap();
    await page.waitForFunction(() => urchinDebug.world.boat.throttle === 1);
    await page.locator('[data-touch=neutral]').tap();
    await page.waitForFunction(() => urchinDebug.world.boat.throttle === 0);
    await page.evaluate(() => {
      const w = urchinDebug.world;
      w.boat.vx = w.boat.vy = 0;
    });
    await page.locator('[data-touch=recoverDiver]').tap();
    await page.waitForFunction(() => urchinDebug.world.diver.state !== 'ready');
    await page.locator('[data-touch=quickOrders]').tap();
    await page.locator('[data-order=quality-more]').tap();
    await page.locator('.compass svg').tap({ position: { x: 120, y: 80 } });
    await page.locator('[data-order=apply]').tap();
    assert(await page.evaluate(() => urchinDebug.world.diver.minQuality > 0));
    await page.locator('#touchMenu').tap();
    await page
      .locator('#playtest .choices button')
      .filter({ hasText: /^Resume$/ })
      .waitFor();
    const pause = await page.locator('#playtest .choices button').allTextContents();
    assert.equal(pause[0], 'Resume');
    assert.match(pause[1], /REVEAL EVERY URCHIN/);
    await choose('REVEAL EVERY URCHIN');
    await choose('Resume');
    assert(await page.evaluate(() => urchinDebug.ui.revealUrchins));
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/touch-sea-portrait.png' });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    const cards = await page.locator('#divers button').evaluateAll((buttons) =>
      buttons.map((b) => {
        const r = b.getBoundingClientRect();
        return { y: r.y, bottom: r.bottom };
      }),
    );
    assert(Math.abs(cards[0].y - cards[1].y) < 2, 'Both landscape diver cards share a visible row');
    assert(
      cards.every((r) => r.bottom < 250),
      'Both nitrogen meters clear the touch sticks',
    );
    await page.screenshot({ path: 'test-results/touch-sea-landscape.png' });
    // Two simultaneous real touch contacts, sent through Chromium's browser protocol.
    if (browser.browserType().name() === 'chromium') {
      const session = await page.context().newCDPSession(page);
      const left = await page.locator('[data-stick=helm]').boundingBox();
      const right = await page.locator('[data-stick=rudder]').boundingBox();
      const points = [
        { id: 1, x: left.x + left.width / 2, y: left.y + 8 },
        { id: 2, x: right.x + right.width - 8, y: right.y + right.height / 2 },
      ];
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
      await page.waitForFunction(
        () => urchinDebug.input.raw.throttleUp > 0 && urchinDebug.input.raw.right > 0,
      );
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(
        () => urchinDebug.input.raw.throttleUp === 0 && urchinDebug.input.raw.right === 0,
      );
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [points[0]],
      });
      await page.locator('#touchMenu').tap();
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await page.evaluate(() => urchinDebug.input.touchSources.size), 0);
      await choose('Resume');
    }
    await feedbackVisualChecks(page);
    await page.locator('#touchMenu').tap();
    await choose('Touchscreen Options');
    await choose('Touchscreen mode');
    await page.locator('.screen-back').click();
    assert.equal(await page.evaluate(() => urchinDebug.input.touchEnabled), false);
    await choose('Settings');
    await choose('Touchscreen Options');
    await choose('Touchscreen mode');
    await page.locator('.screen-back').click();
    assert(await page.evaluate(() => urchinDebug.input.touchEnabled));
    await page.evaluate(() => {
      urchinDebug.ui.notify('ADA · BAG RECOVERED — 300 lb');
      urchinDebug.ui.notify('DFO PATROL · Radio check');
      urchinDebug.ui.open('radio');
    });
    assert(!/BAG RECOVERED/.test(await page.locator('.radio-history').innerText()));
    assert.match(await page.locator('.radio-history').innerText(), /Radio check/);
    // Inspect every live sprite against a labelled contact sheet.
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.evaluate(async (ids) => {
      const sheet = document.createElement('div');
      sheet.id = 'art-review';
      sheet.style.cssText =
        'position:fixed;inset:0;z-index:1000;background:#173b49;display:grid;grid-template-columns:repeat(10,1fr);gap:8px;padding:10px;color:white;font:12px sans-serif';
      for (const id of ids) {
        const canvas = await urchinDebug.vesselCanvas(id),
          item = document.createElement('div'),
          preview = document.createElement('canvas');
        preview.width = canvas.width;
        preview.height = canvas.height;
        preview.getContext('2d').drawImage(canvas, 0, 0);
        preview.style.cssText = 'height:205px;width:100%;object-fit:contain';
        item.append(preview, document.createTextNode(id));
        sheet.append(item);
      }
      document.body.append(sheet);
    }, Object.keys(VESSEL_ART));
    await page.screenshot({ path: 'test-results/feedback-vessel-audit.png' });
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ui);
    assert(await page.evaluate(() => urchinDebug.input.touchEnabled));
    assert.deepEqual(errors, []);
    console.log(
      'PASS: touch title/settings/pause persistence, dock arcade isolation, paired boat comparison, early start, touch sailing/deployment/orders, reveal, radio separation, multi-touch and cancellation',
    );
  } catch (error) {
    await page.screenshot({ path: 'test-results/touch-feedback-failure.png' });
    throw error;
  } finally {
    await page.close();
  }
}
