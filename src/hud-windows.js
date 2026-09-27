import { toggleAssist } from './assists.js';
import { fitWindow } from './layout-geometry.js';
import { instrumentStyle, STANDALONE_INSTRUMENTS } from './instruments.js';
import { defaultHudRect } from './hud-defaults.js';
// Keep resize controls outside live telemetry markup: HUD refreshes must not
// replace a captured pointer or reset the window's scroll position and size.
export const WINDOWS = {
  ...Object.fromEntries(
    Object.entries(STANDALONE_INSTRUMENTS).map(([id, [, label]]) => [id, label]),
  ),
  helmPanel: 'Boat instruments card',
  speedPanel: 'Speed gauge',
  throttlePanel: 'Throttle and rudder gauge',
  fuelPanel: 'Fuel gauge',
  diverPanel: 'Diver cards',
  currentReadout: 'Live current',
  almanacPanel: 'Tide & current almanac button',
  frankAboard: 'Frank’s lesson',
  message: 'Pickup information',
  clock: 'Clock',
  electronics: 'Weather and instruments',
  minimapPanel: 'Chart minimap',
  sounderPanel: 'Depth sounder',
  navigation: 'Harbour navigation',
  help: 'Controls help',
  groundLegend: 'Ground information',
  testInfo: 'Test information',
  actionFeedback: 'Action feedback',
};

