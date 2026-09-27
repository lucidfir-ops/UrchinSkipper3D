import { FLEET, FLEET_ORDER, UPGRADES, money } from './career-data.js';
import { boatDefinition } from './boats.js';
import { buyVessel, buyEquipment, equipment } from './career-state.js';
import { STARTER_BOATS, chooseFirstBoat } from './starter-career.js';
import { confirmPurchase } from './purchase.js';

export const SHOP_SCREENS = ['starter', 'fleet', 'boatshop', 'outfit'];
export const shopField = (screen) =>
  screen === 'starter'
    ? 'starterCandidate'
    : screen === 'outfit'
      ? 'equipmentCandidate'
      : 'boatCandidate';
export function shopActions(ui, w) {
  if (!SHOP_SCREENS.includes(ui.screen)) return null;
  const starter = ui.screen === 'starter',
    outfit = ui.screen === 'outfit',
    field = shopField(ui.screen),
    items = outfit
      ? UPGRADES
      : (starter ? STARTER_BOATS : FLEET_ORDER).map((id) => ({
          id,
          ...FLEET[id],
          name: boatDefinition(id).name,
        })),
    selected = items.find((item) => item.id === ui[field]),
    owned = (id) =>
      outfit
        ? equipment(w).includes(id)
        : !starter && w.career.fleet[id] && !w.career.fleet[id].lost,
    available = !!selected && !owned(selected.id),
    buy = () => {
      if (!available) return;
      const id = selected.id;
      confirmPurchase(
        ui,
        `Buy ${selected.name} · ${money(selected.price)}`,
        () => {
          if (outfit) return buyEquipment(w, id);
          if (!starter) return buyVessel(w, id);
          const result = chooseFirstBoat(w, id);
          if (result.ok) {
            ui.open(null);
            ui.open('harbour');
          }
          return result;
        },
        'Check the item and price. Your money is only committed when you confirm.',
      );
    },
    purchase = (id, label, placement) => ({ id, label, run: buy, disabled: !available, placement });
  return [
    ...(!starter
      ? [{ id: 'your-boat', label: 'Your boat', run: () => ui.open('yourboat'), placement: 'top' }]
      : []),
    purchase(
      'buy-top',
      selected
        ? outfit
          ? 'Buy selected equipment'
          : 'Buy selected boat'
        : outfit
          ? 'Pick equipment first'
          : 'Pick a boat first',
      'top',
    ),
    ...items.map((item) => ({
      id: `${starter ? 'starter' : outfit ? 'equipment' : 'buy'}-${item.id}`,
      label: `${starter ? 'Choose ' : ''}${item.name} · ${owned(item.id) ? (outfit ? 'Fitted' : 'Owned') : money(item.price)}`,
      run: () => {
        ui[field] = item.id;
      },
      ...(outfit ? { equipmentId: item.id } : { boatId: item.id }),
      preview: true,
      selected: selected?.id === item.id,
    })),
    purchase('buy-inline', 'Buy', 'inline'),
    purchase(
      'buy-selected',
      selected
        ? outfit
          ? 'Buy selected equipment'
          : 'Buy selected boat'
        : outfit
          ? 'Pick equipment first'
          : 'Pick a boat first',
      'bottom',
    ),
  ];
}
