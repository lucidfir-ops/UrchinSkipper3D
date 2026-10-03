import { touchScale, setTouchScale } from './touch-scale.js';
import { touchOpacity, setTouchOpacity } from './touch-opacity.js';
import { boatDragActions } from './touch-boat.js';
import { boatSpec } from './boats.js';
import { installFullscreen } from './fullscreen.js';
import { setText } from './dom-view.js';
// DOM Pointer Events give each finger its own lifetime; Input resolves the same
// abstract commands used by keyboard and controllers. No simulated key presses.
export const TOUCH_LABELS = {
  recoverDiver: 'Deploy / board',
  work: 'Bag / send down',
  recall: 'Recall',
  cycleDiver: 'Select diver',
  instructions: 'Orders',
  quickOrders: 'Orders',
  chart: 'Chart',
  zoomIn: 'Zoom +',
  zoomOut: 'Zoom −',
  fullAhead: 'Ahead',
  fullReverse: 'Reverse',
  neutral: 'Neutral',
  centerRudder: 'Centre rudder',
  pause: 'Menu',
  assists: 'Assists',
  confirm: 'Apply',
  back: 'Back',
  menuUp: 'Up',
  menuDown: 'Down',
  menuLeft: 'Left',
  menuRight: 'Right',
  throttleUp: 'Throttle +',
  throttleDown: 'Throttle −',
  left: 'Rudder left',
  right: 'Rudder right',
  thrustPort: 'Bow left',
  thrustStarboard: 'Bow right',
  pivotPort: 'Rudder stick up',
  pivotStarboard: 'Rudder stick down',
  almanac: 'Tides',
  debug: 'Information',
};
export class TouchControls {
  constructor(input, ui) {
    setTouchScale(touchScale());
    setTouchOpacity(touchOpacity());
    this.input = input;
    this.ui = ui;
    this.pointers = new Map();
    this.boatDrags = new Map();
    this.root = document.createElement('div');
    this.root.id = 'touchControls';
    this.root.setAttribute('aria-label', 'Touchscreen helm');
    this.root.hidden = true;
    const button = (id, text = TOUCH_LABELS[id]) =>
      `<button data-touch="${id}" aria-label="${text}">${text}</button>`;
    this.root.innerHTML = `<div class="touch-helm"><div class="touch-stick" data-stick="helm" aria-label="Throttle and bow thruster touch stick"><b class="command-fill"></b><em class="command-arrow"></em><span>THROTTLE<br>↔ BOW</span><i></i></div><div class="touch-gears">${button('fullReverse')}${button('neutral')}${button('fullAhead')}</div></div><div class="touch-actions">${['recoverDiver', 'work', 'recall', 'quickOrders', 'cycleDiver', 'chart', 'zoomOut', 'zoomIn'].map((id) => button(id)).join('')}</div><div class="touch-steering"><div class="touch-stick" data-stick="rudder" aria-label="Rudder touch stick"><b class="command-fill"></b><em class="command-arrow"></em><span>RUDDER</span><i></i></div>${button('centerRudder')}</div>`;
    document.body.append(this.root);
    const boat = document.createElement('button');
    boat.id = 'touchBoat';
    boat.dataset.stick = 'boat';
    boat.setAttribute(
      'aria-label',
      'Drag boat to steer and change throttle; tap to neutral and centre rudder',
    );
    boat.title = 'Drag to steer · tap to stop commands';
    this.root.append(boat);
    installFullscreen(input);
    this.hudHidden = false;
    this.screenLocked = true;
    this.hudToggle = document.createElement('button');
    this.hudToggle.id = 'touchHudToggle';
    this.hudToggle.type = 'button';
    this.hudToggle.hidden = true;
    this.hudToggle.title = 'Hide or show information windows, including Frank';
    this.hudToggle.onclick = () => {
      this.hudHidden = !this.hudHidden;
      this.update();
    };
    document.body.append(this.hudToggle);
    this.lockToggle = document.createElement('button');
    this.lockToggle.id = 'touchLockToggle';
    this.lockToggle.type = 'button';
    this.lockToggle.hidden = true;
    this.lockToggle.title = 'Show or hide UI move, resize and close controls';
    this.lockToggle.onclick = () => {
      this.screenLocked = !this.screenLocked;
      try {
        localStorage.setItem('urchin-touch-lock-v1', this.screenLocked ? 'on' : 'off');
      } catch {
        /* Lock state still works for this session. */
      }
      this.ui.hudWindows?.cancel();
      this.ui.hudWindows?.update();
      this.update();
    };
    document.body.append(this.lockToggle);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.addEventListener('pointerdown', (e) => {
      const control = e.target.closest('[data-touch],[data-stick]');
      if (!control || this.root.hidden || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if ([...this.pointers.values()].includes(control)) return;
      e.preventDefault();
      this.ui.hooks.audio?.unlock();
      this.input.lastDevice = 'touch';
      control.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, control);
      if (control.dataset.stick === 'boat')
        this.boatDrags.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
          heading: this.ui.hooks.world().boat.heading,
          moved: false,
        });
      control.classList.add('pressed');
      this.move(e);
    });
    this.root.addEventListener('pointermove', (e) => this.move(e));
    // A native button click commits after release, independent of frame rate.
    // It cannot be dropped by a neutral-input gate or replayed into the chart.
    this.root.addEventListener('click', (e) => {
      const action = e.target.closest('[data-touch]')?.dataset.touch;
      if (!['chart', 'quickOrders'].includes(action) || this.root.hidden) return;
      e.preventDefault();
      e.stopPropagation();
      this.clear();
      this.input.suppress();
      this.ui.open(
        action === 'chart'
          ? this.ui.hooks.world().career
            ? 'knowledge'
            : 'chart'
          : 'instructions',
      );
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.root.addEventListener(name, (e) => this.release(e.pointerId, name !== 'pointerup'));
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (this.input.touchEnabled && e.pointerType === 'touch') this.input.lastDevice = 'touch';
      },
      true,
    );
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('resize', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
    try {
      this.setEnabled(localStorage.getItem('urchin-touchscreen-v1') === 'on');
    } catch {
      this.setEnabled(false);
    }
  }
  setEnabled(enabled) {
    this.clear();
    this.input.touchEnabled = !!enabled;
    document.body.classList.toggle('touchscreen', !!enabled);
    try {
      localStorage.setItem('urchin-touchscreen-v1', enabled ? 'on' : 'off');
    } catch {
      /* Mode still works for this session without browser storage. */
    }
    if (enabled) {
      this.input.lastDevice = 'touch';
      this.ui.fallback = true;
    }
    this.ui.signature = null;
    this.input.suppress();
  }
  move(e) {
    const control = this.pointers.get(e.pointerId);
    if (!control) return;
    const actions = {};
    const drag = this.boatDrags.get(e.pointerId);
    if (drag) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.moved ||= Math.hypot(dx, dy) > 8;
      if (drag.moved) Object.assign(actions, boatDragActions(dx, dy, drag.heading));
    } else if (control.dataset.touch) {
      // Menu commands are committed on release, after the originating tap.
      // Opening on pointerdown allowed the release/click to hit the new menu.
      if (!['chart', 'quickOrders'].includes(control.dataset.touch))
        actions[control.dataset.touch] = 1;
    } else {
      const r = control.getBoundingClientRect(),
        radius = r.width * 0.38;
      let x = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / radius));
      let y = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / radius));
      if (Math.abs(x) < 0.15) x = 0;
      if (Math.abs(y) < 0.15) y = 0;
      if (control.dataset.stick === 'helm') {
        actions.throttleUp = Math.max(0, -y);
        actions.throttleDown = Math.max(0, y);
        actions.thrustPort = Math.max(0, -x);
        actions.thrustStarboard = Math.max(0, x);
      } else {
        actions.left = Math.max(0, -x);
        actions.right = Math.max(0, x);
        actions.pivotPort = Math.max(0, -y);
        actions.pivotStarboard = Math.max(0, y);
      }
      control.querySelector('i').style.transform = `translate(${x * radius}px, ${y * radius}px)`;
    }
    this.input.setTouch(e.pointerId, actions);
  }
  release(id, cancel = false) {
    const control = this.pointers.get(id);
    if (!control) return;
    const drag = this.boatDrags.get(id);
    if (drag && !drag.moved && !cancel) this.input.setTouch(id, { neutral: 1, centerRudder: 1 });
    this.boatDrags.delete(id);
    this.pointers.delete(id);
    control.classList.remove('pressed');
    const knob = control.querySelector('i');
    if (knob) knob.style.transform = '';
    this.input.setTouch(id, null, cancel);
    if (control.hasPointerCapture?.(id)) control.releasePointerCapture(id);
  }
  clear() {
    for (const id of this.pointers.keys()) this.release(id, true);
    this.input.touchTaps?.clear();
  }
  update() {
    const show =
      this.input.touchEnabled &&
      this.input.lastDevice !== 'keyboard' &&
      this.ui.started &&
      !this.ui.screen &&
      !document.hidden &&
      !this.ui.ended;
    if (!show && !this.root.hidden) this.clear();
    this.root.hidden = !show;
    if (show) {
      const w = this.ui.hooks.world(),
        spec = boatSpec(w),
        scale = w.trafficView ? window.innerWidth / (2 * w.trafficView.rangeX) : 6,
        boat = this.root.querySelector('#touchBoat');
      const pose = this.ui.hooks.boatScreenPose?.();
      boat.style.left = pose ? `${pose.x}px` : '50%';
      boat.style.top = pose ? `${pose.y}px` : '50%';
      boat.style.width = `${Math.max(48, pose?.width ?? spec.width * scale)}px`;
      boat.style.height = `${Math.max(48, pose?.length ?? spec.length * scale)}px`;
      boat.style.transform = `translate(-50%, -50%) rotate(${pose?.heading ?? w.boat.heading}rad)`;
      for (const [stick, value, positive, negative] of [
        ['helm', w.boat.throttle, '↑', '↓'],
        ['rudder', w.boat.rudder, '→', '←'],
      ]) {
        const control = this.root.querySelector(`[data-stick="${stick}"]`);
        control.style.setProperty('--command', Math.min(1, Math.abs(value)));
        control.dataset.direction =
          value > 0.01 ? 'positive' : value < -0.01 ? 'negative' : 'neutral';
        setText(
          control.querySelector('.command-arrow'),
          Math.abs(value) < 0.01 ? '•' : value > 0 ? positive : negative,
        );
        control.title = `${stick === 'helm' ? 'Throttle' : 'Rudder'} ${Math.round(Math.abs(value) * 100)}% ${Math.abs(value) < 0.01 ? 'neutral' : stick === 'helm' ? (value > 0 ? 'ahead' : 'astern') : value > 0 ? 'starboard' : 'port'}`;
      }
      const twin = boatSpec(this.ui.hooks.world()).pivotRate > 0,
        label = this.root.querySelector('[data-stick="rudder"] span'),
        text = twin ? 'RUDDER ↔ / JET PIVOT ↕' : 'RUDDER';
      if (label.textContent !== text) label.textContent = text;
    }
    document.body.classList.toggle('touch-playing', !!show);
    const controlsKey = `${innerWidth}/${innerHeight}/${touchScale()}`;
    if (show && this.controlsKey !== controlsKey) {
      this.controlsKey = controlsKey;
      this.controlsTop = this.root.getBoundingClientRect().top;
    }
    document.body.classList.toggle('hud-hidden', !!show && this.hudHidden);
    document.body.classList.toggle('hud-locked', !!show && this.screenLocked);
    this.hudToggle.hidden = !show;
    setText(this.hudToggle, this.hudHidden ? 'Show UI' : 'Hide UI');
    const hidden = String(this.hudHidden);
    if (this.hudToggle.getAttribute('aria-pressed') !== hidden)
      this.hudToggle.setAttribute('aria-pressed', hidden);
    this.lockToggle.hidden = !show;
    setText(this.lockToggle, `Adjust UI: ${this.screenLocked ? 'OFF' : 'ON'}`);
    const unlocked = String(!this.screenLocked);
    if (this.lockToggle.getAttribute('aria-pressed') !== unlocked)
      this.lockToggle.setAttribute('aria-pressed', unlocked);
  }
}
