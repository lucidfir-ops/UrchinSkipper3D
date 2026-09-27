import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

export async function s22FeedbackChecks(browser) {
  const engine = browser.browserType().name();
  const context = await browser.newContext({
    viewport: { width: 780, height: 360 },
    hasTouch: true,
  });
  const page = await context.newPage(),
    errors = [],
    results = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(20000);
  mkdirSync('test-results', { recursive: true });
  const screen = (name) => page.waitForFunction((name) => urchinDebug.ui.screen === name, name);
  const tap = async (selector) => {
    await page.locator(selector).tap();
  };
  const shot = (name) => page.screenshot({ path: `test-results/s22-${engine}-${name}.png` });
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await tap('[data-touch-options]');
    await tap('[data-action="touchscreen"]');
    await tap('.screen-back');
    await tap('[data-ui-scale]');
    assert.match(await page.locator('[data-ui-scale]').textContent(), /110%/);
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ui);
    assert.match(await page.locator('[data-ui-scale]').textContent(), /110%/);
    await tap('#keyboardFallback');
    await screen('intro');
    assert.match(await page.locator('#playtest').textContent(), /investor/);
    assert.match(await page.locator('#playtest').textContent(), /\$20,000/);
    await shot('frank-briefing');
    await tap('#playtest [data-choice-index="0"]');
    await screen(null);
    await page.waitForFunction(() => urchinDebug.world.time > 0.1);
    assert.equal(await page.evaluate(() => urchinDebug.world.terrain.size), 240);
    await tap('[data-touch="fullAhead"]');
    await page.waitForFunction(() => urchinDebug.world.career.intro.step === 1);
    await tap('[data-touch="neutral"]');
    await shot('cove-landscape');
    await tap('[data-intro="chart"]');
    await screen('introchart');
    await shot('cove-chart');
    await page.evaluate(() => urchinDebug.ui.hooks.save());
    await page.reload();
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await tap('#keyboardFallback');
    await screen(null);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.intro.step), 1);
    await tap('[data-intro="skip"]');
    await screen('starter');
    const cash = await page.evaluate(() => urchinDebug.world.career.cash);
    await tap('[data-action="starter-basic"]');
    await tap('[data-action="buy-selected"]');
    await screen('purchase');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), cash);
    await tap('[data-action="cancel-purchase"]');
    await screen('starter');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), cash);
    await tap('[data-action="starter-basic"]');
    await tap('[data-action="buy-selected"]');
    await screen('purchase');
    await tap('[data-action="confirm-purchase"]');
    await screen('harbour');
    assert.equal(await page.evaluate(() => urchinDebug.world.career.day), 1);
    const menus = [
      'harbour',
      'chart',
      'departure',
      'almanac',
      'fleet',
      'boatshop',
      'outfit',
      'crew',
      'accounts',
      'conditions',
      'knowledge',
      'assists',
      'settings',
      'help',
      'bindings',
      'workshop',
      'pause',
    ];
    for (const viewport of [
      { width: 780, height: 360 },
      { width: 360, height: 780 },
    ]) {
      await page.setViewportSize(viewport);
      for (const scale of [80, 100, 150]) {
        await page.evaluate(async (scale) => {
          while (
            Number(document.querySelector('[data-ui-scale]').textContent.match(/(\d+)%/)[1]) !==
            scale
          )
            urchinDebug.ui.titleAction('scale');
        }, scale);
        for (const menu of menus) {
          await page.evaluate((menu) => {
            const ui = urchinDebug.ui;
            ui.chartGroundId = 'near';
            ui.open(menu);
          }, menu);
          await screen(menu);
          await page.waitForFunction(
            () => document.querySelector('#playtest').textContent.length > 20,
          );
          if (menu === 'bindings') {
            assert(
              await page.locator('.controller-diagrams').evaluate((el) => {
                el.scrollLeft = el.scrollWidth;
                return el.scrollWidth <= el.clientWidth + 1 || el.scrollLeft > 0;
              }),
              'Keyboard diagram can scroll sideways',
            );
          }
          const bounds = await page.locator('#playtest').evaluate((el) => {
            const r = el.getBoundingClientRect();
            el.scrollTop = el.scrollHeight;
            return {
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
              width: innerWidth,
              height: innerHeight,
              scroll: el.scrollTop,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
            };
          });
          assert(
            bounds.x >= -1 && bounds.right <= viewport.width + 1,
            `${menu} width ${scale}% ${JSON.stringify(bounds)}`,
          );
          assert(bounds.bottom <= viewport.height - 50, `${menu} raised navigation ${scale}%`);
          assert(
            bounds.scrollHeight <= bounds.clientHeight + 1 || bounds.scroll > 0,
            `${menu} scrolls`,
          );
          // Reach every menu action by bringing it into the scroll viewport.
          const buttons = page.locator('#playtest button:visible');
          for (let i = 0; i < (await buttons.count()); i++) {
            const button = buttons.nth(i);
            await button.scrollIntoViewIfNeeded();
            const visible = await button.evaluate((el) => {
              const r = el.getBoundingClientRect(),
                p = document.querySelector('#playtest').getBoundingClientRect();
              return (
                r.bottom > p.top &&
                r.top < p.bottom &&
                r.left >= p.left - 2 &&
                r.right <= p.right + 2
              );
            });
            assert(visible, `${menu} button ${i} reachable at ${scale}% ${viewport.width}`);
          }
          if (
            scale === 100 &&
            ['departure', 'almanac', 'fleet', 'harbour', 'bindings', 'crew'].includes(menu)
          ) {
            await page.locator('#playtest').evaluate((el) => {
              el.scrollTop = 0;
            });
            await shot(`${viewport.width}-${menu}`);
            if (['departure', 'almanac', 'fleet'].includes(menu)) {
              await page.locator('#playtest').evaluate((el) => {
                el.scrollTop = el.scrollHeight;
              });
              await shot(`${viewport.width}-${menu}-scrolled`);
            }
          }
          results.push({ menu, scale, ...viewport, ...bounds });
        }
      }
    }
    // Finger scrolling must work over content, including button rows.
    await page.evaluate(async () => {
      while (!document.querySelector('[data-ui-scale]').textContent.includes('100%'))
        urchinDebug.ui.titleAction('scale');
      urchinDebug.ui.open('crew');
    });
    await page.waitForFunction(() => document.querySelector('.crew-grid'));
    if (engine === 'chromium') {
      const cdp = await context.newCDPSession(page);
      await page.locator('#playtest').evaluate((el) => {
        el.scrollTop = 0;
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 170, y: 580 }],
      });
      for (let y = 560; y >= 250; y -= 30) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: 170, y }],
        });
        await page.waitForTimeout(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => document.querySelector('#playtest').scrollTop > 30);
    }
    await page.evaluate(() => urchinDebug.ui.open('accounts'));
    await screen('accounts');
    await page.evaluate(() => {
      urchinDebug.world.boat.fuel -= 20;
      urchinDebug.ui.signature = null;
    });
    const before = await page.evaluate(() => ({
      cash: urchinDebug.world.career.cash,
      fuel: urchinDebug.world.boat.fuel,
    }));
    await tap('[data-action="fuel"]');
    await screen('purchase');
    await tap('[data-action="cancel-purchase"]');
    await screen('accounts');
    assert.deepEqual(
      await page.evaluate(() => ({
        cash: urchinDebug.world.career.cash,
        fuel: urchinDebug.world.boat.fuel,
      })),
      before,
    );
    await tap('[data-action="fuel"]');
    await screen('purchase');
    await shot('purchase');
    await tap('[data-action="confirm-purchase"]');
    await screen('accounts');
    assert.equal(await page.evaluate(() => urchinDebug.world.boat.fuel), before.fuel + 20);
    assert.equal(await page.evaluate(() => urchinDebug.world.career.cash), before.cash - 43);
    assert.deepEqual(errors, []);
    writeFileSync(
      `test-results/s22-${engine}.json`,
      JSON.stringify({ engine, errors, results }, null, 2),
    );
    console.log(
      `S22 feedback ${engine}: ${results.length} menu/scale/orientation checks; intro/save/purchases passed`,
    );
  } catch (error) {
    await shot('failure');
    console.log(
      JSON.stringify(
        await page.evaluate(() => ({
          errors: [],
          screen: window.urchinDebug?.ui.screen,
          elements: [
            ...document.querySelectorAll(
              '#playtest, .intro-copy, .intro-choices, #playtest button',
            ),
          ].map((e) => ({
            tag: e.tagName,
            cls: e.className,
            text: e.textContent.slice(0, 60),
            rect: e.getBoundingClientRect().toJSON(),
            scroll: e.scrollTop,
            height: e.scrollHeight,
            overflow: getComputedStyle(e).overflow,
          })),
        })),
        null,
        2,
      ),
    );
    throw error;
  } finally {
    await context.close();
  }
}

