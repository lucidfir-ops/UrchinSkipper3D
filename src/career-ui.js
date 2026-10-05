import { formatClock } from './day.js';
import { crewStatTable, medicalHistoryMarkup } from './medical-history.js';
import { workingDayDetail } from './working-day-view.js';
import { crewRoster, crewEmployer } from './crew-roster.js';
import { insurancePremium } from './insurance.js';
import { choiceButton } from './menu-buttons.js';
import { portrait } from './crew-portrait.js';
import { buyerNotice } from './buyer.js';
import { areaStatus, seasonStatus } from './season.js';
import { COASTS } from './coasts.js';
import { coastWarning } from './frank-advice.js';
import { FLEET, UPGRADES, RANKS, ECONOMY, rankOf, money } from './career-data.js';
import { boatDefinition, boatSpec } from './boats.js';
import { diverSpec, crewProgress } from './crew.js';
import { crewContact } from './career-state.js';
import {
  equipmentPlan,
  equipmentDetail,
  equipmentShopIntro,
  fittingPreview,
} from './equipment-view.js';
import { paintFittingPreviews } from './three/fitting-preview.js';
export { CAREER_SCREENS, careerChoices, careerActivate } from './career-actions.js';
import { careerActions } from './career-actions.js';
import { SHOP_SCREENS, shopField } from './shop-actions.js';
import { renderShopChoices } from './shop-view.js';
import { renderHarbour } from './harbour-view.js';
import { catchSheetSvg } from './catch-sheet.js';
import { vesselPreview, paintVesselPreviews } from './vessel-art.js';
import { renderPreferences } from './menu-preferences.js';
const megabytes = (bytes) => (bytes / 1048576).toFixed(1);
// Browsers allow roughly 5 MB per site, and itch.io games share one site.
function storageLine(report) {
  if (!report) return '';
  const nearlyFull = report.total > 4 * 1048576;
  return `<p class="storage-report${nearlyFull ? ' warning' : ''}">Storage: this game ${megabytes(report.game)} MB · all games on this site ${megabytes(report.total)} MB of about 5 MB.${nearlyFull ? ' <strong>Nearly full — delete old saves to keep saving.</strong>' : ''}</p>`;
}
// Boat control notes name actions as {action}; show the player's bindings.
const controlsText = (text, bind) => text.replace(/\{(\w+)\}/g, (_, action) => bind(action));
export function renderCareer(ui, w, bind) {
  if (['settings', 'ui-scale', 'gameplay-speed'].includes(ui.screen)) {
    renderPreferences(ui, w, bind);
    return;
  }
  const now = performance.now(),
    immediate = JSON.stringify([
      ui.screen,
      ui.index,
      ui.crewSlot,
      ui.crewCandidate,
      ui.boatCandidate,
      ui.starterCandidate,
      ui.equipmentCandidate,
      ui.menuNotice,
      ui.saveNotice,
    ]);
  if (
    ui.signature &&
    ui.careerWorld === w &&
    ui.careerImmediate === immediate &&
    now < ui.nextCareerRender
  )
    return;
  ui.careerWorld = w;
  ui.careerImmediate = immediate;
  ui.nextCareerRender = now + 100;
  const c = w.career,
    people = crewRoster(c),
    actions = careerActions(ui, w),
    choices = actions.map((a) => a.label),
    previewBoat = ['buyboat', 'fleet', 'boatshop', 'starter'].includes(ui.screen)
      ? ui[shopField(ui.screen)] || (ui.screen === 'starter' ? 'outboard' : c.activeBoat)
      : ui.screen === 'yourboat'
        ? c.activeBoat
        : actions[ui.index]?.boatId || (ui.screen === 'starter' ? 'outboard' : c.activeBoat),
    signature = JSON.stringify([
      ui.screen,
      ui.index,
      ui.crewSlot,
      ui.crewCandidate,
      ui.boatCandidate,
      ui.starterCandidate,
      ui.equipmentCandidate,
      c.day,
      c.cash,
      c.debt,
      c.xp,
      c.crew,
      c.people,
      c.fleet,
      c.buyerToday,
      w.day.dump,
      w.bags.length,
      c.insured,
      c.licenceThrough,
      c.areaAccess,
      c.coastAccess,
      ui.menuNotice,
      ui.saveNotice,
      w.boat.fuel,
      w.boat.hullHealth,
      w.boat.driveHealth,
    ]);
  if (signature === ui.signature) return;
  ui.signature = signature;
  if (ui.screen === 'harbour') {
    renderHarbour(ui, w, actions, bind);
    return;
  }
  let title = 'A living from the water.',
    detail = '';
  if (['market', 'deck-catch', 'equipment-controls'].includes(ui.screen)) {
    title = {
      market: 'The buyers’ board.',
      'deck-catch': 'Catch on deck.',
      'equipment-controls': 'Your boat’s switches.',
    }[ui.screen];
    detail = workingDayDetail(w, ui.screen);
  }
  if (ui.screen === 'purchase') {
    title = ui.pendingPurchase?.title || 'Confirm purchase';
    detail = `<h3>${ui.pendingPurchase?.label || 'No action selected'}</h3><p>${ui.pendingPurchase?.detail || ''}</p>${ui.pendingPurchase?.title ? '' : `<p>Available: ${money(c.cash)}</p>`}`;
  }
  if (ui.screen === 'coast-access') {
    const coast = COASTS.find((a) => a.id === ui.permitCoastId) || COASTS[1];
    title = `${coast.name.toUpperCase()} · ACCESS PURCHASED`;
    detail = `<div class="coast-access-notice"><h3>PERMANENT PERMIT NOW HELD</h3><p>All three destinations are yours to visit on their season opening days: 1, 3 and 5.</p><h3>FRANK’S WARNING · UPGRADE BEFORE YOU GO</h3><p>${coastWarning(coast)}</p><p>You can sail with your current boat. Review the forecast and boatyard before committing.</p></div>`;
  }
  if (ui.screen === 'starter') {
    title = 'Your first working boat.';
    const id = previewBoat,
      v = FLEET[id];
    detail = `<h3>A ${money(ECONOMY.startCash)} start from the harbour.</h3><p>Choose the boat that suits your fishing. Your starting funds buy one boat; keep the balance for the first working day. Both come fuelled, with Ada and Milo ready to crew.</p><h3>${boatDefinition(id).name}</h3><div class="career-numbers"><span>Deck<strong>${v.capacity.toLocaleString()} lb</strong></span><span>Cash after purchase<strong>${money(c.cash - v.price)}</strong></span></div><p>${id === 'outboard' ? '25 knots unloaded, 15 knots fully loaded, and easy thrust steering. The smaller deck and exposed outboard need care around rocks and timber.' : '10 knots unloaded with a 7,500 lb deck. Cheap passage running and a protected shaft, with a persistent rudder and wider turns. No bow thruster unless you fit one.'}</p><p>${v.travelBurn} L/h passage · ${v.fuelCapacity} L tank<br>${controlsText(boatDefinition(id).controls, bind)}</p>`;
  }
  if (ui.screen === 'crew') {
    title = 'People make the boat.';
    const p =
        people.find((p) => p.id === (actions[ui.index]?.crewId || ui.crewCandidate)) || people[0],
      r = c.people[p.id],
      d = diverSpec({
        crewId: p.id,
        fatigue: r.fatigue,
        experience: r.experience,
        crewSeed: c.seed,
      }),
      progress = crewProgress(r.experience || 0, p.id, c.seed);
    detail = `<div class="crew-profile">${portrait(p)}<div><h3>${p.name} <span class="crew-level">Level ${progress.level} / 20</span></h3><p>${p.bio}</p><p>Major (fast): ${progress.major}<br>Minors (slow): ${progress.minors.join(' · ')}</p></div></div>${crewStatTable(c, p, r)}<div class="career-numbers"><span>Own catch share<strong>40%</strong></span><span>Career earnings<strong>${money(r.earnings || 0)}</strong></span></div><p>Swim ${d.searchSpeed.toFixed(2)} m/s · Good bag ~${Math.round(30 / d.harvestRate)} s<br>Working tank ~${Math.round(((d.tankAir || 100) - 20) / d.airUse)} s · Holding current ${d.holdCurrentKnots.toFixed(1)} kn<br>Notices ground within ${d.awareness.toFixed(1)} m · Fatigue ${Math.round(r.fatigue * 100)}%</p><p>${r.condition === 'deceased' ? 'Lost at sea.' : r.condition !== 'fit' || r.availableDay > c.day ? `Unavailable until day ${r.availableDay}.` : rankOf(c) < p.rank ? `Contact opens at ${RANKS[p.rank].name}.` : crewContact(c, p) || 'Choose a berth, then select a diver to assign them.'}</p><p>Berth 1: ${people.find((p) => p.id === c.crew[0])?.name}<br>Berth 2: ${people.find((p) => p.id === c.crew[1])?.name}</p>`;
    detail += `<p>${crewEmployer(c, p.id) ? `Currently with ${crewEmployer(c, p.id).boat}. ${crewContact(c, p) || 'Open to joining your crew.'}` : 'Available independently or already on your boat.'}</p><div class="crew-progress"><h3>Level ${progress.level} / 20</h3><p>${Math.round(progress.experience).toLocaleString()} experience${progress.next ? ' · next level at ' + progress.next.toLocaleString() : ' · fully experienced'}<br>Major (fast): ${progress.major}<br>Minors (slow): ${progress.minors.join(' · ')}<br>Picking +${Math.round(progress.rateBonus * 100)}% · Air saving ${Math.round(progress.airSaving * 100)}% · Awareness +${progress.awarenessBonus.toFixed(1)} m<br>Swim +${Math.round(progress.swimBonus * 100)}% · Current +${progress.currentBonus.toFixed(1)} kn · Tank +${Math.round(progress.tankBonus * 100)}% · Fatigue −${Math.round(progress.fatigueSaving * 100)}%</p><p>Experience is earned from underwater work and recorded at offload. Rest reduces fatigue; experience stays with the diver.</p></div>`;
    detail += medicalHistoryMarkup(c, p.id);
    detail += `<p>Divers track depth, bottom time and repeated-day exposure. Listen when they request a surface interval; fresh tanks do not erase it. Different people observe their tables differently.</p><p>${r.injuryCause === 'DCS' && r.condition === 'injured' ? 'Recovering from suspected decompression sickness. ' : ''}Simplified game model — never use it to plan a real dive.</p>`;
  }
  if (['fleet', 'boatshop', 'buyboat', 'yourboat'].includes(ui.screen)) {
    title = ui.screen === 'yourboat' ? 'Your boat.' : 'Boats for sale.';
    const id = previewBoat,
      v = FLEET[id],
      def = boatDefinition(id);
    detail = `<h3>${def.name}</h3><p>${def.description}</p><div class="career-numbers"><span>Purchase<strong>${money(v.price)}</strong></span><span>Deck<strong>${v.capacity.toLocaleString()} lb</strong></span></div><p>${v.length} × ${v.width} m · ${v.fuelCapacity} L tank · ${v.travelBurn} L/h passage · ${(v.maxSpeed * 1.943844).toFixed(0)} kn unloaded<br>${(v.draft ?? def.spec.draft ?? 2).toFixed(1)} m contact depth · ${def.drive}</p><p>${controlsText(def.controls, bind)}</p><p>Requires ${RANKS[v.rank].name}. Resale: 50% of condition-adjusted hull and fittings, plus half-price remaining fuel. Fit another owned boat to make its sale available. Boats retain their own damage, fuel and equipment. Lost vessels must be replaced.</p>`;
  }
  if (ui.screen === 'yourboat') {
    const spec = boatSpec(w);
    detail = `<h3>${boatDefinition(w.boat.configuration).name}</h3><p>${boatDefinition(w.boat.configuration).drive} · ${spec.length} × ${spec.width} m · ${spec.capacity.toLocaleString()} lb deck</p><h3>Current setup</h3><div class="career-numbers"><span>Speed at this load<strong>${(spec.maxSpeed * 1.943844).toFixed(1)} kn</strong></span><span>Passage fuel<strong>${spec.travelBurn.toFixed(1)} L/h</strong></span></div><p>Fuel ${w.boat.fuel.toFixed(0)} / ${spec.fuelCapacity} L · Hull ${Math.round(w.boat.hullHealth * 100)}% · Drive ${Math.round(w.boat.driveHealth * 100)}%</p>${equipmentPlan(w)}`;
  }
  if (ui.screen === 'buyboat') {
    title = 'Buy this boat?';
    detail = `<p>Are you sure? Confirm the boat and price below.</p>${detail}`;
  }
  if (ui.screen === 'outfit') {
    title = 'Fit the boat for your work.';
    const item = UPGRADES.find((item) => item.id === ui.equipmentCandidate);
    detail = item ? equipmentDetail(w, item) : equipmentShopIntro(w);
  }
  if (ui.screen === 'accounts') {
    title = 'Keep the boat working.';
    detail = `<h3>${money(c.cash)} available</h3><p>Debt ${money(c.debt)} · ${ECONOMY.developmentCredit ? 'development credit: repeat $5,000 loans, no total cap' : 'credit limit ' + money(ECONOMY.creditBase + rankOf(c) * ECONOMY.creditPerRank)}<br>Daily interest ${(ECONOMY.interest * 100).toFixed(2)}% · ${money(c.debt * ECONOMY.interest)} today · ~${money(c.debt * ECONOMY.interest * seasonStatus(c).length)} per season at this balance</p><p>Area licence valid through day ${c.licenceThrough}. This is a fictional simplified fishery.</p><p>${[
      ...COASTS,
    ]
      .map((area) => {
        const status = areaStatus(c, area.sectors[0]);
        return `${area.name}: ${status.access ? 'ACCESS HELD' : `Area not open · permit ${money(area.accessCost)}`}<br>${area.sectors
          .map((id) => {
            const subarea = areaStatus(c, id);
            return `${subarea.definition.name} (day ${subarea.definition.openDay})`;
          })
          .join(' · ')}`;
      })
      .join(
        '<br>',
      )}</p><p>Your boat is automatically insured on departure. The premium is included in trip costs, with ${Math.round(ECONOMY.insuranceCover * 100)}% of the boat's purchase value covered after a total loss. Coverage is fixed when leaving harbour. Equipment is not covered.</p><p>Routine repairs are ready for the next trip. Major drive work can take lay days.</p>`;
  }
  if (ui.screen === 'accounts')
    detail += `<p>Next-trip premium: <strong>${money(insurancePremium(c))}</strong>. Each diver injury adds $25 to future premiums; a fatality adds $75. Medical injuries count too. The current trip’s cover stays fixed.</p>`;
  if (ui.screen === 'archives') {
    title = 'Earlier careers.';
    detail =
      '<h3>Saved days and careers.</h3><p>Each new day at harbour keeps its starting state. Save game now in the logbook keeps an extra restore point. Loading archives your current progress first, so you can undo the choice. Browser storage is local to this browser; export backups for safekeeping.</p>' +
      storageLine(ui.hooks.storageReport?.());
  }
  if (ui.screen === 'fleetboard') {
    title = 'Other boats. Other days.';
    detail =
      c.opponents
        .filter((r) => !r.hidden)
        .map((r) => {
          const result = c.lastFleet?.find((s) => s.id === r.id);
          return `<section class="fleet-report"><h3>${r.boat} · ${r.name}</h3><p>${r.bio}<br>${result ? `Reported catch${result.day !== undefined ? ` · day ${result.day} · ${result.minute >= 1440 ? 'day complete' : `as of ${formatClock(result.minute)}`}` : ''}: ${result.gross.toLocaleString()} lb from ${result.area}.` : 'No recent landing report.'}</p></section>`;
        })
        .join('') +
      '<p>The fleet works the same grounds. Reports show the latest recorded day and time; weather, tide and recent picking can change the next trip.</p>';
  }
  if (ui.screen === 'logbook') {
    title = 'The days add up.';
    detail = `<img class="catch-sheet" alt="Yellow catch log: latest twelve landings" src="data:image/svg+xml,${encodeURIComponent(catchSheetSvg(c))}"/><h3>${RANKS[rankOf(c)].name} · ${Math.round(c.xp)} experience</h3><p>${c.records.days} days worked · ${Math.round(c.records.totalCatch / Math.max(1, c.records.days))} lb average<br> ${Math.round(c.records.totalCatch).toLocaleString()} lb recovered<br>Best load ${Math.round(c.records.bestLoad).toLocaleString()} lb · Best return ${money(c.records.bestReturn)}<br>Total sales ${money(c.records.totalRevenue)} · Longest working day ${Math.floor((c.records.longestDayMinutes || 0) / 60)}h ${Math.round((c.records.longestDayMinutes || 0) % 60)}m</p><div class="career-history">${c.history.map((r) => `<p>Day ${r.day} · ${r.ground || 'harbour'} · ${Math.round(r.gross)} lb · ${money(r.net)}${r.onTime ? '' : ' · late'}${r.sunk ? ' · vessel lost' : ''}</p>`).join('') || '<p>Your first page is waiting.</p>'}</div><p>${RANKS.map((r) => `${r.name}: ${r.xp.toLocaleString()} experience`).join('<br>')}<br>Land good catch and bring the crew home safely to build your reputation.</p>`;
  }
  if (ui.screen === 'office') {
    title = 'The harbour office.';
    detail = `<h3>Season ${seasonStatus(c).season} · day ${seasonStatus(c).day} / ${seasonStatus(c).length}</h3><p>${seasonStatus(c).label} · ${seasonStatus(c).daysLeft} days left.</p><p>${c.assists.departureGuidance ? 'Grounds stay worked out through the season. Leave survivors for next season; stripped ground recovers very slowly. More kelp can establish on depleted reef.' : 'Last season’s ground reports are observations, not promises.'}</p><p class="buyer-notice">Buyer: ${buyerNotice(c)}</p><p>${c.news.join('<br>')}</p><p>Book fuel and repairs, check the fleet’s last landings, or take a day ashore.</p><p>Rest recovers crew. Dock work earns ${money(ECONOMY.dockWage)} and advances the day; debt interest still accrues.</p>`;
  }
  if (ui.screen === 'workshop') {
    title = c.sandbox ? 'Developer conditions' : 'Training Mode · aboard with Frank';
    detail =
      '<p>Repeat Frank’s cove tutorial in a practice copy of your current boat. Extra lessons for its handling and fitted equipment come first, including night work when you have lights.</p><p>Your career, catches, money, crew and charts wait unchanged. Finish or leave the lesson to return.</p>';
  }
  if (ui.screen === 'training') {
    title = 'Training tools · isolated test world';
    detail =
      '<p>Force a diver state, air or bag; change the selected ground; level or delevel a person; test repeated-dive behavior; single-step while menus pause ordinary simulation.</p><p>Use Test conditions for weather, current, encounter rates, clock and unlocks. Boats and equipment are available through the normal harbour menus after unlocking.</p><p>Hidden table adherence and injury thresholds are debugging information. The diver info panel shows a fictional nitrogen meter and full-bag readiness. This is a fictional game model, never real dive guidance.</p><p>Changes affect this Test Mode session only. Leave Test Mode to restore your saved real career.</p>';
  }
  if (SHOP_SCREENS.includes(ui.screen) && ui.screen !== 'outfit' && !ui[shopField(ui.screen)])
    detail = `<h3>${ui.screen === 'outfit' ? 'Pick equipment' : 'Pick a boat'}</h3><p>Tap a card to select it and see its details. Then use Buy to review the purchase. Nothing is selected yet.</p>`;
  ui.panel.classList.add('day-panel');
  if (
    (!SHOP_SCREENS.includes(ui.screen) || ui[shopField(ui.screen)]) &&
    ['starter', 'fleet', 'boatshop', 'buyboat', 'yourboat'].includes(ui.screen)
  ) {
    const id = previewBoat;
    detail =
      (ui.screen === 'yourboat'
        ? fittingPreview(w)
        : vesselPreview(id, boatDefinition(id).name, { rotatable: true })) + detail;
  }
  ui.panel.innerHTML = `<div class="day-heading"><div><div class="eyebrow">URCHIN SKIPPER · DAY ${c.day} · ${money(c.cash)}</div><h2>${title}</h2></div></div><div class="career-layout"><div class="career-choices choices"></div><article class="career-detail">${detail}</article></div><div class="day-footer">${ui.menuNotice || ui.saveNotice || `${bind('menuUp')} / ${bind('menuDown')} Navigate · ${bind('confirm')} Select · Right stick scrolls detail · ${bind('back')} Back`}</div>`;
  const list = ui.panel.querySelector('.choices');
  paintVesselPreviews(ui.panel);
  if (SHOP_SCREENS.includes(ui.screen)) {
    renderShopChoices(ui, w, actions);
    paintFittingPreviews(ui.panel, w);
    return;
  }
  paintFittingPreviews(ui.panel, w);
  if (ui.screen === 'crew') list.classList.add('crew-grid');
  if (ui.screen === 'boatshop') list.classList.add('boat-pairs');
  choices.forEach((label, index) => {
    const b = choiceButton(ui, w, label, index, { action: actions[index] });
    if (ui.screen === 'boatshop' && actions[index].boatId) {
      const preview = () => {
        if (ui.index !== index) {
          ui.index = index;
          ui.signature = null;
        }
      };
      b.onpointerenter = (e) => {
        if (e.pointerType === 'mouse') preview();
      };
      b.onfocus = preview;
    }
    if (ui.screen === 'crew' && actions[index].crewId) {
      const p = people.find((p) => p.id === actions[index].crewId),
        record = c.people[p.id],
        locked = !!crewContact(c, p) || record.condition !== 'fit' || record.availableDay > c.day;
      b.innerHTML =
        portrait(p) +
        `<span>${p.name}</span><small>${locked ? (rankOf(c) < p.rank ? RANKS[p.rank].name : record.condition !== 'fit' ? record.condition : 'Working record needed') : c.crew.includes(p.id) ? 'Aboard' : `Assign berth ${(ui.crewSlot || 0) + 1}`}</small>`;
      b.classList.add('crew-card');
      b.classList.toggle('unavailable', locked);
    }
    if (ui.screen === 'crew' && actions[index].slot !== undefined) b.classList.add('crew-berth');

    list.append(b);
  });
  list.children[ui.index]?.scrollIntoView({ block: 'nearest' });
}
