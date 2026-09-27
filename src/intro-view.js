import { harbourScreen } from './starter-career.js';
import { trainingLessons, trainingPreparation, syncTrainingLight } from './training-replay.js';
import { assist, gear } from './assists.js';
import { ECONOMY, money } from './career-data.js';
import {
  INTRO_STEPS,
  INTRO_SCOUT_HINT,
  tickIntroHint,
  introActive,
  introPending,
  advanceIntro,
} from './career-intro.js';
import { appendChoices } from './menu-buttons.js';
import { paintSectorMap, sectorChartSvg } from './chart-art.js';
import { bindChartModeToggle, chartMode, chartModeMarkup } from './chart-presentation.js';
import { depthAt } from './world.js';
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
        ? 'Drive through SOUTH edge to finish'
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
      ui.menuNotice = 'Recover both divers and drive through the SOUTH map edge.';
      ui.open(null);
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
  const vector = chartMode(ui) === 'vector',
    introChart =
      ui.screen === 'introchart'
        ? `${chartModeMarkup(ui)}${vector ? sectorChartSvg(w.terrain, { boat: w.boat, rocks: w.rocks || [], ariaLabel: 'Vector chart of Frank’s cove: marked shelf northwest, uncharted eastern shore' }) : '<canvas class="intro-chart" width="520" height="520" aria-label="Chart of Frank’s cove: marked shelf northwest, uncharted eastern shore"></canvas>'}<p>North ↑ · 240 m across. Green is known ground; pink × marks charted rocks. Unmarked rocks have prominent crowns and wash: keep a lookout. Use Chart or the minimap’s ↗ button to open this chart; tap its picture to fade it. The separate sounder reads directly beneath the boat. Toggle either in UI / difficulty options and arrange them in Arrange UI layout. Scout divers along the eastern shelf to learn unmarked ground.</p>`
        : '';
  ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">DAY 0 · FRANK’S COVE</div><h2>${briefing ? 'A talking to by Frank' : ui.screen === 'introchart' ? 'Our little fishery' : 'A moment aboard'}</h2></div></div><article class="intro-copy"><img class="frank-portrait" src="./assets/harbour/frank-v1.png" alt="Frank, your investor"/><p>${briefing ? 'I’m Frank, your investor. I’ve put STARTING_FUNDS behind you. You’ll buy your own boat with it and keep the change for fuel and gear. The Workhorse has a roomy deck and a steady shaft drive; the smaller Island Tender is quicker but needs care around its outboard.' : lesson(w)[1] + (w.career.intro.step === 9 ? (w.career.difficulty === 'realistic' ? ' Realistic: reverse off rocks only when your engine can beat the wind; you may need to wait for calmer conditions or a rising tide.' : ' Easy: hold reverse to limp off a grounding when deeper water is astern. A drying tidal basin still needs a rising tide.') : '')}</p>${briefing ? '<p>Easy gives you more information; Realistic asks you to read the water. Both run the same fishery. You can choose when we buy your boat. Hire and train crew, fit equipment, check the weather, and keep enough fuel and money to get home. Every purchase asks you first.</p><p>Before any of that, come with me. We’ll take my loan boat into a small cove for a slow first morning. I’ll show you the controls and how divers find ground. You can skip any line or skip the whole lesson. Today’s catch and costs stay here; your full starting funds wait for day 1.</p>' : ''}</article>${introChart}<div class="choices intro-choices"></div>`;
  ui.panel.innerHTML = ui.panel.innerHTML.replace('STARTING_FUNDS', money(ECONOMY.startCash));
  const canvas = ui.panel.querySelector('.intro-chart');
  if (canvas) paintSectorMap(canvas, w.terrain, { boat: w.boat, rocks: w.rocks || [] });
  if (ui.screen === 'introchart') bindChartModeToggle(ui.panel, ui);
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
  const spoken = (
    lesson(w)[1] +
    (step === 9
      ? w.career.difficulty === 'realistic'
        ? ' Realistic: your engine must beat the wind to reverse off rocks. Wait for calmer weather or a rising tide if it cannot.'
        : ' Easy: hold reverse to limp into deeper water. A drying basin still needs a rising tide.'
      : '')
  ).replace(/\{(\w+)\}/g, (_, action) => ui.input.label(action));
  const hint = step === 7 && w.career.intro.scoutSeconds >= 60;
  const signature = `${step}:${w.career.intro.prepIndex || 0}:${ui.input.lastDevice}:${!!w.emergency}:${hint}`;
  if (panel.dataset.signature === signature) {
    updateLessonReadout(panel, w);
    return;
  }
  panel.dataset.signature = signature;
  panel.innerHTML = `<div class="frank-line"><img src="./assets/harbour/frank-v1.png" alt="Frank aboard"/><div><strong>Frank · ${trainingPreparation(w) ? `Equipment ${w.career.intro.prepIndex + 1}/${trainingLessons(w).length}` : `${step + 1}/${INTRO_STEPS.length}`} · ${lesson(w)[0]}</strong><p>${w.emergency ? 'Let’s stop here and start fresh at harbour. You can skip the lesson without losing your starting funds.' : spoken}</p></div></div><div class="frank-buttons"><button data-intro="chart">Chart</button><button data-intro="next" ${step === 9 ? 'disabled' : ''}>${step === 9 ? 'Drive through SOUTH edge' : trainingPreparation(w) ? 'Continue' : 'Skip this step'}</button><button data-intro="skip">${w.career.trainingReplay ? 'Leave training' : 'Skip tutorial'}</button></div>`;
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
    panel.prepend(prompt);
    panel.scrollTop = 0;
  }
  updateLessonReadout(panel, w);
}

function updateLessonReadout(panel, w) {
  const b = w.boat;
  setText(
    panel.querySelector('.frank-helm'),
    `Throttle ${Math.round(b.throttle * 100)}% · Rudder ${Math.round(b.rudder * 100)}% · Depth ${depthAt(w, b.x, b.y).toFixed(1)} m\n` +
      w.divers
        .map(
          (d) =>
            `${d.name.split(' ')[0]}: ${d.state === 'ready' ? 'aboard' : d.state} · ${Math.round(d.bag)} lb`,
        )
        .join(' / '),
  );
}

function lesson(w) {
  return (
    trainingPreparation(w) ||
    (w.career.trainingReplay
      ? [
          INTRO_STEPS[w.career.intro.step][0],
          INTRO_STEPS[w.career.intro.step][1]
            .replace('Ada or Milo', w.divers.map((d) => d.name).join(' or '))
            .replace(
              'In the future you can buy an upgrade that will let you mark the ground you find:',
              gear(w, 'plotter')
                ? 'Your boat already has the upgrade for marking this discovery:'
                : 'You can fit an upgrade to mark the ground you find:',
            ),
        ]
      : INTRO_STEPS[w.career.intro.step])
  );
}
function nextLesson(w) {
  if (trainingPreparation(w)) w.career.intro.prepIndex++;
  else w.career.intro.step++;
  syncTrainingLight(w);
}