export async function s22TitleChecks(browser) {
  const name = browser.browserType().name();
  const page = await browser.newPage({ viewport: { width: 360, height: 780 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/');
    await page.waitForFunction(() => window.urchinDebug?.ui);
    await page.locator('[data-touch-options]').tap();
    await page.locator('[data-action="touchscreen"]').tap();
    await page.locator('.screen-back').tap();
    for (const viewport of [
      { width: 360, height: 780 },
      { width: 780, height: 360 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      for (const scale of [80, 100, 150]) {
        await page.evaluate((scale) => {
          while (
            Number(document.querySelector('[data-ui-scale]').textContent.match(/(\d+)%/)[1]) !==
            scale
          )
            urchinDebug.ui.titleAction('scale');
        }, scale);
        const art = await page.locator('.title-art').boundingBox();
        const card = page.locator('#startup .title-copy');
        await card.evaluate((el) => {
          el.scrollTop = 0;
        });
        const overflow = await card.evaluate((el) => el.scrollHeight > el.clientHeight + 20);
        if (overflow) {
          const box = await card.boundingBox();
          if (name === 'chromium') {
            const cdp = await page.context().newCDPSession(page);
            const x = box.x + box.width / 2,
              y = box.y + box.height - 20;
            await cdp.send('Input.dispatchTouchEvent', {
              type: 'touchStart',
              touchPoints: [{ x, y }],
            });
            for (let i = 1; i <= 8; i++) {
              await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [{ x, y: y - ((box.height - 40) * i) / 8 }],
              });
              await page.waitForTimeout(25);
            }
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await cdp.detach();
          } else {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.wheel(0, 300);
          }
          await page.waitForFunction(
            () => document.querySelector('#startup .title-copy').scrollTop > 10,
          );
        }
        for (const b of await page.locator('.title-choices button').all()) {
          await b.scrollIntoViewIfNeeded();
          const r = await b.boundingBox();
          assert(
            r.x >= 0 &&
              r.x + r.width <= viewport.width + 1 &&
              r.y >= 0 &&
              r.y + r.height <= viewport.height,
            `Title button fits ${scale}% ${viewport.width}: ${JSON.stringify(r)}`,
          );
        }
        assert.equal(await page.locator('#startup').evaluate((el) => el.scrollTop), 0);
        assert.deepEqual(
          await page.locator('.title-art').boundingBox(),
          art,
          'title artwork never scrolls',
        );
        assert(
          art.x === 0 &&
            art.y === 0 &&
            art.width >= viewport.width &&
            art.height >= viewport.height,
        );
        await page.screenshot({
          path: `test-results/s22-${name}-title-${viewport.width}-${scale}.png`,
        });
      }
    }
    await page.locator('#keyboardFallback').tap();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
    await page.getByRole('button', { name: /Come aboard/ }).tap();
    await page.waitForFunction(() => urchinDebug.world.career.intro.status === 'active');
    // Re-enter the same step in a second new career: overlay callbacks must
    // follow the new world, while the first career remains archived.
    await page.evaluate(() => urchinDebug.ui.showTitle());
    await page.getByRole('button', { name: 'New Career', exact: true }).tap();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'intro');
    await page.getByRole('button', { name: /Come aboard/ }).tap();
    await page.waitForFunction(() => urchinDebug.world.career.intro.status === 'active');
    await page.setViewportSize({ width: 360, height: 780 });
    await page.locator('[data-intro="skip"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/s22-${name}-cove-portrait.png` });
    await page.locator('#touchMenu').tap();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'intropause');
    await page.getByRole('button', { name: 'Skip this lesson step' }).tap();
    await page.waitForFunction(() => urchinDebug.world.career.intro.step === 1);
    await page.locator('[data-intro="skip"]').tap();
    await page.waitForFunction(() => urchinDebug.ui.screen === 'starter');
    await page.evaluate(() => {
      while (!document.querySelector('[data-ui-scale]').textContent.includes('80%'))
        urchinDebug.ui.titleAction('scale');
      urchinDebug.ui.open('settings');
    });
    await page.locator('[data-action="ui-smaller"]').tap();
    assert.match(await page.locator('[data-ui-scale]').textContent(), /80%/);
    await page.evaluate(() => {
      while (!document.querySelector('[data-ui-scale]').textContent.includes('150%'))
        urchinDebug.ui.titleAction('scale');
      urchinDebug.ui.signature = null;
    });
    await page.locator('[data-action="ui-larger"]').tap();
    assert.match(await page.locator('[data-ui-scale]').textContent(), /150%/);
    await page.locator('[data-action="ui-reset"]').tap();
    await page.evaluate(() => urchinDebug.ui.open('starter'));
    assert.deepEqual(errors, []);
    console.log(`Title scale and portrait lesson ${name}: passed`);
  } finally {
    await page.close();
  }
}
