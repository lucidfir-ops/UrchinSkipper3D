import { answerPatrol, crewAboard } from './fishery.js';
import { introChoices, introActivate } from './intro-view.js';
import { expeditionChoices, expeditionActivate } from './career-chart.js';

import { careerChoices, careerActivate } from './career-ui.js';
import { BOATS, fitBoat } from './boats.js';

import { DEFAULTS, LABELS } from './input.js';
import { C } from './config.js';

import {
  GROUNDS,
  chooseGround,
  formatClock,
  latestDeparture,
  rescueStatus,
  requestRescue,
} from './day.js';
import { departurePatch, cycleDeparturePatch } from './day-view.js';
import { updateEnvironment } from './environment.js';
import { layoutEditor } from './layout-editor.js';
import { debugActivate, debugChoices } from './debug-mode.js';
import { fullscreenLabel, toggleFullscreen } from './fullscreen.js';
import { touchOptionsActions } from './touch-options.js';

export function choices(world) {
  if (this.screen === 'touch-options') return touchOptionsActions(this).map((a) => a.label);
  if (this.screen === 'layout')
    return layoutEditor(this)
      .actions()
      .map((a) => a.label);
  const lesson = introChoices(this);
  if (lesson) return lesson;
  const debug = debugChoices(this, world);
  if (debug) return debug;
  if (!world.career && this.screen === 'assists')
    return ['Easy information', 'All Off information', 'Back / Close', 'Arrange UI layout'];
  if (world.career) {
    const choices = expeditionChoices(this, world) || careerChoices(this, world);
    if (choices) return choices;
    if (this.screen === 'summary') return ['Prepare next day', 'Skipper logbook', 'Exit Game'];
    if (this.screen === 'pause')
      return world.day.phase === 'planning'
        ? [
            'Harbour office',
            'Settings',
            'Arrange UI layout',
            'Skipper Stuff',
            'Exit Game',
            'Return to Title Screen',
            'Touchscreen Options',
          ]
        : [
            'Resume',
            `REVEAL EVERY URCHIN: ${this.revealUrchins ? 'ON' : 'OFF'}`,
            'Debug mode',
            'Arrange UI layout',
            'UI / difficulty options',
            'Touchscreen Options',
            'Deck catch',
            'Equipment switches',
            ...(world.career.sandbox ? ['Test conditions'] : []),
            ...(rescueStatus(world).available ? ['Radio for rescue / end fishing'] : []),
            ...(world.day.inspection
              ? [
                  world.day.inspection.status === 'calling'
                    ? 'Answer DFO patrol'
                    : 'DFO inspection report',
                ]
              : []),
            ...(world.day.phase === 'complete' ? ['Offload receipt'] : []),
            'Settings',
            'Skipper Stuff',
            `⛶ ${fullscreenLabel()}`,
            'Return to Title Screen',
          ];
    if (this.screen === 'skipper-stuff')
      return ['Radio', 'Diver', 'Local Chart', 'Weather', 'Coastal Chart', 'Back / Close'];
  }
  if (this.screen === 'pause' && world.day.phase === 'complete')
    return [
      'Offload receipt',
      'Start a new day',
      'Prototype boatyard',
      'Controller setup',
      'Help',
      'Exit Game',
    ];
  if (this.screen === 'pause')
    return [
      'Resume',
      `REVEAL EVERY URCHIN: ${this.revealUrchins ? 'ON' : 'OFF'}`,
      'UI / difficulty options',
      'Touchscreen Options',
      'Diver instructions',
      'Coastal chart',
      'Controls / Remapping',
      'Controller setup',
      `Information: ${this.realistic ? 'ALL OFF' : 'EASY'}`,
      `Sound volume: ${Math.round((this.hooks.audio?.volume ?? 0.35) * 100)}%`,
      `Test reveal: ${this.debug ? 'ON' : 'OFF'}`,
      `Controller Diagnostics: ${this.diagnostics ? 'ON' : 'OFF'}`,
      `Action feedback: ${this.feedback ? 'ON' : 'OFF'}`,
      'Restart Prototype',
      'Exit Game',
      'Help',
      'Prototype boatyard',
      'Tide & current almanac',
      ...(rescueStatus(world).available ? ['Radio for rescue / end fishing'] : []),
      ...(this.debug
        ? [
            'Ground laboratory / practice drop',
            'Test drop: Good ground',
            'Test drop: Poor ground',
            'Test drop: Empty ground',
            'Test pickup: two full bags / empty deck',
            'Test pickup: two full bags / 100 lb free',
            'Test clock: five minutes before departure',
            'Test clock: +30 minutes',
            'Test environment: +3 hours',
          ]
        : []),
      'Return to career',
      'Arrange UI layout',
      'Back / Close',
    ];
  if (this.screen === 'radio') return ['Back / Close'];
  if (this.screen === 'patrol')
    return world.day.inspection?.status === 'calling'
      ? [
          crewAboard(world) ? 'Divers up, come over' : 'Keep clear — I’ll recover the divers',
          'Back / Close',
        ]
      : ['Back / Close'];
  if (this.screen === 'emergency') return ['Radio for rescue / end fishing', 'Help'];
  if (this.screen === 'almanac')
    return ['Forecast −30 min', 'Forecast +30 min', 'Previous area', 'Next area', 'Back / Close'];
  if (this.screen === 'boatyard') return BOATS.map((b) => b.name).concat('Back / Close');
  if (this.screen === 'bindings')
    return Object.keys(DEFAULTS)
      .map(
        (k) =>
          `${world.career && k === 'debug' ? 'Cycle detail levels' : world.career ? LABELS[k].replace(' / pause', '') : LABELS[k]}: ${this.input.label(k, this.remapDevice)}`,
      )
      .concat(
        `Reset to Defaults · ${this.remapDevice === 'keyboard' ? 'Keyboard' : 'Controller'}`,
        'Back / Close',
      );
  if (this.screen === 'controller')
    return [
      'Verify physical X / Y actions',
      'Name physical face buttons',
      'Use standard gamepad layout',
      'Use existing playtest layout',
      'Controls / Remapping',
      'Show diagnostics',
      'Use keyboard / Steam keyboard layout',
      'Back / Close',
    ];
  if (this.screen === 'chart')
    return GROUNDS.map((g) => `${g.name} · ${g.travelMinutes / 60}h home`).concat(
      'Tide & current almanac',
      'Visit prototype boatyard',
      'Back / Close',
    );
  if (this.screen === 'departure' && this.laboratory)
    return [
      'Practice drop on selected ground',
      `Starting ground: ${departurePatch(this, world).name}`,
      'Back to chart',
    ];
  if (this.screen === 'departure')
    return world.day.phase === 'working' && world.day.groundId === this.chartGroundId
      ? ['Resume fishing', 'Back to chart']
      : [
          world.day.phase === 'planning' ? 'Begin working day' : 'Travel to sector',
          `Starting ground: ${this.realistic && !this.debug ? 'read chart markings' : departurePatch(this, world).name}`,
          'Back to chart',
        ];
  if (this.screen === 'summary') return ['Start a new day', 'Exit Game'];
  if (this.screen === 'exit')
    return ['Back / Cancel', 'Retry game', 'Launcher / title', 'Exit Game'];
  return ['Back / Close'];
}
export function activate(world) {
  if (this.index <= -3) {
    this.panel.querySelector(`[data-choice-index="${this.index}"]`)?.click();
    return;
  }
  if (this.index === -2) {
    this.forward();
    return;
  }
  if (this.index === -1 || /^Back( |$)/.test(this.choices(world)[this.index] || '')) {
    this.back();
    return;
  }
  if (this.screen === 'layout') {
    const action = layoutEditor(this).actions()[this.index];
    if (action && !action.disabled) action.run();
    this.signature = null;
    return;
  }
  if (this.screen === 'touch-options') {
    touchOptionsActions(this)[this.index]?.run();
    return;
  }
  if (introActivate(this)) return;
  const choice = this.choices(world)[this.index];
  if (choice?.startsWith('⛶')) {
    toggleFullscreen();
    this.signature = null;
    return;
  }
  if (choice === 'Touchscreen Options') {
    this.open('touch-options');
    return;
  }
  if (choice?.startsWith('REVEAL EVERY URCHIN:')) {
    this.revealUrchins = !this.revealUrchins;
    this.signature = null;
    return;
  }
  this.hooks.audio?.play('confirm');
  if (debugActivate(this, world)) return;
  if (world.career && (expeditionActivate(this, world) || careerActivate(this, world))) return;
  if (!world.career && this.screen === 'assists') {
    if (this.index < 2) {
      this.realistic = this.index === 1;
      delete world.uiOptions;
    } else if (choice === 'Arrange UI layout') this.open('layout');
    else this.back();
    this.signature = null;
    return;
  }
  if (this.screen === 'emergency') {
    if (choice === 'Help') this.open('help');
    else {
      const result = requestRescue(world);
      if (result.ok) this.open('summary');
    }
  } else if (this.screen === 'skipper-stuff') {
    if (choice === 'Radio') this.open('radio');
    else if (choice === 'Diver') this.open('instructions');
    else if (choice === 'Local Chart') this.open('knowledge');
    else if (choice === 'Weather') this.open('conditions');
    else if (choice === 'Coastal Chart') this.open('chart');
    else this.back();
  } else if (this.screen === 'pause') {
    if (choice === 'Deck catch') this.open('deck-catch');
    else if (choice === 'Equipment switches') this.open('equipment-controls');
    else if (choice === 'Debug mode') this.open('debug-mode');
    else if (choice === 'Arrange UI layout') this.open('layout');
    else if (choice === 'Skipper Stuff') this.open('skipper-stuff');
    else if (choice === 'Return to Title Screen') this.showTitle();
    else if (choice === 'Test conditions') this.open('workshop');
    else if (choice === 'Settings') this.open('settings');
    else if (choice === 'Harbour office') {
      if (['planning', 'complete'].includes(world.day.phase))
        this.open(world.day.phase === 'complete' ? 'summary' : 'harbour');
      else this.menuNotice = 'Bring the crew home across the harbour boundary first.';
    } else if (choice === 'Answer DFO patrol' || choice === 'DFO inspection report')
      this.open('patrol');
    else if (choice === 'Weather outlook') this.open('conditions');
    else if (choice === 'UI / difficulty options') this.open('assists');
    else if (choice === 'Local Chart') this.open('knowledge');
    else if (choice === 'Return to career') {
      this.hooks.resumeCareer();
      this.open(null);
    } else if (choice === 'Offload receipt') this.open('summary');
    else if (choice === 'Start a new day') {
      this.hooks.reset({ practice: false });
      this.open(null);
      this.open('chart');
    } else if (choice === 'Resume' || choice === 'Back / Close') {
      this.input.suppress();
      this.open(null);
    } else if (choice === 'Diver instructions') this.open('instructions');
    else if (choice === 'Coastal chart') this.open('chart');
    else if (choice === 'Prototype boatyard') this.open('boatyard');
    else if (choice === 'Tide & current almanac') this.open('almanac');
    else if (choice === 'Controls / Remapping') this.open('bindings');
    else if (choice === 'Controller setup') this.open('controller');
    else if (choice.startsWith('Information:')) {
      this.realistic = !this.realistic;
      this.messages = [];
      this.importantNotice = null;
    } else if (choice.startsWith('Sound volume:')) {
      const levels = [0, 0.2, 0.35, 0.5, 0.75];
      const value = this.hooks.audio?.volume ?? 0.35;
      this.hooks.audio?.setVolume(levels[(levels.indexOf(value) + 1) % levels.length]);
    } else if (choice.startsWith('Test reveal:')) this.debug = !this.debug;
    else if (choice.startsWith('Controller Diagnostics:')) this.diagnostics = !this.diagnostics;
    else if (choice.startsWith('Action feedback:')) this.feedback = !this.feedback;
    else if (choice === 'Restart Prototype') {
      this.hooks.reset();
      this.open(null);
      this.notify('PROTOTYPE RESTARTED');
    } else if (choice === 'Exit Game') this.exit();
    else if (choice === 'Help') this.open('help');
    else if (choice === 'Radio for rescue / end fishing') {
      const result = requestRescue(world);
      if (result.ok) this.open('summary');
      else this.menuNotice = result.reason;
    } else if (choice === 'Ground laboratory / practice drop') {
      if (!world.day.groundId)
        this.menuNotice = 'Choose a new sector from the coastal chart first.';
      else {
        this.laboratory = true;
        this.chartGroundId = world.day.groundId;
        this.chartPatchId = 'good';
        this.open('departure');
      }
    } else if (choice.startsWith('Test drop:')) {
      const id = choice.includes('Good') ? 'good' : choice.includes('Poor') ? 'poor' : 'empty';
      if (this.hooks.testDrop(id)) {
        this.open(null);
        this.notify('PRACTICE DROP — CLOCK DISABLED');
      } else this.menuNotice = 'Bring both divers aboard before changing the test drop.';
    } else if (choice.startsWith('Test pickup:')) {
      this.hooks.testPickup(choice.includes('100 lb'));
      this.open(null);
      this.notify('PRACTICE PICKUP RESET — CALM WATER / CLOCK DISABLED');
    } else if (choice.startsWith('Test clock:')) {
      if (world.day.phase !== 'working')
        this.menuNotice = 'Choose a chart ground to start the working day first.';
      else {
        world.day.minute = choice.includes('five minutes')
          ? latestDeparture(world) - 5
          : world.day.minute + 30;
        world.day.assisted = true;
        world.day.warnings = [];
        updateEnvironment(world);
        this.menuNotice = `Test clock: ${formatClock(world.day.minute)}`;
      }
    } else if (choice.startsWith('Test environment:')) {
      if (world.environment.model !== 'spatial-v1')
        this.menuNotice = 'Choose one of the new sectors from the chart first.';
      else {
        if (world.day.phase === 'practice') world.time += 180 / C.day.minutesPerSecond;
        else world.day.minute += 180;
        world.day.assisted = true;
        updateEnvironment(world);
        this.menuNotice = 'Environment advanced three hours. Tide and current updated together.';
      }
    }
  } else if (this.screen === 'patrol') {
    if (choice === 'Divers up, come over' || choice === 'Keep clear — I’ll recover the divers') {
      const result = answerPatrol(world);
      if (result.ok) {
        this.open(null);
        this.notify(result.reason);
      } else this.menuNotice = result.reason;
    } else this.back();
  } else if (this.screen === 'almanac') {
    if (this.index < 2)
      this.forecastOffset = Math.max(
        0,
        Math.min(660, (this.forecastOffset || 0) + (this.index === 0 ? -30 : 30)),
      );
    else if (this.index < 4) {
      const index = GROUNDS.findIndex((g) => g.id === this.almanacGroundId);
      this.almanacGroundId =
        GROUNDS[(index + (this.index === 2 ? -1 : 1) + GROUNDS.length) % GROUNDS.length].id;
    } else this.back();
  } else if (this.screen === 'boatyard') {
    if (this.index >= BOATS.length) this.back();
    else {
      const result = fitBoat(world, BOATS[this.index].id);
      this.menuNotice = result.ok ? 'BOAT FITTED — CLOSE THE YARD TO TRY IT' : result.reason;
    }
  } else if (this.screen === 'bindings') {
    const actions = Object.keys(DEFAULTS);
    if (this.index === actions.length) {
      this.input.reset(this.remapDevice);
      this.notify(this.input.notice);
    } else if (this.index === actions.length + 1) this.back();
    else this.input.beginCapture(actions[this.index], this.remapDevice);
  } else if (this.screen === 'controller') {
    if (choice === 'Verify physical X / Y actions') this.input.checkRecoveryButtons();
    else if (choice === 'Name physical face buttons') this.input.nameButtons();
    else if (choice === 'Use standard gamepad layout') this.input.useLayout(false);
    else if (choice === 'Use existing playtest layout') this.input.useLayout(true);
    else if (choice === 'Controls / Remapping') this.open('bindings');
    else if (choice === 'Show diagnostics') this.diagnostics = true;
    else if (choice === 'Use keyboard / Steam keyboard layout') {
      this.fallback = true;
      this.input.keyboardMode = 'Keyboard / Steam desktop layout';
      this.open(null);
    } else this.back();
  } else if (this.screen === 'chart') {
    if (this.index < GROUNDS.length) {
      this.laboratory = false;
      this.chartGroundId = GROUNDS[this.index].id;
      this.chartPatchId = 'good';
      this.open('departure');
    } else if (this.index === GROUNDS.length) {
      this.chartGroundId = GROUNDS[this.chartHighlight || 0].id;
      this.open('almanac');
    } else if (this.index === GROUNDS.length + 1) this.open('boatyard');
    else this.back();
  } else if (this.screen === 'departure') {
    if (choice === 'Back to chart') this.back();
    else if (choice === 'Local Chart') this.open('knowledge');
    else if (choice === 'Weather & tides') this.open('conditions');
    else if (choice === 'Fuel, repairs & accounts') this.open('accounts');
    else if (choice.startsWith('Arrival approach:'))
      this.arrivalLane = ((this.arrivalLane || 0) + 1) % 3;
    else if (choice === 'Resume fishing') this.open(null);
    else if (choice === 'Practice drop on selected ground') {
      if (this.hooks.testDrop(departurePatch(this, world).id)) {
        this.open(null);
        this.notify('LABORATORY DROP — ASSISTED / DAY DEADLINE DISABLED');
      } else this.menuNotice = 'BRING BOTH DIVERS ABOARD FIRST';
    } else if (choice.startsWith('Starting ground:')) cycleDeparturePatch(this, world, 1);
    else {
      const trip = chooseGround(world, this.chartGroundId, {
        patchId: departurePatch(this, world).id,
        arrivalLane: this.arrivalLane || 0,
      });
      if (trip.ok) this.open(null);
      else this.menuNotice = trip.reason;
    }
  } else if (this.screen === 'summary') {
    if (world.career) {
      if (this.index === 0) {
        this.hooks.nextDay();
        this.open(null);
        this.open('harbour');
      } else if (this.index === 1) this.open('logbook');
      else this.exit();
    } else if (this.index === 0) {
      this.hooks.reset({ practice: false });
      this.open(null);
      this.open('chart');
    } else this.exit();
  } else if (this.screen === 'exit') {
    if (this.exitPending) return;
    if (choice === 'Back / Cancel') this.back();
    else if (choice === 'Exit Game') this.closeSession();
    else if (choice === 'Retry game') {
      this.ended = false;
      this.hooks.reset();
      this.open(null);
      this.input.suppress();
    } else this.showTitle();
  } else this.back();
  this.signature = null;
}
