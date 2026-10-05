import { returnAvailable, confirmDeparture } from './departure-transition.js';
import { harbourScreen } from './starter-career.js';
import { trainingLessons, trainingPreparation, syncTrainingLight } from './training-replay.js';
import { assist, gear } from './assists.js';
import { ECONOMY, money } from './career-data.js';
import {
  INTRO_STEPS,
  INTRO_NOTES,
  INTRO_SCOUT_HINT,
  tickIntroHint,
  introActive,
  introPending,
  introLesson,
  advanceIntro,
} from './career-intro.js';
import { appendChoices } from './menu-buttons.js';
import { paintSectorMap, sectorChartSvg } from './chart-art.js';
import { bindChartModeToggle, chartMode, chartModeMarkup } from './chart-presentation.js';
import { soundingDepth } from './hazard-depth.js';
import { setText } from './dom-view.js';
import { fullscreenLabel, toggleFullscreen } from './fullscreen.js';

export const INTRO_SCREENS = ['intro', 'introchart', 'intropause'];
export function introChoices(ui) {
  if (ui.screen === 'intro')
    return ['Come aboard · learn with Frank', 'Skip day 0 · choose my boat'];
  if (ui.screen === 'introchart') return ['Resume lesson'];
  if (ui.screen !== 'intropause') return null;
  const w = ui.hooks.world(),
    replay = w.career?.trainingReplay;
  if (ui.screen === 'intropause')
    return [
      'Resume lesson',
      'Look at the cove chart',
      w.career.intro.step === 9
        ? returnAvailable(w)
          ? 'Return to harbour'
          : 'Drive past the SOUTH line to finish'
        : trainingPreparation(w)
          ? 'Continue to next lesson'
          : 'Skip this lesson step',
      replay ? 'Leave training · return to career' : 'Skip day 0 · choose my boat',
      'Save and return to title',
      'UI / difficulty options',
      'Settings',
      `⛶ ${fullscreenLabel()}`,
      'Touchscreen Options',
    ];
  return null;
}
export function finishIntro(ui, skipped = false) {
  if (ui.hooks.world().career?.trainingReplay) {
    ui.hooks.sandbox(false);
    ui.open(null);
    const phase = ui.hooks.world().day.phase;
    if (phase === 'planning') ui.open(harbourScreen(ui.hooks.world()));
    else if (phase === 'complete') ui.open('summary');
    ui.input.suppress();
    return;
  }
  ui.hooks.finishIntro(skipped);
  ui.open(null);
  ui.open('starter');
  ui.input.suppress();
}
export function introActivate(ui) {
  if (!INTRO_SCREENS.includes(ui.screen)) return false;
  if (ui.screen === 'intro') {
    if (ui.index === 1) finishIntro(ui, true);
    else {
      ui.hooks.startIntro();
      ui.open(null);
      ui.input.suppress();
    }
  } else if (ui.screen === 'introchart') ui.open(null);
  else if (ui.index === 0) ui.open(null);
  else if (ui.index === 1) ui.open('introchart');
  else if (ui.index === 2) {
    const w = ui.hooks.world();
    if (w.career.intro.step === 9) {
      if (!returnAvailable(w))
        ui.menuNotice = 'Recover both divers and drive past the amber SOUTH line.';
      ui.open(null);
      if (returnAvailable(w)) confirmDeparture(w);
    } else {
      nextLesson(w);
      ui.hooks.save?.();
      ui.open(null);
    }
  } else if (ui.index === 3) finishIntro(ui, true);
  else if (ui.index === 5) ui.open('assists');
  else if (ui.index === 6) ui.open('settings');
  else if (ui.index === 7) toggleFullscreen();
  else if (ui.index === 8) ui.open('touch-options');
  else ui.showTitle();
  return true;
}
export function renderIntro(ui, w) {
  const signature = JSON.stringify([
    ui.screen,
    ui.index,
    w.career.intro.step,
    w.career.intro.discovery,
    w.career.intro.prepIndex,
  ]);
  if (signature === ui.signature) return;
  ui.signature = signature;
  const briefing = ui.screen === 'intro';
  if (ui.screen === 'introchart') {
    const surface =
      chartMode(ui) === 'vector'
        ? sectorChartSvg(w.terrain, {
            boat: w.boat,
            rocks: w.rocks || [],
            ariaLabel:
              'Vector chart of Frank’s cove: your boat, marked shelf northwest, uncharted eastern shore',
          })
        : '<canvas class="intro-chart" width="520" height="520" aria-label="Chart of Frank’s cove: your boat, marked shelf northwest, uncharted eastern shore"></canvas>';
    ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">DAY 0 · FRANK’S COVE</div><h2>Our little fishery</h2></div>${chartModeMarkup(ui)}</div><div class="intro-chart-workspace"><div class="intro-chart-surface">${surface}<p class="map-caption">North ↑ · 240 m across<br>Gold ring: your boat · Green: known ground · Pink ×: charted rocks<br>Unmarked rocks and floating logs are not plotted.</p></div><article class="intro-chart-brief"><div class="eyebrow">YOUR NEXT TASK</div><h3>${lesson(w, ui)[0]}</h3><p>${lesson(w, ui)[1]}</p><details class="skipper-note" open><summary>Frank’s note</summary><p>${INTRO_NOTES[w.career.intro.step]}</p></details><div class="choices intro-choices"></div></article></div>`;
    const canvas = ui.panel.querySelector('.intro-chart');
    if (canvas) paintSectorMap(canvas, w.terrain, { boat: w.boat, rocks: w.rocks || [] });
    bindChartModeToggle(ui.panel, ui);
    appendChoices(ui.panel.querySelector('.choices'), ui, w, introChoices(ui));
    return;
  }
  ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">DAY 0 · FRANK’S COVE</div><h2>${briefing ? 'A talking to by Frank' : ui.screen === 'introchart' ? 'Our little fishery' : 'A moment aboard'}</h2></div></div><article class="intro-copy"><img class="frank-portrait" src="./assets/harbour/frank-v1.png" alt="Frank, your investor"/><p>${briefing ? 'I’m Frank, your investor. I’ve put STARTING_FUNDS behind you. First, come aboard my loan boat for a quiet morning: we’ll steer, find urchins, and bring our divers home.' : lesson(w, ui)[1]}</p>${briefing ? '<p>Take your time. You can skip a step or the whole lesson. Today’s catch and costs stay here; your full starting funds wait for day 1.</p>' : ''}</article>${!briefing ? `<details class="skipper-note" open><summary>Frank’s note · ${INTRO_STEPS[w.career.intro.step][0]}</summary><p>${INTRO_NOTES[w.career.intro.step]}</p></details>` : ''}<div class="choices intro-choices"></div>`;
  ui.panel.innerHTML = ui.panel.innerHTML.replace('STARTING_FUNDS', money(ECONOMY.startCash));
  appendChoices(ui.panel.querySelector('.choices'), ui, w, introChoices(ui));
}
export function updateIntro(ui, w, actions, dt = 0) {
  if (!introPending(w) && !ui.frankPanel) return;
  let panel = ui.frankPanel;
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'frankAboard';
    document.body.append(panel);
    ui.frankPanel = panel;
  }
  if (ui.introWorld !== w) {
    ui.introWorld = w;
    panel.dataset.signature = '';
  }
  const active = introActive(w) && ui.started && !ui.screen;
  panel.hidden = !active || !assist(w, 'frankOverlay', ui.realistic);
  syncTrainingLight(w);
  document.body.classList.toggle('intro-playing', active);
  if (!introPending(w)) return;
  if (tickIntroHint(w, dt, active && !ui.blocked)) ui.hooks.save?.();
  if (advanceIntro(w, actions, ui.screen)) {
    if (w.career.intro.departed) {
      finishIntro(ui);
      return;
    }
    ui.hooks.save?.();
    ui.signature = null;
  }
  if (!active) return;
  const step = w.career.intro.step;
  const spoken = lesson(w, ui)[1]
    .replace(
      'On touch, drag the left stick up or tap Ahead.',
      ui.input.touchEnabled
        ? 'Drag the left stick up or tap Ahead.'
        : `Use ${ui.input.label('throttleUp')} to increase throttle.`,
    )
    .replace(
      'Use Zoom − on touch or your zoom-out control.',
      `Use ${ui.input.label('zoomOut')} to zoom out.`,
    )
    .replace(/\{(\w+)\}/g, (_, action) => ui.input.label(action));
  const hint = step === 7 && w.career.intro.scoutSeconds >= 60;
  const signature = `${step}:${w.career.intro.prepIndex || 0}:${ui.input.lastDevice}:${!!w.emergency}:${hint}:${spoken}`;
  if (panel.dataset.signature === signature) {
    updateLessonReadout(panel, w);
    return;
  }
  panel.dataset.signature = signature;
  panel.innerHTML = `<div class="frank-body"><div class="frank-line"><img src="./assets/harbour/frank-v1.png" alt="Frank aboard"/><div><strong>Frank · ${trainingPreparation(w) ? `Equipment ${w.career.intro.prepIndex + 1}/${trainingLessons(w).length}` : `${step + 1}/${INTRO_STEPS.length}`} · ${lesson(w, ui)[0]}</strong><p>${w.emergency ? 'Let’s stop here and start fresh at harbour. You can skip the lesson without losing your starting funds.' : spoken}</p></div></div></div><div class="frank-buttons"><button data-intro="chart">Chart & notes</button><button data-intro="next" ${step === 9 ? 'disabled' : ''}>${step === 9 ? 'Drive past the SOUTH line' : trainingPreparation(w) ? 'Continue' : 'Skip this step'}</button><button data-intro="skip">${w.career.trainingReplay ? 'Leave training' : 'Skip tutorial'}</button></div>`;
  panel.scrollTop = 0;
  panel.querySelector('[data-intro="chart"]').onclick = () => ui.open('introchart');
  panel.querySelector('[data-intro="next"]').onclick = () => {
    if (step !== 9) {
      nextLesson(w);
      ui.hooks.save?.();
    }
  };
  panel.querySelector('[data-intro="skip"]').onclick = () => finishIntro(ui, true);
  const readout = document.createElement('p');
  readout.className = 'frank-helm';
  panel.prepend(readout);
  if (hint) {
    const prompt = document.createElement('p');
    prompt.className = 'frank-scout-hint';
    prompt.setAttribute('role', 'status');
    prompt.textContent = INTRO_SCOUT_HINT;
    panel.querySelector('.frank-body').prepend(prompt);
    panel.scrollTop = 0;
  }
  updateLessonReadout(panel, w);
}

function updateLessonReadout(panel, w) {
  const readout = panel.querySelector('.frank-helm');
  // Soundings are needed for these tasks; keep them in Frank's advice rather
  // than restoring a separate instrument panel over the water.
  readout.hidden = ![4, 7].includes(w.career.intro.step);
  setText(readout, `Sounder · ${soundingDepth(w, w.boat.x, w.boat.y).toFixed(1)} m beneath us`);
}

export function lesson(w, ui) {
  const current = introLesson(w);
  const result =
    trainingPreparation(w) ||
    (w.career.trainingReplay
      ? [
          current[0],
          current[1]
            .replace('Ada or Milo', w.divers.map((d) => d.name).join(' or '))
            .replace(
              'In the future you can buy an upgrade that will let you mark the ground you find:',
              gear(w, 'plotter')
                ? 'Your boat already has the upgrade for marking this discovery:'
                : 'You can fit an upgrade to mark the ground you find:',
            ),
        ]
      : current);
  return [result[0], result[1].replace(/\{(\w+)\}/g, (_, action) => ui.input.label(action))];
}
function nextLesson(w) {
  if (trainingPreparation(w)) w.career.intro.prepIndex++;
  else w.career.intro.step++;
  syncTrainingLight(w);
}
