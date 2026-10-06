// October 5: crawl every reachable menu screen in each menu theme, save a
// screenshot, and flag (a) text whose contrast against its effective background
// is below 3:1, (b) remnant green/teal panels from the pre-October 4 look and
// (c, October 5 feedback/10-5) text spilling out of its own box or its card.
// Usage: URCHIN_TEST_URL=… PLAYWRIGHT_BROWSERS_PATH=.browser-cache \
//   node scripts/menu-theme-audit.js [night,day] [phone,tablet]
import { chromium, firefox } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chooseStarter } from './career-start.js';
import { DEVICES } from './ui-gallery-devices.js';

const base = process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5184/',
  output = process.env.MENU_AUDIT_OUT || 'test-results/menu-theme-2026-10-05',
  themes = (process.argv[2] || 'night,day').split(','),
  devices = (process.argv[3] || 'phone,tablet').split(',');
mkdirSync(output, { recursive: true });

const PLANNING = [
  'harbour',
  'crew',
  'fleet',
  'yourboat',
  'outfit',
  'accounts',
  'logbook',
  'conditions',
  'knowledge',
  'radio',
  'fleetboard',
  'market',
  'almanac',
  'departure',
  'chart',
  'settings',
  'ui-scale',
  'gameplay-speed',
  'assists',
  'touch-options',
  'bindings',
  'controller',
  'help',
  'archives',
  'pause',
  'skipper-stuff',
];
const AT_SEA = ['pause', 'deck-catch', 'equipment-controls', 'instructions'];

// Runs in the page: returns findings for the visible menu panel.
function audit() {
  const parse = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const hsl = ({ r, g, b }) => {
    ((r /= 255), (g /= 255), (b /= 255));
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      l = (max + min) / 2,
      d = max - min;
    if (!d) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s, l };
  };
  // Composite the background stack until opaque; gradients use their first colour.
  const backgroundOf = (el) => {
    const layers = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      let colour = parse(style.backgroundColor);
      if ((!colour || colour.a === 0) && style.backgroundImage.includes('gradient')) {
        const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)]
          .map((m) => parse(m[0]))
          .filter((c) => c && c.a > 0.5);
        colour = stops.at(-1) || null;
      }
      if (colour && colour.a > 0) layers.push(colour);
      if (colour && colour.a >= 0.98) break;
    }
    let out = { r: 255, g: 255, b: 255 };
    for (const c of layers.reverse())
      out = {
        r: c.r * c.a + out.r * (1 - c.a),
        g: c.g * c.a + out.g * (1 - c.a),
        b: c.b * c.a + out.b * (1 - c.a),
      };
    return out;
  };
  const name = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? '#' + el.id : '') +
    [...el.classList]
      .slice(0, 3)
      .map((c) => '.' + c)
      .join('');
  const root = document.querySelector('#playtest');
  const findings = { contrast: [], teal: [], overflow: [] };
  if (!root || root.hidden) return findings;
  for (const el of root.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || el.closest('svg,canvas,[aria-hidden="true"]')) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || Number(style.opacity) < 0.2) continue;
    const own = parse(style.backgroundColor);
    if (own && own.a > 0.6 && rect.width * rect.height > 6000) {
      const { h, s, l } = hsl(own);
      if (h >= 150 && h <= 205 && s > 0.15 && l < 0.5)
        findings.teal.push({ el: name(el), colour: style.backgroundColor, w: rect.width | 0 });
    }
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!text) continue;
    // Spill: a word wider than its own box, or text past its card's edge.
    // Scrolling panes and deliberate ellipses are not spills.
    const card = el.parentElement?.closest(
      'button, .shop-card, .crew-card, .career-detail, .equipment-detail, article, li',
    );
    const cardRect = card?.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const textRect = range.getBoundingClientRect();
    const clipped =
      style.textOverflow !== 'ellipsis' &&
      !['auto', 'scroll'].includes(style.overflowX) &&
      el.scrollWidth > el.clientWidth + 2 &&
      el.clientWidth > 0;
    const spill =
      cardRect &&
      (textRect.right > cardRect.right + 1 || textRect.left < cardRect.left - 1) &&
      !['auto', 'scroll'].includes(getComputedStyle(card).overflowX);
    if (clipped || spill)
      findings.overflow.push({
        el: name(el),
        text: el.textContent.trim().slice(0, 40),
        by: Math.round(
          Math.max(el.scrollWidth - el.clientWidth, cardRect ? textRect.right - cardRect.right : 0),
        ),
      });
    const fg = parse(style.color);
    if (!fg) continue;
    const ratio = contrast(fg, backgroundOf(el));
    if (ratio < 3)
      findings.contrast.push({
        el: name(el),
        text: el.textContent.trim().slice(0, 40),
        ratio: +ratio.toFixed(2),
      });
  }
  return findings;
}

