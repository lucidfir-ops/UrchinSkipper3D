import { crewAboard, patrolSkipper } from './fishery.js';
import { portrait } from './crew-portrait.js';
export function skipperPortrait(w) {
  return portrait({ name: `${patrolSkipper(w)}, DFO skipper`, colour: '#273f4f', officer: true });
}
export function updatePatrolPrompt(ui, w, ready) {
  const i = w.day.inspection,
    aboard = crewAboard(w);
  if (
    ready &&
    !ui.ended &&
    !ui.screen &&
    w.day.phase === 'working' &&
    i?.status === 'calling' &&
    i.promptedCrewUp !== aboard &&
    !w.emergency
  ) {
    i.promptedCrewUp = aboard;
    ui.open('patrol');
    ui.input.suppress();
  }
  let transition = ui.dfoTransition;
  if (!transition && !i) return;
  if (!transition) {
    transition = ui.dfoTransition = document.createElement('div');
    transition.id = 'dfoTransition';
    transition.setAttribute('role', 'status');
    document.body.append(transition);
  }
  transition.hidden = !ready || !!ui.screen || !['docking', 'departing'].includes(i?.status);
  if (!transition.hidden && transition.dataset.actor !== `${i.actorId}/${i.status}`) {
    transition.dataset.actor = `${i.actorId}/${i.status}`;
    transition.innerHTML =
      i.status === 'departing'
        ? `${skipperPortrait(w)}<h2>DFO casting off</h2><p>“Inspection complete. Lines clear — good luck, skipper.”</p>`
        : `${skipperPortrait(w)}<h2>DFO coming alongside</h2><p>“Stand by, skipper. Taking the lines.”</p>`;
  }
}
