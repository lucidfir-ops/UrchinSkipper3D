import { skipperPortrait } from './patrol-view.js';
import { canForward } from './screen-navigation.js';
import { setText } from './dom-view.js';
import { isRadioMessage } from './radio-history.js';
import { TITLES } from './screen-titles.js';
import { decorateBindings } from './controller-view.js';
import { patrolBriefing } from './fishery.js';

import { EXPEDITION_SCREENS, renderExpedition } from './career-chart.js';
import { assist, pickupTolerance, presetLabel } from './assists.js';
import { frankAdvice } from './frank-advice.js';
import { INTRO_SCREENS, renderIntro } from './intro-view.js';
import { CAREER_SCREENS, renderCareer } from './career-ui.js';

import { renderAlmanac } from './almanac-view.js';
import { renderBoatyard } from './boatyard-view.js';
import { SHOP_SCREENS } from './shop-actions.js';
import { LABELS } from './input.js';
import { C } from './config.js';
import { playState, interactionDiver } from './presentation.js';

import { compassMarkup } from './compass.js';
import { formatClock } from './day.js';
import { renderDayScreen } from './day-view.js';
import { chartMode } from './chart-presentation.js';
import { layoutEditor } from './layout-editor.js';
import { renderTouchOptions } from './touch-options.js';

