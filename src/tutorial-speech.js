import { seaMessage } from './sea-messages.js';
import { recoveryStatus } from './diver-recovery.js';
import { pickupTolerance } from './assists.js';
// Use the same short-lived bubble as surface dialogue and action notices.
export function updateTutorialSpeech(ui, world, state, target, notice) {
  if (world.career?.intro?.status !== 'active') return;
  let text = notice || '',
    key = notice || '';
  if (!notice && target.state === 'surface' && state.observable) {
    const name = target.name.split(' ')[0],
      recovery = recoveryStatus(world, pickupTolerance(world, ui.realistic), target);
    key = `${target.id}:${target.hooking && recovery.available ? 'recovering' : state.available ? 'ready' : recovery.reason}`;
    text =
      target.hooking && recovery.available
        ? `${name} is coming alongside. Hold this drift.`
        : state.available
          ? `${name} is alongside · ${ui.input.label('recoverDiver')} to bring aboard.`
          : recovery.reason === 'SLOW DOWN'
            ? 'Select Neutral and match the float’s drift.'
            : `Bring ${name}’s float to the port ladder — the left side.`;
  }
  seaMessage(ui, 'pickup', key, text);
}
