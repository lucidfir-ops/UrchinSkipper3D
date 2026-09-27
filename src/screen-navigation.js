import { selectedDiver } from './world.js';

import { CompassDraft } from './compass.js';
import { GROUNDS } from './day.js';
import { harbourScreen } from './starter-career.js';
import { setBindingView } from './controller-view.js';
import { introActive } from './career-intro.js';

const VIEW_FIELDS = [
  'screen',
  'index',
  'chartGroundId',
  'chartPatchId',
  'chartHighlight',
  'arrivalLane',
  'laboratory',
  'almanacGroundId',
  'forecastOffset',
  'bindingView',
  'remapDevice',
  'fromTitle',
  'boatCandidate',
  'starterCandidate',
  'equipmentCandidate',
];
const transient = (screen) =>
  ['purchase', 'coast-access', 'buyboat', 'instructions', 'exit'].includes(screen);
const validPoint = (point, world) =>
  point &&
  (!point.world || point.world === world) &&
  (!point.phase || point.phase === world.day.phase);
function captureView(ui) {
  const world = ui.hooks.world();
  return {
    ...Object.fromEntries(VIEW_FIELDS.map((key) => [key, ui[key]])),
    index: ui.index === -2 ? 0 : ui.index,
    world,
    phase: world.day.phase,
    scroll: { top: ui.panel.scrollTop, left: ui.panel.scrollLeft },
  };
}
function restoreView(ui, point, navigation = true) {
  const { world, phase, scroll, ...view } = point;
  ui.open(view.screen, { replace: true, navigation });
  Object.assign(ui, view);
  ui.pendingScroll = scroll;
  ui.signature = null;
}

export function canForward() {
  const point = this.forwardHistory?.at(-1);
  return (
    !!point &&
    validPoint(point, this.hooks.world()) &&
    !this.input.capture &&
    !this.input.naming &&
    !this.ended &&
    !transient(this.screen)
  );
}
export function forward() {
  if (!canForward.call(this)) return;
  const point = this.forwardHistory.pop();
  if (this.screen) this.history.push(captureView(this));
  if (!this.started) this.begin(this.fallback || this.input.lastDevice === 'keyboard');
  restoreView(this, point);
}

export function open(screen, { replace = false, navigation = false } = {}) {
  if (this.hooks.world().day.returnFade !== undefined && screen) return;
  if (!navigation) this.forwardHistory = [];
  if (
    introActive(this.hooks.world()) &&
    screen &&
    ![
      'introchart',
      'intropause',
      'instructions',
      'exit',
      'assists',
      'layout',
      'settings',
      'ui-scale',
      'touch-options',
      'gameplay-speed',
      'bindings',
      'controller',
      'skipper-stuff',
    ].includes(screen)
  )
    screen = ['chart', 'knowledge', 'almanac'].includes(screen) ? 'introchart' : 'intropause';
  this.touch?.clear();
  if (screen === 'bindings' && !this.bindingView)
    setBindingView(
      this,
      this.input.lastDevice === 'keyboard' || !this.input.connected
        ? 'keyboard'
        : /steam|valve/i.test(this.input.activePad?.id || '')
          ? 'deck'
          : 'controller',
    );
  if (screen === 'boatyard' && this.hooks.world().career) screen = 'fleet';
  if (!navigation && (!screen || screen === 'exit' || screen === 'summary')) this.history = [];
  else if (!navigation && !replace && this.screen && this.screen !== screen)
    this.history.push(captureView(this));
  if (screen === 'knowledge' && this.screen !== 'departure' && this.screen !== 'knowledge')
    this.chartGroundId = this.hooks.world().day.groundId || this.chartGroundId || 'near';
  if (screen !== this.screen) {
    this.layoutEditor = null;
    this.panel.style?.removeProperty('translate');
  }
  this.screen = screen;
  this.index = 0;
  if (screen === 'starter') this.index = 1;
  this.input.capture = null;
  this.input.cancelNaming();
  this.signature = null;
  this.menuNotice = '';
  this.panel.scrollTop = 0;
  this.panel.scrollLeft = 0;
  if (screen === 'archives') this.archives = this.hooks.archives();
  if (screen === 'almanac') {
    this.almanacGroundId = this.hooks.world().day.groundId || this.chartGroundId || GROUNDS[0].id;
    this.forecastOffset = 0;
  }
  if (screen === 'instructions') {
    this.draft = new CompassDraft(selectedDiver(this.hooks.world()));
    this.pointerOrders = false;
    this.holdOpened = this.input.raw.instructions > 0.5;
    this.instructionHold = 0;
    // Hold-to-point needs the held button and stick, without passing them to helm control.
    this.input.suppressed = false;
  }
  this.canvas.focus();
}
// Escape leaves the menu stack; the controller's Menu/B history stays intact.
export function escapeMenu() {
  if (this.screen === 'layout' && this.layoutEditor?.requestCancel()) return;
  if (this.input.capture || this.input.naming) {
    this.back();
    return;
  }
  if (this.exitPending) return;
  this.ended = false;
  const world = this.hooks.world();
  const home =
    world.day.phase === 'planning'
      ? world.career
        ? harbourScreen(world)
        : 'chart'
      : world.day.phase === 'complete'
        ? 'summary'
        : null;
  const destination = !this.screen || this.screen === home ? 'pause' : home;
  this.history = [];
  this.open(destination, { replace: true });
}
// Internal Cancel/transaction navigation retains the immediate parent screen.
export function previous() {
  if (this.screen === 'exit') {
    if (this.exitPending) return;
    this.ended = false;
    const previous = this.exitPrevious;
    this.open(previous?.screen || 'pause', { replace: true });
    if (previous) Object.assign(this, previous);
    this.input.suppress();
    this.signature = null;
    return;
  }
  if (this.input.capture) {
    this.input.capture = null;
    this.input.suppress();
    this.signature = null;
    return;
  }
  if (this.input.naming) {
    this.input.cancelNaming();
    this.signature = null;
    return;
  }
  if (this.screen === 'archives' && this.fromTitle) {
    this.fromTitle = false;
    this.showTitle();
    return;
  }
  if (this.screen === 'harbour' || this.screen === 'starter' || this.screen === 'intro') {
    this.showTitle();
    return;
  }
  if (this.screen === 'summary') {
    this.history = [];
    this.open('pause', { replace: true });
    return;
  }
  const previous = this.history.pop();
  if (previous) {
    restoreView(this, previous, false);
  } else {
    const world = this.hooks.world(),
      fallback =
        this.screen === 'pause'
          ? null
          : this.screen === 'chart' && world.day.phase !== 'planning'
            ? null
            : this.screen === 'instructions'
              ? null
              : 'pause';
    this.open(fallback, { replace: true });
  }
}

