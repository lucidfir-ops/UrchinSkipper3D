import { renderReturnChip } from './return-chip.js';
import { seaMessage, compactPickupSpeech } from './sea-messages.js';
import { updateTutorialSpeech } from './tutorial-speech.js';
import { recoveryStatus } from './diver-recovery.js';
import { diverMotion } from './diver-motion.js';
import { offloadWindow } from './offload.js';
import { renderKeyboardHelm } from './keyboard-helm.js';
import { setText, setMarkup } from './dom-view.js';
import { renderNitrogen } from './nitrogen-view.js';
import { bearing } from './math.js';
import { portrait } from './crew-portrait.js';
import { crewProfile } from './crew-roster.js';
import { diverSpec } from './crew.js';
import { fuelGauge, diverTelemetry } from './feedback-hud.js';

import { fuelStatus } from './preparation.js';

import { assist, gear, pickupTolerance } from './assists.js';
import { instrumentReadings, markBearing } from './knowledge.js';
import { soundingDepth } from './hazard-depth.js';

import { C } from './config.js';

import { boatDefinition, boatSpec } from './boats.js';
import { currentAt, seaLevel } from './world.js';

import {
  playState,
  diverVisual,
  throttleText,
  rudderText,
  interactionDiver,
} from './presentation.js';
import { allAboard, formatClock, latestDeparture, selectedGround, passageMinutes } from './day.js';

import { exitDistance } from './navigation.js';
import {
  dial,
  compass,
  commandGauge,
  instrumentContent,
  renderStandaloneInstruments,
} from './instruments.js';
const html = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const sentenceCase = (value) =>
  value
    .replace(/\b[A-Z][A-Z /+]+\b/g, (words) => words.toLowerCase())
    .replace(/^\w/, (c) => c.toUpperCase());

// The boat card is the fallback for independently hidden instruments. Keeping
// these checks tied to the options preserves both Custom and All Off layouts.
export function boatCardFallbacks(world, realistic) {
  const enabled = (key) => assist(world, key, realistic);
  return {
    speed: !enabled('speedGauge'),
    depth: !enabled('depthInstrument') && !enabled('sounder'),
    fuel: !enabled('fuelGauge'),
    // October 5 (feedback/10-5): deck load is read from the boat itself (ghost
    // outline, deck-full lamp, freeboard). The weight reading is the optional
    // Deck load gauge, off by default, not a boat-card fallback.
    load: false,
    condition: !enabled('hullGauge'),
    commands: !enabled('throttleGauge'),
  };
}

