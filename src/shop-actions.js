import { FLEET, FLEET_ORDER, money } from './career-data.js';
import { boatDefinition } from './boats.js';
import { buyVessel, buyEquipment, equipment } from './career-state.js';
import { STARTER_BOATS, chooseFirstBoat } from './starter-career.js';
import { confirmPurchase } from './purchase.js';
import { equipmentCatalog, equipmentAvailability } from './equipment-fit.js';
import { equipmentPurchaseDetail } from './equipment-view.js';

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
      ? equipmentCatalog()
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
    available =
      !!selected && !owned(selected.id) && (!outfit || equipmentAvailability(w, selected).ok),
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
        outfit
          ? equipmentPurchaseDetail(w, selected)
          : 'Check the item and price. Your money is only committed when you confirm.',
      );
    },
    purchase = (id, label, placement) => ({ id, label, run: buy, disabled: !available, placement });
  return [
    ...(!starter
      ? [{ id: 'your-boat', label: 'Your boat', run: () => ui.open('yourboat'), placement: 'top' }]
      : []),
    ...(!outfit
      ? [purchase('buy-top', selected ? 'Buy selected boat' : 'Pick a boat first', 'top')]
      : []),
    ...items.map((item) => ({
      id: `${starter ? 'starter' : outfit ? 'equipment' : 'buy'}-${item.id}`,
      label: `${starter ? 'Choose ' : ''}${item.name} · ${owned(item.id) ? (outfit && item.slot !== 'timepiece' ? 'Installed' : 'Owned') : money(item.price)}${outfit && !equipmentAvailability(w, item).ok ? ` · ${equipmentAvailability(w, item).label}` : ''}`,
      run: () => {
        ui[field] = item.id;
      },
      ...(outfit ? { equipmentId: item.id } : { boatId: item.id }),
      preview: true,
      selected: selected?.id === item.id,
    })),
    purchase(
      'buy-inline',
      outfit
        ? selected && owned(selected.id)
          ? 'Installed'
          : selected && !equipmentAvailability(w, selected).ok
            ? equipmentAvailability(w, selected).label
            : 'Buy & fit'
        : 'Buy',
      'inline',
    ),
    purchase(
      'buy-selected',
      selected
        ? outfit
          ? owned(selected.id)
            ? selected.slot === 'timepiece'
              ? 'Clock face owned'
              : 'Installed on this boat'
            : equipmentAvailability(w, selected).ok
              ? 'Buy selected equipment'
              : equipmentAvailability(w, selected).label
          : 'Buy selected boat'
        : outfit
          ? 'Pick equipment first'
          : 'Pick a boat first',
      'bottom',
    ),
  ];
}
