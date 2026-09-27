export const godmode = (w) => w.career?.debugConditions?.godmode === true;
export function toggleGodmode(w) {
  const conditions = (w.career.debugConditions ??= { weather: 'natural', tideHeight: null });
  conditions.godmode = !conditions.godmode;
  w.day.assisted = true;
  return {
    ok: true,
    reason: conditions.godmode
      ? 'GODMODE ON · new boat damage and diver injuries prevented; fuel is free. Existing injuries and losses remain.'
      : 'Godmode OFF · ordinary damage, diver injuries and fuel use restored.',
  };
}
