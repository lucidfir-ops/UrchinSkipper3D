import { updatePatrolPrompt } from './patrol-view.js';
import { uiScale, setUiScale, changeUiScale } from './ui-scale.js';
import { updateIntro } from './intro-view.js';
import { introActive } from './career-intro.js';
import { collectFeedback } from './screen-feedback.js';
import { setText } from './dom-view.js';
import { choices, activate } from './screen-actions.js';
import { renderOrders, render } from './screen-render.js';
import { open, back, previous, forward, canForward, escapeMenu } from './screen-navigation.js';
import { setBindingView, BINDING_VIEWS } from './controller-view.js';

import { harbourScreen } from './starter-career.js';
import { neighbour, menuGeometry, menuDirections } from './menu-navigation.js';

import { toggleInformation, presetLabel } from './assists.js';

import { C } from './config.js';

import { selectedDiver, selectDiver } from './world.js';
import { setInstructions } from './simulation.js';

import { cycleDeparturePatch } from './day-view.js';

import { exitSession } from './session.js';

import { TITLES } from './screen-titles.js';
import { TouchControls } from './touch-controls.js';
import { isRadioMessage } from './radio-history.js';
import { fullscreenLabel, toggleFullscreen } from './fullscreen.js';
import { applyScreenFit } from './screen-fit.js';
import { loggingEnabled, toggleLogging, downloadLog, sampleLog } from './troubleshooting-log.js';
const TITLE_ACTIONS = [
  'continue',
  'load',
  'new',
  'test',
  'touch',
  'scale',
  'fullscreen',
  'logging',
  'download-log',
];
export class PlaytestUI {
  constructor(input, canvas, hooks) {
    this.input = input;
    this.canvas = canvas;
    canvas.tabIndex = 0;
    this.hooks = hooks;
    this.started = false;
    this.fallback = false;
    this.screen = null;
    this.index = 0;
    this.diagnostics = false;
    this.debug = false;
    this.realistic = false;
    this.chartMode = 'raster';
    this.chartZoom = 1;
    this.history = [];
    this.feedback = true;
    this.messages = [];
    this.remapDevice = 'gamepad';
    this.ended = false;
    this.lastReady = false;
    this.start = document.querySelector('#startup');
    this.status = document.querySelector('#controllerStatus');
    this.panel = document.querySelector('#playtest');
    this.diag = document.querySelector('#diagnostics');
    this.actionDisplay = document.querySelector('#actionFeedback');
    this.lastBuckets = { throttle: 0, rudder: 0 };
    this.titleIndex = 0;
    this.installTitle();
    this.touch = new TouchControls(input, this);
    applyScreenFit();
    window.addEventListener('resize', applyScreenFit);
    document.querySelector('#keyboardFallback').onclick = () => this.titleAction('continue', true);
    document.querySelector('#touchMenu').onclick = () => {
      if (this.ended) this.back();
      else this.open('pause');
    };
    // Focus loss already locks simulation/input. Keep the exact menu and draft.
    window.addEventListener('blur', () => this.hooks.save?.());
  }
  installTitle() {
    const continueButton = document.querySelector('#keyboardFallback');
    continueButton.textContent = 'Continue';
    const list = document.createElement('div');
    list.className = 'title-choices';
    continueButton.before(list);
    list.append(continueButton);
    for (const [label, action] of [
      ['Load Game', 'load'],
      ['New Career', 'new'],
      ['Training Mode', 'test'],
      ['Touchscreen Options', 'touch'],
      [`UI scale: ${uiScale()}% · change`, 'scale'],
      [`⛶ ${fullscreenLabel()}`, 'fullscreen'],
      [`Troubleshooting log: ${loggingEnabled() ? 'ON' : 'OFF'}`, 'logging'],
      ['Download troubleshooting log', 'download-log'],
    ]) {
      const b = document.createElement('button');
      b.textContent = label;
      if (action === 'touch') b.dataset.touchOptions = '';
      if (action === 'scale') b.dataset.uiScale = '';
      if (action === 'fullscreen') b.dataset.fullscreen = '';
      if (action === 'logging') b.dataset.logging = '';
      if (action === 'test')
        b.insertAdjacentHTML(
          'beforeend',
          '<svg class="test-mode-icon" viewBox="0 0 40 24" aria-hidden="true"><path d="M5 4H35L38 18Q28 24 23 14H17Q12 24 2 18Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 9H15M25 9H32" stroke="currentColor" stroke-width="2"/></svg>',
        );
      b.onclick = () => this.titleAction(action, true);
      list.append(b);
    }
    const note = document.createElement('small');
    note.textContent =
      'Optional log keeps recent controls, menus and errors on this device. Download after a problem or reload; nothing is uploaded. A browser crash may lose the last few seconds.';
    list.after(note);
    setUiScale(uiScale());
    const nav = document.createElement('div');
    nav.className = 'title-navigation';
    nav.innerHTML =
      '<button disabled aria-label="Already at title">← Back</button><button class="screen-forward" aria-label="Forward to last menu" disabled>Forward →</button>';
    list.before(nav);
    this.titleForward = nav.querySelector('.screen-forward');
    this.titleForward.onclick = () => this.forward();
  }
  showTitle({ navigation = false } = {}) {
    this.fromTitle = false;
    if (!navigation) this.forwardHistory = [];
    this.pendingPurchase = null;
    this.hooks.save?.();
    if (!navigation) {
      if (this.hooks.world().career?.sandbox) this.hooks.sandbox(false);
      else if (!this.hooks.world().career && !this.hooks.prototypeOnly) this.hooks.resumeCareer?.();
    }
    this.history = [];
    this.open(null, { navigation });
    this.started = false;
    this.ended = false;
    this.titleRequested = true;
    this.lastReady = false;
    this.titleIndex = 0;
    this.input.suppress();
  }
  titleAction(action, keyboard = false) {
    if (action === 'fullscreen') {
      toggleFullscreen();
      return;
    }
    if (action === 'logging') {
      toggleLogging();
      this.start.querySelector('[data-logging]').textContent =
        `Troubleshooting log: ${loggingEnabled() ? 'ON' : 'OFF'}`;
      return;
    }
    if (action === 'download-log') {
      downloadLog();
      return;
    }
    if (action === 'forward') {
      this.forward();
      return;
    }
    if (action === 'scale') {
      changeUiScale();
      return;
    }
    if (action === 'touch') {
      this.begin(keyboard);
      this.open('touch-options');
      this.fromTitle = true;
      return;
    }
    this.forwardHistory = [];
    this.begin(keyboard);
    const w = this.hooks.world();
    if (w.career?.sandbox && action !== 'continue') this.hooks.sandbox(false);
    if (!this.hooks.world().career && !['prototype', 'continue'].includes(action))
      this.hooks.resumeCareer();
    if (action === 'load') {
      this.open('archives');
      this.fromTitle = true;
    } else if (action === 'new') {
      const result = this.hooks.changeCareer();
      if (!result.ok) {
        this.open('archives');
        this.menuNotice = result.reason;
      } else {
        this.open(null);
        this.open(harbourScreen(this.hooks.world()));
      }
    } else if (action === 'test') {
      const result = this.hooks.trainingReplay();
      this.open(result.ok ? null : 'workshop');
      this.menuNotice = result.reason || '';
    } else if (action === 'prototype') {
      this.hooks.prototype();
      this.open('chart');
    }
  }
  begin(keyboard = false) {
    this.fallback = keyboard;
    this.started = true;
    this.input.suppress();
    this.canvas.focus();
    this.hooks.audio?.unlock();
  }
  notify(text) {
    const now = performance.now();
    if (this.messages.at(-1)?.text === text && now - this.messages.at(-1).time < 500) return;
    const record = { text, time: now };
    // One live helm line must not bury a readable radio notice.
    this.messages = this.messages.filter((m) => !/^(THROTTLE|RUDDER) /.test(m.text));
    this.messages.push(record);
    if (isRadioMessage(text)) {
      const w = this.hooks.world(),
        log = w.career ? (w.career.radioLog ??= []) : (this.radioLog ??= []);
      log.push({ text, day: w.career?.day || 1, minute: w.day.minute });
      if (log.length > 80) log.shift();
    }
    this.messages = this.messages.slice(-4);
  }
  open(screen, options = {}) {
    return open.call(this, screen, options);
  }
  back() {
    return back.call(this);
  }
  previous() {
    return previous.call(this);
  }
  forward() {
    return forward.call(this);
  }
  escapeMenu() {
    return escapeMenu.call(this);
  }
  get lockReason() {
    if (this.bindingPicker?.open) return 'CHOOSING A BINDING';
    if (this.ended) return 'SESSION ENDED';
    if (!this.started) return 'PRESS A CONTROLLER BUTTON OR ENTER';
    if (
      !this.fallback &&
      this.input.lastDevice !== 'keyboard' &&
      !this.input.touchEnabled &&
      !this.input.connected
    )
      return 'CONTROLLER DISCONNECTED — RECONNECT / PRESS A BUTTON';
    if (document.hidden || !document.hasFocus()) return 'GAME NOT FOCUSED — RETURN TO GAME';
    if (this.input.capture) return 'REMAPPING — WAITING FOR NEW INPUT';
    if (this.input.naming) return 'NAMING PHYSICAL BUTTONS';
    if (this.voyageUntil > performance.now()) return 'UNDERWAY TO WORKING GROUND';
    if (this.screen) return `${TITLES[this.screen]} — MENU CONSUMES INPUT`;
    if (this.input.suppressed) return 'RELEASE ALL BUTTONS AND STICKS TO CONTINUE';
    return '';
  }
  get blocked() {
    return !!this.lockReason;
  }
  get qualityControls() {
    return this.input.lastDevice === 'keyboard'
      ? ['fullReverse', 'fullAhead']
      : ['menuLeft', 'menuRight'];
  }
  exit() {
    this.exitPrevious = { screen: this.screen, index: this.index, history: [...this.history] };
    const saved = this.hooks.save?.();
    this.ended = true;
    this.open('exit');
    this.exitNote = this.hooks.world().career
      ? `${saved?.ok === false ? 'Save unavailable; return with Back to keep playing.' : 'Career saved.'} Back / Cancel returns to the same place; Retry resumes the saved trip; Launcher returns to the title; Exit closes the game.`
      : 'Your session is paused. Back / Cancel returns to the same place. Retry starts a fresh trip; Launcher returns to the title; Exit closes the game.';
  }
  async closeSession() {
    if (this.exitPending) return;
    this.exitPending = true;
    this.exitNote = 'Closing the game window…';
    this.signature = null;
    this.exitNote = await exitSession();
    this.exitPending = false;
    this.signature = null;
  }
  applyOrders(world) {
    setInstructions(world, this.draft.diverId, {
      direction: this.draft.direction,
      minQuality: this.draft.quality,
      searchLimit: this.draft.searchLimit,
      maxBagSeconds: this.draft.maxBagSeconds,
    });
    this.hooks.save?.();
    this.notify(`DIVER ${this.draft.diverId + 1} — ORDERS CONFIRMED`);
    this.hooks.audio?.play('confirm');
    this.open(null);
  }
  choices(world) {
    return choices.call(this, world);
  }
  activate(world) {
    return activate.call(this, world);
  }
  update(a, world, dt = 1 / 60) {
    if (this.bindingPicker?.open) return true;
    const wasBlocked = this.blocked,
      wasStarted = this.started,
      oldScreen = this.screen;
    if (!this.started) {
      const forwardAvailable = canForward.call(this),
        count = TITLE_ACTIONS.length + (forwardAvailable ? 1 : 0);
      if (this.titleForward) {
        this.titleForward.disabled = !forwardAvailable;
      }
      this.titleIndex ??= 0;
      this.titleIndex %= count;
      if (a.menuDown || a.navPulse === 1) this.titleIndex = (this.titleIndex + 1) % count;
      if (a.menuUp || a.navPulse === -1) this.titleIndex = (this.titleIndex + count - 1) % count;
      const titleButtons = [...this.start.querySelectorAll('.title-choices button')];
      if (this.titleForward) titleButtons.push(this.titleForward);
      titleButtons.forEach((b, n) => {
        const selected = n === this.titleIndex;
        b.classList.toggle('selected', selected);
        if (selected && this.titleFocused !== b) {
          b.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
          this.titleFocused = b;
        }
      });
      if (this.input.connected && !world.career && !this.titleRequested) this.begin(false);
      else if (a.confirm || a.work || a.pause || a.recoverDiver)
        this.titleAction(
          [...TITLE_ACTIONS, 'forward'][this.titleIndex],
          this.input.lastDevice === 'keyboard',
        );
    }
    world = this.hooks.world();
    const ready =
      this.started && (this.input.connected || this.fallback || this.input.touchEnabled);
    if (ready && !this.lastReady) this.input.suppress();
    if (!ready && this.lastReady) {
      this.input.capture = null;
      this.input.suppress();
      this.notify('CONTROLLER DISCONNECTED — SIMULATION PAUSED');
    }
    this.lastReady = ready;
    if (this.input.notice !== this.lastNotice) {
      this.lastNotice = this.input.notice;
      if (this.input.notice) this.notify(this.input.notice);
    }
    if (wasStarted && !this.input.wasCapturing && !this.input.capture && !this.input.naming) {
      if (a.diagnostics) this.diagnostics = !this.diagnostics;
      if (a.debug && !world.career) this.debug = !this.debug;
      else if (a.debug && this.started && !this.screen && !wasBlocked) {
        toggleInformation(world);
        this.realistic = !world.career.assists.exactLoad;
        this.messages = [];
        this.importantNotice = null;
        this.notify(`${presetLabel(world.career.assists.preset).toUpperCase()} INFORMATION`);
        this.hooks.save?.();
      }
      if (this.screen === 'layout' && this.layoutEditor?.input(a, dt)) {
        /* Layout adjustments consume directions before menu navigation. */
      } else if (a.keyboardEscape) this.escapeMenu();
      else if (this.screen === 'exit') {
        if (a.back || a.pause) this.back();
        else if (!this.exitPending) {
          this.navigate(a);
          if (a.confirm) this.activate(world);
        }
      } else if (!this.started) {
        /* Title consumes its startup press. */
      } else if (this.screen === 'instructions') {
        if (Math.hypot(a.aimX || 0, a.aimY || 0) > C.input.deadZone) this.pointerOrders = false;
        if (!this.pointerOrders) this.draft.point(a.aimX || 0, a.aimY || 0);
        if (a.instructionsHeld) this.instructionHold += dt;
        const [qualityDown, qualityUp] = this.qualityControls;
        if (a[qualityDown]) this.draft.changeQuality(-1);
        if (a[qualityUp]) this.draft.changeQuality(1);
        if (a.zoomIn) this.draft.changeSearchLimit();
        if (a.zoomOut) this.draft.changeBagLimit();
        if (a.work) this.draft.clear();
        if (a.confirm || (this.holdOpened && this.instructionHold > 0.22 && a.instructionsReleased))
          this.applyOrders(world);
        else if (a.back || a.pause) this.back();
      } else if (a.pause) {
        if (this.screen) this.previous();
        else this.open('pause');
      } else if (a.bindings) this.open(this.screen === 'bindings' ? null : 'bindings');
      else if (this.screen && a.back) this.back();
      else if (this.screen) {
        const navigationHeader =
          this.index < 0 || /^Back( |$)/.test(this.choices(world)[this.index] || '');
        this.navigate(a);
        if (Math.abs(a.detailScroll || 0) > 0.25)
          (
            this.panel.querySelector('.expedition-copy') ||
            this.panel.querySelector(
              '.career-detail,.yard-detail,.landing-receipt,.almanac-curves,.frank-lesson,.radio-history',
            )
          )?.scrollBy(0, a.detailScroll * 400 * dt);
        if (this.screen === 'bindings' && !navigationHeader && (a.menuLeft || a.menuRight)) {
          const current =
            this.bindingView || (this.remapDevice === 'keyboard' ? 'keyboard' : 'controller');
          setBindingView(
            this,
            BINDING_VIEWS[(BINDING_VIEWS.indexOf(current) + (a.menuLeft ? 2 : 1)) % 3],
          );
        }
        if (this.screen === 'almanac') {
          this.forecastRepeat = (this.forecastRepeat || 0) - dt;
          const scrub = a.zoom || 0;
          if (scrub && this.forecastRepeat <= 0) {
            this.forecastOffset = Math.max(
              0,
              Math.min(660, (this.forecastOffset || 0) + Math.sign(scrub) * 30),
            );
            this.forecastRepeat = 0.22;
          }
          if (!scrub) this.forecastRepeat = 0;
        }
        if (this.screen === 'departure' && !world.career && (a.menuLeft || a.menuRight))
          cycleDeparturePatch(this, world, a.menuRight ? 1 : -1);
        if (a.confirm) this.activate(world);
      } else if (a.assists) this.open('assists');
      else if (a.instructions || a.quickOrders) this.open('instructions');
      else if (a.chart) this.open(world.career ? 'knowledge' : 'chart');
      else if (a.boatyard) this.open('boatyard');
      else if (a.almanac) this.open('almanac');
      else if (a.cycleDiver) {
        selectDiver(world, (world.selectedDiverId + 1) % world.divers.length);
        this.hooks.audio?.play('confirm');
        this.notify(`${selectedDiver(world).name.toUpperCase()} SELECTED`);
      }
    }
    // Menu actions can replace the career (intro, training, load). Never render
    // the new screen with the previous world's missing tutorial/crew fields.
    world = this.hooks.world();
    if (
      ready &&
      this.started &&
      !this.ended &&
      world.emergency?.mandatoryRescue &&
      !introActive(world) &&
      world.day.phase !== 'complete' &&
      !['emergency', 'help'].includes(this.screen)
    )
      this.open('emergency', { replace: true });
    if (ready && this.started && !this.screen && !this.ended && world.day.phase === 'planning')
      this.open(world.career ? harbourScreen(world) : 'chart');
    if (ready && this.started && !this.screen && !this.ended && world.day.phase === 'complete')
      this.open('summary');
    updatePatrolPrompt(this, world, ready);
    updateIntro(this, world, a, dt);
    world = this.hooks.world();
    this.start.hidden = !!this.screen || ready || this.ended;
    if (!this.start.hidden)
      setText(
        this.status,
        this.input.touchEnabled
          ? 'Touchscreen mode is on. Tap Continue, or repeat Training Mode.'
          : this.input.connected
            ? `Controller detected: ${this.input.activePad.id}`
            : 'Press a face button or Enter. Keep Steam running for built-in controls; use a Gamepad layout for this shortcut. Touch or keyboard can open controller setup.',
      );
    this.render(world);
    this.touch?.update();
    sampleLog(this, world);
    return wasBlocked || this.blocked || oldScreen !== this.screen || this.input.wasCapturing;
  }
  navigate(a) {
    const direction = a.menuDown
      ? 'down'
      : a.menuUp
        ? 'up'
        : a.menuLeft
          ? 'left'
          : a.menuRight
            ? 'right'
            : a.navDirection || (a.navPulse === 1 ? 'down' : a.navPulse === -1 ? 'up' : '');
    const navigationHeader =
      this.index < 0 || /^Back( |$)/.test(this.choices(this.hooks.world())[this.index] || '');
    if (
      direction &&
      (navigationHeader ||
        menuDirections(this.screen, !!this.hooks.world().career).includes(direction))
    )
      this.index = neighbour(menuGeometry(this.panel), this.index, direction);
  }
  collectFeedback(world, a) {
    return collectFeedback.call(this, world, a);
  }
  renderOrders(world, bind) {
    return renderOrders.call(this, world, bind);
  }
  render(world) {
    return render.call(this, world);
  }
}
