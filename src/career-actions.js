import { crewRoster } from './crew-roster.js';
import { marketOffers, chooseBuyer } from './buyer.js';
import { enabledEquipment, toggleEquipment } from './equipment-controls.js';
import { startDump } from './deck-work.js';
import { fullscreenLabel, toggleFullscreen } from './fullscreen.js';
import { uiScale, changeUiScale, setUiScale } from './ui-scale.js';
import { confirmAction, confirmPurchase, purchaseActions } from './purchase.js';
import { coastWarning } from './frank-advice.js';
import { shopActions } from './shop-actions.js';
import { setTimeIncrease, timeIncrease } from './time-speed.js';
import { boatArtLabel, toggleBoatArtMode } from './boat-art-mode.js';
import { testConditionActions } from './test-mode.js';
import { trainingActions, restTrainingCrew } from './training-tools.js';
import { setPreset, presetLabel } from './assists.js';
import { FLEET, ECONOMY, RANKS, UPGRADES, money } from './career-data.js';
import { boatDefinition, boatSpec } from './boats.js';
import { harbourScreen } from './starter-career.js';
import { areaStatus } from './season.js';
import { COASTS } from './coasts.js';
import { ARCADE_SHOWCASES } from './training-replay.js';
import { downloadCatchSheet } from './catch-sheet.js';
import {
  buyVessel,
  useVessel,
  hireCrew,
  serviceBoat,
  repairQuote,
  credit,
  sellVessel,
  vesselSaleQuote,
  buyAreaAccess,
} from './career-state.js';

