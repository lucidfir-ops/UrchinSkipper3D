// Engine condition and available power are different facts. Keep every view on
// the same causes as the force model; a stopped engine never locks helm input.
export function engineState(w) {
  const b = w.boat;
  if (b.sinking)
    return {
      powered: false,
      code: 'sinking',
      label: 'VESSEL SINKING',
      action: 'Radio for emergency assistance',
    };
  if ((b.driveHealth ?? 1) <= 0)
    return {
      powered: false,
      code: 'drive',
      label: 'DRIVE FAILED',
      action: 'Radio for rescue / harbour tow',
    };
  if (b.fuel <= 0)
    return {
      powered: false,
      code: 'fuel',
      label: 'OUT OF FUEL · ENGINE STOPPED',
      action: 'Open the menu → Radio for rescue / harbour tow',
    };
  if (w.day.engineDelay > 0)
    return {
      powered: false,
      code: 'filter',
      label: 'ENGINE CHECK IN PROGRESS',
      action: 'Crew checking the filter · keep clear',
    };
  return { powered: true, code: 'running', label: 'Engine available', action: '' };
}
