// The quote and transaction stay together; ordinary simulation pauses here.
export function confirmPurchase(ui, label, run, detail = '') {
  ui.pendingPurchase = { label, run, detail };
  ui.open('purchase');
  ui.input?.suppress();
}
export function confirmAction(ui, label, run, detail, cancelLabel = 'Cancel · stay here') {
  confirmPurchase(ui, label, run, detail);
  Object.assign(ui.pendingPurchase, { title: 'Are you sure?', cancelLabel });
  ui.index = 0;
}
export function purchaseActions(ui) {
  return [
    {
      id: 'cancel-purchase',
      label: ui.pendingPurchase?.cancelLabel || 'Cancel · keep my money',
      run: () => {
        ui.pendingPurchase = null;
        ui.previous();
      },
    },
    {
      id: 'confirm-purchase',
      label: ui.pendingPurchase?.label || 'Purchase unavailable',
      run: () => {
        const purchase = ui.pendingPurchase;
        ui.pendingPurchase = null;
        ui.previous();
        return purchase?.run();
      },
    },
  ];
}