// Focus is positional; actions are identified by stable IDs, never English text or menu offsets.
export const CAREER_SCREENS = [
  'market',
  'deck-catch',
  'equipment-controls',
  'purchase',
  'coast-access',
  'starter',
  'harbour',
  'office',
  'crew',
  'fleet',
  'yourboat',
  'boatshop',
  'buyboat',
  'outfit',
  'accounts',
  'logbook',
  'fleetboard',
  'archives',
  'settings',
  'ui-scale',
  'gameplay-speed',
  'workshop',
  'training',
];
export function careerActions(ui, w) {
  const c = w.career,
    people = crewRoster(c);
  const open = (id, label, screen = id) => ({ id, label, run: () => ui.open(screen) });
  const action = (id, label, run, extra = {}) => ({ id, label, run, ...extra });
  const back = action('back', 'Back / Close', () => ui.back());
  const nextDay = (dockWork) => {
    ui.hooks.nextDay({ dockWork });
    ui.open(null);
    ui.open('harbour');
  };
  const resume = (result) => {
    if (result?.ok) {
      ui.open(null);
      if (ui.hooks.world().day.phase === 'planning') ui.open(harbourScreen(ui.hooks.world()));
    }
    return result;
  };
  const shop = shopActions(ui, w);
  if (shop)
    return shop.concat(
      ...(ui.screen === 'starter'
        ? [
            action('difficulty', `Career difficulty: ${presetLabel(c.difficulty)}`, () => {
              c.difficulty = c.difficulty === 'easy' ? 'realistic' : 'easy';
              setPreset(w, c.difficulty);
            }),
          ]
        : []),
      back,
    );
  switch (ui.screen) {
    case 'market':
      return [
        action('buyer-standard', 'Standard market · no target', () => chooseBuyer(w, 'standard')),
        ...marketOffers(c).map((o) =>
          action(
            `buyer-${o.id}`,
            `${c.buyerToday?.id === o.id ? '✓ ' : ''}${o.name} · ${o.target.toLocaleString()} lb / ${Math.round(o.minQuality * 100)}%${o.unlocked ? '' : ' · contact locked'}`,
            () => chooseBuyer(w, o.id),
          ),
        ),
        back,
      ];
    case 'deck-catch':
      return [
        ...w.bags
          .map((bag, index) =>
            action(
              `dump-${index}`,
              `Dump bag ${index + 1} · ${Math.round(bag.weight)} lb / ${Math.round(bag.quality * 100)}% · ${(bag.haulSeconds || 3).toFixed(1)}s`,
              () => {
                const result = startDump(w, index);
                if (result.ok) ui.open(null);
                return result;
              },
            ),
          )
          .reverse(),
        open('market', 'Today’s buyer / return estimate'),
        back,
      ];
    case 'equipment-controls':
      return [
        ...(c.fleet[w.boat.configuration]?.equipment || [])
          .filter((id) => UPGRADES.find((u) => u.id === id)?.slot !== 'timepiece')
          .map((id) =>
            action(
              `switch-${id}`,
              `${UPGRADES.find((u) => u.id === id)?.name || id}: ${enabledEquipment(w).includes(id) ? (id === 'lights' ? 'AUTO · after dark' : 'ON') : 'OFF'}`,
              () => toggleEquipment(w, id),
            ),
          ),
        back,
      ];
    case 'purchase':
      return purchaseActions(ui);
    case 'harbour':
      return [
        open('chart', 'Sail · plan the day'),
        open('office', 'Harbour office'),
        open('crew', 'Meet the crew'),
        open('fleet', 'Boatyard'),
        open('outfit', 'Chandlery'),
        open('help', 'Talk to Frank'),
        open('conditions', 'Weather & tides'),
        open('settings', 'Settings'),
        open('workshop', 'Training Mode'),
      ];
    case 'office':
      return [
        open('accounts', 'Fuel, repairs & accounts'),
        open('logbook', 'Skipper logbook & saves'),
        open('fleetboard', 'Fleet landings'),
        action('rest', 'Rest a day · recover crew', () =>
          confirmAction(
            ui,
            'Yes · rest until tomorrow',
            () => nextDay(false),
            'This skips the rest of today. Crew recover and daily debt interest still applies.',
            'Cancel · keep today',
          ),
        ),
        action('dockwork', `Work a day on the dock · ${money(ECONOMY.dockWage)}`, () =>
          confirmAction(
            ui,
            'Yes · work the dock today',
            () => nextDay(true),
            `This skips today’s fishing and earns ${money(ECONOMY.dockWage)}. Daily debt interest still applies.`,
            'Cancel · keep today',
          ),
        ),
        open('market', 'Buyer market · choose today’s goal'),
        back,
      ];
    case 'settings':
      return [
        open('layout', 'Arrange UI layout'),
        open('assists', 'UI / difficulty options'),
        open('controller', 'Controller setup'),
        open('bindings', 'Controller Remapping'),
        open('ui-scale', 'UI Scale'),
        open('touch-options', 'Touchscreen Options'),
        open('gameplay-speed', 'Gameplay Speed'),
        action('fullscreen', `⛶ ${fullscreenLabel()}`, toggleFullscreen),
        action('boat-art', `Catalogue artwork: ${boatArtLabel()}`, () => {
          toggleBoatArtMode();
          ui.signature = null;
        }),
        action(
          'volume',
          `Sound volume: ${Math.round((ui.hooks.audio?.volume ?? 0.35) * 100)}%`,
          () => {
            const levels = [0, 0.2, 0.35, 0.5, 0.75];
            ui.hooks.audio?.setVolume(
              levels[(levels.indexOf(ui.hooks.audio?.volume ?? 0.35) + 1) % levels.length],
            );
          },
        ),
        action('graphics', `3D graphics: ${ui.hooks.graphicsLabel?.() || 'High'}`, () => {
          ui.hooks.cycleGraphics?.();
          ui.signature = null;
        }),
        action('exit', 'Exit Game', () => ui.exit()),
        back,
      ];
    case 'ui-scale':
      return [
        action('ui-smaller', `Smaller · now ${uiScale()}%`, () => {
          changeUiScale(-1, false);
        }),
        action('ui-larger', `Larger · now ${uiScale()}%`, () => {
          changeUiScale(1, false);
        }),
        action('ui-reset', 'Reset · 100%', () => {
          setUiScale(100);
        }),
        back,
      ];
    case 'gameplay-speed':
      return [
        action('time-slower', `−5% · now +${timeIncrease()}%`, () =>
          setTimeIncrease(timeIncrease() - 5),
        ),
        action('time-faster', `+5% · now +${timeIncrease()}%`, () =>
          setTimeIncrease(timeIncrease() + 5),
        ),
        back,
      ];
    case 'workshop':
      if (!c.sandbox)
        return [
          action('repeat-tutorial', 'Repeat tutorial · current boat and equipment', () => {
            const result = ui.hooks.trainingReplay();
            if (result.ok) ui.open(null);
            return result;
          }),
          ...ARCADE_SHOWCASES.map((showcase) =>
            action(`arcade-${showcase.id}`, showcase.label, () => {
              const result = ui.hooks.trainingReplay(showcase);
              if (result.ok) ui.open(null);
              return result;
            }),
          ),
          back,
        ];
      return c.sandbox
        ? [
            open('training', 'Training tools · divers, ground & simulation'),
            ...testConditionActions(w),
            action('funds', 'Add $100,000 test funds', () => {
              c.cash += 100000;
            }),
            action('rank', 'Unlock boats, equipment & crew', () => {
              c.xp = Math.max(c.xp, RANKS.at(-1).xp);
              c.records.days = 50;
              c.records.totalRevenue = 500000;
              c.records.incidents = 0;
              c.testContacts = true;
            }),
            action('restcrew', 'Fresh tanks & rested test crew', () => restTrainingCrew(w)),
            action('reveal', `Reveal test grounds: ${ui.debug ? 'ON' : 'OFF'}`, () => {
              ui.debug = !ui.debug;
            }),
            action('leave', 'Leave Test Mode · restore real career', () =>
              resume(ui.hooks.sandbox(false)),
            ),
            back,
          ]
        : [
            action('sandbox', 'Enter Test Mode · fresh charts', () =>
              resume(ui.hooks.sandbox(true)),
            ),
            action('prototype', 'Open prototype laboratory', () => {
              ui.hooks.prototype();
              ui.open(null);
              ui.open('chart');
            }),
            back,
          ];
    case 'training':
      return [...trainingActions(w, ui), back];
    case 'crew':
      return [
        ...c.crew.map((id, slot) =>
          action(
            `berth-${slot}`,
            `Berth ${slot + 1}: ${people.find((p) => p.id === id)?.name || 'Empty'}${(ui.crewSlot || 0) === slot ? ' · SELECTED' : ''}`,
            () => {
              ui.crewSlot = slot;
              return { ok: true, reason: `Choose a diver below for berth ${slot + 1}.` };
            },
            { slot },
          ),
        ),
        ...people.map((p) =>
          action(
            `crew-${p.id}`,
            p.name,
            () => {
              ui.crewCandidate = p.id;
              const result = hireCrew(w, p.id, ui.crewSlot || 0);
              return result.ok
                ? { ok: true, reason: `${p.name} assigned to berth ${(ui.crewSlot || 0) + 1}.` }
                : result;
            },
            { crewId: p.id },
          ),
        ),
        back,
      ];
    case 'yourboat':
      return [
        open('equipment-controls', 'Equipment switches'),
        ...Object.keys(c.fleet)
          .filter((id) => !c.fleet[id].lost)
          .map((id) =>
            action(
              `fit-${id}`,
              `${id === c.activeBoat ? '✓ Active' : 'Use'} · ${boatDefinition(id).name}`,
              () => useVessel(w, id),
              { boatId: id },
            ),
          ),
        open('boatshop', 'Boats for sale'),
        open('outfit', 'Fit equipment'),
        ...Object.keys(c.fleet)
          .filter((id) => id !== c.activeBoat && !c.fleet[id].lost)
          .map((id) =>
            action(
              `sell-${id}`,
              `Sell ${boatDefinition(id).name} · ${money(vesselSaleQuote(w, id))}`,
              () => sellVessel(w, id),
              { boatId: id },
            ),
          ),
        back,
      ];
    case 'buyboat':
      return [
        action('cancel-buy', 'Cancel · keep browsing', () => ui.previous()),
        action(
          'confirm-buy',
          `Buy ${boatDefinition(ui.boatCandidate).name} · ${money(FLEET[ui.boatCandidate].price)}`,
          () => {
            const result = buyVessel(w, ui.boatCandidate);
            if (result.ok) ui.previous();
            return result;
          },
        ),
      ];
    case 'accounts':
      return [
        action(
          'fuel',
          `Refuel · ${money(Math.max(0, boatSpec(w).fuelCapacity - w.boat.fuel) * ECONOMY.fuelPrice)}`,
          () => serviceBoat(w, 'fuel'),
        ),
        action('repair', `Repair boat · ${money(repairQuote(w))}`, () => serviceBoat(w, 'repair')),
        action(
          'licence',
          c.licenceThrough >= c.day
            ? `Licence valid through day ${c.licenceThrough}`
            : `Renew area licence · ${money(ECONOMY.licenceCost)}`,
          () => serviceBoat(w, 'licence'),
        ),
        ...COASTS.slice(1).map((area) => {
          const id = area.id,
            status = areaStatus(c, area.sectors[0]);
          return action(
            `area-${id}`,
            status.access
              ? `${area.name} access · HELD · all 3 subareas`
              : `${area.name} access · ${money(area.accessCost)} · all 3 subareas`,
            () =>
              status.access
                ? buyAreaAccess(w, id)
                : confirmPurchase(
                    ui,
                    `Buy ${area.name} access · ${money(area.accessCost)}`,
                    () => {
                      const result = buyAreaAccess(w, id);
                      if (result.ok) {
                        ui.permitCoastId = id;
                        ui.open('coast-access');
                      }
                      return result;
                    },
                    'One permanent coast permit. Its three physical subareas open on season days 1, 3 and 5.<br><br>' +
                      coastWarning(area),
                  ),
          );
        }),
        action('borrow', 'Borrow up to $5,000', () => credit(w)),
        action('repay', 'Repay up to $5,000', () => credit(w, true)),
        back,
      ];
    case 'coast-access':
      return [
        open('boatshop', 'Review stronger boats', 'boatshop'),
        open('chart', 'Understood · plan a voyage', 'chart'),
        back,
      ];
    case 'fleetboard':
      return [back];
    case 'archives':
      return [
        action('latest', 'Continue latest career', () => {
          ui.hooks.resumeCareer();
          ui.open(null);
          if (ui.hooks.world().day.phase === 'planning') ui.open(harbourScreen(ui.hooks.world()));
        }),
        ...(ui.archives || []).map((a) =>
          action(
            `archive-${a.key}`,
            `${a.kind || 'Saved career'} ${a.day} · ${money(a.cash)} · ${boatDefinition(a.boat).name}`,
            () => resume(ui.hooks.changeCareer(a.key)),
          ),
        ),
      ].concat(
        action('import', 'Import career backup', () => ui.hooks.importSave()),
        back,
      );
    case 'logbook':
      return [
        action('save', 'Save game now · keep a restore point', () => ui.hooks.savePoint()),
        open('archives', 'Load saved day / career'),
        action('catch-sheet', 'Export yellow catch sheet', () => downloadCatchSheet(c)),
        action('export', 'Export career backup', () => ui.hooks.exportSave()),
        open('archives', 'Archived careers'),
        action('import', 'Import career backup', () => ui.hooks.importSave()),
        back,
      ];
    default:
      return null;
  }
}
export const careerChoices = (ui, w) => careerActions(ui, w)?.map((a) => a.label) || null;
export function careerActivate(ui, w) {
  const selected = careerActions(ui, w)?.[ui.index];
  if (!selected) return false;
  if (selected.disabled) return true;
  if (['fuel', 'repair', 'licence', 'repay'].includes(selected.id)) {
    confirmPurchase(
      ui,
      selected.label,
      selected.run,
      'Check the item and price. Your money is only committed when you confirm.',
    );
    return true;
  }
  const result = selected.run();
  if (result) ui.menuNotice = result.reason || (result.ok ? 'Ready.' : 'Unavailable.');
  ui.hooks.save?.();
  ui.signature = null;
  return true;
}
