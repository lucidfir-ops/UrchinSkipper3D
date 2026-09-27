// Diver bubbles/bags and helm feedback are local events, not radio broadcasts.
export const isRadioMessage = (text) =>
  /^(DFO(?: PATROL)?\s*·|RADIO\s*[·:—]|COAST GUARD\s*[·:—]|MAYDAY\b|WEATHER RADIO\b)/i.test(text);
