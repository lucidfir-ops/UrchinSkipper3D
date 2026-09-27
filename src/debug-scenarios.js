import { C } from './config.js';

// Explicit test-menu fixture. Caller resets the session before applying it.
export function setupPickup(w, nearCapacity = false) {
  w.day.phase = 'practice';
  w.day.assisted = true;
  w.environment = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, waves: 0 };
  Object.assign(w.boat, {
    x: 232,
    y: 238,
    heading: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    throttle: 0,
    rudder: 0,
    turn: 0,
    grounded: false,
  });
  w.selectedDiverId = 0;
  w.discarded = 0;
  w.bags = [];
  w.catch = nearCapacity ? C.boat.capacity - 100 : 0;
  for (let left = w.catch; left > 0; left -= C.diver.bagSize)
    w.bags.push({ weight: Math.min(left, C.diver.bagSize), quality: 0.8 });
  for (const d of w.divers)
    Object.assign(d, {
      state: 'surface',
      x: 228,
      y: 238 + d.id,
      bag: C.diver.bagSize,
      qualitySum: C.diver.bagSize * 0.8,
      air: 40,
      reason: 'Bag full',
      patch: w.patches.find((p) => p.id === 'good'),
      bagHandled: false,
      hook: 0,
      hooking: false,
      recoveryAction: null,
      recoveryPause: '',
    });
}
