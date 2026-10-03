import { seededRandom } from './math.js';
import { careerDayAt } from './career-calendar.js';

// Day 3, five clear days (4–8), then one seeded visit in each eight-day block.
export function inspectionSchedule(c, day = c.day) {
  if (day <= (c.dfoAttentionThrough || 0)) {
    const window = `wildlife-${day}`;
    if (c.patrolSchedule?.window !== window)
      c.patrolSchedule = { window, day, minute: 600, visit: true, completed: false };
    return c.patrolSchedule;
  }
  const block = day < 9 ? -1 : Math.floor((day - 9) / 8);
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
  const day = careerDayAt(w),
    minute = w.day.minute % 1440,
    inspection = w.day.inspection;
  // Finish an existing call/boarding before scheduling another day. A previous
  // day's clearance must not suppress the rest of a continuous voyage.
  if (inspection && !['scheduled', 'cleared'].includes(inspection.status)) return false;
  const schedule = inspectionSchedule(w.career, day);
  return (
    schedule.visit &&
    day === schedule.day &&
    minute >= schedule.minute &&
    minute <= 840 &&
    !schedule.completed &&
    !(inspection?.status === 'cleared' && careerDayAt(w, inspection.minute ?? w.day.minute) === day)
  );
}
