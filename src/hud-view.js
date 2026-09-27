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
export function renderHud(scene, world, input, lockReason) {
  document.querySelector('#godmodeNotice').hidden =
    !world.career?.debugConditions?.godmode || !scene.playtest.started;
  renderStandaloneInstruments(scene.playtest, world);
  renderKeyboardHelm(scene.playtest, world);
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
      ? `<span>${heading.toFixed(0).padStart(3, '0')}° · ${waterSpeed.toFixed(1)}kn · ${Number(soundingDepth(world, b.x, b.y).toFixed(1))}m</span><span>Fuel ${b.fuel.toFixed(0)}L${fuel.level === 'normal' ? '' : ' · LOW'} · Hull ${Math.round(hullHealth * 100)}%</span><span>${ui.realistic ? 'Read load from deck' : `Deck ${Math.round(world.catch)}/${boatSpec(world).capacity}lb`}${b.grounded ? ' · GROUNDED' : ''}${world.emergency ? ' · MEDICAL RETURN' : ''}</span><span>Drive ${Math.round(driveHealth * 100)}% · ${throttleText(b.throttle)} · Rudder ${rudderText(b.rudder)}</span>`
      : `<div class="instrument-label">${boatDefinition(b.configuration).name.toUpperCase()} · ${heading.toFixed(0).padStart(3, '0')}°</div><b>COMMANDED THROTTLE: ${throttleText(b.throttle)}</b><br><b>COMMANDED RUDDER: ${rudderText(b.rudder)}</b><div class="speed">Speed ${waterSpeed.toFixed(1)} kn <span>through water</span></div><span>${groundSpeed.toFixed(1)} kn over ground · Depth ${Math.max(0, soundingDepth(world, b.x, b.y)).toFixed(1)} m</span>${world.environment.model === 'spatial-v1' ? `<br><span>Tide ${seaLevel(world) >= 0 ? '+' : ''}${seaLevel(world).toFixed(1)} m · ${world.environment.tideRate >= 0 ? 'rising' : 'falling'}</span>` : ''}${fuelReadout}<br>${ui.realistic ? 'Read load from deck' : `<strong class="deck-readout">Deck ${world.catch.toFixed(0)} / ${boatSpec(world).capacity} lb · Bags ${world.bags.length}</strong>`}${boatSpec(world).bowThrusterStrength || boatSpec(world).pivotRate ? `<br><span>Bow / docking thrust: ${Math.abs(b.thruster || 0) < 0.01 ? 'OFF' : (b.thruster < 0 ? 'PORT' : 'STARBOARD') + ' ' + Math.round(Math.abs(b.thruster) * 100) + '%'}</span>` : ''}${(b.driveHealth ?? 1) < 0.99 ? `<div class="drive-alert">${b.driveHealth <= 0 ? 'PROPULSION FAILED · Pause → Radio for rescue' : `Drive damaged · ${ui.realistic ? 'thrust / steering unreliable' : Math.round(b.driveHealth * 100) + '% health'}`}</div>` : ''}${hullHealth < 0.7 ? `<div class="drive-alert">${b.sinking ? 'VESSEL SINKING · Radio for rescue' : 'Hull damage · return for repairs'}</div>` : ''}${world.emergency && !world.emergency.mandatoryRescue ? `<div class="drive-alert">MEDICAL RETURN · ${world.divers.some((d) => d.condition === 'injured' && d.state !== 'ready') ? 'Bring injured diver aboard' : 'Return to harbour / radio for assistance'}</div>` : ''}${b.grounded ? '<div class="grounding">GROUNDED — reverse to deeper water; wait at sea for rising tide or Pause → Radio for paid tow</div>' : ''}`;
    if (scene.lastHud !== hudText) {
      const graphic = input.touchEnabled
        ? hudText
        : `<div class="helm-graphic">${compass('HDG', heading, `${heading.toFixed(0)}°`)}${dial('FUEL', `${b.fuel.toFixed(0)} L`, b.fuel / boatSpec(world).fuelCapacity, 'E', 'F', fuel.level !== 'normal')}</div><div class="helm-status">${waterSpeed.toFixed(1)} kn · ${soundingDepth(world, b.x, b.y).toFixed(1)} m<br>Hull ${Math.round(hullHealth * 100)}% · Drive ${Math.round(driveHealth * 100)}%<br>${ui.realistic ? 'Read load from deck' : `Deck ${Math.round(world.catch)} / ${boatSpec(world).capacity} lb`}${b.grounded ? ' · GROUNDED' : ''}</div>`;
      const alerts =
        hudText.match(/<div class="(?:drive-alert|grounding)">.*?<\/div>/g)?.join('') || '';
      const commands = !input.touchEnabled
        ? `<div class="helm-status">${throttleText(b.throttle)} · Rudder ${rudderText(b.rudder)}${boatSpec(world).bowThrusterStrength ? ` · Bow ${Math.round((b.thruster || 0) * 100)}%` : ''}</div>`
        : '';
      hud.innerHTML = instrumentContent(
        graphic + commands + (!input.touchEnabled ? alerts : ''),
        hudText,
      );
      scene.lastHud = hudText;
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
        : `<b>${formatClock(world.day.minute)}</b><span>${world.day.phase === 'complete' ? 'At harbour' : ground?.name || 'Choose a working area'}</span><span>Offload ${formatClock(C.day.deadlineMinute)}${working ? ` · Leave ${formatClock(depart)}` : ''}</span>`;
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
    if (!indicators) {
      const button = scene.diverButtons[id];
      setMarkup(button, portrait({ ...crewProfile(world.career, d.crewId), name: d.name }));
      button.className = d.id === world.selectedDiverId ? 'selected' : '';
      button.setAttribute('aria-label', `Select ${d.name}`);
      button.setAttribute('aria-pressed', String(d.id === world.selectedDiverId));
      return;
    }
    const button = scene.diverButtons[id],
      text = `${d.name} · ${d.condition === 'deceased' ? 'FATALITY' : d.condition === 'injured' ? (d.state === 'ready' ? 'INJURED / ABOARD' : 'INJURED / WAITING') : d.state === 'ready' ? 'ABOARD' : d.state === 'surface' ? (d.bagHandled ? 'BAG ABOARD / WAITING' : 'FLOAT WAITING') : d.state.toUpperCase()}${world.career ? ` · ${d.condition === 'fit' ? Math.round((d.fatigue || 0) * 100) + '% tired' : d.condition.toUpperCase()}` : ''}`;
    const detail = assist(world, 'exactLoad', ui.realistic)
      ? input.touchEnabled
        ? `${d.name}\nAir ${Math.round(d.air)} · Bag ${Math.round(d.bag)} lb${d.condition !== 'fit' ? ' · ' + d.condition : ''}${d.swimmingClear ? ' · Swimming clear' : ''}`
        : text + '\n' + diverTelemetry(world, d)
      : text;
    if (!button.querySelector('.diver-detail')) {
      button.replaceChildren();
      const span = document.createElement('span');
      span.className = 'diver-detail';
      button.append(span);
    }
    setText(button.firstElementChild, detail);
    renderNitrogen(button, world, d, assist(world, 'exactLoad', ui.realistic), input.touchEnabled);
    let meters = button.querySelector('.diver-meters');
    if (!meters) {
      meters = document.createElement('span');
      meters.className = 'diver-meters instrument-graphic';
      button.append(meters);
    }
    meters.hidden = !assist(world, 'exactLoad', ui.realistic) || input.touchEnabled;
    if (!meters.hidden)
      setMarkup(
        meters,
        `<label>Air <meter min="0" max="100" low="20" optimum="100" value="${Math.round((d.air / (diverSpec(d).tankAir || 100)) * 100)}"></meter></label><label>Bag <meter min="0" max="300" value="${Math.round(d.bag)}"></meter></label>`,
      );
    button.setAttribute('aria-label', `Select ${d.name}`);
    button.className = d.id === world.selectedDiverId ? 'selected' : '';
    button.setAttribute('aria-pressed', String(d.id === world.selectedDiverId));
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
  const notice = ui.importantNotice?.until > performance.now() ? ui.importantNotice.text : '';
  const signature = JSON.stringify([
    state.status,
    state.progress === null ? null : Math.round(state.progress * 100),
    state.controls,
    state.distance.toFixed(1),
    state.waterSpeed.toFixed(2),
    state.overflow,
    state.reason,
    target.id,
    target.name,
    ui.realistic,
    notice,
    assist(world, 'exactLoad', ui.realistic) ? diverTelemetry(world, target) : '',
  ]);
  if (!message.hidden && signature !== scene.lastMessage) {
    scene.lastMessage = signature;
    message.replaceChildren();
    const title = document.createElement('strong');
    setText(title, `${state.observable ? target.name + ' · ' : ''}${state.status}`);
    message.append(title);
    if (assist(world, 'exactLoad', ui.realistic)) {
      const telemetry = document.createElement('div');
      telemetry.className = 'pickup-detail';
      setText(telemetry, diverTelemetry(world, target));
      message.append(telemetry);
    }
    if (state.progress !== null && (!ui.realistic || target.state === 'surface')) {
      const bar = document.createElement('progress');
      bar.max = 1;
      bar.value = state.progress;
      bar.setAttribute('aria-label', state.operation + ' progress');
      message.append(bar);
    }
    if (notice) {
      const line = document.createElement('div');
      line.className = 'important-notice';
      setText(line, notice);
      message.append(line);
    }
    const controls = document.createElement('div');
    controls.className = 'control-status';
    setText(controls, state.controls);
    message.append(controls);
    if (diverVisual(target).surface && state.observable) {
      const detail = document.createElement('div');
      detail.className = 'pickup-detail';
      setText(
        detail,
        `Port working side${ui.realistic ? '' : ` · Hull distance ${state.distance.toFixed(1)} / ${tolerance} m`} · ${ui.realistic ? 'Match float drift' : `Relative speed ${(state.waterSpeed * C.knotsPerMps).toFixed(1)} kn`} · Pickup below ${(C.recovery.maxRelativeSpeed * C.knotsPerMps).toFixed(1)} kn relative to float`,
      );
      message.append(detail);
      if (state.reason) {
        const why = document.createElement('div');
        why.className = 'pickup-detail';
        setText(why, state.reason + ` · ${input.label('recoverDiver')} brings the diver aboard`);
        message.append(why);
      }
      if (state.overflow > 0) {
        const warning = document.createElement('div');
        warning.className = 'important-notice';
        setText(
          warning,
          ui.realistic
            ? 'Deck full: excess catch will be released; diver recovery available.'
            : `Only ${Math.max(0, boatSpec(world).capacity - world.catch).toFixed(0)} lb fits. Excess catch will be released; diver recovery available.`,
        );
        message.append(warning);
      }
    }
  }
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
