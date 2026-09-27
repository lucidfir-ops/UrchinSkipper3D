import { assist } from './assists.js';
import { setText } from './dom-view.js';

import { throttleText, rudderText, feedbackText } from './presentation.js';

export function collectFeedback(world, a) {
  for (const event of world.events.splice(0)) {
    const text = feedbackText(event, this.realistic);
    if (text === null) continue;
    this.notify(text);
    const urgent =
      /WEATHER|RIVER RUNOFF|EARLY PASSAGE|RADIO|OUT OF FUEL|HOME FUEL RESERVE|FUEL BELOW HOME|DFO PATROL|EXCESS CATCH RELEASED|RETURN WINDOW|LEAVE NOW|RETURN WILL BE LATE|PROPULSION FAILED|DRIVE DAMAGED|HULL DAMAGED|HULL BREACHED|FATAL BOAT STRIKE|INJURED BY BOAT|INJURED DIVER ABOARD|SUSPECTED DECOMPRESSION SICKNESS/.test(
        text,
      );
    if (
      urgent ||
      (/REJECTED|BAG RECOVERED|DIVER ABOARD/.test(text) &&
        (!this.importantNotice?.urgent || this.importantNotice.until < performance.now()))
    )
      this.importantNotice = {
        text,
        urgent,
        until: performance.now() + 12000,
      };
  }
  for (const [key, inputKey, format] of [
    ['throttle', 'throttle', throttleText],
    ['rudder', 'steer', rudderText],
  ]) {
    const bucket = Math.round(world.boat[key] * 10);
    if (a[inputKey] && bucket !== this.lastBuckets[key])
      this.notify(`${key.toUpperCase()} ${format(world.boat[key])}`);
    this.lastBuckets[key] = bucket;
  }
  this.messages = this.messages.filter((m) => performance.now() - m.time < 12000);
  this.actionDisplay.hidden =
    !this.feedback ||
    !this.messages.length ||
    !!this.screen ||
    !assist(world, 'feedbackOverlay', this.realistic);
  if (!this.actionDisplay.hidden)
    setText(this.actionDisplay, this.messages.map((m) => m.text).join('\n'));
}
