import { seededRandom } from './math.js';

// Day 3, five clear days (4–8), then one seeded visit in each eight-day block.
export function inspectionSchedule(c) {
  if (c.day <= (c.dfoAttentionThrough || 0)) {
    const window = `wildlife-${c.day}`;
    if (c.patrolSchedule?.window !== window)
      c.patrolSchedule = { window, day: c.day, minute: 600, visit: true, completed: false };
    return c.patrolSchedule;
  }
  const block = c.day < 9 ? -1 : Math.floor((c.day - 9) / 8);
  const window = `v2-${block}`;
  if (c.patrolSchedule?.window === window) return c.patrolSchedule;
  const random = seededRandom(Math.imul(c.seed, 2654435761) ^ Math.imul(block + 2, 73013));
  return (c.patrolSchedule = {
    window,
    day: block < 0 ? 3 : 9 + block * 8 + Math.floor(random() * 8),
    minute: 660 + Math.floor(random() * 181),
    visit: true,
    completed: false,
  });
}
export function inspectionDue(w) {
  const schedule = inspectionSchedule(w.career);
  return (
    schedule.visit &&
    w.career.day === schedule.day &&
    w.day.minute >= schedule.minute &&
    w.day.minute <= 840 &&
    !schedule.completed &&
    w.day.inspection?.status !== 'cleared'
  );
}
