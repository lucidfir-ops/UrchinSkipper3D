import { WINDOWS, WINDOW_OPTIONS } from './hud-windows.js';
import { fitWindow } from './layout-geometry.js';
import { assist, REALISTIC_ASSISTS, toggleAssist } from './assists.js';
import { UI_OPTIONS } from './assist-options.js';
import { choiceButton } from './menu-buttons.js';
import { instrumentStyle, setInstrumentStyle, ownedTimepieces } from './instruments.js';
import { defaultHudRect } from './hud-defaults.js';
import { touchScale } from './touch-scale.js';

const SAMPLES = {
  helmPanel: 'Heading · speed · fuel · hull',
  timepiecePanel: '09:00 · ship’s clock',
  depthInstrumentPanel: 'Depth · keel clearance',
  compassPanel: 'N ↑ · heading',
  hullPanel: 'Hull condition',
  loadPanel: 'Deck weight / capacity',
  speedPanel: 'Speed through water · over ground',
  throttlePanel: 'Throttle · rudder commands',
  fuelPanel: 'Fuel level · reserve warning',
  diverPanel: 'Diver 1 · Diver 2 · air · nitrogen',
  minimapPanel: 'N ↑ · Charted rocks × · boat △',
  sounderPanel: 'Depth · clearance below keel',
  frankAboard: 'Frank’s tutorial guidance',
  clock: 'Time · offload deadline',
  electronics: 'Wind · sea · fitted equipment',
  currentReadout: '↑ Current speed and bearing',
  almanacPanel: 'Tide & current almanac',
  navigation: '↑ Harbour exit · distance',
  message: 'Recovery actions and pickup progress',
  help: 'Keyboard / controller commands',
  groundLegend: 'Known ground colour key',
  actionFeedback: 'Recent action and radio messages',
  testInfo: 'Practice information',
};

function defaultRect(manager, id, n) {
  const defined = defaultHudRect(
    id,
    innerWidth,
    innerHeight,
    manager.ui.input.touchEnabled,
    manager.ui.hooks.world().career?.intro?.status === 'active',
    manager.ui.touch?.controlsKey === `${innerWidth}/${innerHeight}/${touchScale()}`
      ? manager.ui.touch.controlsTop
      : undefined,
  );
  if (defined) return defined;
  const entry = manager.windows.get(id);
  if (entry?.defaultLayout === manager.layout) return { ...entry.defaultRect };
  const panel = document.getElementById(id);
  if (panel) {
    const clone = panel.cloneNode(true);
    clone.hidden = false;
    delete clone.dataset.windowMoved;
    delete clone.dataset.windowSized;
    for (const key of ['left', 'top', 'width', 'height', 'max-width', 'max-height'])
      clone.style.removeProperty(`--window-${key}`);
    clone.style.setProperty('display', id === 'helmPanel' ? 'flex' : 'block', 'important');
    clone.style.setProperty('visibility', 'hidden', 'important');
    clone.querySelectorAll('[hidden]').forEach((el) => {
      el.hidden = false;
    });
    if (!clone.textContent.trim()) clone.textContent = SAMPLES[id];
    document.body.append(clone);
    const r = clone.getBoundingClientRect();
    clone.remove();
    if (r.width >= 64 && r.height >= 20)
      return { left: r.left, top: r.top, width: r.width, height: Math.max(64, r.height) };
  }
  return {
    left: 12 + (n % 3) * innerWidth * 0.3,
    top: 12 + Math.floor(n / 3) * 90,
    width: Math.min(250, innerWidth * 0.3),
    height: 80,
  };
}

