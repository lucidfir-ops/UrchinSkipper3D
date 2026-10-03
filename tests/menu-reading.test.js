import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decorateMenuReading,
  captureMenuReadingFocus,
  restoreMenuReadingFocus,
  captureMenuScroll,
  restoreMenuScroll,
} from '../src/menu-shell.js';

function fixture() {
  const elements = new Map(),
    document = { activeElement: null },
    panel = {
      dataset: { screen: 'conditions' },
      ownerDocument: document,
      contains: (element) => [...elements.values()].includes(element),
      querySelector: (selector) => elements.get(selector),
      querySelectorAll: () => [...elements.values()].filter((pane) => pane.dataset.menuReading),
    };
  const pane = (selector, overflowY = 'auto') => {
    const element = {
      dataset: {},
      style: { overflowY },
      attributes: {},
      scrollTop: 0,
      scrollLeft: 0,
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      removeAttribute(name) {
        delete this.attributes[name];
        if (name === 'tabindex') this.tabIndex = -1;
      },
      focus(options) {
        this.focusOptions = options;
        document.activeElement = this;
      },
    };
    elements.set(selector, element);
    return element;
  };
  return { panel, pane, document };
}

test('reading regions follow responsive scroll ownership and do not focus clipped wrappers', () => {
  const previousStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (element) => element.style;
  try {
    const { panel, pane, document } = fixture(),
      wrapper = pane('.career-detail', 'hidden'),
      forecast = pane('.expedition-copy'),
      ordersHelp = pane('.orders-help'),
      ordersLayout = pane('.orders-layout', 'visible');
    decorateMenuReading(panel);
    assert.equal(forecast.attributes['aria-label'], 'Forecast details');
    assert.equal(forecast.attributes.role, 'region');
    assert.equal(forecast.tabIndex, 0, 'reading is reachable even when all text currently fits');
    assert(!wrapper.dataset.menuReading);
    assert.equal(ordersHelp.dataset.menuReading, 'orders');
    assert(!ordersLayout.dataset.menuReading);
    ordersLayout.style.overflowY = 'auto';
    decorateMenuReading(panel);
    assert(!ordersLayout.dataset.menuReading, 'an inner Orders reader wins over its wrapper');

    ordersHelp.focus();
    const focus = captureMenuReadingFocus(panel);
    ordersHelp.style.overflowY = 'visible';
    ordersLayout.style.overflowY = 'auto';
    decorateMenuReading(panel);
    restoreMenuReadingFocus(panel, focus);
    assert(!ordersHelp.dataset.menuReading);
    assert.equal(ordersHelp.tabIndex, -1);
    assert.equal(ordersLayout.dataset.menuReading, 'orders');
    assert.equal(document.activeElement, ordersLayout, 'resize keeps focus on the actual reader');

    decorateMenuReading(panel, false);
    assert.equal(panel.querySelectorAll().length, 0, 'capture/naming retains physical keys');
  } finally {
    globalThis.getComputedStyle = previousStyle;
  }
});

test('replacing a reading pane restores focus without rewinding text or stealing button focus', () => {
  const previousStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (element) => element.style;
  try {
    const { panel, pane, document } = fixture(),
      original = pane('.expedition-copy');
    decorateMenuReading(panel);
    original.scrollTop = 318;
    original.focus();
    const focus = captureMenuReadingFocus(panel),
      scroll = captureMenuScroll(panel),
      replacement = pane('.expedition-copy');
    decorateMenuReading(panel);
    restoreMenuScroll(panel, scroll);
    restoreMenuReadingFocus(panel, focus);
    assert.equal(document.activeElement, replacement);
    assert.equal(replacement.scrollTop, 318);
    assert.deepEqual(replacement.focusOptions, { preventScroll: true });

    const button = pane('button', 'visible');
    button.focus();
    assert.equal(captureMenuReadingFocus(panel), undefined);
    restoreMenuReadingFocus(panel, undefined);
    assert.equal(document.activeElement, button);
  } finally {
    globalThis.getComputedStyle = previousStyle;
  }
});

test('compact Orders and Skipper notes are included in menu scroll history', () => {
  const { panel, pane } = fixture(),
    orders = pane('.orders-layout'),
    notes = pane('.frank-lesson');
  orders.scrollTop = 220;
  notes.scrollTop = 154;
  const positions = captureMenuScroll(panel);
  orders.scrollTop = notes.scrollTop = 0;
  restoreMenuScroll(panel, positions);
  assert.equal(orders.scrollTop, 220);
  assert.equal(notes.scrollTop, 154);
});

test('narrow almanac keeps one reader for curves and chart and preserves its focus on resize', () => {
  const previousStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (element) => element.style;
  try {
    const { panel, pane, document } = fixture(),
      curves = pane('.almanac-curves'),
      layout = pane('.almanac-layout', 'hidden'),
      map = pane('.almanac-map');
    decorateMenuReading(panel);
    assert.equal(curves.dataset.menuReading, 'almanac-curves');
    assert.equal(map.dataset.menuReading, 'almanac-map');
    assert(!layout.dataset.menuReading);
    curves.focus();
    const focused = captureMenuReadingFocus(panel);
    curves.style.overflowY = map.style.overflowY = 'visible';
    layout.style.overflowY = 'auto';
    decorateMenuReading(panel);
    restoreMenuReadingFocus(panel, focused);
    assert.equal(document.activeElement, layout);
    assert.equal(layout.attributes['aria-label'], 'Tide, current and chart details');
    assert(!curves.dataset.menuReading && !map.dataset.menuReading);
    layout.scrollTop = 465;
    const scroll = captureMenuScroll(panel);
    layout.scrollTop = 0;
    restoreMenuScroll(panel, scroll);
    assert.equal(layout.scrollTop, 465);
  } finally {
    globalThis.getComputedStyle = previousStyle;
  }
});
