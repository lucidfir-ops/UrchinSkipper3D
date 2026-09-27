import { C } from './config.js';

export function startDump(w, index) {
  const bag = w.bags[index];
  if (w.day.phase !== 'working' || w.day.returnFade !== undefined || !bag)
    return { ok: false, reason: 'Choose a bag while working at sea.' };
  if (w.day.dump || w.divers.some((d) => d.hooking))
    return { ok: false, reason: 'Finish the current deck operation first.' };
  bag.id ??= `legacy-${w.time}-${index}`;
  const duration = bag.haulSeconds || C.recovery.hookSeconds;
  w.day.dump = { bagId: bag.id, remaining: duration, duration };
  w.events.push(
    `DECK · Dumping ${Math.round(bag.weight)} lb at ${Math.round(bag.quality * 100)}% · ${duration.toFixed(1)}s`,
  );
  return { ok: true };
}
export function stepDeckWork(w, dt) {
  const job = w.day.dump;
  if (!job) return;
  job.remaining = Math.max(0, job.remaining - dt);
  if (job.remaining > 1e-8) return;
  const index = w.bags.findIndex((bag) => bag.id === job.bagId);
  if (index >= 0) {
    const [bag] = w.bags.splice(index, 1);
    w.catch = Math.max(0, w.catch - bag.weight);
    w.discarded += bag.weight;
    w.events.push(`DECK · ${Math.round(bag.weight)} lb dumped overboard · space cleared`);
    w.effects.push({ type: 'splash', x: w.boat.x, y: w.boat.y });
  }
  delete w.day.dump;
}