export function renderHud(scene, world, input, lockReason) {
  document.querySelector('#godmodeNotice').hidden =
    !world.career?.debugConditions?.godmode || !scene.playtest.started;
  renderStandaloneInstruments(scene.playtest, world);
  renderKeyboardHelm(scene.playtest, world);
  renderReturnChip(scene, world, input);
  const hud = document.querySelector('#hud'),
    message = document.querySelector('#message'),
    clock = document.querySelector('#clock');

  const ui = scene.playtest,
    b = world.boat,
    target = interactionDiver(world, ui.realistic),
    c = currentAt(world, b.x, b.y);
  const tolerance = pickupTolerance(world, ui.realistic),
    state = playState(world, lockReason, tolerance, target, ui.realistic);
  const waterSpeed = Math.hypot(b.vx - c.x, b.vy - c.y) * C.knotsPerMps,
    groundSpeed = Math.hypot(b.vx, b.vy) * C.knotsPerMps;
  const heading = ((((b.heading * 180) / Math.PI) % 360) + 360) % 360;
  const currentBearing = bearing(c.x, c.y),
    currentSpeed = Math.hypot(c.x, c.y);
  const hullHealth = b.hullHealth ?? 1,
    driveHealth = b.driveHealth ?? 1;
  const currentInfo = !assist(world, 'currentOverlay', ui.realistic, ui.debug)
    ? ''
    : `<div class="current-instrument"><span style="transform:rotate(${currentSpeed < 0.05 ? 0 : currentBearing}deg)">${currentSpeed < 0.05 ? '•' : '↑'}</span> Local current ${(currentSpeed * C.knotsPerMps).toFixed(1)} kn · ${currentSpeed < 0.05 ? 'near slack' : Math.round(currentBearing).toString().padStart(3, '0') + '°'}</div>`;
  const currentPanel = document.querySelector('#currentReadout');
  currentPanel.hidden = !currentInfo;
  if (currentInfo)
    setMarkup(
      currentPanel,
      instrumentContent(
        compass('CURRENT', currentBearing, `${(currentSpeed * C.knotsPerMps).toFixed(1)} kn`),
        currentInfo,
      ),
    );
  const fuel = fuelStatus(world);
  const fuelReadout = world.career ? fuelGauge(world, fuel) : '';
  hud.hidden = !assist(world, 'helmOverlay', ui.realistic);
  if (!hud.hidden) {
    const hudText = input.touchEnabled
      ? `<span>${heading.toFixed(0).padStart(3, '0')}° · ${waterSpeed.toFixed(1)}kn · ${Number(soundingDepth(world, b.x, b.y).toFixed(1))}m</span><span>Fuel ${b.fuel.toFixed(0)}L${fuel.level === 'normal' ? '' : ' · LOW'} · Hull ${Math.round(hullHealth * 100)}%</span><span>${!assist(world, 'exactLoad', ui.realistic) ? 'Read load from deck' : `Deck ${Math.round(world.catch)}/${boatSpec(world).capacity}lb`}${b.grounded ? ' · GROUNDED' : ''}${world.emergency ? ' · MEDICAL RETURN' : ''}</span><span>Drive ${Math.round(driveHealth * 100)}% · ${throttleText(b.throttle)} · Rudder ${rudderText(b.rudder)}</span>`
      : `<div class="instrument-label">${boatDefinition(b.configuration).name.toUpperCase()} · ${heading.toFixed(0).padStart(3, '0')}°</div><b>COMMANDED THROTTLE: ${throttleText(b.throttle)}</b><br><b>COMMANDED RUDDER: ${rudderText(b.rudder)}</b><div class="speed">Speed ${waterSpeed.toFixed(1)} kn <span>through water</span></div><span>${groundSpeed.toFixed(1)} kn over ground · Depth ${Math.max(0, soundingDepth(world, b.x, b.y)).toFixed(1)} m</span>${world.environment.model === 'spatial-v1' ? `<br><span>Tide ${seaLevel(world) >= 0 ? '+' : ''}${seaLevel(world).toFixed(1)} m · ${world.environment.tideRate >= 0 ? 'rising' : 'falling'}</span>` : ''}${fuelReadout}<br>${!assist(world, 'exactLoad', ui.realistic) ? 'Read load from deck' : `<strong class="deck-readout">Deck ${world.catch.toFixed(0)} / ${boatSpec(world).capacity} lb · Bags ${world.bags.length}</strong>`}${boatSpec(world).bowThrusterStrength || boatSpec(world).pivotRate ? `<br><span>Bow / docking thrust: ${Math.abs(b.thruster || 0) < 0.01 ? 'OFF' : (b.thruster < 0 ? 'PORT' : 'STARBOARD') + ' ' + Math.round(Math.abs(b.thruster) * 100) + '%'}</span>` : ''}${(b.driveHealth ?? 1) < 0.99 ? `<div class="drive-alert">${b.driveHealth <= 0 ? 'PROPULSION FAILED · Pause → Radio for rescue' : `Drive damaged · ${ui.realistic ? 'thrust / steering unreliable' : Math.round(b.driveHealth * 100) + '% health'}`}</div>` : ''}${hullHealth < 0.7 ? `<div class="drive-alert">${b.sinking ? 'VESSEL SINKING · Radio for rescue' : 'Hull damage · return for repairs'}</div>` : ''}${world.emergency && !world.emergency.mandatoryRescue ? `<div class="drive-alert">MEDICAL RETURN · ${world.divers.some((d) => d.condition === 'injured' && d.state !== 'ready') ? 'Bring injured diver aboard' : 'Return to harbour / radio for assistance'}</div>` : ''}${b.grounded ? '<div class="grounding">GROUNDED — reverse to deeper water; wait at sea for rising tide or Pause → Radio for paid tow</div>' : ''}`;
    const fallback = boatCardFallbacks(world, ui.realistic),
      readings = [
        fallback.speed ? `${waterSpeed.toFixed(1)} kn through water` : '',
        fallback.depth ? `${soundingDepth(world, b.x, b.y).toFixed(1)} m depth` : '',
        fallback.fuel
          ? `Fuel ${b.fuel.toFixed(0)} L${fuel.level === 'normal' ? '' : ' · Low'}`
          : '',
        fallback.condition
          ? `Hull ${Math.round(hullHealth * 100)}% · Drive ${Math.round(driveHealth * 100)}%`
          : '',
        fallback.load
          ? `Deck ${Math.round(world.catch).toLocaleString()} / ${boatSpec(world).capacity.toLocaleString()} lb`
          : '',
      ].filter(Boolean),
      commands = [
        fallback.commands
          ? `${sentenceCase(throttleText(b.throttle))} · Rudder ${rudderText(b.rudder).toLowerCase()}`
          : '',
        boatSpec(world).bowThrusterStrength ? `Bow ${Math.round((b.thruster || 0) * 100)}%` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      graphic = input.touchEnabled
        ? `<span class="boat-touch-heading">${heading.toFixed(0).padStart(3, '0')}° heading</span>${readings.map((text) => `<span>${text}</span>`).join('')}${commands ? `<span class="boat-touch-command">${commands}</span>` : ''}`
        : `<div class="boat-card"><div class="instrument-eyebrow">${html(boatDefinition(b.configuration).name)}</div><div class="boat-card-main">${compass('HDG', heading, `${heading.toFixed(0).padStart(3, '0')}°`)}<div class="boat-card-readings">${!fallback.speed ? `<span class="boat-heading"><b>${heading.toFixed(0).padStart(3, '0')}°</b> <small>heading</small></span>` : ''}${readings.map((text) => `<span>${text}</span>`).join('')}</div></div>${commands ? `<div class="boat-command">${commands}</div>` : ''}</div>`;
    const hudMarkup = instrumentContent(graphic, hudText);
    if (scene.lastHud !== hudMarkup) {
      const alerts =
        hudText.match(/<div class="(?:drive-alert|grounding)">.*?<\/div>/g)?.join('') || '';
      hud.innerHTML = instrumentContent(graphic + (!input.touchEnabled ? alerts : ''), hudText);
      scene.lastHud = hudMarkup;
    }
  }
  const speedPanel = document.querySelector('#speedPanel'),
    throttlePanel = document.querySelector('#throttlePanel'),
    fuelPanel = document.querySelector('#fuelPanel');
  speedPanel.hidden = !assist(world, 'speedGauge', ui.realistic);
  throttlePanel.hidden = !assist(world, 'throttleGauge', ui.realistic);
  fuelPanel.hidden = !assist(world, 'fuelGauge', ui.realistic);
  if (!speedPanel.hidden)
    setMarkup(
      speedPanel,
      instrumentContent(
        dial(
          'SPEED',
          `${waterSpeed.toFixed(1)} kn`,
          waterSpeed / (boatSpec(world).maxSpeed * C.knotsPerMps),
          '0',
          `${Math.round(boatSpec(world).maxSpeed * C.knotsPerMps)}`,
        ),
        `<strong>SPEED</strong><output>${waterSpeed.toFixed(1)} kn</output><small>${groundSpeed.toFixed(1)} kn over ground</small>`,
      ),
    );
  if (!throttlePanel.hidden)
    setMarkup(
      throttlePanel,
      instrumentContent(
        commandGauge(b.throttle, b.rudder),
        `<strong>COMMANDS</strong><output>${throttleText(b.throttle)}</output><small>Rudder ${rudderText(b.rudder)}</small>`,
      ),
    );
  if (!fuelPanel.hidden)
    setMarkup(
      fuelPanel,
      instrumentContent(
        dial(
          'FUEL',
          `${b.fuel.toFixed(0)} L`,
          b.fuel / boatSpec(world).fuelCapacity,
          'E',
          'F',
          fuel.level !== 'normal',
        ),
        `<strong>FUEL</strong><output>${b.fuel.toFixed(0)} L</output><small>${fuel.level === 'normal' ? fuel.text : fuel.text + ' · ' + fuel.detail}</small>`,
      ),
    );
  fuelPanel.classList.toggle('warn', fuel.level !== 'normal');
  fuelPanel.classList.toggle('danger', fuel.level === 'danger');
  clock.hidden = !assist(world, 'clockOverlay', ui.realistic);
  message.hidden = !assist(world, 'actionPrompts', ui.realistic);
  const ground = selectedGround(world),
    depart = latestDeparture(world),
    working = world.day.phase === 'working',
    clockText =
      world.day.phase === 'practice'
        ? world.career?.intro?.status === 'active'
          ? '<b>DAY 0</b><span>Frank’s cove · take your time</span>'
          : '<b>PRACTICE</b><span>No day deadline</span>'
        : `<b>${formatClock(world.day.minute)}</b><span>${world.day.phase === 'complete' ? 'At harbour' : ground?.name || 'Choose a working area'}</span><span>${working && world.day.minute > depart ? `Late landing · ships ${formatClock(offloadWindow(world.day.minute + passageMinutes(world, ground)))}` : `Offload ${formatClock(C.day.deadlineMinute)}${working ? ` · Leave ${formatClock(depart)}` : ''}`}</span>`;
  if (!clock.hidden) setMarkup(clock, clockText);
  clock.className =
    working && world.day.minute > depart
      ? 'late'
      : working && depart - world.day.minute <= C.day.warningMinutes
        ? 'soon'
        : '';
  const navigation = document.querySelector('#navigation');
  navigation.hidden = !working || !assist(world, 'departureGuidance', ui.realistic);
  if (working && !navigation.hidden) {
    const exit = world.day.returnExit;
    const mark = world.career?.marks.find(
      (m) => m.id === world.career.navigationMark && m.sector === world.day.groundId,
    );
    setMarkup(
      navigation,
      `<span style="transform:rotate(${exit.bearing}deg)">↑</span><div>HARBOUR EXIT · ${exit.label}<small>${Math.round(exitDistance(world))} m to boundary · ${passageMinutes(world, ground)} min home${allAboard(world) ? '' : ' · recover both divers'}</small>${mark ? `<small>★ ${mark.label} · ${markBearing(world, mark)}</small>` : ''}</div>`,
    );
  }
  let tideButton = document.querySelector('#openAlmanac');
  if (!tideButton) {
    tideButton = document.createElement('button');
    tideButton.id = 'openAlmanac';
    setText(tideButton, 'Tide & current almanac');
    tideButton.onclick = () => ui.open('almanac');
    const panel = document.createElement('aside');
    panel.id = 'almanacPanel';
    panel.append(tideButton);
    document.body.append(panel);
  }
  document.querySelector('#almanacPanel').hidden =
    !ui.started || !!ui.screen || !assist(world, 'almanacShortcut', ui.realistic);
  const indicators = assist(world, 'diverIndicators', ui.realistic, ui.debug),
    portraits = assist(world, 'diverPortraits', ui.realistic, ui.debug),
    diverPanel = document.querySelector('#divers');
  diverPanel.hidden = !assist(world, 'diverCards', ui.realistic) || (!indicators && !portraits);
  document.querySelector('#diverPanel').hidden = diverPanel.hidden;
  diverPanel.classList.toggle('portrait-only', !indicators);
  world.divers.forEach((d, id) => {
    if (diverPanel.hidden) return;
    const button = scene.diverButtons[id],
      person = { ...crewProfile(world.career, d.crewId), name: d.name },
      selected = d.id === world.selectedDiverId;
    if (!indicators) {
      // Realistic selectors communicate identity and selection only. Their
      // appearance never encodes a diver's hidden underwater state.
      setMarkup(
        button,
        `<span class="diver-identity">${portrait(person)}<span><b>${html(d.name)}</b><small>${selected ? 'Selected diver' : 'Select diver'}</small></span></span>`,
      );
      button.className = selected ? 'selected' : '';
      button.setAttribute('aria-label', `Select ${d.name}`);
      button.setAttribute('aria-pressed', String(selected));
      return;
    }
    const motion = diverMotion(world, d),
      phaseLabel = {
        preparing: 'Checking kit',
        entering: 'Entering water',
        descending: 'Descending',
        ascending: 'Ascending',
        approaching: 'Swimming to ladder',
        hauling: 'Hauling bag',
        boarding: 'Climbing aboard',
      }[motion.phase],
      status =
        d.condition === 'deceased'
          ? 'Fatality'
          : d.condition === 'injured'
            ? d.state === 'ready'
              ? 'Injured · aboard'
              : 'Injured · waiting'
            : phaseLabel ||
              (d.state === 'ready'
                ? 'Aboard'
                : d.state === 'surface'
                  ? d.bagHandled
                    ? 'Bag aboard · waiting'
                    : 'Float waiting'
                  : d.state[0].toUpperCase() + d.state.slice(1)),
      exact = assist(world, 'exactLoad', ui.realistic),
      air = Math.round((d.air / (diverSpec(d).tankAir || 100)) * 100),
      detail = exact
        ? input.touchEnabled
          ? `Air ${air}% · Bag ${Math.round(d.bag)} lb`
          : `${world.career && d.condition === 'fit' ? Math.round((d.fatigue || 0) * 100) + '% tired · ' : ''}${diverTelemetry(world, d).split(' · ').slice(2).join(' · ')}`
        : '',
      content = `<span class="diver-identity">${portrait(person)}<span><b>${html(d.name)}</b><small>${html(status)}</small></span><span class="diver-selection-mark" aria-hidden="true">${selected ? '●' : '○'}</span></span>${exact && !input.touchEnabled ? `<span class="diver-detail instrument-text">Air ${air}% · Bag ${Math.round(d.bag)} / 300 lb</span>` : ''}<span class="diver-detail">${html(detail)}${d.swimmingClear ? ' · Swimming clear' : ''}</span>`;
    let identity = button.querySelector('.diver-card-content');
    if (!identity) {
      button.replaceChildren();
      identity = document.createElement('span');
      identity.className = 'diver-card-content';
      button.append(identity);
    }
    setMarkup(identity, content);
    // Compact cards show readiness. Exact loading and reference-depth details
    // remain available in the diver's full record, as the design requires.
    renderNitrogen(button, world, d, exact, true);
    let meters = button.querySelector('.diver-meters');
    if (!meters) {
      meters = document.createElement('span');
      meters.className = 'diver-meters instrument-graphic';
      button.append(meters);
    }
    meters.hidden = !exact || input.touchEnabled;
    if (!meters.hidden)
      setMarkup(
        meters,
        `<label><span>Air <b>${air}%</b></span><meter aria-label="${html(d.name)} air remaining" min="0" max="100" low="20" optimum="100" value="${air}"></meter></label><label><span>Bag <b>${Math.round(d.bag)} lb</b></span><meter aria-label="${html(d.name)} bag load" min="0" max="300" value="${Math.round(d.bag)}"></meter></label>`,
      );
    button.setAttribute('aria-label', `Select ${d.name}, ${status}`);
    button.className = selected ? 'selected' : '';
    button.setAttribute('aria-pressed', String(selected));
  });
  if (world.time >= (scene.nextPanelCheck || 0)) {
    scene.nextPanelCheck = world.time + 0.2;
    const points = world.divers
      .filter((d) => d.state === 'surface' || d.state === 'surfacing')
      .map((d) => scene.view.project(d.x, d.y));
    for (const id of [
      'electronics',
      'groundLegend',
      'testMap',
      'testInfo',
      'actionFeedback',
      'minimapPanel',
      'sounderPanel',
    ]) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      el.style.opacity = points.some(
        (p) => p.x > r.left - 25 && p.x < r.right + 25 && p.y > r.top - 40 && p.y < r.bottom + 25,
      )
        ? '.18'
        : '';
    }
  }
  message.className = state.locked ? 'locked' : state.available ? 'available' : '';
  // Console lamps on touch buttons follow the same entitled action prompts.
  const lamps = assist(world, 'actionPrompts', ui.realistic)
    ? new Set(state.actions?.map((a) => a.action))
    : new Set();
  for (const button of document.querySelectorAll('#touchControls .touch-actions [data-touch]')) {
    const ready = lamps.has(button.dataset.touch) ? 'true' : 'false';
    if (button.dataset.ready !== ready) button.dataset.ready = ready;
  }
  const notice = ui.importantNotice?.until > performance.now() ? ui.importantNotice.text : '';
  updateTutorialSpeech(ui, world, state, target, notice);
  if (world.career?.intro?.status === 'active') message.hidden = true;
  const activeContext =
    (diverVisual(target).surface && state.observable) ||
    state.progress !== null ||
    !!notice ||
    state.locked;
  ui.hudMessageActive = activeContext && world.career?.intro?.status !== 'active';
  ui.hudMessageTargetPoint =
    diverVisual(target).surface && state.observable ? scene.view.project(target.x, target.y) : null;
  ui.hudMessageCompact =
    ui.hudMessageActive &&
    state.progress === null &&
    state.controls === 'BOAT CONTROLS AVAILABLE' &&
    !state.reason &&
    !notice;
  if (world.career?.intro?.status !== 'active' && assist(world, 'actionPrompts', ui.realistic)) {
    const actionable = activeContext && target.state !== 'ready';
    const recoveryReason = recoveryStatus(world, tolerance, target).reason;
    const key = JSON.stringify([
      actionable,
      target.id,
      state.reason,
      recoveryReason,
      state.operation,
      state.available,
      state.locked,
      notice,
      state.progress !== null,
    ]);
    const firstName = target.name.split(' ')[0],
      speechName =
        world.divers.filter((d) => d.name.split(' ')[0] === firstName).length === 1
          ? firstName
          : target.name,
      compactText =
        !notice &&
        actionable &&
        state.observable &&
        !state.locked &&
        state.progress === null &&
        target.condition === 'fit' &&
        !target.hooking &&
        !target.recoveryPause &&
        !world.day.dump
          ? compactPickupSpeech(speechName, recoveryReason, target.reason)
          : '';
    seaMessage(
      ui,
      'pickup',
      key,
      notice || (actionable ? `${target.name} · ${state.status.replace(/ — [\d.]+s/, '')}` : ''),
      2.6,
      compactText,
    );
  }
  // The full context remains available through the controls and diver cards.
  message.hidden = true;
  ui.hudMessageActive = false;
  message.dataset.context = ui.hudMessageActive ? 'active' : 'quiet';
  message.dataset.density = ui.hudMessageCompact ? 'compact' : 'full';
  let instruments = document.querySelector('#electronics');
  let patrol = document.querySelector('#patrolBearing');
  if (!patrol) {
    patrol = document.createElement('button');
    patrol.type = 'button';
    patrol.onclick = () => ui.open('patrol');
    patrol.setAttribute('aria-label', 'Answer DFO radio call');
    patrol.id = 'patrolBearing';
    document.body.append(patrol);
  }
  const inspector = world.traffic?.actors.find((a) => a.id === world.day.inspection?.actorId);
  patrol.hidden =
    !inspector || !ui.started || !!ui.screen || world.day.inspection?.status === 'cleared';
  if (!patrol.hidden) {
    const dx = inspector.x - b.x,
      dy = inspector.y - b.y;
    setMarkup(
      patrol,
      `<span style="transform:rotate(${bearing(dx, dy)}deg)">↑</span><div>DFO · ${world.day.inspection.status === 'boarding' ? 'OFFICER ABOARD' : Math.round(Math.hypot(dx, dy)) + ' m'}<small>${world.day.inspection.status === 'boarding' ? 'Inspection underway' : world.day.inspection.status === 'calling' ? 'ANSWER RADIO CALL' : 'Coming alongside · hold position'}</small></div>`,
    );
  }
  if (!instruments) {
    instruments = document.createElement('div');
    instruments.id = 'electronics';
    document.body.append(instruments);
  }
  const showWeather = assist(world, 'weatherOverlay', ui.realistic),
    showElectronics = showWeather && (gear(world, 'radar') || gear(world, 'scanner'));
  instruments.hidden =
    !world.career || !ui.started || !!ui.screen || (!showWeather && !showElectronics);
  if (!instruments.hidden && world.career && world.weather) {
    const r = instrumentReadings(world),
      weather = world.weather;
    const weatherText =
      (showWeather
        ? `${weather.name} · ${weather.wind.toFixed(0)} kn wind · ${weather.wave.toFixed(1)} m sea${weather.night ? ' · NIGHT' : ''}`
        : '') +
      (showElectronics && gear(world, 'radar')
        ? `\nRADAR · ${
            r.radar.length
              ? r.radar
                  .slice(0, 2)
                  .map((c) => Math.round(c.bearing) + '° / ' + Math.round(c.distance) + ' m')
                  .join(' · ')
              : 'No nearby surface returns'
          }`
        : '') +
      (showElectronics && gear(world, 'scanner')
        ? `\nSCANNER · Ahead ${r.scanner
            .filter((_, i) => i >= 3 && i < 6)
            .map((c) => c.depth.toFixed(1) + ' m')
            .join(' / ')}`
        : '');
    setMarkup(
      instruments,
      instrumentContent(
        `<div class="weather-instrument"><strong>${weather.night ? '☾' : weather.rain > 0.2 ? '☂' : '☀'} ${weather.name}</strong><div>↝ ${weather.wind.toFixed(0)} kn · ≋ ${weather.wave.toFixed(1)} m</div><meter min="0" max="4" value="${weather.wave}"></meter>${showElectronics ? `<small>${weatherText.split('\n').slice(1).join('<br>')}</small>` : ''}</div>`,
        weatherText,
      ),
    );
  }
  const hint = document.querySelector('#audioHint');
  hint.hidden = !ui.started || !scene.audio.needsGesture;
  hint.onclick = () => scene.audio.unlock();
}