export const WINDOW_OPTIONS = {
  ...Object.fromEntries(Object.entries(STANDALONE_INSTRUMENTS).map(([id, [key]]) => [id, key])),
  helmPanel: 'helmOverlay',
  speedPanel: 'speedGauge',
  throttlePanel: 'throttleGauge',
  fuelPanel: 'fuelGauge',
  diverPanel: 'diverCards',
  currentReadout: 'currentOverlay',
  almanacPanel: 'almanacShortcut',
  frankAboard: 'frankOverlay',
  message: 'actionPrompts',
  clock: 'clockOverlay',
  electronics: 'weatherOverlay',
  minimapPanel: 'minimap',
  sounderPanel: 'sounder',
  navigation: 'departureGuidance',
  help: 'controlsHelp',
  groundLegend: 'pickingLegend',
  actionFeedback: 'feedbackOverlay',
};
export class HudWindows {
  constructor(ui) {
    this.ui = ui;
    ui.hudWindows = this;
    this.windows = new Map();
    this.layout = '';
    try {
      this.saved = JSON.parse(localStorage.getItem('urchin-hud-layout-v1')) || {};
    } catch {
      this.saved = {};
    }
    window.addEventListener('resize', () => this.cancel());
    window.addEventListener('blur', () => this.cancel());
  }
  cancel() {
    for (const entry of this.windows.values()) {
      if (entry.moving && entry.mover.hasPointerCapture(entry.moving.id))
        entry.mover.releasePointerCapture(entry.moving.id);
      entry.moving = null;
      const id = entry.drag?.id;
      entry.drag = null;
      if (id !== undefined && entry.grip.hasPointerCapture(id))
        entry.grip.releasePointerCapture(id);
    }
  }
  add(panel, label) {
    panel.dataset.hudWindow = '';
    panel.addEventListener('click', (e) => {
      if (e.target.closest('button, input, a') && !e.target.closest('.minimap-chart')) return;
      if (this.ui.screen) return;
      panel.dataset.seeThrough = panel.dataset.seeThrough === 'on' ? 'off' : 'on';
    });
    panel.setAttribute('aria-label', label);
    if (!panel.hasAttribute('tabindex')) panel.tabIndex = 0;
    const grip = document.createElement('button');
    grip.type = 'button';
    grip.className = 'hud-resize';
    grip.dataset.resizeWindow = panel.id;
    grip.setAttribute('aria-label', `Resize ${label}`);
    grip.setAttribute('aria-controls', panel.id);
    grip.title = 'Drag to resize · double-tap to reset · arrow keys resize · Home resets';
    grip.textContent = '◢';
    grip.hidden = true;
    document.body.append(grip);
    const mover = document.createElement('button'),
      close = document.createElement('button');
    mover.className = 'hud-move';
    close.className = 'hud-close';
    mover.dataset.moveWindow = panel.id;
    close.dataset.closeWindow = panel.id;
    mover.textContent = '↔';
    close.textContent = '×';
    mover.setAttribute('aria-label', `Move ${label}`);
    close.setAttribute('aria-label', `Hide ${label}`);
    mover.title = 'Drag to move · arrow keys move · Home resets';
    close.title = 'Restore in Menu → UI / difficulty options';
    mover.hidden = close.hidden = true;
    document.body.append(mover, close);
    const entry = {
      panel,
      grip,
      mover,
      close,
      sizes: new Map(
        Object.entries(this.saved[panel.id] || {}).filter(([, r]) => r.width && r.height),
      ),
      positions: new Map(Object.entries(this.saved[panel.id] || {})),
    };
    close.onclick = () => {
      const w = this.ui.hooks.world(),
        key = WINDOW_OPTIONS[panel.id];
      if (key && w.career?.assists[key]) {
        toggleAssist(w, key);
        this.ui.hooks.save?.();
      }
    };
    mover.onpointerdown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const r = panel.getBoundingClientRect();
      entry.moving = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      mover.setPointerCapture(e.pointerId);
    };
    mover.onpointermove = (e) => {
      const m = entry.moving;
      if (m?.id === e.pointerId)
        this.move(entry, m.left + e.clientX - m.x, m.top + e.clientY - m.y);
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      mover.addEventListener(name, () => {
        entry.moving = null;
        this.save();
      });
    mover.onkeydown = (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const r = panel.getBoundingClientRect();
      if (e.key === 'Home') this.reset(entry);
      else
        this.move(
          entry,
          r.left + (e.key === 'ArrowLeft' ? -12 : e.key === 'ArrowRight' ? 12 : 0),
          r.top + (e.key === 'ArrowUp' ? -12 : e.key === 'ArrowDown' ? 12 : 0),
        );
      this.save();
    };
    this.windows.set(panel.id, entry);
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || entry.drag) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      entry.drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        height: rect.height,
      };
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener('pointermove', (e) => {
      const drag = entry.drag;
      if (drag?.id !== e.pointerId) return;
      this.size(
        entry,
        drag.width + (e.clientX - drag.x) * entry.dx,
        drag.height + (e.clientY - drag.y) * entry.dy,
      );
      this.place(entry);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      grip.addEventListener(type, (e) => {
        if (entry.drag?.id !== e.pointerId) return;
        const moved = Math.hypot(e.clientX - entry.drag.x, e.clientY - entry.drag.y) > 6;
        entry.drag = null;
        if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
        if (type === 'pointerup' && !moved) {
          if (performance.now() - (entry.lastTap ?? -1000) < 400) this.reset(entry);
          entry.lastTap = performance.now();
        }
        this.save();
      });
    grip.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Home') this.reset(entry);
      else {
        const rect = panel.getBoundingClientRect();
        this.size(
          entry,
          rect.width + (e.key === 'ArrowRight' ? 20 : e.key === 'ArrowLeft' ? -20 : 0),
          rect.height + (e.key === 'ArrowDown' ? 20 : e.key === 'ArrowUp' ? -20 : 0),
        );
        this.place(entry);
      }
      this.save();
    });
    return entry;
  }
  save() {
    this.saved = {
      ...this.saved,
      ...Object.fromEntries(
        [...this.windows].map(([id, e]) => [
          id,
          Object.fromEntries(
            [...new Set([...e.positions.keys(), ...e.sizes.keys()])].map((key) => [
              key,
              { ...e.positions.get(key), ...e.sizes.get(key) },
            ]),
          ),
        ]),
      ),
    };
    try {
      localStorage.setItem('urchin-hud-layout-v1', JSON.stringify(this.saved));
    } catch {
      /* Session layout still works. */
    }
  }
  move(entry, left, top) {
    const p = entry.panel,
      r = p.getBoundingClientRect();
    ({ left, top } = fitWindow(
      { left, top, width: r.width, height: r.height },
      innerWidth,
      innerHeight,
      this.ui.input.touchEnabled,
    ));
    p.dataset.windowMoved = '';
    p.style.setProperty('--window-left', `${left}px`);
    p.style.setProperty('--window-top', `${top}px`);
    entry.positions.set(this.layout, { left, top });
    this.place(entry);
  }
  resetAll() {
    for (const e of this.windows.values()) this.reset(e);
  }
  reset(entry) {
    entry.positions.delete(this.layout);
    delete entry.panel.dataset.windowMoved;
    entry.sizes.delete(this.layout);
    this.save();
    delete entry.panel.dataset.windowSized;
    entry.panel.style.removeProperty('--window-width');
    entry.panel.style.removeProperty('--window-height');
    this.place(entry);
  }
  size(entry, width, height) {
    const { panel } = entry;
    width = Math.max(Math.min(64, entry.maxWidth), Math.min(entry.maxWidth, width));
    height = Math.max(Math.min(36, entry.maxHeight), Math.min(entry.maxHeight, height));
    panel.dataset.windowSized = '';
    panel.style.setProperty('--window-width', `${width}px`);
    panel.style.setProperty('--window-height', `${height}px`);
    entry.sizes.set(this.layout, { width, height });
  }
  place(entry) {
    const { panel, grip } = entry,
      r = panel.getBoundingClientRect(),
      style = getComputedStyle(panel),
      right =
        !panel.hasAttribute('data-window-moved') &&
        style.getPropertyValue('--window-anchor-x').trim() === 'right',
      bottom =
        !panel.hasAttribute('data-window-moved') &&
        style.getPropertyValue('--window-anchor-y').trim() === 'bottom',
      centered =
        !panel.hasAttribute('data-window-moved') &&
        style.getPropertyValue('--window-anchor-x').trim() === 'center';
    entry.dx = right ? -1 : centered ? 2 : 1;
    entry.dy = bottom ? -1 : 1;
    entry.maxWidth = Math.max(
      64,
      centered
        ? 2 * Math.min((r.left + r.right) / 2 - 8, innerWidth - (r.left + r.right) / 2 - 8)
        : right
          ? r.right - 8
          : innerWidth - r.left - 8,
    );
    const floor = innerHeight - 4;
    entry.maxHeight = Math.max(64, bottom ? r.bottom - 8 : floor - r.top);
    panel.style.setProperty('--window-max-width', `${entry.maxWidth}px`);
    panel.style.setProperty('--window-max-height', `${entry.maxHeight}px`);
    const compact = this.ui.input.touchEnabled && ['helmPanel', 'diverPanel'].includes(panel.id);
    const handle = compact ? 16 : 28;
    for (const control of [grip, entry.mover, entry.close])
      control.classList.toggle('compact-window-control', compact);
    entry.mover.style.left = `${Math.max(0, r.left)}px`;
    entry.mover.style.top = `${Math.max(0, compact ? r.top : r.top - 24)}px`;
    entry.close.style.left = `${Math.min(innerWidth - 24, r.right - (compact ? 16 : 24))}px`;
    entry.close.style.top = `${Math.max(0, compact ? r.top : r.top - 24)}px`;
    grip.style.left = `${right ? r.left : r.right - handle}px`;
    grip.style.top = `${bottom ? r.top + handle : r.bottom - handle}px`;
    grip.style.transform = `scale(${right ? -1 : 1}, ${bottom ? -1 : 1})`;
  }
  update() {
    const ui = this.ui,
      playing = ui.started && !ui.screen && !ui.ended && !document.hidden,
      layout = `${ui.input.touchEnabled ? 'touch' : 'desktop'}:${innerWidth > innerHeight ? 'landscape' : 'portrait'}`;
    if (!playing || this.layout !== layout) this.cancel();
    this.layout = layout;
    for (const [id, label] of Object.entries(WINDOWS)) {
      const panel = document.getElementById(id);
      if (!panel) continue;
      const presentation = instrumentStyle(id);
      if (panel.dataset.presentation !== presentation) panel.dataset.presentation = presentation;
      const entry = this.windows.get(id) || this.add(panel, label),
        defaults = defaultHudRect(
          id,
          innerWidth,
          innerHeight,
          ui.input.touchEnabled,
          ui.hooks.world().career?.intro?.status === 'active',
          ui.touch?.controlsKey === `${innerWidth}/${innerHeight}/${touchScale()}`
            ? ui.touch.controlsTop
            : undefined,
        ),
        position = entry.positions.get(layout),
        size = entry.sizes.get(layout),
        geometryKey = JSON.stringify([layout, innerWidth, innerHeight, defaults, position, size]);
      const changed = entry.geometryKey !== geometryKey || entry.layout !== layout;
      // Give size-contained instruments a real rectangle before measuring them.
      // A rotation must never measure an unsized clock and save its zero height.
      if (changed && (defaults || position || size)) {
        const rect = fitWindow(
          {
            ...(defaults || entry.defaultRect || { left: 8, top: 8, width: 180, height: 100 }),
            ...position,
            ...size,
          },
          innerWidth,
          innerHeight,
        );
        const custom = !!(position || size);
        panel.toggleAttribute('data-default-position', !custom);
        panel.toggleAttribute('data-window-moved', custom);
        panel.toggleAttribute('data-window-sized', custom);
        for (const property of ['left', 'top', 'width', 'height'])
          panel.style.setProperty(
            `--${custom ? 'window' : 'default'}-${property}`,
            `${rect[property]}px`,
          );
        entry.maxWidth = innerWidth - 8;
        entry.maxHeight = innerHeight - 8;
        if (custom) {
          panel.style.setProperty('--window-max-width', `${entry.maxWidth}px`);
          panel.style.setProperty('--window-max-height', `${entry.maxHeight}px`);
        }
        entry.rect = rect;
        if (!custom) {
          entry.defaultRect = { ...rect };
          entry.defaultLayout = layout;
        }
        entry.geometryKey = geometryKey;
        entry.layout = layout;
      }
      const handles =
        playing &&
        ui.input.touchEnabled &&
        !ui.touch?.screenLocked &&
        !panel.hidden &&
        !ui.touch?.hudHidden &&
        panel.getClientRects().length > 0 &&
        getComputedStyle(panel).visibility !== 'hidden';
      if (handles && (changed || entry.grip.hidden)) this.place(entry);
      entry.grip.hidden = entry.mover.hidden = entry.close.hidden = !handles;
      if (!handles && (entry.drag || entry.moving)) this.cancel();
    }
  }
}
import { touchScale } from './touch-scale.js';
