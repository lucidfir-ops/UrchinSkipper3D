// The designer's three test devices in CSS pixels (shared by visual fixtures).
export const DEVICES = [
  // Samsung Galaxy S22 portrait, touch.
  { id: 'phone', viewport: { width: 360, height: 780 }, scale: 3, touch: true },
  // Doogee E3 Tab Max (14", 2560×1600) landscape at 2× density, touch.
  { id: 'tablet', viewport: { width: 1280, height: 800 }, scale: 2, touch: true },
  // Steam Deck 1280×800, desktop browser, keyboard / Deck controls.
  { id: 'deck', viewport: { width: 1280, height: 800 }, scale: 1, touch: false },
];
