import { C } from './config.js';
import { clamp } from './terrain.js';
import { catchProfile } from './quota-areas.js';

const cents = (value) => Math.round(value * 100) / 100;
function fraction(seed) {
  return ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
// A deterministic settlement quote, evaluated once. All coefficients are game
// tuning, not a real buyer's price or biological storage model.
export function calculateOffload(w, arrival) {
  const cfg = C.offload,
    gross = w.catch,
    onTime = arrival <= C.day.deadlineMinute + 1e-7;
  const seed =
    (w.terrain.provenance?.seed ?? C.seed) + Math.round(arrival * 10) + Math.round(gross);
  // Missed evening boat: the next 06:00 offload. Arrival after 06:00 waits
  // for the following morning; time is absolute within the fishing trip.
  const offloadMinute = onTime ? arrival : (Math.floor((arrival - 360) / 1440) + 1) * 1440 + 360;
  const delayHours = (offloadMinute - arrival) / 60;
  const lots = w.bags.length
    ? w.bags
    : [{ weight: gross, quality: 0.8, harvestMinute: w.day.minute }];
  const catchValues = {};
  let sourceQuality = 0,
    landed = 0,
    qualityWeight = 0,
    value = 0,
    waterLost = 0,
    buyerPremium = 0,
    buyerAccepted = 0;
  for (const [i, bag] of lots.entries()) {
    const weight = bag.weight,
      profile = catchProfile(
        bag.areaId || w.day.groundId || 'near',
        bag.subAreaId || w.day.subAreaId || 'a',
      ),
      quality = clamp(bag.quality + profile.qualityBonus, 0, 1);
    const ageHours = Math.max(0, arrival - (bag.harvestMinute ?? w.day.minute)) / 60;
    const variation = (fraction(seed + i * 9973) - 0.5) * 2 * cfg.variation;
    const waterLoss = clamp(
      cfg.baseWaterLoss +
        (1 - quality) * cfg.poorQualityLoss +
        ageHours * cfg.ageLossPerHour +
        delayHours * cfg.delayLossPerHour +
        variation,
      cfg.minWaterLoss,
      cfg.maxWaterLoss,
    );
    const landedQuality = clamp(
      quality - ageHours * cfg.ageQualityPerHour - delayHours * cfg.delayQualityPerHour,
      cfg.minQuality,
      1,
    );
    const payable = weight * (1 - waterLoss),
      basePrice = Math.max(
        cfg.minPrice,
        ((cfg.referencePrice * (w.career?.market || 1) * landedQuality) / cfg.referenceQuality) *
          profile.price,
      );
    const demand = w.career?.buyerToday,
      qualifies = demand && demand.day === w.career.day && landedQuality >= demand.minQuality,
      accepted = qualifies
        ? Math.min(payable, Math.max(0, (demand.target ?? Infinity) - buyerAccepted))
        : 0,
      premium = accepted * basePrice * (demand?.premium || 0),
      price = basePrice + (payable ? premium / payable : 0);
    if (qualifies) {
      buyerPremium += premium;
      buyerAccepted += accepted;
    }
    if (bag.crewId) catchValues[bag.crewId] = (catchValues[bag.crewId] || 0) + payable * price;
    sourceQuality += weight * quality;
    landed += payable;
    waterLost += weight - payable;
    qualityWeight += payable * landedQuality;
    value += payable * price;
  }
  const expenses = cents(
    (w.costs?.fuel || 0) +
      (w.costs?.repair || 0) +
      (w.costs?.rescue || 0) +
      (w.costs?.hullRepair || 0),
  );
  return {
    buyerPremium: cents(buyerPremium),
    buyerAccepted,
    buyerDemand: w.career?.buyerToday || null,
    lateMinutes: Math.max(0, Math.ceil(arrival - C.day.deadlineMinute - 1e-7)),
    catchValues,
    expenses,
    costs: { ...w.costs },
    netValue: cents(value - expenses),
    rescue: w.day.rescue || null,
    crew: w.divers.map((d) => ({
      id: d.id,
      name: d.name,
      condition: d.condition || 'fit',
      availableDay: w.career?.people?.[d.crewId]?.availableDay,
      injuryCause: w.career?.people?.[d.crewId]?.injuryCause || null,
    })),
    safety: w.safety ? structuredClone(w.safety) : null,
    sunk: !!w.boat.sinking,
    boatId: w.boat.configuration,
    onTime,
    catch: gross,
    gross,
    quality: gross ? sourceQuality / gross : 0,
    landed,
    waterLost,
    waterLoss: gross ? waterLost / gross : 0,
    landedQuality: landed ? qualityWeight / landed : 0,
    price: landed ? value / landed : 0,
    value: cents(value),
    delayHours,
    arrival,
    offloadMinute,
    discarded: w.discarded || 0,
    assisted: w.day.assisted,
    priceIsPrototype: true,
  };
}