// Back walks visited menus to the title root. Forward reopens views only;
// transactions and gameplay are never replayed as navigation history.
export function back() {
  if (this.screen === 'layout' && this.layoutEditor?.requestCancel()) return;
  if (this.exitPending) return;
  if (this.input.capture || this.input.naming || ['exit', 'instructions'].includes(this.screen)) {
    previous.call(this);
    return;
  }
  if (['purchase', 'buyboat'].includes(this.screen)) {
    this.pendingPurchase = null;
    previous.call(this);
    return;
  }
  if (!this.started || !this.screen) return;
  const world = this.hooks.world();
  const settingsSubmenus = [
    'layout',
    'assists',
    'controller',
    'bindings',
    'ui-scale',
    'touch-options',
    'gameplay-speed',
  ];
  if (
    ['debug-time', 'debug-weather', 'debug-tide'].includes(this.screen) &&
    this.history.some((point) => point.screen === 'debug-mode' && validPoint(point, world))
  ) {
    this.history = this.history.filter((point) => point.screen !== 'debug-mode');
    this.forwardHistory = [];
    this.open('debug-mode', { replace: true });
    return;
  }
  if (
    settingsSubmenus.includes(this.screen) &&
    this.history.some((point) => point.screen === 'settings' && validPoint(point, world))
  ) {
    while (this.history.at(-1)?.screen !== 'settings') this.history.pop();
    const point = this.history.pop();
    this.forwardHistory = [];
    restoreView(this, point);
    return;
  }
  if (this.screen === 'settings') {
    this.forwardHistory = [];
    if (!['planning', 'complete'].includes(world.day.phase)) {
      this.history = [];
      this.input.suppress();
      this.open(null, { replace: true });
    } else previous.call(this);
    return;
  }
  if (this.screen === 'pause' || this.screen === 'intropause') {
    this.history = [];
    this.forwardHistory = [];
    this.input.suppress();
    this.open(
      world.day.phase === 'planning'
        ? 'harbour'
        : world.day.phase === 'complete'
          ? 'summary'
          : null,
      { replace: true },
    );
    return;
  }
  this.forwardHistory ??= [];
  this.forwardHistory.push(captureView(this));
  let point;
  while (this.history.length) {
    const candidate = this.history.pop();
    if (candidate.screen && !transient(candidate.screen) && validPoint(candidate, world)) {
      point = candidate;
      break;
    }
  }
  if (point) restoreView(this, point);
  else if (
    ['chart', 'knowledge', 'introchart', 'almanac'].includes(this.screen) &&
    !['planning', 'complete'].includes(world.day.phase)
  )
    this.open(null, { navigation: true });
  else if (['harbour', 'starter', 'intro'].includes(this.screen) || this.fromTitle)
    this.showTitle({ navigation: true });
  else {
    this.input.suppress();
    this.open(
      world.day.phase === 'planning'
        ? harbourScreen(world)
        : world.day.phase === 'complete'
          ? 'summary'
          : null,
      { navigation: true },
    );
  }
}
