// Every world replacement clears transient state against the new clock.
export function resetSessionView(scene, { resetZoom = false, zoom = 1 } = {}) {
  scene.view.reset();
  scene.nextPanelCheck = 0;
  scene.lastHud = scene.lastMessage = null;
  scene.metrics?.reset();
  scene.hudKey = null;
  scene.nextHud = 0;
  const ui = scene.playtest;
  if (ui) {
    ui.messages = [];
    ui.importantNotice = null;
    ui.voyageUntil = 0;
    ui.lastBuckets = { throttle: 0, rudder: 0 };
    ui.signature = null;
    ui.forwardHistory = [];
    ui.pendingPurchase = null;
    ui.boatCandidate = ui.starterCandidate = ui.equipmentCandidate = undefined;
    ui.history = [];
  }
  if (resetZoom) scene.cameras.main.setZoom(zoom);
}