export function renderOrders(world, bind) {
  const d = this.draft,
    signature = JSON.stringify([
      d.direction,
      Math.round(d.angle * 10),
      d.quality,
      d.searchLimit,
      d.maxBagSeconds,
      d.diverId,
      this.input.lastDevice,
    ]);
  if (signature === this.signature) return;
  this.signature = signature;
  this.panel.innerHTML = `<h2>DIVER ${d.diverId + 1} · SEARCH ORDERS</h2><div class="orders-layout"><div class="compass">${compassMarkup(d)}</div><div class="orders-help"><p>Point the left stick, or use arrow keys.<br>Centre the stick for no preference.</p><p>Minimum quality <strong>${d.quality ? Math.round(d.quality * 100) + '%' : 'Any'}</strong><br>${this.qualityControls.map(bind).join(' / ')} changes quality.</p><p>Hold ${bind('instructions')}, point, then release to apply.<br>Or tap to open and press ${bind('confirm')} to apply.</p><div class="order-quality"><button data-order="quality-less">Quality −</button><button data-order="quality-more">Quality +</button></div><button data-order="search">${bind('zoomIn')} · Search: ${d.searchLimit ? d.searchLimit + ' seconds' : 'until air reserve'}</button><button data-order="bag">${bind('zoomOut')} · Maximum bag time: ${d.maxBagSeconds ? d.maxBagSeconds + ' seconds' : 'Any speed'}</button><p>Bag time starts when picking begins. Slow picking brings up a partial bag and a report.</p><p>No preference chooses a new, gently varying heading each dive. The limit counts searching, not picking.</p><button data-order="apply">${bind('confirm')} · Apply orders</button><button data-order="clear">${bind('work')} · No preference</button><button data-order="cancel">${bind('back')} · Cancel</button></div></div>`;
  for (const [id, delta] of [
    ['quality-less', -1],
    ['quality-more', 1],
  ])
    this.panel.querySelector(`[data-order=${id}]`).onclick = () => {
      d.changeQuality(delta);
      this.signature = null;
    };
  this.panel.querySelector('[data-order=bag]').onclick = () => {
    d.changeBagLimit();
    this.signature = null;
  };
  this.panel.querySelector('[data-order=search]').onclick = () => {
    d.changeSearchLimit();
    this.signature = null;
  };
  this.panel.querySelector('[data-order=apply]').onclick = () => this.applyOrders(world);
  this.panel.querySelector('[data-order=clear]').onclick = () => {
    d.clear();
    this.signature = null;
  };
  this.panel.querySelector('[data-order=cancel]').onclick = () => this.back();
  const svg = this.panel.querySelector('svg');
  svg.onpointerdown = (e) => {
    const r = svg.getBoundingClientRect();
    this.pointerOrders = true;
    d.point(
      (e.clientX - r.left - r.width / 2) / (r.width / 2),
      (e.clientY - r.top - r.height / 2) / (r.height / 2),
    );
    this.signature = null;
  };
}
export function render(world) {
  if (world.career) this.realistic = !world.career.assists.exactLoad;
  const i = this.input,
    bind = (k) => i.label(k),
    device = i.lastDevice || (i.connected ? 'gamepad' : 'keyboard');
  const inputKey = `${device}|${i.profileKey}|${i.revision}|${i.keyboardMode}`;
  if (inputKey !== this.inputPresentationKey) {
    this.inputPresentationKey = inputKey;
    this.signature = null;
  }
  const target = interactionDiver(world, this.realistic),
    state = playState(
      world,
      this.lockReason,
      pickupTolerance(world, this.realistic),
      target,
      this.realistic,
    );
  const tideHint = bind('almanac') === 'Unbound' ? 'Pause → Tides' : bind('almanac') + ' Tides';
  const actions = (assist(world, 'actionPrompts', this.realistic) ? state.actions : [])
    .map(
      (a) =>
        `${device === 'gamepad' && a.text === 'Deploy Diver' ? 'X:' : bind(a.action) + ' —'} ${a.text}${!this.realistic ? ' · D' + (a.diverId + 1) : ''}`,
    )
    .join('   |   ');
  setText(
    document.querySelector('#help'),
    `${world.career ? actions || `${bind('work')} Bag work · ${bind('recoverDiver')} Deploy / board · ${bind('recall')} Recall nearby` : `${i.deviceLabel.toUpperCase()} · ${actions || 'Read bubbles / maneuver alongside'}`}\n${bind('cycleDiver')} Select diver · ${bind('instructions')} Orders · ${bind('assists')} Assists · ${bind('chart')} Chart · ${tideHint} · ${bind('pause')} Menu\n${bind('fullAhead')} Ahead · ${bind('fullReverse')} Reverse · ${bind('neutral')} Neutral · ${bind('zoomIn')} / ${bind('zoomOut')} Zoom · ${bind('debug')} ${!world.career ? 'Reveal' : `Information · ${presetLabel(world.career.assists.preset)}`}`,
  );
  document.querySelector('#help').hidden = !assist(world, 'controlsHelp', this.realistic);
  document.querySelector('#touchMenu').hidden = !i.touchEnabled && i.lastDevice === 'gamepad';
  document.body.classList.toggle(
    'in-port',
    !!world.career && ['planning', 'complete'].includes(world.day.phase),
  );
  document.body.classList.toggle('sandbox', !!world.career?.sandbox);
  this.panel.classList.toggle('bindings-panel', this.screen === 'bindings');
  this.panel.dataset.screen = this.screen || '';
  this.panel.classList.toggle('layout-panel', this.screen === 'layout');
  this.panel.classList.toggle('intro-panel', INTRO_SCREENS.includes(this.screen));
  this.panel.classList.toggle('wharf-panel', this.screen === 'harbour');
  this.panel.classList.toggle('shop-panel', SHOP_SCREENS.includes(this.screen));
  this.panel.classList.toggle('workshop-panel', this.screen === 'workshop');
  this.panel.classList.toggle('save-art-panel', ['archives', 'logbook'].includes(this.screen));
  const chartScreen = ['chart', 'departure', 'knowledge'].includes(this.screen);
  this.panel.classList.toggle('chart-raster-mode', chartScreen && chartMode(this) === 'raster');
  this.panel.classList.toggle('chart-vector-mode', chartScreen && chartMode(this) === 'vector');
  this.panel.hidden = !this.screen;
  this.panel.classList.toggle('orders-panel', this.screen === 'instructions');
  this.panel.classList.toggle(
    'day-panel',
    [
      'chart',
      'departure',
      'summary',
      'boatyard',
      'almanac',
      'touch-options',
      ...CAREER_SCREENS,
      ...EXPEDITION_SCREENS,
    ].includes(this.screen),
  );
  if (this.screen === 'layout') layoutEditor(this).render(world);
  else if (this.screen === 'touch-options') renderTouchOptions(this, world);
  else if (INTRO_SCREENS.includes(this.screen)) renderIntro(this, world);
  else if (world.career && EXPEDITION_SCREENS.includes(this.screen))
    renderExpedition(this, world, bind);
  else if (world.career && CAREER_SCREENS.includes(this.screen)) renderCareer(this, world, bind);
  else if (this.screen === 'almanac') renderAlmanac(this, world, bind);
  else if (this.screen === 'boatyard') renderBoatyard(this, world, bind);
  else if (this.screen === 'instructions') this.renderOrders(world, bind);
  else if (['chart', 'departure', 'summary'].includes(this.screen))
    renderDayScreen(this, world, bind);
  else if (this.screen) {
    let info = `${bind('menuUp')} / ${bind('menuDown')} or left stick: navigate · ${bind('confirm')} Select · ${bind('back')} Back. Simulation paused.`;
    if (this.screen === 'bindings')
      info = `Choose Keyboard, Controller or Steam Deck above the diagram. ${bind('menuLeft')} / ${bind('menuRight')} switches view. Select an action to remap it. Escape returns to ${world.day.phase === 'planning' ? 'harbour' : world.day.phase === 'complete' ? 'the offload receipt' : 'the water'}.`;
    if (i.capture)
      info = `${world.career ? LABELS[i.capture.action].replace(' / pause', '') : LABELS[i.capture.action]} — ${i.capture.waitRelease ? 'RELEASE ALL CONTROLS' : 'PRESS A BUTTON OR MOVE ONE STICK'} · ${Math.ceil(i.capture.remaining)}s · ${bind('back')} Cancel`;
    if (this.screen === 'controller')
      info =
        `Active input: ${i.deviceLabel}. ${i.needsMapping ? 'Unrecognized raw layout: gameplay inputs must be mapped explicitly. ' : ''}` +
        'Keep Steam running. In the shortcut’s Steam controller layout choose a Gamepad template. Launch this shortcut from Steam’s Desktop library to keep its per-game layout active. USB Xbox remains supported. Steam may expose a virtual Xbox controller or keyboard keys; desktop shortcuts and paddles are controlled by Steam/KDE, outside the browser. Verify X/Y to bind their actions; naming alone only changes labels.';
    if (i.naming)
      info = `${i.naming.waitRelease ? 'Release every button, then press' : 'Press'} physical ${(i.naming.recoveryOnly ? ['X', 'Y'] : ['A', 'B', 'X', 'Y'])[i.naming.index]} · ${Math.ceil(i.naming.remaining)}s · Escape cancels. ${i.naming.recoveryOnly ? 'X will handle bags / send down; Y will board.' : 'Gameplay bindings will stay unchanged.'}`;
    if (this.screen === 'help')
      info = `Sticks adjust persistent throttle and rudder. Release holds the command. Bring the orange float to PORT and match its drift (below ${(C.recovery.maxRelativeSpeed * C.knotsPerMps).toFixed(1)} kn relative to the float). ${bind('recoverDiver')} deploys from deck or boards diver + bag. ${bind('work')} takes and replaces one diver’s bag with one press. They return to work if ready, or explain the refusal in a bubble. ${bind('recall')} recalls underwater bubbles within 5 m after a 2–5 second response and clang. Keep clear of the hull: striking a surfaced diver can injure or kill them. ${bind('cycleDiver')} selects the other diver for deployment and orders; nearby pickup is automatic. ${bind('instructions')} opens compass orders. Both divers need to be aboard before travel. Drive across the marked harbour-facing sector boundary to return. The chart shows when to leave for the ${formatClock(C.day.deadlineMinute)} offload. Bag work and boarding choose the nearest eligible port-side float. All Off hides optional telemetry. Bubbles are the only underwater representation. Menus pause the game.${!world.career || world.career.sandbox ? ' Developer reveal is available separately through test settings.' : ''}`;
    if (this.screen === 'radio')
      info =
        (world.career?.radioLog || this.radioLog || [])
          .filter((r) => isRadioMessage(r.text))
          .slice()
          .reverse()
          .map((m) => `Day ${m.day} · ${formatClock(m.minute)} — ${m.text}`)
          .join('\n\n') || 'No radio messages yet.';
    if (this.screen === 'patrol') info = patrolBriefing(world);
    if (this.screen === 'help' && world.career) info = frankAdvice(world, bind);
    if (this.screen === 'emergency')
      info = `${world.emergency.reason}. Fishing has ended. Radio for emergency assistance; the harbour report will retain the vessel and crew outcomes.`;
    if (this.screen === 'debug-mode')
      info = `${world.career?.sandbox ? 'This is the isolated Test Mode career; your real career remains unchanged and is not saved.' : 'Changes affect this career save and mark the trip as ASSISTED PLAYTEST.'} Time controls run the live simulation forward: boat, divers, fatigue, catch, traffic, weather, tide, inspections and deadlines continue together.`;
    if (this.screen === 'debug-time')
      info =
        'Choose a later clock time. The live simulation advances to it; past times are unavailable because rewinding the clock cannot rewind catch, crew or safety history.';
    if (this.screen === 'debug-weather')
      info =
        'Force one weather state for the live view, vessel and forecast, or restore the natural forecast.';
    if (this.screen === 'debug-tide')
      info =
        'Hold a tide height for depth, rocks and grounding, or restore the natural tide. Current remains a separate dimension and continues naturally.';
    if (this.screen === 'exit') info = this.exitNote || 'SESSION ENDED';
    if (this.screen === 'bindings' && i.notice) info += ` ${i.notice}`;
    if (this.menuNotice) info += `\n${this.menuNotice}`;
    const choices = this.choices(world),
      signature = JSON.stringify([this.screen, choices, this.index, info, this.bindingView]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.panel.replaceChildren();
      const h = document.createElement('h2');
      setText(
        h,
        this.screen === 'pause' && world.day.phase === 'complete'
          ? 'HARBOUR / TRIP COMPLETE'
          : TITLES[this.screen],
      );
      this.panel.append(h);
      if (this.screen === 'patrol') {
        const face = document.createElement('div');
        face.className = 'patrol-portrait';
        face.innerHTML = skipperPortrait(world);
        this.panel.append(face);
      }
      if (this.screen === 'help' && world.career) {
        const portrait = document.createElement('img');
        portrait.src = './assets/harbour/frank-v1.png';
        portrait.className = 'frank-portrait';
        portrait.alt = 'Frank, the old fisherman on the wharf';
        this.panel.append(portrait);
      }
      const p = document.createElement('p');
      setText(p, info);
      if (this.screen === 'radio') p.className = 'radio-history';
      this.panel.append(p);
      if (this.screen === 'help' && world.career) {
        const lesson = document.createElement('div');
        lesson.className = 'frank-lesson';
        lesson.append(this.panel.querySelector('.frank-portrait'), p);
        this.panel.append(lesson);
      }
      const body = document.createElement('div');
      body.className = this.screen === 'chart' ? 'chart-layout' : 'menu-body';
      this.panel.append(body);

      const list = document.createElement('div');
      list.className = 'choices';
      body.append(list);
      choices.forEach((label, index) => {
        const button = document.createElement('button');
        button.dataset.choiceIndex = String(index);
        setText(button, label);
        button.className = index === this.index ? 'selected' : '';
        button.setAttribute('aria-current', index === this.index ? 'true' : 'false');
        button.onclick = () => {
          if (i.naming) return;
          if (i.capture) {
            i.capture = null;
            i.suppress();
            i.notice = 'REBIND CANCELLED';
          } else {
            this.index = index;
            this.activate(this.hooks.world());
          }
          this.signature = null;
        };
        list.append(button);
      });
      if (this.screen === 'bindings') decorateBindings(this, world);
      const selected = list.querySelector('.selected');
      if (selected) {
        list.scrollTop = Math.max(
          0,
          selected.offsetTop - list.offsetTop - list.clientHeight + selected.offsetHeight + 8,
        );
      }
    }
  }
  if (this.screen && this.screen !== 'emergency') {
    const choices = this.choices(world),
      backIndex = choices.findIndex((x) => /^Back( |$)/.test(x));
    this.panel.querySelectorAll('[data-choice-index]').forEach((b) => {
      if (Number(b.dataset.choiceIndex) === backIndex) b.hidden = true;
    });
    let back = this.panel.querySelector('.screen-back');
    if (!back) {
      back = document.createElement('button');
      back.className = 'screen-back';
      setText(back, this.screen === 'exit' ? '← Cancel' : '← Back');
      back.setAttribute(
        'aria-label',
        this.screen === 'exit' ? 'Cancel exit' : 'Back to previous menu',
      );
      back.onclick = () => this.back();
      const navigation = document.createElement('span');
      navigation.className = 'screen-navigation';
      navigation.append(back);
      this.panel.querySelector('h2')?.prepend(navigation);
      const forward = document.createElement('button');
      forward.className = 'screen-forward';
      forward.textContent = '→';
      forward.dataset.choiceIndex = '-2';
      forward.setAttribute('aria-label', 'Forward to next menu');
      forward.title = 'Forward to next menu';
      forward.onclick = () => this.forward();
      back.after(forward);
    }
    this.panel.querySelector('.screen-forward').disabled = !canForward.call(this);
    back.hidden = false;
    back.dataset.choiceIndex = String(backIndex >= 0 ? backIndex : -1);
    for (const b of this.panel.querySelectorAll('[data-choice-index]')) {
      const selected = Number(b.dataset.choiceIndex) === this.index && !b.hidden && !b.disabled;
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-current', String(selected));
      if (selected && this.focusedButton !== b) {
        b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        this.focusedButton = b;
      }
    }
  }
  // Touch menus scroll as a whole page; never rewind the player's swipe.
  if (!i.touchEnabled && !INTRO_SCREENS.includes(this.screen) && this.screen !== 'harbour') {
    this.panel.scrollTop = 0;
    this.panel.scrollLeft = 0;
  }
  if (this.pendingScroll) {
    this.panel.scrollTop = this.pendingScroll.top;
    this.panel.scrollLeft = this.pendingScroll.left;
    this.pendingScroll = null;
  }
  this.diag.hidden = !this.diagnostics;
  if (this.diagnostics) {
    const pads = i.pads
      .map(
        (p) =>
          `${p.id} [${p.mapping || 'non-standard'}]\nAxes ${p.axes.map((v, n) => `${n}:${v.toFixed(2)}`).join(' ')}\nButtons ${p.buttons.map((b, n) => `${n}:${b.value.toFixed(2)}`).join(' ')}`,
      )
      .join('\n');
    setText(
      this.diag,
      `CONTROLLER DIAGNOSTICS · ${bind('diagnostics')} Hide\nActive ${i.activePad?.id || 'NONE'} · Focus ${document.hasFocus()} · Secure context ${window.isSecureContext}\n${pads || 'Browser exposes no gamepad. Steam layout may be sending keyboard/mouse.'}${i.deviceError ? '\nGamepad access error: ' + i.deviceError : ''}\nKeys ${[...i.keys].join(' ') || 'none'}\nActions ${
        Object.entries(i.raw)
          .filter(([, v]) => v > 0.1)
          .map(([k, v]) => `${k}:${v.toFixed(2)}`)
          .join(' ') || 'none'
      }\nLast raw presses ${i.lastButtons || 'none'}\nInput consumer ${this.lockReason || 'GAMEPLAY'}`,
    );
  }
}
