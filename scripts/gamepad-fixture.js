// Serialized by Playwright before the page loads. Names/indices remain explicit
// so suites can exercise sparse pads, disconnects and device-specific mappings.
export function gamepadScript({
  name = 'fakePad',
  id = 'Test Xbox',
  index = 0,
  mapping = 'standard',
  absent = false,
  buttons = 17,
} = {}) {
  window[name] = absent
    ? null
    : {
        id,
        index,
        mapping,
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: buttons }, () => ({ value: 0, pressed: false })),
      };
  navigator.getGamepads = () => {
    const pad = window[name];
    if (!pad || pad.connected === false) return [];
    const result = Array((pad.index || 0) + 1).fill(null);
    result[pad.index || 0] = pad;
    return result;
  };
}
export async function pressGamepad(page, name, button) {
  for (const value of [1, 0]) {
    await page.evaluate(
      ({ name, button, value }) => {
        window[name].buttons[button] = { value, pressed: !!value };
      },
      { name, button, value },
    );
    await page.waitForFunction(
      ({ name, button, value }) =>
        !!window.urchinDebug.input.buttonPrevious[`pad0/b${button}`] === !!value,
      { name, button, value },
    );
    await page.waitForTimeout(50);
  }
}
export async function pressAction(page, name, action) {
  const button = await page.evaluate((action) => {
    const binding = window.urchinDebug.input.map[action]?.find((c) => /^b\d+$/.test(c));
    if (!binding) throw Error('No gamepad binding for ' + action);
    return Number(binding.slice(1));
  }, action);
  await pressGamepad(page, name, button);
}