export class LayoutEditor {
  constructor(ui) {
    this.ui = ui;
    this.manager = ui.hudWindows;
    this.manager.update();
    this.layout = this.manager.layout;
    this.width = innerWidth;
    this.height = innerHeight;
    this.touch = ui.input.touchEnabled;
    this.mode = '';
    this.timepiece = ui.hooks.world().career?.preferences?.timepiece || 'digital';
    this.rows = [];
    const w = ui.hooks.world(),
      wasTouch = document.body.classList.contains('touch-playing');
    if (this.touch) document.body.classList.add('touch-playing');
    for (const [id, label] of Object.entries(WINDOWS)) {
      if (id === 'testInfo' && w.career && !w.career.sandbox) continue;
      const entry = this.manager.windows.get(id),
        defaults = fitWindow(
          defaultRect(this.manager, id, this.rows.length),
          this.width,
          this.height,
          this.touch,
        ),
        position = entry?.positions.get(this.layout) || this.manager.saved[id]?.[this.layout] || {},
        size = entry?.sizes.get(this.layout) || {},
        rect = fitWindow(
          { ...defaults, ...position, ...size },
          this.width,
          this.height,
          this.touch,
        ),
        key = WINDOW_OPTIONS[id],
        allowed =
          !key ||
          !w.career ||
          w.career.difficulty !== 'realistic' ||
          REALISTIC_ASSISTS.has(key) ||
          Object.hasOwn(UI_OPTIONS, key);
      this.rows.push({
        id,
        label,
        key,
        allowed,
        defaults,
        rect,
        changed: false,
        enabled: key ? assist(w, key, ui.realistic) : true,
        presentation: instrumentStyle(id),
        faded: document.getElementById(id)?.dataset.seeThrough === 'on',
      });
    }
    if (!wasTouch) document.body.classList.remove('touch-playing');
    this.selected = 0;
    this.initialState = this.stateKey();
    this.orientationDrafts = new Map();
  }
  syncViewport() {
    if (
      this.width === innerWidth &&
      this.height === innerHeight &&
      this.touch === this.ui.input.touchEnabled
    )
      return;
    const dirty = this.stateKey() !== this.initialState;
    this.orientationDrafts.set(
      this.layout,
      this.rows.map(({ id, rect, changed, reset }) => ({ id, rect, changed, reset })),
    );
    this.manager.update();
    this.layout = this.manager.layout;
    this.width = innerWidth;
    this.height = innerHeight;
    this.touch = this.ui.input.touchEnabled;
    this.heldAdjustment = null;
    const draft = this.orientationDrafts.get(this.layout);
    for (const [n, row] of this.rows.entries()) {
      const entry = this.manager.windows.get(row.id),
        saved = draft?.find((r) => r.id === row.id);
      row.defaults = fitWindow(defaultRect(this.manager, row.id, n), this.width, this.height);
      row.rect = fitWindow(
        saved?.rect || {
          ...row.defaults,
          ...entry?.positions.get(this.layout),
          ...entry?.sizes.get(this.layout),
        },
        this.width,
        this.height,
      );
      row.changed = saved?.changed || false;
      row.reset = saved?.reset || false;
    }
    this.ui.panel.style.removeProperty('translate');
    this.ui.signature = null;
    if (!dirty) this.initialState = this.stateKey();
  }
  stateKey() {
    return JSON.stringify([
      this.timepiece,
      this.rows.map((r) => [r.rect, r.enabled, r.presentation, r.faded]),
    ]);
  }
  requestCancel() {
    if (
      this.exiting ||
      (this.stateKey() === this.initialState &&
        ![...this.orientationDrafts.values()].some((rows) => rows.some((r) => r.changed)))
    )
      return false;
    this.cancelPending = true;
    this.mode = '';
    this.ui.index = 0;
    this.ui.signature = null;
    return true;
  }
  actions() {
    if (this.cancelPending)
      return [
        {
          id: 'layout-keep-editing',
          label: 'Keep editing',
          run: () => {
            this.cancelPending = false;
            this.ui.index = 0;
            this.ui.signature = null;
          },
        },
        {
          id: 'layout-discard',
          label: 'Exit without saving',
          run: () => {
            this.exiting = true;
            this.ui.back();
          },
        },
      ];
    const row = this.rows[this.selected];
    return [
      ...this.rows.map((r, n) => ({
        id: `layout-${r.id}`,
        label: `${r.enabled ? '◉' : '○'} ${r.label} · ${r.enabled ? 'ON' : 'OFF'} · ${r.presentation === 'chart' ? '◈ chart only' : r.presentation === 'graphic' ? '◈ graphic' : 'Aa text'}`,
        run: () => {
          this.selected = n;
          this.mode = '';
        },
      })),
      {
        id: 'layout-move',
        label: 'Move selected window',
        run: () => {
          this.mode = 'move';
        },
      },
      {
        id: 'layout-size',
        label: 'Resize selected window',
        run: () => {
          this.mode = 'size';
        },
      },
      {
        id: 'layout-toggle',
        label: `${row.enabled ? 'Hide' : 'Show'} selected window`,
        disabled: !row.key || !row.allowed,
        run: () => {
          row.enabled = !row.enabled;
        },
      },
      {
        id: 'layout-presentation',
        label: `Display: ${row.presentation === 'text' ? 'Plain text' : row.presentation === 'chart' ? 'Chart only' : 'Graphic'} · switch`,
        run: () => {
          const modes =
            row.id === 'minimapPanel' ? ['chart', 'graphic', 'text'] : ['graphic', 'text'];
          row.presentation = modes[(modes.indexOf(row.presentation) + 1) % modes.length];
        },
      },
      {
        id: 'layout-opacity',
        label: `Opacity: ${row.faded ? '25% · see-through' : 'Solid'} · switch`,
        run: () => {
          row.faded = !row.faded;
        },
      },
      ...(row.id === 'timepiecePanel'
        ? [
            {
              id: 'layout-timepiece',
              label: `Clock face: ${ownedTimepieces(this.ui.hooks.world()).find(([id]) => id === this.timepiece)?.[1] || 'Red digital clock'}`,
              run: () => {
                const faces = ownedTimepieces(this.ui.hooks.world());
                this.timepiece =
                  faces[
                    (faces.findIndex(([id]) => id === (this.timepiece || 'digital')) + 1) %
                      faces.length
                  ][0];
              },
            },
          ]
        : []),
      { id: 'layout-reset', label: 'Reset selected position / size', run: () => this.reset(row) },
      {
        id: 'layout-reset-all',
        label: 'Reset all positions / sizes',
        run: () => this.rows.forEach((r) => this.reset(r)),
      },
      { id: 'layout-save', label: 'Save layout', run: () => this.save() },
      { id: 'layout-cancel', label: 'Back / Discard changes', run: () => this.ui.back() },
    ];
  }
  reset(row) {
    row.rect = { ...row.defaults };
    row.changed = row.reset = true;
  }
  change(dx, dy) {
    const row = this.rows[this.selected],
      r = { ...row.rect };
    if (this.mode === 'size') {
      r.width += dx;
      r.height += dy;
    } else {
      r.left += dx;
      r.top += dy;
    }
    row.rect = fitWindow(r, this.width, this.height, this.touch);
    row.changed = true;
    row.reset = false;
  }
  input(a) {
    this.syncViewport();
    if (this.heldAdjustment && performance.now() >= this.heldAdjustment.next) {
      const { dx, dy } = this.heldAdjustment;
      this.change(dx, dy);
      this.heldAdjustment.next = performance.now() + 80;
    }
    if (!this.mode) return false;
    if (a.back || a.confirm || a.pause || a.keyboardEscape) {
      this.mode = '';
      this.ui.signature = null;
      return true;
    }
    const raw = this.ui.input.suppressed ? {} : this.ui.input.raw;
    const held =
      raw.menuLeft > 0.5
        ? 'left'
        : raw.menuRight > 0.5
          ? 'right'
          : raw.menuUp > 0.5
            ? 'up'
            : raw.menuDown > 0.5
              ? 'down'
              : '';
    const direction = a.menuLeft
      ? 'left'
      : a.menuRight
        ? 'right'
        : a.menuUp
          ? 'up'
          : a.menuDown
            ? 'down'
            : a.navDirection ||
              (held && performance.now() >= (this.nextRepeat || 0) ? held : '') ||
              (a.navPulse === 1 ? 'down' : a.navPulse === -1 ? 'up' : '');
    if (direction) {
      this.nextRepeat = performance.now() + 80;
      this.change(
        direction === 'left' ? -12 : direction === 'right' ? 12 : 0,
        direction === 'up' ? -12 : direction === 'down' ? 12 : 0,
      );
    }
    return true;
  }
  save() {
    this.syncViewport();
    const w = this.ui.hooks.world();
    for (const [layout, rows] of this.orientationDrafts) {
      if (layout === this.layout) continue;
      for (const row of rows) {
        if (!row.changed) continue;
        const entry = this.manager.windows.get(row.id);
        this.manager.saved[row.id] ??= {};
        if (row.reset) {
          delete this.manager.saved[row.id][layout];
          entry?.positions.delete(layout);
          entry?.sizes.delete(layout);
        } else {
          this.manager.saved[row.id][layout] = { ...row.rect };
          entry?.positions.set(layout, { left: row.rect.left, top: row.rect.top });
          entry?.sizes.set(layout, { width: row.rect.width, height: row.rect.height });
        }
      }
    }
    for (const row of this.rows) {
      setInstrumentStyle(row.id, row.presentation);
      const live = document.getElementById(row.id);
      if (live) live.dataset.seeThrough = row.faded ? 'on' : 'off';
      const entry = this.manager.windows.get(row.id);
      if (row.changed) {
        this.manager.saved[row.id] ??= {};
        if (row.reset) {
          delete this.manager.saved[row.id][this.layout];
          entry?.positions.delete(this.layout);
          entry?.sizes.delete(this.layout);
        } else {
          this.manager.saved[row.id][this.layout] = { ...row.rect };
          entry?.positions.set(this.layout, { left: row.rect.left, top: row.rect.top });
          entry?.sizes.set(this.layout, { width: row.rect.width, height: row.rect.height });
        }
        if (entry) entry.layout = null;
      }
      if (w.career && row.key && row.allowed && !!w.career.assists[row.key] !== row.enabled)
        toggleAssist(w, row.key);
      else if (!w.career && row.key) {
        w.uiOptions ??= {};
        w.uiOptions[row.key] = row.enabled;
      }
    }
    this.manager.save();
    if (w.career && this.timepiece) {
      w.career.preferences ??= {};
      w.career.preferences.timepiece = this.timepiece;
    }
    this.ui.hooks.save?.();
    this.exiting = true;
    this.ui.back();
  }
  render(w) {
    this.syncViewport();
    if (this.cancelPending) {
      const ui = this.ui,
        signature = `discard:${ui.index}`;
      if (ui.signature !== signature) {
        ui.signature = signature;
        ui.panel.innerHTML =
          '<section role="alertdialog" aria-label="Unsaved layout"><h2>Exit without saving?</h2><p>Your layout changes have not been saved.</p><div class="choices layout-confirm"></div></section>';
        this.actions().forEach((action, n) =>
          ui.panel
            .querySelector('.choices')
            .append(choiceButton(ui, w, action.label, n, { action })),
        );
      }
      return;
    }
    const ui = this.ui,
      signature = JSON.stringify([
        ui.index,
        this.selected,
        this.mode,
        this.rows.map((r) => [r.enabled, r.presentation]),
        this.timepiece,
        this.rows[this.selected].faded,
      ]);
    if (ui.signature !== signature) {
      const scrollPositions = Object.fromEntries(
        [...ui.panel.querySelectorAll('.layout-scroll-card')].map((card) => [
          card.classList.contains('layout-controls-card') ? 'controls' : 'elements',
          card.scrollTop,
        ]),
      );
      ui.signature = signature;
      ui.panel.innerHTML =
        '<h2 class="layout-title">Arrange UI layout <small>drag this heading to move the window</small></h2><p class="layout-instructions"></p><div class="layout-workspace"><div class="layout-preview-wrap"><div class="layout-preview" aria-label="Preview of all information windows"></div></div><div class="layout-sidebars"><section class="layout-scroll-card layout-controls-card" aria-labelledby="layout-controls-title"><h3 id="layout-controls-title">Control actions</h3><div class="layout-adjustments choices"></div><div class="layout-tools choices"></div></section><section class="layout-scroll-card layout-elements-card" aria-labelledby="layout-elements-title"><h3 id="layout-elements-title">UI elements</h3><div class="layout-picker choices" aria-label="Select a UI element"></div></section></div></div>';
      const heading = ui.panel.querySelector('.layout-title');
      heading.onpointerdown = (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        const origin = ui.panel.getBoundingClientRect();
        const translated = (getComputedStyle(ui.panel).translate || '').split(' ').map(parseFloat);
        const originX = translated[0] || 0,
          originY = translated[1] || 0;
        const start = { x: e.clientX, y: e.clientY };
        heading.setPointerCapture(e.pointerId);
        heading.onpointermove = (move) => {
          if (!heading.hasPointerCapture(move.pointerId)) return;
          const dx = Math.max(
            -origin.left,
            Math.min(innerWidth - origin.right, move.clientX - start.x),
          );
          const dy = Math.max(
            -origin.top,
            Math.min(innerHeight - origin.bottom, move.clientY - start.y),
          );
          const zoom = Number(getComputedStyle(ui.panel).zoom) || 1;
          ui.panel.style.translate = `${originX + dx / zoom}px ${originY + dy / zoom}px`;
        };
      };
      ui.panel.querySelector('.layout-controls-card').hidden = false;
      if (this.mode) {
        for (const [id, label, dx, dy] of [
          ['left', '←', -12, 0],
          ['right', '→', 12, 0],
          ['up', '↑', 0, -12],
          ['down', '↓', 0, 12],
          ['finish', 'Finish adjustment', 0, 0],
        ]) {
          const button = document.createElement('button');
          button.textContent = label;
          button.dataset.layoutAdjust = id;
          button.setAttribute(
            'aria-label',
            id === 'finish' ? label : `${this.mode === 'move' ? 'Move' : 'Resize'} ${id}`,
          );
          button.onclick = (event) => {
            if (id === 'finish') {
              this.mode = '';
              ui.signature = null;
            } else if (event.detail === 0) this.change(dx, dy);
          };
          if (id !== 'finish') {
            button.onpointerdown = (e) => {
              e.preventDefault();
              button.setPointerCapture(e.pointerId);
              this.change(dx, dy);
              this.heldAdjustment = { dx, dy, next: performance.now() + 300 };
            };
            for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
              button.addEventListener(name, () => {
                this.heldAdjustment = null;
              });
          }
          ui.panel.querySelector('.layout-adjustments').append(button);
        }
      }
      const preview = ui.panel.querySelector('.layout-preview');
      for (const [n, row] of this.rows.entries()) {
        const card = document.createElement('button');
        card.className = 'layout-card';
        card.dataset.layoutWindow = row.id;
        const title = document.createElement('strong'),
          sample = document.createElement('span');
        title.textContent = row.label;
        sample.textContent = SAMPLES[row.id];
        card.append(title, sample);
        card.onclick = () => {
          this.selected = n;
          this.mode = '';
          ui.index = n;
          ui.signature = null;
        };
        preview.append(card);
      }
      for (const [n, action] of this.actions().entries()) {
        const button = choiceButton(ui, w, action.label, n, { action });
        if (n < this.rows.length) button.classList.toggle('layout-chosen', n === this.selected);
        ui.panel
          .querySelector(n < this.rows.length ? '.layout-picker' : '.layout-tools')
          .append(button);
      }
      ui.panel.querySelector('.layout-controls-card').scrollTop = scrollPositions.controls || 0;
      ui.panel.querySelector('.layout-elements-card').scrollTop = scrollPositions.elements || 0;
    }
    this.paint();
  }
  paint() {
    const ui = this.ui,
      row = this.rows[this.selected],
      bind = (key) => ui.input.label(key);
    ui.panel.querySelector('.layout-instructions').textContent = this.mode
      ? `${this.mode === 'move' ? 'Moving' : 'Resizing'} ${row.label} · Arrow keys / D-pad / left stick or the direction buttons adjust · ${bind('confirm')} / ${bind('back')} or Finish ends adjustment. Changes remain unsaved.`
      : `${this.width} × ${this.height} · Select a window, choose Move or Resize. Hold arrows for steady adjustment. Save applies; Back discards. Grey previews are hidden windows.`;
    const wrap = ui.panel.querySelector('.layout-preview-wrap'),
      preview = ui.panel.querySelector('.layout-preview'),
      scale = Math.min(wrap.clientWidth / this.width, wrap.clientHeight / this.height);
    preview.style.width = `${this.width * scale}px`;
    preview.style.height = `${this.height * scale}px`;
    for (const [n, r] of this.rows.entries()) {
      const card = ui.panel.querySelector(`[data-layout-window="${r.id}"]`);
      card.style.left = `${(r.rect.left / this.width) * 100}%`;
      card.style.top = `${(r.rect.top / this.height) * 100}%`;
      card.style.width = `${(r.rect.width / this.width) * 100}%`;
      card.style.height = `${(r.rect.height / this.height) * 100}%`;
      card.classList.toggle('layout-chosen', r === row);
      card.classList.toggle('layout-off', !r.enabled);
      card.setAttribute('aria-pressed', String(r === row));
      card.setAttribute(
        'aria-label',
        `${r.label}, ${r.enabled ? 'shown when available' : 'hidden'}`,
      );
      ui.panel
        .querySelector(`[data-action="layout-${r.id}"]`)
        ?.classList.toggle('layout-chosen', n === this.selected);
    }
    const toggle = ui.panel.querySelector('[data-action="layout-toggle"]');
    if (toggle) {
      toggle.textContent = `${row.enabled ? 'Hide' : 'Show'} selected window`;
      toggle.disabled = !row.key || !row.allowed;
    }
  }
}

export function layoutEditor(ui) {
  return (ui.layoutEditor ||= new LayoutEditor(ui));
}
