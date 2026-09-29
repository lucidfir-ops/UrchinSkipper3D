import { seaMessage } from './sea-messages.js';
// Use the same short-lived bubble as surface dialogue and action notices.
export function updateTutorialSpeech(ui, world, state, target, notice) {
  if (world.career?.intro?.status !== 'active') return;
  let text = notice || '',
    key = notice || '';
  if (!notice && target.state === 'surface' && state.observable) {
    const name = target.name.split(' ')[0];
    key = `${target.id}:${target.hooking ? 'recovering' : state.available ? 'ready' : state.reason}`;
    text = target.hooking
      ? `${name} is coming alongside. Hold this drift.`
      : state.available
        ? `${name} is alongside · ${ui.input.label('recoverDiver')} to bring aboard.`
        : state.reason === 'SLOW DOWN'
          ? 'Select Neutral and match the float’s drift.'
          : `Bring ${name}’s float to the port ladder — the left side.`;
  }
  seaMessage(ui, 'pickup', key, text);
}