// --firefox (or URCHIN_BROWSER=firefox) approximates the designer's Firefox for Android.
const browser =
  process.env.URCHIN_BROWSER === 'firefox' || process.argv.includes('--firefox')
    ? await firefox.launch({ headless: true })
    : await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--enable-gpu', '--use-angle=vulkan'],
      });
const report = [];
try {
  for (const theme of themes)
    for (const device of DEVICES.filter((d) => devices.includes(d.id))) {
      const context = await browser.newContext({
          viewport: device.viewport,
          deviceScaleFactor: 1,
          hasTouch: device.touch,
        }),
        page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(
        ({ theme, touch }) => {
          localStorage.setItem('urchin3d-menu-theme-v1', theme);
          if (touch) localStorage.setItem('urchin-touchscreen-v1', 'on');
        },
        { theme, touch: device.touch },
      );
      await page.goto(base);
      await page.waitForFunction(() => window.urchinDebug?.ready, null, { timeout: 120000 });
      const capture = async (label) => {
        await page.waitForTimeout(400);
        const findings = await page.evaluate(audit);
        const path = `${output}/${theme}-${device.id}-${label}.png`;
        await page.screenshot({ path });
        report.push({ theme, device: device.id, screen: label, path, ...findings });
      };
      await capture('title');
      await page.locator('[data-title-action="new"]').click();
      await page.waitForFunction(() => ['intro', 'starter'].includes(urchinDebug.ui.screen));
      if (await page.evaluate(() => urchinDebug.ui.screen === 'intro'))
        await page.getByRole('button', { name: 'Skip day 0' }).first().click();
      await page.waitForFunction(() => urchinDebug.ui.screen === 'starter');
      await capture('starter');
      // October 5: the boat-selection preview turns with a drag.
      await page.locator('#playtest .shop-inspect').nth(1).click();
      await page.waitForTimeout(300);
      const boat = page.locator('#playtest canvas[data-rotatable] >> visible=true').first();
      await boat.scrollIntoViewIfNeeded();
      const before = await boat.evaluate((c) => c.toDataURL());
      const box = await boat.boundingBox();
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
      const turned = await boat.evaluate((c) => ({
        rotation: Number(c.dataset.rotation),
        image: c.toDataURL(),
      }));
      assert(turned.rotation > 0.5, `boat preview turned ${turned.rotation}`);
      assert.notEqual(turned.image, before, 'turned boat redraws');
      await capture('starter-turned');
      await chooseStarter(page, async (label) => {
        await page.getByRole('button', { name: label }).first().click();
      });
      for (const screen of PLANNING) {
        await page.evaluate((s) => {
          urchinDebug.ui.history = [];
          urchinDebug.ui.open(s);
        }, screen);
        await capture(screen);
        if (screen === 'settings') {
          // October 5 v2: a switch that is ON but not selected lost its text at
          // night. Turn each on, move the selection away, and audit it.
          const row = (id) => page.locator(`#playtest [data-action="${id}"]`);
          await row('logging').click();
          await row('auto-fullscreen').click();
          await capture('settings-logging-on');
          await row('logging').click();
          await capture('settings-auto-fullscreen-on');
          await row('auto-fullscreen').click();
        }
        if (['outfit', 'fleet', 'yourboat'].includes(screen)) {
          // Focus a later row so its detail panel (and 3D preview) opens.
          const row = page.locator('#playtest .career-choices button').nth(2);
          if (await row.count()) await row.click();
          await page.waitForTimeout(300);
          await page.evaluate(() =>
            document
              .querySelector('#playtest :is(.equipment-detail, .career-detail)')
              ?.scrollIntoView({ block: 'start' }),
          );
          await capture(screen + '-detail');
        }
      }
      // Depart through the ordinary harbour → chart → departure choices.
      for (const screen of ['harbour', 'chart', 'departure']) {
        await page.evaluate(() => {
          const ui = urchinDebug.ui;
          ui.history = [];
          ui.index = 0;
          ui.activate(urchinDebug.world);
        });
        await page.waitForTimeout(300);
        if (screen === 'harbour' && (await page.evaluate(() => urchinDebug.ui.screen !== 'chart')))
          await page.evaluate(() => urchinDebug.ui.open('chart'));
      }
      await page.waitForFunction(() => urchinDebug.world.day.phase === 'working', null, {
        timeout: 20000,
      });
      await page.waitForFunction(() => !urchinDebug.ui.blocked && !urchinDebug.ui.screen);
      for (const screen of AT_SEA) {
        await page.evaluate((s) => {
          urchinDebug.ui.history = [];
          urchinDebug.ui.open(s);
        }, screen);
        await capture('sea-' + screen);
      }
      // Land a catch through the explicit Return to harbour action.
      await page.evaluate(() => {
        const w = urchinDebug.world,
          ui = urchinDebug.ui;
        ui.open(null);
        w.catch = 600;
        w.bags = [
          { weight: 300, quality: 0.86, harvestMinute: w.day.minute - 60 },
          { weight: 300, quality: 0.78, harvestMinute: w.day.minute - 30 },
        ];
        const size = w.terrain.size,
          edge = w.day.returnExit.edge;
        Object.assign(w.boat, {
          x: edge === 'west' ? 0 : edge === 'east' ? size : w.boat.x,
          y: edge === 'north' ? 0 : edge === 'south' ? size : w.boat.y,
          vx: 0,
          vy: 0,
          throttle: 0,
        });
        urchinDebug.step(1 / 60, { returnHarbour: true });
      });
      await page.waitForFunction(() => urchinDebug.ui.screen === 'summary', null, {
        timeout: 20000,
      });
      await capture('summary');
      // The offload scene follows the arrival hour.
      for (const [label, arrival] of [
        ['dusk', 19 * 60 + 40],
        ['night', 22 * 60 + 15],
      ]) {
        const light = await page.evaluate((arrival) => {
          // Present a late arrival consistently: missed 19:00, ships at 06:00.
          Object.assign(urchinDebug.world.day.result, {
            arrival,
            onTime: false,
            offloadMinute: 1440 + 360,
            delayHours: (1440 + 360 - arrival) / 60,
          });
          urchinDebug.ui.signature = null;
          urchinDebug.ui.open('summary', { replace: true });
          return new Promise((done) =>
            setTimeout(() => done(document.querySelector('.offload-art')?.dataset.light), 300),
          );
        }, arrival);
        assert.equal(light, label);
        await capture('summary-' + label);
      }
      await page.evaluate(() => (document.querySelector('#playtest').scrollTop = 1e6));
      await capture('summary-return');
      report.push({ theme, device: device.id, errors });
      await context.close();
    }
} finally {
  await browser.close();
  writeFileSync(`${output}/audit.json`, JSON.stringify(report, null, 2));
}
const problems = report.filter(
  (r) => r.contrast?.length || r.teal?.length || r.overflow?.length || r.errors?.length,
);
for (const p of problems)
  console.log(
    `${p.theme}/${p.device}/${p.screen || 'errors'}: ` +
      [
        ...(p.teal || []).map((t) => `TEAL ${t.el} ${t.colour}`),
        ...(p.contrast || []).slice(0, 6).map((c) => `LOW ${c.ratio} ${c.el} “${c.text}”`),
        ...(p.overflow || []).slice(0, 6).map((o) => `SPILL ${o.by}px ${o.el} “${o.text}”`),
        ...(p.errors || []),
      ].join(' | '),
  );
if (process.argv.includes('--strict')) assert.equal(problems.length, 0, 'menu theme findings');
