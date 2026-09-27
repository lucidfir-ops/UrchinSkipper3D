import { UI_OPTIONS } from './assist-options.js';
import { stageTrainingDiver } from './training-tools.js';
import { groundTrip, allAboard } from './day.js';
import { arrivalLanes } from './arrival.js';
import { sectorDefinition } from './sectors.js';
import { GROUNDS, chooseGround, formatClock } from './day.js';
import { ASSISTS, REALISTIC_ASSISTS, setPreset, toggleAssist } from './assists.js';
import { changeDepartureTime } from './career-state.js';
import { updateWeather } from './weather.js';
import { markPosition, markReport, markBearing } from './knowledge.js';
import { selectedSubArea } from './quota-areas.js';
import { confirmAction } from './purchase.js';

export const EXPEDITION_SCREENS = ['departure', 'knowledge', 'conditions', 'assists'];
export function expeditionActions(ui, w) {
  const action = (id, label, run) => ({ id, label, run }),
    open = (id, label, screen = id) => action(id, label, () => ui.open(screen)),
    back = action('back', 'Back / Close', () => ui.back()),
    area = () => ui.chartGroundId || w.day.groundId || 'near';
  const cycleArea = (direction) => {
    const index = GROUNDS.findIndex((g) => g.id === area());
    ui.chartGroundId = GROUNDS[(index + direction + GROUNDS.length) % GROUNDS.length].id;
  };
  const changeTime = (early) => {
    const result = changeDepartureTime(w, early);
    updateWeather(w);
    return { ...result, reason: result.reason || `Departure clock ${formatClock(w.day.minute)}.` };
  };
  switch (ui.screen) {
    case 'departure': {
      const resume = w.day.phase === 'working' && w.day.groundId === area();
      const trip = groundTrip(w, area());
      const remedy = !trip.ok
        ? action(
            'resolve-departure',
            !allAboard(w) ? 'Bring both divers aboard first' : trip.reason + ' · Resolve',
            () => {
              if (!allAboard(w)) {
                if (w.career.sandbox && w.day.phase === 'planning') {
                  const selected = w.selectedDiverId;
                  for (const d of w.divers) {
                    w.selectedDiverId = d.id;
                    stageTrainingDiver(w, 'ready');
                  }
                  w.selectedDiverId = selected;
                  return {
                    ok: true,
                    reason: 'Both test divers aboard. Begin working day is ready.',
                  };
                }
                ui.open(null);
                return {
                  ok: true,
                  reason: 'Recover your divers alongside on port, then reopen the chart.',
                };
              }
              ui.open(
                trip.noWorkWindow
                  ? 'outfit'
                  : !trip.closed &&
                      (w.boat.fuel <= 0 || w.boat.driveHealth <= 0 || w.career.cash < 0)
                    ? 'accounts'
                    : w.divers.every((d) => d.condition !== 'fit')
                      ? 'crew'
                      : /CLOSED/.test(trip.reason)
                        ? 'chart'
                        : 'accounts',
              );
            },
          )
        : null;
      return [
        ...(!trip.noWorkWindow
          ? [
              action(
                'sail',
                resume
                  ? 'Resume fishing'
                  : w.day.phase === 'planning'
                    ? 'Begin working day'
                    : 'Travel to sector',
                () => {
                  if (resume) {
                    ui.open(null);
                    return;
                  }
                  const sail = () => {
                    const result = chooseGround(w, area(), {
                      arrivalLane: w.career.preferences?.arrivals?.[area()] || 0,
                      subAreaId: selectedSubArea(w.career, area()),
                    });
                    if (result.ok) ui.open(null);
                    else if (remedy) ui.index = 1;
                    return result;
                  };
                  const unfit = w.divers.filter((d) => d.condition && d.condition !== 'fit');
                  if (trip.ok && unfit.length)
                    return confirmAction(
                      ui,
                      'Yes · sail with this crew',
                      sail,
                      unfit.map((d) => `${d.name}: ${d.condition}.`).join(' ') +
                        ' They cannot work today. You can change crew at the harbour before sailing.',
                      'Cancel · review my crew',
                    );
                  return sail();
                },
              ),
            ]
          : []),
        ...(remedy ? [remedy] : []),
        ...(w.day.phase === 'planning'
          ? [
              ...((w.day.earliestDeparture || 300) <= 300 && w.day.minute !== 300
                ? [
                    action('early', 'Wake crew · depart 05:00 (+6% fatigue)', () =>
                      changeTime(true),
                    ),
                  ]
                : []),
              ...(w.day.minute < 420
                ? [
                    action('rested-start', 'Let crew sleep · depart 07:00', () => {
                      w.day.minute = 420;
                      updateWeather(w);
                    }),
                  ]
                : []),
              action('sleep', 'Sleep · fish next day', () => {
                confirmAction(
                  ui,
                  'Yes · sleep until tomorrow',
                  () => {
                    ui.hooks.nextDay({});
                    ui.open('harbour');
                  },
                  'This skips the rest of today. Crew recover and daily debt interest still applies.',
                  'Cancel · keep today',
                );
              }),
              open('accounts', 'Fuel, repairs & accounts'),
            ]
          : []),
        open('sub-area', 'Choose another coast / subarea', 'chart'),
        action(
          'arrival',
          `Arrival approach: ${arrivalLanes(sectorDefinition(area()))[w.career.preferences?.arrivals?.[area()] || 0]}`,
          () => {
            w.career.preferences ??= { arrivals: {} };
            w.career.preferences.arrivals[area()] =
              ((w.career.preferences.arrivals[area()] || 0) + 1) % 3;
            ui.arrivalLane = w.career.preferences.arrivals[area()];
          },
        ),
        open('knowledge', 'Local Chart'),
        open('market', 'Buyer market · today’s goal'),
        open('conditions', 'Weather & tides'),
        action('back', 'Back to chart', () => ui.back()),
      ];
    }
    case 'knowledge':
      return [
        action('mark', 'Mark current position', () => markPosition(w)),
        ...Object.values(w.career.knowledge[area()]?.grounds || {})
          .filter((r) => Number.isFinite(r.sampleX))
          .sort((a, b) => b.day - a.day || b.minute - a.minute)
          .slice(0, 3)
          .map((r) =>
            action(`mark-report-${r.id}`, `Mark sample: ${r.name} · day ${r.day}`, () =>
              markReport(w, area(), r.id),
            ),
          ),
        ...(w.career.marks || [])
          .filter((m) => m.sector === area())
          .slice(-6)
          .map((m) =>
            action(
              `navigate-mark-${m.id}`,
              `${w.career.navigationMark === m.id ? '✓ ' : ''}${m.label} · ${markBearing(w, m)}`,
              () => {
                w.career.navigationMark = w.career.navigationMark === m.id ? null : m.id;
                return {
                  ok: true,
                  reason: w.career.navigationMark
                    ? `Following ${m.label}: ${markBearing(w, m)}`
                    : 'Mark guidance cleared.',
                };
              },
            ),
          ),
        action('previous-area', 'Previous area', () => cycleArea(-1)),
        action('next-area', 'Next area', () => cycleArea(1)),
        back,
      ];
    case 'conditions':
      return [
        open('almanac', 'Tide & current almanac'),
        ...(w.day.phase === 'planning'
          ? [
              action('wait', 'Wait 30 minutes at harbour', () => changeTime(false)),
              ...((w.day.earliestDeparture || 300) <= 300 && w.day.minute !== 300
                ? [
                    action('early', 'Wake crew · depart 05:00 (+6% fatigue)', () =>
                      changeTime(true),
                    ),
                  ]
                : []),
            ]
          : []),
        back,
      ];
    case 'assists':
      return [
        ...(w.career.difficulty === 'realistic'
          ? []
          : [action('easy', 'Easy preset', () => setPreset(w, 'easy'))]),
        action('realistic', 'Realistic preset', () => setPreset(w, 'realistic')),
        action('off', 'All Off preset', () => setPreset(w, 'off')),
        action('custom', 'Custom preset', () => setPreset(w, 'custom')),
        action('layout', 'Arrange UI layout', () => ui.open('layout')),
        action('reset-layout', 'Reset window positions and sizes', () => {
          ui.hudWindows?.resetAll();
        }),
        ...Object.entries(ASSISTS)
          .filter(
            ([key]) =>
              w.career.difficulty !== 'realistic' ||
              REALISTIC_ASSISTS.has(key) ||
              Object.hasOwn(UI_OPTIONS, key),
          )
          .map(([key, label]) =>
            action(`assist-${key}`, `${label}: ${w.career.assists[key] ? 'ON' : 'OFF'}`, () => {
              toggleAssist(w, key);
            }),
          ),
        back,
      ];
    default:
      return null;
  }
}
export const expeditionChoices = (ui, w) => expeditionActions(ui, w)?.map((a) => a.label) || null;
export function expeditionActivate(ui, w) {
  const actions = expeditionActions(ui, w),
    selected = actions?.[ui.index];
  if (!selected) return false;
  const screen = ui.screen,
    result = selected.run();
  if (result?.reason) ui.menuNotice = result.reason;
  if (screen === 'assists') {
    ui.realistic = !w.career.assists.exactLoad;
    ui.messages = [];
    ui.importantNotice = null;
  }
  ui.hooks.save?.();
  ui.signature = null;
  return true;
}
