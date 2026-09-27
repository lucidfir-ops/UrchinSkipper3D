import { C } from './config.js';
import { selectedDiver, selectDiver } from './world.js';
import { boatSpec } from './boats.js';
import { depthAt } from './terrain.js';
import { clearWater } from './water-route.js';
import { step } from './simulation.js';
import { crewRoster } from './crew-roster.js';
import { CREW_LEVELS, crewProgress, diverSpec } from './crew.js';
import { newDiveHealth, exposureClock } from './dive-exposure.js';
import { spawnTraffic } from './traffic.js';

const cycle = (values, current) => values[(values.indexOf(current) + 1) % values.length];
const unavailable = () => ({
  ok: false,
  reason: 'Available only in the isolated Test Mode career.',
});
function trainingPatch(w) {
  return (
    w.patches.find((p) => p.id === w.career.training?.patchId) ||
    [...w.patches].sort(
      (a, b) =>
        Math.hypot(a.x - w.boat.x, a.y - w.boat.y) - Math.hypot(b.x - w.boat.x, b.y - w.boat.y),
    )[0]
  );
}
export function stageTrainingDiver(w, state) {
  if (!w.career?.sandbox) return unavailable();
  if (!['ready', 'searching', 'surfacing', 'surface'].includes(state))
    return { ok: false, reason: 'Unknown test state.' };
  const d = selectedDiver(w),
    b = w.boat,
    p = trainingPatch(w),
    underwater = ['searching', 'surfacing'].includes(state),
    target = underwater
      ? p?.clumps?.find((c) => c.remaining > 0) || p
      : {
          x: b.x - Math.cos(b.heading) * (boatSpec(w).width / 2 + 2),
          y: b.y - Math.sin(b.heading) * (boatSpec(w).width / 2 + 2),
        };
  if (!target || (state !== 'ready' && depthAt(w, target.x, target.y) < C.diver.minDepth))
    return { ok: false, reason: 'Choose a water-covered test patch / deeper boat position first.' };
  Object.assign(d, {
    state,
    x: state === 'ready' ? b.x : target.x,
    y: state === 'ready' ? b.y : target.y,
    patch: underwater ? p : null,
    clump: null,
    target: null,
    localSearch: null,
    timer: C.diver.warningSeconds,
    diveTime: 0,
    searchTime: 0,
    harvestTime: 0,
    recallAt: null,
    hook: 0,
    hooking: false,
    recoveryAction: null,
    recoveryPause: '',
    bagHandled: false,
    reason: 'Training state',
  });
  w.day.assisted = true;
  return { ok: true, reason: `${d.name}: test state ${state}.` };
}
export function setTrainingGround(w, { quality, stock, rate } = {}) {
  if (!w.career?.sandbox) return unavailable();
  const p = trainingPatch(w);
  if (!p) return { ok: false, reason: 'No test ground in this sector.' };
  if (quality !== undefined && [0.6, 0.7, 0.8, 0.9].includes(quality)) {
    p.quality = quality;
    for (const c of p.clumps || []) c.quality = quality;
  }
  if (rate !== undefined && rate > 0 && rate <= 100) p.rate = rate;
  if (stock !== undefined && stock >= 0 && stock <= 1) {
    for (const c of p.clumps || []) c.remaining = (c.initialStock || 1000) * stock;
    p.remaining = (p.clumps || []).reduce((total, c) => total + c.remaining, 0);
  }
  w.day.assisted = true;
  return { ok: true, reason: 'Test ground changed; simulation stock and clumps agree.' };
}
export function restTrainingCrew(w) {
  if (!w.career?.sandbox) return unavailable();
  for (const [id, p] of Object.entries(w.career.people)) {
    p.fatigue = 0;
    p.availableDay = w.career.day;
    p.condition = 'fit';
    delete p.injuryCause;
    p.diveHealth = newDiveHealth(w.career, id, exposureClock(w));
  }
  for (const d of w.divers) {
    d.fatigue = 0;
    d.condition = 'fit';
    d.air = diverSpec(d).tankAir || C.diver.air;
    if (['fatality', 'lost'].includes(d.state)) d.state = 'ready';
    d.reason = '';
  }
  w.emergency = null;
  w.safety = { incidents: [], injuries: 0, fatalities: 0 };
  return {
    ok: true,
    reason: 'Test crew reset, including fictional dive exposure. Real career unchanged.',
  };
}
export function trainingActions(w, ui) {
  if (!w.career?.sandbox) return [];
  const c = w.career,
    d = selectedDiver(w),
    settings = (c.training ??= { timeScale: 1 }),
    p = trainingPatch(w),
    people = crewRoster(c),
    person = people.find((p) => p.id === settings.crewId) || people.find((p) => p.id === d.crewId),
    record = c.people[person.id],
    level = crewProgress(record.experience, person.id, c.seed).level;
  const action = (id, label, run) => ({
    id,
    label,
    run: () => {
      if (!w.career?.sandbox) return unavailable();
      w.day.assisted = true;
      return run();
    },
  });
  return [
    action('train-select', `Selected diver: ${d.name}`, () => selectDiver(w, d.id === 0 ? 1 : 0)),
    action('train-patch', `Test patch: ${p?.name || p?.id || 'none'}`, () => {
      settings.patchId = cycle(
        w.patches.map((p) => p.id),
        p?.id,
      );
    }),
    action('train-drop', 'Move boat beside test patch · crew aboard', () => {
      if (w.divers.some((d) => d.state !== 'ready'))
        return { ok: false, reason: 'Bring / stage both divers aboard first.' };
      if (!p) return { ok: false, reason: 'Choose a test patch.' };
      const target = { x: p.x + 10, y: p.y },
        spec = boatSpec(w);
      if (
        !clearWater(w.terrain, w.environment.seaLevel || 0, target, {
          draft: spec.draft,
          radius: spec.length / 2,
        })
      )
        return { ok: false, reason: 'Boat footprint does not fit beside this patch.' };
      Object.assign(w.boat, target, {
        vx: 0,
        vy: 0,
        throttle: 0,
        rudder: 0,
        turn: 0,
        grounded: false,
      });
      return { ok: true };
    }),
    ...['ready', 'searching', 'surfacing', 'surface'].map((state) =>
      action(`train-${state}`, `Stage selected diver: ${state}`, () =>
        stageTrainingDiver(w, state),
      ),
    ),
    action('train-bag', `Selected bag: ${Math.round(d.bag)} lb · cycle`, () => {
      d.bag = cycle([0, 75, 150, 300], d.bag);
      d.qualitySum = d.bag * (p?.quality || 0.8);
      d.bagHandled = false;
      d.undersizeCount = null;
      d.hook = 0;
      d.hooking = false;
    }),
    action('train-air', `Selected air: ${Math.round(d.air)} · cycle`, () => {
      d.air = cycle([20, 40, 70, diverSpec(d).tankAir || 100], d.air);
    }),
    action('train-style', `Test table adherence: ${d.diveStyle}`, () => {
      d.diveStyle = cycle(['conservative', 'tables', 'reckless'], d.diveStyle);
    }),
    action(
      'train-exposure',
      `Test exposure load: ${(c.people[d.crewId].diveHealth?.load || 0).toFixed(2)} · cycle`,
      () => {
        const old = c.people[d.crewId].diveHealth?.load || 0,
          h = (c.people[d.crewId].diveHealth = newDiveHealth(c, d.crewId, exposureClock(w)));
        h.load = cycle([0, 0.5, 1, 2], old);
        h.strain = h.load * 0.5;
      },
    ),
    action('train-stock', 'Test ground stock: empty / half / full', () => {
      const total = p?.clumps?.reduce((n, c) => n + (c.initialStock || 1000), 0) || 1;
      return setTrainingGround(w, {
        stock: p.remaining < total * 0.25 ? 0.5 : p.remaining < total * 0.75 ? 1 : 0,
      });
    }),
    action('train-quality', `Test ground quality: ${Math.round((p?.quality || 0) * 100)}%`, () =>
      setTrainingGround(w, { quality: cycle([0.6, 0.7, 0.8, 0.9], p?.quality) }),
    ),
    action('train-rate', `Test ground productivity: ${(p?.rate || 0).toFixed(1)} lb/s`, () =>
      setTrainingGround(w, { rate: cycle([3, 6.667, 10, 20], p?.rate) }),
    ),
    action('train-person', `Level-test person: ${person.name}`, () => {
      settings.crewId = cycle(
        people.map((p) => p.id),
        person.id,
      );
    }),
    action('train-level', `Test person level: ${level} / 20 · cycle`, () => {
      record.experience = CREW_LEVELS[level % CREW_LEVELS.length];
      const live = w.divers.find((d) => d.crewId === person.id);
      if (live) {
        live.experience = record.experience;
        live.air = Math.min(live.air, diverSpec(live).tankAir || 100);
      }
    }),
    action('train-funds-remove', 'Remove $10,000 test funds', () => {
      c.cash = Math.max(0, c.cash - 10000);
    }),
    action('train-scale', `Simulation speed: ${settings.timeScale}×`, () => {
      settings.timeScale = cycle([0.25, 0.5, 1, 2, 4], settings.timeScale);
    }),
    action('train-step', 'Single physics step · while this menu is paused', () =>
      step(w, {}, 1 / 60),
    ),
    action('train-markers', `Physics / seabed reveal: ${ui.debug ? 'ON' : 'OFF'}`, () => {
      ui.debug = !ui.debug;
    }),
    ...['taxi', 'tourist', 'dfo', 'rival'].map((kind) =>
      action(`train-spawn-${kind}`, `Spawn ${kind} on a valid offscreen route`, () => ({
        ok: !!spawnTraffic(w, kind),
        reason:
          'Traffic needs a working sector, available fleet and a clear offscreen water route.',
      })),
    ),
    action('train-rest', 'Reset test crew health / exposure', () => restTrainingCrew(w)),
  ];
}
